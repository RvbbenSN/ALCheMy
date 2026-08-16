import sys, re, pandas as pd, numpy as np
sys.stdout.reconfigure(encoding='utf-8')

def parse_time(t_str):
    if not t_str or t_str in ['-', 'asap']:
        return 0.0 if t_str == 'asap' else np.nan
    t_str = t_str.strip()
    if t_str.endswith("'") or t_str.endswith("min") or t_str.endswith("m"):
        # Minutes to hours conversion
        val_str = re.sub(r"[^\d\.]", "", t_str)
        return float(val_str) / 60.0 if val_str else np.nan
    if t_str.endswith('h'):
        val_str = re.sub(r"[^\d\.]", "", t_str)
        return float(val_str) if val_str else np.nan
    if t_str.endswith('d'):
        val_str = re.sub(r"[^\d\.]", "", t_str)
        return float(val_str) * 24.0 if val_str else np.nan
    if 'week' in t_str:
        val_str = re.sub(r"[^\d\.]", "", t_str)
        return float(val_str) * 168.0 if val_str else np.nan
    try:
        return float(t_str)
    except:
        return np.nan

def parse_temp(tp_str):
    if not tp_str:
        return np.nan
    tp_str = tp_str.strip()
    if 'r.t' in tp_str.lower():
        return 25.0
    m = re.search(r'(\d+(?:\.\d+)?)', tp_str)
    return float(m.group(1)) if m else np.nan

def parse_full_ramp(s):
    if pd.isna(s) or str(s).strip() in ['UNK', 'nan', 'None']:
        return {
            'temp_initial_c': np.nan,
            'heating_time_hours': np.nan,
            'temp_target_c': np.nan,
            'time_hours': np.nan,
            'cooling_time_hours': np.nan,
            'temp_final_c': np.nan,
            'heating_rate_c_h': np.nan,
            'cooling_rate_c_h': np.nan
        }
    
    parts = str(s).strip().split('-')
    
    if len(parts) == 3:
        p1, p2, p3 = parts[0], parts[1], parts[2]
        t_init = parse_temp(re.sub(r'\(.*?\)', '', p1)) if ('ºC' in p1 or 'r.t' in p1) else 25.0
        m1 = re.search(r'\((.*?)\)', p1)
        h_time = parse_time(m1.group(1)) if m1 else np.nan
        
        t_target = parse_temp(re.sub(r'\(.*?\)', '', p2))
        m2 = re.search(r'\((.*?)\)', p2)
        plateau = parse_time(m2.group(1)) if m2 else np.nan
        
        t_final = parse_temp(re.sub(r'\(.*?\)', '', p3))
        m3 = re.search(r'\((.*?)\)', p3)
        c_time = parse_time(m3.group(1)) if m3 else np.nan
        
    elif len(parts) == 2:
        p1, p2 = parts[0], parts[1]
        if '(' in p1 and 'ºC' in p1:
            t_init = 25.0
            h_time = np.nan
            t_target = parse_temp(re.sub(r'\(.*?\)', '', p1))
            m1 = re.search(r'\((.*?)\)', p1)
            plateau = parse_time(m1.group(1)) if m1 else np.nan
            t_final = parse_temp(re.sub(r'\(.*?\)', '', p2))
            m2 = re.search(r'\((.*?)\)', p2)
            c_time = parse_time(m2.group(1)) if m2 else np.nan
        else:
            t_init = parse_temp(p1)
            h_time = np.nan
            t_target = parse_temp(re.sub(r'\(.*?\)', '', p2))
            m2 = re.search(r'\((.*?)\)', p2)
            plateau = parse_time(m2.group(1)) if m2 else np.nan
            t_final = np.nan
            c_time = np.nan
    else:
        t_init = 25.0
        h_time = np.nan
        t_target = parse_temp(re.sub(r'\(.*?\)', '', s))
        m = re.search(r'\((.*?)\)', s)
        plateau = parse_time(m.group(1)) if m else np.nan
        t_final = np.nan
        c_time = np.nan
        
    h_rate = (t_target - t_init) / h_time if (pd.notna(t_target) and pd.notna(t_init) and pd.notna(h_time) and h_time > 0) else np.nan
    c_rate = (t_target - t_final) / c_time if (pd.notna(t_target) and pd.notna(t_final) and pd.notna(c_time) and c_time > 0) else np.nan
    
    return {
        'temp_initial_c': t_init,
        'heating_time_hours': h_time,
        'temp_target_c': t_target,
        'time_hours': plateau,
        'cooling_time_hours': c_time,
        'temp_final_c': t_final,
        'heating_rate_c_h': h_rate,
        'cooling_rate_c_h': c_rate
    }

xl = pd.ExcelFile('data/raw/RSN - Recopilación todas las síntesis_v3.xlsx')
df = pd.read_excel(xl, sheet_name='ALL SYNTHESIS', header=2)
ramp_col = [c for c in df.columns if 'Ti' in str(c)][0]
uniques = sorted([str(x) for x in df[ramp_col].dropna().unique()])
results = [parse_full_ramp(u) for u in uniques]
res_df = pd.DataFrame(results, index=uniques)
print(res_df.to_string())
