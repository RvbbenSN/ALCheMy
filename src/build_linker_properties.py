# -*- coding: utf-8 -*-
"""
Populates linker_properties from hand-picked SMILES, using RDKit for the 2D
descriptors and a UFF-optimised 3D conformer for the one descriptor that needs
geometry (max_donor_distance_a).

WHAT PROBLEM THIS SOLVES
------------------------
methodology/ROADMAP_ML_DESCRIPTORES_QUIMICOS.md SS4: the 6 values of
synthesis_experiments.linker are not 6 independent categories -- they are 3
molecular scaffolds (triazine-phosphonate, pyrene-phosphonate, polyphenol)
crossed with 2 protection states (free acid / ethyl ester). This script writes
that structure explicitly instead of leaving it implicit in a string.

WHY ONLY ~6 DESCRIPTORS AND NOT RDKIT'S FULL LIST
---------------------------------------------------
Roadmap SS4.4: with only 6 molecules, RDKit's 200+ descriptors would give the
model more columns than objects -- guaranteed memorization ("linker #3 always
crystallizes"), not chemistry. The columns below were chosen by hand because
each maps to something that plausibly controls MOF assembly (denticity ->
connectivity, max_donor_distance -> pore size / topology, n_rotatable_bonds ->
rigidity).

IDENTITY CONFIRMED 2026-08-29
-------------------------------
H6ttbmp/Et6ttbmp and H8ptp/Et8ptp were originally deduced by an AI from the
lab's file naming, not from a CAS/vendor record. Ruben confirmed both against
a downloaded article:
- H6ttbmp: the article's own name, "2,4,6-tris[4-(phosphonomethyl)phenyl]-
  1,3,5-triazine (H6ttbmp)", is character-for-character the same as the
  iupac_name below -- exact match, same compound, same abbreviation.
- H8ptp: the article calls the same molecule "H8tpt" (letters in a different
  order) rather than "H8ptp", but the chemical description it gives --
  "pyrene-1,3,6,8-tetrayltetrakis(phosphonic acid)" -- is exactly the
  iupac_name and substitution pattern {1,3,6,8} already used below (see H8ptp
  entry: built from RDKit symmetry analysis, formula-verified C16H14O12P4).
  Same molecule; only the four-letter abbreviation differs between this lab's
  convention and the article's, which does not change the SMILES or any
  descriptor derived from it.

USAGE
-----
    python src/build_linker_properties.py             # populate the table
    python src/build_linker_properties.py --dry-run    # print, write nothing
"""
import argparse
import os

import psycopg2
from dotenv import load_dotenv
from rdkit import Chem
from rdkit.Chem import AllChem, Descriptors, rdMolDescriptors

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, '.env'))

