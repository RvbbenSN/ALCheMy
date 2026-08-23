-- ==========================================================
-- ALCheMy: Database Initialization Script (DDL)
-- Master DDL Schema Definition for Materials Chemistry Lab
-- ==========================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Master Table: Synthesis Experiments (Single Source of Truth)
CREATE TABLE IF NOT EXISTS synthesis_experiments (
    -- Section 1: General Information & ISO 17025 Audit Trail
    sample_code VARCHAR(50) PRIMARY KEY,
    synthesis_date DATE DEFAULT CURRENT_DATE,
    synthesis_type VARCHAR(50) DEFAULT 'ST',
    researcher_name VARCHAR(100) DEFAULT 'Rubén S.N.',
    research_unit VARCHAR(100) DEFAULT 'APMU',
    hts_number VARCHAR(20) DEFAULT 'N/A',
    well_position VARCHAR(20) DEFAULT 'N/A',
    metal_center VARCHAR(20) NOT NULL,
    metal_source VARCHAR(100) NOT NULL,
    linker VARCHAR(100) NOT NULL,

    -- Section 2: Theoretical Design
    metal_conc_m NUMERIC(10,4),
    lm_ratio NUMERIC(10,4),
    metal_mass_mg NUMERIC(12,4) DEFAULT 10.63,
    linker_mass_mg NUMERIC(12,4),
    secondary_linker_mg NUMERIC(12,4) DEFAULT 0,
    reactor_volume_ml NUMERIC(10,4),

    -- Section 3: Solvents (mL)
    h2o_pure_ml NUMERIC(12,4) DEFAULT 0,
    h2o_total_ml NUMERIC(12,4) DEFAULT 0,
    meoh_ml NUMERIC(12,4) DEFAULT 0,
    etoh_ml NUMERIC(12,4) DEFAULT 0,
    proh_1_ml NUMERIC(12,4) DEFAULT 0,
    dmf_ml NUMERIC(12,4) DEFAULT 0,
    def_ml NUMERIC(12,4) DEFAULT 0,
    total_volume_ml NUMERIC(12,4) NOT NULL,

    -- Section 4: Thermal Ramp
    temp_initial_c NUMERIC(8,2) DEFAULT 25.0,
    heating_time_hours NUMERIC(8,2) DEFAULT 0.0,
    heating_rate_c_min NUMERIC(10,4) DEFAULT 0.0,
    temp_target_c NUMERIC(8,2) NOT NULL,
    time_hours NUMERIC(8,2) NOT NULL,
    cooling_time_hours NUMERIC(8,2) DEFAULT 0.0,
    cooling_rate_c_min NUMERIC(10,4) DEFAULT 0.0,
    temp_final_c NUMERIC(8,2) DEFAULT 25.0,

    -- Section 5: Active Modulator Millimoles (mmol)
    hcl_active_mmol NUMERIC(14,4) DEFAULT 0,
    hf_active_mmol NUMERIC(14,4) DEFAULT 0,
    koh_active_mmol NUMERIC(14,4) DEFAULT 0,
    formic_acid_mmol NUMERIC(14,4) DEFAULT 0,
    acetic_acid_mmol NUMERIC(14,4) DEFAULT 0,
    propionic_acid_mmol NUMERIC(14,4) DEFAULT 0,
    tfa_mmol NUMERIC(14,4) DEFAULT 0,
    cf3so3h_mmol NUMERIC(14,4) DEFAULT 0,
    triethylamine_mmol NUMERIC(14,4) DEFAULT 0,
    meo3s_mmol NUMERIC(14,4) DEFAULT 0,

    -- Section 6: Experimental Balance Weighings & Yield

    -- Data Quality Gate & Audit Metadata
    file_hash_md5 VARCHAR(64) UNIQUE,
    measurement_status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Native SQL Column Comments for pgAdmin Documentation
COMMENT ON COLUMN synthesis_experiments.sample_code IS 'Unique sample identifier for the synthesis batch';
COMMENT ON COLUMN synthesis_experiments.synthesis_type IS 'Methodology used (HTS, ST, MW, DT)';
COMMENT ON COLUMN synthesis_experiments.researcher_name IS 'Lead researcher responsible for experiment (ISO 17025 compliance)';
COMMENT ON COLUMN synthesis_experiments.research_unit IS 'Research department group (APMU: Advanced Porous Materials Unit)';
COMMENT ON COLUMN synthesis_experiments.reactor_volume_ml IS 'Volume of reactor in milliliters';
COMMENT ON COLUMN synthesis_experiments.hts_number IS 'HTS attempt identifier (N/A for ST, DT, MW)';
COMMENT ON COLUMN synthesis_experiments.well_position IS '24-well plate position (N/A for ST, DT, MW)';
COMMENT ON COLUMN synthesis_experiments.h2o_pure_ml IS 'Pure deionized water volume added as solvent (mL)';
COMMENT ON COLUMN synthesis_experiments.h2o_total_ml IS 'Total homogenized water volume (Pure + aqueous solutions)';
COMMENT ON COLUMN synthesis_experiments.hcl_active_mmol IS 'Total active HCl modulator in millimoles';
COMMENT ON COLUMN synthesis_experiments.metal_center IS 'Primary metallic node element (Ni, Zr, Bi, Cu, Fe, Zn, Co, Ca, Mo, La)';
COMMENT ON COLUMN synthesis_experiments.metal_source IS 'Chemical precursor salt (e.g. Ni(NO3)2·6H2O)';
COMMENT ON COLUMN synthesis_experiments.linker IS 'Official primary organic ligand (H8ptp, Et8ptp, H6ttbmp, Et6ttbmp, Tannic acid, BTBSH3, PPV)';
COMMENT ON COLUMN synthesis_experiments.lm_ratio IS 'Theoretical Ligand to Metal molar ratio (L/M)';
COMMENT ON COLUMN synthesis_experiments.total_volume_ml IS 'Total reaction liquid volume (V_total)';
COMMENT ON COLUMN synthesis_experiments.temp_target_c IS 'Maximum reaction temperature setpoint (°C)';
COMMENT ON COLUMN synthesis_experiments.time_hours IS 'Isothermal reaction duration (hours)';
COMMENT ON COLUMN synthesis_experiments.heating_rate_c_min IS 'Heating ramp rate in °C/min';
COMMENT ON COLUMN synthesis_experiments.cooling_rate_c_min IS 'Cooling ramp rate in °C/min';
COMMENT ON COLUMN synthesis_experiments.file_hash_md5 IS 'MD5 checksum for anti-duplication data quality gate';
COMMENT ON COLUMN synthesis_experiments.measurement_status IS 'Measurement audit state: active or superseded';

-- 4. Master Data Dictionary Table
CREATE TABLE IF NOT EXISTS data_dictionary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    column_name VARCHAR(100) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    section_name VARCHAR(100) NOT NULL,
    unit VARCHAR(50),
    data_type VARCHAR(50) NOT NULL,
    valid_categories TEXT,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4-bis. Migracion: el diccionario nacio documentando UNA sola tabla
-- (synthesis_experiments), por eso column_name era UNIQUE a secas. Al documentar
-- varias tablas eso rompe: 'file_name' existe en dos tablas distintas.
-- Se anade table_name y la unicidad pasa a ser la PAREJA (tabla, columna).
-- Idempotente: si ya esta migrado, estas cinco sentencias no hacen nada.
ALTER TABLE data_dictionary ADD COLUMN IF NOT EXISTS table_name VARCHAR(100);
UPDATE data_dictionary SET table_name = 'synthesis_experiments' WHERE table_name IS NULL;
ALTER TABLE data_dictionary ALTER COLUMN table_name SET DEFAULT 'synthesis_experiments';
ALTER TABLE data_dictionary ALTER COLUMN table_name SET NOT NULL;
ALTER TABLE data_dictionary DROP CONSTRAINT IF EXISTS data_dictionary_column_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS data_dictionary_table_column_key
    ON data_dictionary (table_name, column_name);

COMMENT ON COLUMN data_dictionary.table_name IS 'Tabla a la que pertenece la columna documentada. Por defecto synthesis_experiments.';

-- 5. Populate Data Dictionary Entries
INSERT INTO data_dictionary (column_name, full_name, section_name, unit, data_type, valid_categories, description)
VALUES 
('sample_code', 'Sample Code', 'GENERAL INFORMATION', 'None', 'VARCHAR(50)', 'Free text (RS1, RS102)', 'Unique sample identifier for the synthesis batch'),
('synthesis_date', 'Synthesis Date', 'GENERAL INFORMATION', 'Date', 'DATE', 'YYYY-MM-DD', 'Date when the experiment was performed'),
('synthesis_type', 'Synthesis Type', 'GENERAL INFORMATION', 'None', 'VARCHAR(50)', 'HTS, ST, MW, DT', 'Methodology used for the synthesis reaction (HTS: High-throughput; ST: Solvothermal; MW: Microwave; DT: Duran tube)'),
('researcher_name', 'Lead Researcher', 'GENERAL INFORMATION', 'Text', 'VARCHAR(100)', 'Free text (Default: Rubén S.N.)', 'Lead researcher responsible for experiment execution (ISO 17025 / GLP Compliance)'),
('research_unit', 'Research Unit', 'GENERAL INFORMATION', 'Text', 'VARCHAR(100)', 'Free text (Default: APMU)', 'Laboratory department / research group (APMU: Advanced Porous Materials Unit)'),
('reactor_volume_ml', 'Reactor Volume', 'THEORETICAL DESIGN', 'mL', 'NUMERIC(5,1)', '> 0', 'Volume of reactor in milliliters (Default: HTS=2.5, ST=23.0, MW=30.0, DT=8.0)'),
('hts_number', 'HTS Attempt Number', 'GENERAL INFORMATION', 'Text', 'VARCHAR(5)', 'Free text (C1, C2) or N/A', 'High-throughput screening attempt identifier (N/A for non-HTS)'),
('well_position', 'Well Position', 'GENERAL INFORMATION', 'Text', 'VARCHAR(3)', 'Free text (A1, B4) or N/A', 'Specific 24-well plate position (N/A for non-HTS)'),
('metal_center', 'Metal Center', 'GENERAL INFORMATION', 'Element', 'VARCHAR(3)', 'All Transition Metals & Semimetals (Ni, Zr, Bi, Cu, Fe, Zn, Co, Ca, Mo, La)', 'Primary metallic node element center'),
('metal_source', 'Metal Source Precursor', 'GENERAL INFORMATION', 'Formula', 'VARCHAR(100)', 'Ni(NO3)2·6H2O, Bi(NO3)3·5H2O, ZrCl4', 'Chemical precursor salt used as the metal source'),
('linker', 'Organic Linker', 'GENERAL INFORMATION', 'Formula/Name', 'VARCHAR(100)', 'H8ptp, Et8ptp, H6ttbmp, Et6ttbmp, Tannic acid, BTBSH3, PPV', 'Official primary organic ligand building block'),
('metal_conc_m', 'Theoretical Metal Concentration', 'THEORETICAL DESIGN', 'M (mol/L)', 'NUMERIC(4,3)', '> 0', 'Theoretical concentration of the metal in precursor solution'),
('lm_ratio', 'Target L/M Ratio', 'THEORETICAL DESIGN', 'mol/mol', 'NUMERIC(4,3)', '> 0', 'Theoretical Ligand to Metal molar ratio (L/M)'),
('metal_mass_mg', 'Target Metal Mass', 'THEORETICAL DESIGN', 'mg', 'NUMERIC(6,3)', '> 0', 'Theoretical target mass of metal precursor to weigh (Default: 10.63)'),
('linker_mass_mg', 'Target Linker Mass', 'THEORETICAL DESIGN', 'mg', 'NUMERIC(10,4)', '> 0', 'Theoretical target mass of primary ligand to weigh'),
('h2o_pure_ml', 'Pure Water Volume', 'SOLVENTS', 'mL', 'NUMERIC(10,4)', '>= 0', 'Volume of pure deionized water added as solvent'),
('h2o_total_ml', 'Homogenized Total Water Volume', 'SOLVENTS', 'mL', 'NUMERIC(10,4)', '>= 0', 'Total homogenized water volume (Pure + aqueous solutions)'),
('total_volume_ml', 'Total Liquid Volume', 'SOLVENTS', 'mL', 'NUMERIC(10,4)', '> 0', 'Total reaction liquid volume (V_total)'),
('temp_initial_c', 'Initial Temperature', 'THERMAL RAMP', '°C', 'NUMERIC(6,2)', '0-300', 'Initial heating start temperature (Default: 25.0 °C)'),
('heating_time_hours', 'Heating Ramp Duration', 'THERMAL RAMP', 'hours', 'NUMERIC(6,2)', '0-100', 'Duration of heating ramp from initial to target temperature (Default: 0.0)'),
('heating_rate_c_min', 'Heating Slope Rate', 'THERMAL RAMP', '°C/min', 'NUMERIC(6,3)', '0-50', 'Heating ramp slope rate in °C per minute (Default: 0.0)'),
('temp_target_c', 'Target Temperature', 'THERMAL RAMP', '°C', 'NUMERIC(6,2)', '20-300', 'Maximum reaction temperature setpoint'),
('time_hours', 'Reaction Duration (Plateau)', 'THERMAL RAMP', 'hours', 'NUMERIC(6,2)', '0-500', 'Isothermal reaction duration'),
('cooling_time_hours', 'Cooling Ramp Duration', 'THERMAL RAMP', 'hours', 'NUMERIC(6,2)', '0-100', 'Duration of cooling ramp from target to final temperature (Default: 0.0)'),
('cooling_rate_c_min', 'Cooling Slope Rate', 'THERMAL RAMP', '°C/min', 'NUMERIC(6,3)', '0-50', 'Cooling ramp slope rate in °C per minute (Default: 0.0)'),
('temp_final_c', 'Final Temperature', 'THERMAL RAMP', '°C', 'NUMERIC(6,2)', '0-300', 'Final temperature after cooling ramp (Default: 25.0 °C)'),
('hcl_active_mmol', 'Active HCl Modulator', 'MODULATORS & ADDITIVES', 'mmol', 'NUMERIC(10,4)', '>= 0', 'Total pure active Hydrochloric Acid in millimoles')
ON CONFLICT (table_name, column_name) DO UPDATE SET 
    full_name = EXCLUDED.full_name,
    section_name = EXCLUDED.section_name,
    valid_categories = EXCLUDED.valid_categories,
    description = EXCLUDED.description;

-- 6. Child Table: Multimodal Characterization Measurements (JSONB Data Lake Model)
CREATE TABLE IF NOT EXISTS characterization_measurements (
    measurement_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sample_code VARCHAR(50) NOT NULL REFERENCES synthesis_experiments(sample_code) ON DELETE CASCADE,
    researcher_name VARCHAR(100) DEFAULT 'Rubén S.N.', -- Principal researcher responsible for sample
    researcher_email VARCHAR(255) DEFAULT 'rubbenserrano@gmail.com', -- Email address of responsible researcher
    technique VARCHAR(30) NOT NULL, -- 'PXRD', 'TGA', 'FTIR', 'UV-Vis', 'BET_N2', 'EA', 'ICP', 'SEM', 'SC-XRD', 'VTXRD'
    operator_name VARCHAR(100) DEFAULT 'Rubén S.N.', -- Equipment operator or facility technician
    measurement_tag VARCHAR(100) DEFAULT 'as_synthesized', -- 'as_synthesized', 'activated_150C', 'water_stability_24h'
    instrument_name VARCHAR(100) DEFAULT 'N/A', -- Specific equipment model in core facility
    file_name VARCHAR(255) NOT NULL,
    raw_file_path TEXT NOT NULL, -- Path in Data Lake
    data_json JSONB NOT NULL, -- JSONB Payload containing header_metadata dict and raw_data
    file_hash VARCHAR(32), -- MD5 checksum of binary contents for anti-duplication
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Characterization Measurements
CREATE INDEX IF NOT EXISTS idx_char_sample_tech ON characterization_measurements(sample_code, technique);
CREATE INDEX IF NOT EXISTS idx_char_tag ON characterization_measurements(measurement_tag);
CREATE INDEX IF NOT EXISTS idx_char_file_hash ON characterization_measurements(file_hash);
CREATE INDEX IF NOT EXISTS idx_char_email ON characterization_measurements(researcher_email);
CREATE INDEX IF NOT EXISTS idx_char_jsonb ON characterization_measurements USING gin (data_json);

-- Native SQL Comments
COMMENT ON TABLE characterization_measurements IS 'Child table storing raw characterization data and header metadata in standardized JSONB format';
COMMENT ON COLUMN characterization_measurements.sample_code IS 'Foreign key referencing synthesis_experiments.sample_code';
COMMENT ON COLUMN characterization_measurements.technique IS 'Characterization technique code (PXRD, TGA, FTIR, UV-Vis, BET_N2, EA, ICP, SEM, SC-XRD, VTXRD)';
COMMENT ON COLUMN characterization_measurements.measurement_tag IS 'Descriptive measurement condition (as_synthesized, activated_150C, water_stability_24h)';
COMMENT ON COLUMN characterization_measurements.raw_file_path IS 'Path to raw unparsed file in the Data Lake';
COMMENT ON COLUMN characterization_measurements.data_json IS 'JSONB payload containing header_metadata dict and raw_data (x_label, y_label, x arrays, y arrays)';

-- 7. Audit Log Table (Human-in-the-Loop & Governance Framework - English Schema)
CREATE TABLE IF NOT EXISTS audit_log (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    agent VARCHAR(100) NOT NULL DEFAULT 'alchemy_ingestion_pipeline',
    action VARCHAR(100) NOT NULL,
    recipients INTEGER DEFAULT 0,
    verdict VARCHAR(50) NOT NULL DEFAULT 'ALLOW',
    cause TEXT,
    result VARCHAR(100) DEFAULT 'EXECUTED'
);

COMMENT ON TABLE audit_log IS 'Audit log table tracking all system actions, approvals, rejections, and execution metrics';

-- 8. Authorized Researchers Whitelist Table (Dynamic Security & Self-Enrollment)
CREATE TABLE IF NOT EXISTS authorized_researchers (
    email VARCHAR(255) PRIMARY KEY,
    researcher_name VARCHAR(100) DEFAULT 'Guest Researcher',
    role VARCHAR(50) DEFAULT 'guest_demo',
    active BOOLEAN DEFAULT true,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO authorized_researchers (email, researcher_name, role, active)
VALUES ('rubbenserrano@gmail.com', 'Rubén S.N.', 'lead_researcher', true)
ON CONFLICT (email) DO NOTHING;

COMMENT ON TABLE authorized_researchers IS 'Whitelist table storing authorized researchers and dynamic self-enrolled demo users';





-- =============================================================================
-- 9. Data Dictionary: columnas de synthesis_experiments que faltaban
-- =============================================================================
--  Detectado el 2026-08-23: 19 columnas existian en la tabla pero no estaban
--  documentadas. El agente RAG lee esta tabla para saber que puede consultar,
--  asi que una columna no documentada es, para el, una columna invisible.
-- -----------------------------------------------------------------------------
INSERT INTO data_dictionary (table_name, column_name, full_name, section_name, unit, data_type, valid_categories, description)
VALUES
('synthesis_experiments','secondary_linker_mg','Secondary Linker Mass','THEORETICAL DESIGN','mg','NUMERIC(10,4)','>= 0','Mass of the secondary organic linker, when a mixed-linker system is used'),
('synthesis_experiments','meoh_ml','Methanol Volume','SOLVENTS','mL','NUMERIC(12,4)','>= 0','Volume of methanol added as co-solvent'),
('synthesis_experiments','etoh_ml','Ethanol Volume','SOLVENTS','mL','NUMERIC(12,4)','>= 0','Volume of ethanol added as co-solvent'),
('synthesis_experiments','proh_1_ml','1-Propanol Volume','SOLVENTS','mL','NUMERIC(12,4)','>= 0','Volume of 1-propanol added as co-solvent'),
('synthesis_experiments','dmf_ml','DMF Volume','SOLVENTS','mL','NUMERIC(12,4)','>= 0','Volume of N,N-dimethylformamide added as solvent'),
('synthesis_experiments','def_ml','DEF Volume','SOLVENTS','mL','NUMERIC(12,4)','>= 0','Volume of N,N-diethylformamide added as solvent'),
('synthesis_experiments','hf_active_mmol','Active HF Modulator','MODULATORS & ADDITIVES','mmol','NUMERIC(14,4)','>= 0','Pure active hydrofluoric acid, in millimoles (mineralising agent)'),
('synthesis_experiments','koh_active_mmol','Active KOH Modulator','MODULATORS & ADDITIVES','mmol','NUMERIC(14,4)','>= 0','Pure active potassium hydroxide, in millimoles (deprotonating agent)'),
('synthesis_experiments','formic_acid_mmol','Formic Acid Modulator','MODULATORS & ADDITIVES','mmol','NUMERIC(14,4)','>= 0','Pure active formic acid, in millimoles (monotopic competition modulator)'),
('synthesis_experiments','acetic_acid_mmol','Acetic Acid Modulator','MODULATORS & ADDITIVES','mmol','NUMERIC(14,4)','>= 0','Pure active acetic acid, in millimoles (monotopic competition modulator)'),
('synthesis_experiments','propionic_acid_mmol','Propionic Acid Modulator','MODULATORS & ADDITIVES','mmol','NUMERIC(14,4)','>= 0','Pure active propionic acid, in millimoles (monotopic competition modulator)'),
('synthesis_experiments','tfa_mmol','Trifluoroacetic Acid Modulator','MODULATORS & ADDITIVES','mmol','NUMERIC(14,4)','>= 0','Pure active trifluoroacetic acid, in millimoles (strong acid modulator)'),
('synthesis_experiments','cf3so3h_mmol','Triflic Acid Modulator','MODULATORS & ADDITIVES','mmol','NUMERIC(14,4)','>= 0','Pure active trifluoromethanesulfonic acid, in millimoles (superacid modulator)'),
('synthesis_experiments','triethylamine_mmol','Triethylamine Modulator','MODULATORS & ADDITIVES','mmol','NUMERIC(14,4)','>= 0','Pure active triethylamine, in millimoles (basic deprotonating modulator)'),
('synthesis_experiments','meo3s_mmol','Methanesulfonic Acid Modulator','MODULATORS & ADDITIVES','mmol','NUMERIC(14,4)','>= 0','Pure active methanesulfonic acid, in millimoles (acid modulator)'),
('synthesis_experiments','file_hash_md5','Business Natural Key (MD5)','GENERAL INFORMATION','None','VARCHAR(64)','32 hex chars','MD5 computed over 6 business fields (sample_code, synthesis_date, researcher_name, research_unit, metal_center, linker). Anti-duplication gate for the Excel ingestion lane'),
('synthesis_experiments','measurement_status','Record Audit Status','GENERAL INFORMATION','None','VARCHAR(20)','active, superseded','Audit state of the row: active = current version; superseded = replaced by a later ingestion'),
('synthesis_experiments','created_at','Row Creation Timestamp','GENERAL INFORMATION','Timestamp','TIMESTAMPTZ','ISO 8601','When the row was first written to the database (ISO 17025 traceability)'),
('synthesis_experiments','updated_at','Row Update Timestamp','GENERAL INFORMATION','Timestamp','TIMESTAMPTZ','ISO 8601','When the row was last modified by an UPSERT (ISO 17025 traceability)')
ON CONFLICT (table_name, column_name) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    section_name = EXCLUDED.section_name,
    unit = EXCLUDED.unit,
    data_type = EXCLUDED.data_type,
    valid_categories = EXCLUDED.valid_categories,
    description = EXCLUDED.description;

-- =============================================================================
-- 10. Data Dictionary: la tabla characterization_measurements, no documentada
-- =============================================================================
INSERT INTO data_dictionary (table_name, column_name, full_name, section_name, unit, data_type, valid_categories, description)
VALUES
('characterization_measurements','measurement_id','Measurement ID','CHARACTERIZATION','None','UUID','uuid v4','Primary key of the measurement record'),
('characterization_measurements','sample_code','Sample Code (FK)','CHARACTERIZATION','None','VARCHAR(50)','Must exist in synthesis_experiments','Foreign key to the parent synthesis. ON DELETE CASCADE'),
('characterization_measurements','researcher_email','Submitting Researcher Email','CHARACTERIZATION','None','VARCHAR(255)','Must be in authorized_researchers','Email of the person who submitted the file through the n8n portal'),
('characterization_measurements','technique','Characterization Technique','CHARACTERIZATION','None','VARCHAR(30)','PXRD, VT-XRD, TGA, FTIR, ADSORPTION, UV_VIS, SEM, ICP, EA','Analytical technique that produced the measurement'),
('characterization_measurements','operator_name','Instrument Operator','CHARACTERIZATION','Text','VARCHAR(100)','Free text','Person who physically operated the instrument (ISO 17025)'),
('characterization_measurements','measurement_tag','Measurement Tag','CHARACTERIZATION','None','VARCHAR(100)','Free text','Free label distinguishing repeated measurements of the same sample (e.g. as-synthesised, activated, post-cycling)'),
('characterization_measurements','instrument_name','Instrument Name','CHARACTERIZATION','Text','VARCHAR(100)','Free text','Instrument model that produced the raw file'),
('characterization_measurements','file_name','Raw File Name','CHARACTERIZATION','None','VARCHAR(255)','Free text','Original file name as produced by the instrument'),
('characterization_measurements','raw_file_path','Raw File Path','CHARACTERIZATION','None','TEXT','Container path','Path to the raw file inside the data lake, as seen from the container (/home/node/data/...)'),
('characterization_measurements','data_json','Parsed Measurement Payload','CHARACTERIZATION','None','JSONB','header_metadata + raw_data','Parser output. ALWAYS two sub-objects: header_metadata (instrument settings) and raw_data (x_label, y_label and the curve arrays). GIN indexed so any technique can be queried uniformly'),
('characterization_measurements','file_hash','Raw File MD5','CHARACTERIZATION','None','VARCHAR(32)','32 hex chars','MD5 of the raw binary file. Anti-duplication gate for the characterization lane'),
('characterization_measurements','created_at','Ingestion Timestamp','CHARACTERIZATION','Timestamp','TIMESTAMPTZ','ISO 8601','When the measurement was ingested')
ON CONFLICT (table_name, column_name) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    section_name = EXCLUDED.section_name,
    unit = EXCLUDED.unit,
    data_type = EXCLUDED.data_type,
    valid_categories = EXCLUDED.valid_categories,
    description = EXCLUDED.description;

-- =============================================================================
-- 11. RAG - Fase A : capa documental
-- =============================================================================
--  DECISION IRREVERSIBLE GRABADA AQUI
--  VECTOR(1024) = dimension del modelo bge-m3 servido por Ollama en local.
--  Un embedding es una lista de numeros de longitud FIJA que representa el
--  significado de un texto. Cada modelo produce una longitud distinta:
--      nomic-embed-text ......  768
--      bge-m3 ................ 1024   <-- el nuestro
--      text-embedding-3-small  1536
--  Cambiar de modelo obliga a DROP + CREATE + re-indexar todo el corpus.
-- -----------------------------------------------------------------------------

-- 11.1 Un registro por FICHERO fuente. No guarda vectores: es la ficha
--      bibliografica, para poder citar la fuente y no re-indexar dos veces.
CREATE TABLE IF NOT EXISTS rag_documents (
    document_id   BIGSERIAL   PRIMARY KEY,
    file_name     TEXT        NOT NULL,
    file_path     TEXT        NOT NULL,
    file_hash     CHAR(32)    UNIQUE,
    doc_type      TEXT,
    title         TEXT,
    authors       TEXT,
    year          INTEGER,
    doi           TEXT,
    sensitivity   TEXT        NOT NULL DEFAULT 'INTERNAL'
                  CHECK (sensitivity IN ('PUBLIC', 'INTERNAL', 'RESTRICTED')),
    n_chunks      INTEGER     DEFAULT 0,
    indexed_at    TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE  rag_documents             IS 'Un registro por fichero fuente indexado en el RAG. No contiene vectores.';
COMMENT ON COLUMN rag_documents.file_hash   IS 'MD5 del binario. UNIQUE: impide indexar dos veces el mismo fichero.';
COMMENT ON COLUMN rag_documents.sensitivity IS 'PUBLIC=paper publicado; INTERNAL=material del laboratorio; RESTRICTED=no sale nunca de la maquina.';

-- 11.2 Un registro por TROZO de texto + su vector.
--      ATENCION: los nombres id/text/metadata/embedding los impone LangChain,
--      que es lo que corre por debajo del nodo PGVector de n8n.
CREATE TABLE IF NOT EXISTS rag_chunks (
    id          BIGSERIAL   PRIMARY KEY,
    document_id BIGINT      REFERENCES rag_documents(document_id) ON DELETE CASCADE,
    text        TEXT        NOT NULL,
    metadata    JSONB       NOT NULL DEFAULT '{}'::jsonb,
    embedding   VECTOR(1024),
    -- Columna generada: Postgres la recalcula sola al cambiar "text". Es la
    -- representacion LEXICA (que palabras exactas contiene), complementaria al
    -- vector (que SIGNIFICA). Configuracion 'simple' a proposito: 'spanish'
    -- aplicaria stemming y destrozaria la nomenclatura quimica.
    text_tsv    TSVECTOR    GENERATED ALWAYS AS (to_tsvector('simple', coalesce(text, ''))) STORED,
    created_at  TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE  rag_chunks            IS 'Trozos de texto vectorizados. Columnas id/text/metadata/embedding impuestas por LangChain.';
COMMENT ON COLUMN rag_chunks.embedding  IS 'Vector bge-m3 de 1024 dimensiones generado por Ollama en local.';
COMMENT ON COLUMN rag_chunks.text_tsv   IS 'Indice lexico para la mitad no-semantica de la busqueda hibrida.';

-- 11.3 Indices
-- HNSW = indice de vecinos aproximados de pgvector. Sin el la busqueda funciona
-- igual, pero recorriendo la tabla entera.
CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding_hnsw
    ON rag_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_tsv
    ON rag_chunks USING gin (text_tsv);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_metadata
    ON rag_chunks USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_document_id
    ON rag_chunks (document_id);

-- 11.4 Busqueda hibrida con Reciprocal Rank Fusion (RRF)
--  Buscar solo por vector falla con codigos: RS1883 y RS1884 son casi el mismo
--  vector y son muestras distintas. Buscar solo por palabras falla con
--  sinonimos: "porosidad" no encuentra "area superficial BET".
--  Se lanzan las dos busquedas y se fusionan por PUESTO, no por puntuacion
--  (las puntuaciones estan en escalas incomparables): cada trozo suma
--  1/(k + puesto) de cada lista. k=60 es el valor del paper original.
CREATE OR REPLACE FUNCTION rag_hybrid_search(
    query_text      TEXT,
    query_embedding VECTOR(1024),
    match_count     INTEGER DEFAULT 8,
    rrf_k           INTEGER DEFAULT 60
)
RETURNS TABLE (
    chunk_id   BIGINT,
    text       TEXT,
    metadata   JSONB,
    file_name  TEXT,
    rrf_score  DOUBLE PRECISION
)
LANGUAGE sql STABLE
AS $$
WITH semantica AS (
    SELECT c.id,
           ROW_NUMBER() OVER (ORDER BY c.embedding <=> query_embedding) AS puesto
    FROM   rag_chunks c
    WHERE  c.embedding IS NOT NULL
    ORDER  BY c.embedding <=> query_embedding
    LIMIT  match_count * 5
),
lexica AS (
    SELECT c.id,
           ROW_NUMBER() OVER (
               ORDER BY ts_rank_cd(c.text_tsv, plainto_tsquery('simple', query_text)) DESC
           ) AS puesto
    FROM   rag_chunks c
    WHERE  c.text_tsv @@ plainto_tsquery('simple', query_text)
    LIMIT  match_count * 5
)
SELECT c.id,
       c.text,
       c.metadata,
       d.file_name,
       COALESCE(1.0 / (rrf_k + s.puesto), 0.0)
     + COALESCE(1.0 / (rrf_k + l.puesto), 0.0) AS rrf_score
FROM        rag_chunks    c
LEFT  JOIN  semantica     s ON s.id = c.id
LEFT  JOIN  lexica        l ON l.id = c.id
LEFT  JOIN  rag_documents d ON d.document_id = c.document_id
WHERE  s.id IS NOT NULL OR l.id IS NOT NULL
ORDER  BY rrf_score DESC
LIMIT  match_count;
$$;

COMMENT ON FUNCTION rag_hybrid_search IS
  'Busqueda hibrida vector+lexica fusionada por Reciprocal Rank Fusion (k=60).';

-- 11.5 Vista de solo lectura para la herramienta SQL del agente.
--  El agente NUNCA debe poder escribir. Regla dura del roadmap: los datos
--  estructurados NO se vectorizan, se consultan con SQL.
CREATE OR REPLACE VIEW v_agente_muestras AS
SELECT  s.sample_code,
        s.synthesis_date,
        s.researcher_name,
        s.metal_center,
        s.linker,
        COUNT(DISTINCT m.technique)                       AS n_tecnicas,
        ARRAY_AGG(DISTINCT m.technique)
            FILTER (WHERE m.technique IS NOT NULL)        AS tecnicas
FROM        synthesis_experiments        s
LEFT  JOIN  characterization_measurements m ON m.sample_code = s.sample_code
GROUP BY    s.sample_code, s.synthesis_date, s.researcher_name,
            s.metal_center, s.linker;

COMMENT ON VIEW v_agente_muestras IS
  'Vista de solo lectura para el agente RAG. n_tecnicas es la etiqueta debil de interes experimental.';

-- =============================================================================
-- 12. Data Dictionary: documentar las tablas del RAG
-- =============================================================================
INSERT INTO data_dictionary (table_name, column_name, full_name, section_name, unit, data_type, valid_categories, description)
VALUES
('rag_documents','document_id','Document ID','RAG - DOCUMENTS','None','BIGSERIAL','> 0','Primary key of the source document'),
('rag_documents','file_name','Source File Name','RAG - DOCUMENTS','None','TEXT','Free text','Original file name of the indexed document'),
('rag_documents','file_path','Source File Path','RAG - DOCUMENTS','None','TEXT','Container path','Path inside the container (/home/node/data/rag_corpus/...)'),
('rag_documents','file_hash','Source File MD5','RAG - DOCUMENTS','None','CHAR(32)','32 hex chars','MD5 of the binary. UNIQUE: the anti-duplication gate of the RAG ingestion lane'),
('rag_documents','doc_type','Document Type','RAG - DOCUMENTS','None','TEXT','PAPER, PROTOCOL, LAB_NOTEBOOK, THESIS, SOP','Kind of source document'),
('rag_documents','title','Document Title','RAG - DOCUMENTS','Text','TEXT','Free text','Title of the paper or protocol'),
('rag_documents','authors','Authors','RAG - DOCUMENTS','Text','TEXT','Free text','Author list of the source document'),
('rag_documents','year','Publication Year','RAG - DOCUMENTS','Year','INTEGER','1900-2100','Year of publication'),
('rag_documents','doi','DOI','RAG - DOCUMENTS','None','TEXT','10.xxxx/...','Digital Object Identifier, when the document has one'),
('rag_documents','sensitivity','Confidentiality Label','RAG - DOCUMENTS','None','TEXT','PUBLIC, INTERNAL, RESTRICTED','Confidentiality tier. Derived from the sub-folder of rag_corpus. INTERNAL and RESTRICTED must not reach an external LLM without ligand pseudonymisation'),
('rag_documents','n_chunks','Chunk Count','RAG - DOCUMENTS','count','INTEGER','>= 0','Number of chunks the document was split into'),
('rag_documents','indexed_at','Indexing Timestamp','RAG - DOCUMENTS','Timestamp','TIMESTAMPTZ','ISO 8601','When the document was indexed'),
('rag_chunks','id','Chunk ID','RAG - CHUNKS','None','BIGSERIAL','> 0','Primary key of the chunk. Name imposed by LangChain'),
('rag_chunks','document_id','Parent Document (FK)','RAG - CHUNKS','None','BIGINT','Must exist in rag_documents','Foreign key to the source document. ON DELETE CASCADE'),
('rag_chunks','text','Chunk Text','RAG - CHUNKS','Text','TEXT','Free text','The text fragment itself. Name imposed by LangChain'),
('rag_chunks','metadata','Chunk Metadata','RAG - CHUNKS','None','JSONB','Free object','Metadata attached at indexing time (file_name, file_hash, doc_type, sensitivity). GIN indexed for filtering'),
('rag_chunks','embedding','Embedding Vector','RAG - CHUNKS','None','VECTOR(1024)','1024 floats','bge-m3 embedding generated locally by Ollama. The dimension is fixed by the model and cannot change without re-indexing the whole corpus'),
('rag_chunks','text_tsv','Lexical Index','RAG - CHUNKS','None','TSVECTOR','simple config','Generated column. Lexical half of the hybrid search. Uses the simple config (no stemming) to preserve chemical nomenclature'),
('rag_chunks','created_at','Chunk Creation Timestamp','RAG - CHUNKS','Timestamp','TIMESTAMPTZ','ISO 8601','When the chunk was written')
ON CONFLICT (table_name, column_name) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    section_name = EXCLUDED.section_name,
    unit = EXCLUDED.unit,
    data_type = EXCLUDED.data_type,
    valid_categories = EXCLUDED.valid_categories,
    description = EXCLUDED.description;
