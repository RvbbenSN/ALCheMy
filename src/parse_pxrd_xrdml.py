"""
ALCheMy Characterization Parser - PXRD (.xrdml)
Parses native PANalytical EMPYREAN .xrdml XML files into standard ALCheMy schema.

Specification Document: notebooks/CHARACTERIZATION_DICTIONARY_SPEC.md
"""

import os
import re
import xml.etree.ElementTree as ET
import pandas as pd
import numpy as np


def parse_pxrd_xrdml(file_path, sample_code=None, measurement_tag='as_synthesized', operator_name=None, researcher_email=None):
    """
    Parses native PANalytical EMPYREAN .xrdml XML files into standard ALCheMy schema.

    Extracts every scientifically meaningful field the .xrdml actually contains, not
    just enough to draw the curve: acquisition timing, full radiation/optics/detector
    configuration, and instrument/software provenance. See notebooks/CHARACTERIZATION_DICTIONARY_SPEC.md.
    """
    tree = ET.parse(file_path)
    root = tree.getroot()

    # Strip namespaces
    for elem in root.iter():
        if '}' in elem.tag:
            elem.tag = elem.tag.split('}', 1)[1]

    def _text(path, default=None):
        el = root.find(path)
        return el.text if el is not None and el.text is not None else default

    def _float(path, default=None):
        val = _text(path)
        try:
            return float(val) if val is not None else default
        except ValueError:
            return default

    # Sample & people
    s_id = _text('.//sample/id', '')
    s_name = _text('.//sample/name', '')
    prep_by = _text('.//sample/preparedBy', '')
    scan_author = _text('.//header/author/name')

    # Diffractometer system isn't a structured tag in PANalytical exports - it's
    # embedded as free text inside the top-level <comment><entry> block
    # (e.g. "Diffractometer system=EMPYREAN"), so the old code's direct
    # find('.//diffractometerSystem') always missed it and silently fell back
    # to a hardcoded default.
    instrument = 'PANalytical EMPYREAN'
    for entry in root.findall('.//comment/entry'):
        if entry.text:
            m = re.search(r'Diffractometer system\s*=\s*([^;]+)', entry.text)
            if m:
                instrument = f"PANalytical {m.group(1).strip()}"
                break

    # Radiation
    anode = _text('.//anodeMaterial', 'Cu')
    kalpha1 = _float('.//kAlpha1', 1.540598)
    kalpha2 = _float('.//kAlpha2', 1.544426)
    kbeta = _float('.//kBeta')
    ratio_ka2_ka1 = _float('.//ratioKAlpha2KAlpha1')
    voltage = _float('.//tension', 45.0)
    current = _float('.//current', 40.0)

    # Detector
    detector_el = root.find('.//detector')
    detector = detector_el.attrib.get('name', 'PIXcel3D') if detector_el is not None else 'PIXcel3D'
    det_mode = _text('.//detector/mode')
    active_ch_eq = _text('.//detector/activeChannelsEquatorial')
    active_ch_ax = _text('.//detector/activeChannelsAxial')
    pitch_eq = _float('.//detector/pitchEquatorial')
    pitch_ax = _float('.//detector/pitchAxial')
    readout_period = _float('.//detector/readOutPeriod')
    phd_lower = _float('.//detector/phd/lowerLevel')
    phd_upper = _float('.//detector/phd/upperLevel')

    # Optics path (scoped to incident/diffracted since some elements - soller
    # slit, anti-scatter slit - appear on both sides with different values)
    divergence_angle = _float('.//divergenceSlit/angle')
    mask_width = _float('.//mask/width')
    filter_material = _text('.//filter/material')
    filter_thickness = _float('.//filter/thickness')
    soller_incident = _float('.//incidentBeamPath/sollerSlit/opening')
    soller_diffracted = _float('.//diffractedBeamPath/sollerSlit/opening')
    antiscatter_angle = _float('.//diffractedBeamPath/antiScatterSlit/angle')
    beam_radius = _float('.//incidentBeamPath/radius')

    # Resolve sample_code if not passed explicitly
    if not sample_code:
        base_name = os.path.basename(file_path)
        code_match = pd.Series([base_name, s_id, s_name]).str.extract(r'(RS\d+|LP\d+)', expand=False).dropna()
        sample_code = code_match.iloc[0].upper() if len(code_match) > 0 else 'UNKNOWN'

    # Curve
    counts_elem = root.find('.//counts')
    counts_str = counts_elem.text.strip() if counts_elem is not None else ''
    y_counts = np.array([float(val) for val in counts_str.split()])

    start_2theta = _float('.//positions[@axis="2Theta"]/startPosition', 3.0)
    end_2theta = _float('.//positions[@axis="2Theta"]/endPosition', 50.0)
    x_2theta = np.linspace(start_2theta, end_2theta, len(y_counts))
    step_size = round(float((end_2theta - start_2theta) / (len(y_counts) - 1)), 4) if len(y_counts) > 1 else 0.0131

    omega_start = _float('.//positions[@axis="Omega"]/startPosition')
    omega_end = _float('.//positions[@axis="Omega"]/endPosition')
    phi_pos = _float('.//positions[@axis="Phi"]/commonPosition')
    counting_time = _float('.//commonCountingTime')
    spinner_time = _float('.//spinnerRevolutionTime')

    # Acquisition timing & software/instrument provenance
    start_ts = _text('.//header/startTimeStamp')
    end_ts = _text('.//header/endTimeStamp')
    app_sw_el = root.find('.//header/source/applicationSoftware')
    ctrl_sw_el = root.find('.//header/source/instrumentControlSoftware')
    instrument_id = _text('.//header/source/instrumentID')

    return {
        'sample_code': sample_code,
        'technique': 'PXRD',
        'measurement_tag': measurement_tag,
        'operator_name': prep_by,
        'instrument_name': instrument,
        'file_name': os.path.basename(file_path),
        'raw_file_path': file_path,
        'data_json': {
            'header_metadata': {
                'sample_name_raw': s_name or s_id or os.path.basename(file_path),
                'sample_id_raw': s_id,
                'prepared_by': prep_by,
                'scan_operator': scan_author,
                'anode_material': anode,
                'wavelength_kalpha1_angstrom': kalpha1,
                'wavelength_kalpha2_angstrom': kalpha2,
                'wavelength_kbeta_angstrom': kbeta,
                'ratio_kalpha2_kalpha1': ratio_ka2_ka1,
                'voltage_kv': voltage,
                'current_ma': current,
                'detector': detector,
                'detector_mode': det_mode,
                'detector_active_channels_equatorial': active_ch_eq,
                'detector_active_channels_axial': active_ch_ax,
                'detector_pitch_equatorial_mm': pitch_eq,
                'detector_pitch_axial_mm': pitch_ax,
                'detector_readout_period_sec': readout_period,
                'detector_phd_lower_level_pct': phd_lower,
                'detector_phd_upper_level_pct': phd_upper,
                'scan_start_2theta_deg': round(start_2theta, 4),
                'scan_end_2theta_deg': round(end_2theta, 4),
                'step_size_2theta_deg': step_size,
                'omega_start_deg': omega_start,
                'omega_end_deg': omega_end,
                'phi_position_deg': phi_pos,
                'common_counting_time_sec': counting_time,
                'spinner_revolution_time_sec': spinner_time,
                'scan_start_timestamp': start_ts,
                'scan_end_timestamp': end_ts,
                'instrument_id': instrument_id,
                'application_software': app_sw_el.text if app_sw_el is not None else None,
                'application_software_version': app_sw_el.attrib.get('version') if app_sw_el is not None else None,
                'control_software': ctrl_sw_el.text if ctrl_sw_el is not None else None,
                'control_software_version': ctrl_sw_el.attrib.get('version') if ctrl_sw_el is not None else None,
                'divergence_slit_angle_deg': divergence_angle,
                'incident_mask_width_mm': mask_width,
                'beta_filter_material': filter_material,
                'beta_filter_thickness_mm': filter_thickness,
                'soller_slit_incident_rad': soller_incident,
                'soller_slit_diffracted_rad': soller_diffracted,
                'antiscatter_slit_angle_deg': antiscatter_angle,
                'beam_path_radius_mm': beam_radius,
                'num_data_points': len(y_counts)
            },
            'raw_data': {
                'x_label': '2theta_deg',
                'y_label': 'intensity_counts',
                'x': x_2theta.round(4).tolist(),
                'y': y_counts.round(2).tolist()
            }
        }
    }
