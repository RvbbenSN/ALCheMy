# -*- coding: utf-8 -*-
"""
Applies Ruben's 2026-08-30 review of the 3 pending items from notebook 06 §7:
duplicate-measurement selection, AMORFO+oxide exclusion, and one mislabelled
sample_code found while reviewing the duplicates. One-shot script, meant to
run once -- see methodology/DIARIO_DE_PROYECTO.md for the session log.

WHAT PROBLEM THIS SOLVES
------------------------
Notebook 06 found 43 sample_code with more than one PXRD measurement carrying
its own crystallinity_class label, 70 AMORFO measurements independently
flagged oxide_flag='SI', and (while reviewing the duplicates) one measurement
filed under the wrong sample_code. Ruben reviewed all of it by hand in
`app/pxrd_explorer.py`'s "0 - Revision puntual para ML" filter and returned a
verdict per case (see Downloads/Revision.txt, transcribed into REVIEW_PLAN
below). This script applies that verdict.

WHY 'ml_include' IS A LABEL, NOT A DELETE
-------------------------------------------
Ruben chose (2026-08-30) to mark excluded measurements rather than delete
their labels: `pxrd_labels` already models "one row per question" keyed on
(file_hash, label_type) -- see app/pxrd_labeler.py's docstring -- so a new
label_type 'ml_include' with value 'NO' fits the existing pattern instead of
inventing a new mechanism, and nothing a human already judged is destroyed.
Absence of a row means "included" (the default); only exclusions get written.

WHAT THIS SCRIPT DOES NOT DO
------------------------------
1. It does NOT overwrite MEZCLA to CRISTALINO. Ruben chose (2026-08-30) to
   keep the original crystallinity_class as the historical truth of what was
   seen on the pattern, and merge MEZCLA into CRISTALINO only at the training
   query, e.g.:

       SELECT CASE WHEN label_value = 'MEZCLA' THEN 'CRISTALINO'
                   ELSE label_value END AS ml_class
       FROM pxrd_labels WHERE label_type = 'crystallinity_class'

2. It does NOT touch MIX (RSMIX7, RSMIX17) or UNKNOWN-PXRD samples. Ruben
   asked for these to be excluded, but they are already synthesis_type =
   'PENDING_RECORD', which every ML-facing query (v_ml_features, this
   project's join convention) already filters out. Verified 2026-08-30:
   zero rows from these sample_codes would ever reach a training join.

USAGE
-----
    python src/apply_ml_label_review_2026_08.py             # apply
    python src/apply_ml_label_review_2026_08.py --dry-run   # print, write nothing
"""
import argparse
import os

import psycopg2
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, '.env'))

LABELED_BY = 'Ruben (revision ML pxrd_explorer, 2026-08-30)'

# ---------------------------------------------------------------------------
# 1. One measurement filed under the wrong sample_code, found while reviewing
#    the duplicates. The file name itself carries the correction note ("es
#    SMP-0012"), and SMP-0012 (a real, existing synthesis) had zero PXRD
#    measurements of its own -- so this one is reassigned, not merely flagged.
# ---------------------------------------------------------------------------
RESAMPLE_CODE_FIX = {
    'measurement_id': '0e55a1c8-38ff-4dce-b2a4-0a39106a6cec',
    'from_sample': 'SMP-0013',
    'to_sample': 'SMP-0012',
    'reason': "File named 'DRX-23123(13)-SMP-0013-CaPy es SMP-0012..xrdml' -- "
              "Ruben confirmed 2026-08-30 this is really SMP-0012's scan, "
              "and SMP-0012 had no PXRD of its own.",
}

