import pandas as pd
import numpy as np
import re
import hashlib
import os

print("Processing ETL Pipeline...")

# Step 1: Load raw Excel
excel_path = 'data/raw/RSN - Recopilación todas las síntesis_v3.xlsx'
xl = pd.ExcelFile(excel_path)
df_raw = pd.read_excel(xl, sheet_name='ALL SYNTHESIS', header=2)

# Step 2: Mapping
column_mapping = {
    'Sample': 'sample_code', 'Day': 'synthesis_date', 'Type': 'synthesis_type', 'Reactor': 'reactor_volume_ml',
    'C#': 'hts_number', 'Well': 'well_position', 'Metal': 'metal_center', 'Metal Source': 'metal_source',
    'Linker': 'linker', '[M]': 'metal_conc_m', 'L/M': 'lm_ratio', 'M': 'metal_mass_mg', 'L': 'linker_mass_mg',
    'H2O': 'h2o_pure_ml', 'MeOH': 'meoh_ml', 'EtOH': 'etoh_ml', '1-PrOH': 'proh_1_ml', 'DMF': 'dmf_ml',
    'DEF': 'def_ml', 'HCl (0,6M)': 'hcl_06m_ul', 'HCl (3M)': 'hcl_3m_ul', 'HF (3M)': 'hf_3m_ul',
    'AcOH gl': 'acoh_gl_ml', 'H2PO4': 'h2po4_ml', 'NH4OH': 'nh4oh_ml', 'V total': 'total_volume_ml',
    'Formic Ac.': 'formic_acid_ul', 'Acetic Ac.': 'acetic_acid_ul', 'Prop. Ac.': 'propionic_acid_ul',
    '(C₂H₅)₃N': 'triethylamine_ul', 'CF3SO3H': 'cf3so3h_ul', 'TFA': 'tfa_ul', 'HCl (1M)': 'hcl_1m_ul',
    'HCl (5M)': 'hcl_5m_ul', 'HCl (12M)': 'hcl_12m_ul', 'KOH (10M)': 'koh_10m_ul', 'DAM': 'dam_ul',
    'NaOH': 'naoh_ul', 'Ac. PhP': 'ac_php_ul', 'MeO3S': 'meo3s_ul', 'PhCOOH': 'phcooh_ul',
    'mMOFexp': 'mof_exp_mass_mg', 'mMOFtheo': 'mof_theo_mass_mg', 'R (%)': 'yield_percent'
}

df_clean = df_raw.dropna(subset=['Sample']).copy()
df_clean = df_clean.loc[:, ~df_clean.columns.astype(str).str.contains('^Unnamed')]
df_clean = df_clean.rename(columns=column_mapping)

# Step 3: Modulators Feature Engineering
df_clean['hcl_06m_ml'] = pd.to_numeric(df_clean.get('hcl_06m_ul', 0), errors='coerce').fillna(0) / 1000.0
df_clean['hcl_1m_ml'] = pd.to_numeric(df_clean.get('hcl_1m_ul', 0), errors='coerce').fillna(0) / 1000.0
df_clean['hcl_3m_ml'] = pd.to_numeric(df_clean.get('hcl_3m_ul', 0), errors='coerce').fillna(0) / 1000.0
df_clean['hcl_5m_ml'] = pd.to_numeric(df_clean.get('hcl_5m_ul', 0), errors='coerce').fillna(0) / 1000.0
df_clean['hcl_12m_ml'] = pd.to_numeric(df_clean.get('hcl_12m_ul', 0), errors='coerce').fillna(0) / 1000.0
df_clean['hf_3m_ml'] = pd.to_numeric(df_clean.get('hf_3m_ul', 0), errors='coerce').fillna(0) / 1000.0
df_clean['koh_10m_ml'] = pd.to_numeric(df_clean.get('koh_10m_ul', 0), errors='coerce').fillna(0) / 1000.0

df_clean['hcl_active_mmol'] = (df_clean['hcl_06m_ml']*0.6 + df_clean['hcl_1m_ml']*1.0 + df_clean['hcl_3m_ml']*3.0 + df_clean['hcl_5m_ml']*5.0 + df_clean['hcl_12m_ml']*12.0)
df_clean['hf_active_mmol'] = df_clean['hf_3m_ml'] * 3.0
df_clean['koh_active_mmol'] = df_clean['koh_10m_ml'] * 10.0

