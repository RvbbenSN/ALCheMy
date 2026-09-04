-- ===========================================================================
-- ALCheMy - delta migration: pxrd_descriptors, pipeline v1.0 -> v2.0
-- ===========================================================================
--
-- WHY A SECOND FILE INSTEAD OF EDITING THE FIRST ONE
-- --------------------------------------------------
-- scripts/init_db.sql only ever runs when the postgres_data volume is created,
-- and ddl_pxrd_descriptors.sql has already been applied to the live database.
-- Editing an applied migration makes the file lie about what the database
-- contains. Every schema change from here on gets its own idempotent file, so
-- the order of application stays readable and re-running is always safe.
--
-- WHAT CHANGED IN THE PIPELINE AND WHY THE SCHEMA HAS TO FOLLOW
-- -------------------------------------------------------------
-- 1. LOW-ANGLE CUTOFF 3 deg -> 5 deg.
--    Below ~4.5 deg the detector records the tail of the direct/air-scattered
--    beam, not diffraction from the specimen. Measured, not assumed: the median
--    of 200 random scans sits at 3.80x its own high-angle level at 3.0 deg and
--    only flattens at ~4.4 deg, and all 11 precursor references - metal salts
--    and free ligands, none with a MOF-sized cell - show the same tail. A
--    monotonic rise shared by 200 chemically different materials is the
--    instrument, not the sample.
--
--    Consequence: the running median read that tail as a giant amorphous halo
--    pinned at the very start of the grid. On 149 re-processed measurements the
--    crystalline fraction rose in 100% of them, median +0.26 and up to +0.64,
--    and amorphous_hump_center moved from a suspicious ~3.9 deg to a physically
--    sensible 13-24 deg. Any v1.0 value of crystalline_fraction,
--    amorphous_hump_center or d_max_angstrom was measuring the beam, so v1.0
--    rows are deleted rather than kept alongside v2.0 ones.
--
-- 2. LOW-ANGLE WINDOW 10 deg -> 15 deg (column rename).
--    These are phosphonate MOFs: dense, weakly porous, but with large cells
--    because the linkers carry large cores, and with large, low-symmetry
--    asymmetric units. Their most characteristic and most intense reflections
--    routinely fall between 10 and 15 deg, so a 10 deg window cut the
--    diagnostic region in half.
--
-- 3. NEW COLUMNS: d_max_saturated, signal_snr_area, crystallinity_reliable.
--    Two silent failure modes are now recorded instead of being invisible:
--    a first reflection sitting on the cutoff (d_max is then a lower bound, not
--    a measurement), and a pattern with too little diffracted intensity for the
--    halo/peak split to mean anything. The empty holder scores 0.07 on
--    signal_snr_area against 3-5 for a normal sample; without the flag it was
--    reported as 89% crystalline.
--
-- Apply with:
--   docker exec -i alchemy_postgres psql -U alchemy_user -d alchemy_db \
--     < scripts/ddl_pxrd_descriptors_v2.sql
-- ===========================================================================

BEGIN;

-- --- 1. renames (idempotent: only if the old name is still there) ----------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'pxrd_descriptors'
                 AND column_name = 'n_peaks_below_10deg') THEN
        ALTER TABLE pxrd_descriptors
            RENAME COLUMN n_peaks_below_10deg TO n_peaks_below_15deg;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'pxrd_descriptors'
                 AND column_name = 'frac_intensity_below_10deg') THEN
        ALTER TABLE pxrd_descriptors
            RENAME COLUMN frac_intensity_below_10deg TO frac_intensity_below_15deg;
    END IF;
END $$;

-- --- 2. new columns -------------------------------------------------------
ALTER TABLE pxrd_descriptors
    ADD COLUMN IF NOT EXISTS d_max_saturated        BOOLEAN,
    ADD COLUMN IF NOT EXISTS signal_snr_area        DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS crystallinity_reliable BOOLEAN;

-- --- 3. column documentation (native COMMENT: pgAdmin shows it inline) -----
COMMENT ON COLUMN pxrd_descriptors.n_peaks_below_15deg IS
    'Reflections below 15 deg 2-theta (d > 5.90 A). Large-cell indicator. 15 deg '
    'and not 10 because in phosphonate MOFs the most characteristic and intense '
    'reflections routinely fall between 10 and 15 deg. A high value suggests a '
    'POTENTIALLY porous framework: in this family a large cell comes from large '
    'linker cores and large low-symmetry asymmetric units, and does not by '
    'itself imply accessible porosity - only gas adsorption settles that.';

COMMENT ON COLUMN pxrd_descriptors.frac_intensity_below_15deg IS
    'Fraction of the area-normalised pattern lying below 15 deg 2-theta. '
    'Needs no peak detection, so it stays meaningful on a fully amorphous '
    'sample where n_peaks_below_15deg is zero.';

COMMENT ON COLUMN pxrd_descriptors.d_max_angstrom IS
    'Largest interplanar spacing observed, from Bragg on the first reflection. '
    'Capped at 17.66 A by the 5 deg cutoff - see d_max_saturated.';

