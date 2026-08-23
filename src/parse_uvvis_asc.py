"""
ALCheMy Characterization Parser - UV-Vis/NIR Diffuse Reflectance (.asc)
Parses native PerkinElmer Lambda 1050 "PE UV SUBTECH SPECTRUM ASCII" export files
into standard ALCheMy schema.

The old parser threw away almost the entire file: it scanned every line for any
pair of numbers, ignoring that the first ~90 lines are a structured instrument header
(scan date/time, instrument model+serial, software version, and the real programmed
wavelength range) and that the numeric data only starts after a literal '#DATA' marker.
Two bugs came from that: (1) none of the real header fields were ever read - instrument
name/serial were hardcoded guesses; (2) the Y-axis unit was assumed to always be '%R'
(percent reflectance) and Kubelka-Munk was computed unconditionally - but at least one
real file in the data lake is recorded in Absorbance ('A') instead, where several values
are negative, so blindly applying the reflectance formula produced meaningless numbers.
This parser reads the declared Y-axis unit from the '#GR' block and only derives the
Kubelka-Munk transform when the data is actually reflectance.

There are two file variants per measurement in the data lake: '<name>.Sample.asc' (the
corrected/final spectrum) and '<name>.Sample.Raw.Sample.asc' (a raw/uncorrected scan) -
both are the same PE ASCII format and both are handled identically here; a companion
'<name>.Sample.Raw.csv' is a plain CSV re-export of the same data with no header at all
and is not read by the n8n router (technique+extension rule only matches '.asc').

Specification Document: notebooks/CHARACTERIZATION_DICTIONARY_SPEC.md
"""

import os
import re
import pandas as pd
import numpy as np

# n8n's Python task runner sandbox permanently blocks the bare 'open' builtin
# (it's in BUILTINS_DENY_DEFAULT regardless of any stdlib/external allow-list).
# io.open is the exact same function, reachable because 'io' is on the allow-list -
# shadow the name once here so every 'open(...)' call below works both locally and
# inside the sandboxed runner.
import io
open = io.open


def _to_float_comma(s):
    """PE ASCII numbers use ',' as the decimal point, e.g. '800,000000' -> 800.0."""
    try:
        return float(s.strip().replace(',', '.'))
    except (ValueError, AttributeError):
        return None


