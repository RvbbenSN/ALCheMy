# -*- coding: utf-8 -*-
"""
Calculates self-agreement metrics (Cohen's kappa) between original and blind PXRD labels.

WHAT IT IS FOR
--------------
Implementation of task T8 (Finding M7 / Decision R4):
Evaluates inter-rater / intra-rater agreement when the chemist relabels 150
diffractograms blindly without seeing previous metadata or labels.

METRICS EVALUATED
-----------------
1. Overall unweighted Cohen's Kappa (kappa) across all classes.
2. Per-class Cohen's Kappa (one-vs-rest binary kappa for each class).
3. Confusion matrix (Original vs Blind).
4. Linear weighted Cohen's Kappa (kappa_w) reflecting ordinal nature of
   degree of order (AMORFO < INCIPIENTE < CRISTALINO).
5. Discrepancy inventory ready for adjudication.

USAGE
-----
    python scripts/blind_relabel_agreement.py
    python scripts/blind_relabel_agreement.py --db-name alchemy_review
"""
import argparse
import json
import os
import sys

import numpy as np
import pandas as pd
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from sklearn.metrics import cohen_kappa_score, confusion_matrix

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE_DIR, 'src'))

# Load .env: check local worktree first, then fall back to the main project repository
for env_path in [
    os.path.join(BASE_DIR, '.env'),
    os.path.join(os.path.dirname(BASE_DIR), 'ALCheMy', '.env'),
    r'C:\Users\rubbe\Documents\ALCheMy\.env',
]:
    if os.path.isfile(env_path):
        load_dotenv(env_path)
        break

DEFAULT_BLIND_SET_PATHS = [
    r'C:\Users\rubbe\Documents\ALCheMy\_lab\methodology\revisions\datos_revision_2026-10-17\blind_set.json',
    os.path.join(BASE_DIR, '_lab', 'methodology', 'revisions', 'datos_revision_2026-10-17', 'blind_set.json'),
]

ALL_CLASSES = ['AMORFO', 'INCIPIENTE', 'CRISTALINO', 'MEZCLA']
ORDINAL_MAP_3CLASS = {'AMORFO': 0, 'INCIPIENTE': 1, 'CRISTALINO': 2}
ORDINAL_MAP_WITH_MEZCLA = {'AMORFO': 0, 'INCIPIENTE': 1, 'CRISTALINO': 2, 'MEZCLA': 2}


def get_connection(db_name=None):
    dbname = db_name or os.getenv('ALCHEMY_DB_NAME') or os.getenv('POSTGRES_DB', 'alchemy_db')
    return psycopg2.connect(
        host=os.getenv('POSTGRES_HOST', 'localhost'),
        port=int(os.getenv('POSTGRES_PORT', 5432)),
        dbname=dbname,
        user=os.getenv('POSTGRES_USER'),
        password=os.getenv('POSTGRES_PASSWORD'),
    )


def load_blind_set(custom_path=None):
    paths = [custom_path] if custom_path else DEFAULT_BLIND_SET_PATHS
    for p in paths:
        if p and os.path.isfile(p):
            with open(p, 'r', encoding='utf-8') as f:
                return json.load(f), p
    raise FileNotFoundError(
        f"Could not locate blind_set.json. Run scripts/build_blind_relabel_set.py first. Tried: {paths}"
    )


def fetch_labels_from_db(conn, file_hashes):
    """Fetches original, pre_blind, blind, and current labels for the given hashes."""
    sql = """
        SELECT file_hash, label_type, label_value, confidence, notes, labeled_by, labeled_at
        FROM pxrd_labels
        WHERE file_hash = ANY(%s)
          AND label_type IN ('crystallinity_class', 'crystallinity_class_blind',
                             'crystallinity_class_pre_blind', 'incipient_subtype',
                             'incipient_subtype_blind');
    """
    labels = {}
    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute(sql, (file_hashes,))
        for r in cur.fetchall():
            labels.setdefault(r['file_hash'], {})[r['label_type']] = dict(r)
    return labels


