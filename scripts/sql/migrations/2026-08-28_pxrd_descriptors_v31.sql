-- =============================================================================
-- ALCheMy - pxrd_descriptors v3.1
-- The blank is smoothed before it is subtracted
-- =============================================================================
--
-- WHY
-- ---
-- v3.0 subtracted the empty-instrument scan from the arPLS baseline using the blank's
-- RAW counts. The blank is a low-count scan (median ~80 counts), so its relative
-- counting noise is large; scaling it up to the sample's level amplified that noise and
-- carried it straight into the amorphous estimate. The figure showed it plainly: the
-- scaled blank drowned the sample's own signal.
--
-- Both sides of the subtraction have to describe the same kind of object - a smooth
-- background - so the blank now contributes its own arPLS baseline instead of its raw
-- counts. Measured on the three reference patterns:
--
--   class          A (raw blank)   A (smoothed)   roughness drop
--   AMORFO             0.3030         0.3033           73x
--   INCIPIENTE         0.0935         0.0889          100x
--   CRISTALINO         0.0119         0.0006          966x
--
-- The crystalline case is the diagnostic one: that 0.0119 was the scaled blank's noise,
-- not diffuse scattering from the sample. Separation between the AMORFO and CRISTALINO
-- classes, against the hand labels, goes from 21x to 344x.
--
-- NOTE ON NORMALISATION
-- ---------------------
-- Working on un-normalised counts gives identical results: the descriptor is a ratio, so
-- any global scale factor cancels. Verified on the three reference patterns - 0.3030 /
-- 0.0935 / 0.0119 either way, to four decimals. Normalisation was never the problem; the
-- blank's counting noise was.
--
-- SAFETY
-- ------
-- No schema change: the v3.0 columns already exist. Only the values change, so the rows
-- have to be recomputed - the notebook does that in section 12. pxrd_labels is not
-- touched.
-- =============================================================================

BEGIN;

COMMENT ON COLUMN pxrd_descriptors.amorphous_fraction_blank IS
    'Fraction of the pattern that is diffuse rather than Bragg scattering, measured as '
    '(arPLS baseline - scaled empty-instrument baseline) / total area. Since v3.1 the '
    'blank contributes its own arPLS baseline rather than its raw counts, so its '
    'counting noise no longer leaks into the estimate. Counts ALL non-Bragg intensity: '
    'amorphous material, thermal and defect diffuse scattering, Fe fluorescing under Cu '
    'radiation, and the sample mount. Comparative within a corpus mounted the same way; '
    'never an absolute percentage of amorphous material. Median by hand-assigned class: '
    'CRISTALINO 0.001, INCIPIENTE 0.056, AMORFO 0.236.';

-- Rows computed with v3.0 carry the noisy estimate and must not be mixed with v3.1 ones.
DELETE FROM pxrd_descriptors WHERE pipeline_version = 'v3.0';

COMMIT;

-- Verification (run separately):
--   SELECT pipeline_version, COUNT(*), ROUND(AVG(amorphous_fraction_blank)::numeric, 4)
--     FROM pxrd_descriptors GROUP BY 1;