def parse_uvvis_asc(file_path, sample_code=None, measurement_tag='as_synthesized'):
    with open(file_path, 'r', encoding='latin1', errors='ignore') as f:
        lines = [l.rstrip('\n').rstrip('\r') for l in f]

    # Fixed-position header (PE "SUBTECH SPECTRUM ASCII" format): lines 2-14 (0-indexed)
    # are always present in this order regardless of instrument settings.
    header = {
        'declared_file_name': lines[2].strip() if len(lines) > 2 else None,
        'date_created': lines[3].strip() if len(lines) > 3 else None,
        'time_created': lines[4].strip() if len(lines) > 4 else None,
        'date_modified': lines[5].strip() if len(lines) > 5 else None,
        'time_modified': lines[6].strip() if len(lines) > 6 else None,
        'operator_login': lines[7].strip() if len(lines) > 7 else None,
        'scan_end_wavelength_nm': _to_float_comma(lines[9]) if len(lines) > 9 else None,
        'instrument_model': lines[11].strip() if len(lines) > 11 else None,
        'instrument_serial': lines[12].strip() if len(lines) > 12 else None,
        'software_version': lines[13].strip() if len(lines) > 13 else None,
    }

    # '#GR' block declares the real scan geometry and Y-axis unit - 8 lines after the
    # marker: x_unit, y_unit, x_scale, y_scale, start_wavelength, interval, num_points,
    # bit_depth, y_max, y_min (last two only present on some exports).
    gr_idx = None
    for i, l in enumerate(lines):
        if l.strip() == '#GR':
            gr_idx = i
            break

    x_unit = y_unit = None
    scan_start_wavelength_nm = data_interval_nm = None
    num_points_declared = None
    y_max_declared = y_min_declared = None
    if gr_idx is not None:
        gr_lines = lines[gr_idx + 1: gr_idx + 11]
        if len(gr_lines) >= 7:
            x_unit = gr_lines[0].strip()
            y_unit = gr_lines[1].strip()
            scan_start_wavelength_nm = _to_float_comma(gr_lines[4])
            data_interval_nm = _to_float_comma(gr_lines[5])
            try:
                num_points_declared = int(gr_lines[6].strip())
            except ValueError:
                num_points_declared = None
        if len(gr_lines) >= 10:
            y_max_declared = _to_float_comma(gr_lines[8])
            y_min_declared = _to_float_comma(gr_lines[9])

    # Actual data: strictly after the literal '#DATA' marker, tab-separated, comma-decimal
    data_idx = None
    for i, l in enumerate(lines):
        if l.strip() == '#DATA':
            data_idx = i
            break

    x_wave, y_val = [], []
    if data_idx is not None:
        for l in lines[data_idx + 1:]:
            if not l.strip():
                continue
            parts = l.split('\t')
            if len(parts) != 2:
                continue
            w, v = _to_float_comma(parts[0]), _to_float_comma(parts[1])
            if w is not None and v is not None:
                x_wave.append(w)
                y_val.append(v)

    x_arr = np.array(x_wave)
    y_arr = np.array(y_val)
    sort_idx = np.argsort(x_arr)
    x_arr = x_arr[sort_idx]
    y_arr = y_arr[sort_idx]

    if not sample_code:
        base_name = os.path.basename(file_path)
        code_match = pd.Series([base_name]).str.extract(r'(RS\d+|LP\d+|RSMix\d+|IEF-\d+)', expand=False).dropna()
        sample_code = code_match.iloc[0].upper() if len(code_match) > 0 else 'UNKNOWN'

    y_label_map = {'%R': 'reflectance_percent', '%T': 'transmittance_percent', 'A': 'absorbance'}
    y_label = y_label_map.get(y_unit, y_unit or 'signal')

    # Tauc-plot photon energy is unit-independent, always safe to derive.
    ev = 1239.8 / np.maximum(x_arr, 1.0) if len(x_arr) > 0 else np.array([])

    raw_data = {
        'x_label': 'wavelength_nm',
        'y_label': y_label,
        'x': x_arr.round(2).tolist(),
        'y': y_arr.round(4).tolist(),
    }

    # Kubelka-Munk F(R) = (1-R)^2 / 2R only makes physical sense when the signal is
    # genuinely reflectance - applying it to absorbance data (as the old parser did
    # unconditionally) produces meaningless numbers from negative/near-zero inputs.
    if y_unit == '%R' and len(x_arr) > 0:
        r_norm = np.clip(y_arr / 100.0, 0.001, 0.999)
        fr = ((1.0 - r_norm) ** 2) / (2.0 * r_norm)
        raw_data['tauc_plot_derived'] = {
            'basis': 'kubelka_munk_from_reflectance',
            'photon_energy_ev': ev.round(3).tolist(),
            'kubelka_munk_f_r': fr.round(4).tolist(),
        }
    elif y_unit == 'A' and len(x_arr) > 0:
        raw_data['tauc_plot_derived'] = {
            'basis': 'direct_absorbance',
            'photon_energy_ev': ev.round(3).tolist(),
        }

    return {
        'sample_code': sample_code,
        'technique': 'UV_VIS',
        'measurement_tag': measurement_tag,
        'operator_name': header['operator_login'] or 'Analyst',
        'instrument_name': (header['instrument_model'] or 'PerkinElmer Lambda 1050') +
                            (f" ({header['instrument_serial']})" if header['instrument_serial'] else ''),
        'file_name': os.path.basename(file_path),
        'raw_file_path': file_path,
        'data_json': {
            'header_metadata': {
                'sample_name_raw': header['declared_file_name'] or os.path.basename(file_path),
                'software_version': header['software_version'],
                'acquisition_date': header['date_created'],
                'acquisition_time': header['time_created'],
                'last_saved_date': header['date_modified'],
                'last_saved_time': header['time_modified'],
                'measurement_mode': {'%R': 'Diffuse Reflectance', '%T': 'Transmittance', 'A': 'Absorbance'}.get(y_unit, y_unit),
                'x_unit': x_unit,
                'y_unit': y_unit,
                'scan_start_wavelength_nm': scan_start_wavelength_nm,
                'scan_end_wavelength_nm': header['scan_end_wavelength_nm'],
                'data_interval_nm': data_interval_nm,
                'num_data_points_declared': num_points_declared,
                'num_data_points': len(x_arr),
                'y_max_declared': y_max_declared,
                'y_min_declared': y_min_declared,
                'wavelength_range_nm': [float(x_arr[0]), float(x_arr[-1])] if len(x_arr) > 0 else None,
            },
            'raw_data': raw_data
        }
    }
