"""
ALCheMy Characterization Parser - Gas Adsorption / BET (.xls)
Parses Micromeritics TriStar physisorption .xls reports into standard ALCheMy schema.

A TriStar report is NOT a simple 2-column table - it's a single flat sheet containing
several report blocks side by side (Summary, Isotherm Tabular, Isotherm Linear Plot,
BET Report, BET Plot, t-Plot, alternate BET fits...). The previous parser assumed the
isotherm lived in columns 0-1 of whichever sheet matched 'isotherm'/'plot' in its name;
in a real file those columns are the Summary Report text block, not data at all - the
real adsorption/desorption curves live several columns to the right. This parser locates
every field by searching for its exact label text instead of assuming a column position,
so it keeps working if a future report shifts columns around.

Specification Document: notebooks/CHARACTERIZATION_DICTIONARY_SPEC.md
"""

import os
import re
import pandas as pd
import numpy as np


def _find_all(df, label):
    """(row, col) of every cell whose stripped text equals label exactly."""
    hits = []
    for r in range(df.shape[0]):
        for c in range(df.shape[1]):
            v = df.iat[r, c]
            if isinstance(v, str) and v.strip() == label:
                hits.append((r, c))
    return hits


def _value_right_of(df, label):
    """First occurrence of label, reading top-to-bottom then left-to-right; the value
    is the adjacent cell in the same row. Report labels repeat (the template prints the
    same header block multiple times side by side) - the first hit is always the
    left-most, top-most copy, which is what we want."""
    hits = _find_all(df, label)
    if not hits:
        return None
    r, c = hits[0]
    if c + 1 < df.shape[1]:
        v = df.iat[r, c + 1]
        return v if pd.notna(v) else None
    return None


def _parse_number_with_unit(raw):
    """'0.0274 g' -> (0.0274, 'g'); '77.300 K' -> (77.3, 'K'); tolerant of '±' error terms."""
    if raw is None:
        return None, None
    s = str(raw).strip()
    m = re.match(r'^([+-]?[\d.]+)\s*(?:±\s*[\d.]+\s*)?(.*)$', s)
    if m:
        try:
            return float(m.group(1)), (m.group(2).strip() or None)
        except ValueError:
            return None, s
    return None, s


def _read_column_series(df, header_row, col):
    """Every numeric value below a header cell, stopping at the first blank."""
    values = []
    r = header_row + 1
    while r < df.shape[0]:
        v = df.iat[r, col]
        if pd.isna(v):
            break
        try:
            values.append(float(v))
        except (ValueError, TypeError):
            break
        r += 1
    return values


