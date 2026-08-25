-- =============================================================================
-- ALCheMy - PXRD descriptor & label tables (delta migration)
-- =============================================================================
-- Specified by methodology/ROADMAP_PXRD_CRISTALINIDAD_Y_ML.md, section 9
-- ("Esquema de la tabla nueva"), stage E0.
--
-- WHY THIS IS A SEPARATE FILE AND NOT AN EDIT TO init_db.sql
-- ---------------------------------------------------------
-- scripts/init_db.sql only ever runs on the FIRST creation of the postgres_data
-- volume. The database is already live with 2,160 syntheses and thousands of
-- measurements, so init_db.sql will never run again on it. Schema changes from
-- here on are delta migrations applied by hand, and keeping each delta in its
-- own file makes it obvious what was applied, in what order, and lets the same
-- file be replayed on a fresh volume after init_db.sql.
--
-- Apply with:
--   docker exec -i alchemy_postgres psql -U alchemy_user -d alchemy_db \
--       < scripts/ddl_pxrd_descriptors.sql
--
-- The whole file is idempotent (IF NOT EXISTS / ON CONFLICT), so re-running it
-- is safe and never destroys computed descriptors.
--
-- ONE DEVIATION FROM THE ROADMAP DDL, DELIBERATE
-- ----------------------------------------------
-- The roadmap draft wrote `measurement_id INTEGER REFERENCES
-- characterization_measurements(id)`. Both halves of that are wrong against the
-- live schema: the real primary key is named `measurement_id`, not `id`, and it
-- is a UUID, not an INTEGER. Copying the draft verbatim would fail to create the
-- table at all. The corrected foreign key is used below.
-- =============================================================================


-- =============================================================================
-- TABLE 1/2: pxrd_descriptors
-- =============================================================================
-- One row per PXRD measurement = the canonical descriptor vector of the roadmap,
-- section "Etapa 3 — El vector de descriptores".
--
-- The point of this table is to turn a 2,350-point curve into a handful of
-- numbers a chemist can read, so the measurement becomes something you can sort,
-- filter, plot against synthesis conditions, and eventually feed to a model.
-- The curve itself stays where it already lives (characterization_measurements.
-- data_json); nothing here duplicates it.
-- =============================================================================

