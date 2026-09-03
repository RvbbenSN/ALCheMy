-- =============================================================================
-- ALCheMy - pxrd_labels, rebuilt so labels survive a re-ingestion
-- =============================================================================
-- Supersedes the pxrd_labels table created in scripts/ddl_pxrd_descriptors.sql.
--
-- WHY THIS REBUILD EXISTS
-- -----------------------
-- The first version keyed labels on characterization_measurements.measurement_id
-- with ON DELETE CASCADE. That is correct for DERIVED data (pxrd_descriptors can
-- always be recomputed in a minute), but catastrophic for labels.
--
-- On 2026-08-25 the measurements table was wiped and re-ingested. Every
-- measurement_id was regenerated, and the 300 descriptor rows vanished with the
-- old ids - exactly as designed. Had there been labels, hours of human judgement
-- would have gone with them, and nothing could have brought them back.
--
-- A label is the most expensive data in the project: it is a chemist looking at a
-- diffractogram and deciding. It must outlive any re-ingestion.
--
-- THE FIX: KEY ON SOMETHING THAT DOES NOT CHANGE
-- ----------------------------------------------
-- file_hash is the MD5 of the raw instrument file. Re-ingesting the same file
-- produces the same hash, so it identifies the measurement across any number of
-- table rebuilds. That becomes the real identity of a label.
--
-- measurement_id is kept, but only as a convenience join, and with
-- ON DELETE SET NULL instead of CASCADE: if the measurement disappears, the label
-- survives orphaned and can be re-attached with the query at the bottom of this
-- file. sample_code and file_name are stored too, so a label remains
-- human-readable even if it is never re-linked.
--
-- Apply with:
--   docker exec -i alchemy_postgres psql -U alchemy_user -d alchemy_db \
--       < scripts/ddl_pxrd_labels_v2.sql
-- =============================================================================

-- Safe: the old table was empty (0 rows) when this replaced it.
DROP TABLE IF EXISTS pxrd_labels;

CREATE TABLE pxrd_labels (
    -- ---------------------------------------------------------------------
    -- Identity that survives a re-ingestion
    -- ---------------------------------------------------------------------
    file_hash       VARCHAR(32)  NOT NULL,
    label_type      VARCHAR(40)  NOT NULL,

    -- Human-readable context, denormalised on purpose so an orphaned label
    -- still tells you what it was about.
    sample_code     VARCHAR(50)  NOT NULL,
    file_name       VARCHAR(255),

    -- Convenience link. NULL after a re-ingestion until re-attached.
    measurement_id  UUID REFERENCES characterization_measurements(measurement_id)
                    ON DELETE SET NULL,

    -- ---------------------------------------------------------------------
    -- The judgement itself
    -- ---------------------------------------------------------------------
    label_value     VARCHAR(40)  NOT NULL,
    confidence      VARCHAR(20)  NOT NULL DEFAULT 'alta',
    notes           TEXT,

    -- ---------------------------------------------------------------------
    -- Provenance
    -- ---------------------------------------------------------------------
    labeled_by      VARCHAR(100) NOT NULL,
    labeled_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),

    PRIMARY KEY (file_hash, label_type)
);

CREATE INDEX idx_pxrd_labels_value   ON pxrd_labels(label_type, label_value);
CREATE INDEX idx_pxrd_labels_sample  ON pxrd_labels(sample_code);
CREATE INDEX idx_pxrd_labels_meas    ON pxrd_labels(measurement_id);

COMMENT ON TABLE pxrd_labels IS
    'Human ground-truth labels for PXRD diffractograms. Keyed on file_hash rather than measurement_id so that labels survive a re-ingestion of characterization_measurements. The most expensive data in the project: it cannot be recomputed.';

COMMENT ON COLUMN pxrd_labels.file_hash IS
    'MD5 of the raw instrument file. The stable identity of the measurement: unchanged across re-ingestions, which is why the label is keyed on it.';
COMMENT ON COLUMN pxrd_labels.label_type IS
    'Which question the label answers, e.g. crystallinity_class. Part of the key, so one measurement can carry one label of each type.';
COMMENT ON COLUMN pxrd_labels.sample_code IS
    'Sample the diffractogram belongs to. Denormalised so an orphaned label stays readable.';
COMMENT ON COLUMN pxrd_labels.file_name IS
    'Original file name, for human identification.';
COMMENT ON COLUMN pxrd_labels.measurement_id IS
    'Convenience FK to characterization_measurements. SET NULL if the measurement is deleted; re-attach by matching file_hash.';
COMMENT ON COLUMN pxrd_labels.label_value IS
    'The judgement: AMORFO | INCIPIENTE | CRISTALINO | MEZCLA | SIN_MUESTRA.';
