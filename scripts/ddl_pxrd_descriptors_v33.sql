-- =============================================================================
-- ALCheMy - pxrd_descriptors v3.3
-- Peak detection corrected for multiple comparisons
-- =============================================================================
--
-- WHY
-- ---
-- Up to v3.2 a reflection was accepted when its prominence cleared 3 sigma of the
-- measurement's own counting noise. Three sigma is the 99.73% level FOR ONE TEST,
-- and scanning a diffractogram is not one test: the detector examines every
-- candidate bump along the pattern. With ~2250 points and a 0.2 deg minimum
-- separation there are ~225 independent opportunities for noise to make a bump,
-- so several clear a 3-sigma bar by chance in every single scan.
--
-- Measured on this instrument by Monte Carlo - the smooth part of a real scan
-- (arPLS baseline + halo, which by construction contains no reflection) redrawn
-- with Poisson noise:
--
--     k          false peaks per scan
--     3                  4.6
--     4                  0.1
--     5                  0.0
--
-- On RS1765, a pattern Ruben labelled AMORFO, the detector reported 8 peaks; ~5
-- of them were noise. Worse than the count: `two_theta_first_peak`, `d_max`,
-- the widths and Scherrer were all read off that set, i.e. a d-spacing measured
-- on a noise spike.
--
-- THE CORRECTION
-- --------------
-- v3.3 fixes the expected number of FALSE peaks per scan (0.05) instead of fixing
-- k, and derives k from the length of the scan:
--
--     k = sqrt(2) * Phi^-1(1 - alpha / (2 * n_eff)),  n_eff = n_points / min_dist_pts
--
-- The sqrt(2) is there because a prominence is a difference between two noisy
-- quantities. On this laboratory's scans that gives k = 5.07 to 5.22 - exactly
-- where the Monte Carlo independently puts the false-peak count at zero.
--
-- Fixing the error RATE rather than k is what makes measurements comparable: a
-- longer scan gets more chances to fail, so it must be held to a higher bar to
-- carry the same risk. A single hand-tuned number could not do that.
--
-- EFFECT on 1,852 hand-labelled patterns (median peaks per class):
--
--     class          v3.2 (k=3)     v3.3 (calibrated)
--     AMORFO              2.0              0.0
--     INCIPIENTE         15.0              8.0
--     CRISTALINO         22.0             19.0
--
-- Share of AMORFO patterns credited with >= 3 reflections: 0.47 -> 0.11.
-- Share of CRISTALINO: 0.99 -> 0.98. The correction removes noise, not signal.
--
-- SCHEMA CHANGE
-- -------------
-- `n_peaks_k5` held a count at a fixed k = 5. It becomes `n_peaks`, the primary
-- count at the calibrated threshold, and it is what every peak-derived descriptor
-- is now read from. `n_peaks_k3` stays, deliberately: the GAP between the two is
-- informative - many k=3 peaks and no calibrated ones means noise, agreement
-- between them means genuine crystallinity.
--
-- SAFETY
-- ------
-- A rename, so no data is lost. The values still have to be recomputed, since
-- every peak-derived descriptor changes; the notebook does that in section 12.
-- pxrd_labels is not touched.
-- =============================================================================

BEGIN;

ALTER TABLE pxrd_descriptors RENAME COLUMN n_peaks_k5 TO n_peaks;

COMMENT ON COLUMN pxrd_descriptors.n_peaks IS
    'Number of Bragg reflections accepted at the multiple-comparison-corrected '
    'threshold: prominence above k * (Poisson noise of this scan), with k derived '
    'from the scan length so that at most 0.05 false reflections are expected per '
    'measurement (k = 5.07-5.22 on this instrument). THE primary peak count, and '
    'the set from which two_theta_first_peak, d_max_angstrom, fwhm_* and '
    'scherrer_size_nm are read. Median by hand-assigned class: AMORFO 0, '
    'INCIPIENTE 8, CRISTALINO 19.';

COMMENT ON COLUMN pxrd_descriptors.n_peaks_k3 IS
    'Same detector at a fixed 3 sigma - the level appropriate to a SINGLE test, '
    'not to a search over a whole pattern. Kept because the gap against n_peaks '
    'is informative: many peaks here and none there means counting noise, '
    'agreement between the two means genuine crystallinity. On its own it '
    'overcounts badly - 47% of hand-labelled AMORFO patterns get 3 or more '
    'reflections, against 11% under n_peaks. Not to be used as a peak count.';

COMMENT ON COLUMN pxrd_descriptors.peak_sigma_k IS
    'The k actually applied to this measurement, derived from its length by '
    'peak_k_sigma(). Recorded rather than assumed, because it varies between '
    'scans by design: holding the false-peak RATE constant is what makes scans '
    'of different length comparable.';

-- Rows from earlier pipeline versions carry a different peak definition.
DELETE FROM pxrd_descriptors WHERE pipeline_version IN ('v3.0', 'v3.1', 'v3.2');

COMMIT;

-- Verification (run separately):
--   SELECT pipeline_version, COUNT(*), ROUND(AVG(n_peaks)::numeric, 1)
--     FROM pxrd_descriptors GROUP BY 1;

-- ---------------------------------------------------------------------------
-- data_dictionary: the schema documentation as queryable rows, kept in step
-- with the native COMMENTs above so the web app and the AI agents read the same
-- definitions the database carries.
-- ---------------------------------------------------------------------------

BEGIN;

UPDATE data_dictionary
   SET column_name = 'n_peaks',
       description = 'Reflections accepted at the multiple-comparison-corrected threshold '
                     '(k derived from scan length, 5.07-5.22 here, for <=0.05 expected false '
                     'peaks per scan). The primary peak count; every peak-derived descriptor '
                     'is read from this set. Median by class: AMORFO 0, INCIPIENTE 8, '
                     'CRISTALINO 19.'
 WHERE table_name = 'pxrd_descriptors' AND column_name = 'n_peaks_k5';

UPDATE data_dictionary
   SET description = 'The same detector at a fixed 3 sigma - the level for a SINGLE test, not '
                     'for a search over a whole pattern. Kept as the term of comparison against '
                     'n_peaks, not as a peak count: on its own it credits 47% of hand-labelled '
                     'AMORFO patterns with 3 or more reflections.'
 WHERE table_name = 'pxrd_descriptors' AND column_name = 'n_peaks_k3';

UPDATE data_dictionary
   SET description = 'The sigma multiplier actually applied to this measurement, derived from '
                     'its length. Recorded rather than assumed: it varies between scans by '
                     'design, because holding the false-peak RATE constant is what makes scans '
                     'of different length comparable.'
 WHERE table_name = 'pxrd_descriptors' AND column_name = 'peak_sigma_k';

COMMIT;