CREATE TABLE IF NOT EXISTS pxrd_descriptors (
    -- Identity: one descriptor row per measurement, deleted with it.
    measurement_id              UUID PRIMARY KEY
                                REFERENCES characterization_measurements(measurement_id)
                                ON DELETE CASCADE,
    sample_code                 VARCHAR(50) NOT NULL,

    -- -------------------------------------------------------------------------
    -- Traceability of the computation.
    -- Not bureaucracy: when these descriptors are recomputed in three months
    -- with a different lambda, these four columns are the ONLY thing that says
    -- which rows are comparable to which. Same principle as audit_log.
    -- -------------------------------------------------------------------------
    pipeline_version            VARCHAR(20)      NOT NULL,
    baseline_method             VARCHAR(30)      NOT NULL,
    baseline_lambda             DOUBLE PRECISION,
    broad_width_deg             DOUBLE PRECISION,
    peak_sigma_k                DOUBLE PRECISION,

    -- -------------------------------------------------------------------------
    -- Peaks (Bragg reflections)
    -- -------------------------------------------------------------------------
    n_peaks_k3                  INTEGER,
    n_peaks_k5                  INTEGER,
    n_peaks_below_10deg         INTEGER,
    two_theta_first_peak        DOUBLE PRECISION,
    d_max_angstrom              DOUBLE PRECISION,
    fwhm_median_deg             DOUBLE PRECISION,
    fwhm_min_deg                DOUBLE PRECISION,
    scherrer_size_nm            DOUBLE PRECISION,

    -- -------------------------------------------------------------------------
    -- Areas and phase split (two-phase deconvolution, roadmap step 1.3)
    -- -------------------------------------------------------------------------
    crystalline_fraction        DOUBLE PRECISION,
    crystalline_area            DOUBLE PRECISION,
    amorphous_area              DOUBLE PRECISION,
    amorphous_hump_center       DOUBLE PRECISION,
    amorphous_hump_fwhm         DOUBLE PRECISION,
    frac_intensity_below_10deg  DOUBLE PRECISION,
    peak_to_background_ratio    DOUBLE PRECISION,

    -- -------------------------------------------------------------------------
    -- Global metrics (no peak detection involved)
    -- -------------------------------------------------------------------------
    spectral_entropy            DOUBLE PRECISION,
    snr_global                  DOUBLE PRECISION,
    raw_counts_max              DOUBLE PRECISION,

    -- -------------------------------------------------------------------------
    -- Unsupervised phase weights, filled later by stage E3 (NMF over the whole
    -- matrix). Left NULL by the deterministic descriptor pass.
    -- -------------------------------------------------------------------------
    nmf_weights                 JSONB,

    computed_at                 TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pxrd_desc_sample      ON pxrd_descriptors(sample_code);
CREATE INDEX IF NOT EXISTS idx_pxrd_desc_dmax        ON pxrd_descriptors(d_max_angstrom);
CREATE INDEX IF NOT EXISTS idx_pxrd_desc_xc          ON pxrd_descriptors(crystalline_fraction);
CREATE INDEX IF NOT EXISTS idx_pxrd_desc_version     ON pxrd_descriptors(pipeline_version);

COMMENT ON TABLE pxrd_descriptors IS
    'Canonical crystallographic descriptor vector derived deterministically from each PXRD diffractogram. One row per measurement. Specified in methodology/ROADMAP_PXRD_CRISTALINIDAD_Y_ML.md, Etapa 3.';

COMMENT ON COLUMN pxrd_descriptors.measurement_id IS
    'FK to characterization_measurements. The raw curve is never duplicated here; it stays in that table''s data_json.';
COMMENT ON COLUMN pxrd_descriptors.sample_code IS
    'Denormalised copy of the sample code, so descriptors can be grouped by sample without a join.';
COMMENT ON COLUMN pxrd_descriptors.pipeline_version IS
    'Version tag of the descriptor pipeline that produced this row (e.g. v1.0). Rows with different versions are not directly comparable.';
COMMENT ON COLUMN pxrd_descriptors.baseline_method IS
    'Baseline estimator used, e.g. arpls. Recorded so a future change of method is auditable.';
COMMENT ON COLUMN pxrd_descriptors.baseline_lambda IS
    'Smoothing parameter of the RIGID baseline pass, which removes only the instrumental background. Calibrated to 1e6 against the real blank and standard; too low swallows the amorphous halo, too high leaves background behind.';
COMMENT ON COLUMN pxrd_descriptors.broad_width_deg IS
    'Width in degrees 2-theta of the running-median window that separates the broad amorphous halo from the narrow Bragg peaks. Wider than any reflection, narrower than any halo.';
COMMENT ON COLUMN pxrd_descriptors.peak_sigma_k IS
    'Poisson significance multiplier k used for the primary peak count (3.0 = 3 sigma).';

COMMENT ON COLUMN pxrd_descriptors.n_peaks_k3 IS
    'Number of reflections above a 3-sigma Poisson prominence threshold. More reflections = more long-range order.';
COMMENT ON COLUMN pxrd_descriptors.n_peaks_k5 IS
    'Number of reflections above a stricter 5-sigma threshold. Counts only confidently real peaks.';
COMMENT ON COLUMN pxrd_descriptors.n_peaks_below_10deg IS
    'Reflections below 10 degrees 2-theta. Low-angle reflections indicate large unit cells, typical of porous MOFs.';
COMMENT ON COLUMN pxrd_descriptors.two_theta_first_peak IS
    'Angular position of the lowest-angle detected reflection, in degrees 2-theta.';
COMMENT ON COLUMN pxrd_descriptors.d_max_angstrom IS
    'Largest interplanar spacing, from Bragg law on the first peak: d = lambda / (2 sin theta). The single most discriminating MOF/non-MOF descriptor: >10 A means an expanded porous framework, <3.5 A a dense oxide.';
COMMENT ON COLUMN pxrd_descriptors.fwhm_median_deg IS
    'Median full width at half maximum across detected peaks, in degrees. Narrow peaks = better crystalline quality.';
COMMENT ON COLUMN pxrd_descriptors.fwhm_min_deg IS
    'Narrowest peak found, in degrees. Less sensitive than the median to poorly resolved shoulders.';
COMMENT ON COLUMN pxrd_descriptors.scherrer_size_nm IS
    'Apparent coherent domain size from the Scherrer equation, in nm. SEMIQUANTITATIVE ONLY: no instrumental broadening correction is applied, so values are systematically underestimated. Valid for comparing samples measured on the same instrument, never as an absolute crystallite size.';

COMMENT ON COLUMN pxrd_descriptors.crystalline_fraction IS
    'Degree of crystallinity by two-phase deconvolution: A_crystalline / (A_crystalline + A_amorphous), in [0,1]. Computed after separating the broad amorphous envelope from the narrow Bragg component, so the halo under each peak is not counted twice.';
COMMENT ON COLUMN pxrd_descriptors.crystalline_area IS
    'Integrated area of the narrow (Bragg) component, after the amorphous envelope has been subtracted.';
COMMENT ON COLUMN pxrd_descriptors.amorphous_area IS
    'Integrated area of the broad amorphous component. This is the number that preserves the disordered-phase information a plain background subtraction would destroy.';
COMMENT ON COLUMN pxrd_descriptors.amorphous_hump_center IS
    'Intensity-weighted centroid of the BROAD component only, in degrees 2-theta. Describes the nature of the amorphous phase. Computed by proper integration, not a raw sum.';
COMMENT ON COLUMN pxrd_descriptors.amorphous_hump_fwhm IS
    'Approximate width of the amorphous hump, in degrees 2-theta, measured at half its maximum.';
COMMENT ON COLUMN pxrd_descriptors.frac_intensity_below_10deg IS
    'Fraction of the total normalised area lying below 10 degrees. Separates porous frameworks from dense phases without needing peak detection.';
COMMENT ON COLUMN pxrd_descriptors.peak_to_background_ratio IS
    'Ratio of the tallest net peak to the local background level. Contrast metric, very sensitive to incipient crystallinity.';

COMMENT ON COLUMN pxrd_descriptors.spectral_entropy IS
    'Shannon entropy of the area-normalised pattern, in bits. A global order metric that needs no peak detection: sharp patterns concentrate probability and score low, flat noisy ones score high.';
COMMENT ON COLUMN pxrd_descriptors.snr_global IS
    'Signal-to-noise ratio of the pattern: net signal amplitude divided by the Poisson noise level of the raw counts. Quality control of the measurement, not a property of the material.';
COMMENT ON COLUMN pxrd_descriptors.raw_counts_max IS
    'Maximum raw count of the original scan, before any normalisation. Records acquisition intensity, which the normalised descriptors deliberately discard.';
COMMENT ON COLUMN pxrd_descriptors.nmf_weights IS
    'Per-phase abundance weights from the unsupervised NMF decomposition over the whole corpus (roadmap stage E3). NULL until that stage runs.';
COMMENT ON COLUMN pxrd_descriptors.computed_at IS
    'When this descriptor row was computed.';


-- =============================================================================
-- TABLE 2/2: pxrd_labels
-- =============================================================================
-- Human (or rule-based) ground truth about a measurement.
--
-- Kept in its OWN table, not as a column on pxrd_descriptors, for three reasons:
-- descriptors are recomputed automatically while labels are expensive human
-- judgement that must survive recomputation; one measurement can carry several
-- kinds of label at once (crystallinity class today, novelty triage tomorrow);
-- and a label needs its own provenance (who said so, when, how sure).
-- =============================================================================

CREATE TABLE IF NOT EXISTS pxrd_labels (
    measurement_id      UUID NOT NULL
                        REFERENCES characterization_measurements(measurement_id)
                        ON DELETE CASCADE,
    label_type          VARCHAR(40) NOT NULL,
    label_value         VARCHAR(40) NOT NULL,
    confidence          VARCHAR(20),
    labeled_by          VARCHAR(100) NOT NULL,
    labeled_at          TIMESTAMPTZ DEFAULT now(),
    notes               TEXT,
    PRIMARY KEY (measurement_id, label_type)
);

CREATE INDEX IF NOT EXISTS idx_pxrd_labels_type_value ON pxrd_labels(label_type, label_value);

COMMENT ON TABLE pxrd_labels IS
    'Ground-truth labels attached to a PXRD measurement, kept separate from the automatically recomputed descriptors. Specified in methodology/ROADMAP_PXRD_CRISTALINIDAD_Y_ML.md, section 9.';

COMMENT ON COLUMN pxrd_labels.measurement_id IS
    'FK to characterization_measurements, the measurement being labelled.';
COMMENT ON COLUMN pxrd_labels.label_type IS
    'Which question this label answers, e.g. crystallinity_class or novelty_triage. Part of the primary key, so one measurement can hold one label of each type.';
COMMENT ON COLUMN pxrd_labels.label_value IS
    'The label itself, e.g. AMORFO / INCIPIENTE / CRISTALINO for crystallinity_class.';
COMMENT ON COLUMN pxrd_labels.confidence IS
    'How sure the labeller was: alta, media or dudosa. Low-confidence labels can be excluded from training without being lost.';
COMMENT ON COLUMN pxrd_labels.labeled_by IS
    'Who or what assigned the label: a person''s name, or the name of the rule/script.';
COMMENT ON COLUMN pxrd_labels.labeled_at IS
    'When the label was assigned.';
COMMENT ON COLUMN pxrd_labels.notes IS
    'Free-text remark from the labeller, e.g. why a pattern was judged doubtful.';


-- =============================================================================
-- Keep data_dictionary at 100% coverage
-- =============================================================================
-- data_dictionary is the schema documentation stored as queryable rows, so the
-- web app and the AI agents can read the dictionary instead of hard-coding it.
-- Every column created above gets a row here.
-- =============================================================================

INSERT INTO data_dictionary (table_name, column_name, full_name, section_name, unit, data_type, valid_categories, description) VALUES
('pxrd_descriptors','measurement_id','Measurement ID','IDENTITY',NULL,'UUID','FK -> characterization_measurements','Measurement this descriptor vector was computed from.'),
('pxrd_descriptors','sample_code','Sample Code','IDENTITY',NULL,'VARCHAR(50)',NULL,'Sample the measurement belongs to, denormalised for convenient grouping.'),
('pxrd_descriptors','pipeline_version','Pipeline Version','TRACEABILITY',NULL,'VARCHAR(20)',NULL,'Version of the descriptor pipeline. Rows computed under different versions are not directly comparable.'),
('pxrd_descriptors','baseline_method','Baseline Method','TRACEABILITY',NULL,'VARCHAR(30)','arpls','Baseline estimation algorithm used.'),
('pxrd_descriptors','baseline_lambda','Rigid Baseline Lambda','TRACEABILITY',NULL,'DOUBLE PRECISION','> 0','Smoothing parameter of the rigid pass that removes only the instrumental background.'),
('pxrd_descriptors','broad_width_deg','Broad/narrow split width','TRACEABILITY','degrees 2-theta','DOUBLE PRECISION','> 0','Width of the running-median window that separates the broad amorphous halo from narrow Bragg peaks.'),
('pxrd_descriptors','peak_sigma_k','Peak Sigma K','TRACEABILITY','sigma','DOUBLE PRECISION','> 0','Poisson significance multiplier used for the primary peak count.'),
('pxrd_descriptors','n_peaks_k3','Peaks above 3 sigma','PEAKS','count','INTEGER','>= 0','Reflections detected above a 3-sigma Poisson prominence threshold.'),
('pxrd_descriptors','n_peaks_k5','Peaks above 5 sigma','PEAKS','count','INTEGER','>= 0','Reflections detected above a stricter 5-sigma threshold.'),
('pxrd_descriptors','n_peaks_below_10deg','Low-angle peak count','PEAKS','count','INTEGER','>= 0','Reflections below 10 degrees 2-theta, indicating large unit cells.'),
('pxrd_descriptors','two_theta_first_peak','First peak position','PEAKS','degrees 2-theta','DOUBLE PRECISION','3 - 50','Angular position of the lowest-angle detected reflection.'),
('pxrd_descriptors','d_max_angstrom','Maximum d-spacing','PEAKS','angstrom','DOUBLE PRECISION','> 0','Largest interplanar spacing from Bragg law. Most discriminating MOF/non-MOF descriptor.'),
('pxrd_descriptors','fwhm_median_deg','Median FWHM','PEAKS','degrees 2-theta','DOUBLE PRECISION','> 0','Median peak width at half maximum. Narrow means better crystalline quality.'),
('pxrd_descriptors','fwhm_min_deg','Minimum FWHM','PEAKS','degrees 2-theta','DOUBLE PRECISION','> 0','Width of the narrowest peak found.'),
('pxrd_descriptors','scherrer_size_nm','Scherrer domain size','PEAKS','nm','DOUBLE PRECISION','> 0','Apparent coherent domain size. SEMIQUANTITATIVE: no instrumental broadening correction, comparative use only.'),
('pxrd_descriptors','crystalline_fraction','Crystalline fraction','PHASES','fraction','DOUBLE PRECISION','0 - 1','Degree of crystallinity by two-phase deconvolution.'),
('pxrd_descriptors','crystalline_area','Crystalline area','PHASES','counts x degrees','DOUBLE PRECISION','>= 0','Integrated area of the narrow Bragg component.'),
('pxrd_descriptors','amorphous_area','Amorphous area','PHASES','counts x degrees','DOUBLE PRECISION','>= 0','Integrated area of the broad amorphous component. Preserves the disordered-phase information.'),
('pxrd_descriptors','amorphous_hump_center','Amorphous hump centre','PHASES','degrees 2-theta','DOUBLE PRECISION','3 - 50','Intensity-weighted centroid of the broad component only.'),
('pxrd_descriptors','amorphous_hump_fwhm','Amorphous hump width','PHASES','degrees 2-theta','DOUBLE PRECISION','> 0','Approximate width of the amorphous hump at half its maximum.'),
('pxrd_descriptors','frac_intensity_below_10deg','Low-angle intensity fraction','PHASES','fraction','DOUBLE PRECISION','0 - 1','Fraction of normalised area below 10 degrees, without needing peak detection.'),
('pxrd_descriptors','peak_to_background_ratio','Peak to background ratio','PHASES','ratio','DOUBLE PRECISION','>= 0','Tallest net peak divided by the local background level.'),
('pxrd_descriptors','spectral_entropy','Spectral entropy','GLOBAL','bits','DOUBLE PRECISION','>= 0','Shannon entropy of the normalised pattern. Global order metric with no peak detection.'),
('pxrd_descriptors','snr_global','Global SNR','GLOBAL','ratio','DOUBLE PRECISION','>= 0','Net signal amplitude over the Poisson noise level. Measurement quality, not material property.'),
('pxrd_descriptors','raw_counts_max','Maximum raw counts','GLOBAL','counts','DOUBLE PRECISION','>= 0','Maximum raw count before normalisation.'),
('pxrd_descriptors','nmf_weights','NMF phase weights','GLOBAL',NULL,'JSONB',NULL,'Per-phase abundance weights from the unsupervised NMF stage. NULL until that stage runs.'),
('pxrd_descriptors','computed_at','Computed at','GLOBAL',NULL,'TIMESTAMPTZ',NULL,'When this descriptor row was computed.'),
('pxrd_labels','measurement_id','Measurement ID','IDENTITY',NULL,'UUID','FK -> characterization_measurements','Measurement being labelled.'),
('pxrd_labels','label_type','Label type','IDENTITY',NULL,'VARCHAR(40)','crystallinity_class | novelty_triage','Which question this label answers.'),
('pxrd_labels','label_value','Label value','LABEL',NULL,'VARCHAR(40)','AMORFO | INCIPIENTE | CRISTALINO','The label itself.'),
('pxrd_labels','confidence','Confidence','LABEL',NULL,'VARCHAR(20)','alta | media | dudosa','How sure the labeller was.'),
('pxrd_labels','labeled_by','Labelled by','PROVENANCE',NULL,'VARCHAR(100)',NULL,'Person or script that assigned the label.'),
('pxrd_labels','labeled_at','Labelled at','PROVENANCE',NULL,'TIMESTAMPTZ',NULL,'When the label was assigned.'),
('pxrd_labels','notes','Notes','PROVENANCE',NULL,'TEXT',NULL,'Free-text remark from the labeller.')
ON CONFLICT (table_name, column_name) DO UPDATE SET
    full_name        = EXCLUDED.full_name,
    section_name     = EXCLUDED.section_name,
    unit             = EXCLUDED.unit,
    data_type        = EXCLUDED.data_type,
    valid_categories = EXCLUDED.valid_categories,
    description      = EXCLUDED.description;
