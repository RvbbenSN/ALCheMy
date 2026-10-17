# -*- coding: utf-8 -*-
"""
Builds a fixed, stratified sample of 150 PXRD diffractograms for blind relabeling.

WHAT IT IS FOR
--------------
Implementation of task T8 (Decision R4 / Finding M7):
Rubén relabels 150 diffractograms without seeing their previous labels or metadata
to measure self-agreement (Cohen's kappa). This establishes the human reliability
ceiling for the supervised crystallinity models.

SAMPLING CRITERIA
-----------------
- Target sample size: 150 measurements.
- Stratified by crystallinity_class in {AMORFO, INCIPIENTE, CRISTALINO, MEZCLA}.
- Proportional to population frequencies with a minimum floor of 30 per class
  (or min(N_k, 30) if a stratum has fewer than 30 total patterns in the dataset,
  which is the case for legacy MEZCLA with 16 patterns).
- Fixed pseudorandom seed (default: 20261017) ensuring 100% reproducibility.
- Deterministic random presentation order for the blind labeling interface.
- Saved to a JSON file, never written to the database.

USAGE
-----
    python scripts/build_blind_relabel_set.py
    python scripts/build_blind_relabel_set.py --seed 20261017
    python scripts/build_blind_relabel_set.py --allocation surplus
"""
import argparse
import json
import math
import os
import random
import sys
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

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


DEFAULT_OUTPUT_PATH = os.path.join(
    BASE_DIR,
    '_lab', 'methodology', 'revisions', 'datos_revision_2026-10-17', 'blind_set.json'
)

TARGET_CLASSES = ['AMORFO', 'INCIPIENTE', 'CRISTALINO', 'MEZCLA']
DEFAULT_SEED = 20261017
DEFAULT_SAMPLE_SIZE = 150
MIN_PER_CLASS = 30


def get_connection(db_name=None):
    """Establishes connection to the specified database or default alchemy_db."""
    dbname = db_name or os.getenv('ALCHEMY_DB_NAME') or os.getenv('POSTGRES_DB', 'alchemy_db')
    return psycopg2.connect(
        host=os.getenv('POSTGRES_HOST', 'localhost'),
        port=int(os.getenv('POSTGRES_PORT', 5432)),
        dbname=dbname,
        user=os.getenv('POSTGRES_USER'),
        password=os.getenv('POSTGRES_PASSWORD'),
    )


def fetch_candidate_measurements(conn):
    """
    Fetches all candidate PXRD measurements that possess a valid raw curve
    and an existing crystallinity_class label in TARGET_CLASSES.
    """
    sql = """
        SELECT m.measurement_id::text AS measurement_id,
               m.file_hash,
               m.sample_code,
               m.file_name,
               m.raw_file_path,
               l.label_value AS original_crystallinity_class,
               l.confidence  AS original_confidence,
               l.notes       AS original_notes,
               l.labeled_by  AS original_labeled_by,
               l.labeled_at::text AS original_labeled_at
        FROM characterization_measurements m
        JOIN pxrd_labels l ON l.file_hash = m.file_hash
        WHERE m.technique = 'PXRD'
          AND m.file_hash IS NOT NULL
          AND jsonb_array_length(m.data_json->'raw_data'->'x') > 100
          AND l.label_type = 'crystallinity_class'
          AND l.label_value = ANY(%s)
        ORDER BY l.label_value, m.file_hash;
    """
    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute(sql, (TARGET_CLASSES,))
        rows = [dict(r) for r in cur.fetchall()]
    return rows


def compute_quotas_bounded_proportional(pop_counts, target_size=150, min_per_class=30):
    """
    Computes sample quotas using bounded proportional allocation:
    1. Classes with population <= min_per_class are allocated all available samples.
    2. Remaining sample capacity is allocated proportionally to remaining classes.
    3. Any class below min_per_class is clamped to min_per_class.
    4. Residual capacity is distributed proportionally among remaining unconstrained classes.
    """
    quotas = {}
    unallocated = target_size
    remaining_classes = list(pop_counts.keys())

    # Step 1: Handle scarce strata (e.g., MEZCLA with N < 30)
    for c in list(remaining_classes):
        if pop_counts[c] <= min_per_class:
            quotas[c] = pop_counts[c]
            unallocated -= quotas[c]
            remaining_classes.remove(c)

    # Step 2: Iterative proportional allocation with floor clamping
    while remaining_classes:
        total_remaining_pop = sum(pop_counts[c] for c in remaining_classes)
        clamped_any = False
        
        # Calculate tentative proportional share
        tentative = {}
        for c in remaining_classes:
            tentative[c] = (unallocated * pop_counts[c]) / total_remaining_pop

        # Check if any stratum falls below min_per_class
        for c in list(remaining_classes):
            if tentative[c] < min_per_class:
                quotas[c] = min_per_class
                unallocated -= min_per_class
                remaining_classes.remove(c)
                clamped_any = True
                break

        if not clamped_any:
            # Distribute integer quotas with largest remainder method (Hare-Niemeyer)
            floored = {c: int(math.floor(tentative[c])) for c in remaining_classes}
            remainders = [(tentative[c] - floored[c], c) for c in remaining_classes]
            remainders.sort(reverse=True)
            deficit = unallocated - sum(floored.values())
            for i in range(deficit):
                floored[remainders[i][1]] += 1
            for c in remaining_classes:
                quotas[c] = floored[c]
            break

    return quotas


