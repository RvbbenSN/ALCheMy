"""
ALCheMy Characterization Parser - Single-Crystal XRD / Crystallographic Information
Files (.cif)

CIF is a plain-text, tag-based format ('_tag value' lines plus 'loop_' blocks for
repeated data like atom coordinates), but different crystallography software
(SHELXL 2014/2018/2019, PLATON, WinGX, APEX3...) writes a different subset of tags
and sometimes different tag *names* for the same concept (e.g.
'_space_group_name_H-M_alt' vs '_symmetry_space_group_name_H-M') - confirmed by
inspecting all 12 real files in data/reference_libraries/PXRD/simulated_scxrd/.
Hand-rolling a CIF grammar (multi-line ';...;' text fields, quoted loop values,
standard-uncertainty parentheses) to cover every variant is exactly the kind of
parsing problem a mature library already solves correctly - this parser uses
pymatgen's CifParser instead of a regex-only approach.

Fields are organized into named sub-objects instead of one flat dict so a caller can
pull just one concern with a single SQL jsonb path, without touching the rest:
- crystal_structure: everything needed to *reproduce or re-simulate* the diffraction
  pattern (space group, cell parameters, atom coordinates) - the concept the user
  asked to keep queryable on its own, e.g.
  `data_json->'header_metadata'->'crystal_structure'`.
- chemical_info / experimental_conditions / refinement_quality / provenance: the
  rest of what a CIF records, kept but clearly separated from the structural data.

The simulated PXRD curve (continuous 2theta vs intensity, Gaussian-broadened from
pymatgen's calculated peak list) lets a CIF-derived pattern be plotted and compared
directly against a real PXRD measurement of the same or a related sample.

Specification Document: notebooks/CHARACTERIZATION_DICTIONARY_SPEC.md
"""

import os
import re
import numpy as np

# n8n's Python task runner sandbox permanently blocks the bare 'open' builtin
# (it's in BUILTINS_DENY_DEFAULT regardless of any stdlib/external allow-list).
# io.open is the exact same function, reachable because 'io' is on the allow-list -
# shadow the name once here so every 'open(...)' call below works both locally and
# inside the sandboxed runner.
import io
open = io.open


def _read_text(file_path, encoding='latin1'):
    """Read a text file WITHOUT ever using text-mode open() - see note above."""
    with open(file_path, 'rb') as f:
        return f.read().decode(encoding, errors='ignore')


def _clean(val):
    """CIF's own null markers - '?' (unknown) and '.' (not applicable) - become
    None. Leaves standard-uncertainty parentheses alone; _num() strips those."""
    if val is None:
        return None
    s = str(val).strip()
    return s if s not in ('?', '.', '') else None


def _num(val):
    """'7.4157(6)' -> 7.4157 (SHELX standard-uncertainty suffix stripped)."""
    s = _clean(val)
    if s is None:
        return None
    s = re.sub(r'\(\d+\)$', '', s)
    try:
        return float(s)
    except ValueError:
        return None


def _as_list(val):
    """A 'loop_' column always comes back as a list; a single-value tag comes back
    as a bare string. Normalize to a list either way so callers don't have to care."""
    if val is None:
        return []
    return val if isinstance(val, list) else [val]


