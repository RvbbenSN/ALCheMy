-- =============================================================================
-- ALCheMy - pxrd_descriptors v3.2
-- The amorphous fraction is referenced to what the SAMPLE scattered
-- =============================================================================
--
-- WHY
-- ---
-- v3.1 divided the diffuse area by the TOTAL integrated area of the scan, which includes
-- the instrumental background. Two consequences, both wrong:
--
--   * `crystalline_fraction_blank`, defined as 1 - the fraction, counted the instrument
--     background as crystalline. On SMP-0005 the phase panel of the anatomy figure showed
--     9% crystalline area while the column read 0.757.
--   * The value depended on how much instrumental background happened to sit under the
--     pattern, which varies with exposure time and mount - so it was less comparable
--     between measurements, not more.
--
-- v3.2 divides by everything the SPECIMEN scattered, diffuse plus Bragg:
--
--     amorphous_fraction_blank = integral(A) / [ integral(A) + integral(I - B) ]
--
-- The number now answers "of what this sample scattered, how much was not Bragg", and
-- its complement is genuinely the crystalline fraction.
--
-- EFFECT ON THE VALUES (median by hand-assigned class, 134 labelled patterns)
--
--   class          v3.1 (A/total)   v3.2 (A/sample)
--   AMORFO             0.236            0.930
--   INCIPIENTE         0.154            0.347
--   CRISTALINO         0.001            0.011
--
-- The v3.1 separation looked larger (344x vs 84x) only because its crystalline value was
-- diluted by a denominator dominated by instrument background. The subtypes discriminate
-- markedly better under v3.2:
--
--   subtype                 v3.1     v3.2
--   HALO_DOMINANTE          0.273    0.910
--   PICOS_ANCHOS            0.245    0.748
--   CRISTALITO_PEQUENO      0.242    0.608
--
-- Under v3.1 the three overlapped almost completely; under v3.2 they separate.
--
-- SAFETY
-- ------
-- No schema change. Only the values change, so the rows must be recomputed - the
-- notebook does that in section 12. pxrd_labels is not touched.
-- =============================================================================

BEGIN;

COMMENT ON COLUMN pxrd_descriptors.amorphous_fraction_blank IS
    'Of everything this specimen scattered, the fraction that was diffuse rather than '
    'Bragg: integral(A) / [integral(A) + integral(I - B)], where A is the arPLS baseline '
    'minus the scaled empty-instrument baseline. The denominator deliberately excludes '
    'the instrumental background, so the value does not depend on exposure or mount. '
    'Counts ALL non-Bragg intensity from the sample: amorphous material, thermal and '
    'defect diffuse scattering, Fe fluorescing under Cu radiation, and the sample '
    'support. Comparative within a corpus mounted the same way; never an absolute '
    'percentage of amorphous material. Median by hand-assigned class: CRISTALINO 0.011, '
    'INCIPIENTE 0.347, AMORFO 0.930.';

COMMENT ON COLUMN pxrd_descriptors.crystalline_fraction_blank IS
    'One minus amorphous_fraction_blank. Since v3.2 this is genuinely the crystalline '
    'fraction of what the sample scattered - under v3.1 it also counted the instrumental '
    'background as crystalline.';

-- Rows from earlier pipeline versions carry a different definition and must not be mixed.
DELETE FROM pxrd_descriptors WHERE pipeline_version IN ('v3.0', 'v3.1');

COMMIT;

-- Verification (run separately):
--   SELECT pipeline_version, COUNT(*), ROUND(AVG(amorphous_fraction_blank)::numeric, 4)
--     FROM pxrd_descriptors GROUP BY 1;
