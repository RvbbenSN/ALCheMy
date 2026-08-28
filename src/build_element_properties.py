# -*- coding: utf-8 -*-
"""
Populates element_properties, ion_properties and metal_source_oxidation_state
from mendeleev + pymatgen, for the 21 metals actually used in
synthesis_experiments.metal_center.

WHAT PROBLEM THIS SOLVES
------------------------
methodology/ROADMAP_ML_DESCRIPTORES_QUIMICOS.md SS2-3: with 21 metals and a very
uneven distribution (538 Ca vs 4 Nd), one-hot encoding the metal wastes the fact
that e.g. Zr and Hf are chemically almost the same element. This script replaces
"metal_center = Ni" with electronegativity, hardness, ionic radius, etc, so a
model can share statistical strength across chemically similar metals.

ONE THING THIS SCRIPT STILL CANNOT DO FOR YOU
-----------------------------------------------
Ga's oxophilicity_kepp: Kepp (2016), DOI 10.1021/acs.inorgchem.6b01702, Table 1
simply does not list gallium (only B, Al and In from group III were computed/
measured) -- not paywalled, not overlooked, genuinely absent from the source.
Left NULL for that one symbol; see methodology/PENDIENTE_ML_INPUTS_HUMANOS.md.

Kepp oxophilicity for the other 19 metals: Ruben supplied the PDF (2026-08-29)
and the values below are transcribed by hand from Table 1 of that PDF (O
column, "oxophilicities... according to eqs 2 and 3"; accurate to ~0.1 per the
paper's own error estimate). See KEPP_OXOPHILICITY below.

RESOLVED SYNTHESIS-DATA DISCREPANCIES (2026-08-29)
----------------------------------------------------
Three groups of synthesis rows where metal_center and metal_source (the salt
formula) disagreed have all been corrected directly in synthesis_experiments,
confirmed by Ruben against his lab notebook/presentations or by mass
cross-check (see methodology/PENDIENTE_ML_INPUTS_HUMANOS.md):
   - Mg/Ni(NO3)2.6H2O (8 rows, RS352-355/377-380): metal_source ->
     Mg(NO3)2.6H2O.
   - Ti/HfCl4 (4 rows, RS1845-1848): metal_center -> Hf.
   - RS253 (metal_center=Bi, metal_source read Mg(NO3)2.6H2O): Ruben confirmed
     Bi "con total seguridad" but not the exact salt, so it was resolved by
     mass, not by memory -- metal_mass_mg for RS253 (2.1828 mg at 0.0030 M,
     1.5 mL) matches Bi(NO3)3.5H2O's molar mass (485.06 g/mol) to 4 sig figs
     (0.0045 mmol x 485.06 = 2.183 mg), and does not match BiCl3 (315.34
     g/mol) or BiClO (260.43 g/mol) at that same mmol. metal_source ->
     Bi(NO3)3.5H2O.
None of these three are flagged as mismatches any more (see main() below).
RS94, RS95 ('-'/'-') are confirmed blanks (organic/control samples, no
metal), so oxidation_state stays NULL by design, not by omission -- not a
discrepancy to resolve.

HOW OXIDATION STATE IS DERIVED
-------------------------------
Roadmap SS3.3, option 1: parsed deterministically from the precursor salt
formula (e.g. FeCl3 -> Fe3+ because chloride is -1 and there are 3 of them),
not from "most common oxidation state of the element" -- that would get Fe, Ce
and Ti wrong, since this project actually uses more than one oxidation state of
some of them (e.g. Ce3+ from CeCl3 vs Ce4+ from ceric ammonium nitrate). The
MANUAL_OXIDATION_STATES table below is the deterministic parse, done once by
hand against every distinct metal_source string in the database (there are
only ~45) rather than a general formula parser, because a few of them
(oxychlorides, alkoxides, acetylacetonates) are not worth writing a generic
parser for 45 rows.

COORDINATION NUMBER
--------------------
Pinned to 6 everywhere (roadmap SS3.4): unknown before synthesis, and Shannon
CN=6 radii are the most tabulated and preserve relative ordering between metals.

USAGE
-----
    python src/build_element_properties.py             # populate everything
    python src/build_element_properties.py --dry-run   # print, write nothing
"""
import argparse
import os
import re
import sys