# ---------------------------------------------------------------------------
# 2. Duplicate-measurement resolution: for each sample_code with more than
#    one independently-labelled PXRD measurement, the measurement_id(s) to
#    EXCLUDE from the ML dataset (the other one stays the default "included").
#    Three sample_codes (SMP-0014/53/1466/67/68/69 typo'd as "SMP-0015" four
#    times in Ruben's notes) were disambiguated against the DB by matching
#    the file name to its real sample_code, not by the typo'd label.
# ---------------------------------------------------------------------------
EXCLUDE_DUPLICATE = {
    'SMP-0016':  ('1716b3b3-38df-4660-8c1e-8d76d321f9df', 'LP125_HTS_PXRD.xrdml'),
    'SMP-0017':  ('057723bb-b61f-49ab-b7cc-c62ee24b61ae', 'LP126_HTS_PXRD.xrdml'),
    'SMP-0018':  ('007f0ac9-3813-4c30-8ca7-a9a7f2772c9a', 'LP129_PXRD.xrdml'),
    'SMP-0019':   ('26690c83-89c8-4507-b4f9-1df24bdb03f8', '24DRX0725-LP97_CaPy.xrdml'),
    'SMP-0020': ('7b300f2b-9821-4e47-bf72-fd0b8eb7bba4', 'DRX-22111(8)-SMP-0020-Ni-Pyrene(F2).xrdml'),
    'SMP-0014': ('70d29c6d-4502-4440-811c-ab1c06e4183e', 'RS1452_PXRD.xrdml'),
    'SMP-0021': ('99a56ae8-068e-4bcf-8067-832021732555', 'RS1453_PXRD.xrdml'),
    'SMP-0022': ('ff43471f-ff6f-45c3-9316-a5252722b36e', 'RS1454_PXRD.xrdml'),
    'SMP-0023': ('cc6bcf95-92d2-4a38-af5e-e41d6049d749', 'RS1455_PXRD.xrdml'),
    'SMP-0024': ('f25acfe7-dfde-4f50-a2a9-dc1cd2f3f975', 'RS1456_PXRD.xrdml'),
    'SMP-0025': ('6d90d315-b9b1-4891-a43e-d5c4250eace4', 'RS1457_PXRD.xrdml'),
    'SMP-0026': ('183d2c6d-54d1-429a-aba2-dce5599599c7', 'RS1458_PXRD.xrdml'),
    'SMP-0027': ('10305273-5af0-4270-96c6-9a90363f6a08', 'RS1459_PXRD.xrdml'),
    'SMP-0028': ('34784436-01d7-4c39-9a1e-72f186220907', 'RS1460_PXRD.xrdml'),
    'SMP-0029': ('d59065ad-5987-4dba-830e-f8cd52922781', 'RS1461_PXRD.xrdml'),
    'SMP-0030': ('761c6f0e-ff77-4629-ac8b-3124c7a10239', 'RS1462_PXRD.xrdml'),
    'SMP-0031': ('575ab1e5-df57-4904-b7b9-763f9481ec23', 'RS1463_PXRD.xrdml'),
    'SMP-0032': ('67591211-bb81-435f-8897-b082549a1e57', 'RS1464_PXRD.xrdml'),
    'SMP-0033': ('56503164-a0c4-4031-84d3-7b8d093b3a54', 'RS1465_PXRD.xrdml'),
    'SMP-0015': ('2851c5fa-c986-4fe2-aba7-2f176271d48c', 'RS1466_PXRD.xrdml'),
    'SMP-0034': ('c346a0a7-e3b0-4e44-a9e8-6599e984de64', 'RS1467_PXRD.xrdml'),   # Ruben's note said "SMP-0015", file name says SMP-0034
    'SMP-0035': ('e897b7d4-6d7d-4b9b-912b-59fae0291dc9', 'RS1468_PXRD.xrdml'),   # Ruben's note said "SMP-0015", file name says SMP-0035
    'SMP-0036': ('2def4bb2-d162-4ee5-9b60-83759610ed22', 'RS1469_PXRD.xrdml'),   # Ruben's note said "SMP-0015", file name says SMP-0036
    'SMP-0037': ('8ec1c136-4972-4f84-8805-5eb7521eedec', 'RS1470_PXRD.xrdml'),
    'SMP-0038': ('6ba33b4d-438b-473d-a386-700a08e4d80c', 'RS1471_PXRD.xrdml'),
    'SMP-0039': ('43ee0294-d461-44f2-9da0-132c1389b0b5', 'RS1472_PXRD.xrdml'),
    'SMP-0040': ('5af4734c-628f-41e3-a29a-619e612b12d5', 'RS1473_PXRD.xrdml'),
    'SMP-0041': ('86899976-b8a7-4ca6-86aa-e6bc2657ab80', 'RS1474_PXRD.xrdml'),
    'SMP-0042': ('cdd9bdc2-d85e-4991-bad2-e347e6fb02ac', 'RS1475_PXRD.xrdml'),
    'SMP-0043':  ('d15d2670-0f55-46ed-a71a-aa7131de9690', 'RS171_PXRD.xrdml'),
    'SMP-0044': ('dde3073e-caef-47df-af47-b1f52acb6af5', '24DRX0268-RS1885_CoPy.xrdml'),
    'SMP-0045': ('19809899-82cf-4256-934b-c333d4378b9f', '24DRX0268-RS1886_CoPy.xrdml'),
    'SMP-0046': ('70417a5d-ccc7-4dfe-b50f-f283e41cee2e', '24DRX0680-SMP-0046-1929_CoPy.xrdml'),  # missing from Ruben's list; asked separately, 2026-08-30
    'SMP-0047': ('22532423-9b3b-4fd3-9298-7819fb2493c5', '24DRX0687-SMP-0047-RS1936_CoPy.xrdml'),
    'SMP-0048': ('ea1c20fe-73a8-4430-b1b7-ff3d07b0aa51', '24DRX0990-RS1959_1.xrdml'),
    'SMP-0049': ('7995d232-0df5-457b-b0ba-f0b297826307', '24DRX0990-RS1961_1.xrdml'),
    'SMP-0050':  ('04e260f0-3894-41cc-a31c-a672fd406e7e', 'DRX-21219(12)-SMP-0050-Ca-washed.xrdml'),
    'SMP-0051':  ('0c0c84dd-c059-4923-aa38-58e289dcfee2', 'DRX-21219(13)-SMP-0051-Mg-washed.xrdml'),
    'SMP-0052':  ('9e5d3a9d-db27-4be6-9a71-eac632ddb984', 'DRX-22071(11)-SMP-0052-672-ATG.xrdml'),
    'SMP-0053':  ('ee193341-de1a-4348-adc4-23b083e4dbf2', 'RS750_PXRD.xrdml'),
    'SMP-0054':  ('1b19c3ae-2e23-4915-808d-6910c4735b4b', 'DRX-22071(10)-SMP-0054-ATG.xrdml'),
    # SMP-0055 had 4 labelled measurements; Ruben kept only the Rietveld-refined
    # one, so 3 get excluded here instead of the usual 1.
    'RS1915_a': ('60a2a51d-df76-4f16-bffa-e2ad087ec023', '24DRX0669-RS1915_2_CoPy.xrdml'),
    'RS1915_b': ('dc58fe96-ddf9-4c28-aa54-2e04c0990e3a', '24DRX0669-RS1915_CoPy-Test.xrdml'),
    'RS1915_c': ('01f92ab6-4ea2-4a90-8edb-7e9ea82ba9da', '24DRX0669-RS1915_CoPy.xrdml'),
    # SMP-0013 needs no entry here: after RESAMPLE_CODE_FIX it has exactly one
    # PXRD measurement left, so it is unambiguous without a flag.
}

