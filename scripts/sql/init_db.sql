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
COMMENT ON COLUMN synthesis_experiments.linker IS 'Official primary organic ligand (LIG-x, LIG-x, LIG-x, LIG-x, Tannic acid, BTBSH3, PPV)';
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
('sample_code', 'Sample Code', 'GENERAL INFORMATION', 'None', 'VARCHAR(50)', 'Free text (RS1, SMP-0100)', 'Unique sample identifier for the synthesis batch'),
('synthesis_date', 'Synthesis Date', 'GENERAL INFORMATION', 'Date', 'DATE', 'YYYY-MM-DD', 'Date when the experiment was performed'),
('synthesis_type', 'Synthesis Type', 'GENERAL INFORMATION', 'None', 'VARCHAR(50)', 'HTS, ST, MW, DT', 'Methodology used for the synthesis reaction (HTS: High-throughput; ST: Solvothermal; MW: Microwave; DT: Duran tube)'),
('researcher_name', 'Lead Researcher', 'GENERAL INFORMATION', 'Text', 'VARCHAR(100)', 'Free text (Default: Rubén S.N.)', 'Lead researcher responsible for experiment execution (ISO 17025 / GLP Compliance)'),
('research_unit', 'Research Unit', 'GENERAL INFORMATION', 'Text', 'VARCHAR(100)', 'Free text (Default: APMU)', 'Laboratory department / research group (APMU: Advanced Porous Materials Unit)'),
('reactor_volume_ml', 'Reactor Volume', 'THEORETICAL DESIGN', 'mL', 'NUMERIC(5,1)', '> 0', 'Volume of reactor in milliliters (Default: HTS=2.5, ST=23.0, MW=30.0, DT=8.0)'),
('hts_number', 'HTS Attempt Number', 'GENERAL INFORMATION', 'Text', 'VARCHAR(5)', 'Free text (C1, C2) or N/A', 'High-throughput screening attempt identifier (N/A for non-HTS)'),
('well_position', 'Well Position', 'GENERAL INFORMATION', 'Text', 'VARCHAR(3)', 'Free text (A1, B4) or N/A', 'Specific 24-well plate position (N/A for non-HTS)'),
('metal_center', 'Metal Center', 'GENERAL INFORMATION', 'Element', 'VARCHAR(3)', 'All Transition Metals & Semimetals (Ni, Zr, Bi, Cu, Fe, Zn, Co, Ca, Mo, La)', 'Primary metallic node element center'),
('metal_source', 'Metal Source Precursor', 'GENERAL INFORMATION', 'Formula', 'VARCHAR(100)', 'Ni(NO3)2·6H2O, Bi(NO3)3·5H2O, ZrCl4', 'Chemical precursor salt used as the metal source'),
('linker', 'Organic Linker', 'GENERAL INFORMATION', 'Formula/Name', 'VARCHAR(100)', 'LIG-x, LIG-x, LIG-x, LIG-x, Tannic acid, BTBSH3, PPV', 'Official primary organic ligand building block'),
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
    researcher_email VARCHAR(255) DEFAULT 'researcher@example.org'  -- marcador de posicion: este fichero se publica, -- Email address of responsible researcher
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
VALUES ('researcher@example.org', 'Rubén S.N.', 'lead_researcher', true)
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
--  Buscar solo por vector falla con codigos: SMP-0100 y SMP-0100 son casi el mismo
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

-- =============================================================================
-- 13. RAG - Fase A-bis : metadatos bibliograficos y escalera anti-duplicados
-- =============================================================================
-- Problema que resuelve: el MD5 del binario NO reconoce dos descargas del mismo
-- paper si la editorial estampa una marca de agua (fecha, usuario). Se comprobo
-- empiricamente: la marca es TEXTO dentro del PDF, asi que rompe tanto el hash
-- binario como el hash del texto completo. Por eso la deteccion de duplicados
-- pasa a ser una ESCALERA de tres niveles, y el DOI es el escalon fiable.
-- Todo lo de abajo es idempotente: ADD COLUMN IF NOT EXISTS / OR REPLACE.

-- 13.1 Columnas nuevas de rag_documents ---------------------------------------
ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS text_hash          CHAR(32);
ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS journal            TEXT;
ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS n_pages            INTEGER;
ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS n_images           INTEGER;
ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS file_ext           TEXT;
ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS csl_json           JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS parent_document_id BIGINT
    REFERENCES rag_documents(document_id) ON DELETE SET NULL;

COMMENT ON COLUMN rag_documents.text_hash          IS 'MD5 del titulo + los primeros 3000 caracteres normalizados. Escalon 3 anti-duplicados: sirve para documentos SIN DOI (page proofs, tesis, cuadernos).';
COMMENT ON COLUMN rag_documents.journal            IS 'Revista o editorial. Se guarda en columna propia porque forma parte de la cita que el agente debe dar.';
COMMENT ON COLUMN rag_documents.n_pages            IS 'Numero de paginas del documento fuente.';
COMMENT ON COLUMN rag_documents.n_images           IS 'Numero de imagenes embebidas. Las imagenes NO se almacenan: sus pies de figura ya viajan como texto. Este contador deja la puerta abierta a describirlas con un VLM mas adelante.';
COMMENT ON COLUMN rag_documents.file_ext           IS 'Extension normalizada en minusculas: pdf, docx, txt, md.';
COMMENT ON COLUMN rag_documents.csl_json           IS 'Metadatos bibliograficos completos en formato CSL-JSON, el estandar que exportan Zotero y Mendeley. Lo que no se filtra ni se ordena vive aqui: volumen, paginas, ISSN, abstract, autores con afiliacion.';
COMMENT ON COLUMN rag_documents.parent_document_id IS 'Auto-referencia. Un Supporting Information apunta al paper del que cuelga, de modo que sus trozos se citen con la referencia del articulo padre y no con el nombre del fichero.';

-- 13.2 Indices: DOI y text_hash unicos, pero solo cuando existen ---------------
-- Indice UNIQUE parcial (WHERE ... IS NOT NULL): impide dos filas con el mismo
-- DOI pero permite muchas filas sin DOI, y de paso deja explicita la intencion.
CREATE UNIQUE INDEX IF NOT EXISTS idx_rag_documents_doi
    ON rag_documents (lower(doi)) WHERE doi IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_rag_documents_text_hash
    ON rag_documents (text_hash) WHERE text_hash IS NOT NULL;
CREATE        INDEX IF NOT EXISTS idx_rag_documents_parent
    ON rag_documents (parent_document_id);
CREATE        INDEX IF NOT EXISTS idx_rag_documents_csl
    ON rag_documents USING gin (csl_json);

-- 13.3 La escalera anti-duplicados --------------------------------------------
-- Devuelve como maximo UNA fila: el documento ya indexado que coincide, y por
-- que motivo coincide. Si no devuelve nada, el documento es nuevo.
-- Se consulta ANTES de vectorizar: el danio real de un duplicado no es el disco,
-- es que ese pasaje repetido ocupe dos puestos del top-8 y expulse contexto util.
CREATE OR REPLACE FUNCTION rag_documento_ya_indexado(
    p_file_hash CHAR(32) DEFAULT NULL,
    p_doi       TEXT     DEFAULT NULL,
    p_text_hash CHAR(32) DEFAULT NULL
)
RETURNS TABLE (document_id BIGINT, file_name TEXT, motivo TEXT)
LANGUAGE sql STABLE AS $func$
    SELECT t.document_id, t.file_name, t.motivo
    FROM (
        SELECT d.document_id, d.file_name,
               'nivel 1: MD5 binario identico'::TEXT AS motivo, 1 AS nivel
        FROM   rag_documents d
        WHERE  p_file_hash IS NOT NULL AND d.file_hash = p_file_hash
        UNION ALL
        SELECT d.document_id, d.file_name,
               'nivel 2: mismo DOI (' || d.doi || ')', 2
        FROM   rag_documents d
        WHERE  p_doi IS NOT NULL AND lower(d.doi) = lower(p_doi)
        UNION ALL
        SELECT d.document_id, d.file_name,
               'nivel 3: mismo texto de cabecera', 3
        FROM   rag_documents d
        WHERE  p_text_hash IS NOT NULL AND d.text_hash = p_text_hash
    ) t
    ORDER BY t.nivel
    LIMIT 1;
$func$;

COMMENT ON FUNCTION rag_documento_ya_indexado IS 'Escalera anti-duplicados de tres niveles (MD5 binario -> DOI -> hash del texto de cabecera). Devuelve el documento ya indexado y el motivo, o ninguna fila si es nuevo.';

-- 13.4 Vista de biblioteca: como debe CITAR el agente --------------------------
-- Existe para que el modelo no invente referencias. Le damos la cita ya montada
-- a partir de campos verificados, en vez de pedirle que la reconstruya de memoria.
CREATE OR REPLACE VIEW v_rag_biblioteca AS
SELECT d.document_id,
       d.file_name,
       d.doc_type,
       d.sensitivity,
       d.title,
       d.authors,
       d.year,
       d.journal,
       d.doi,
       d.n_chunks,
       d.n_pages,
       d.n_images,
       d.parent_document_id,
       p.title AS parent_title,
       p.doi   AS parent_doi,
       COALESCE(
           NULLIF(trim(concat_ws(' ',
               NULLIF(d.authors, ''),
               CASE WHEN d.year IS NOT NULL THEN '(' || d.year || ').' END,
               NULLIF(d.title, ''),
               NULLIF(d.journal, ''),
               CASE WHEN d.doi IS NOT NULL THEN 'DOI: ' || d.doi END
           )), ''),
           d.file_name
       ) AS cita
FROM       rag_documents d
LEFT JOIN  rag_documents p ON p.document_id = d.parent_document_id;

COMMENT ON VIEW v_rag_biblioteca IS 'Catalogo del corpus con la cita bibliografica ya construida. Herramienta de solo lectura para el agente: evita que invente referencias.';

-- 13.5 Documentos escaneados: el fallo silencioso mas peligroso del RAG -------
-- Un PDF de imagenes (un cuaderno escaneado) se indexa sin dar ningun error y
-- produce CERO trozos. La ficha aparece en rag_documents, todo parece correcto,
-- y el agente simplemente nunca encuentra nada de ese documento. Marcarlo es la
-- diferencia entre un problema visible y uno invisible.
ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS n_chars   INTEGER;
ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS needs_ocr BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN rag_documents.n_chars   IS 'Caracteres de texto extraibles del documento. Cero = PDF de imagenes.';
COMMENT ON COLUMN rag_documents.needs_ocr IS 'TRUE si el documento no tiene texto suficiente para vectorizar. La ingesta debe saltarselo: indexarlo generaria cero trozos sin dar error.';

CREATE INDEX IF NOT EXISTS idx_rag_documents_needs_ocr
    ON rag_documents (needs_ocr) WHERE needs_ocr;

INSERT INTO data_dictionary
    (table_name, column_name, full_name, section_name, unit, data_type, valid_categories, description)