def parse_bet_xls(file_path, sample_code=None, measurement_tag=None):
    df = pd.read_excel(file_path, sheet_name=0, header=None)

    facility = df.iat[0, 0] if df.shape[0] > 0 and isinstance(df.iat[0, 0], str) else None

    instrument_name, instrument_serial = None, None
    for r in range(min(5, df.shape[0])):
        for c in range(df.shape[1]):
            v = df.iat[r, c]
            if isinstance(v, str):
                if 'Version' in v and instrument_name is None:
                    instrument_name = v.strip()
                if v.strip().startswith('Serial #') and instrument_serial is None:
                    instrument_serial = v.strip()
        if instrument_name and instrument_serial:
            break

    sample_name_raw = _value_right_of(df, 'Sample:')
    operator_name = _value_right_of(df, 'Operator:')
    original_file_path = _value_right_of(df, 'File:')
    started = _value_right_of(df, 'Started:')
    completed = _value_right_of(df, 'Completed:')
    automatic_degas = _value_right_of(df, 'Automatic degas:')
    adsorptive_gas = _value_right_of(df, 'Analysis adsorptive:')
    thermal_correction = _value_right_of(df, 'Thermal correction:')
    equilibration_interval = _value_right_of(df, 'Equilibration interval:')

    sample_mass_g, _ = _parse_number_with_unit(_value_right_of(df, 'Sample mass:'))
    analysis_free_space_cm3, _ = _parse_number_with_unit(_value_right_of(df, 'Analysis free space:'))
    low_pressure_dose, _ = _parse_number_with_unit(_value_right_of(df, 'Low pressure dose:'))
    bath_temp_k, _ = _parse_number_with_unit(_value_right_of(df, 'Analysis bath temp.:'))
    ambient_free_space_cm3, _ = _parse_number_with_unit(_value_right_of(df, 'Ambient free space:'))
    sample_density_g_cm3, _ = _parse_number_with_unit(_value_right_of(df, 'Sample density:'))

    # BET Report block (not the duplicate "Summary Report" copy, which uses different
    # capitalization - "BET Surface Area:" vs "BET surface area:" - so the exact-match
    # label search naturally lands on the right one)
    bet_surface_area_m2_g, bet_surface_area_error = None, None
    raw = _value_right_of(df, 'BET surface area:')
    if raw:
        m = re.match(r'^([+-]?[\d.]+)\s*±\s*([\d.]+)', str(raw))
        if m:
            bet_surface_area_m2_g, bet_surface_area_error = float(m.group(1)), float(m.group(2))
        else:
            bet_surface_area_m2_g, _ = _parse_number_with_unit(raw)
    bet_slope, _ = _parse_number_with_unit(_value_right_of(df, 'Slope:'))
    bet_y_intercept, _ = _parse_number_with_unit(_value_right_of(df, 'Y-intercept:'))
    bet_c_constant, _ = _parse_number_with_unit(_value_right_of(df, 'C:'))
    bet_qm, _ = _parse_number_with_unit(_value_right_of(df, 'Qm:'))
    bet_correlation_coefficient, _ = _parse_number_with_unit(_value_right_of(df, 'Correlation coefficient:'))
    molecular_cross_section_nm2, _ = _parse_number_with_unit(_value_right_of(df, 'Molecular cross-sectional area:'))

    # The instrument's own validity checks on this fit (from the "BET Optimized Summary"
    # block) - a negative/nonsensical BET area is a bad fit, not a parsing error, and
    # should be flagged as such rather than silently stored as if it were trustworthy.
    def _bool_val(label):
        v = _value_right_of(df, label)
        if isinstance(v, str):
            return v.strip().lower() == 'true'
        return None

    bet_fit_valid = {
        'c_positive': _bool_val('C > 0'),
        'monolayer_in_range': _bool_val('n(min) < monolayer < n(max)'),
        'linear': _bool_val('Linear'),
    }

    # Isotherm Linear Plot section: explicit, separately-labeled Adsorption/Desorption
    # branches (more reliable than splitting the combined "Isotherm Tabular Report" list
    # by pressure direction).
    section_hits = _find_all(df, 'Isotherm Linear Plot')
    adsorption = {'x': [], 'y': []}
    desorption = {'x': [], 'y': []}
    if section_hits:
        _, section_col = section_hits[0]
        pressure_cols = sorted(
            c for r, c in _find_all(df, 'Relative Pressure (P/Po)')
            if section_col <= c < section_col + 10
        )
        if len(pressure_cols) >= 1:
            header_row = _find_all(df, 'Relative Pressure (P/Po)')[0][0]
            for r, c in _find_all(df, 'Relative Pressure (P/Po)'):
                if c == pressure_cols[0]:
                    header_row = r
                    break
            ads_col = pressure_cols[0]
            adsorption['x'] = _read_column_series(df, header_row, ads_col)
            adsorption['y'] = _read_column_series(df, header_row, ads_col + 1)
        if len(pressure_cols) >= 2:
            des_col = pressure_cols[1]
            desorption['x'] = _read_column_series(df, header_row, des_col)
            desorption['y'] = _read_column_series(df, header_row, des_col + 1)

    if not sample_code:
        base_name = os.path.basename(file_path)
        code_match = pd.Series([base_name, sample_name_raw or '']).str.extract(r'(RS\d+|LP\d+|RSMix\d+|IEF-\d+)', expand=False).dropna()
        sample_code = code_match.iloc[0].upper() if len(code_match) > 0 else 'UNKNOWN'

    resolved_measurement_tag = measurement_tag or (
        f"{adsorptive_gas}_{int(round(bath_temp_k))}K" if adsorptive_gas and bath_temp_k else 'adsorption_isotherm'
    )

    return {
        'sample_code': sample_code,
        'technique': 'ADSORPTION',
        'measurement_tag': resolved_measurement_tag,
        'operator_name': operator_name or 'Lab Manager',
        'instrument_name': (instrument_name or 'Micromeritics TriStar') + (f" ({instrument_serial})" if instrument_serial else ''),
        'file_name': os.path.basename(file_path),
        'raw_file_path': file_path,
        'data_json': {
            'header_metadata': {
                'sample_name_raw': sample_name_raw or os.path.basename(file_path),
                'facility': facility,
                'original_file_path': original_file_path,
                'analysis_started': started,
                'analysis_completed': completed,
                'adsorptive_gas': adsorptive_gas or 'N2',
                'analysis_bath_temp_k': bath_temp_k if bath_temp_k is not None else 77.35,
                'sample_mass_g': sample_mass_g,
                'sample_density_g_cm3': sample_density_g_cm3,
                'analysis_free_space_cm3': analysis_free_space_cm3,
                'ambient_free_space_cm3': ambient_free_space_cm3,
                'low_pressure_dose_cm3_g_stp': low_pressure_dose,
                'automatic_degas': automatic_degas,
                'thermal_correction': thermal_correction,
                'equilibration_interval': equilibration_interval,
                'bet_surface_area_m2_g': bet_surface_area_m2_g,
                'bet_surface_area_error_m2_g': bet_surface_area_error,
                'bet_slope': bet_slope,
                'bet_y_intercept': bet_y_intercept,
                'bet_c_constant': bet_c_constant,
                'bet_qm_cm3_g_stp': bet_qm,
                'bet_correlation_coefficient': bet_correlation_coefficient,
                'molecular_cross_section_nm2': molecular_cross_section_nm2,
                'bet_fit_valid': bet_fit_valid,
                'num_data_points_adsorption': len(adsorption['x']),
                'num_data_points_desorption': len(desorption['x'])
            },
            'raw_data': {
                'x_label': 'relative_pressure_p_p0',
                'y_label': 'quantity_adsorbed_cm3_g_stp',
                'adsorption_branch': {
                    'x': np.round(adsorption['x'], 4).tolist() if adsorption['x'] else [],
                    'y': np.round(adsorption['y'], 2).tolist() if adsorption['y'] else []
                },
                'desorption_branch': {
                    'x': np.round(desorption['x'], 4).tolist() if desorption['x'] else [],
                    'y': np.round(desorption['y'], 2).tolist() if desorption['y'] else []
                }
            }
        }
    }