def compute_quotas_surplus_proportional(pop_counts, target_size=150, min_per_class=30):
    """
    Alternative allocation: assign min(N_k, min_per_class) baseline to each stratum,
    then distribute remaining surplus capacity proportionally across all strata with N_k > min_per_class.
    """
    quotas = {}
    baseline_sum = 0
    surplus_candidates = []

    for c, count in pop_counts.items():
        base = min(count, min_per_class)
        quotas[c] = base
        baseline_sum += base
        if count > min_per_class:
            surplus_candidates.append(c)

    surplus = target_size - baseline_sum
    if surplus > 0 and surplus_candidates:
        surplus_pop = sum(pop_counts[c] for c in surplus_candidates)
        shares = {c: (surplus * pop_counts[c]) / surplus_pop for c in surplus_candidates}
        floored = {c: int(math.floor(shares[c])) for c in surplus_candidates}
        remainders = [(shares[c] - floored[c], c) for c in surplus_candidates]
        remainders.sort(reverse=True)
        deficit = surplus - sum(floored.values())
        for i in range(deficit):
            floored[remainders[i][1]] += 1
        for c in surplus_candidates:
            quotas[c] += floored[c]

    return quotas


def build_blind_set(db_name=None, seed=DEFAULT_SEED, target_size=DEFAULT_SAMPLE_SIZE,
                    min_per_class=MIN_PER_CLASS, allocation='bounded_proportional',
                    output_file=DEFAULT_OUTPUT_PATH):
    """
    Extracts stratified candidate rows, draws the sample, shuffles presentation order,
    and writes blind_set.json.
    """
    conn = get_connection(db_name)
    try:
        rows = fetch_candidate_measurements(conn)
    finally:
        conn.close()

    # Group by stratum
    strata = {c: [] for c in TARGET_CLASSES}
    for r in rows:
        strata[r['original_crystallinity_class']].append(r)

    pop_counts = {c: len(strata[c]) for c in TARGET_CLASSES}

    if allocation == 'surplus':
        quotas = compute_quotas_surplus_proportional(pop_counts, target_size, min_per_class)
    else:
        quotas = compute_quotas_bounded_proportional(pop_counts, target_size, min_per_class)

    # Initialize RNG
    rng = random.Random(seed)

    selected_samples = []
    # Sample within each stratum deterministically
    for c in TARGET_CLASSES:
        quota = quotas[c]
        candidates = sorted(strata[c], key=lambda x: x['file_hash'])
        sampled = rng.sample(candidates, quota)
        for s in sampled:
            s['stratum'] = c
            selected_samples.append(s)

    # Deterministic shuffle for blind presentation order
    rng.shuffle(selected_samples)

    # Assign 1-indexed presentation order
    for idx, s in enumerate(selected_samples, start=1):
        s['presentation_order'] = idx

    # Build container payload
    payload = {
        'metadata': {
            'created_at': datetime.now(timezone.utc).isoformat(),
            'seed': seed,
            'target_size': target_size,
            'actual_size': len(selected_samples),
            'min_per_class_constraint': min_per_class,
            'allocation_method': allocation,
            'database_evaluated': db_name or os.getenv('POSTGRES_DB', 'alchemy_db'),
            'population_counts': pop_counts,
            'sample_quotas': quotas,
            'sample_fractions': {c: round(quotas[c] / len(selected_samples), 4) for c in TARGET_CLASSES},
            'notes': (
                'Stratified blind relabeling set for PXRD crystallinity self-agreement. '
                'MEZCLA has 16 total patterns in the dataset, so all 16 are included.'
            ),
        },
        'samples': selected_samples,
    }

    os.makedirs(os.path.dirname(os.path.abspath(output_file)), exist_ok=True)
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    return payload


def main():
    parser = argparse.ArgumentParser(description='Build stratified blind relabeling set for PXRD.')
    parser.add_argument('--db-name', default=None, help='Database name (default from .env)')
    parser.add_argument('--seed', type=int, default=DEFAULT_SEED, help=f'RNG seed (default: {DEFAULT_SEED})')
    parser.add_argument('--size', type=int, default=DEFAULT_SAMPLE_SIZE, help=f'Sample size (default: {DEFAULT_SAMPLE_SIZE})')
    parser.add_argument('--min-per-class', type=int, default=MIN_PER_CLASS, help=f'Min per class floor (default: {MIN_PER_CLASS})')
    parser.add_argument('--allocation', choices=['bounded_proportional', 'surplus'], default='bounded_proportional',
                        help='Stratification quota calculation method (default: bounded_proportional)')
    parser.add_argument('--output', default=DEFAULT_OUTPUT_PATH, help=f'Output JSON path (default: {DEFAULT_OUTPUT_PATH})')

    args = parser.parse_args()

    payload = build_blind_set(
        db_name=args.db_name,
        seed=args.seed,
        target_size=args.size,
        min_per_class=args.min_per_class,
        allocation=args.allocation,
        output_file=args.output,
    )

    meta = payload['metadata']
    print("=" * 68)
    print("ALCheMy - Blind Relabeling Set Generation")
    print("=" * 68)
    print(f"Database:          {meta['database_evaluated']}")
    print(f"Random seed:       {meta['seed']}")
    print(f"Allocation method: {meta['allocation_method']}")
    print(f"Total samples:     {meta['actual_size']} / {meta['target_size']}")
    print(f"Output file:       {args.output}")
    print("-" * 68)
    print(f"{'Class':<15} {'Population':<12} {'Sample Quota':<14} {'Sample %':<10}")
    print("-" * 68)
    for c in TARGET_CLASSES:
        pop = meta['population_counts'][c]
        q = meta['sample_quotas'][c]
        pct = meta['sample_fractions'][c] * 100
        print(f"{c:<15} {pop:<12} {q:<14} {pct:.1f}%")
    print("=" * 68)


if __name__ == '__main__':
    main()
