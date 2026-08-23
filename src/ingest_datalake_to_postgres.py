"""
ALCheMy Master Data Lake Ingestion Script (Historical Backfill)

Walks data/raw_datalake_historico/<TECHNIQUE>/ folder by folder, routes each file
through the same deterministic parsers n8n uses (src/characterization_parser.py),
and inserts into characterization_measurements directly against Postgres - this is
the backfill lane, it never touches the n8n webhook.

Resumable by design: `characterization_measurements.file_hash` has an index but no
UNIQUE constraint in scripts/init_db.sql, so nothing at the database level stops a
re-run from inserting duplicates. This script loads every file_hash already in the
table once at startup and skips anything that matches, so an interrupted run (or a
deliberate re-run after fixing one technique's parser) never double-inserts. Every
successful row is committed immediately, not batched to the end, so a crash midway
through 6000+ files only loses the one file being parsed at that moment.

Files this script deliberately does NOT parse (logged as skipped, not guessed at):
ICP/EA (PDFs - handled by the AI branch in n8n, not deterministically), the plain
.csv re-export that sits next to each UV-Vis .asc file (see parse_uvvis_asc.py),
the .txt sidecars for SEM/FESEM images (consumed automatically by
parse_microscopy_image via same-basename convention, not their own record), and any
stray .docx/.rar/other file mixed into a technique folder.

Usage:
    python src/ingest_datalake_to_postgres.py                       # everything
    python src/ingest_datalake_to_postgres.py --technique PXRD      # one technique
    python src/ingest_datalake_to_postgres.py --technique TGA --limit 3 --dry-run
"""

import os
import re
import sys
import argparse
import csv
import hashlib
import inspect
from datetime import datetime

import psycopg2
from psycopg2.extras import Json

SRC_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SRC_DIR)
# characterization_parser.py imports its sibling parse_*.py modules unqualified
# (`from parse_pxrd_xrdml import ...`), so src/ itself must be on sys.path, not
# just the repo root.
sys.path.insert(0, SRC_DIR)
sys.path.insert(0, ROOT_DIR)

from characterization_parser import _select_parser

DB_HOST = os.environ.get('POSTGRES_HOST', 'localhost')
DB_PORT = int(os.environ.get('POSTGRES_PORT', 5432))
DB_NAME = os.environ.get('POSTGRES_DB', 'alchemy_db')
DB_USER = os.environ.get('POSTGRES_USER', 'alchemy_user')
DB_PASS = os.environ.get('POSTGRES_PASSWORD', 'alchemy_pass_2026')

DATALAKE_DIR = os.path.join(ROOT_DIR, 'data', 'raw_datalake_historico')

# Datalake folder name -> (technique value stored in the DB, extensions parsed as
# the primary measurement file in that folder). Anything else found in the folder
# is counted as skipped_unhandled_ext, never guessed at.
TECHNIQUE_FOLDERS = {
    'PXRD':       ('PXRD',       {'.xrdml'}),
    'VT-XRD':     ('VT-XRD',     {'.brml'}),
    'TGA':        ('TGA',        {'.txt'}),
    'FTIR':       ('FTIR',       {'.csv'}),
    'ADSORPTION': ('ADSORPTION', {'.xls'}),
    'UV_Vis':     ('UV_VIS',     {'.asc'}),
    'SEM':        ('SEM',        {'.jpg', '.jpeg'}),
    'FESEM':      ('FESEM',      {'.bmp'}),
    'TEM':        ('TEM',        {'.jpg', '.jpeg'}),
}
# Companion sidecar extension consumed automatically by parse_microscopy_image
# (same basename as the image) - never treated as its own record, and not counted
# as an unhandled/skipped file either.
MICROSCOPY_SIDECAR_EXT = {'.txt'}