def calc_pure_modulator_mmol(v_ul, density, purity_pct, mw):
    v_num = pd.to_numeric(v_ul, errors='coerce').fillna(0)
    return (v_num * density * purity_pct * 10.0) / mw

df_clean['formic_acid_mmol'] = calc_pure_modulator_mmol(df_clean.get('formic_acid_ul', 0), 1.22, 98.0, 46.03)
df_clean['acetic_acid_mmol'] = calc_pure_modulator_mmol(df_clean.get('acetic_acid_ul', 0), 1.05, 99.8, 60.05)
df_clean['propionic_acid_mmol'] = calc_pure_modulator_mmol(df_clean.get('propionic_acid_ul', 0), 0.99, 99.5, 74.08)
df_clean['tfa_mmol'] = calc_pure_modulator_mmol(df_clean.get('tfa_ul', 0), 1.49, 99.0, 114.02)
df_clean['cf3so3h_mmol'] = calc_pure_modulator_mmol(df_clean.get('cf3so3h_ul', 0), 1.70, 99.0, 150.08)
df_clean['triethylamine_mmol'] = calc_pure_modulator_mmol(df_clean.get('triethylamine_ul', 0), 0.726, 99.5, 101.19)
df_clean['meo3s_mmol'] = calc_pure_modulator_mmol(df_clean.get('meo3s_ul', 0), 1.48, 99.5, 96.11)

df_clean['h2o_pure_ml'] = pd.to_numeric(df_clean.get('h2o_pure_ml', 0), errors='coerce').fillna(0)
aqueous_cols = ['hcl_06m_ml', 'hcl_1m_ml', 'hcl_3m_ml', 'hcl_5m_ml', 'hcl_12m_ml', 'hf_3m_ml', 'koh_10m_ml']
df_clean['h2o_total_ml'] = df_clean['h2o_pure_ml'] + df_clean[aqueous_cols].sum(axis=1)

# Step 4: Thermal Ramp Parser
def parse_time_unit(t_str):
    if not t_str or str(t_str).strip() in ['-', 'None']:
        return 0.0
    t_str = str(t_str).strip().lower()
    if 'asap' in t_str:
        return 10.0 / 60.0
    if t_str.endswith("'") or 'min' in t_str:
        val = re.sub(r"[^\d\.]", "", t_str)
        return float(val) / 60.0 if val else 0.0
    if t_str.endswith('h'):
        val = re.sub(r"[^\d\.]", "", t_str)
        return float(val) if val else 0.0
    if t_str.endswith('d'):
        val = re.sub(r"[^\d\.]", "", t_str)
        return float(val) * 24.0 if val else 0.0
    if 'week' in t_str:
        val = re.sub(r"[^\d\.]", "", t_str)
        return float(val) * 168.0 if val else 0.0
    try:
        return float(t_str)
    except:
        return 0.0

def parse_temp_value(tp_str):
    if not tp_str:
        return 25.0
    tp_str = str(tp_str).strip()
    if 'r.t' in tp_str.lower():
        return 25.0
    m = re.search(r'(\d+(?:\.\d+)?)', tp_str)
    return float(m.group(1)) if m else 25.0

