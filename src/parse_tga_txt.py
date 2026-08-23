"""
ALCheMy Characterization Parser - TGA (.txt)
Parses TA Instruments SDT Q600 thermogravimetric .txt files into standard ALCheMy schema.

Specification Document: notebooks/CHARACTERIZATION_DICTIONARY_SPEC.md
"""

import os
import re
import io
import pandas as pd

# n8n's Python task runner sandbox permanently blocks the bare 'open' builtin
# (it's in BUILTINS_DENY_DEFAULT regardless of any stdlib/external allow-list).
# io.open is the exact same function, reachable because 'io' is on the allow-list -
# shadow the name once here so every 'open(...)' call below works both locally and
# inside the sandboxed runner.
import io
open = io.open


def _parse_header_line(line):
    """Header lines are tab-separated key\\tvalue pairs (not free comments)."""
    parts = line.split('\t', 1)
    key = parts[0].strip()
    value = parts[1].strip() if len(parts) > 1 else ''
    return key, value


def parse_tga_txt(file_path, sample_code=None, measurement_tag='as_synthesized'):
    metadata = {}
    xcomments = []
    cal_dates = []
    cal_files = []
    org_method_steps = []
    data_lines = []
    in_data = False

    encoding = 'utf-16'
    try:
        with open(file_path, 'r', encoding='utf-16') as test_f:
            test_f.readline()
    except Exception:
        encoding = 'latin1'

    with open(file_path, 'r', encoding=encoding, errors='ignore') as f:
        for raw_line in f:
            l = raw_line.rstrip('\n').lstrip('\x0c')
            if not in_data:
                if not l.strip() or l.strip() == 'CLOSED':
                    continue
                tokens = l.split()
                if len(tokens) == 7:
                    try:
                        [float(t) for t in tokens]
                        in_data = True
                        data_lines.append(l)
                        continue
                    except ValueError:
                        pass
                key, value = _parse_header_line(l)
                if key == 'Xcomment':
                    xcomments.append(value)
                elif key == 'InstCalDate':
                    cal_dates.append(value)
                elif key == 'InstCalFile':
                    cal_files.append(value)
                elif key == 'OrgMethod':
                    org_method_steps.append(value)
                elif key:
                    metadata[key] = value
            else:
                if l.strip():
                    data_lines.append(l)

    # Pan material + purge gas channels, e.g. "Pan: Alumina", "Gas2: Air 100.0 ml/min"
    pan_material = None
    gases = {}
    for entry in xcomments:
        m = re.match(r'Pan:\s*(.+)', entry)
        if m:
            pan_material = m.group(1).strip()
        m = re.match(r'Gas(\d):\s*(\S+)\s+([\d.]+)\s*ml/min', entry)
        if m:
            gases[f'gas{m.group(1)}_type'] = m.group(2)
            gases[f'gas{m.group(1)}_flow_ml_min'] = float(m.group(3))

    # Calibration provenance per channel (Weight / Heat Flow / DTA Baseline), paired
    # positionally since InstCalDate/InstCalFile always alternate for the same channel
    calibrations = []
    for date_entry, file_entry in zip(cal_dates, cal_files):
        m = re.match(r'^([^:]+):\s*(.+)$', date_entry)
        label, date_info = (m.group(1).strip(), m.group(2).strip()) if m else (date_entry, None)
        m = re.match(r'^([^:]+):\s*(.+)$', file_entry)
        file_info = m.group(2).strip() if m else file_entry
        calibrations.append({'channel': label, 'calibration_info': date_info, 'calibration_file': file_info})

    # Thermal program ramp, e.g. "4: Ramp 5.00 °C/min to 1000.00 °C"
    heating_rate_c_min = None
    target_temperature_c = None
    for step in org_method_steps:
        m = re.search(r'Ramp\s+([\d.]+)\s*.{0,2}C/min to\s+([\d.]+)\s*.{0,2}C', step)
        if m:
            heating_rate_c_min = float(m.group(1))
            target_temperature_c = float(m.group(2))
            break

    initial_mass = 1.0
    mass_unit = 'mg'
    if 'Size' in metadata:
        size_parts = metadata['Size'].split('\t')
        try:
            initial_mass = float(size_parts[0])
            if len(size_parts) > 1:
                mass_unit = size_parts[1].strip()
        except (ValueError, IndexError):
            pass

    if not sample_code:
        base_name = os.path.basename(file_path)
        code_match = pd.Series([base_name, metadata.get('Sample', '')]).str.extract(r'(RS\d+|LP\d+|RSMix\d+|IEF-\d+)', expand=False).dropna()
        sample_code = code_match.iloc[0].upper() if len(code_match) > 0 else 'UNKNOWN'

    data_str = "\n".join(data_lines)
    df = pd.read_csv(io.StringIO(data_str), sep=r'\s+', header=None, engine='python', on_bad_lines='skip')
    df = df.iloc[:, :7]
    df.columns = ['time_min', 'temp_c', 'weight_mg', 'heat_flow_mw', 'temp_diff_c', 'temp_diff_uv', 'purge_flow_ml_min']
    for c in df.columns:
        df[c] = pd.to_numeric(df[c], errors='coerce')
    df = df.dropna()

    # TA Instruments appends a terminator row at end-of-run (time_min = -1, every other
    # signal zeroed) - not a real measurement, just an "end of run" marker. Origin always
    # dropped it before plotting; do the same here so weight_percent never shows a fake
    # 0% point at a nonsensical negative time.
    df = df[df['time_min'] >= 0].reset_index(drop=True)

    weight_pct = (df['weight_mg'] / initial_mass) * 100.0 if initial_mass > 0 else df['weight_mg']

    signal_labels = [metadata.get(f'Sig{i}') for i in range(1, int(metadata.get('Nsig', 7)) + 1)]

    acquisition_timestamp = None
    if 'Date' in metadata and 'Time' in metadata:
        acquisition_timestamp = f"{metadata['Date']}T{metadata['Time']}"

    return {
        'sample_code': sample_code,
        'technique': 'TGA',
        'measurement_tag': measurement_tag,
        'operator_name': metadata.get('Operator', 'Rubén'),
        'instrument_name': metadata.get('Instrument', 'SDT Q600 V20.9'),
        'file_name': os.path.basename(file_path),
        'raw_file_path': file_path,
        'data_json': {
            'header_metadata': {
                'sample_name_raw': metadata.get('Sample', os.path.basename(file_path)),
                'initial_sample_mass_mg': initial_mass,
                'mass_unit': mass_unit,
                'instrument_serial': metadata.get('InstSerial'),
                'analysis_module': metadata.get('Module'),
                'run_number': metadata.get('Run'),
                'run_serial': metadata.get('RunSerial'),
                'method_name': metadata.get('Method') or metadata.get('ProcName'),
                'pan_material': pan_material,
                **gases,
                'heating_rate_c_min': heating_rate_c_min,
                'target_temperature_c': target_temperature_c,
                'dsc_cell_constant': float(metadata['Kcell']) if metadata.get('Kcell') else None,
                'calibrations': calibrations,
                'acquisition_timestamp': acquisition_timestamp,
                'signal_labels': signal_labels,
                'num_data_points': len(df)
            },
            'raw_data': {
                'x_label': 'temperature_c',
                'y_label': 'weight_percent',
                'time_min': df['time_min'].round(2).tolist(),
                'temperature_c': df['temp_c'].round(2).tolist(),
                'weight_mg': df['weight_mg'].round(4).tolist(),
                'weight_percent': weight_pct.round(2).tolist(),
                'heat_flow_mw': df['heat_flow_mw'].round(4).tolist(),
                'temp_difference_c': df['temp_diff_c'].round(4).tolist(),
                'temp_difference_uv': df['temp_diff_uv'].round(4).tolist(),
                'purge_flow_ml_min': df['purge_flow_ml_min'].round(2).tolist()
            }
        }
    }
