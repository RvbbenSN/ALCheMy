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
    hts_number VARCHAR(5) DEFAULT 'N/A',
    well_position VARCHAR(3) DEFAULT 'N/A',
    metal_center VARCHAR(3) NOT NULL,
    metal_source VARCHAR(100) NOT NULL,
    linker VARCHAR(100) NOT NULL,

    -- Section 2: Theoretical Design
    metal_conc_m NUMERIC(4,3),
    lm_ratio NUMERIC(4,3),
    metal_mass_mg NUMERIC(6,3) DEFAULT 10.63,
    linker_mass_mg NUMERIC(10,4),
    secondary_linker_mg NUMERIC(10,4) DEFAULT 0,
    reactor_volume_ml NUMERIC(5,1),

    -- Section 3: Solvents (mL)
    h2o_pure_ml NUMERIC(10,4) DEFAULT 0,
    h2o_total_ml NUMERIC(10,4) DEFAULT 0,
    meoh_ml NUMERIC(10,4) DEFAULT 0,
    etoh_ml NUMERIC(10,4) DEFAULT 0,
    proh_1_ml NUMERIC(10,4) DEFAULT 0,
    dmf_ml NUMERIC(10,4) DEFAULT 0,
    def_ml NUMERIC(10,4) DEFAULT 0,
    total_volume_ml NUMERIC(10,4) NOT NULL,

    -- Section 4: Thermal Ramp
    temp_initial_c NUMERIC(6,2) DEFAULT 25.0,
    heating_time_hours NUMERIC(6,2) DEFAULT 0.0,
    heating_rate_c_min NUMERIC(6,3) DEFAULT 0.0,
    temp_target_c NUMERIC(6,2) NOT NULL,
    time_hours NUMERIC(6,2) NOT NULL,
    cooling_time_hours NUMERIC(6,2) DEFAULT 0.0,
    cooling_rate_c_min NUMERIC(6,3) DEFAULT 0.0,
    temp_final_c NUMERIC(6,2) DEFAULT 25.0,

    -- Section 5: Active Modulator Millimoles (mmol)
    hcl_active_mmol NUMERIC(10,4) DEFAULT 0,
    hf_active_mmol NUMERIC(10,4) DEFAULT 0,
    koh_active_mmol NUMERIC(10,4) DEFAULT 0,
    formic_acid_mmol NUMERIC(10,4) DEFAULT 0,
    acetic_acid_mmol NUMERIC(10,4) DEFAULT 0,
    propionic_acid_mmol NUMERIC(10,4) DEFAULT 0,
    tfa_mmol NUMERIC(10,4) DEFAULT 0,
    cf3so3h_mmol NUMERIC(10,4) DEFAULT 0,
    triethylamine_mmol NUMERIC(10,4) DEFAULT 0,
    meo3s_mmol NUMERIC(10,4) DEFAULT 0,

    -- Section 6: Experimental Balance Weighings
    exp_metal_mass_mg NUMERIC(10,4),
    exp_linker_mass_mg NUMERIC(10,4),
    exp_secondary_linker_mg NUMERIC(10,4) DEFAULT 0,
    exp_metal_conc_m NUMERIC(10,4),
    exp_lm_ratio NUMERIC(10,4),

    -- Section 7: Yield & Performance
    mof_exp_mass_mg NUMERIC(10,4),
    mof_theo_mass_mg NUMERIC(10,4),
    yield_percent NUMERIC(6,2),

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
COMMENT ON COLUMN synthesis_experiments.yield_percent IS 'Percentage reaction yield based on limiting reagent (R%)';
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
('hcl_active_mmol', 'Active HCl Modulator', 'MODULATORS & ADDITIVES', 'mmol', 'NUMERIC(10,4)', '>= 0', 'Total pure active Hydrochloric Acid in millimoles'),
('exp_metal_mass_mg', 'Real Metal Mass Weighed', 'EXPERIMENTAL WEIGHINGS', 'mg', 'NUMERIC(10,4)', '> 0', 'Real measured mass of metal precursor weighed on balance'),
('exp_linker_mass_mg', 'Real Linker Mass Weighed', 'EXPERIMENTAL WEIGHINGS', 'mg', 'NUMERIC(10,4)', '> 0', 'Real measured mass of primary ligand weighed on balance'),
('mof_exp_mass_mg', 'Experimental MOF Mass', 'YIELD & PERFORMANCE', 'mg', 'NUMERIC(10,4)', '>= 0', 'Experimental isolated dry mass of crystalline product'),
('yield_percent', 'Reaction Yield', 'YIELD & PERFORMANCE', '%', 'NUMERIC(6,2)', '0-100', 'Percentage reaction yield based on limiting reagent')
ON CONFLICT (column_name) DO UPDATE SET 
    full_name = EXCLUDED.full_name,
    section_name = EXCLUDED.section_name,
    valid_categories = EXCLUDED.valid_categories,
    description = EXCLUDED.description;
