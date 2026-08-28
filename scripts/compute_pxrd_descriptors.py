# -*- coding: utf-8 -*-
"""
Computes the PXRD descriptor vector for every measurement in the data lake.

WHAT IT IS FOR
--------------
`notebooks/05_PXRD_Signal_Processing_and_Crystallinity_Descriptors.ipynb` explains and
justifies the pipeline, and processes a sample batch so the notebook runs in a
reasonable time. This script is the same computation applied to the WHOLE corpus, so
that `pxrd_descriptors` can serve as the feature table for machine learning.

The two share `src/pxrd_descriptors.py`, so they cannot drift: the notebook is the
argument, this script is the batch job, and neither reimplements the formulas.

USAGE
-----
    python scripts/compute_pxrd_descriptors.py                # everything pending
    python scripts/compute_pxrd_descriptors.py --all          # recompute every row
    python scripts/compute_pxrd_descriptors.py --limit 200    # a slice, to try it out
    python scripts/compute_pxrd_descriptors.py --dry-run      # compute, write nothing

DATABASE SAFETY
---------------
This is a bulk write, so CLAUDE.md applies: report the row counts and run
`python scripts/backup_database.py` before and after. The script prints the counts
itself and refuses to start if `--all` would rewrite rows without `--yes`.

It only ever touches `pxrd_descriptors`. `pxrd_labels` - the hand labels, which are
reproducible from nothing - is never read for writing and never modified.
"""
import argparse
import json
import os
import sys

import numpy as np
import psycopg2
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE_DIR, 'src'))
load_dotenv(os.path.join(BASE_DIR, '.env'))

from pxrd_descriptors import (                                    # noqa: E402
    PIPELINE_VERSION, DESCRIPTOR_COLUMNS, resample_to_grid,
    extract_descriptors, load_instrument_blank,
)

MIN_VALID_POINTS = 500        # below this the scan is too short for the integrals
TABLES_TO_REPORT = ['characterization_measurements', 'pxrd_descriptors', 'pxrd_labels']


def connect():
    return psycopg2.connect(
        host=os.getenv('POSTGRES_HOST', 'localhost'),
        port=int(os.getenv('POSTGRES_PORT', 5432)),
        dbname=os.getenv('POSTGRES_DB', 'alchemy_db'),
        user=os.getenv('POSTGRES_USER'),
        password=os.getenv('POSTGRES_PASSWORD'),
    )


def sql_value(v):
    """NaN and inf are not valid SQL numbers; they become NULL rather than a lie."""
    if isinstance(v, np.bool_):
        return bool(v)
    if isinstance(v, np.integer):
        return int(v)
    if isinstance(v, (np.floating, float)):
        return None if not np.isfinite(v) else float(v)
    return v


def fetch_pending(cur, recompute_all, limit):
    where = ["m.technique IN ('PXRD', 'VT-XRD')", "m.data_json->'raw_data' ? 'x'"]
    if not recompute_all:
        # A row already computed by THIS version is skipped; one from an older version
        # is not, because its columns no longer mean the same thing.
        where.append("""NOT EXISTS (SELECT 1 FROM pxrd_descriptors d
                                     WHERE d.measurement_id = m.measurement_id
                                       AND d.pipeline_version = %s)""")
    query = """
        SELECT m.measurement_id, m.sample_code,
               m.data_json->'raw_data'->>'x' AS x,
               m.data_json->'raw_data'->>'y' AS y
          FROM characterization_measurements m
         WHERE %s
         ORDER BY m.measurement_id
    """ % ' AND '.join(where)
    params = [] if recompute_all else [PIPELINE_VERSION]
    if limit:
        query += ' LIMIT %s'
        params.append(limit)
    cur.execute(query, params)
    return cur.fetchall()


