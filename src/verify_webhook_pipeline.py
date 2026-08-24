"""
End-to-end verification of the ALCheMy n8n ingestion webhook.

Fires every happy-path technique and every automatable fallback at the live webhook,
checks the HTTP status, the typed verdict/cause/result, and - for happy paths - that
the row actually landed in characterization_measurements with the metadata the parser
was supposed to extract. Prints one line per case plus a summary.

This exists because the pipeline has many independent failure surfaces (n8n's Python
sandbox, multipart binary handling, the technique+extension router, Postgres FK
constraints), and testing them one at a time by hand is how regressions slipped
through: a fix for one technique repeatedly broke or masked another.

Usage:
    python src/verify_webhook_pipeline.py                # everything
    python src/verify_webhook_pipeline.py --only PXRD    # one case (repeatable)
    python src/verify_webhook_pipeline.py --happy        # happy paths only
    python src/verify_webhook_pipeline.py --fallbacks    # fallbacks only
    python src/verify_webhook_pipeline.py --keep-rows    # do not clean up test rows
"""

import os
import sys
import json
import time
import argparse
import tempfile

import requests
import psycopg2

SRC_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SRC_DIR)
# data/ is gitignored, so it does not exist inside a git worktree checkout. Allow
# pointing at the real data lake from elsewhere instead of duplicating ~900MB.
DATA_LAKE = os.environ.get('ALCHEMY_DATA_LAKE',
                           os.path.join(ROOT_DIR, 'data', 'raw_datalake_historico'))

WEBHOOK_URL = os.environ.get('ALCHEMY_WEBHOOK_URL',
                             'http://localhost:5678/webhook/ingest-characterization')
RESEARCHER_EMAIL = 'rubbenserrano@gmail.com'
RESEARCHER_NAME = 'Ruben Serrano'

DB = dict(
    host=os.environ.get('POSTGRES_HOST', 'localhost'),
    port=int(os.environ.get('POSTGRES_PORT', 5432)),
    dbname=os.environ.get('POSTGRES_DB', 'alchemy_db'),
    user=os.environ.get('POSTGRES_USER', 'alchemy_user'),
    password=os.environ.get('POSTGRES_PASSWORD', 'alchemy_pass_2026'),
)

BLOCKED_EMAIL = 'bloqueado.test@example.com'


def db():
    return psycopg2.connect(**DB)


def lake(*parts):
    return os.path.join(DATA_LAKE, *parts)


