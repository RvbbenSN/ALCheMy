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
ON CONFLICT (column_name) DO UPDATE SET 
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