# -----------------------------------------------------------------------------
# The 6 linkers. H6ttbmp/Et6ttbmp and H8ptp/Et8ptp identities confirmed by
# Ruben 2026-08-29 against a downloaded article (see docstring above). The
# rest (tannic acid, bare pyrene) are unambiguous, well-known molecules.
# -----------------------------------------------------------------------------
LINKERS = {
    'H6ttbmp': dict(
        # 2,4,6-tris[4-(phosphonomethyl)phenyl]-1,3,5-triazine
        smiles='OP(=O)(O)Cc1ccc(cc1)-c1nc(nc(n1)-c1ccc(CP(=O)(O)O)cc1)-c1ccc(CP(=O)(O)O)cc1',
        iupac_name='2,4,6-tris[4-(phosphonomethyl)phenyl]-1,3,5-triazine',
        common_name='H6ttbmp',
        scaffold='triazine_phosphonate', protection_state='free_acid',
        denticity=3, n_donor_atoms=6, n_acidic_protons=6, donor_group='phosphonate',
        notes='Identity confirmed by Ruben 2026-08-29 against a downloaded article -- exact name match.',
    ),
    'Et6ttbmp': dict(
        # hexaethyl ester of H6ttbmp
        smiles='CCOP(=O)(OCC)Cc1ccc(cc1)-c1nc(nc(n1)-c1ccc(CP(=O)(OCC)OCC)cc1)-c1ccc(CP(=O)(OCC)OCC)cc1',
        iupac_name='hexaethyl [1,3,5-triazine-2,4,6-triyltris(benzene-4,1-diyl)]trimethylenetris(phosphonate)',
        common_name='Et6ttbmp',
        scaffold='triazine_phosphonate', protection_state='ethyl_ester',
        denticity=0, n_donor_atoms=0, n_acidic_protons=0, donor_group='none',
        notes='Ethyl ester of H6ttbmp -- a pro-linker; must hydrolyse in situ to coordinate (roadmap SS1.3).',
    ),
    'H8ptp': dict(
        # pyrene-1,3,6,8-tetrayl-tetrakis(phosphonic acid)
        # Built programmatically (not hand-typed) by substituting -P(=O)(O)O at
        # the 4 pyrene ring positions {1,3,6,8} identified from RDKit symmetry
        # analysis of the verified base pyrene SMILES -- see git history of this
        # file for the derivation script. Formula checks out: C16H14O12P4.
        smiles='O=P(O)(O)c1cc(P(=O)(O)O)c2ccc3c(P(=O)(O)O)cc(P(=O)(O)O)c4ccc1c2c43',
        iupac_name='pyrene-1,3,6,8-tetrayltetrakis(phosphonic acid)',
        common_name='H8ptp',
        scaffold='pyrene_phosphonate', protection_state='free_acid',
        denticity=4, n_donor_atoms=8, n_acidic_protons=8, donor_group='phosphonate',
        notes='Identity confirmed by Ruben 2026-08-29 against a downloaded article, which calls it H8tpt -- same substitution pattern and iupac_name, different abbreviation letter order.',
    ),
    'Et8ptp': dict(
        # Same derivation as H8ptp, with ethoxy groups instead of hydroxyl. Formula checks out: C32H46O12P4.
        smiles='CCOP(=O)(OCC)c1cc(P(=O)(OCC)OCC)c2ccc3c(P(=O)(OCC)OCC)cc(P(=O)(OCC)OCC)c4ccc1c2c43',
        iupac_name='octaethyl pyrene-1,3,6,8-tetrayltetrakis(phosphonate)',
        common_name='Et8ptp',
        scaffold='pyrene_phosphonate', protection_state='ethyl_ester',
        denticity=0, n_donor_atoms=0, n_acidic_protons=0, donor_group='none',
        notes='Octaethyl ester of H8ptp -- a pro-linker (roadmap SS1.3).',
    ),
    'Tannic acid': dict(
        # Simplified representative structure (a decagalloyl glucose core) -- tannic
        # acid is a mixture/polymer in practice; RDKit descriptors below are for
        # this representative structure, not a single pure compound.
        smiles='OCC1OC(OC(=O)c2cc(O)c(O)c(O)c2)C(OC(=O)c2cc(O)c(O)c(O)c2)C(OC(=O)c2cc(O)c(O)c(O)c2)C1OC(=O)c1cc(O)c(O)c(O)c1',
        iupac_name='tannic acid (representative galloylglucose structure)',
        common_name='Tannic acid',
        scaffold='polyphenol', protection_state='none',
        denticity=None, n_donor_atoms=None, n_acidic_protons=20, donor_group='phenol',
        molecular_weight_override=1701.2,  # real tannic acid (decagalloylglucose, PubChem CID 16129778); the SMILES above is a simplified 4-galloyl stand-in and its own MW (788.6) would be wrong
        notes='Tannic acid is a natural polyphenol mixture, not one pure compound. The SMILES here is a simplified representative galloylglucose fragment (RDKit needs *a* structure to compute TPSA/logP/rotatable bonds), so treat scaffold/protection_state/donor_group as reliable but molecular_weight/tpsa/clogp/n_rotatable_bonds as rough stand-ins, not the real tannic acid values -- molecular_weight is overridden to the true 1701.2 g/mol, the rest are not.',
    ),
    'Pyrene': dict(
        smiles='c1cc2ccc3cccc4ccc(c1)c2c34',
        iupac_name='pyrene',
        common_name='Pyrene',
        scaffold='pyrene_bare', protection_state='none',
        denticity=0, n_donor_atoms=0, n_acidic_protons=0, donor_group='none',
        notes='No coordinating groups; almost certainly used as a control (roadmap SS1.3).',
    ),
}