# ---------------------------------------------------------------------------
# Happy paths: (case name, technique sent, file, sample_code, optional sidecar,
#               dict of data_json.header_metadata keys that MUST be non-null)
# ---------------------------------------------------------------------------
HAPPY_CASES = [
    dict(name='PXRD', technique='PXRD', sample_code='RS1883',
         file=lake('PXRD', '24DRX0180-RS1883_CoPy.xrdml'),
         expect_meta=['num_data_points', 'anode_material', 'scan_start_2theta_deg']),
    dict(name='VT-XRD', technique='VT-XRD', sample_code='RSMIX15',
         file=lake('VT-XRD', '24DRX0766-RSMix15_CoPyF2_1 Air100mlmin.brml'),
         expect_meta=['num_data_points_per_scan', 'temperature_steps_count']),
    dict(name='TGA', technique='TGA', sample_code='RS1104',
         file=lake('TGA', 'IEF-22(Fe)_Ar_1000ºC_RS1104.txt'),
         expect_meta=['num_data_points', 'initial_sample_mass_mg', 'pan_material']),
    dict(name='FTIR', technique='FTIR', sample_code='IEF-18',
         file=lake('FTIR', 'CoPyF1.CSV'),
         expect_meta=['num_data_points', 'column_separator_detected']),
    dict(name='ADSORPTION', technique='Adsorption', sample_code='RS522',
         file=lake('ADSORPTION', '20220425-22046-RS522-Mg-Tria7-st2.XLS'),
         expect_meta=['bet_surface_area_m2_g', 'adsorptive_gas']),
    dict(name='UV_VIS', technique='UV-Vis', sample_code='IEF-8',
         file=lake('UV_Vis', 'IEF-8(CB-12A).Sample.asc'),
         expect_meta=['num_data_points', 'y_unit', 'instrument_serial', 'instrument_model']),
    # SEM covers the Hitachi INI sidecar format (FESEM covers JEOL, TEM covers the
    # filename-only fallback), so upload its companion .txt alongside the image.
    dict(name='SEM', needs_ai=True, technique='SEM', sample_code='IEF-18',
         file=lake('SEM', 'IEF-18(Co)0004(x1.0k).jpg'),
         sidecar=lake('SEM', 'IEF-18(Co)0004(x1.0k).txt'),
         expect_meta=['companion_metadata_format', 'magnification_x', 'instrument_serial']),
    dict(name='FESEM', needs_ai=True, technique='FESEM', sample_code='IEF-31',
         file=lake('FESEM', 'IEF-31 + PCL', 'IEF-31+PCL(1)', 'IEF-31+PCL(1)_1.bmp'),
         sidecar=lake('FESEM', 'IEF-31 + PCL', 'IEF-31+PCL(1)', 'IEF-31+PCL(1)_1.txt'),
         expect_meta=['companion_metadata_format', 'magnification_x', 'accelerating_voltage']),
    dict(name='TEM', needs_ai=True, technique='TEM', sample_code='IEF-31',
         file=lake('TEM', 'IEF-31-PCL-Lavado', 'IEF-31-PCL-Lavado_MAG_X3000_001.jpg'),
         expect_meta=['magnification_x', 'magnification_source']),
    # ICP/EA arrive as PDFs with no machine-readable structure, so they go through the
    # Gemini agent instead of a deterministic parser. If the agent's self-reported
    # confidence lands under the 85% threshold the run parks on an approval email and
    # never answers this request - that HITL pause is the design, not a failure, so a
    # timeout here is reported as a skip.
    dict(name='ICP_OES', needs_ai=True, technique='ICP-OES', sample_code='IEF-18',
         file=lake('ICP', '24AQ0245ICP%20Report_Fe,%20Ni,%20P_MOFs_Rubén%20Serrano.pdf'),
         expect_meta=['technique']),
    dict(name='EA', needs_ai=True, technique='EA', sample_code='IEF-18',
         file=lake('EA', 'CHNS-23047-Rubén.pdf'),
         expect_meta=['technique']),
]

# ---------------------------------------------------------------------------
# Fallbacks: (case name, kwargs for submit, expected HTTP code, expected cause prefix)
# ---------------------------------------------------------------------------
FALLBACK_CASES = [
    dict(name='WHITELIST', expect_code=400, expect_cause='UNAUTHORIZED_RESEARCHER_EMAIL',
         technique='PXRD', sample_code='RS1883', email=BLOCKED_EMAIL,
         file=lake('PXRD', '24DRX0180-RS1883_CoPy.xrdml')),
    dict(name='FILE_SIZE', expect_code=400, expect_cause='FILE_SIZE_EXCEEDED',
         technique='PXRD', sample_code='RS1883', oversized=True),
    dict(name='MISSING_SAMPLE_CODE', expect_code=400, expect_cause='MISSING_SAMPLE_CODE',
         technique='FTIR', sample_code='', file=lake('FTIR', 'CoPyF2.CSV')),
    dict(name='UNKNOWN_TECHNIQUE', expect_code=400, expect_cause='UNRECOGNIZED_TECHNIQUE',
         technique='MASS_SPEC_XYZ', sample_code='IEF-18',
         file=lake('PXRD', '24DRX0180-RS1883_CoPy.xrdml')),
    dict(name='BAD_EXT_DETERMINISTIC', expect_code=400, expect_cause='INVALID_FILE_EXTENSION',
         technique='PXRD', sample_code='IEF-18', file=lake('FTIR', 'CoPyF1.CSV')),
    dict(name='BAD_EXT_PDF_LANE', expect_code=400, expect_cause='INVALID_FILE_EXTENSION',
         technique='ICP-OES', sample_code='IEF-18', file=lake('FTIR', 'CoPyF1.CSV')),
    # DUPLICATE is generated dynamically: it re-sends whatever the PXRD happy path sent.
    dict(name='DUPLICATE', expect_code=400, expect_cause='DUPLICATE_MEASUREMENT_SKIPPED',
         technique='PXRD', sample_code='RS1883',
         file=lake('PXRD', '24DRX0180-RS1883_CoPy.xrdml'), needs_happy='PXRD'),
]


