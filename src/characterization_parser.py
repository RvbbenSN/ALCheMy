"""
ALCheMy Standardized Characterization Parser Module
Parses raw characterization files (.xrdml, .csv, .txt) in the Data Lake
into minimal metadata rows + standard JSONB payloads for PostgreSQL & n8n AI Agents.

Specification Document: notebooks/CHARACTERIZATION_DICTIONARY_SPEC.md
"""

import os
import re
import json
import xml.etree.ElementTree as ET
import pandas as pd
import numpy as np

# Each technique+extension parser now lives in its own module (src/parse_<technique>_<ext>.py)
# so a change to one technique's parser can never affect another's. This file re-exports them
# for backwards compatibility with the notebooks and src/ingest_datalake_to_postgres.py.
from parse_pxrd_xrdml import parse_pxrd_xrdml
from parse_vtxrd_brml import parse_bruker_brml
from parse_tga_txt import parse_tga_txt
from parse_ftir_csv import parse_ftir_csv
from parse_adsorption_xls import parse_bet_xls
from parse_uvvis_asc import parse_uvvis_asc
from parse_microscopy_image import parse_microscopy_image
from parse_cif_scxrd import parse_cif_file


def _select_parser(technique, file_path):
    """Maps a (technique, file extension) pair to the deterministic parser function that handles it."""
    technique = (technique or '').upper()
    file_ext = os.path.splitext(file_path)[1].lower().lstrip('.')

    if file_ext == 'cif' or technique in ('SC-XRD', 'SCXRD', 'CIF'):
        return parse_cif_file
    if file_ext == 'xrdml':
        return parse_pxrd_xrdml
    if file_ext == 'brml':
        return parse_bruker_brml
    if technique == 'TGA':
        return parse_tga_txt
    if technique == 'FTIR':
        return parse_ftir_csv
    if technique == 'ADSORPTION':
        return parse_bet_xls
    if technique == 'UV_VIS':
        return parse_uvvis_asc
    if technique in ('SEM', 'FESEM', 'TEM'):
        return parse_microscopy_image
    raise ValueError(f"No deterministic parser available for technique='{technique}' file_ext='{file_ext}'")


if __name__ == '__main__':
    # CLI entry point called by the n8n "Data Parser" Execute Command node.
    # Prints the parsed measurement dict as one JSON line to stdout; on failure,
    # prints a JSON error object to stderr and exits with status 1.
    import argparse
    import inspect
    import sys

    cli = argparse.ArgumentParser(description='ALCheMy deterministic characterization parser CLI')
    cli.add_argument('--file', required=True, help='Path to the raw characterization file inside the container')
    cli.add_argument('--technique', required=True)
    cli.add_argument('--sample-code', default=None)
    args = cli.parse_args()

    try:
        parse_fn = _select_parser(args.technique, args.file)
        kwargs = {}
        sig_params = inspect.signature(parse_fn).parameters
        if args.sample_code and 'sample_code' in sig_params:
            kwargs['sample_code'] = args.sample_code
        if 'technique' in sig_params:
            kwargs['technique'] = args.technique
        result = parse_fn(args.file, **kwargs)
        print(json.dumps(result))
    except Exception as exc:
        print(json.dumps({'error': str(exc), 'error_type': type(exc).__name__}), file=sys.stderr)
        sys.exit(1)