def upsert_statement():
    columns = ['measurement_id', 'sample_code'] + DESCRIPTOR_COLUMNS
    updatable = [c for c in columns if c != 'measurement_id']
    return columns, """
        INSERT INTO pxrd_descriptors (%s, computed_at)
        VALUES (%s, NOW())
        ON CONFLICT (measurement_id) DO UPDATE SET
            %s, computed_at = NOW();
    """ % (', '.join(columns),
           ', '.join(['%s'] * len(columns)),
           ', '.join('%s = EXCLUDED.%s' % (c, c) for c in updatable))


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--all', action='store_true',
                    help='recompute every measurement, not only the ones pending')
    ap.add_argument('--limit', type=int, default=None, help='process at most N measurements')
    ap.add_argument('--dry-run', action='store_true', help='compute but write nothing')
    ap.add_argument('--yes', action='store_true', help='skip the confirmation for --all')
    args = ap.parse_args()

    conn = connect()
    cur = conn.cursor()

    print('[BEFORE]')
    for table in TABLES_TO_REPORT:
        cur.execute('SELECT COUNT(*) FROM %s' % table)
        print('  %-32s %7d' % (table, cur.fetchone()[0]))
    cur.execute('SELECT pipeline_version, COUNT(*) FROM pxrd_descriptors GROUP BY 1 ORDER BY 1')
    for version, n in cur.fetchall():
        print('    %-30s %7d' % (version, n))
    print('  pipeline version to write:  %s' % PIPELINE_VERSION)

    blank = load_instrument_blank(conn)
    print('  instrument blank:           %s' %
          ('loaded, %d points' % blank.size if blank is not None else 'NOT AVAILABLE'))

    rows = fetch_pending(cur, args.all, args.limit)
    print('  measurements to process:    %d' % len(rows))
    if not rows:
        print('\n[OK] nothing to do.')
        return

    if args.all and not args.yes and not args.dry_run:
        print('\n--all rewrites existing rows. Back up first, then re-run with --yes.')
        return

    columns, statement = upsert_statement()
    written = skipped = failed = 0
    no_blank = 0

    for i, (measurement_id, sample_code, x_json, y_json) in enumerate(rows, 1):
        try:
            x_raw = np.array(json.loads(x_json), dtype=float)
            y_raw = np.array(json.loads(y_json), dtype=float)
            grid, y_grid, valid = resample_to_grid(x_raw, y_raw)
            if valid.sum() < MIN_VALID_POINTS:
                skipped += 1
                continue
            # The blank must be cut to the SAME stretch as the curve, or the
            # blank-referenced columns come back NULL.
            d = extract_descriptors(grid[valid], y_grid[valid],
                                    sample_code=sample_code,
                                    blank_grid=None if blank is None else blank[valid])
            if d.get('amorphous_fraction_blank') is None or \
                    not np.isfinite(d.get('amorphous_fraction_blank', np.nan)):
                no_blank += 1
            d['measurement_id'] = measurement_id
            if not args.dry_run:
                cur.execute(statement, [sql_value(d[c]) for c in columns])
            written += 1
        except Exception as exc:                                  # noqa: BLE001
            failed += 1
            if failed <= 5:
                print('  ! %s (%s): %s' % (sample_code, measurement_id, exc))
        if i % 200 == 0:
            if not args.dry_run:
                conn.commit()
            print('  ... %d/%d' % (i, len(rows)))

    if not args.dry_run:
        conn.commit()

    print('\n[RESULT]')
    print('  written:  %6d%s' % (written, '  (dry run, nothing committed)' if args.dry_run else ''))
    print('  skipped:  %6d  (fewer than %d valid grid points)' % (skipped, MIN_VALID_POINTS))
    print('  failed:   %6d' % failed)
    print('  no blank: %6d  (scan does not reach the scaling window; columns left NULL)' % no_blank)

    print('\n[AFTER]')
    cur.execute("""SELECT pipeline_version, COUNT(*),
                          ROUND(AVG(n_peaks)::numeric, 1),
                          ROUND(AVG(amorphous_fraction_blank)::numeric, 3)
                     FROM pxrd_descriptors GROUP BY 1 ORDER BY 1""")
    print('  %-10s %8s %10s %12s' % ('version', 'rows', 'avg peaks', 'avg amorph'))
    for version, n, peaks, amorph in cur.fetchall():
        print('  %-10s %8d %10s %12s' % (version, n, peaks, amorph))
    print('\nRun `python scripts/backup_database.py` now: these rows are not protected yet.')
    conn.close()


if __name__ == '__main__':
    main()