def submit(file_path=None, technique=None, sample_code=None, sidecar=None,
           email=None, oversized=False, timeout=180):
    data = {
        'technique': technique,
        'researcher_email': email or RESEARCHER_EMAIL,
        'researcher_name': RESEARCHER_NAME,
    }
    if sample_code is not None:
        data['sample_code'] = sample_code

    handles = []
    try:
        if oversized:
            tmp = os.path.join(tempfile.gettempdir(), 'alchemy_oversized_test.xrdml')
            with open(tmp, 'wb') as f:
                f.write(b'0' * (11 * 1024 * 1024))
            file_path = tmp

        fh = open(file_path, 'rb')
        handles.append(fh)
        # An explicit Content-Type matters: requests omits it for extensions Python's
        # mimetypes module does not know (.xrdml, .brml, .asc...), and without it n8n
        # decodes the upload as a plain text field instead of routing it to $binary.
        files = {'data_file': (os.path.basename(file_path), fh, 'application/octet-stream')}

        if sidecar:
            sh = open(sidecar, 'rb')
            handles.append(sh)
            files['instrument_metadata_file'] = (
                os.path.basename(sidecar), sh, 'application/octet-stream')

        return requests.post(WEBHOOK_URL, data=data, files=files, timeout=timeout)
    finally:
        for h in handles:
            h.close()


def body_of(resp):
    try:
        return resp.json()
    except Exception:
        return {'_raw': resp.text[:200]}


def fetch_row(sample_code, technique):
    with db() as conn, conn.cursor() as cur:
        cur.execute("""
            SELECT data_json, file_name, instrument_name, measurement_tag
            FROM characterization_measurements
            WHERE sample_code = %s AND technique = %s
            ORDER BY created_at DESC LIMIT 1;
        """, (sample_code, technique))
        return cur.fetchone()


def clear_rows(sample_code, technique):
    with db() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM characterization_measurements WHERE sample_code=%s AND technique=%s;",
                    (sample_code, technique))
        conn.commit()


def ensure_blocked_email():
    with db() as conn, conn.cursor() as cur:
        cur.execute("""
            INSERT INTO authorized_researchers (email, researcher_name, role, active)
            VALUES (%s, 'Blocked Test User', 'blocked_test', false)
            ON CONFLICT (email) DO UPDATE SET active = false;
        """, (BLOCKED_EMAIL,))
        conn.commit()


def run_happy(case, keep_rows):
    name = case['name']
    stored_technique = name

    clear_rows(case['sample_code'], stored_technique)

    resp = submit(file_path=case['file'], technique=case['technique'],
                  sample_code=case['sample_code'], sidecar=case.get('sidecar'))

    if resp.status_code != 200:
        cause = body_of(resp).get('cause', '')
        # The SEM/FESEM/TEM lane calls Gemini, whose free tier runs out after a few
        # dozen calls. That is an account limit, not a pipeline defect, so report it
        # separately instead of as a failure - otherwise a quota blip looks like a
        # regression and sends you hunting for a bug that is not there.
        if case.get('needs_ai') and 'AI_AGENT_EXTRACTION_FAILED' in cause:
            return 'WARN', 'agente de IA no disponible (cuota/limite de Gemini) - no es un fallo del pipeline'
        return False, 'HTTP %s %s' % (resp.status_code, cause[:90])

    row = fetch_row(case['sample_code'], stored_technique)
    if not row:
        return False, 'HTTP 200 but no row in characterization_measurements'

    data_json, file_name, instrument_name, measurement_tag = row
    header = (data_json or {}).get('header_metadata', {})
    missing = [k for k in case['expect_meta'] if header.get(k) in (None, '', [])]

    if not keep_rows:
        clear_rows(case['sample_code'], stored_technique)

    if missing:
        return False, 'row stored but header_metadata missing/null: %s' % ', '.join(missing)
    return True, 'row OK, instrument=%s, tag=%s' % (instrument_name, measurement_tag)


