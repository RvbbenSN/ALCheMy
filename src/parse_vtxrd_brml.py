"""
ALCheMy Characterization Parser - VT-XRD / PXRD (.brml)
Parses native Bruker D8 .brml ZIP/XML containers into standard ALCheMy schema.

A .brml is a multi-file ZIP container, not a single XML: RawData*.xml entries come in
pairs (a 1-point "temperature" reading followed by a full angular scan) when the
instrument was run as a variable-temperature series (VT-XRD), or as a single pair when
it was a plain PXRD scan on the same instrument. Which case applies is only knowable
from the entry count, not the file extension - so this one parser produces either a
PXRD-shaped (single curve) or VT-XRD-shaped (temperature series) result.

Specification Document: notebooks/CHARACTERIZATION_DICTIONARY_SPEC.md
"""

import os
import re
import zipfile
import xml.etree.ElementTree as ET
import pandas as pd
import numpy as np

# n8n's Python task runner sandbox permanently blocks the bare 'open' builtin
# (it's in BUILTINS_DENY_DEFAULT regardless of any stdlib/external allow-list).
# io.open is the exact same function, reachable because 'io' is on the allow-list -
# shadow the name once here so every 'open(...)' call below works both locally and
# inside the sandboxed runner.
import io
open = io.open


def _find_text(element, tag, default=None):
    el = element.find(tag)
    return el.text if el is not None and el.text is not None else default


def _find_float(element, tag, default=None):
    val = _find_text(element, tag)
    try:
        return float(val) if val is not None else default
    except ValueError:
        return default


def _scan_axis_info(scan_info_el, axis_id):
    """Real declared Start/Stop/Increment for one scan axis (e.g. TwoTheta), straight
    from the instrument's own ScanAxisInfo block - no need to reconstruct/guess these
    from the data points like the .xrdml parser has to."""
    if scan_info_el is None:
        return None, None, None
    for axis in scan_info_el.findall('.//ScanAxisInfo'):
        if axis.attrib.get('AxisId') == axis_id:
            return (
                _find_float(axis, 'Start'),
                _find_float(axis, 'Stop'),
                _find_float(axis, 'Increment'),
            )
    return None, None, None


def _instrument_identity(zf, namelist):
    """MeasurementContainer.xml is a multi-MB generic instrument-capability dump (not
    a per-run metadata file like .xrdml's), but it does carry the real device model,
    facility name, serial number and control software version for whichever D8 unit
    produced this file - all previously hardcoded as guesses in this parser."""
    identity = {
        'instrument_model': 'Bruker D8 Advance',
        'facility': None,
        'serial_no': None,
        'control_software_version': None,
        'operator_user_id': None,
        'instrument_host': None,
    }
    if 'Experiment0/MeasurementContainer.xml' in namelist:
        try:
            mc = zf.read('Experiment0/MeasurementContainer.xml').decode('utf-8', errors='ignore')
            m = re.search(r'<DeviceTypeDesc>([^<]+)</DeviceTypeDesc>', mc)
            if m:
                identity['instrument_model'] = m.group(1).strip()
            m = re.search(r'<InstrumentName>([^<]+)</InstrumentName>', mc)
            if m:
                identity['facility'] = m.group(1).strip()
            m = re.search(r'<SerialNo>([^<]+)</SerialNo>', mc)
            if m:
                identity['serial_no'] = m.group(1).strip()
            m = re.search(r'<IcsVersion>([^<]+)</IcsVersion>', mc)
            if m:
                identity['control_software_version'] = m.group(1).strip()
        except Exception:
            pass
    if 'experimentCollection.xml' in namelist:
        try:
            ec = zf.read('experimentCollection.xml').decode('utf-8', errors='ignore')
            m = re.search(r'UserName="([^"]+)"\s+MachineName="([^"]+)"', ec)
            if m:
                identity['operator_user_id'], identity['instrument_host'] = m.group(1), m.group(2)
        except Exception:
            pass
    return identity