def parse_full_thermal_ramp_c_min(s):
    if pd.isna(s) or str(s).strip() in ['UNK', 'nan', 'None']:
        return pd.Series({
            'temp_initial_c': 25.0, 'heating_time_hours': 0.0, 'heating_rate_c_min': 0.0,
            'temp_target_c': np.nan, 'time_hours': 0.0, 'cooling_time_hours': 0.1667,
            'cooling_rate_c_min': 0.0, 'temp_final_c': 25.0
        })
    parts = str(s).strip().split('-')
    if len(parts) == 3:
        p1, p2, p3 = parts[0], parts[1], parts[2]
        t_init = parse_temp_value(re.sub(r'\(.*?\)', '', p1)) if ('ºC' in p1 or 'r.t' in p1) else 25.0
        m1 = re.search(r'\((.*?)\)', p1)
        h_time = parse_time_unit(m1.group(1)) if m1 else 0.0
        t_target = parse_temp_value(re.sub(r'\(.*?\)', '', p2))
        m2 = re.search(r'\((.*?)\)', p2)
        plateau = parse_time_unit(m2.group(1)) if m2 else 0.0
        t_final = parse_temp_value(re.sub(r'\(.*?\)', '', p3))
        m3 = re.search(r'\((.*?)\)', p3)
        c_time = parse_time_unit(m3.group(1)) if m3 else (10.0 / 60.0)
    elif len(parts) == 2:
        p1, p2 = parts[0], parts[1]
        if '(' in p1 and 'ºC' in p1:
            t_init = 25.0
            h_time = 0.0
            t_target = parse_temp_value(re.sub(r'\(.*?\)', '', p1))
            m1 = re.search(r'\((.*?)\)', p1)
            plateau = parse_time_unit(m1.group(1)) if m1 else 0.0
            t_final = parse_temp_value(re.sub(r'\(.*?\)', '', p2))
            m2 = re.search(r'\((.*?)\)', p2)
            c_time = parse_time_unit(m2.group(1)) if m2 else (10.0 / 60.0)
        else:
            t_init = parse_temp_value(p1)
            h_time = 0.0
            t_target = parse_temp_value(re.sub(r'\(.*?\)', '', p2))
            m2 = re.search(r'\((.*?)\)', p2)
            plateau = parse_time_unit(m2.group(1)) if m2 else 0.0
            t_final = 25.0
            c_time = 0.0
    else:
        t_init = 25.0
        h_time = 0.0
        t_target = parse_temp_value(re.sub(r'\(.*?\)', '', s))
        m = re.search(r'\((.*?)\)', s)
        plateau = parse_time_unit(m.group(1)) if m else 0.0
        t_final = 25.0
        c_time = 0.0
        
    h_rate_min = (t_target - t_init) / (h_time * 60.0) if (pd.notna(t_target) and h_time > 0) else 0.0
    c_rate_min = (t_target - t_final) / (c_time * 60.0) if (pd.notna(t_target) and c_time > 0) else 0.0
    
    return pd.Series({
        'temp_initial_c': t_init, 'heating_time_hours': h_time, 'heating_rate_c_min': h_rate_min,
        'temp_target_c': t_target, 'time_hours': plateau, 'cooling_time_hours': c_time,
        'cooling_rate_c_min': c_rate_min, 'temp_final_c': t_final
    })

ramp_col = [col for col in df_raw.columns if 'Ti' in str(col)][0]
thermal_df = df_raw[ramp_col].apply(parse_full_thermal_ramp_c_min)

# Step 5: Data Sanitization
df_proc = df_clean.copy()
df_proc['researcher_name'] = 'Rubén S.N.'
df_proc['research_unit'] = 'APMU'
df_proc['synthesis_type'] = df_proc['synthesis_type'].fillna('ST')
df_proc['hts_number'] = df_proc['hts_number'].fillna('N/A')
df_proc['well_position'] = df_proc['well_position'].fillna('N/A')
df_proc['metal_mass_mg'] = pd.to_numeric(df_proc.get('metal_mass_mg', 10.63), errors='coerce').fillna(10.63)

def clean_and_impute_reactor_volume(row):
    val = str(row.get('reactor_volume_ml', '')).replace('mL', '').replace('ml', '').strip()
    num = pd.to_numeric(val, errors='coerce')
    if pd.isna(num) or num <= 0:
        st_type = str(row.get('synthesis_type', 'ST')).upper()
        defaults = {'HTS': 2.5, 'ST': 23.0, 'MW': 30.0, 'DT': 8.0}
        return defaults.get(st_type, 23.0)
    return num

df_proc['reactor_volume_ml'] = df_proc.apply(clean_and_impute_reactor_volume, axis=1)