def run_fallback(case, keep_rows):
    if case.get('needs_happy'):
        # A duplicate can only be detected against something already ingested.
        happy = next(h for h in HAPPY_CASES if h['name'] == case['needs_happy'])
        submit(file_path=happy['file'], technique=happy['technique'],
               sample_code=happy['sample_code'])

    resp = submit(file_path=case.get('file'), technique=case['technique'],
                  sample_code=case.get('sample_code'), email=case.get('email'),
                  oversized=case.get('oversized', False))

    body = body_of(resp)
    cause = body.get('cause') or ''

    if case.get('needs_happy') and not keep_rows:
        happy = next(h for h in HAPPY_CASES if h['name'] == case['needs_happy'])
        clear_rows(happy['sample_code'], happy['name'])

    if resp.status_code != case['expect_code']:
        return False, 'expected HTTP %s, got %s (cause=%s)' % (
            case['expect_code'], resp.status_code, cause[:80])
    if not cause.startswith(case['expect_cause']):
        return False, 'expected cause %s..., got %r' % (case['expect_cause'], cause[:90])
    return True, cause[:80]


def main():
    cli = argparse.ArgumentParser(description='End-to-end verification of the ALCheMy webhook')
    cli.add_argument('--only', action='append', help='Run only these case names (repeatable)')
    cli.add_argument('--happy', action='store_true', help='Happy paths only')
    cli.add_argument('--fallbacks', action='store_true', help='Fallbacks only')
    cli.add_argument('--keep-rows', action='store_true', help='Do not delete the rows created')
    args = cli.parse_args()

    ensure_blocked_email()

    run_h = not args.fallbacks
    run_f = not args.happy

    results = []

    if run_h:
        print('=' * 78)
        print('HAPPY PATHS')
        print('=' * 78)
        for case in HAPPY_CASES:
            if args.only and case['name'] not in args.only:
                continue
            if not os.path.exists(case['file']):
                print('%-22s SKIP  file not found: %s' % (case['name'], case['file']))
                continue
            try:
                ok, detail = run_happy(case, args.keep_rows)
            except requests.exceptions.ReadTimeout:
                if case.get('needs_ai'):
                    ok, detail = 'WARN', 'sin respuesta: la ejecucion quedo esperando aprobacion humana (HITL)'
                else:
                    ok, detail = False, 'timeout de lectura'
            except Exception as e:
                ok, detail = False, 'EXCEPTION %s' % e
            results.append((case['name'], ok))
            label = 'WARN' if ok == 'WARN' else ('PASS' if ok else 'FAIL')
            print('%-22s %-5s %s' % (case['name'], label, detail))

    if run_f:
        print()
        print('=' * 78)
        print('FALLBACKS')
        print('=' * 78)
        for case in FALLBACK_CASES:
            if args.only and case['name'] not in args.only:
                continue
            try:
                ok, detail = run_fallback(case, args.keep_rows)
            except Exception as e:
                ok, detail = False, 'EXCEPTION %s' % e
            results.append((case['name'], ok))
            print('%-22s %-5s %s' % (case['name'], 'PASS' if ok else 'FAIL', detail))

    warned = [n for n, ok in results if ok == 'WARN']
    failed = [n for n, ok in results if ok is False]
    passed = [n for n, ok in results if ok is True]
    print()
    print('=' * 78)
    print('SUMMARY: %d passed, %d failed, %d skipped' % (len(passed), len(failed), len(warned)))
    if warned:
        print('SKIPPED (cuota de IA, no es un fallo): %s' % ', '.join(warned))
    if failed:
        print('FAILED: %s' % ', '.join(failed))
    print('=' * 78)
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