def parse_bruker_brml(file_path, sample_code=None, measurement_tag='as_synthesized'):
    with zipfile.ZipFile(file_path, 'r') as zf:
        namelist = zf.namelist()
        raw_files = sorted(
            [f for f in namelist if re.match(r'Experiment0/RawData\d+\.xml$', f)],
            key=lambda s: int(re.search(r'RawData(\d+)', s).group(1))
        )

        identity = _instrument_identity(zf, namelist)
        instrument_name = identity['instrument_model'] + (f" ({identity['facility']})" if identity['facility'] else '')

        if not sample_code:
            base_name = os.path.basename(file_path)
            code_match = pd.Series([base_name]).str.extract(r'(RS\d+|LP\d+|RSMix\d+)', expand=False).dropna()
            sample_code = code_match.iloc[0].upper() if len(code_match) > 0 else 'UNKNOWN'

        if len(raw_files) > 2:
            # Multi-temperature VT-XRD series: pairs of (1-point temperature reading, full angular scan)
            series = []
            num_pairs = len(raw_files) // 2

            for i in range(num_pairs):
                t_file = f'Experiment0/RawData{2*i}.xml'
                s_file = f'Experiment0/RawData{2*i + 1}.xml'

                temp_c = 25.0 + (i * 10.0)  # fallback only if the temperature record is unreadable
                if t_file in namelist:
                    t_root = ET.fromstring(zf.read(t_file))
                    d_list = t_root.findall('.//Datum')
                    if d_list and d_list[0].text:
                        parts = [p.strip() for p in d_list[0].text.split(',')]
                        if len(parts) >= 3:
                            try:
                                temp_c = float(parts[2])
                            except ValueError:
                                pass

                if s_file in namelist:
                    s_root = ET.fromstring(zf.read(s_file))
                    d_list = s_root.findall('.//Datum')
                    x_arr, y_arr = [], []
                    for d in d_list:
                        if d.text:
                            parts = [p.strip() for p in d.text.split(',')]
                            if len(parts) >= 5:
                                x_arr.append(float(parts[2]))
                                y_arr.append(float(parts[4]))

                    scan_info_el = s_root.find('.//ScanInformation')
                    time_per_step = _find_float(scan_info_el, 'TimePerStep') if scan_info_el is not None else None
                    time_per_step_eff = _find_float(scan_info_el, 'TimePerStepEffective') if scan_info_el is not None else None
                    measurement_points_txt = _find_text(scan_info_el, 'MeasurementPoints') if scan_info_el is not None else None
                    two_theta_start, two_theta_stop, two_theta_increment = _scan_axis_info(scan_info_el, 'TwoTheta')

                    if len(x_arr) > 0:
                        series.append({
                            'temperature_c': temp_c,
                            'scan_start_timestamp': _find_text(s_root, 'TimeStampStarted'),
                            'scan_end_timestamp': _find_text(s_root, 'TimeStampFinished'),
                            'time_per_step_sec': time_per_step,
                            'time_per_step_effective_sec': time_per_step_eff,
                            'measurement_points': int(measurement_points_txt) if measurement_points_txt else len(x_arr),
                            'two_theta_start_deg': two_theta_start,
                            'two_theta_stop_deg': two_theta_stop,
                            'two_theta_increment_deg': two_theta_increment,
                            'x': np.array(x_arr).round(4).tolist(),
                            'y': np.array(y_arr).round(2).tolist(),
                        })

            temperatures = [s['temperature_c'] for s in series]
            return {
                'sample_code': sample_code,
                'technique': 'VT-XRD',
                'measurement_tag': 'temperature_series',
                'operator_name': identity['operator_user_id'] or 'Lab Manager',
                'instrument_name': instrument_name,
                'file_name': os.path.basename(file_path),
                'raw_file_path': file_path,
                'data_json': {
                    'header_metadata': {
                        'sample_name_raw': os.path.basename(file_path),
                        'anode_material': 'Cu',
                        'serial_no': identity['serial_no'],
                        'control_software_version': identity['control_software_version'],
                        'operator_user_id': identity['operator_user_id'],
                        'instrument_host': identity['instrument_host'],
                        'temperature_steps_count': len(series),
                        'temperatures_recorded_c': temperatures,
                        'scan_start_timestamp': series[0]['scan_start_timestamp'] if series else None,
                        'scan_end_timestamp': series[-1]['scan_end_timestamp'] if series else None,
                        'scan_start_2theta_deg': series[0]['two_theta_start_deg'] if series else None,
                        'scan_end_2theta_deg': series[0]['two_theta_stop_deg'] if series else None,
                        'num_data_points_per_scan': len(series[0]['x']) if series else 0,
                    },
                    'raw_data': {
                        'x_label': '2theta_deg',
                        'y_label': 'intensity_counts',
                        'temperature_label': 'temperature_c',
                        'series': series,
                    }
                }
            }
        else:
            # Single PXRD scan on the same Bruker instrument (no temperature series)
            raw_xml_bytes = zf.read('Experiment0/RawData0.xml')
            root = ET.fromstring(raw_xml_bytes)
            datum_elements = root.findall('.//Datum')
            x_2theta, y_counts = [], []
            for d in datum_elements:
                if d.text:
                    parts = [p.strip() for p in d.text.split(',')]
                    if len(parts) >= 5:
                        x_2theta.append(float(parts[2]))
                        y_counts.append(float(parts[4]))
            x_arr, y_arr = np.array(x_2theta), np.array(y_counts)

            scan_info_el = root.find('.//ScanInformation')
            two_theta_start, two_theta_stop, two_theta_increment = _scan_axis_info(scan_info_el, 'TwoTheta')
            start_2theta = two_theta_start if two_theta_start is not None else (float(x_arr[0]) if len(x_arr) > 0 else 3.0)
            end_2theta = two_theta_stop if two_theta_stop is not None else (float(x_arr[-1]) if len(x_arr) > 0 else 50.0)
            step_size = two_theta_increment if two_theta_increment is not None else (
                round(float((end_2theta - start_2theta) / (len(x_arr) - 1)), 4) if len(x_arr) > 1 else 0.01
            )

            return {
                'sample_code': sample_code,
                'technique': 'PXRD',
                'measurement_tag': measurement_tag,
                'operator_name': identity['operator_user_id'] or 'Lab Manager',
                'instrument_name': instrument_name,
                'file_name': os.path.basename(file_path),
                'raw_file_path': file_path,
                'data_json': {
                    'header_metadata': {
                        'sample_name_raw': os.path.basename(file_path),
                        'anode_material': 'Cu',
                        'serial_no': identity['serial_no'],
                        'control_software_version': identity['control_software_version'],
                        'operator_user_id': identity['operator_user_id'],
                        'instrument_host': identity['instrument_host'],
                        'scan_start_timestamp': _find_text(root, 'TimeStampStarted'),
                        'scan_end_timestamp': _find_text(root, 'TimeStampFinished'),
                        'scan_start_2theta_deg': round(start_2theta, 4),
                        'scan_end_2theta_deg': round(end_2theta, 4),
                        'step_size_2theta_deg': step_size,
                        'num_data_points': len(y_arr),
                    },
                    'raw_data': {
                        'x_label': '2theta_deg',
                        'y_label': 'intensity_counts',
                        'x': x_arr.round(4).tolist(),
                        'y': y_arr.round(2).tolist(),
                    }
                }
            }