# ---------------------------------------------------------------------------
# 3. Corrections to the KEPT measurement, supplied by Ruben while reviewing
#    (a class override, or a subtype that was never recorded). Applied as a
#    normal pxrd_labels UPSERT -- these are real corrections to the record,
#    not ML-only bookkeeping.
# ---------------------------------------------------------------------------
CLASS_OVERRIDE = {
    # measurement_id: new crystallinity_class
    'c7a1988d-67f9-48fc-ae85-6266bca8a425': 'AMORFO',   # SMP-0022, was INCIPIENTE
    'bfa9f5e0-f7c9-4552-b8a7-af4d9c0af26f': 'AMORFO',   # SMP-0023, was INCIPIENTE
}

SUBTYPE_SET = {
    # measurement_id: incipient_subtype
    'f05c2b20-41f5-4df9-82d5-71d3e8bf1d3d': 'HALO_DOMINANTE',    # SMP-0014
    '27369a66-7bb2-4fa1-ade9-b945578999d3': 'HALO_DOMINANTE',    # SMP-0021
    '84880e32-2d79-4235-b466-962ec1db5b1c': 'PICOS_ANCHOS',      # SMP-0024
    'c674235e-4e62-4be9-96c8-98430e523c4c': 'CRISTALITO_PEQUENO',# SMP-0026
    'c38500ce-3591-4049-9a22-3c286dc1d76c': 'PICOS_ANCHOS',      # SMP-0028
    'fb6c6994-fc43-4d0c-8d39-29cc3e59e8b9': 'PICOS_ANCHOS',      # SMP-0029
    'a3ab9e95-2218-4ce5-b2a9-639c16658384': 'PICOS_ANCHOS',      # SMP-0030
    '11220288-5e00-4ccc-a9d3-7b951ab5d48d': 'PICOS_ANCHOS',      # SMP-0031
    '27c56110-f4be-4389-abc0-7e273b6f4edb': 'PICOS_ANCHOS',      # SMP-0032
    'fea414c7-8886-474e-9653-b44b7b1d7067': 'CRISTALITO_PEQUENO',# SMP-0033
    '2712276a-264c-4d1f-b807-dbe978ab89e4': 'HALO_DOMINANTE',    # SMP-0015
    'f573a647-a33d-4527-b0a4-e7c9e4d7f4a3': 'HALO_DOMINANTE',    # SMP-0034
    '9a4e9363-148b-4047-a9ec-6cc04081bf44': 'PICOS_ANCHOS',      # SMP-0039
    'dfea6c50-6a61-45e8-8b17-12b5bcf679f3': 'PICOS_ANCHOS',      # SMP-0040
    'a7e2e348-ba6f-4577-a2ae-3a12a2b84dc3': 'HALO_DOMINANTE',    # SMP-0041
    '4a028da2-b1e4-4fea-9ec8-5f196f3c8617': 'PICOS_ANCHOS',      # SMP-0042
}