PLACEHOLDER_SYNTHESIS_SQL = """
    INSERT INTO synthesis_experiments (sample_code, synthesis_date, synthesis_type, researcher_name, metal_center, metal_source, linker, total_volume_ml, temp_target_c, time_hours)
    VALUES (%s, CURRENT_DATE, 'HTS', 'Rubén S.N.', 'Ni', 'Ni(NO3)2·6H2O', 'Pyrene', 2.5, 120.0, 24.0)
    ON CONFLICT (sample_code) DO NOTHING;
"""

INSERT_MEASUREMENT_SQL = """
    INSERT INTO characterization_measurements (
        sample_code, technique, measurement_tag, operator_name, instrument_name, file_name, raw_file_path, file_hash, data_json
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
"""


def get_db_connection():
    return psycopg2.connect(host=DB_HOST, port=DB_PORT, dbname=DB_NAME, user=DB_USER, password=DB_PASS)


def call_parser(technique, file_path, sample_code=None):
    """Routes through characterization_parser._select_parser (same routing n8n uses)
    and only passes the kwargs each individual parser actually declares."""
    parse_fn = _select_parser(technique, file_path)
    kwargs = {}
    sig_params = inspect.signature(parse_fn).parameters
    if sample_code and 'sample_code' in sig_params:
        kwargs['sample_code'] = sample_code
    if 'technique' in sig_params:
        kwargs['technique'] = technique
    return parse_fn(file_path, **kwargs)


def iter_target_files(technique_dir, extensions):
    for root, _dirs, files in os.walk(technique_dir):
        for f in sorted(files):
            if f == '.gitkeep':
                continue
            if os.path.splitext(f)[1].lower() in extensions:
                yield os.path.join(root, f)