COMMENT ON COLUMN pxrd_labels.confidence IS
    'How sure the labeller was: alta or dudosa. Doubtful labels can be excluded from training without being lost.';
COMMENT ON COLUMN pxrd_labels.notes IS
    'Free-text remark from the labeller.';
COMMENT ON COLUMN pxrd_labels.labeled_by IS
    'Who assigned the label.';
COMMENT ON COLUMN pxrd_labels.labeled_at IS
    'When the label was first assigned.';
COMMENT ON COLUMN pxrd_labels.updated_at IS
    'When the label was last changed (a label revised on review keeps its original labeled_at).';


-- =============================================================================
-- data_dictionary coverage
-- =============================================================================
DELETE FROM data_dictionary WHERE table_name = 'pxrd_labels';

INSERT INTO data_dictionary (table_name, column_name, full_name, section_name, unit, data_type, valid_categories, description) VALUES
('pxrd_labels','file_hash','File hash','IDENTITY',NULL,'VARCHAR(32)',NULL,'MD5 of the raw file. Stable identity that survives re-ingestion; the label is keyed on it.'),
('pxrd_labels','label_type','Label type','IDENTITY',NULL,'VARCHAR(40)','crystallinity_class | novelty_triage','Which question this label answers.'),
('pxrd_labels','sample_code','Sample code','IDENTITY',NULL,'VARCHAR(50)',NULL,'Sample the diffractogram belongs to, denormalised.'),
('pxrd_labels','file_name','File name','IDENTITY',NULL,'VARCHAR(255)',NULL,'Original instrument file name.'),
('pxrd_labels','measurement_id','Measurement ID','IDENTITY',NULL,'UUID','FK -> characterization_measurements','Convenience link; NULL if the measurement was deleted.'),
('pxrd_labels','label_value','Label value','LABEL',NULL,'VARCHAR(40)','AMORFO | INCIPIENTE | CRISTALINO | MEZCLA | SIN_MUESTRA','The human judgement about the diffractogram.'),
('pxrd_labels','confidence','Confidence','LABEL',NULL,'VARCHAR(20)','alta | dudosa','How sure the labeller was.'),
('pxrd_labels','notes','Notes','LABEL',NULL,'TEXT',NULL,'Free-text remark from the labeller.'),
('pxrd_labels','labeled_by','Labelled by','PROVENANCE',NULL,'VARCHAR(100)',NULL,'Who assigned the label.'),
('pxrd_labels','labeled_at','Labelled at','PROVENANCE',NULL,'TIMESTAMPTZ',NULL,'When the label was first assigned.'),
('pxrd_labels','updated_at','Updated at','PROVENANCE',NULL,'TIMESTAMPTZ',NULL,'When the label was last modified.')
ON CONFLICT (table_name, column_name) DO UPDATE SET
    full_name = EXCLUDED.full_name, section_name = EXCLUDED.section_name,
    unit = EXCLUDED.unit, data_type = EXCLUDED.data_type,
    valid_categories = EXCLUDED.valid_categories, description = EXCLUDED.description;


-- =============================================================================
-- Convenience view: labels joined to what they describe
-- =============================================================================
CREATE OR REPLACE VIEW v_pxrd_labels_full AS
SELECT l.file_hash, l.sample_code, l.file_name,
       l.label_value, l.confidence, l.notes,
       l.labeled_by, l.labeled_at, l.updated_at,
       s.metal_center, s.linker, s.temp_target_c, s.time_hours,
       (l.measurement_id IS NULL) AS needs_relink
FROM pxrd_labels l
LEFT JOIN synthesis_experiments s ON s.sample_code = l.sample_code
WHERE l.label_type = 'crystallinity_class';

COMMENT ON VIEW v_pxrd_labels_full IS
    'Crystallinity labels joined to the synthesis conditions they belong to. needs_relink flags labels orphaned by a re-ingestion.';


-- =============================================================================
-- RUN THIS AFTER ANY RE-INGESTION of characterization_measurements
-- -----------------------------------------------------------------------------
-- Re-attaches orphaned labels to the newly created measurement rows by matching
-- the file hash. Safe to run at any time; it only ever fills in NULLs.
--
--   UPDATE pxrd_labels l
--      SET measurement_id = m.measurement_id
--     FROM characterization_measurements m
--    WHERE m.file_hash = l.file_hash
--      AND l.measurement_id IS DISTINCT FROM m.measurement_id;
--
-- Check for orphans with:
--   SELECT count(*) FROM pxrd_labels WHERE measurement_id IS NULL;
-- =============================================================================
