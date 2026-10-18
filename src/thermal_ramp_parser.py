"""
thermal_ramp_parser.py — Thermal ramp parser for synthesis profiles.

Extracts thermal synthesis profiles from free-text laboratory notebook strings
(e.g., 'r.t.(8h)-150ºC(48h)-30ºC(8h)', '150ºC(48h)-r.t.', 'r.t.(1h)-120ºC(12h)-r.t.(-)').

Solves historical parsing defects:
1. Splits stages by '-' strictly OUTSIDE parentheses so that notations like
   'r.t.(-)' do not break the 3-stage structure or misplace temperature/time values.
2. Returns None (NaN) for heating/cooling rates when the corresponding ramp time
   was not recorded, avoiding spurious 0.0 or 12.5 °C/min default imputations.
3. Classifies cooling profiles explicitly via `cooling_mode`:
   - 'programmed': explicit programmed cooling time provided.
   - 'fan_asap': microwave active fan cooling ('asap' -> 10 minutes cooling).
   - 'free_oven_off': natural cooling to room temperature with the oven switched off
     (e.g., '-r.t.' or '-r.t.(-)').
   - None: no cooling stage specified (e.g., single-stage holding '150ºC(48h)' or 'UNK').
4. Adds `ramp_profile_known` flag (True only when both heating and cooling times are known).
"""

from typing import Optional, List, Dict, Any, Union
import re
import numpy as np
import pandas as pd


def split_ramp_stages(ramp_str: Union[str, float]) -> List[str]:
    """
    Split a thermal ramp string by '-' delimiter strictly outside parentheses.

    Parameters
    ----------
    ramp_str : str or float
        Raw ramp text from laboratory synthesis records.

    Returns
    -------
    list of str
        List of trimmed ramp stages.
    """
    if pd.isna(ramp_str) or not str(ramp_str).strip():
        return []

    parts: List[str] = []
    current: List[str] = []
    depth = 0

    for char in str(ramp_str).strip():
        if char == '(':
            depth += 1
            current.append(char)
        elif char == ')':
            depth = max(0, depth - 1)
            current.append(char)
        elif char == '-' and depth == 0:
            parts.append(''.join(current).strip())
            current = []
        else:
            current.append(char)

    parts.append(''.join(current).strip())
    return [p for p in parts if p]


def parse_time_unit(t_str: Optional[Union[str, float]], is_cooling: bool = False) -> Optional[float]:
    """
    Parse a time specification string into hours.

    Recognized units:
    - 'asap': 10 min (0.1667 h) only in cooling (microwave fan cooling)
    - "'", 'min': minutes -> hours
    - 'h': hours
    - 'd': days -> hours
    - 'week': weeks -> hours
    - bare numbers: treated as hours

    Parameters
    ----------
    t_str : str or None
        Raw time substring (e.g., '48h', "5'", '10 min', 'asap', '-').
    is_cooling : bool, default False
        Whether this time corresponds to the cooling stage.

    Returns
    -------
    float or None
        Duration in hours, or None if unannotated / missing / '-'.
    """
    if t_str is None or pd.isna(t_str):
        return None

    cleaned = str(t_str).strip().lower()
    if cleaned in ['', '-', 'none', 'nan', 'unk']:
        return None

    if 'asap' in cleaned:
        # Microwave active fan cooling is physically 10 minutes (0.1667 h)
        return (10.0 / 60.0) if is_cooling else None

    # Minutes
    if cleaned.endswith("'") or 'min' in cleaned:
        val = re.sub(r"[^\d\.]", "", cleaned)
        return (float(val) / 60.0) if val else None

    # Hours
    if cleaned.endswith('h'):
        val = re.sub(r"[^\d\.]", "", cleaned)
        return float(val) if val else None

    # Days
    if cleaned.endswith('d'):
        val = re.sub(r"[^\d\.]", "", cleaned)
        return (float(val) * 24.0) if val else None

    # Weeks
    if 'week' in cleaned:
        val = re.sub(r"[^\d\.]", "", cleaned)
        return (float(val) * 168.0) if val else None

    # Raw numeric fallback (assumed hours)
    val = re.sub(r"[^\d\.]", "", cleaned)
    if val:
        try:
            return float(val)
        except ValueError:
            return None

    return None


def parse_temp_value(tp_str: Optional[Union[str, float]], default_temp: float = 25.0) -> float:
    """
    Parse a temperature string in Celsius.

    Parameters
    ----------
    tp_str : str or None
        Raw temperature substring (e.g., '150ºC', 'r.t.', '30ºC').
    default_temp : float, default 25.0
        Fallback temperature if string is missing or r.t.

    Returns
    -------
    float
        Temperature in Celsius.
    """
    if tp_str is None or pd.isna(tp_str):
        return default_temp

    s = str(tp_str).strip()
    if 'r.t' in s.lower():
        return 25.0

    m = re.search(r'(\d+(?:\.\d+)?)', s)
    return float(m.group(1)) if m else default_temp