import psycopg2
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, '.env'))

import mendeleev                                                    # noqa: E402
from pymatgen.core.periodic_table import Element                    # noqa: E402

LANTHANIDES = {'La', 'Ce', 'Pr', 'Nd', 'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy',
                'Ho', 'Er', 'Tm', 'Yb', 'Lu'}

# The 21 symbols actually present in synthesis_experiments.metal_center
# (2026-08-28 count). '-' is excluded on purpose: it is not an element.
METALS = ['Ca', 'Fe', 'Cu', 'Bi', 'Mg', 'Ti', 'Ni', 'Co', 'Zr', 'Ce', 'Hf',
          'Zn', 'Cr', 'In', 'La', 'Y', 'Ga', 'Nd', 'Dy', 'Sr']
# Note: 20 listed above -- 'UNKNOWN' rows are auto-created orphan placeholders
# (CLAUDE.md: "the ingestion script auto-creates placeholder synthesis_experiments
# rows for orphan codes ... those placeholders carry dummy chemistry Ni/Pyrene")
# and are excluded here; Ni is already covered.

# Kepp, K. P. Inorg. Chem. 2016, 55, 9461-9470, DOI 10.1021/acs.inorgchem.6b01702,
# Table 1, column O ("Oxophilicities ... according to eqs 2 and 3"). Transcribed
# by hand from the PDF Ruben supplied (2026-08-29); the paper states the scale
# is accurate to ~0.1, matching the one-decimal precision printed in Table 1.
# Ga is missing on purpose: Table 1's group III row only has B, Al and In --
# gallium was not computed or measured in this paper, not omitted by us.
KEPP_OXOPHILICITY = {
    'Ca': 0.3, 'Sr': 0.5, 'Mg': 0.6, 'Bi': 0.2, 'In': 0.4,
    'Cr': 0.6, 'Fe': 0.4, 'Co': 0.4, 'Ni': 0.2, 'Cu': 0.2, 'Zn': 0.2,
    'Y': 0.8, 'Zr': 0.8, 'La': 1.0, 'Hf': 1.0,
    'Ce': 0.9, 'Nd': 1.0, 'Dy': 0.9, 'Ti': 1.0,
    # 'Ga': not in Table 1 -- left out on purpose, see docstring/comment above.
}