def compute_agreement(blind_set_payload, db_labels):
    """
    Computes agreement statistics between original labels in blind_set
    and blind labels stored in the database.
    """
    samples = blind_set_payload['samples']
    total_samples = len(samples)

    pairs = []
    pending = []

    for s in samples:
        h = s['file_hash']
        db_for_hash = db_labels.get(h, {})
        
        # Original label: either saved pre_blind (if adjudicated), or current, or in blind_set metadata
        orig_val = None
        if 'crystallinity_class_pre_blind' in db_for_hash:
            orig_val = db_for_hash['crystallinity_class_pre_blind']['label_value']
        elif 'crystallinity_class' in db_for_hash:
            orig_val = db_for_hash['crystallinity_class']['label_value']
        else:
            orig_val = s['original_crystallinity_class']

        blind_entry = db_for_hash.get('crystallinity_class_blind')
        if blind_entry is not None and blind_entry.get('label_value'):
            blind_val = blind_entry['label_value']
            pairs.append({
                'presentation_order': s.get('presentation_order'),
                'file_hash': h,
                'sample_code': s.get('sample_code'),
                'original': orig_val,
                'blind': blind_val,
                'match': (orig_val == blind_val),
                'blind_labeled_by': blind_entry.get('labeled_by'),
                'blind_labeled_at': str(blind_entry.get('labeled_at')),
                'is_adjudicated': ('crystallinity_class_pre_blind' in db_for_hash),
            })
        else:
            pending.append({
                'presentation_order': s.get('presentation_order'),
                'file_hash': h,
                'sample_code': s.get('sample_code'),
                'original': orig_val,
            })

    completed_count = len(pairs)
    is_complete = (completed_count == total_samples)

    if completed_count == 0:
        return {
            'total_samples': total_samples,
            'completed_count': 0,
            'is_complete': False,
            'pairs': [],
            'pending': pending,
            'metrics': None,
        }

    df_pairs = pd.DataFrame(pairs)
    # MEZCLA is retired and cannot be chosen blind; training counts it as
    # CRISTALINO, so agreement is measured on that same 3-class scale. The raw
    # value is kept in 'original_raw' for the record.
    df_pairs['original_raw'] = df_pairs['original']
    df_pairs['original'] = df_pairs['original'].replace({'MEZCLA': 'CRISTALINO'})
    df_pairs['match'] = df_pairs['original'] == df_pairs['blind']
    y_orig = df_pairs['original'].tolist()
    y_blind = df_pairs['blind'].tolist()

    # Determine unique classes present in pairs
    present_classes = sorted(list(set(y_orig + y_blind)))
    # Fixed canonical ordering
    ordered_classes = [c for c in ALL_CLASSES if c in present_classes]
    for c in present_classes:
        if c not in ordered_classes:
            ordered_classes.append(c)

    # 1. Overall raw agreement and unweighted Cohen's Kappa
    raw_agreement = np.mean(df_pairs['match'])
    kappa_unweighted = cohen_kappa_score(y_orig, y_blind, labels=ordered_classes)

    # 2. Per-class Cohen's Kappa (one-vs-rest binary kappa)
    per_class_kappa = {}
    for c in ordered_classes:
        bin_orig = [1 if y == c else 0 for y in y_orig]
        bin_blind = [1 if y == c else 0 for y in y_blind]
        if sum(bin_orig) == 0 and sum(bin_blind) == 0:
            k_val = float('nan')
        else:
            k_val = cohen_kappa_score(bin_orig, bin_blind)
        per_class_kappa[c] = {
            'kappa': k_val,
            'orig_count': sum(bin_orig),
            'blind_count': sum(bin_blind),
            'agreement': np.mean([o == b for o, b in zip(bin_orig, bin_blind)]),
        }

    # 3. Confusion matrix
    cm = confusion_matrix(y_orig, y_blind, labels=ordered_classes)
    df_cm = pd.DataFrame(cm, index=[f"Orig_{c}" for c in ordered_classes],
                         columns=[f"Blind_{c}" for c in ordered_classes])

    # 4. Linear weighted Cohen's Kappa
    # Scale A: strictly ordinal 3-class subset (AMORFO=0, INCIPIENTE=1, CRISTALINO=2)
    pairs_3class = [
        (ORDINAL_MAP_3CLASS[o], ORDINAL_MAP_3CLASS[b])
        for o, b in zip(y_orig, y_blind)
        if o in ORDINAL_MAP_3CLASS and b in ORDINAL_MAP_3CLASS
    ]
    if len(pairs_3class) > 1:
        o3, b3 = zip(*pairs_3class)
        kappa_linear_3class = cohen_kappa_score(o3, b3, labels=[0, 1, 2], weights='linear')
    else:
        kappa_linear_3class = float('nan')

    # Scale B: mapping MEZCLA to 2 (crystalline mixture)
    pairs_mezcla_mapped = [
        (ORDINAL_MAP_WITH_MEZCLA[o], ORDINAL_MAP_WITH_MEZCLA[b])
        for o, b in zip(y_orig, y_blind)
        if o in ORDINAL_MAP_WITH_MEZCLA and b in ORDINAL_MAP_WITH_MEZCLA
    ]
    if len(pairs_mezcla_mapped) > 1:
        om, bm = zip(*pairs_mezcla_mapped)
        kappa_linear_mezcla_mapped = cohen_kappa_score(om, bm, labels=[0, 1, 2], weights='linear')
    else:
        kappa_linear_mezcla_mapped = float('nan')

    # Discrepancies breakdown
    discrepancies = df_pairs[~df_pairs['match']].to_dict(orient='records')

    metrics = {
        'total_samples': total_samples,
        'completed_count': completed_count,
        'is_complete': is_complete,
        'raw_agreement': float(raw_agreement),
        'kappa_unweighted': float(kappa_unweighted),
        'kappa_linear_3class': float(kappa_linear_3class),
        'kappa_linear_mezcla_mapped': float(kappa_linear_mezcla_mapped),
        'ordered_classes': ordered_classes,
        'per_class_kappa': per_class_kappa,
        'confusion_matrix': df_cm.to_dict(),
        'discrepancy_count': len(discrepancies),
        'discrepancies': discrepancies,
    }

    return {
        'total_samples': total_samples,
        'completed_count': completed_count,
        'is_complete': is_complete,
        'pairs': pairs,
        'pending': pending,
        'metrics': metrics,
    }


