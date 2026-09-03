"""
ALCheMy Characterization Parser - Electron Microscopy Images (SEM / FESEM / TEM)
Parses a micrograph image plus its companion instrument metadata `.txt` sidecar (when
present) into standard ALCheMy schema.

This is the deterministic half of the microscopy pipeline. Three real sidecar
conventions are confirmed by inspecting the actual data lake:

- Hitachi TM-1000 (SEM), `.jpg`: `[SemImageFile]` INI-style `Key=Value` block.
- JEOL JSM-7900F (FESEM), `.bmp` + `.txt`: `$KEY value` / `$$KEY value` dollar-prefixed
  lines (`$CM_INSTRUMENT`, `$CM_MAG`, `$$SM_WD`...). Some images also carry `$AN_TEXT%N`
  annotation lines - these are dimensions the OPERATOR measured by hand with the SEM
  software's own calibrated cursor tool (e.g. `"X:19.875um"`), not a guess by anyone -
  captured verbatim as `operator_cursor_annotations` since it is real, trustworthy data.
- TEM (no sidecar at all): magnification is embedded directly in the filename instead
  (e.g. `..._MAG_X3000_001.jpg`, `..._SA-MAG_X25k_003.jpg`) and is extracted from there.

An unrecognized sidecar format falls back to a generic `Key=Value` scan so nothing is
lost even before it's characterized; the full raw dict is kept under
`header_metadata.raw_instrument_metadata` in that case.

A vision-AI step runs AFTER this parser purely to fill in the qualitative
`ai_vision_analysis` sub-object (morphology description + literal transcription of any
on-image scale bar caption) - it never overwrites the metadata extracted here.

Specification Document: notebooks/CHARACTERIZATION_DICTIONARY_SPEC.md
"""

import os
import re
import pandas as pd

# n8n's Python task runner sandbox permanently blocks the bare 'open' builtin
# (it's in BUILTINS_DENY_DEFAULT regardless of any stdlib/external allow-list).
# io.open is the exact same function, reachable because 'io' is on the allow-list -
# shadow the name once here so every 'open(...)' call below works both locally and
# inside the sandboxed runner.
import io
open = io.open


def _read_lines(txt_path):
    # latin1 maps every byte 0-255 1:1, so it never raises - unlike a naive utf-8-first
    # attempt, which can silently mis-decode a stray high byte (e.g. the JEOL sidecar's
    # micro sign, 0xB5) into a spurious multi-byte codepoint instead of raising an error.
    # These instrument text exports are Windows-locale, not UTF-8, so latin1 is correct.
    #
    # Read as BYTES and decode by hand, never text-mode open(): n8n's Python sandbox
    # breaks `open(path, 'r')` with "'NoneType' object is not callable" (constructing
    # the internal TextIOWrapper is blocked) while binary mode works fine. Verified
    # empirically against the live runner.
    with open(txt_path, 'rb') as f:
        text = f.read().decode('latin1', errors='ignore')
    # A couple of real sidecars in this data lake turned out to be non-text binary
    # data under a misleading .txt extension - latin1 decodes it without raising
    # (every byte maps 1:1), but a literal NUL byte can end up embedded in whatever
    # garbage key/value the generic scan below picks up, and Postgres's jsonb type
    # rejects a NUL byte in any string outright ('unsupported Unicode escape sequence').
    # Strip it here so a bad sidecar degrades to no metadata instead of a DB error.
    text = text.replace('\x00', '')
    return [l.rstrip('\r') for l in text.split('\n')]


# El Hitachi nombra cada micrografia como <codigo><contador><aumento>, sin
# ningun separador: RS3520000(x400).jpg es la imagen 0000 de la muestra RS352,
# y RS10080032(x400).jpg es la 0032 de RS1008. El contador siempre ocupa
# exactamente cuatro digitos, asi que la frontera entre codigo y contador es
# la posicion "cuatro digitos antes del parentesis del aumento".
#
# Por que importa: sin quitarlo, el `RS\d+` de mas abajo es gloton y se traga
# tambien el contador, devolviendo muestras que no existen ("RS10080032").
# La ingestion crea entonces una fila placeholder por cada una de ellas, y la
# micrografia queda colgada de esa fila fantasma en vez de la muestra real.
# Eso fue exactamente lo que paso: 988 muestras inventadas en
# synthesis_experiments y 1.009 micrografias desviadas de 297 muestras reales.
#
# Solo se recorta cuando el nombre encaja en la forma completa (codigo, cuatro
# digitos, y el "(x" del aumento). Un nombre que no la cumpla se devuelve tal
# cual, para no estropear ficheros que sigan otro convenio.
_SEM_COUNTER_RE = re.compile(r'^([A-Za-z]+-?\d+?)\d{4}\(x', re.IGNORECASE)