# Every distinct metal_source string in the database, mapped to (symbol, charge).
# Derived by hand from the formula -- see docstring. `None` charge = genuinely
# undeterminable / disputed with metal_center, left for human review.
MANUAL_OXIDATION_STATES = {
    'Ca(NO3)2.4H2O':      ('Ca', 2), 'Ca(NO3)2·4H2O': ('Ca', 2),
    'CaCl2·2H2O':         ('Ca', 2), 'CaOH':          ('Ca', 2),  # almost certainly Ca(OH)2
    'Bi(NO3)3·5H2O':      ('Bi', 3), 'BiCl3':         ('Bi', 3),
    'BiClO':              ('Bi', 3),                              # bismuth oxychloride, BiOCl
    'Ce(NH4)2(NO3)6':     ('Ce', 4),                               # ceric ammonium nitrate, a Ce(IV) reagent
    'CeCl3·7H2O':         ('Ce', 3),
    'CoCl2':              ('Co', 2), 'CoCl2·6H2O':    ('Co', 2), 'Co(NO3)2 · 6H2O': ('Co', 2),
    'Cr(NO3)3·9H2O':      ('Cr', 3),
    'Cu(NO3)2.3H2O':      ('Cu', 2), 'Cu(NO3)2·3H2O': ('Cu', 2),
    'CuCl2·H2O':          ('Cu', 2), 'CuCl2·2H2O':    ('Cu', 2), 'CuSO4·5H2O': ('Cu', 2),
    'Dy(NO3)3·5H2O':      ('Dy', 3),
    'FeCl3.6H2O':         ('Fe', 3), 'FeCl3·6H2O':    ('Fe', 3), 'FeCl2·4H2O': ('Fe', 2),
    'Ga(NO3)3·xH2O':      ('Ga', 3),
    'HfOCl2·8H2O':        ('Hf', 4),                               # hafnyl chloride
    'HfCl4':              ('Hf', 4),                               # also seen mislabelled under metal_center=Ti, see below
    'In(NO3)3·xH2O':      ('In', 3),
    'In(NO3)2·3H2O':      ('In', 3),                               # RS1939: Ruben confirmed this precursor (2026-08-29);
                                                                    # In is essentially always 3+ in solution, "2" read as a
                                                                    # transcription slip rather than a real In(II) reagent
    "La(OOCCH3)3·1,5H2O": ('La', 3),
    'Mg(NO3)2·6H2O':      ('Mg', 2), 'MgCl2 · 6H2O':  ('Mg', 2),
    'Nd(NO3)3·6H2O':      ('Nd', 3),
    'Ni(NO3)2.6H2O':      ('Ni', 2), 'Ni(NO3)2·6H2O': ('Ni', 2), 'NiCl2·6H2O': ('Ni', 2),
    'Sr(NO3)2':           ('Sr', 2),
    'TiO(acac)2':         ('Ti', 4),                               # titanyl acetylacetonate
    'Ti-isopropoxide':    ('Ti', 4), 'Ti isopropoxide': ('Ti', 4), 'Ti butoxide': ('Ti', 4),
    'Cp2Cl2Ti':           ('Ti', 4),                               # titanocene dichloride
    'TiCl4 · 2THF':       ('Ti', 4),
    'Y(NO3)3·6H2O':       ('Y', 3),
    'Zn(NO3)2.6H2O':      ('Zn', 2), 'Zn(NO3)2·6H2O': ('Zn', 2),
    'ZrCl4':              ('Zr', 4), 'ZrOCl2.8H2O':   ('Zr', 4),   # zirconyl chloride
    '-':                  (None, None),                           # RS94, RS95: no metal recorded at all
    'UNKNOWN':            (None, None),                           # orphan placeholder rows, not real synthesis data
}


def connect():
    return psycopg2.connect(
        host=os.getenv('POSTGRES_HOST', 'localhost'),
        port=int(os.getenv('POSTGRES_PORT', 5432)),
        dbname=os.getenv('POSTGRES_DB', 'alchemy_db'),
        user=os.getenv('POSTGRES_USER'),
        password=os.getenv('POSTGRES_PASSWORD'),
    )


def build_element_row(symbol):
    pm = Element(symbol)
    md = mendeleev.element(symbol)
    ie1 = md.ionenergies.get(1) if md.ionenergies else None
    ea = md.electron_affinity
    hardness = (ie1 - ea) / 2 if (ie1 is not None and ea is not None) else None
    abs_en = (ie1 + ea) / 2 if (ie1 is not None and ea is not None) else None
    return dict(
        symbol=symbol,
        atomic_number=pm.Z,
        atomic_mass_u=float(pm.atomic_mass) if pm.atomic_mass else None,
        period=md.period,
        group_number=md.group_id,
        block=md.block,
        is_transition_metal=bool(pm.is_transition_metal),
        is_lanthanide=symbol in LANTHANIDES,
        electronegativity_pauling=pm.X if pm.X else None,
        electronegativity_allen=md.en_allen,
        ionization_energy_1_ev=ie1,
        electron_affinity_ev=ea,
        absolute_hardness_ev=hardness,
        absolute_electroneg_ev=abs_en,
        covalent_radius_pm=md.covalent_radius,
        atomic_radius_pm=md.atomic_radius,
        polarizability_a3=(md.dipole_polarizability / 1000.0) if md.dipole_polarizability else None,
        oxophilicity_kepp=KEPP_OXOPHILICITY.get(symbol),   # NULL only for Ga, see docstring
        data_source='mendeleev+pymatgen',
    )


