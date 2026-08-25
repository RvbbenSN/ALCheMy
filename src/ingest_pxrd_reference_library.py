"""
ALCheMy - PXRD reference library ingestion

WHAT THIS SOLVES
----------------
src/ingest_datalake_to_postgres.py only walks data/raw_datalake_historico/, so
everything under data/reference_libraries/PXRD/ stayed on disk and never reached
the database: the empty holder, the instrument standard, the ligand precursors,
and the patterns simulated from our own SCXRD-resolved structures.

Those files are not ordinary samples, they are the *rulers*. The lambda
calibration of the arPLS baseline (roadmap stage E1, the one stage that blocks
production) is only defensible if it is run against a real blank and a real
standard, and the novelty triage (roadmap 5-bis) needs the simulated SCXRD
patterns to compare peak positions against. Leaving them out of the database
would force every notebook to reach back into raw folders, which is exactly the
"archivos en crudo que bailan por directorios" problem the project is trying to
get rid of.

So this script puts them in the same table as everything else,
characterization_measurements, and tells them apart with measurement_tag:

    reference_blank      empty holder / blank - background only, no material
    reference_standard   instrument standard - known sharp crystalline pattern
    reference_precursor  ligand or metal precursor measured on its own
    reference_simulated  pattern simulated from one of our own SCXRD structures

That single column is enough for any query to include or exclude references:

    WHERE measurement_tag NOT LIKE 'reference_%'   -- only real syntheses
    WHERE measurement_tag = 'reference_blank'      -- the calibration blank

The sample_code of a reference is the file's own descriptive name rather than an
RS-code, because a blank belongs to no synthesis. A placeholder parent row is
created in synthesis_experiments so the foreign key holds, exactly as the mass
ingestion script does for orphan codes.

USAGE
-----
    python src/ingest_pxrd_reference_library.py --dry-run
    python src/ingest_pxrd_reference_library.py

Re-running is safe: every file already present (matched by its binary MD5 in
file_hash) is skipped, so this never double-inserts.
"""

import os
import re
import sys
import glob
import hashlib
import argparse

import psycopg2
from psycopg2.extras import Json

SRC_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SRC_DIR)
sys.path.insert(0, SRC_DIR)
sys.path.insert(0, ROOT_DIR)

from parse_pxrd_xrdml import parse_pxrd_xrdml

DB_HOST = os.environ.get('POSTGRES_HOST', 'localhost')
DB_PORT = int(os.environ.get('POSTGRES_PORT', 5432))
DB_NAME = os.environ.get('POSTGRES_DB', 'alchemy_db')
DB_USER = os.environ.get('POSTGRES_USER', 'alchemy_user')
DB_PASS = os.environ.get('POSTGRES_PASSWORD', 'alchemy_pass_2026')

REFERENCE_DIR = os.path.join(ROOT_DIR, 'data', 'reference_libraries', 'PXRD')

# Sub-folder -> measurement_tag. The folder the file sits in is what declares
# what kind of ruler it is; nothing is guessed from the file name except the
# blank/standard split inside blanks_and_standards.
FOLDER_TAGS = {
    'blanks_and_standards':   'reference_standard',
    'linkers_and_precursors': 'reference_precursor',
    'simulated_scxrd':        'reference_simulated',
}

# Inside blanks_and_standards, a file whose name says "blanco"/"blank" is the
# empty holder, which plays a different role in the calibration than a standard.
BLANK_NAME_PATTERN = re.compile(r'blanc|blank|vacio|vac[ií]o', re.IGNORECASE)

# A reference has no synthesis behind it, but the foreign key still needs a
# parent row. The chemistry columns are NOT NULL, so they are filled with the
# explicit literal 'NOT_APPLICABLE' rather than dummy chemistry: a blank holder
# has no metal centre, and writing a plausible-looking metal there would put a
# lie into the single source of truth. synthesis_type = 'REFERENCE' makes these
# rows trivially excludable from any analysis of real syntheses.
PLACEHOLDER_SYNTHESIS = """
    INSERT INTO synthesis_experiments (
        sample_code, synthesis_date, synthesis_type, researcher_name, research_unit,
        metal_center, metal_source, linker, total_volume_ml, temp_target_c, time_hours
    )
    VALUES (%s, CURRENT_DATE, 'REFERENCE', %s, %s,
            'NOT_APPLICABLE', 'NOT_APPLICABLE', 'NOT_APPLICABLE', 0, 0, 0)
    ON CONFLICT (sample_code) DO NOTHING;
"""