def format_report_console(res, db_name, blind_set_path):
    m = res['metrics']
    print("=" * 72)
    print("ALCheMy - PXRD Blind Relabeling Agreement Report")
    print("=" * 72)
    print(f"Database:        {db_name}")
    print(f"Blind set file:  {blind_set_path}")
    print(f"Progress:        {res['completed_count']} / {res['total_samples']} "
          f"({100 * res['completed_count'] / res['total_samples']:.1f}%)")
    print("-" * 72)

    if m is None:
        print("No blind labels found in pxrd_labels yet.")
        print("Open the labeler app in blind mode (?mode=blind) to start labeling.")
        print("=" * 72)
        return

    print("OVERALL AGREEMENT METRICS:")
    print(f"  Raw Accuracy (observed agreement):  {m['raw_agreement'] * 100:.2f}% "
          f"({res['completed_count'] - m['discrepancy_count']}/{res['completed_count']} matches)")
    print(f"  Unweighted Cohen's Kappa:           {m['kappa_unweighted']:.4f}")
    print(f"  Linear Weighted Kappa (3-class):    {m['kappa_linear_3class']:.4f}")
    print(f"  Linear Weighted Kappa (MEZCLA->2):  {m['kappa_linear_mezcla_mapped']:.4f}")
    print("-" * 72)

    print("PER-CLASS AGREEMENT (One-vs-Rest):")
    print(f"  {'Class':<14} {'Orig Count':<12} {'Blind Count':<12} {'Binary Kappa':<14} {'Accuracy':<10}")
    print(f"  {'-'*14} {'-'*12} {'-'*12} {'-'*14} {'-'*10}")
    for c in m['ordered_classes']:
        inf = m['per_class_kappa'][c]
        k_str = f"{inf['kappa']:.4f}" if not np.isnan(inf['kappa']) else "N/A"
        print(f"  {c:<14} {inf['orig_count']:<12} {inf['blind_count']:<12} {k_str:<14} {inf['agreement']*100:.1f}%")
    print("-" * 72)

    print("CONFUSION MATRIX (Rows: Original Label | Columns: Blind Relabel):")
    df_cm = pd.DataFrame(m['confusion_matrix'])
    # Clean column names
    print(df_cm.to_string())
    print("-" * 72)

    print(f"DISCREPANCIES DETECTED: {m['discrepancy_count']} / {res['completed_count']}")
    if m['discrepancies']:
        print("Top discrepancies:")
        for d in m['discrepancies'][:10]:
            adj_flag = " [Adjudicated]" if d.get('is_adjudicated') else ""
            print(f"  Order #{d['presentation_order']}: {d['sample_code']} -> "
                  f"Orig: {d['original']} vs Blind: {d['blind']}{adj_flag}")
        if len(m['discrepancies']) > 10:
            print(f"  ... and {len(m['discrepancies']) - 10} more.")
    print("=" * 72)


def main():
    parser = argparse.ArgumentParser(description='Compute agreement metrics for PXRD blind relabeling.')
    parser.add_argument('--db-name', default=None, help='Database name (default from .env)')
    parser.add_argument('--blind-set', default=None, help='Path to blind_set.json')
    parser.add_argument('--json-out', default=None, help='Optional output path for JSON metrics report')

    args = parser.parse_args()

    blind_payload, set_path = load_blind_set(args.blind_set)
    conn = get_connection(args.db_name)
    try:
        hashes = [s['file_hash'] for s in blind_payload['samples']]
        db_labels = fetch_labels_from_db(conn, hashes)
    finally:
        conn.close()

    db_evaluated = args.db_name or os.getenv('ALCHEMY_DB_NAME') or os.getenv('POSTGRES_DB', 'alchemy_db')
    results = compute_agreement(blind_payload, db_labels)
    format_report_console(results, db_evaluated, set_path)

    if args.json_out:
        with open(args.json_out, 'w', encoding='utf-8') as f:
            json.dump(results['metrics'], f, indent=2, ensure_ascii=False)
        print(f"Metrics saved to {args.json_out}")


if __name__ == '__main__':
    main()