def compute_2d(smiles):
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"RDKit could not parse SMILES: {smiles}")
    return dict(
        inchikey=Chem.MolToInchiKey(mol),
        molecular_weight=Descriptors.MolWt(mol),
        n_aromatic_rings=rdMolDescriptors.CalcNumAromaticRings(mol),
        tpsa=Descriptors.TPSA(mol),
        clogp=Descriptors.MolLogP(mol),
        n_rotatable_bonds=Descriptors.NumRotatableBonds(mol),
    ), mol


def max_donor_distance(mol, donor_smarts='[P,O;$([P](=O)(O)O),$([OX2H]-c)]'):
    """3D-embeds the molecule and returns the largest distance between donor
    atoms (P of a phosphonate, or phenolic O), as a proxy for linker 'length'.
    Returns None for molecules with no donor atoms (esters, bare pyrene)."""
    patt_p = Chem.MolFromSmarts('[P](=O)(O)(O)')
    patt_oh = Chem.MolFromSmarts('[OX2H]-c')
    donors = set()
    for patt in (patt_p, patt_oh):
        if patt is not None:
            for match in mol.GetSubstructMatches(patt):
                donors.add(match[0])
    if len(donors) < 2:
        return None
    molH = Chem.AddHs(mol)
    if AllChem.EmbedMolecule(molH, randomSeed=42, useRandomCoords=True) != 0:
        return None
    try:
        AllChem.MMFFOptimizeMolecule(molH, maxIters=2000)
    except Exception:
        AllChem.UFFOptimizeMolecule(molH, maxIters=2000)
    conf = molH.GetConformer()
    donor_idx = list(donors)
    best = 0.0
    for i in range(len(donor_idx)):
        for j in range(i + 1, len(donor_idx)):
            d = conf.GetAtomPosition(donor_idx[i]).Distance(conf.GetAtomPosition(donor_idx[j]))
            best = max(best, d)
    return round(best, 2)


def connect():
    return psycopg2.connect(
        host=os.getenv('POSTGRES_HOST', 'localhost'),
        port=int(os.getenv('POSTGRES_PORT', 5432)),
        dbname=os.getenv('POSTGRES_DB', 'alchemy_db'),
        user=os.getenv('POSTGRES_USER'),
        password=os.getenv('POSTGRES_PASSWORD'),
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    rows = []
    for code, meta in LINKERS.items():
        meta = dict(meta)
        mw_override = meta.pop('molecular_weight_override', None)
        d2, mol = compute_2d(meta['smiles'])
        if mw_override is not None:
            d2['molecular_weight'] = mw_override
        dist = max_donor_distance(mol)
        row = dict(linker_code=code, **meta, **d2, max_donor_distance_a=dist,
                   computed_with=f"rdkit-{Chem.rdBase.rdkitVersion}")
        rows.append(row)
        print(f"{code:12s} MW={d2['molecular_weight']:.1f}  aromatic_rings={d2['n_aromatic_rings']}  "
              f"max_donor_dist_A={dist}  scaffold={meta['scaffold']}/{meta['protection_state']}")

    if args.dry_run:
        return

    conn = connect()
    cur = conn.cursor()
    cur.execute("DELETE FROM linker_properties")
    for r in rows:
        cur.execute("""
            INSERT INTO linker_properties (
                linker_code, iupac_name, common_name, smiles, inchikey,
                scaffold, protection_state, denticity, n_donor_atoms,
                n_acidic_protons, donor_group, molecular_weight, n_aromatic_rings,
                max_donor_distance_a, tpsa, clogp, n_rotatable_bonds,
                computed_with, notes
            ) VALUES (%(linker_code)s, %(iupac_name)s, %(common_name)s, %(smiles)s,
                %(inchikey)s, %(scaffold)s, %(protection_state)s, %(denticity)s,
                %(n_donor_atoms)s, %(n_acidic_protons)s, %(donor_group)s,
                %(molecular_weight)s, %(n_aromatic_rings)s, %(max_donor_distance_a)s,
                %(tpsa)s, %(clogp)s, %(n_rotatable_bonds)s, %(computed_with)s, %(notes)s)
        """, r)
    conn.commit()
    cur.execute("SELECT count(*) FROM linker_properties")
    print(f"\nDone: {cur.fetchone()[0]} linker_properties rows.")
    cur.close()
    conn.close()


if __name__ == '__main__':
    main()