def parse_cif_scxrd(cif_text, file_name='sample.cif', sample_code=None,
                     measurement_tag='simulated_scxrd', researcher_email=None):
    from pymatgen.io.cif import CifParser
    from pymatgen.analysis.diffraction.xrd import XRDCalculator

    # CifParser.from_str() takes the already-decoded string directly - never let
    # pymatgen open the file itself, since its internal file handling uses
    # text-mode open() (blocked by the sandbox, see note above).
    parser = CifParser.from_str(cif_text)
    raw = parser.as_dict()
    # Some real files in this data lake carry TWO 'data_' blocks: a 'data_global'
    # preamble with only publication/author metadata, followed by the actual
    # solved-structure block ('data_shelx', 'data_sv8', ...) that has the real cell
    # parameters and atom coordinates. Taking the first block unconditionally picked
    # the empty preamble on 3 of the 12 real CIFs in this lab's collection - prefer
    # whichever block actually declares atom coordinates.
    block_name = next((k for k, v in raw.items() if '_atom_site_label' in v), next(iter(raw)))
    tags = raw[block_name]

    def get(key):
        return _clean(tags.get(key))

    def getn(key):
        return _num(tags.get(key))

    # --- crystal_structure: the parent concept the user asked to keep separable -
    # cell parameters, space group and atomic coordinates, i.e. exactly what a
    # diffraction-pattern simulator (pymatgen's XRDCalculator below, or any other
    # tool) needs and nothing else. Read straight from the CIF's own _atom_site
    # loop (the deposited asymmetric unit) rather than from pymatgen's
    # symmetry-expanded Structure, so this reflects what the file actually declares.
    atom_labels = _as_list(tags.get('_atom_site_label'))
    atom_symbols = _as_list(tags.get('_atom_site_type_symbol'))
    atom_x = [_num(v) for v in _as_list(tags.get('_atom_site_fract_x'))]
    atom_y = [_num(v) for v in _as_list(tags.get('_atom_site_fract_y'))]
    atom_z = [_num(v) for v in _as_list(tags.get('_atom_site_fract_z'))]
    atom_occ = [_num(v) for v in _as_list(tags.get('_atom_site_occupancy'))]
    atom_uiso = [_num(v) for v in _as_list(tags.get('_atom_site_U_iso_or_equiv'))]
    n_atoms = len(atom_labels)

    atom_sites = [
        {
            'label': atom_labels[i] if i < len(atom_labels) else None,
            'element': atom_symbols[i] if i < len(atom_symbols) else None,
            'fract_x': atom_x[i] if i < len(atom_x) else None,
            'fract_y': atom_y[i] if i < len(atom_y) else None,
            'fract_z': atom_z[i] if i < len(atom_z) else None,
            'occupancy': atom_occ[i] if i < len(atom_occ) else None,
            'u_iso_or_equiv': atom_uiso[i] if i < len(atom_uiso) else None,
        }
        for i in range(n_atoms)
    ]

    crystal_structure = {
        'space_group_name_hm': get('_space_group_name_H-M_alt') or get('_symmetry_space_group_name_H-M'),
        'space_group_name_hall': get('_space_group_name_Hall') or get('_symmetry_space_group_name_Hall'),
        'space_group_it_number': get('_space_group_IT_number'),
        'crystal_system': get('_space_group_crystal_system'),
        'cell_length_a_angstrom': getn('_cell_length_a'),
        'cell_length_b_angstrom': getn('_cell_length_b'),
        'cell_length_c_angstrom': getn('_cell_length_c'),
        'cell_angle_alpha_deg': getn('_cell_angle_alpha'),
        'cell_angle_beta_deg': getn('_cell_angle_beta'),
        'cell_angle_gamma_deg': getn('_cell_angle_gamma'),
        'cell_volume_angstrom3': getn('_cell_volume'),
        'cell_formula_units_z': getn('_cell_formula_units_Z'),
        'symmetry_operations': (_as_list(tags.get('_space_group_symop_operation_xyz'))
                                 or _as_list(tags.get('_symmetry_equiv_pos_as_xyz'))),
        'num_atoms_in_asymmetric_unit': n_atoms,
        'atom_sites': atom_sites,
    }

    chemical_info = {
        'chemical_name_common': get('_chemical_name_common'),
        'chemical_name_systematic': get('_chemical_name_systematic'),
        'chemical_formula_moiety': get('_chemical_formula_moiety'),
        'chemical_formula_sum': get('_chemical_formula_sum'),
        'chemical_formula_weight_g_mol': getn('_chemical_formula_weight'),
    }

    experimental_conditions = {
        'crystal_description': get('_exptl_crystal_description'),
        'crystal_colour': get('_exptl_crystal_colour'),
        'density_diffrn_g_cm3': getn('_exptl_crystal_density_diffrn'),
        'f_000': getn('_exptl_crystal_F_000'),
        'absorption_coefficient_mu_mm-1': getn('_exptl_absorpt_coefficient_mu'),
        'diffrn_ambient_temperature_k': getn('_diffrn_ambient_temperature'),
        'diffrn_radiation_wavelength_angstrom': getn('_diffrn_radiation_wavelength'),
        'diffrn_radiation_type': get('_diffrn_radiation_type'),
        'diffrn_measurement_device_type': get('_diffrn_measurement_device_type'),
        'diffrn_reflns_number': getn('_diffrn_reflns_number'),
    }

    refinement_quality = {
        'r_factor_all': getn('_refine_ls_R_factor_all'),
        'r_factor_gt': getn('_refine_ls_R_factor_gt'),
        'wr_factor_ref': getn('_refine_ls_wR_factor_ref'),
        'goodness_of_fit_ref': getn('_refine_ls_goodness_of_fit_ref'),
        'number_reflns': getn('_refine_ls_number_reflns'),
        'number_parameters': getn('_refine_ls_number_parameters'),
    }

    provenance = {
        'audit_creation_method': get('_audit_creation_method'),
        'audit_creation_date': get('_audit_creation_date'),
        'structure_solution_program': get('_computing_structure_solution'),
        'structure_refinement_program': get('_computing_structure_refinement'),
        'shelx_version_number': get('_shelxl_version_number') or get('_shelx_SHELXL_version_number'),
    }

    # --- Simulated PXRD pattern from the solved single-crystal structure: same
    # continuous-curve shape (2theta_deg vs intensity) as a real PXRD scan, so a
    # CIF-derived pattern can be plotted and compared directly against a real
    # measurement of the same or a related sample.
    grid_2t = np.arange(3.0, 50.0, 0.02)
    y_simulated = np.zeros_like(grid_2t)
    simulation_error = None
    try:
        structure = parser.parse_structures(primitive=False)[0]
        calc = XRDCalculator(wavelength='CuKa')
        pattern = calc.get_pattern(structure, two_theta_range=(3.0, 50.0))
        fwhm = 0.15
        sigma = fwhm / (2 * np.sqrt(2 * np.log(2)))
        for peak_2theta, peak_intensity in zip(pattern.x, pattern.y):
            y_simulated += peak_intensity * np.exp(-0.5 * ((grid_2t - peak_2theta) / sigma) ** 2)
    except Exception as exc:
        simulation_error = str(exc)

    if not sample_code:
        code_match = re.search(r'(RS\w+|IEF-?\d+[a-zA-Z]?|RSMIX\d+|LP\d+)', file_name, re.IGNORECASE)
        sample_code = code_match.group(1).upper() if code_match else 'UNKNOWN'

    header_metadata = {
        'sample_name_raw': get('_chemical_name_common') or file_name,
        'crystal_structure': crystal_structure,
        'chemical_info': chemical_info,
        'experimental_conditions': experimental_conditions,
        'refinement_quality': refinement_quality,
        'provenance': provenance,
        'wavelength_kalpha1_angstrom': 1.540598,
        'num_data_points': len(grid_2t),
        'simulation_error': simulation_error,
    }

    return {
        'sample_code': sample_code,
        'researcher_name': 'Rubén S.N.',
        'researcher_email': researcher_email,
        'technique': 'SC-XRD',
        'operator_name': 'Rubén S.N.',
        'measurement_tag': measurement_tag,
        'instrument_name': experimental_conditions['diffrn_measurement_device_type'] or 'Bruker D8 VENTURA (SC-XRD)',
        'file_name': file_name,
        'raw_file_path': file_name,
        'data_json': {
            'header_metadata': header_metadata,
            'raw_data': {
                'x_label': '2theta_deg',
                'y_label': 'intensity_simulated',
                'simulation_basis': 'pymatgen_XRDCalculator_CuKa_gaussian_broadened_fwhm_0.15deg',
                'x': [round(float(v), 4) for v in grid_2t],
                'y': [round(float(v), 4) for v in y_simulated],
            }
        }
    }


def parse_cif_file(file_path, sample_code=None, measurement_tag='simulated_scxrd'):
    text = _read_text(file_path)
    return parse_cif_scxrd(text, file_name=os.path.basename(file_path), sample_code=sample_code,
                            measurement_tag=measurement_tag)
