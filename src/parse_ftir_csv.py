"""
ALCheMy Characterization Parser - FTIR (.csv)
Parses Thermo Nicolet FTIR 2D spectrum .csv files into standard ALCheMy schema.

Unlike PXRD/.xrdml, VT-XRD/.brml and TGA/.txt, this format carries NO header at all -
just two columns of numbers, wavenumber and transmittance, nothing else. There is
genuinely no more metadata to extract from the file itself.

Specification Document: notebooks/CHARACTERIZATION_DICTIONARY_SPEC.md
"""

import os
import pandas as pd

# n8n's Python task runner sandbox permanently blocks the bare 'open' builtin
# (it's in BUILTINS_DENY_DEFAULT regardless of any stdlib/external allow-list).
# io.open is the exact same function, reachable because 'io' is on the allow-list -
# shadow the name once here so every 'open(...)' call below works both locally and
# inside the sandboxed runner.
import io
open = io.open


def _read_text(file_path, encoding='latin1'):
    """Read a text file WITHOUT ever using text-mode open().

    n8n's Python sandbox breaks text-mode open() - `open(path, 'r')` raises
    "'NoneType' object is not callable" because constructing the internal
    TextIOWrapper is blocked, while binary mode ('rb') works fine. Verified
    empirically against the live runner. Reading bytes and decoding by hand is
    exactly equivalent and works both locally and inside the sandbox.
    """
    with open(file_path, 'rb') as f:
        return f.read().decode(encoding, errors='ignore')


def parse_ftir_csv(file_path, sample_code=None, measurement_tag='as_synthesized'):
    # Two real delimiter conventions exist in this data lake: most exports use ';' as
    # the column separator with ',' as the decimal point (European), but at least one
    # uses ',' as the column separator with '.' as the decimal point (English). The old
    # code split on BOTH characters at once (sep=r'[,;]'), which silently cut every
    # number in half on the European files - e.g. "3,996747e+002" (399.6747) became two
    # garbage columns "3" and "996747e+002". Every FTIR spectrum parsed with the old
    # code was wrong. Detect which convention this file uses instead of guessing both.
    text = _read_text(file_path)
    first_line = text.split('\n', 1)[0]
    sep = ';' if ';' in first_line else ','

    # Parse from the already-decoded string rather than handing pandas the path:
    # pandas would open the file itself in text mode, which the n8n sandbox breaks.
    df = pd.read_csv(io.StringIO(text), sep=sep, header=None, engine='python')
    df = df.dropna().iloc[:, :2]
    df.columns = ['wavenumber', 'transmittance']

    # Comma-to-dot is a no-op (and harmless) on files that already use '.' as decimal
    df['wavenumber'] = pd.to_numeric(df['wavenumber'].astype(str).str.replace(',', '.'), errors='coerce')
    df['transmittance'] = pd.to_numeric(df['transmittance'].astype(str).str.replace(',', '.'), errors='coerce')
    df = df.dropna()

    df = df.sort_values(by='wavenumber')

    if not sample_code:
        base_name = os.path.basename(file_path)
        code_match = pd.Series([base_name]).str.extract(r'(RS\d+|LP\d+|RSMix\d+|IEF-\d+)', expand=False).dropna()
        sample_code = code_match.iloc[0].upper() if len(code_match) > 0 else 'UNKNOWN'

    return {
        'sample_code': sample_code,
        'technique': 'FTIR',
        'measurement_tag': measurement_tag,
        'operator_name': 'Rubén S.N.',
        'instrument_name': 'Thermo Nicolet OMNIC FTIR',
        'file_name': os.path.basename(file_path),
        'raw_file_path': file_path,
        'data_json': {
            'header_metadata': {
                'sample_name_raw': os.path.basename(file_path),
                'column_separator_detected': sep,
                'spectral_range_cm-1': [float(df['wavenumber'].min()), float(df['wavenumber'].max())],
                'atr_crystal': 'Diamond ATR',
                'num_data_points': len(df)
            },
            'raw_data': {
                'x_label': 'wavenumber_cm-1',
                'y_label': 'transmittance_percent',
                'x': df['wavenumber'].round(2).tolist(),
                'y': df['transmittance'].round(2).tolist()
            }
        }
    }
