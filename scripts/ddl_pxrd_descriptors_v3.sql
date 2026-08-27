-- =============================================================================
-- ALCheMy - pxrd_descriptors v3.0
-- Amorphous content measured against the empty instrument
-- =============================================================================
--
-- WHY THIS MIGRATION EXISTS
-- -------------------------
-- v2.0 estimated the amorphous halo with a running median over the arPLS-corrected
-- profile, separating "broad" from "narrow" by width. Checked against the 1,881
-- patterns the lab owner had classified by eye, that estimate is wrong at both ends:
--
--   * Patterns labelled CRISTALINO came out ~50% amorphous. Between the reflections
--     the corrected signal is flat at 0.00-0.08% of the peak maximum, so there is no
--     halo there. Peaks plus flanks cover 41-46% of the axis, so a 3 degree window
--     centred on a cluster holds a majority of raised points and the median climbs
--     onto the flanks. 71% of the reported halo area came from under the peaks.
--   * Patterns labelled AMORFO kept a halo of 0.76 sigma - below the counting noise.
--     arPLS had already absorbed it: a 5-15 degree hump is smooth enough for a
--     baseline estimator to treat as baseline.
--
-- The empty holder settles it. Its arPLS baseline is straight to 0.0 sigma while real
-- samples curve by 3.8-23 sigma, so the instrument contributes no curvature and every
-- bit of it belongs to the sample - which arPLS was discarding as background.
--
-- v3.0 therefore defines:      amorphous = (what arPLS removes) - (the empty instrument)
--
-- Validated against the hand labels: CRISTALINO 0.012, INCIPIENTE 0.043-0.080,
-- AMORFO 0.287, blank against itself 0.031. Within the incipient subtypes the ordering
-- also holds: HALO_DOMINANTE 0.215 > PICOS_ANCHOS 0.153 > CRISTALITO_PEQUENO 0.084.
--
-- SAFETY
-- ------
-- Additive only. No column is dropped or renamed, no row is deleted, and pxrd_labels
-- is not touched. The v2.0 columns stay: crystalline_fraction still ranks patterns
-- usefully even though its two ends are artefacts, and dropping it would break the
-- 299 rows already written.
-- =============================================================================

BEGIN;

-- 1. New columns -------------------------------------------------------------
ALTER TABLE pxrd_descriptors
    ADD COLUMN IF NOT EXISTS amorphous_fraction_blank   DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS crystalline_fraction_blank DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS blank_scale_factor         DOUBLE PRECISION;

-- 2. Native comments, so pgAdmin documents itself -----------------------------
COMMENT ON COLUMN pxrd_descriptors.amorphous_fraction_blank IS
    'Fraction of the pattern that is diffuse rather than Bragg scattering, measured as '
    '(arPLS baseline - scaled empty-instrument scan) / total area. This is the v3.0 '
    'headline number and supersedes 1 - crystalline_fraction. Counts ALL non-Bragg '
    'intensity: amorphous material, thermal and defect diffuse scattering, Fe '
    'fluorescing under Cu radiation, and the sample mount. Comparative within a corpus '
    'mounted the same way; never an absolute percentage of amorphous material.';

COMMENT ON COLUMN pxrd_descriptors.crystalline_fraction_blank IS
    '1 - amorphous_fraction_blank. The v3.0 crystallinity, referenced to the empty '
    'instrument instead of to a width assumption. Median by hand-assigned class: '
    'CRISTALINO 0.988, INCIPIENTE 0.920, AMORFO 0.709.';

COMMENT ON COLUMN pxrd_descriptors.blank_scale_factor IS
    'Multiplier applied to the empty-instrument scan to put it on this measurement''s '
    'counting scale, taken from the median ratio above 45 degrees 2-theta. Needed '
    'because time-per-step is not recorded in the .xrdml headers, so raw counts are '
    'not directly comparable between the blank and a sample.';

-- 3. Dictionary rows, so the web app and the RAG agent can read the schema ------
INSERT INTO data_dictionary
    (table_name, column_name, full_name, section_name, unit, data_type, valid_categories, description)
VALUES
('pxrd_descriptors', 'amorphous_fraction_blank', 'Amorphous fraction (blank-referenced)',
 'PHASES', 'fraction', 'DOUBLE PRECISION', '0 - 1',
 'Diffuse (non-Bragg) content, measured as the arPLS baseline minus the scaled empty-instrument scan. Supersedes the width-based estimate. Includes diffuse scattering, fluorescence and the mount, not only amorphous material.'),
('pxrd_descriptors', 'crystalline_fraction_blank', 'Crystalline fraction (blank-referenced)',
 'PHASES', 'fraction', 'DOUBLE PRECISION', '0 - 1',
 'One minus amorphous_fraction_blank. The v3.0 crystallinity. Validated against 1,881 hand-labelled patterns.'),
('pxrd_descriptors', 'blank_scale_factor', 'Blank scale factor',
 'TRACEABILITY', 'dimensionless', 'DOUBLE PRECISION', '> 0',
 'Multiplier putting the empty-instrument scan on this measurement''s counting scale, from the median ratio above 45 degrees.')
ON CONFLICT (table_name, column_name) DO UPDATE
SET full_name      = EXCLUDED.full_name,
    section_name   = EXCLUDED.section_name,
    unit           = EXCLUDED.unit,
    data_type      = EXCLUDED.data_type,
    valid_categories = EXCLUDED.valid_categories,
    description    = EXCLUDED.description;

-- 4. Amend the v2.0 comment rather than pretending it was right ----------------
COMMENT ON COLUMN pxrd_descriptors.crystalline_fraction IS
    'v2.0 crystallinity, from a width-selective running median. SUPERSEDED by '
    'crystalline_fraction_blank: this estimate is inflated on crystalline patterns '
    '(peak flanks raise the running median) and meaningless on amorphous ones (arPLS '
    'had already removed the halo). Retained because it still ranks patterns in the '
    'right order and the earlier rows were computed with it.';

COMMIT;

-- Verification (run separately):
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'pxrd_descriptors' AND column_name LIKE '%blank%';
--   SELECT COUNT(*) FROM data_dictionary WHERE table_name = 'pxrd_descriptors';