VALUES
('rag_documents','n_chars','Extractable Characters','RAG - DOCUMENTS','count','INTEGER','>= 0','Characters of machine-readable text. Zero means an image-only PDF'),
('rag_documents','needs_ocr','Needs OCR / VLM','RAG - DOCUMENTS','None','BOOLEAN','TRUE, FALSE','TRUE when the document has too little text to vectorise. Ingestion must skip it: indexing would silently produce zero chunks')
ON CONFLICT (table_name, column_name) DO UPDATE SET
    full_name        = EXCLUDED.full_name,
    section_name     = EXCLUDED.section_name,
    unit             = EXCLUDED.unit,
    data_type        = EXCLUDED.data_type,
    valid_categories = EXCLUDED.valid_categories,
    description      = EXCLUDED.description;

-- 13.6 Procedencia del metadato: no todas las fuentes valen lo mismo ----------
-- Motivo real: Elsevier escribe en los metadatos de sus PDF UN SOLO autor (el
-- de correspondencia). Crossref devuelve los nueve. Sin jerarquia, una segunda
-- pasada del catalogador pisaba los nueve autores buenos con el nombre suelto,
-- porque un COALESCE solo mira si el dato entrante es NULL, no si es MEJOR.
--
-- La regla pasa a ser: un metadato solo se sobrescribe si la fuente que llega
-- vale TANTO O MAS que la que ya estaba almacenada.
ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS metadata_source TEXT
    NOT NULL DEFAULT 'PDF_HEURISTIC';

ALTER TABLE rag_documents DROP CONSTRAINT IF EXISTS rag_documents_metadata_source_check;
ALTER TABLE rag_documents ADD  CONSTRAINT rag_documents_metadata_source_check
    CHECK (metadata_source IN ('PDF_HEURISTIC','CROSSREF','REFERENCE_MANAGER','MANUAL'));

COMMENT ON COLUMN rag_documents.metadata_source IS 'De donde salieron titulo/autores/anio/revista. Jerarquia: PDF_HEURISTIC < CROSSREF < REFERENCE_MANAGER < MANUAL. Una fuente inferior nunca sobrescribe a una superior.';

CREATE OR REPLACE FUNCTION rag_rango_fuente(fuente TEXT)
RETURNS INTEGER LANGUAGE sql IMMUTABLE AS $func$
    SELECT CASE fuente
        WHEN 'MANUAL'            THEN 4   -- corregido a mano: intocable
        WHEN 'REFERENCE_MANAGER' THEN 3   -- Zotero/Mendeley: curado por una persona
        WHEN 'CROSSREF'          THEN 2   -- registro oficial del editor
        WHEN 'PDF_HEURISTIC'     THEN 1   -- adivinado del fichero: el mas fragil
        ELSE 0
    END;
$func$;

COMMENT ON FUNCTION rag_rango_fuente IS 'Convierte el nombre de la fuente de metadatos en un rango numerico comparable.';

-- Reparacion puntual: los documentos cuyo csl_json de Crossref trae mas autores
-- que la columna authors quedaron degradados por el bug descrito arriba. Se
-- reconstruye la lista desde csl_json, que nunca se perdio.
UPDATE rag_documents d
SET    authors = sub.lista,
       metadata_source = 'CROSSREF'
FROM (
    SELECT x.document_id,
           string_agg(trim(coalesce(a->>'given','') || ' ' || coalesce(a->>'family','')),
                      ', ' ORDER BY a.ord) AS lista,
           count(*) AS n
    FROM   rag_documents x,
           jsonb_array_elements(x.csl_json->'author') WITH ORDINALITY AS a(a, ord)
    GROUP  BY x.document_id
) sub
WHERE d.document_id = sub.document_id
  AND sub.n > 1
  AND (d.authors IS NULL
       OR array_length(string_to_array(d.authors, ','), 1) < sub.n);

INSERT INTO data_dictionary
    (table_name, column_name, full_name, section_name, unit, data_type, valid_categories, description)
VALUES
('rag_documents','metadata_source','Metadata Provenance','RAG - DOCUMENTS','None','TEXT','PDF_HEURISTIC, CROSSREF, REFERENCE_MANAGER, MANUAL','Where title/authors/year/journal came from. Ranked: a lower-ranked source never overwrites a higher-ranked one')
ON CONFLICT (table_name, column_name) DO UPDATE SET
    full_name        = EXCLUDED.full_name,
    section_name     = EXCLUDED.section_name,
    unit             = EXCLUDED.unit,
    data_type        = EXCLUDED.data_type,
    valid_categories = EXCLUDED.valid_categories,
    description      = EXCLUDED.description;

-- =============================================================================
-- 14. Data Dictionary: las columnas nuevas de la Fase A-bis
-- =============================================================================
INSERT INTO data_dictionary
    (table_name, column_name, full_name, section_name, unit, data_type, valid_categories, description)
VALUES
('rag_documents','text_hash','Header Text MD5','RAG - DOCUMENTS','None','CHAR(32)','32 hex chars','MD5 of title plus the first 3000 normalised characters. Level 3 of the anti-duplication ladder, for documents with no DOI'),
('rag_documents','journal','Journal','RAG - DOCUMENTS','Text','TEXT','Free text','Journal or publisher, part of the citation the agent must produce'),
('rag_documents','n_pages','Page Count','RAG - DOCUMENTS','count','INTEGER','>= 0','Number of pages in the source document'),
('rag_documents','n_images','Embedded Image Count','RAG - DOCUMENTS','count','INTEGER','>= 0','Number of embedded images. Images are not stored: figure captions already travel as text'),
('rag_documents','file_ext','File Extension','RAG - DOCUMENTS','None','TEXT','pdf, docx, txt, md','Normalised lowercase file extension'),
('rag_documents','csl_json','Bibliographic Metadata','RAG - DOCUMENTS','None','JSONB','CSL-JSON object','Full bibliographic record in CSL-JSON, the format exported by Zotero and Mendeley'),
('rag_documents','parent_document_id','Parent Document','RAG - DOCUMENTS','None','BIGINT','FK to rag_documents','Self-reference: a Supporting Information points at the paper it belongs to')
ON CONFLICT (table_name, column_name) DO UPDATE SET
    full_name        = EXCLUDED.full_name,
    section_name     = EXCLUDED.section_name,
    unit             = EXCLUDED.unit,
    data_type        = EXCLUDED.data_type,
    valid_categories = EXCLUDED.valid_categories,
    description      = EXCLUDED.description;

-- =============================================================================
-- 15. RAG - Fase B : la herramienta SQL del agente (catalogo gobernado)
-- =============================================================================
-- El roadmap lo dice sin rodeos: "no dar SQL libre al LLM". Un $fromAI que
-- escribe la sentencia entera es comodo y es un agujero: nada impide que el
-- modelo lea una columna que no deberia, se traiga 2160 filas de golpe, o
-- construya una consulta que tumbe la base.
--
-- La alternativa es un CATALOGO: un puñado de funciones con parametros
-- tipados. El modelo elige la funcion y rellena los huecos; no redacta SQL.
--
-- Tres capas de gobernanza, cada una independiente de las otras:
--   1. El agente entra con un usuario que SOLO puede ejecutar estas funciones.
--   2. Cada funcion tiene un tope de filas que el modelo no puede saltarse.
--   3. Cada llamada queda escrita en audit_log, sin excepcion.

-- 15.1 Tope global de filas -----------------------------------------------
-- Una funcion del catalogo nunca devuelve mas de esto, pida lo que pida el
-- modelo. Protege el contexto (200 filas de sintesis no caben en un prompt) y
-- protege la base.
CREATE OR REPLACE FUNCTION agente_limite(p_limite INTEGER)
RETURNS INTEGER LANGUAGE sql IMMUTABLE AS $func$
    SELECT LEAST(GREATEST(COALESCE(p_limite, 20), 1), 200);
$func$;

COMMENT ON FUNCTION agente_limite IS 'Recorta cualquier limite pedido al rango 1-200. El agente no puede vaciar la tabla en una sola llamada.';

-- 15.2 Registro de cada llamada -------------------------------------------
-- SECURITY DEFINER: la funcion se ejecuta con los permisos de su PROPIETARIO,
-- no de quien la llama. Asi el usuario de solo lectura provoca una escritura
-- en audit_log sin tener permiso de escritura en ninguna tabla. Es el cajero
-- del banco: tu no puedes abrir la caja fuerte, pero puedes pedirle a quien si
-- puede que haga una operacion concreta y acotada.
-- El SET search_path es obligatorio en toda funcion SECURITY DEFINER: sin el,
-- alguien podria crear una tabla falsa en otro esquema y secuestrar la funcion.
CREATE OR REPLACE FUNCTION agente_auditar(p_accion TEXT, p_detalle TEXT, p_filas INTEGER)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $func$
BEGIN
    INSERT INTO audit_log (agent, action, recipients, verdict, cause, result)
    VALUES ('ALCheMy-RAG-Agent', p_accion, p_filas, 'ALLOWED', p_detalle,
            format('%s filas devueltas', COALESCE(p_filas, 0)));
END;
$func$;

COMMENT ON FUNCTION agente_auditar IS 'Escribe una llamada del agente en audit_log. SECURITY DEFINER para que el usuario de solo lectura pueda dejar rastro sin poder escribir en ninguna tabla.';