INSERT_MEASUREMENT = """
    INSERT INTO characterization_measurements (
        sample_code, technique, measurement_tag, operator_name,
        instrument_name, file_name, raw_file_path, file_hash, data_json
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
"""


def file_md5(path):
    """Binary MD5 of the file, used as the anti-duplication gate."""
    h = hashlib.md5()
    with open(path, 'rb') as fh:
        for block in iter(lambda: fh.read(65536), b''):
            h.update(block)
    return h.hexdigest()


def tag_for(file_path):
    """Decides the measurement_tag from the folder, refining blank vs standard."""
    folder = os.path.basename(os.path.dirname(file_path))
    tag = FOLDER_TAGS.get(folder, 'reference_other')
    if tag == 'reference_standard' and BLANK_NAME_PATTERN.search(os.path.basename(file_path)):
        tag = 'reference_blank'
    return tag


def sample_code_for(file_path):
    """
    A reference belongs to no synthesis, so its sample_code is a readable code
    derived from the file name: REF-<cleaned name>, capped to fit VARCHAR(50).
    """
    stem = os.path.splitext(os.path.basename(file_path))[0]
    cleaned = re.sub(r'[^A-Za-z0-9]+', '-', stem).strip('-')
    return ('REF-' + cleaned)[:50]


def main():
    parser = argparse.ArgumentParser(description='Ingest the PXRD reference library into PostgreSQL.')
    parser.add_argument('--dry-run', action='store_true', help='Parse and report, write nothing.')
    args = parser.parse_args()

    files = sorted(glob.glob(os.path.join(REFERENCE_DIR, '*', '*.xrdml')))
    if not files:
        print(f'No .xrdml found under {REFERENCE_DIR}')
        return

    conn = psycopg2.connect(host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
                            user=DB_USER, password=DB_PASS)
    cur = conn.cursor()
    cur.execute('SELECT file_hash FROM characterization_measurements WHERE file_hash IS NOT NULL;')
    known_hashes = {row[0] for row in cur.fetchall()}
    print(f'{len(files)} reference file(s) found, {len(known_hashes)} hashes already in the DB.')

    inserted = skipped = errors = 0

    for path in files:
        name = os.path.basename(path)
        digest = file_md5(path)
        if digest in known_hashes:
            skipped += 1
            continue

        tag = tag_for(path)
        code = sample_code_for(path)

        try:
            record = parse_pxrd_xrdml(path, sample_code=code, measurement_tag=tag)
        except Exception as exc:
            print(f'  ERROR  {name}: {exc}')
            errors += 1
            continue

        n_points = len(record['data_json']['raw_data'].get('x', []))
        print(f'  {tag:20s} {code:42s} {n_points:5d} pts  {name}')

        if args.dry_run:
            inserted += 1
            continue

        # The FK needs a parent row; a reference has no real synthesis behind it.
        cur.execute(PLACEHOLDER_SYNTHESIS, (code, 'REFERENCE LIBRARY', 'APMU'))
        cur.execute(INSERT_MEASUREMENT, (
            code,
            record.get('technique', 'PXRD'),
            tag,
            record.get('operator_name'),
            record.get('instrument_name'),
            name,
            path,
            digest,
            Json(record['data_json']),
        ))
        conn.commit()
        known_hashes.add(digest)
        inserted += 1

    cur.close()
    conn.close()

    print('\n=== REFERENCE LIBRARY INGESTION SUMMARY ===')
    print(f'Inserted:                {inserted}')
    print(f'Skipped (already in DB): {skipped}')
    print(f'Errors:                  {errors}')
    if args.dry_run:
        print('(DRY RUN - nothing was written to the database)')


if __name__ == '__main__':
    main()