linker_mapping = {
    'PyPO3H2': 'H8ptp', 'Py-PO3H2': 'H8ptp',
    'PyPO3Et2': 'Et8ptp', 'Py-PO3Et2': 'Et8ptp',
    'TriazPO3H2': 'H6ttbmp', 'Triaz-PO3H2': 'H6ttbmp',
    'TriazPO3Et2': 'Et6ttbmp', 'Triaz-PO3Et2': 'Et6ttbmp'
}
df_proc['linker'] = df_proc['linker'].astype(str).str.strip().replace(linker_mapping)
df_proc = df_proc[~df_proc['linker'].str.upper().isin(['PPV', 'BTBSH3', 'PPV?', 'PPV ?'])].copy()

solvent_cols = ['h2o_pure_ml', 'h2o_total_ml', 'meoh_ml', 'etoh_ml', 'proh_1_ml', 'dmf_ml', 'def_ml', 'total_volume_ml']
for s_col in solvent_cols:
    if s_col in df_proc.columns:
        df_proc[s_col] = pd.to_numeric(df_proc[s_col], errors='coerce').fillna(0.0)

modulator_mmol_cols = ['hcl_active_mmol', 'hf_active_mmol', 'koh_active_mmol', 'formic_acid_mmol', 'acetic_acid_mmol', 'propionic_acid_mmol', 'tfa_mmol', 'cf3so3h_mmol', 'triethylamine_mmol', 'meo3s_mmol']
for m_col in modulator_mmol_cols:
    if m_col in df_proc.columns:
        df_proc[m_col] = pd.to_numeric(df_proc[m_col], errors='coerce').fillna(0.0)

df_merged = pd.concat([df_proc.reset_index(drop=True), thermal_df.loc[df_proc.index].reset_index(drop=True)], axis=1)

target_samples = ['RS1937', 'RS1938']
lp127_thermal_values = {'temp_initial_c': 25.0, 'heating_time_hours': 6.0, 'heating_rate_c_min': 0.2639, 'temp_target_c': 120.0, 'time_hours': 48.0, 'cooling_time_hours': 6.0, 'cooling_rate_c_min': 0.1667, 'temp_final_c': 60.0}
for s_code in target_samples:
    mask = df_merged['sample_code'] == s_code
    for k, v in lp127_thermal_values.items():
        df_merged.loc[mask, k] = v

official_sql_columns = [
    'sample_code', 'synthesis_date', 'synthesis_type', 'researcher_name', 'research_unit',
    'hts_number', 'well_position', 'metal_center', 'metal_source', 'linker', 'metal_conc_m', 'lm_ratio',
    'metal_mass_mg', 'linker_mass_mg', 'reactor_volume_ml',
    'h2o_pure_ml', 'h2o_total_ml', 'meoh_ml', 'etoh_ml', 'proh_1_ml', 'dmf_ml', 'def_ml', 'total_volume_ml',
    'temp_initial_c', 'heating_time_hours', 'heating_rate_c_min', 'temp_target_c',
    'time_hours', 'cooling_time_hours', 'cooling_rate_c_min', 'temp_final_c',
    'hcl_active_mmol', 'hf_active_mmol', 'koh_active_mmol', 'formic_acid_mmol',
    'acetic_acid_mmol', 'propionic_acid_mmol', 'tfa_mmol', 'cf3so3h_mmol',
    'triethylamine_mmol', 'meo3s_mmol',
    'mof_exp_mass_mg', 'mof_theo_mass_mg', 'yield_percent'
]

available_cols = [c for c in official_sql_columns if c in df_merged.columns]
df_final = df_merged[available_cols].copy()

# Step 6: MD5
def calculate_business_natural_key_hash(row):
    natural_key_str = f"{row.get('sample_code', '')}_{row.get('synthesis_date', '')}_{row.get('researcher_name', '')}_{row.get('research_unit', '')}_{row.get('metal_center', '')}_{row.get('linker', '')}"
    return hashlib.md5(natural_key_str.encode('utf-8')).hexdigest()

df_final['file_hash_md5'] = df_final.apply(calculate_business_natural_key_hash, axis=1)
df_final['measurement_status'] = 'active'

# Step 7: Export to backups/
os.makedirs('backups', exist_ok=True)
backup_file = 'backups/df_final_limpio_backup.xlsx'
df_final.to_excel(backup_file, index=False)
print(f"SUCCESS: Exported clean backup Excel with {df_final.shape[0]} rows and {df_final.shape[1]} columns to {backup_file}!")
