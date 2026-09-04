-- =============================================================================
-- ALCheMy - reference tables for the ML feature layer (F0 in
-- methodology/ROADMAP_ML_DESCRIPTORES_QUIMICOS.md)
-- =============================================================================
-- WHAT THIS IS
-- ------------
-- Five new objects that turn "Ni", "Ca", "LIG-x" into numbers a model can use,
-- instead of one-hot columns per category. Full reasoning in the roadmap; the
-- short version: with 21 metals (9 of them under 15 samples) and 6 linkers that
-- are really 3 molecules x 2 protection states, one-hot throws away chemistry
-- that a physical descriptor recovers for free.
--
--   element_properties          -- one row per element symbol (Ni, Ca, ...)
--   ion_properties               -- one row per (symbol, oxidation_state):
--                                    radius and charge depend on the state, not
--                                    just the element (Shannon 1976)
--   metal_source_oxidation_state -- one row per distinct metal_source string
--                                    (e.g. 'FeCl3.6H2O' -> Fe, +3): the bridge
--                                    that tells v_ml_features WHICH oxidation
--                                    state a given synthesis actually used
--   property_sources             -- citation + DOI for every property, because
--                                    "electronegativity = 1.91" without saying
--                                    which scale is an incomplete number
--   linker_properties            -- one row per linker code, 4-6 hand-picked
--                                    descriptors (never RDKit's full 200+ --
--                                    see roadmap SS4.4, we only have 6 molecules)
--
-- v_ml_features joins all of it to synthesis_experiments at query time (a VIEW,
-- not materialized columns) so correcting one ionic radius later updates every
-- downstream feature automatically.
--
-- HOW THE TABLES ARE POPULATED
-- -----------------------------
-- This file only creates empty, documented tables. The rows come from:
--   python src/build_element_properties.py   (mendeleev + pymatgen, 21 metals)
--   python src/build_linker_properties.py    (RDKit, 6 linkers)
-- Both scripts are idempotent (DELETE + re-INSERT their own rows) and print
-- exactly what they could not determine automatically -- those gaps are listed
-- in methodology/PENDIENTE_ML_INPUTS_HUMANOS.md for Ruben to fill in (mainly
-- the Kepp oxophilicity scale, which is paywalled and cannot be scraped, and a
-- handful of synthesis rows where metal_center and metal_source disagree).
--
-- APPLY WITH
-- ----------
--   python scripts/backup_database.py     (checkpoint first: this is a DDL migration)
--   docker exec -i alchemy_postgres psql -U alchemy_user -d alchemy_db \
--       < scripts/ddl_ml_reference_tables.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- element_properties: one row per element, properties that do NOT depend on
-- oxidation state or coordination number.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS element_properties (
    symbol                      VARCHAR(3) PRIMARY KEY,
    atomic_number               INTEGER NOT NULL,
    atomic_mass_u               DOUBLE PRECISION,

    period                      INTEGER,
    group_number                INTEGER,
    block                       VARCHAR(2),
    is_transition_metal         BOOLEAN,
    is_lanthanide               BOOLEAN,

    electronegativity_pauling   DOUBLE PRECISION,
    electronegativity_allen     DOUBLE PRECISION,

    ionization_energy_1_ev      DOUBLE PRECISION,
    electron_affinity_ev        DOUBLE PRECISION,
    absolute_hardness_ev        DOUBLE PRECISION,
    absolute_electroneg_ev      DOUBLE PRECISION,

    covalent_radius_pm          DOUBLE PRECISION,
    atomic_radius_pm            DOUBLE PRECISION,
    polarizability_a3           DOUBLE PRECISION,

    oxophilicity_kepp           DOUBLE PRECISION,   -- NULL until filled by hand, see doc above

    data_source                 VARCHAR(50) NOT NULL,
    loaded_at                   TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE element_properties IS
    'One row per element used as a metal_center in synthesis_experiments. Properties that belong to the element itself (electronegativity, hardness) rather than to a specific ion (see ion_properties). Populated by src/build_element_properties.py.';
COMMENT ON COLUMN element_properties.electronegativity_pauling IS
    'Pauling scale. Kept alongside the Allen scale because they order transition metals differently (see property_sources).';
COMMENT ON COLUMN element_properties.electronegativity_allen IS
    'Allen (spectroscopic) scale. Allen, JACS 1989.';
COMMENT ON COLUMN element_properties.absolute_hardness_ev IS
    'Pearson absolute hardness, eta = (IE1 - EA)/2. Base of HSAB reasoning.';
COMMENT ON COLUMN element_properties.absolute_electroneg_ev IS
    'Mulliken/Pearson absolute electronegativity, chi = (IE1 + EA)/2.';
COMMENT ON COLUMN element_properties.oxophilicity_kepp IS
    'Kepp (2016) oxophilicity scale, DOI 10.1021/acs.inorgchem.6b01702. Paywalled -- NULL until entered by hand from Table 2 of the paper. See methodology/PENDIENTE_ML_INPUTS_HUMANOS.md.';
COMMENT ON COLUMN element_properties.data_source IS
    'Which tool/table produced this row, e.g. mendeleev+pymatgen or manual_kepp_2016.';


-- -----------------------------------------------------------------------------
-- ion_properties: radius and charge depend on oxidation state AND coordination
-- number (Shannon 1976), so this is a separate table keyed on both, not a
-- column bolted onto element_properties.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ion_properties (
    symbol              VARCHAR(3) REFERENCES element_properties(symbol),
    oxidation_state     INTEGER NOT NULL,
    coordination_number INTEGER NOT NULL,
    spin_state          VARCHAR(10) NOT NULL DEFAULT '',  -- 'HS' | 'LS' | '' (no spin ambiguity for this ion)
    shannon_radius_pm   DOUBLE PRECISION,
    crystal_radius_pm   DOUBLE PRECISION,
    charge_over_radius  DOUBLE PRECISION,             -- z / r_shannon, a simple charge-density proxy
    data_source         VARCHAR(50) NOT NULL,
    PRIMARY KEY (symbol, oxidation_state, coordination_number, spin_state)
    -- spin_state defaults to '' rather than NULL because PostgreSQL forbids NULL
    -- in a primary-key column; '' reads as "no HS/LS distinction applies", which
    -- is true for every ion in this project (none of our 20 metals have a
    -- spin-crossover ambiguity at the states we use).
);

COMMENT ON TABLE ion_properties IS
    'Radius and charge density per (element, oxidation state, coordination number). Coordination number is pinned to 6 everywhere in this project (see roadmap SS3.4: the true CN is unknown before synthesis, and Shannon CN=6 radii are both the most tabulated and the ones that preserve relative ordering between metals).';
COMMENT ON COLUMN ion_properties.oxidation_state IS
    'Charge of the metal AS USED IN THE PRECURSOR SALT (e.g. Fe3+ from FeCl3), not the charge in the final MOF -- that is not known before synthesis. See metal_source_oxidation_state for how this is derived per synthesis, and roadmap SS3.3 for why that is the right modelling choice.';
COMMENT ON COLUMN ion_properties.shannon_radius_pm IS
    'Effective ionic radius, Shannon (1976), Acta Cryst A32, 751. Ionic (not crystal) radius, CN=6 unless unavailable.';
COMMENT ON COLUMN ion_properties.charge_over_radius IS
    'oxidation_state / shannon_radius_pm: a cheap, interpretable proxy for charge density / Lewis acidity.';


-- -----------------------------------------------------------------------------
-- metal_source_oxidation_state: bridges the free-text metal_source column in
-- synthesis_experiments to a specific row of ion_properties. One row per
-- DISTINCT metal_source string actually seen in the data (~45), not per
-- synthesis -- so this table doubles as a human-auditable list of every salt
-- formula ever used and what charge it was assumed to carry.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS metal_source_oxidation_state (
    metal_source     VARCHAR(100) PRIMARY KEY,
    symbol           VARCHAR(3),                 -- element actually implied by the formula
    oxidation_state  INTEGER,
    basis            VARCHAR(30) NOT NULL,        -- 'formula_charge_balance' | 'known_reagent' | 'human_review_pending'
    matches_metal_center BOOLEAN,                 -- FALSE flags a data-entry mismatch worth checking
    notes            TEXT
);

COMMENT ON TABLE metal_source_oxidation_state IS
    'Maps every distinct synthesis_experiments.metal_source string to the metal and oxidation state implied by its chemical formula. Deterministic where the formula is unambiguous (roadmap SS3.3, option 1); a handful of rows are flagged matches_metal_center=FALSE where metal_source disagrees with metal_center -- these are real data-entry questions, listed in methodology/PENDIENTE_ML_INPUTS_HUMANOS.md, not modelling choices.';
COMMENT ON COLUMN metal_source_oxidation_state.matches_metal_center IS
    'FALSE means the salt formula implies a different element than synthesis_experiments.metal_center for at least one row using this metal_source (e.g. metal_center=Mg but metal_source=Ni(NO3)2.6H2O). v_ml_features trusts metal_center for the join, but this flag exists so the mismatch is never silently invisible.';


-- -----------------------------------------------------------------------------
-- property_sources: not decoration. Every property above has more than one
-- possible scale/definition in the literature; this is where the DOI lives.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS property_sources (
    property_name       VARCHAR(60) PRIMARY KEY,
    source_citation      TEXT NOT NULL,
    source_doi           TEXT,
    scale_notes          TEXT
);

COMMENT ON TABLE property_sources IS
    'Citation + DOI for every property in element_properties/ion_properties/linker_properties. Exists because e.g. "electronegativity" alone is ambiguous (Pauling vs Allen give different orderings for transition metals) -- see roadmap SS3.1.';


-- -----------------------------------------------------------------------------
-- linker_properties: one row per linker_code, a HANDFUL of descriptors chosen
-- by a chemist, not RDKit's full descriptor list. Roadmap SS4.4: with only 6
-- linkers, more descriptors than molecules is a memorization trap, not signal.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS linker_properties (
    linker_code             VARCHAR(50) PRIMARY KEY,
    iupac_name              TEXT,
    common_name             TEXT,
    smiles                  TEXT,
    inchikey                VARCHAR(27),

    scaffold                VARCHAR(30) NOT NULL,      -- triazine_phosphonate | pyrene_phosphonate | polyphenol | pyrene_bare
    protection_state        VARCHAR(20) NOT NULL,      -- free_acid | ethyl_ester | none

    denticity               INTEGER,
    n_donor_atoms           INTEGER,
    n_acidic_protons        INTEGER,
    donor_group             VARCHAR(20),               -- phosphonate | phenol | none

    molecular_weight        DOUBLE PRECISION,
    n_aromatic_rings        INTEGER,
    max_donor_distance_a    DOUBLE PRECISION,
    tpsa                    DOUBLE PRECISION,
    clogp                   DOUBLE PRECISION,
    n_rotatable_bonds       DOUBLE PRECISION,

    computed_with            VARCHAR(50),
    notes                    TEXT
);

COMMENT ON TABLE linker_properties IS
    'One row per linker code used in synthesis_experiments.linker. scaffold + protection_state are the two independent axes hidden inside the 6 linker names (roadmap SS1.3/SS4.2): LIG-x/LIG-x are the same molecule as acid/ester, same for LIG-x/LIG-x. Populated by src/build_linker_properties.py from hand-verified SMILES -- see methodology/PENDIENTE_ML_INPUTS_HUMANOS.md for the one identification (LIG-x) that needs Ruben''s confirmation.';
COMMENT ON COLUMN linker_properties.max_donor_distance_a IS
    'Farthest distance between donor atoms in a UFF/MMFF-optimised 3D conformer. Proxy for linker "length", which drives pore size / accessible topology -- probably the single most informative linker descriptor (roadmap SS4.4).';


-- =============================================================================
-- data_dictionary coverage
-- =============================================================================
DELETE FROM data_dictionary WHERE table_name IN
    ('element_properties','ion_properties','metal_source_oxidation_state','property_sources','linker_properties');

INSERT INTO data_dictionary (table_name, column_name, full_name, section_name, unit, data_type, valid_categories, description) VALUES
('element_properties','symbol','Symbol','IDENTITY',NULL,'VARCHAR(3)',NULL,'Element symbol, PK. Matches synthesis_experiments.metal_center.'),
('element_properties','electronegativity_pauling','Electronegativity (Pauling)','CHEMISTRY',NULL,'DOUBLE PRECISION',NULL,'Pauling electronegativity scale.'),
('element_properties','electronegativity_allen','Electronegativity (Allen)','CHEMISTRY',NULL,'DOUBLE PRECISION',NULL,'Allen (spectroscopic) electronegativity scale; orders transition metals differently than Pauling.'),
('element_properties','absolute_hardness_ev','Absolute hardness','CHEMISTRY','eV','DOUBLE PRECISION',NULL,'Pearson hardness eta=(IE1-EA)/2.'),
('element_properties','oxophilicity_kepp','Oxophilicity (Kepp)','CHEMISTRY',NULL,'DOUBLE PRECISION',NULL,'Kepp (2016) oxophilicity scale. Manually entered, paper is paywalled.'),
('ion_properties','shannon_radius_pm','Shannon ionic radius','CHEMISTRY','pm','DOUBLE PRECISION',NULL,'Effective ionic radius, Shannon 1976, at the given oxidation state and coordination number (CN=6 throughout this project).'),
('ion_properties','oxidation_state','Oxidation state','CHEMISTRY',NULL,'INTEGER',NULL,'Charge of the metal in the precursor salt used for synthesis, not the charge in the resulting MOF.'),
('metal_source_oxidation_state','metal_source','Metal source formula','IDENTITY',NULL,'VARCHAR(100)',NULL,'Free-text precursor formula as recorded in synthesis_experiments.metal_source.'),
('metal_source_oxidation_state','matches_metal_center','Matches metal_center','QUALITY',NULL,'BOOLEAN',NULL,'FALSE flags a formula/metal_center disagreement worth reviewing by hand.'),
('linker_properties','linker_code','Linker code','IDENTITY',NULL,'VARCHAR(50)',NULL,'Matches synthesis_experiments.linker.'),
('linker_properties','scaffold','Scaffold','CHEMISTRY',NULL,'VARCHAR(30)','triazine_phosphonate | pyrene_phosphonate | polyphenol | pyrene_bare','Chemical core shared across acid/ester pairs.'),
('linker_properties','protection_state','Protection state','CHEMISTRY',NULL,'VARCHAR(20)','free_acid | ethyl_ester | none','Whether the acidic groups are free or protected as an ester (a pro-linker that must hydrolyse in situ).'),
('linker_properties','max_donor_distance_a','Max donor distance','CHEMISTRY','Angstrom','DOUBLE PRECISION',NULL,'Farthest distance between donor atoms in an optimised 3D conformer; proxy for linker length.')
ON CONFLICT (table_name, column_name) DO UPDATE SET
    full_name = EXCLUDED.full_name, section_name = EXCLUDED.section_name,
    unit = EXCLUDED.unit, data_type = EXCLUDED.data_type,
    valid_categories = EXCLUDED.valid_categories, description = EXCLUDED.description;


-- =============================================================================
-- v_ml_features: the feature table for machine learning, assembled at query
-- time. Roadmap SS5 -- never materialise these into synthesis_experiments.
-- =============================================================================
CREATE OR REPLACE VIEW v_ml_features AS
SELECT
    s.sample_code,
    -- grouping keys for validation ONLY (roadmap SS8) -- never feed these to a model
    s.hts_number, s.synthesis_date, s.metal_center, s.linker, s.metal_source,

    -- metal, as chemistry
    ep.electronegativity_pauling, ep.electronegativity_allen,
    ep.absolute_hardness_ev, ep.oxophilicity_kepp, ep.polarizability_a3,
    mso.oxidation_state, ip.shannon_radius_pm, ip.charge_over_radius,
    mso.matches_metal_center AS metal_source_is_consistent,

    -- linker, as chemistry
    lp.scaffold, lp.protection_state, lp.denticity, lp.n_acidic_protons,
    lp.max_donor_distance_a, lp.n_rotatable_bonds,

    -- process
    s.metal_conc_m, s.lm_ratio, s.temp_target_c, s.time_hours,
    s.heating_rate_c_min, s.cooling_rate_c_min,
    s.total_volume_ml, s.reactor_volume_ml,
    s.total_volume_ml / NULLIF(s.reactor_volume_ml, 0) AS fill_fraction,

    -- solvent as composition (fractions, not absolute mL)
    s.h2o_total_ml / NULLIF(s.total_volume_ml, 0) AS frac_h2o,
    s.meoh_ml      / NULLIF(s.total_volume_ml, 0) AS frac_meoh,
    s.etoh_ml      / NULLIF(s.total_volume_ml, 0) AS frac_etoh,
    s.dmf_ml       / NULLIF(s.total_volume_ml, 0) AS frac_dmf,

    -- modulators, aggregated by chemical role (roadmap SS7.1)
    COALESCE(s.formic_acid_mmol, 0) + COALESCE(s.acetic_acid_mmol, 0)
      + COALESCE(s.propionic_acid_mmol, 0)                          AS mod_carboxylic_mmol,
    COALESCE(s.hcl_active_mmol, 0) + COALESCE(s.hf_active_mmol, 0)
      + COALESCE(s.tfa_mmol, 0) + COALESCE(s.cf3so3h_mmol, 0)       AS mod_strong_acid_mmol,
    COALESCE(s.koh_active_mmol, 0) + COALESCE(s.triethylamine_mmol, 0) AS mod_base_mmol
FROM synthesis_experiments s
LEFT JOIN linker_properties             lp  ON lp.linker_code = s.linker
LEFT JOIN metal_source_oxidation_state  mso ON mso.metal_source = s.metal_source
LEFT JOIN element_properties            ep  ON ep.symbol = s.metal_center
LEFT JOIN ion_properties                ip  ON ip.symbol = mso.symbol
                                            AND ip.oxidation_state = mso.oxidation_state
                                            AND ip.coordination_number = 6
WHERE s.synthesis_type NOT IN ('REFERENCE', 'PENDING_RECORD');

COMMENT ON VIEW v_ml_features IS
    'Feature table for machine learning, assembled at query time from synthesis_experiments joined against the ML reference tables. metal_center/linker/hts_number/synthesis_date are included ONLY for grouping in validation (roadmap SS8), never as model inputs. Join pxrd_labels (by matching characterization_measurements.sample_code) and pxrd_descriptors separately to get the target variable and PXRD-derived features.';