COMMENT ON COLUMN pxrd_descriptors.d_max_saturated IS
    'TRUE when the first reflection sits on the 5 deg cutoff, so d_max_angstrom '
    'is a LOWER BOUND, not a measurement: the real largest spacing may be bigger '
    'and outside this diffractometer''s window. Filter these out before using '
    'd_max_angstrom as a feature, or the model learns an instrument limit.';

COMMENT ON COLUMN pxrd_descriptors.signal_snr_area IS
    'Integrated diffracted signal divided by integrated Poisson counting noise. '
    'Says whether the pattern contains a measurement at all. Empirical anchors: '
    'the empty holder scores 0.07, a normal sample 3-5. Drives '
    'crystallinity_reliable.';

COMMENT ON COLUMN pxrd_descriptors.crystallinity_reliable IS
    'TRUE when signal_snr_area >= 1.0. When FALSE there is too little diffracted '
    'intensity for the halo/peak split to be a measurement, and '
    'crystalline_fraction must not be used - it is still stored so the decision '
    'stays auditable. In this corpus the unreliable rows have ~4x fewer counts '
    '(median raw_counts_max 1066 vs 4087): they are near-empty HTS wells, not a '
    'processing failure.';

COMMENT ON COLUMN pxrd_descriptors.crystalline_fraction IS
    'Xc = A_crystalline / (A_crystalline + A_amorphous), both areas measured on '
    'the area-normalised, background-free profile. The narrow component is gated '
    'at k*sigma (counting noise is narrow and would otherwise be counted as '
    'crystalline) and the halo has its arPLS pedestal removed. ALWAYS read '
    'together with crystallinity_reliable.';

COMMENT ON COLUMN pxrd_descriptors.spectral_entropy IS
    'Shannon entropy of the net pattern as a probability distribution: how '
    'spread out the diffracted intensity is. Measured over 169 reliable patterns '
    'it correlates -0.73 with crystalline_fraction, i.e. crystalline samples '
    'concentrate intensity into few reflections (low entropy) and amorphous ones '
    'spread it over a broad halo (high entropy).';

COMMENT ON COLUMN pxrd_descriptors.pipeline_version IS
    'Version of src/pxrd_descriptors.py that produced the row. v1.0 processed '
    'from 3 deg and measured the direct-beam tail as an amorphous halo; v2.0 '
    'cuts at 5 deg, gates the narrow component at k*sigma and removes the halo '
    'pedestal. Rows from different versions are NOT comparable - always filter '
    'on this column before aggregating.';

-- --- 4. data_dictionary rows ---------------------------------------------
INSERT INTO data_dictionary
    (table_name, column_name, full_name, section_name, unit, data_type, description)
VALUES
 ('pxrd_descriptors','n_peaks_below_15deg','Peaks Below 15 deg','PEAK GEOMETRY','count','INTEGER',
  'Reflections below 15 deg 2-theta (d > 5.90 A). Large-cell indicator; suggests a POTENTIALLY porous framework, never porosity by itself.'),
 ('pxrd_descriptors','frac_intensity_below_15deg','Fraction Intensity Below 15 deg','PHASE COMPOSITION','fraction','DOUBLE PRECISION',
  'Fraction of normalised intensity below 15 deg 2-theta. Works without peak detection, so it survives on amorphous samples.'),
 ('pxrd_descriptors','d_max_saturated','d-max Saturated','PEAK GEOMETRY',NULL,'BOOLEAN',
  'TRUE when the first reflection sits on the 5 deg cutoff: d_max_angstrom is then a lower bound, not a measurement.'),
 ('pxrd_descriptors','signal_snr_area','Integrated Signal-to-Noise','QUALITY','ratio','DOUBLE PRECISION',
  'Integrated diffracted signal in units of integrated counting noise. Empty holder 0.07, normal sample 3-5.'),
 ('pxrd_descriptors','crystallinity_reliable','Crystallinity Reliable','QUALITY',NULL,'BOOLEAN',
  'TRUE when signal_snr_area >= 1.0. When FALSE, crystalline_fraction is not a measurement and must not be used.')
ON CONFLICT (table_name, column_name) DO UPDATE
    SET data_type = EXCLUDED.data_type,
        description = EXCLUDED.description;

DELETE FROM data_dictionary
 WHERE table_name = 'pxrd_descriptors'
   AND column_name IN ('n_peaks_below_10deg', 'frac_intensity_below_10deg');

-- --- 5. drop the v1.0 rows ------------------------------------------------
-- They were computed on the 3 deg grid, so their crystalline_fraction,
-- amorphous_hump_center and d_max_angstrom describe the direct beam. Keeping
-- them next to v2.0 rows would silently mix two incompatible generations.
-- pxrd_labels is deliberately NOT touched: labels are expensive human judgement
-- and must survive every recomputation of the descriptors.
DELETE FROM pxrd_descriptors WHERE pipeline_version = 'v1.0';

COMMIT;

-- Verification:
--   SELECT pipeline_version, count(*) FROM pxrd_descriptors GROUP BY 1;
--   SELECT count(*) FROM data_dictionary WHERE table_name = 'pxrd_descriptors';