def connect():
    return psycopg2.connect(
        host=os.getenv('POSTGRES_HOST', 'localhost'),
        port=int(os.getenv('POSTGRES_PORT', 5432)),
        dbname=os.getenv('POSTGRES_DB', 'alchemy_db'),
        user=os.getenv('POSTGRES_USER'),
        password=os.getenv('POSTGRES_PASSWORD'),
    )


def upsert_label(cur, measurement_id, label_type, label_value, notes):
    """Same shape as app/pxrd_labeler.py's save_label(): keyed on
    (file_hash, label_type), file_hash looked up live so nothing gets
    hand-copied wrong."""
    cur.execute("""
        INSERT INTO pxrd_labels (file_hash, label_type, sample_code, file_name,
                                  measurement_id, label_value, confidence, notes, labeled_by)
        SELECT file_hash, %s, sample_code, file_name, measurement_id, %s, 'alta', %s, %s
          FROM characterization_measurements WHERE measurement_id = %s
        ON CONFLICT (file_hash, label_type) DO UPDATE SET
            label_value = EXCLUDED.label_value,
            notes       = EXCLUDED.notes,
            labeled_by  = EXCLUDED.labeled_by,
            updated_at  = now();
    """, (label_type, label_value, notes, LABELED_BY, measurement_id))
    return cur.rowcount


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    if args.dry_run:
        print('[dry-run] Would reassign 1 measurement (SMP-0013 -> SMP-0012)')
        print('[dry-run] Would exclude %d duplicate measurements (ml_include=NO)'
              % len(EXCLUDE_DUPLICATE))
        print('[dry-run] Would apply %d class overrides, %d subtype assignments'
              % (len(CLASS_OVERRIDE), len(SUBTYPE_SET)))
        print('[dry-run] Would exclude the AMORFO+oxide_flag=SI measurements (computed live)')
        return

    conn = connect()
    cur = conn.cursor()

    # 1. Sample_code reassignment -- three denormalised copies of sample_code
    #    (characterization_measurements, pxrd_descriptors, pxrd_labels) all
    #    have to move together or the row becomes inconsistent with itself.
    mid = RESAMPLE_CODE_FIX['measurement_id']
    to_sample = RESAMPLE_CODE_FIX['to_sample']
    cur.execute("UPDATE characterization_measurements SET sample_code = %s WHERE measurement_id = %s",
                (to_sample, mid))
    n_cm = cur.rowcount
    cur.execute("UPDATE pxrd_descriptors SET sample_code = %s WHERE measurement_id = %s",
                (to_sample, mid))
    n_pd = cur.rowcount
    cur.execute("UPDATE pxrd_labels SET sample_code = %s, notes = COALESCE(notes || ' | ', '') || %s "
                "WHERE measurement_id = %s",
                (to_sample, 'sample_code corregido de SMP-0013 a SMP-0012, 2026-08-30', mid))
    n_pl = cur.rowcount
    print('Reasignacion SMP-0013->SMP-0012: %d characterization_measurements, %d pxrd_descriptors, %d pxrd_labels'
          % (n_cm, n_pd, n_pl))

    # 2. Exclude the losing side of every duplicate pair.
    n_excl_dup = 0
    for key, (mid, fname) in EXCLUDE_DUPLICATE.items():
        n_excl_dup += upsert_label(cur, mid, 'ml_include', 'NO',
                                    'Duplicado de la misma muestra; revision de Ruben 2026-08-30, se queda con otra medicion.')
    print('Duplicados marcados ml_include=NO: %d' % n_excl_dup)

    # 3. Exclude AMORFO+oxide_flag='SI', computed live (not hand-copied).
    cur.execute("""
        SELECT lc.measurement_id
        FROM pxrd_labels lc
        JOIN pxrd_labels lo ON lo.measurement_id = lc.measurement_id AND lo.label_type = 'oxide_flag'
        WHERE lc.label_type = 'crystallinity_class' AND lc.label_value = 'AMORFO' AND lo.label_value = 'SI'
    """)
    oxide_ids = [r[0] for r in cur.fetchall()]
    n_excl_oxide = 0
    for mid in oxide_ids:
        n_excl_oxide += upsert_label(cur, mid, 'ml_include', 'NO',
                                      'AMORFO con reflexiones de oxido, revisado y confirmado por Ruben 2026-08-30: se descarta del dataset de ML.')
    print('AMORFO+oxido marcados ml_include=NO: %d' % n_excl_oxide)

    # 4. Class overrides and subtype assignments on the kept measurements.
    n_class = sum(upsert_label(cur, mid, 'crystallinity_class', val,
                                'Reclasificado en la revision de duplicados, 2026-08-30.')
                  for mid, val in CLASS_OVERRIDE.items())
    n_subtype = sum(upsert_label(cur, mid, 'incipient_subtype', val,
                                  'Subtipo asignado en la revision de duplicados, 2026-08-30.')
                    for mid, val in SUBTYPE_SET.items())
    print('Overrides de clase: %d, subtipos asignados: %d' % (n_class, n_subtype))

    conn.commit()

    cur.execute("SELECT count(*) FROM pxrd_labels WHERE label_type='ml_include' AND label_value='NO'")
    print('\nTotal medidas excluidas del dataset de ML (ml_include=NO): %d' % cur.fetchone()[0])
    cur.close()
    conn.close()


if __name__ == '__main__':
    main()