def run_mass_ingestion(techniques=None, limit=None, dry_run=False, log_path=None):
    folders = {k: v for k, v in TECHNIQUE_FOLDERS.items() if not techniques or k in techniques}
    if not folders:
        print(f"No matching technique folder for {techniques}. Valid: {sorted(TECHNIQUE_FOLDERS)}")
        return

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(PLACEHOLDER_SYNTHESIS_SQL, ('UNKNOWN',))
    conn.commit()

    cursor.execute("SELECT sample_code FROM synthesis_experiments;")
    db_samples = set(row[0].upper() for row in cursor.fetchall())
    db_samples.add('UNKNOWN')

    cursor.execute("SELECT file_hash FROM characterization_measurements WHERE file_hash IS NOT NULL;")
    already_ingested_hashes = set(row[0] for row in cursor.fetchall())
    print(f"{len(db_samples)} known sample codes, {len(already_ingested_hashes)} files already in the DB (will be skipped).")

    counters = {'inserted': 0, 'skipped_duplicate': 0, 'skipped_unhandled_ext': 0, 'error': 0}
    error_rows = []

    for folder_name, (technique, extensions) in folders.items():
        technique_dir = os.path.join(DATALAKE_DIR, folder_name)
        if not os.path.isdir(technique_dir):
            print(f"[{folder_name}] folder not found, skipping.")
            continue

        all_files = [f for _r, _d, fs in os.walk(technique_dir) for f in fs if f != '.gitkeep']
        unhandled = [
            f for f in all_files
            if os.path.splitext(f)[1].lower() not in extensions
            and os.path.splitext(f)[1].lower() not in MICROSCOPY_SIDECAR_EXT
        ]
        counters['skipped_unhandled_ext'] += len(unhandled)
        if unhandled:
            exts_seen = sorted(set(os.path.splitext(f)[1].lower() or '(no ext)' for f in unhandled))
            print(f"[{folder_name}] {len(unhandled)} file(s) with an unhandled extension skipped ({exts_seen}).")

        targets = list(iter_target_files(technique_dir, extensions))
        if limit:
            targets = targets[:limit]
        print(f"[{folder_name}] {len(targets)} file(s) to process.")

        tech_inserted = tech_error = tech_dup = 0

        for fpath in targets:
            try:
                with open(fpath, 'rb') as fp:
                    file_hash = hashlib.md5(fp.read()).hexdigest()
            except Exception as e:
                counters['error'] += 1
                tech_error += 1
                error_rows.append([folder_name, fpath, 'hash_read_error', str(e)])
                continue

            if file_hash in already_ingested_hashes:
                counters['skipped_duplicate'] += 1
                tech_dup += 1
                continue

            try:
                parsed = call_parser(technique, fpath)
            except Exception as e:
                counters['error'] += 1
                tech_error += 1
                error_rows.append([folder_name, fpath, 'parse_error', str(e)])
                continue

            sample_code = parsed['sample_code']
            if sample_code.upper() == 'UNKNOWN':
                # A bare 'UNKNOWN' would silently collapse every unrelated sample the
                # regex couldn't recognize (e.g. FESEM images filed under a folder like
                # 'CaTriaz/' or 'FePy/' instead of an RSxxxx code) into one shared row -
                # different chemistry becoming indistinguishable. Tag it with the
                # containing folder name instead, so each distinct label gets its own
                # placeholder row and stays separable for manual reconciliation later.
                folder_label = re.sub(r'[^A-Z0-9]+', '', os.path.basename(os.path.dirname(fpath)).upper())
                if folder_label and folder_label != 'UNKNOWN':
                    sample_code = f'UNKNOWN-{folder_label}'
                    parsed['sample_code'] = sample_code

            if sample_code not in db_samples:
                if not dry_run:
                    cursor.execute(PLACEHOLDER_SYNTHESIS_SQL, (sample_code,))
                    conn.commit()
                db_samples.add(sample_code)

            if dry_run:
                counters['inserted'] += 1
                tech_inserted += 1
                already_ingested_hashes.add(file_hash)
                continue

            try:
                cursor.execute(INSERT_MEASUREMENT_SQL, (
                    sample_code, parsed['technique'], parsed['measurement_tag'],
                    parsed['operator_name'], parsed['instrument_name'],
                    parsed['file_name'], parsed['raw_file_path'], file_hash,
                    Json(parsed['data_json'])
                ))
                conn.commit()
                already_ingested_hashes.add(file_hash)
                counters['inserted'] += 1
                tech_inserted += 1
            except Exception as e:
                conn.rollback()
                counters['error'] += 1
                tech_error += 1
                error_rows.append([folder_name, fpath, 'db_insert_error', str(e)])

        print(f"[{folder_name}] inserted={tech_inserted} duplicates_skipped={tech_dup} errors={tech_error}")

    cursor.close()
    conn.close()

    if error_rows:
        log_path = log_path or os.path.join(ROOT_DIR, 'backups', f'ingestion_errors_{datetime.now():%Y%m%d_%H%M%S}.csv')
        os.makedirs(os.path.dirname(log_path), exist_ok=True)
        with open(log_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['technique_folder', 'file_path', 'error_type', 'error_message'])
            writer.writerows(error_rows)
        print(f"\n{len(error_rows)} error(s) logged to {log_path}")

    print("\n=== MASS DATA LAKE INGESTION SUMMARY ===")
    print(f"Inserted:                {counters['inserted']}")
    print(f"Skipped (already in DB): {counters['skipped_duplicate']}")
    print(f"Skipped (unhandled ext): {counters['skipped_unhandled_ext']}")
    print(f"Errors:                  {counters['error']}")
    if dry_run:
        print("(DRY RUN - nothing was written to the database)")
    return counters


if __name__ == '__main__':
    cli = argparse.ArgumentParser(description='ALCheMy historical data lake mass ingestion')
    cli.add_argument('--technique', action='append', choices=sorted(TECHNIQUE_FOLDERS),
                      help='Limit to one technique folder; repeat the flag to run several. Default: all.')
    cli.add_argument('--limit', type=int, default=None, help='Max files per technique (for testing)')
    cli.add_argument('--dry-run', action='store_true', help='Parse and validate but do not write to the database')
    args = cli.parse_args()
    run_mass_ingestion(techniques=args.technique, limit=args.limit, dry_run=args.dry_run)