def _strip_image_counter(base_name):
    """Quita el contador de imagen de 4 digitos del nombre de una micrografia.

    >>> _strip_image_counter('RS3520000(x400).jpg')
    'RS352'
    >>> _strip_image_counter('RS10080032(x1.0k)_alt.jpg')
    'RS1008'
    >>> _strip_image_counter('RS1883_survey.jpg')   # otra forma: sin tocar
    'RS1883_survey.jpg'
    """
    match = _SEM_COUNTER_RE.match(base_name)
    return match.group(1) if match else base_name


def _parse_sidecar(txt_path):
    """Returns (metadata_dict, format_name) or ({}, None) if no sidecar exists."""
    if not os.path.exists(txt_path):
        return {}, None

    lines = _read_lines(txt_path)
    if not lines:
        return {}, None

    first = lines[0].strip()

    if first.startswith('[') and first.endswith(']'):
        metadata = {}
        for l in lines[1:]:
            if '=' in l:
                k, v = l.split('=', 1)
                k = k.strip()
                if k:
                    metadata[k] = v.strip()
        return metadata, 'hitachi_ini'

    if first.startswith('$'):
        metadata = {}
        annotations = []
        for l in lines:
            l = l.strip()
            if not l:
                continue
            m = re.match(r'^\$+([A-Za-z0-9_%-]+)\s*(.*)$', l)
            if not m:
                continue
            key, value = m.group(1), m.group(2).strip()
            if key.startswith('AN_TEXT'):
                qm = re.search(r'"([^"]*)"', value)
                if qm and qm.group(1):
                    annotations.append(qm.group(1))
                continue
            if key and key not in metadata:
                metadata[key] = value
        if annotations:
            metadata['_cursor_annotations'] = annotations
        return metadata, 'jeol_dollar'

    metadata = {}
    for l in lines:
        if '=' in l:
            k, v = l.split('=', 1)
            k = k.strip()
            if k:
                metadata[k] = v.strip()
    return metadata, ('generic_key_value' if metadata else None)


def _extract_magnification_from_filename(file_name):
    """TEM images have no sidecar at all - the real magnification is embedded in the
    filename itself, e.g. '..._MAG_X3000_001.jpg' or '..._SA-MAG_X25k_003.jpg'
    ('SA-MAG' = selected-area magnification, used for TEM diffraction-mode shots)."""
    m = re.search(r'(SA-MAG|MAG)_X(\d+)(k)?', file_name, re.IGNORECASE)
    if not m:
        return None, None
    value = float(m.group(2)) * (1000.0 if m.group(3) else 1.0)
    return value, m.group(1).upper()