-- 15.3 Buscar sintesis por sus condiciones ---------------------------------
-- Todos los parametros son opcionales: NULL significa "no filtres por esto".
-- El patron "p_x IS NULL OR columna = p_x" es lo que permite una sola funcion
-- en lugar de una por combinacion de filtros.
CREATE OR REPLACE FUNCTION agente_buscar_sintesis(
    p_metal      TEXT    DEFAULT NULL,
    p_linker     TEXT    DEFAULT NULL,
    p_temp_min   NUMERIC DEFAULT NULL,
    p_temp_max   NUMERIC DEFAULT NULL,
    p_desde      DATE    DEFAULT NULL,
    p_hasta      DATE    DEFAULT NULL,
    p_limite     INTEGER DEFAULT 20
)
RETURNS TABLE (
    sample_code     VARCHAR,
    synthesis_date  DATE,
    metal_center    VARCHAR,
    linker          VARCHAR,
    temp_target_c   NUMERIC,
    time_hours      NUMERIC,
    lm_ratio        NUMERIC,
    n_tecnicas      BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $func$
DECLARE
    v_limite INTEGER := agente_limite(p_limite);
    v_filas  INTEGER;
BEGIN
    RETURN QUERY
    SELECT s.sample_code, s.synthesis_date, s.metal_center, s.linker,
           s.temp_target_c, s.time_hours, s.lm_ratio,
           (SELECT count(DISTINCT m.technique)
              FROM characterization_measurements m
             WHERE m.sample_code = s.sample_code)
    FROM   synthesis_experiments s
    WHERE  (p_metal    IS NULL OR s.metal_center ILIKE p_metal)
      AND  (p_linker   IS NULL OR s.linker       ILIKE '%' || p_linker || '%')
      AND  (p_temp_min IS NULL OR s.temp_target_c >= p_temp_min)
      AND  (p_temp_max IS NULL OR s.temp_target_c <= p_temp_max)
      AND  (p_desde    IS NULL OR s.synthesis_date >= p_desde)
      AND  (p_hasta    IS NULL OR s.synthesis_date <= p_hasta)
    ORDER  BY s.synthesis_date DESC NULLS LAST, s.sample_code
    LIMIT  v_limite;

    GET DIAGNOSTICS v_filas = ROW_COUNT;
    PERFORM agente_auditar('buscar_sintesis',
        format('metal=%s linker=%s temp=[%s,%s] fecha=[%s,%s] limite=%s',
               p_metal, p_linker, p_temp_min, p_temp_max, p_desde, p_hasta, v_limite),
        v_filas);
END;
$func$;

COMMENT ON FUNCTION agente_buscar_sintesis IS 'Catalogo del agente: busca sintesis filtrando por metal, ligando, temperatura objetivo y fechas. Todos los filtros opcionales.';

-- 15.4 Caracterizacion de una muestra --------------------------------------
-- Devuelve las FICHAS de las medidas, nunca el data_json completo: una curva
-- de PXRD son miles de puntos y ahogaria el contexto del modelo sin aportar
-- nada que pueda razonar.
CREATE OR REPLACE FUNCTION agente_obtener_caracterizacion(
    p_sample_code TEXT,
    p_tecnica     TEXT    DEFAULT NULL,
    p_limite      INTEGER DEFAULT 20
)
RETURNS TABLE (
    sample_code     VARCHAR,
    technique       VARCHAR,
    measurement_tag VARCHAR,
    instrument_name VARCHAR,
    operator_name   VARCHAR,
    file_name       VARCHAR,
    medido_el       TIMESTAMPTZ,
    campos_datos    TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $func$
DECLARE
    v_limite INTEGER := agente_limite(p_limite);
    v_filas  INTEGER;
BEGIN
    RETURN QUERY
    SELECT m.sample_code, m.technique, m.measurement_tag, m.instrument_name,
           m.operator_name, m.file_name, m.created_at,
           (SELECT string_agg(k, ', ' ORDER BY k)
              FROM jsonb_object_keys(COALESCE(m.data_json->'header_metadata',
                                              '{}'::jsonb)) AS k)
    FROM   characterization_measurements m
    WHERE  m.sample_code = p_sample_code
      AND  (p_tecnica IS NULL OR m.technique ILIKE p_tecnica)
    ORDER  BY m.technique, m.created_at DESC
    LIMIT  v_limite;

    GET DIAGNOSTICS v_filas = ROW_COUNT;
    PERFORM agente_auditar('obtener_caracterizacion',
        format('sample_code=%s tecnica=%s', p_sample_code, p_tecnica), v_filas);
END;
$func$;

COMMENT ON FUNCTION agente_obtener_caracterizacion IS 'Catalogo del agente: fichas de las medidas de una muestra. No devuelve data_json: una curva completa ahogaria el contexto.';

-- 15.5 Ficha completa de una muestra ---------------------------------------
CREATE OR REPLACE FUNCTION agente_resumen_muestra(p_sample_code TEXT)
RETURNS TABLE (
    campo TEXT,
    valor TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $func$
DECLARE
    v_filas INTEGER;
BEGIN
    RETURN QUERY
    -- to_jsonb + each convierte la fila ancha (46 columnas) en pares
    -- campo/valor. Se descartan los nulos, que para el modelo son ruido puro:
    -- una muestra tipica solo tiene rellenas 15 de las 46 columnas.
    SELECT j.key, j.value #>> '{}'
    FROM   synthesis_experiments s,
           jsonb_each(to_jsonb(s)) AS j
    WHERE  s.sample_code = p_sample_code
      AND  j.value <> 'null'::jsonb
      AND  j.key NOT IN ('file_hash_md5', 'created_at', 'updated_at')
    ORDER  BY j.key;

    GET DIAGNOSTICS v_filas = ROW_COUNT;
    PERFORM agente_auditar('resumen_muestra',
        format('sample_code=%s', p_sample_code), v_filas);
END;
$func$;

COMMENT ON FUNCTION agente_resumen_muestra IS 'Catalogo del agente: ficha completa de una muestra en pares campo/valor, omitiendo los nulos.';

-- 15.6 Estadisticas agregadas ----------------------------------------------
-- La dimension llega como texto pero NUNCA se concatena en la consulta: se
-- compara contra una lista blanca. Concatenar entrada del modelo dentro de SQL
-- es inyeccion de manual, y da igual que el "atacante" sea un LLM despistado.
CREATE OR REPLACE FUNCTION agente_estadisticas(
    p_dimension TEXT,
    p_limite    INTEGER DEFAULT 20
)
RETURNS TABLE (
    categoria TEXT,
    n_muestras BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $func$
DECLARE
    v_limite INTEGER := agente_limite(p_limite);
    v_filas  INTEGER;
BEGIN
    IF p_dimension NOT IN ('metal_center', 'linker', 'researcher_name',
                           'synthesis_type', 'research_unit', 'anio', 'tecnica') THEN
        RAISE EXCEPTION 'Dimension no permitida: %. Validas: metal_center, linker, researcher_name, synthesis_type, research_unit, anio, tecnica', p_dimension;
    END IF;

    RETURN QUERY
    SELECT t.categoria, t.n FROM (
        SELECT s.metal_center::TEXT AS categoria, count(*) AS n, 'metal_center' AS dim
        FROM synthesis_experiments s GROUP BY 1
        UNION ALL
        SELECT s.linker::TEXT, count(*), 'linker'
        FROM synthesis_experiments s GROUP BY 1
        UNION ALL
        SELECT s.researcher_name::TEXT, count(*), 'researcher_name'
        FROM synthesis_experiments s GROUP BY 1
        UNION ALL
        SELECT s.synthesis_type::TEXT, count(*), 'synthesis_type'
        FROM synthesis_experiments s GROUP BY 1
        UNION ALL
        SELECT s.research_unit::TEXT, count(*), 'research_unit'
        FROM synthesis_experiments s GROUP BY 1
        UNION ALL
        SELECT to_char(s.synthesis_date, 'YYYY'), count(*), 'anio'
        FROM synthesis_experiments s GROUP BY 1
        UNION ALL
        SELECT m.technique::TEXT, count(*), 'tecnica'
        FROM characterization_measurements m GROUP BY 1
    ) t
    WHERE t.dim = p_dimension
    ORDER BY t.n DESC
    LIMIT v_limite;

    GET DIAGNOSTICS v_filas = ROW_COUNT;
    PERFORM agente_auditar('estadisticas',
        format('dimension=%s', p_dimension), v_filas);
END;
$func$;

COMMENT ON FUNCTION agente_estadisticas IS 'Catalogo del agente: conteos agrupados por una dimension de una lista blanca. La dimension nunca se concatena en la consulta.';

-- 15.7 Catalogo de la biblioteca documental --------------------------------
CREATE OR REPLACE FUNCTION agente_buscar_biblioteca(
    p_texto  TEXT    DEFAULT NULL,
    p_anio   INTEGER DEFAULT NULL,
    p_limite INTEGER DEFAULT 20
)
RETURNS TABLE (
    document_id BIGINT,
    cita        TEXT,
    doi         TEXT,
    n_chunks    INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $func$
DECLARE
    v_limite INTEGER := agente_limite(p_limite);
    v_filas  INTEGER;
BEGIN
    RETURN QUERY
    SELECT b.document_id, b.cita, b.doi, b.n_chunks
    FROM   v_rag_biblioteca b
    WHERE  (p_texto IS NULL
            OR b.title ILIKE '%' || p_texto || '%'
            OR b.authors ILIKE '%' || p_texto || '%'
            OR b.journal ILIKE '%' || p_texto || '%')
      AND  (p_anio IS NULL OR b.year = p_anio)
      AND  b.sensitivity = 'PUBLIC'
    ORDER  BY b.year DESC NULLS LAST
    LIMIT  v_limite;

    GET DIAGNOSTICS v_filas = ROW_COUNT;
    PERFORM agente_auditar('buscar_biblioteca',
        format('texto=%s anio=%s', p_texto, p_anio), v_filas);
END;
$func$;

COMMENT ON FUNCTION agente_buscar_biblioteca IS 'Catalogo del agente: que documentos hay en el corpus y como se citan. Solo PUBLIC.';

-- 15.8 El usuario de solo lectura del agente -------------------------------
-- No se le da SELECT sobre ninguna tabla. Solo puede EJECUTAR el catalogo.
-- Aunque el modelo intentase escribir SQL libre, no tendria sobre que.
DO $bloque$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'alchemy_agente') THEN
        CREATE ROLE alchemy_agente LOGIN PASSWORD 'cambiar_en_env';
    END IF;
END;
$bloque$;

REVOKE ALL ON SCHEMA public FROM alchemy_agente;
GRANT  USAGE ON SCHEMA public TO alchemy_agente;

-- Por defecto PostgreSQL concede EXECUTE a PUBLIC en cada funcion nueva.
-- Se revoca para que la concesion sea explicita y auditable.
REVOKE ALL ON FUNCTION agente_buscar_sintesis(TEXT,TEXT,NUMERIC,NUMERIC,DATE,DATE,INTEGER)      FROM PUBLIC;
REVOKE ALL ON FUNCTION agente_obtener_caracterizacion(TEXT,TEXT,INTEGER)                        FROM PUBLIC;
REVOKE ALL ON FUNCTION agente_resumen_muestra(TEXT)                                             FROM PUBLIC;
REVOKE ALL ON FUNCTION agente_estadisticas(TEXT,INTEGER)                                        FROM PUBLIC;
REVOKE ALL ON FUNCTION agente_buscar_biblioteca(TEXT,INTEGER,INTEGER)                           FROM PUBLIC;
REVOKE ALL ON FUNCTION agente_auditar(TEXT,TEXT,INTEGER)                                        FROM PUBLIC;

GRANT EXECUTE ON FUNCTION agente_buscar_sintesis(TEXT,TEXT,NUMERIC,NUMERIC,DATE,DATE,INTEGER)   TO alchemy_agente;
GRANT EXECUTE ON FUNCTION agente_obtener_caracterizacion(TEXT,TEXT,INTEGER)                     TO alchemy_agente;
GRANT EXECUTE ON FUNCTION agente_resumen_muestra(TEXT)                                          TO alchemy_agente;
GRANT EXECUTE ON FUNCTION agente_estadisticas(TEXT,INTEGER)                                     TO alchemy_agente;
GRANT EXECUTE ON FUNCTION agente_buscar_biblioteca(TEXT,INTEGER,INTEGER)                        TO alchemy_agente;
GRANT EXECUTE ON FUNCTION agente_limite(INTEGER)                                                TO alchemy_agente;

-- El diccionario si se lee directamente: es la documentacion del esquema, y es
-- justo lo que hace fiable a un agente que consulta datos.
GRANT SELECT ON data_dictionary TO alchemy_agente;

-- La busqueda documental la ejecuta el nodo de n8n contra rag_chunks.
GRANT SELECT ON rag_chunks    TO alchemy_agente;
GRANT SELECT ON rag_documents TO alchemy_agente;
GRANT EXECUTE ON FUNCTION rag_hybrid_search(TEXT, VECTOR, INTEGER, INTEGER) TO alchemy_agente;

-- =============================================================================
-- 16. RAG - Phase B-bis : English naming, caller identity, full chat audit
-- =============================================================================
-- Three things at once, because they touch the same objects:
--
--   1. NAMING. The rest of the schema is English (synthesis_experiments,
--      characterization_measurements). The RAG layer drifted into Spanish.
--      Renamed for consistency. This is the cheapest moment to do it.
--
--   2. IDENTITY. Until now every chat user reached the database as the same
--      role, so audit_log could say WHAT was asked but never BY WHOM.
--
--   3. CONVERSATION AUDIT. audit_log records tool calls. It never recorded the
--      question the human asked nor the answer the model gave, which is the
--      part a reviewer actually wants to read.
--
-- NOTE ON DROP: this section drops FUNCTIONS and VIEWS, never tables and never
-- rows. A function is code, not data; dropping a superseded one loses nothing
-- and keeps the script idempotent. No DROP TABLE / TRUNCATE / DELETE exists
-- anywhere in this file.

-- 16.1 Who is asking ---------------------------------------------------------
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS actor_email TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS session_id  TEXT;

COMMENT ON COLUMN audit_log.actor_email IS 'Email of the person on whose behalf the agent acted. Supplied by the workflow after whitelist validation, never by the language model.';
COMMENT ON COLUMN audit_log.session_id  IS 'Chat session the action belongs to, so a whole conversation can be reconstructed.';

CREATE INDEX IF NOT EXISTS idx_audit_log_actor   ON audit_log (actor_email);
CREATE INDEX IF NOT EXISTS idx_audit_log_session ON audit_log (session_id);

-- 16.2 The conversation log --------------------------------------------------
-- One row per exchange. Separate from audit_log on purpose: audit_log is a
-- ledger of ACTIONS (one row per tool call), this is a transcript of the
-- DIALOGUE. A single question can produce four tool calls; you want both views.
CREATE TABLE IF NOT EXISTS agent_chat_log (
    chat_id      BIGSERIAL PRIMARY KEY,
    session_id   TEXT,
    actor_email  TEXT,
    question     TEXT,
    answer       TEXT,
    verdict      TEXT NOT NULL DEFAULT 'ALLOWED'
                 CHECK (verdict IN ('ALLOWED', 'DENIED', 'ERROR')),
    cause        TEXT,
    created_at   TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE  agent_chat_log            IS 'Transcript of every exchange with the RAG agent: who asked, what they asked, what was answered. Complements audit_log, which logs tool calls rather than dialogue.';
COMMENT ON COLUMN agent_chat_log.verdict    IS 'ALLOWED = answered; DENIED = caller not on the whitelist; ERROR = the run failed.';
COMMENT ON COLUMN agent_chat_log.actor_email IS 'Claimed identity of the caller, validated against authorized_researchers. A typed email is accountability, not authentication.';

CREATE INDEX IF NOT EXISTS idx_agent_chat_log_session ON agent_chat_log (session_id);
CREATE INDEX IF NOT EXISTS idx_agent_chat_log_actor   ON agent_chat_log (actor_email);

-- 16.3 Whitelist check -------------------------------------------------------
-- Returns whether this email may use the agent, and leaves a trace either way.
-- Deliberately honest about what it is: the email arrives as a CLAIM from the
-- chat. It gives accountability (every action is attributed and reviewable),
-- not authentication (nothing proves the person is who they say). Real proof
-- needs a login layer in front of the chat; this is the hook it will plug into.
CREATE OR REPLACE FUNCTION agent_authorise(p_email TEXT, p_session TEXT DEFAULT NULL)
RETURNS TABLE (allowed BOOLEAN, researcher_name TEXT, role TEXT, reason TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $func$
DECLARE
    v_row  authorized_researchers%ROWTYPE;
    v_mail TEXT := lower(trim(COALESCE(p_email, '')));
BEGIN
    SELECT * INTO v_row FROM authorized_researchers a
     WHERE lower(a.email) = v_mail;

    IF v_mail = '' THEN
        allowed := FALSE; researcher_name := NULL; role := NULL;
        reason := 'No identity supplied';
    ELSIF NOT FOUND THEN
        allowed := FALSE; researcher_name := NULL; role := NULL;
        reason := format('%s is not on the researcher whitelist', v_mail);
    ELSIF NOT COALESCE(v_row.active, FALSE) THEN
        allowed := FALSE; researcher_name := v_row.researcher_name; role := v_row.role;
        reason := format('%s is on the whitelist but deactivated', v_mail);
    ELSE
        allowed := TRUE; researcher_name := v_row.researcher_name; role := v_row.role;
        reason := 'Authorised';
        UPDATE authorized_researchers a SET last_seen = now()
         WHERE lower(a.email) = v_mail;
    END IF;

    INSERT INTO audit_log (agent, action, verdict, cause, result, actor_email, session_id)
    VALUES ('ALCheMy-RAG-Agent', 'AUTHORISE',
            CASE WHEN allowed THEN 'ALLOWED' ELSE 'DENIED' END,
            reason, COALESCE(researcher_name, 'unknown'), v_mail, p_session);

    RETURN NEXT;
END;
$func$;

COMMENT ON FUNCTION agent_authorise IS 'Checks an email against authorized_researchers and records the attempt. Accountability, not authentication: the email is a claim made by the caller.';

-- 16.4 Record one exchange ---------------------------------------------------
CREATE OR REPLACE FUNCTION agent_log_exchange(
    p_session TEXT, p_actor TEXT, p_question TEXT, p_answer TEXT,
    p_verdict TEXT DEFAULT 'ALLOWED', p_cause TEXT DEFAULT NULL)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $func$
DECLARE v_id BIGINT;
BEGIN
    INSERT INTO agent_chat_log (session_id, actor_email, question, answer, verdict, cause)
    VALUES (p_session, lower(nullif(trim(coalesce(p_actor,'')),'')),
            p_question, p_answer, COALESCE(p_verdict,'ALLOWED'), p_cause)
    RETURNING chat_id INTO v_id;
    RETURN v_id;
END;
$func$;

COMMENT ON FUNCTION agent_log_exchange IS 'Writes one question/answer pair into agent_chat_log.';

-- 16.5 Renamed helpers -------------------------------------------------------
CREATE OR REPLACE FUNCTION rag_source_rank(source TEXT)
RETURNS INTEGER LANGUAGE sql IMMUTABLE AS $func$
    SELECT CASE source
        WHEN 'MANUAL'            THEN 4   -- corrected by hand: untouchable
        WHEN 'REFERENCE_MANAGER' THEN 3   -- Zotero/Mendeley: curated by a person
        WHEN 'CROSSREF'          THEN 2   -- the publisher's official record
        WHEN 'PDF_HEURISTIC'     THEN 1   -- guessed from the file: the weakest
        ELSE 0
    END;
$func$;

CREATE OR REPLACE FUNCTION rag_find_existing_document(
    p_file_hash CHAR(32) DEFAULT NULL,
    p_doi       TEXT     DEFAULT NULL,
    p_text_hash CHAR(32) DEFAULT NULL
)
RETURNS TABLE (document_id BIGINT, file_name TEXT, motivo TEXT)
LANGUAGE sql STABLE AS $func$
    SELECT t.document_id, t.file_name, t.motivo
    FROM (
        SELECT d.document_id, d.file_name,
               'nivel 1: MD5 binario identico'::TEXT AS motivo, 1 AS nivel
        FROM   rag_documents d
        WHERE  p_file_hash IS NOT NULL AND d.file_hash = p_file_hash
        UNION ALL
        SELECT d.document_id, d.file_name,
               'nivel 2: mismo DOI (' || d.doi || ')', 2
        FROM   rag_documents d
        WHERE  p_doi IS NOT NULL AND lower(d.doi) = lower(p_doi)
        UNION ALL
        SELECT d.document_id, d.file_name,
               'nivel 3: mismo texto de cabecera', 3
        FROM   rag_documents d
        WHERE  p_text_hash IS NOT NULL AND d.text_hash = p_text_hash
    ) t
    ORDER BY t.nivel
    LIMIT 1;
$func$;

COMMENT ON FUNCTION rag_find_existing_document IS 'Three-level anti-duplication ladder (binary MD5 -> DOI -> header text hash). Returns the already indexed document and why it matched, or no row if it is new.';

CREATE OR REPLACE VIEW v_rag_library AS SELECT * FROM v_rag_biblioteca;
COMMENT ON VIEW v_rag_library IS 'Corpus catalogue with the citation already assembled. Read-only tool for the agent so it never invents a reference.';

CREATE OR REPLACE VIEW v_agent_samples AS SELECT * FROM v_agente_muestras;
COMMENT ON VIEW v_agent_samples IS 'One row per synthesised sample with its metal, linker, date and how many characterisation techniques it has.';

-- 16.6 The query catalogue, in English, with a caller ------------------------
-- Every function now takes p_actor as its FIRST parameter. It is filled by the
-- workflow from the validated identity, NEVER by the language model: letting
-- the model state who it is acting for would make the audit trail worthless.
CREATE OR REPLACE FUNCTION agent_row_limit(p_limit INTEGER)
RETURNS INTEGER LANGUAGE sql IMMUTABLE AS $func$
    SELECT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 200);
$func$;

CREATE OR REPLACE FUNCTION agent_audit(
    p_actor TEXT, p_session TEXT, p_action TEXT, p_detail TEXT, p_rows INTEGER)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $func$
BEGIN
    INSERT INTO audit_log (agent, action, recipients, verdict, cause, result,
                           actor_email, session_id)
    VALUES ('ALCheMy-RAG-Agent', p_action, p_rows, 'ALLOWED', p_detail,
            format('%s rows returned', COALESCE(p_rows, 0)),
            lower(nullif(trim(coalesce(p_actor,'')),'')), p_session);
END;
$func$;

CREATE OR REPLACE FUNCTION agent_search_synthesis(
    p_actor    TEXT    DEFAULT NULL,
    p_session  TEXT    DEFAULT NULL,
    p_metal    TEXT    DEFAULT NULL,
    p_linker   TEXT    DEFAULT NULL,
    p_temp_min NUMERIC DEFAULT NULL,
    p_temp_max NUMERIC DEFAULT NULL,
    p_from     DATE    DEFAULT NULL,
    p_to       DATE    DEFAULT NULL,
    p_limit    INTEGER DEFAULT 20
)
RETURNS TABLE (
    sample_code    VARCHAR, synthesis_date DATE,   metal_center VARCHAR,
    linker         VARCHAR, temp_target_c  NUMERIC, time_hours  NUMERIC,
    lm_ratio       NUMERIC, n_techniques   BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $func$
DECLARE v_limit INTEGER := agent_row_limit(p_limit); v_rows INTEGER;
BEGIN
    RETURN QUERY
    SELECT s.sample_code, s.synthesis_date, s.metal_center, s.linker,
           s.temp_target_c, s.time_hours, s.lm_ratio,
           (SELECT count(DISTINCT m.technique) FROM characterization_measurements m
             WHERE m.sample_code = s.sample_code)
    FROM   synthesis_experiments s
    WHERE  (p_metal    IS NULL OR s.metal_center ILIKE p_metal)
      AND  (p_linker   IS NULL OR s.linker ILIKE '%' || p_linker || '%')
      AND  (p_temp_min IS NULL OR s.temp_target_c >= p_temp_min)
      AND  (p_temp_max IS NULL OR s.temp_target_c <= p_temp_max)
      AND  (p_from     IS NULL OR s.synthesis_date >= p_from)
      AND  (p_to       IS NULL OR s.synthesis_date <= p_to)
    ORDER  BY s.synthesis_date DESC NULLS LAST, s.sample_code
    LIMIT  v_limit;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    PERFORM agent_audit(p_actor, p_session, 'search_synthesis',
        format('metal=%s linker=%s temp=[%s,%s] date=[%s,%s] limit=%s',
               p_metal, p_linker, p_temp_min, p_temp_max, p_from, p_to, v_limit), v_rows);
END;
$func$;

CREATE OR REPLACE FUNCTION agent_get_characterisation(
    p_actor TEXT DEFAULT NULL, p_session TEXT DEFAULT NULL,
    p_sample_code TEXT DEFAULT NULL, p_technique TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    sample_code VARCHAR, technique VARCHAR, measurement_tag VARCHAR,
    instrument_name VARCHAR, operator_name VARCHAR, file_name VARCHAR,
    measured_at TIMESTAMPTZ, data_fields TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $func$
DECLARE v_limit INTEGER := agent_row_limit(p_limit); v_rows INTEGER;
BEGIN
    RETURN QUERY
    SELECT m.sample_code, m.technique, m.measurement_tag, m.instrument_name,
           m.operator_name, m.file_name, m.created_at,
           (SELECT string_agg(k, ', ' ORDER BY k)
              FROM jsonb_object_keys(COALESCE(m.data_json->'header_metadata','{}'::jsonb)) AS k)
    FROM   characterization_measurements m
    WHERE  m.sample_code = p_sample_code
      AND  (p_technique IS NULL OR m.technique ILIKE p_technique)
    ORDER  BY m.technique, m.created_at DESC
    LIMIT  v_limit;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    PERFORM agent_audit(p_actor, p_session, 'get_characterisation',
        format('sample_code=%s technique=%s', p_sample_code, p_technique), v_rows);
END;
$func$;

CREATE OR REPLACE FUNCTION agent_sample_summary(
    p_actor TEXT DEFAULT NULL, p_session TEXT DEFAULT NULL,
    p_sample_code TEXT DEFAULT NULL
)
RETURNS TABLE (field TEXT, value TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $func$
DECLARE v_rows INTEGER;
BEGIN
    RETURN QUERY
    SELECT j.key, j.value #>> '{}'
    FROM   synthesis_experiments s, jsonb_each(to_jsonb(s)) AS j
    WHERE  s.sample_code = p_sample_code
      AND  j.value <> 'null'::jsonb
      AND  j.key NOT IN ('file_hash_md5', 'created_at', 'updated_at')
    ORDER  BY j.key;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    PERFORM agent_audit(p_actor, p_session, 'sample_summary',
        format('sample_code=%s', p_sample_code), v_rows);
END;
$func$;

CREATE OR REPLACE FUNCTION agent_statistics(
    p_actor TEXT DEFAULT NULL, p_session TEXT DEFAULT NULL,
    p_dimension TEXT DEFAULT NULL, p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (category TEXT, n_samples BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $func$
DECLARE v_limit INTEGER := agent_row_limit(p_limit); v_rows INTEGER;
BEGIN
    IF p_dimension NOT IN ('metal_center','linker','researcher_name',
                           'synthesis_type','research_unit','year','technique') THEN
        RAISE EXCEPTION 'Dimension not allowed: %. Valid: metal_center, linker, researcher_name, synthesis_type, research_unit, year, technique', p_dimension;
    END IF;

    RETURN QUERY
    SELECT t.category, t.n FROM (
        SELECT s.metal_center::TEXT AS category, count(*) AS n, 'metal_center' AS dim
          FROM synthesis_experiments s GROUP BY 1
        UNION ALL SELECT s.linker::TEXT, count(*), 'linker'
          FROM synthesis_experiments s GROUP BY 1
        UNION ALL SELECT s.researcher_name::TEXT, count(*), 'researcher_name'
          FROM synthesis_experiments s GROUP BY 1
        UNION ALL SELECT s.synthesis_type::TEXT, count(*), 'synthesis_type'
          FROM synthesis_experiments s GROUP BY 1
        UNION ALL SELECT s.research_unit::TEXT, count(*), 'research_unit'
          FROM synthesis_experiments s GROUP BY 1
        UNION ALL SELECT to_char(s.synthesis_date,'YYYY'), count(*), 'year'
          FROM synthesis_experiments s GROUP BY 1
        UNION ALL SELECT m.technique::TEXT, count(*), 'technique'
          FROM characterization_measurements m GROUP BY 1
    ) t
    WHERE t.dim = p_dimension
    ORDER BY t.n DESC
    LIMIT v_limit;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    PERFORM agent_audit(p_actor, p_session, 'statistics',
        format('dimension=%s', p_dimension), v_rows);
END;
$func$;

CREATE OR REPLACE FUNCTION agent_search_library(
    p_actor TEXT DEFAULT NULL, p_session TEXT DEFAULT NULL,
    p_text TEXT DEFAULT NULL, p_year INTEGER DEFAULT NULL,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (document_id BIGINT, citation TEXT, doi TEXT, n_chunks INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $func$
DECLARE v_limit INTEGER := agent_row_limit(p_limit); v_rows INTEGER;
BEGIN
    RETURN QUERY
    SELECT b.document_id, b.cita, b.doi, b.n_chunks
    FROM   v_rag_library b
    WHERE  (p_text IS NULL
            OR b.title ILIKE '%' || p_text || '%'
            OR b.authors ILIKE '%' || p_text || '%'
            OR b.journal ILIKE '%' || p_text || '%')
      AND  (p_year IS NULL OR b.year = p_year)
      AND  b.sensitivity = 'PUBLIC'
    ORDER  BY b.year DESC NULLS LAST
    LIMIT  v_limit;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    PERFORM agent_audit(p_actor, p_session, 'search_library',
        format('text=%s year=%s', p_text, p_year), v_rows);
END;
$func$;

-- 16.7 Retire the Spanish-named versions -------------------------------------
-- Functions and views only. No table, no row, is ever dropped in this file.
DROP FUNCTION IF EXISTS agente_buscar_sintesis(TEXT,TEXT,NUMERIC,NUMERIC,DATE,DATE,INTEGER);
DROP FUNCTION IF EXISTS agente_obtener_caracterizacion(TEXT,TEXT,INTEGER);
DROP FUNCTION IF EXISTS agente_resumen_muestra(TEXT);
DROP FUNCTION IF EXISTS agente_estadisticas(TEXT,INTEGER);
DROP FUNCTION IF EXISTS agente_buscar_biblioteca(TEXT,INTEGER,INTEGER);
DROP FUNCTION IF EXISTS agente_auditar(TEXT,TEXT,INTEGER);
DROP FUNCTION IF EXISTS agente_limite(INTEGER);
DROP FUNCTION IF EXISTS rag_documento_ya_indexado(CHAR,TEXT,CHAR);
DROP FUNCTION IF EXISTS rag_rango_fuente(TEXT);

-- 16.8 Permissions -----------------------------------------------------------
DO $block$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'alchemy_agent') THEN
        -- Reuse the existing role if the Spanish-named one is already there,
        -- so the password stored in .env keeps working.
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'alchemy_agente') THEN
            ALTER ROLE alchemy_agente RENAME TO alchemy_agent;
        ELSE
            CREATE ROLE alchemy_agent LOGIN PASSWORD 'set_me_in_env';
        END IF;
    END IF;
END;
$block$;

GRANT USAGE ON SCHEMA public TO alchemy_agent;

REVOKE ALL ON FUNCTION agent_search_synthesis(TEXT,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,DATE,DATE,INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION agent_get_characterisation(TEXT,TEXT,TEXT,TEXT,INTEGER)                       FROM PUBLIC;
REVOKE ALL ON FUNCTION agent_sample_summary(TEXT,TEXT,TEXT)                                          FROM PUBLIC;
REVOKE ALL ON FUNCTION agent_statistics(TEXT,TEXT,TEXT,INTEGER)                                      FROM PUBLIC;
REVOKE ALL ON FUNCTION agent_search_library(TEXT,TEXT,TEXT,INTEGER,INTEGER)                          FROM PUBLIC;
REVOKE ALL ON FUNCTION agent_audit(TEXT,TEXT,TEXT,TEXT,INTEGER)                                      FROM PUBLIC;
REVOKE ALL ON FUNCTION agent_authorise(TEXT,TEXT)                                                    FROM PUBLIC;
REVOKE ALL ON FUNCTION agent_log_exchange(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT)                             FROM PUBLIC;

GRANT EXECUTE ON FUNCTION agent_search_synthesis(TEXT,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,DATE,DATE,INTEGER) TO alchemy_agent;
GRANT EXECUTE ON FUNCTION agent_get_characterisation(TEXT,TEXT,TEXT,TEXT,INTEGER)                       TO alchemy_agent;
GRANT EXECUTE ON FUNCTION agent_sample_summary(TEXT,TEXT,TEXT)                                          TO alchemy_agent;
GRANT EXECUTE ON FUNCTION agent_statistics(TEXT,TEXT,TEXT,INTEGER)                                      TO alchemy_agent;
GRANT EXECUTE ON FUNCTION agent_search_library(TEXT,TEXT,TEXT,INTEGER,INTEGER)                          TO alchemy_agent;
GRANT EXECUTE ON FUNCTION agent_authorise(TEXT,TEXT)                                                    TO alchemy_agent;
GRANT EXECUTE ON FUNCTION agent_log_exchange(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT)                             TO alchemy_agent;
GRANT EXECUTE ON FUNCTION agent_row_limit(INTEGER)                                                      TO alchemy_agent;
GRANT EXECUTE ON FUNCTION rag_hybrid_search(TEXT, VECTOR, INTEGER, INTEGER)                             TO alchemy_agent;

GRANT SELECT ON data_dictionary TO alchemy_agent;
GRANT SELECT ON rag_chunks      TO alchemy_agent;
GRANT SELECT ON rag_documents   TO alchemy_agent;

-- =============================================================================
-- 17. Data Dictionary: agent_chat_log and the new audit_log columns
-- =============================================================================
INSERT INTO data_dictionary
    (table_name, column_name, full_name, section_name, unit, data_type, valid_categories, description)
VALUES
('audit_log','actor_email','Actor Email','GOVERNANCE','None','TEXT','Email or NULL','Person on whose behalf the agent acted. Set by the workflow after whitelist validation, never by the language model'),
('audit_log','session_id','Chat Session','GOVERNANCE','None','TEXT','Free text','Chat session the action belongs to, so a whole conversation can be reconstructed'),
('agent_chat_log','chat_id','Exchange ID','AGENT CHAT LOG','None','BIGSERIAL','> 0','Primary key of the exchange'),
('agent_chat_log','session_id','Chat Session','AGENT CHAT LOG','None','TEXT','Free text','Groups the exchanges of one conversation'),
('agent_chat_log','actor_email','Actor Email','AGENT CHAT LOG','None','TEXT','Email or NULL','Claimed identity of the caller, validated against authorized_researchers'),
('agent_chat_log','question','Question','AGENT CHAT LOG','Text','TEXT','Free text','Exactly what the human asked'),
('agent_chat_log','answer','Answer','AGENT CHAT LOG','Text','TEXT','Free text','Exactly what the agent replied'),
('agent_chat_log','verdict','Verdict','AGENT CHAT LOG','None','TEXT','ALLOWED, DENIED, ERROR','ALLOWED = answered; DENIED = caller not on the whitelist; ERROR = the run failed'),
('agent_chat_log','cause','Cause','AGENT CHAT LOG','Text','TEXT','Free text','Why the exchange was denied or failed'),
('agent_chat_log','created_at','Logged At','AGENT CHAT LOG','None','TIMESTAMPTZ','ISO timestamp','When the exchange happened')
ON CONFLICT (table_name, column_name) DO UPDATE SET
    full_name        = EXCLUDED.full_name,
    section_name     = EXCLUDED.section_name,
    unit             = EXCLUDED.unit,
    data_type        = EXCLUDED.data_type,
    valid_categories = EXCLUDED.valid_categories,
    description      = EXCLUDED.description;


-- =============================================================================
-- 18. Data Dictionary: remaining undocumented columns (audit_log,
--     authorized_researchers, characterization_measurements.researcher_name)
-- =============================================================================
--  Detected 2026-08-25 by a full audit comparing information_schema.columns
--  against data_dictionary: 40 real columns had no row here. 26 of those
--  belong to job_leads (scripts/ddl_job_search.sql), an unrelated personal
--  project sharing this same Postgres instance - out of scope for ALCheMy's
--  own dictionary. The remaining 14 are genuinely part of this schema and are
--  documented below.
-- -----------------------------------------------------------------------------
INSERT INTO data_dictionary
    (table_name, column_name, full_name, section_name, unit, data_type, valid_categories, description)
VALUES
('audit_log','log_id','Log Entry ID','GOVERNANCE','None','UUID','uuid v4','Primary key of the audit row'),
('audit_log','created_at','Logged At','GOVERNANCE','Timestamp','TIMESTAMPTZ','ISO 8601','When the action happened'),
('audit_log','agent','Acting Agent','GOVERNANCE','None','VARCHAR(100)','Free text, e.g. alchemy_ingestion_pipeline','Which automated process performed the action - not a human, a named pipeline/workflow'),
('audit_log','action','Action','GOVERNANCE','None','VARCHAR(100)','Free text','What was attempted, e.g. an SQL catalogue call or an ingestion step'),
('audit_log','recipients','Recipients','GOVERNANCE','None','INTEGER','>= 0','Rows returned or affected by the action, when applicable'),
('audit_log','verdict','Verdict','GOVERNANCE','None','VARCHAR(50)','ALLOW, DENY, ERROR','Whether the action was permitted, blocked, or failed'),
('audit_log','cause','Cause','GOVERNANCE','Text','TEXT','Free text','Why the verdict was reached - the reason a request was denied or a run failed'),
('audit_log','result','Result','GOVERNANCE','None','VARCHAR(100)','Free text, e.g. EXECUTED','Final outcome of the action'),
('authorized_researchers','email','Researcher Email','GOVERNANCE','None','VARCHAR(255)','Valid email, primary key','Identity used to authorise a caller of the RAG agent or the ingestion webhook'),
('authorized_researchers','researcher_name','Researcher Name','GOVERNANCE','Text','VARCHAR(100)','Free text','Human-readable name shown alongside the email'),
('authorized_researchers','role','Role','GOVERNANCE','None','VARCHAR(50)','Free text, e.g. lead_researcher, guest_demo','Coarse role label - not yet used to scope permissions, only to describe who the person is'),
('authorized_researchers','active','Active Flag','GOVERNANCE','None','BOOLEAN','true / false','Whether this identity is currently allowed in. Set to false to revoke access without deleting history'),
('authorized_researchers','last_seen','Last Seen','GOVERNANCE','Timestamp','TIMESTAMPTZ','ISO 8601','Updated every time this identity successfully authenticates - a simple presence/activity signal'),
('characterization_measurements','researcher_name','Principal Researcher','CHARACTERIZATION','Text','VARCHAR(100)','Free text','Researcher responsible for the sample being characterised (distinct from operator_name, who ran the instrument)')
ON CONFLICT (table_name, column_name) DO UPDATE SET
    full_name        = EXCLUDED.full_name,
    section_name     = EXCLUDED.section_name,
    unit             = EXCLUDED.unit,
    data_type        = EXCLUDED.data_type,
    valid_categories = EXCLUDED.valid_categories,
    description      = EXCLUDED.description;

-- =============================================================================
-- 18b. Data Dictionary: the data_dictionary table documenting itself
-- =============================================================================

INSERT INTO data_dictionary
    (table_name, column_name, full_name, section_name, unit, data_type, valid_categories, description)
VALUES
('data_dictionary','id','Row ID','GOVERNANCE','None','SERIAL','> 0','Primary key of the dictionary row itself'),
('data_dictionary','table_name','Documented Table','GOVERNANCE','None','TEXT','Must match a real table name','Which table this row describes a column of'),
('data_dictionary','column_name','Documented Column','GOVERNANCE','None','VARCHAR(100)','Must match a real column name','Which column of that table this row describes'),
('data_dictionary','full_name','Human Name','GOVERNANCE','Text','VARCHAR(150)','Free text','Readable label for the column, meant for a UI tooltip'),
('data_dictionary','section_name','Section','GOVERNANCE','None','VARCHAR(100)','Free text','Logical grouping the column belongs to (e.g. THEORETICAL DESIGN, GOVERNANCE, RAG_CORPUS)'),
('data_dictionary','unit','Unit','GOVERNANCE','None','VARCHAR(50)','Free text or None','Physical unit of the value, when applicable'),
('data_dictionary','data_type','SQL Type','GOVERNANCE','None','VARCHAR(50)','Free text','The column''s real SQL data type, kept in sync by hand with the CREATE TABLE statement'),
('data_dictionary','valid_categories','Valid Values','GOVERNANCE','Text','TEXT','Free text','Allowed values, ranges, or format the column is expected to hold'),
('data_dictionary','description','Description','GOVERNANCE','Text','TEXT','Free text','What the column means and why it exists'),
('data_dictionary','created_at','Documented At','GOVERNANCE','Timestamp','TIMESTAMPTZ','ISO 8601','When this dictionary row was first written')
ON CONFLICT (table_name, column_name) DO UPDATE SET
    full_name        = EXCLUDED.full_name,
    section_name     = EXCLUDED.section_name,
    unit             = EXCLUDED.unit,
    data_type        = EXCLUDED.data_type,
    valid_categories = EXCLUDED.valid_categories,
    description      = EXCLUDED.description;

-- =============================================================================
-- 19. RAG - Contextual chunking staging table (Gemini sidecar, Fase C-bis)
-- =============================================================================
--  Sidecar table for the "one contextual sentence per chunk" upgrade
--  (Anthropic's contextual retrieval technique). Deliberately NOT a column on
--  rag_chunks: this table has no write access from anything that touches
--  rag_chunks.embedding, so no external process can ever corrupt Ollama's
--  already-computed vectors just by writing a context sentence. Merging (if
--  it ever happens) is a separate, explicit, later step that re-embeds into
--  a NEW column first (embedding_v2), never overwriting embedding in place.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rag_chunk_context (
    chunk_id         BIGINT PRIMARY KEY REFERENCES rag_chunks(id) ON DELETE CASCADE,
    context_sentence TEXT NOT NULL,
    source_model     TEXT NOT NULL DEFAULT 'gemini',
    batch_file       TEXT,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT now()
);

COMMENT ON TABLE rag_chunk_context IS 'Sidecar for contextual-retrieval sentences generated externally (Gemini/Antigravity). Never written to by anything that also writes rag_chunks.embedding.';

INSERT INTO data_dictionary
    (table_name, column_name, full_name, section_name, unit, data_type, valid_categories, description)
VALUES
('rag_chunk_context','chunk_id','Chunk (FK)','RAG - CONTEXT STAGING','None','BIGINT','Must exist in rag_chunks','Which chunk this sentence situates. ON DELETE CASCADE'),
('rag_chunk_context','context_sentence','Context Sentence','RAG - CONTEXT STAGING','Text','TEXT','Free text, 1-2 sentences','LLM-generated sentence situating the chunk within its source document'),
('rag_chunk_context','source_model','Source Model','RAG - CONTEXT STAGING','None','TEXT','Free text, e.g. gemini-3.7','Which model produced the sentence'),
('rag_chunk_context','batch_file','Batch File','RAG - CONTEXT STAGING','None','TEXT','Free text','Which exported batch file this row came from, for traceability back to the raw Gemini response'),
('rag_chunk_context','created_at','Generated At','RAG - CONTEXT STAGING','Timestamp','TIMESTAMPTZ','ISO 8601','When the sentence was imported')
ON CONFLICT (table_name, column_name) DO UPDATE SET
    full_name        = EXCLUDED.full_name,
    section_name     = EXCLUDED.section_name,
    unit             = EXCLUDED.unit,
    data_type        = EXCLUDED.data_type,
    valid_categories = EXCLUDED.valid_categories,
    description      = EXCLUDED.description;


-- =============================================================================
-- Section 20: rag_chunks.embedding_v2 (optional contextual-retrieval column)
-- =============================================================================
-- Added 2026-08-26 after generating one context_sentence per chunk into
-- rag_chunk_context (Anthropic's "contextual retrieval" technique, see
-- methodology/ROADMAP_RAG_Y_GRAFO.md). This column holds a SECOND embedding,
-- of (context_sentence + chunk text) instead of the chunk alone. It is
-- populated by src/rag_reembed_context.py and compared against the original
-- `embedding` column with src/rag_query_compare.py BEFORE any decision to
-- switch retrieval over to it - `embedding` itself is never modified.

ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS embedding_v2 vector(1024);

COMMENT ON COLUMN rag_chunks.embedding_v2 IS
'Optional second embedding of (context_sentence + chunk text), computed by src/rag_reembed_context.py once rag_chunk_context has a sentence for the chunk. NULL until that script runs. Kept separate from embedding (the original chunk-only vector) so the two can be A/B compared on real queries before deciding whether to switch retrieval over to it - never overwrites the original.';

INSERT INTO data_dictionary (table_name, column_name, full_name, section_name, unit, data_type, valid_categories, description)
VALUES (
    'rag_chunks', 'embedding_v2', 'Contextual embedding (optional, A/B)', 'RAG retrieval', NULL,
    'vector(1024)', NULL,
    'Second embedding of (context_sentence + chunk text), computed by src/rag_reembed_context.py from the sentences in rag_chunk_context (Anthropic contextual-retrieval technique). NULL until that script runs on a chunk. Never overwrites embedding (the original chunk-only vector) - the two are compared on real queries via src/rag_query_compare.py before deciding whether to switch retrieval over to this column.'
)
ON CONFLICT (table_name, column_name) DO UPDATE SET
    full_name = EXCLUDED.full_name, section_name = EXCLUDED.section_name,
    data_type = EXCLUDED.data_type, description = EXCLUDED.description;

-- =============================================================================
-- Section 21: owner-only access to exact synthesis/characterisation values
-- =============================================================================
-- Added 2026-08-26. The RAG chat agent is meant to go public. By default every
-- caller (including the whitelisted-researcher path, which only ever governs
-- INGESTION, not chat reads) must get a "somera" (summary-only, no exact
-- numbers) view of synthesis_experiments / characterization_measurements.
-- Only the project owner, proven via a single high-entropy shared secret
-- (never the researcher email whitelist, which is spoofable and for a
-- different purpose entirely - see authorized_researchers), gets exact values.
--
-- The secret is stored ONLY as an md5 hash (a random 256-bit token needs no
-- slow password hash - brute force is infeasible) and is verified once in
-- the n8n workflow's "Authorise Caller" node; downstream tool functions only
-- ever see the resulting boolean, never the token itself.

CREATE TABLE IF NOT EXISTS agent_owner_secret (
    token_hash TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
COMMENT ON TABLE agent_owner_secret IS
'Holds the md5 hash of the single owner access token for the ALCheMy-RAG chat agent. Never the plaintext token. Verified by agent_verify_owner(); downstream agent_* functions only receive the resulting boolean (p_is_owner), never the token.';

CREATE OR REPLACE FUNCTION public.agent_verify_owner(p_token text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM agent_owner_secret
        WHERE token_hash = md5(COALESCE(p_token, ''))
    ) AND COALESCE(p_token, '') <> '';
$function$;
COMMENT ON FUNCTION public.agent_verify_owner(text) IS
'Returns true only if p_token matches the stored owner secret. Called once in n8n''s Authorise Caller node; the boolean result (never the token) is what flows to agent_sample_summary/agent_get_characterisation/agent_search_synthesis to decide between exact and redacted output.';

-- ---------------------------------------------------------------------------
-- agent_sample_summary: numeric process/recipe columns hidden unless owner
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.agent_sample_summary(
    p_actor text DEFAULT NULL::text,
    p_session text DEFAULT NULL::text,
    p_sample_code text DEFAULT NULL::text,
    p_is_owner boolean DEFAULT false
)
RETURNS TABLE(field text, value text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_rows INTEGER;
    -- Exact recipe/process numbers: masses, concentrations, mmol, volumes,
    -- ratios, temperatures, times. Never shown unless p_is_owner.
    v_restricted TEXT[] := ARRAY[
        'metal_conc_m','lm_ratio','metal_mass_mg','linker_mass_mg',
        'secondary_linker_mg','reactor_volume_ml','h2o_pure_ml','h2o_total_ml',
        'meoh_ml','etoh_ml','proh_1_ml','dmf_ml','def_ml','total_volume_ml',
        'temp_initial_c','heating_time_hours','heating_rate_c_min',
        'temp_target_c','time_hours','cooling_time_hours','cooling_rate_c_min',
        'temp_final_c','hcl_active_mmol','hf_active_mmol','koh_active_mmol',
        'formic_acid_mmol','acetic_acid_mmol','propionic_acid_mmol','tfa_mmol',
        'cf3so3h_mmol','triethylamine_mmol','meo3s_mmol','researcher_name'
    ];
BEGIN
    RETURN QUERY
    SELECT j.key, j.value #>> '{}'
    FROM   synthesis_experiments s, jsonb_each(to_jsonb(s)) AS j
    WHERE  s.sample_code = p_sample_code
      AND  j.value <> 'null'::jsonb
      AND  j.key NOT IN ('file_hash_md5', 'created_at', 'updated_at')
      AND  (p_is_owner OR NOT (j.key = ANY(v_restricted)))
    ORDER  BY j.key;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    PERFORM agent_audit(p_actor, p_session, 'sample_summary',
        format('sample_code=%s is_owner=%s', p_sample_code, p_is_owner), v_rows);
END;
$function$;

-- ---------------------------------------------------------------------------
-- agent_get_characterisation: internal operator name hidden unless owner
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.agent_get_characterisation(
    p_actor text DEFAULT NULL::text,
    p_session text DEFAULT NULL::text,
    p_sample_code text DEFAULT NULL::text,
    p_technique text DEFAULT NULL::text,
    p_limit integer DEFAULT 20,
    p_is_owner boolean DEFAULT false
)
RETURNS TABLE(sample_code character varying, technique character varying, measurement_tag character varying, instrument_name character varying, operator_name character varying, file_name character varying, measured_at timestamp with time zone, data_fields text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_limit INTEGER := agent_row_limit(p_limit); v_rows INTEGER;
BEGIN
    RETURN QUERY
    SELECT m.sample_code, m.technique, m.measurement_tag, m.instrument_name,
           CASE WHEN p_is_owner THEN m.operator_name ELSE NULL END,
           m.file_name, m.created_at,
           (SELECT string_agg(k, ', ' ORDER BY k)
              FROM jsonb_object_keys(COALESCE(m.data_json->'header_metadata','{}'::jsonb)) AS k)
    FROM   characterization_measurements m
    WHERE  m.sample_code = p_sample_code
      AND  (p_technique IS NULL OR m.technique ILIKE p_technique)
    ORDER  BY m.technique, m.created_at DESC
    LIMIT  v_limit;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    PERFORM agent_audit(p_actor, p_session, 'get_characterisation',
        format('sample_code=%s technique=%s is_owner=%s', p_sample_code, p_technique, p_is_owner), v_rows);
END;
$function$;

-- ---------------------------------------------------------------------------
-- agent_search_synthesis: exact temp/time/ratio blanked out unless owner
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.agent_search_synthesis(
    p_actor text DEFAULT NULL::text,
    p_session text DEFAULT NULL::text,
    p_metal text DEFAULT NULL::text,
    p_linker text DEFAULT NULL::text,
    p_temp_min numeric DEFAULT NULL::numeric,
    p_temp_max numeric DEFAULT NULL::numeric,
    p_from date DEFAULT NULL::date,
    p_to date DEFAULT NULL::date,
    p_limit integer DEFAULT 20,
    p_is_owner boolean DEFAULT false
)
RETURNS TABLE(sample_code character varying, synthesis_date date, metal_center character varying, linker character varying, temp_target_c numeric, time_hours numeric, lm_ratio numeric, n_techniques bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_limit INTEGER := agent_row_limit(p_limit); v_rows INTEGER;
BEGIN
    RETURN QUERY
    SELECT s.sample_code, s.synthesis_date, s.metal_center, s.linker,
           CASE WHEN p_is_owner THEN s.temp_target_c ELSE NULL END,
           CASE WHEN p_is_owner THEN s.time_hours ELSE NULL END,
           CASE WHEN p_is_owner THEN s.lm_ratio ELSE NULL END,
           (SELECT count(DISTINCT m.technique) FROM characterization_measurements m
             WHERE m.sample_code = s.sample_code)
    FROM   synthesis_experiments s
    WHERE  (p_metal    IS NULL OR s.metal_center ILIKE p_metal)
      AND  (p_linker   IS NULL OR s.linker ILIKE '%' || p_linker || '%')
      AND  (p_temp_min IS NULL OR s.temp_target_c >= p_temp_min)
      AND  (p_temp_max IS NULL OR s.temp_target_c <= p_temp_max)
      AND  (p_from     IS NULL OR s.synthesis_date >= p_from)
      AND  (p_to       IS NULL OR s.synthesis_date <= p_to)
    ORDER  BY s.synthesis_date DESC NULLS LAST, s.sample_code
    LIMIT  v_limit;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    PERFORM agent_audit(p_actor, p_session, 'search_synthesis',
        format('metal=%s linker=%s temp=[%s,%s] date=[%s,%s] limit=%s is_owner=%s',
               p_metal, p_linker, p_temp_min, p_temp_max, p_from, p_to, v_limit, p_is_owner), v_rows);
END;
$function$;

-- =============================================================================
-- Section 22: knowledge graph (kg_nodes / kg_edges) - Herramienta C, Fase 1
-- =============================================================================
-- Ver methodology/ROADMAP_RAG_Y_GRAFO_v2.md seccion 5 para el diseno completo.
-- Dos tablas genericas en vez de una tabla por tipo de relacion: cualquier
-- "cosa" (una muestra, un ligando, un paper, un modelo de ML, una prediccion)
-- es una fila de kg_nodes, y cualquier relacion entre dos cosas es una fila de
-- kg_edges. Esto permite recorrer el grafo con UNA sola funcion recursiva
-- (kg_neighbors) en vez de escribir un JOIN especifico por cada tipo de
-- pregunta relacional, que es justo lo que las tablas normales no permiten
-- hacer de forma generica.
--
-- Fase 1 (esta seccion): nodos/aristas DETERMINISTAS, construidos sin ningun
-- LLM por src/build_knowledge_graph.py a partir de synthesis_experiments y
-- characterization_measurements tal como existen hoy. Reproducible: se puede
-- re-ejecutar cuantas veces se quiera, siempre da el mismo resultado.
--
-- Fase 2 (pendiente, bloqueada): nodos ML_MODEL / ML_PREDICTION. No se puede
-- construir todavia porque no existe ninguna tabla que registre las
-- predicciones de un modelo de ML -- es trabajo de la fase de ML del roadmap
-- general, sin disenar aun. El CHECK de node_type de abajo ya deja hueco para
-- estos dos tipos para no tener que migrar el esquema cuando llegue el dia.
--
-- Fase 3 (pendiente, la mas delicada): aristas PAPER --RESPALDA--> DESCRIPTOR.
-- A diferencia de todo lo anterior, esa relacion no esta escrita en ninguna
-- columna: hay que inferirla comparando el texto de un paper con un resultado
-- de laboratorio, lo cual solo puede hacerlo un LLM. Por eso kg_edges tiene
-- las columnas `source` y `review_status`: una arista LLM_INFERRED nace en
-- PENDING_REVIEW y no se trata como un hecho confirmado hasta que un humano
-- la revise -- mismo patron HITL que ya usa la rama de ICP/EA en n8n.

CREATE TABLE IF NOT EXISTS kg_nodes (
    node_id      TEXT        PRIMARY KEY,
    node_type    TEXT        NOT NULL CHECK (node_type IN (
                     'SAMPLE', 'LIGAND', 'METAL', 'MODULATOR', 'MEASUREMENT',
                     'DESCRIPTOR', 'PAPER', 'ML_MODEL', 'ML_PREDICTION')),
    label        TEXT        NOT NULL,
    source_table TEXT,
    source_id    TEXT,
    properties   JSONB       DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kg_nodes_type ON kg_nodes (node_type);

COMMENT ON TABLE  kg_nodes             IS 'Una fila por "cosa que existe" en el grafo de conocimiento: muestra, ligando, metal, modulador, medida, descriptor/KPI, paper, modelo de ML o prediccion de ML.';
COMMENT ON COLUMN kg_nodes.node_id     IS 'Clave legible con prefijo de tipo, p.ej. SAMPLE:SMP-0100, LIGAND:H2BDC, PAPER:123. No es un UUID a proposito: se puede escribir a mano al explorar el grafo.';
COMMENT ON COLUMN kg_nodes.source_table IS 'Tabla de origen si el nodo viene de una fila real (p.ej. synthesis_experiments); NULL para nodos que solo existen como concepto (un ligando, un modulador).';
COMMENT ON COLUMN kg_nodes.properties  IS 'Metadatos extra especificos del tipo de nodo (p.ej. n_files en un MEASUREMENT), para no tener que anadir columnas por cada tipo nuevo.';

CREATE TABLE IF NOT EXISTS kg_edges (
    edge_id       BIGSERIAL   PRIMARY KEY,
    from_node     TEXT        NOT NULL REFERENCES kg_nodes(node_id) ON DELETE CASCADE,
    to_node       TEXT        NOT NULL REFERENCES kg_nodes(node_id) ON DELETE CASCADE,
    edge_type     TEXT        NOT NULL,
    confidence    NUMERIC(4,3) NOT NULL DEFAULT 1.000 CHECK (confidence BETWEEN 0 AND 1),
    source        TEXT        NOT NULL DEFAULT 'DETERMINISTIC' CHECK (source IN ('DETERMINISTIC', 'LLM_INFERRED')),
    review_status TEXT        NOT NULL DEFAULT 'CONFIRMED' CHECK (review_status IN ('CONFIRMED', 'PENDING_REVIEW', 'REJECTED')),
    properties    JSONB       DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ DEFAULT now(),
    UNIQUE (from_node, to_node, edge_type)
);

CREATE INDEX IF NOT EXISTS idx_kg_edges_from ON kg_edges (from_node);
CREATE INDEX IF NOT EXISTS idx_kg_edges_to   ON kg_edges (to_node);
CREATE INDEX IF NOT EXISTS idx_kg_edges_type ON kg_edges (edge_type);

COMMENT ON TABLE  kg_edges                IS 'Una fila por relacion entre dos nodos: SAMPLE-USES_LIGAND->LIGAND, SAMPLE-HAS_MEASUREMENT->MEASUREMENT, y en el futuro PAPER-SUPPORTS->DESCRIPTOR.';
COMMENT ON COLUMN kg_edges.confidence     IS '1.0 para aristas deterministas (siempre). Para aristas LLM_INFERRED (Fase 3), la confianza que dio el modelo al proponer la relacion.';
COMMENT ON COLUMN kg_edges.source         IS 'DETERMINISTIC = construida por build_knowledge_graph.py desde una columna real, sin ambiguedad posible. LLM_INFERRED = un modelo la propuso comparando texto libre, requiere revision.';
COMMENT ON COLUMN kg_edges.review_status  IS 'Las aristas DETERMINISTIC nacen CONFIRMED. Las LLM_INFERRED nacen PENDING_REVIEW y no deben tratarse como hecho hasta que un humano las confirme (mismo patron HITL que la rama ICP/EA de n8n).';

-- kg_neighbors(): recorrido generico del grafo por anchura, hasta N saltos,
-- tratando las aristas como no dirigidas (para explorar da igual si la arista
-- se guardo A->B o B->A; SELECT ... FROM kg_edges WHERE edge_type='SUPPORTS'
-- sigue sirviendo para consultar solo en un sentido si hace falta).
CREATE OR REPLACE FUNCTION kg_neighbors(p_node_id TEXT, p_max_hops INTEGER DEFAULT 2)
RETURNS TABLE (hop INTEGER, node_id TEXT, node_type TEXT, label TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $func$
BEGIN
    RETURN QUERY
    WITH RECURSIVE frontier(node_id, hop) AS (
        SELECT p_node_id, 0
        UNION ALL
        SELECT CASE WHEN e.from_node = f.node_id THEN e.to_node ELSE e.from_node END,
               f.hop + 1
        FROM   frontier f
        JOIN   kg_edges e ON e.from_node = f.node_id OR e.to_node = f.node_id
        WHERE  f.hop < p_max_hops
    ),
    closest AS (
        SELECT frontier.node_id, MIN(frontier.hop) AS hop
        FROM   frontier
        WHERE  frontier.node_id <> p_node_id
        GROUP  BY frontier.node_id
    )
    SELECT c.hop, n.node_id, n.node_type, n.label
    FROM   closest c
    JOIN   kg_nodes n ON n.node_id = c.node_id
    ORDER  BY c.hop, n.node_type, n.label;
END;
$func$;

COMMENT ON FUNCTION kg_neighbors IS 'CTE recursiva: todo lo alcanzable desde un nodo en hasta p_max_hops saltos, sin distinguir direccion de la arista. Uso directo desde pgAdmin: SELECT * FROM kg_neighbors(''SAMPLE:SMP-0100'', 2);';

CREATE OR REPLACE FUNCTION agent_find_graph_node(
    p_actor TEXT DEFAULT NULL, p_session TEXT DEFAULT NULL,
    p_query TEXT DEFAULT NULL, p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (node_id TEXT, node_type TEXT, label TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $func$
DECLARE v_limit INTEGER := agent_row_limit(p_limit); v_rows INTEGER;
BEGIN
    IF p_query IS NULL OR trim(p_query) = '' THEN
        RAISE EXCEPTION 'query is required (a sample code, ligand, metal or modulator name to search for)';
    END IF;

    RETURN QUERY
    SELECT n.node_id, n.node_type, n.label
    FROM   kg_nodes n
    WHERE  n.label ILIKE '%' || p_query || '%'
    ORDER  BY n.node_type, n.label
    LIMIT  v_limit;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    PERFORM agent_audit(p_actor, p_session, 'find_graph_node', format('query=%s', p_query), v_rows);
END;
$func$;

COMMENT ON FUNCTION agent_find_graph_node IS 'Primer paso obligatorio antes de explore_graph: busca el node_id exacto (p.ej. SAMPLE:SMP-0100) a partir de un texto libre.';

CREATE OR REPLACE FUNCTION agent_explore_graph(
    p_actor TEXT DEFAULT NULL, p_session TEXT DEFAULT NULL,
    p_node_id TEXT DEFAULT NULL, p_hops INTEGER DEFAULT 2, p_limit INTEGER DEFAULT 30
)
RETURNS TABLE (hop INTEGER, node_id TEXT, node_type TEXT, label TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $func$
DECLARE v_hops INTEGER := LEAST(GREATEST(COALESCE(p_hops, 2), 1), 3);
        v_limit INTEGER := agent_row_limit(p_limit); v_rows INTEGER;
BEGIN
    IF p_node_id IS NULL OR NOT EXISTS (SELECT 1 FROM kg_nodes WHERE kg_nodes.node_id = p_node_id) THEN
        RAISE EXCEPTION 'Unknown node_id: %. Call find_graph_node first to get a valid one (e.g. SAMPLE:SMP-0100).', p_node_id;
    END IF;

    -- Sin LIMIT aqui, un nodo con mucha "fanout" (p.ej. METAL:Ca, con 538
    -- muestras) puede devolver miles de filas: exactamente el problema que el
    -- resto del catalogo evita con agent_row_limit. Los mas cercanos (hop mas
    -- bajo) van primero, asi que el corte pierde lo mas lejano, no lo mas
    -- relevante.
    RETURN QUERY SELECT * FROM kg_neighbors(p_node_id, v_hops) LIMIT v_limit;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    PERFORM agent_audit(p_actor, p_session, 'explore_graph',
        format('node_id=%s hops=%s limit=%s', p_node_id, v_hops, v_limit), v_rows);
END;
$func$;

COMMENT ON FUNCTION agent_explore_graph IS 'Recorrido del grafo de conocimiento en hasta 3 saltos desde un node_id ya conocido. p_hops se acota a [1,3], p_limit a [1,200] (por defecto 30) porque un nodo muy conectado (un metal comun) puede tener cientos de vecinos.';

REVOKE ALL ON kg_nodes, kg_edges FROM PUBLIC;
GRANT SELECT ON kg_nodes, kg_edges TO alchemy_agent;
GRANT EXECUTE ON FUNCTION kg_neighbors(TEXT, INTEGER)            TO alchemy_agent;
GRANT EXECUTE ON FUNCTION agent_find_graph_node(TEXT,TEXT,TEXT,INTEGER) TO alchemy_agent;
GRANT EXECUTE ON FUNCTION agent_explore_graph(TEXT,TEXT,TEXT,INTEGER,INTEGER) TO alchemy_agent;


-- ---------------------------------------------------------------------------
-- ai_agent_calls / characterization_measurements_test (Sesiones 29-30)
-- Anadidas directamente en la base de datos viva durante el debugging del
-- fallback Gemini->Ollama; documentadas aqui despues para que el DDL siga
-- siendo la fuente de verdad del esquema.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_agent_calls (
    call_id         BIGSERIAL PRIMARY KEY,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    execution_id    TEXT,
    agent_node      TEXT NOT NULL,
    sample_code     TEXT,
    technique       TEXT,
    model_provider  TEXT NOT NULL,
    model_name      TEXT NOT NULL,
    is_fallback     BOOLEAN NOT NULL DEFAULT false,
    success         BOOLEAN NOT NULL,
    error_message   TEXT,
    latency_ms      INTEGER,
    confidence      NUMERIC
);
COMMENT ON TABLE ai_agent_calls IS 'One row per AI agent invocation (Gemini or local Ollama fallback), for cost/usage auditing - never trims to only successful calls.';
CREATE INDEX IF NOT EXISTS idx_ai_agent_calls_created ON ai_agent_calls(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_agent_calls_provider ON ai_agent_calls(model_provider, is_fallback);

-- Tabla de pruebas del workflow de n8n: DB Update y Check Duplicates apuntan
-- aqui mientras se sigue iterando sobre el flujo, para no tocar la tabla
-- canonica characterization_measurements con datos de prueba. Misma
-- estructura exacta, sin la FK a synthesis_experiments (no hace falta para
-- probar el pipeline).
CREATE TABLE IF NOT EXISTS characterization_measurements_test (LIKE characterization_measurements INCLUDING ALL);
COMMENT ON TABLE characterization_measurements_test IS 'Espejo de characterization_measurements (misma estructura, sin FK) usado por el workflow de n8n mientras se siguen haciendo cambios en el, para no ensuciar la tabla canonica con datos de prueba.';