def parse_full_thermal_ramp_c_min(s: Any) -> pd.Series:
    """
    Parse a free-text thermal ramp profile string into structured synthesis parameters.

    Parameters
    ----------
    s : str or Any
        Ramp string from laboratory notebook, such as:
        - 'r.t.(8h)-150ºC(48h)-30ºC(8h)'
        - 'r.t.(1h)-120ºC(12h)-r.t.(-)'
        - '150ºC(48h)-r.t.'
        - '150ºC(48h)'
        - 'UNK'

    Returns
    -------
    pd.Series
        Parsed parameters containing:
        - temp_initial_c: float (initial temperature in °C)
        - heating_time_hours: float or np.nan (heating duration in hours)
        - heating_rate_c_min: float or np.nan (heating rate in °C/min)
        - temp_target_c: float or np.nan (target plateau temperature in °C)
        - time_hours: float or np.nan (holding plateau duration in hours)
        - cooling_time_hours: float or np.nan (cooling duration in hours)
        - cooling_rate_c_min: float or np.nan (cooling rate in °C/min)
        - temp_final_c: float (final temperature in °C)
        - ramp_profile_known: bool (True only if both heating and cooling times are known)
        - cooling_mode: str or None ('programmed', 'fan_asap', 'free_oven_off', or None)
    """
    if pd.isna(s) or str(s).strip() in ['UNK', 'nan', 'None', '']:
        return pd.Series({
            'temp_initial_c': 25.0,
            'heating_time_hours': np.nan,
            'heating_rate_c_min': np.nan,
            'temp_target_c': np.nan,
            'time_hours': np.nan,
            'cooling_time_hours': np.nan,
            'cooling_rate_c_min': np.nan,
            'temp_final_c': 25.0,
            'ramp_profile_known': False,
            'cooling_mode': None
        })

    parts = split_ramp_stages(s)

    t_init: float = 25.0
    h_time: Optional[float] = None
    t_target: float = np.nan
    plateau: Optional[float] = None
    t_final: float = 25.0
    c_time: Optional[float] = None
    c_mode: Optional[str] = None

    if len(parts) >= 3:
        p1, p2, p3 = parts[0], parts[1], parts[2]

        # Initial temperature and heating stage
        if 'ºc' in p1.lower() or '°c' in p1.lower() or 'r.t' in p1.lower():
            t_init = parse_temp_value(re.sub(r'\(.*?\)', '', p1))
        else:
            t_init = 25.0

        m1 = re.search(r'\((.*?)\)', p1)
        h_time = parse_time_unit(m1.group(1), is_cooling=False) if m1 else None

        # Target temperature and plateau stage
        t_target = parse_temp_value(re.sub(r'\(.*?\)', '', p2))
        m2 = re.search(r'\((.*?)\)', p2)
        plateau = parse_time_unit(m2.group(1), is_cooling=False) if m2 else 0.0

        # Final temperature and cooling stage
        t_final = parse_temp_value(re.sub(r'\(.*?\)', '', p3))
        m3 = re.search(r'\((.*?)\)', p3)
        if m3:
            raw_c = m3.group(1).strip().lower()
            if 'asap' in raw_c:
                c_time = 10.0 / 60.0
                c_mode = 'fan_asap'
            else:
                c_time = parse_time_unit(raw_c, is_cooling=True)
                if c_time is not None and c_time > 0:
                    c_mode = 'programmed'
                elif 'r.t' in p3.lower():
                    c_mode = 'free_oven_off'
                else:
                    c_mode = None
        else:
            c_time = None
            if 'r.t' in p3.lower():
                c_mode = 'free_oven_off'
            else:
                c_mode = None

    elif len(parts) == 2:
        p1, p2 = parts[0], parts[1]
        t_init = 25.0
        h_time = None

        t_target = parse_temp_value(re.sub(r'\(.*?\)', '', p1))
        m1 = re.search(r'\((.*?)\)', p1)
        plateau = parse_time_unit(m1.group(1), is_cooling=False) if m1 else 0.0

        t_final = parse_temp_value(re.sub(r'\(.*?\)', '', p2))
        m2 = re.search(r'\((.*?)\)', p2)
        if m2:
            raw_c = m2.group(1).strip().lower()
            if 'asap' in raw_c:
                c_time = 10.0 / 60.0
                c_mode = 'fan_asap'
            else:
                c_time = parse_time_unit(raw_c, is_cooling=True)
                if c_time is not None and c_time > 0:
                    c_mode = 'programmed'
                elif 'r.t' in p2.lower():
                    c_mode = 'free_oven_off'
                else:
                    c_mode = None
        else:
            c_time = None
            if 'r.t' in p2.lower():
                c_mode = 'free_oven_off'
            else:
                c_mode = None

    else:
        # Single stage (e.g., '150ºC(48h)')
        p1 = parts[0]
        t_init = 25.0
        h_time = None

        t_target = parse_temp_value(re.sub(r'\(.*?\)', '', p1))
        m = re.search(r'\((.*?)\)', p1)
        plateau = parse_time_unit(m.group(1), is_cooling=False) if m else 0.0

        t_final = 25.0
        c_time = None
        c_mode = None

    # Calculate ramp rates (°C/min) strictly when durations are explicitly known
    h_rate_min: Optional[float] = (
        ((t_target - t_init) / (h_time * 60.0))
        if (pd.notna(t_target) and h_time is not None and h_time > 0)
        else np.nan
    )

    c_rate_min: Optional[float] = (
        ((t_target - t_final) / (c_time * 60.0))
        if (pd.notna(t_target) and c_time is not None and c_time > 0)
        else np.nan
    )

    ramp_profile_known = bool(
        h_time is not None and h_time > 0 and c_time is not None and c_time > 0
    )

    return pd.Series({
        'temp_initial_c': t_init,
        'heating_time_hours': h_time if h_time is not None else np.nan,
        'heating_rate_c_min': h_rate_min,
        'temp_target_c': t_target,
        'time_hours': plateau if plateau is not None else np.nan,
        'cooling_time_hours': c_time if c_time is not None else np.nan,
        'cooling_rate_c_min': c_rate_min,
        'temp_final_c': t_final,
        'ramp_profile_known': ramp_profile_known,
        'cooling_mode': c_mode
    })