# pymatgen's bundled ionic_radii table is incomplete for a few ions we actually
# need (it only carries ONE oxidation state per element in some cases -- Cr only
# has 2+, Ni only has 3+ -- neither of which is the one our precursors use).
# These two are the textbook Shannon (1976) CN=6, high-spin values, reproduced
# in essentially every inorganic chemistry reference (e.g. the CRC Handbook);
# not from Kepp's paywalled paper, so safe to hardcode with a citation.
SHANNON_RADIUS_OVERRIDES_PM = {
    ('Cr', 3): 61.5,   # Cr3+, CN6, HS -- e.g. CRC Handbook of Chemistry and Physics
    ('Ni', 2): 69.0,   # Ni2+, CN6 -- e.g. CRC Handbook of Chemistry and Physics
}


def shannon_radius(pm_element, oxidation_state):
    """pymatgen's ionic_radii is keyed by oxidation state, CN=6 preferred implicitly
    for the 'ionic_radii' dict (its most complete table); falls back to whatever
    is available if CN=6 specifically isn't tabulated for that ion."""
    key = (pm_element.symbol, oxidation_state)
    if key in SHANNON_RADIUS_OVERRIDES_PM:
        return SHANNON_RADIUS_OVERRIDES_PM[key]
    radii = pm_element.ionic_radii
    if oxidation_state in radii:
        return float(radii[oxidation_state]) * 100  # pymatgen stores Angstrom, we store pm
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    print(f"Building element_properties for {len(METALS)} metals...")
    elements = [build_element_row(s) for s in METALS]

    print("Building ion_properties from MANUAL_OXIDATION_STATES...")
    ion_rows = {}   # (symbol, state) -> radius
    for source, (symbol, state) in MANUAL_OXIDATION_STATES.items():
        if symbol is None or state is None:
            continue
        if (symbol, state) not in ion_rows:
            ion_rows[(symbol, state)] = shannon_radius(Element(symbol), state)

    if args.dry_run:
        print(f"\n[dry-run] {len(elements)} element_properties rows")
        print(f"[dry-run] {len(ion_rows)} distinct (symbol, oxidation_state) ion_properties rows:")
        for (sym, st), r in sorted(ion_rows.items()):
            print(f"    {sym}{st}+  shannon_radius_pm={r}")
        unresolved = [k for k, v in MANUAL_OXIDATION_STATES.items() if v == (None, None) and k not in ('UNKNOWN',)]
        print(f"\n[dry-run] metal_source strings needing human review: {unresolved}")
        return

    conn = connect()
    cur = conn.cursor()

    cur.execute("DELETE FROM ion_properties")
    cur.execute("DELETE FROM metal_source_oxidation_state")
    cur.execute("DELETE FROM element_properties")

    for e in elements:
        cur.execute("""
            INSERT INTO element_properties (
                symbol, atomic_number, atomic_mass_u, period, group_number, block,
                is_transition_metal, is_lanthanide, electronegativity_pauling,
                electronegativity_allen, ionization_energy_1_ev, electron_affinity_ev,
                absolute_hardness_ev, absolute_electroneg_ev, covalent_radius_pm,
                atomic_radius_pm, polarizability_a3, oxophilicity_kepp, data_source
            ) VALUES (%(symbol)s, %(atomic_number)s, %(atomic_mass_u)s, %(period)s,
                %(group_number)s, %(block)s, %(is_transition_metal)s, %(is_lanthanide)s,
                %(electronegativity_pauling)s, %(electronegativity_allen)s,
                %(ionization_energy_1_ev)s, %(electron_affinity_ev)s,
                %(absolute_hardness_ev)s, %(absolute_electroneg_ev)s,
                %(covalent_radius_pm)s, %(atomic_radius_pm)s, %(polarizability_a3)s,
                %(oxophilicity_kepp)s, %(data_source)s)
        """, e)

    for (sym, state), radius in ion_rows.items():
        charge_over_radius = (state / radius) if radius else None
        cur.execute("""
            INSERT INTO ion_properties
                (symbol, oxidation_state, coordination_number, spin_state,
                 shannon_radius_pm, crystal_radius_pm, charge_over_radius, data_source)
            VALUES (%s, %s, 6, '', %s, NULL, %s, 'pymatgen_shannon')
        """, (sym, state, radius, charge_over_radius))

    # Which distinct metal_source strings actually disagree with metal_center,
    # queried live so the flag stays correct if new synthesis rows are added.
    cur.execute("""
        SELECT DISTINCT metal_source, metal_center FROM synthesis_experiments
        WHERE synthesis_type NOT IN ('REFERENCE','PENDING_RECORD')
    """)
    center_by_source = {}
    for source, center in cur.fetchall():
        center_by_source.setdefault(source, set()).add(center)

    for source, (symbol, state) in MANUAL_OXIDATION_STATES.items():
        centers = center_by_source.get(source, set())
        # False (not just "symbol not among centers") whenever the SAME source
        # string is also used under a different metal_center somewhere in the
        # data -- e.g. 'Ni(NO3)2.6H2O' appears under metal_center='Ni' (84 rows,
        # correct) AND metal_center='Mg' (8 rows, a data-entry mismatch). Both
        # groups get flagged so the mismatch is never silently invisible.
        matches = (centers == {symbol}) if (symbol and centers) else None
        basis = 'formula_charge_balance' if symbol else 'human_review_pending'
        notes = None
        if matches is False:
            notes = f"metal_source implies {symbol}, but metal_center recorded as {sorted(centers)}"
        cur.execute("""
            INSERT INTO metal_source_oxidation_state
                (metal_source, symbol, oxidation_state, basis, matches_metal_center, notes)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (source, symbol, state, basis, matches, notes))

    cur.execute("""
        INSERT INTO property_sources (property_name, source_citation, source_doi, scale_notes)
        VALUES
        ('electronegativity_pauling', 'Pauling, L. J. Am. Chem. Soc. 1932, 54, 3570.', NULL, NULL),
        ('electronegativity_allen', 'Allen, L. C. J. Am. Chem. Soc. 1989, 111, 9003.', NULL,
         'Orders transition metals differently than Pauling.'),
        ('absolute_hardness_ev', 'Pearson, R. G. Inorg. Chem. 1988, 27, 734.', NULL, 'eta=(IE1-EA)/2'),
        ('shannon_radius_pm', 'Shannon, R. D. Acta Cryst. A 1976, 32, 751.',
         '10.1107/S0567739476001551', 'CN=6 pinned throughout this project, see roadmap SS3.4.'),
        ('oxophilicity_kepp', 'Kepp, K. P. Inorg. Chem. 2016, 55, 9461.',
         '10.1021/acs.inorgchem.6b01702', 'Transcribed from Table 1 of the paper (19/20 metals; Ga not in the source table). Correlates strongly with electronegativity (SS6.4).')
        ON CONFLICT (property_name) DO UPDATE SET scale_notes = EXCLUDED.scale_notes
    """)

    conn.commit()
    cur.execute("SELECT count(*) FROM element_properties")
    n_elem = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM ion_properties")
    n_ion = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM metal_source_oxidation_state WHERE matches_metal_center = FALSE")
    n_mismatch = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM metal_source_oxidation_state WHERE oxidation_state IS NULL")
    n_pending = cur.fetchone()[0]
    print(f"\nDone: {n_elem} element_properties, {n_ion} ion_properties rows.")
    print(f"{n_mismatch} metal_source/metal_center mismatches flagged, {n_pending} rows pending human review.")
    print("Run: SELECT * FROM metal_source_oxidation_state WHERE matches_metal_center=FALSE OR oxidation_state IS NULL;")
    cur.close()
    conn.close()


if __name__ == '__main__':
    main()