def parse_microscopy_image(image_path, sample_code=None, technique=None, measurement_tag=None,
                           metadata_txt_path=None):
    # By convention the sidecar sits next to the image with the same basename, which is
    # how it arrives from the data lake. The webhook/form lane instead receives it as a
    # separate upload that an earlier n8n node writes to its own path, so that lane
    # passes the location explicitly.
    txt_path = metadata_txt_path or (os.path.splitext(image_path)[0] + '.txt')
    metadata, format_detected = _parse_sidecar(txt_path)

    technique = (technique or 'SEM').upper()

    if not sample_code:
        base_name = os.path.basename(image_path)
        code_match = pd.Series([_strip_image_counter(base_name)]).str.extract(
            r'(RS\d+|LP\d+|RSMix\d+|IEF-\d+)', expand=False).dropna()
        sample_code = code_match.iloc[0].upper() if len(code_match) > 0 else 'UNKNOWN'

    sample_name_raw = os.path.basename(image_path)
    instrument_name_raw = None
    instrument_serial = None
    scale_bar_marker = None
    accelerating_voltage = None
    working_distance = None
    pixel_size_raw = None
    detector_signal = None
    image_resolution = None
    image_dpi = None
    vacuum_mode = None
    emission_current = None
    acquisition_date = None
    acquisition_time = None
    operator_cursor_annotations = None
    control_software = None
    mag = None
    mag_source = None
    operator_from_sidecar = None

    if format_detected == 'hitachi_ini':
        instrument_serial = metadata.get('SerialNumber')
        instrument_name_raw = metadata.get('InstructName')
        sample_name_raw = metadata.get('DataNumber', sample_name_raw)
        scale_bar_marker = metadata.get('MicronMarker')
        accelerating_voltage = metadata.get('AcceleratingVoltage')
        working_distance = metadata.get('WorkingDistance')
        pixel_size_raw = metadata.get('PixelSize')
        detector_signal = metadata.get('SignalName')
        image_resolution = metadata.get('DataSize')
        dpi = metadata.get('DPI')
        image_dpi = float(dpi) if dpi else None
        vacuum_mode = metadata.get('Vacuum')
        emission_current = metadata.get('EmissionCurrent')
        acquisition_date = metadata.get('Date')
        acquisition_time = metadata.get('Time')
        control_software = 'Hitachi SEM Control Software'
        if metadata.get('Magnification'):
            try:
                mag = float(str(metadata['Magnification']).lower().replace('x', '').strip())
                mag_source = 'sidecar'
            except ValueError:
                pass

    elif format_detected == 'jeol_dollar':
        instrument_model = metadata.get('CM_INSTRUMENT')
        instrument_name_raw = f"JEOL {instrument_model}" if instrument_model else None
        sample_name_raw = metadata.get('CM_TITLE', sample_name_raw)
        scale_bar_marker = metadata.get('SM_MICRON_MARKER')
        accel = metadata.get('CM_ACCEL_VOLT')
        accelerating_voltage = f"{accel} kV" if accel else None
        wd = metadata.get('SM_WD')
        working_distance = f"{wd} mm" if wd else None
        detector_signal = metadata.get('CM_SIGNAL_NAME') or metadata.get('CM_DETECTOR_NAME')
        full_size = metadata.get('CM_FULL_SIZE')
        image_resolution = full_size.replace(' ', 'x') if full_size else None
        emission_current = metadata.get('SM_EMI_CURRENT')
        acquisition_date = metadata.get('CM_DATE')
        acquisition_time = metadata.get('CM_TIME')
        operator_from_sidecar = metadata.get('CM_OPERATOR')
        operator_cursor_annotations = metadata.get('_cursor_annotations')
        control_software = metadata.get('CM_FORMAT') or 'JEOL SEM Control Software'
        if metadata.get('CM_MAG'):
            try:
                mag = float(metadata['CM_MAG'])
                mag_source = 'sidecar'
            except ValueError:
                pass

    magnification_mode = None
    if mag is None:
        fname_mag, fname_mode = _extract_magnification_from_filename(os.path.basename(image_path))
        if fname_mag is not None:
            mag = fname_mag
            mag_source = 'filename'
            magnification_mode = fname_mode

    default_instrument_by_technique = {
        'SEM': 'SEM equipment (see companion metadata)',
        'FESEM': 'FESEM equipment (see companion metadata)',
        'TEM': 'TEM equipment (see companion metadata)',
    }
    if instrument_name_raw:
        instrument_name = instrument_name_raw + (f" ({instrument_serial})" if instrument_serial else '')
    else:
        instrument_name = default_instrument_by_technique.get(technique, 'Electron Microscope')

    operator_name = operator_from_sidecar or 'Lab Manager'

    measurement_tag_resolved = measurement_tag or (f"mag_{int(mag)}x" if mag else 'as_synthesized')

    return {
        'sample_code': sample_code,
        'technique': technique,
        'measurement_tag': measurement_tag_resolved,
        'operator_name': operator_name,
        'instrument_name': instrument_name,
        'file_name': os.path.basename(image_path),
        'raw_file_path': image_path,
        'data_json': {
            'header_metadata': {
                'sample_name_raw': sample_name_raw,
                'companion_metadata_format': format_detected,
                'control_software': control_software,
                'magnification_x': mag,
                'magnification_source': mag_source,
                'magnification_mode': magnification_mode,
                'scale_bar_marker': scale_bar_marker,
                'accelerating_voltage': accelerating_voltage,
                'working_distance': working_distance,
                'pixel_size_raw': pixel_size_raw,
                'detector_signal': detector_signal,
                'image_resolution': image_resolution,
                'image_dpi': image_dpi,
                'vacuum_mode': vacuum_mode,
                'emission_current': emission_current,
                'instrument_serial': instrument_serial,
                'acquisition_date': acquisition_date,
                'acquisition_time': acquisition_time,
                'operator_cursor_annotations': operator_cursor_annotations,
                'raw_instrument_metadata': metadata if format_detected == 'generic_key_value' else None,
            },
            'raw_data': {
                'image_file': os.path.basename(image_path),
                'companion_metadata_file': os.path.basename(txt_path) if metadata or format_detected else None,
                'ai_vision_analysis': None,
            }
        }
    }
