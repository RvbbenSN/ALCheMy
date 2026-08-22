# 📘 Data Dictionary & SQL Schema Specification: ALCheMy

---

## 📌 Overview
This document specifies the official Data Dictionary and SQL Schema for the **ALCheMy** materials science data platform. 
It defines the variable names, data types, units, section groupings, allowed categorical values, and descriptions for all synthesis parameters.

---

## 🗂️ Section 1: General Information & ISO 17025 Audit Trail

| Column Name | SQL Data Type | Unit | Allowed / Valid Values | Description |
| :--- | :--- | :--- | :--- | :--- |
| `sample_code` | `VARCHAR(50)` (PK) | None | Free text (e.g., `RS1`, `RS102`) | Unique sample identifier for the synthesis batch |
| `synthesis_date` | `DATE` | Date | YYYY-MM-DD | Date when the experiment was performed |
| `synthesis_type` | `VARCHAR(50)` | Categorical | `HTS`, `ST`, `MW`, `DT` | Methodology used for the synthesis reaction (Default: ST) |
| `researcher_name` | `VARCHAR(100)` | Text | Free text (Default: `Rubén S.N.`) | Lead researcher responsible for experiment execution (ISO 17025 / GLP Compliance) |
| `research_unit` | `VARCHAR(100)` | Text | Free text (Default: `APMU`) | Laboratory department / research group (APMU: Advanced Porous Materials Unit) |
| `hts_number` | `VARCHAR(5)` | Text | Free text (e.g., `C1`, `C2`) or `N/A` | High-throughput screening attempt identifier ('N/A' for ST, DT, MW) |
| `well_position` | `VARCHAR(3)` | Text | Free text (e.g., `A1`, `B4`) or `N/A` | Specific well position in 24-well plate ('N/A' for ST, DT, MW) |
| `metal_center` | `VARCHAR(3)` | Categorical | All Transition Metals & Semimetals (e.g., `Ni`, `Zr`, `Bi`, `Cu`, `Fe`, `Zn`, `Co`, `Ca`, `Mo`, `La`) | Primary metal node center element |
| `metal_source` | `VARCHAR(100)` | Categorical | `Ni(NO3)2·6H2O`, `Bi(NO3)3·5H2O`, `ZrCl4`, `Cu(NO3)2·3H2O` | Chemical precursor salt used as the metal source |
| `linker` | `VARCHAR(100)` | Categorical | `H8ptp`, `Et8ptp`, `H6ttbmp`, `Et6ttbmp`, `Tannic acid`, `BTBSH3`, `PPV` | Official primary organic ligand building block |

---

## 🧪 Section 2: Theoretical Design

| Column Name | SQL Data Type | Unit | Allowed / Valid Values | Description |
| :--- | :--- | :--- | :--- | :--- |
| `metal_conc_m` | `NUMERIC(4,3)` | M (mol/L) | $> 0$ | Theoretical concentration of the metal in precursor solution |
| `lm_ratio` | `NUMERIC(4,3)` | mol/mol | $> 0$ | Theoretical Ligand to Metal molar ratio ($L/M$) |
| `metal_mass_mg` | `NUMERIC(6,3)` | mg | $> 0$ | Theoretical target mass of metal precursor to weigh (Default: 10.63) |
| `linker_mass_mg` | `NUMERIC(10,4)` | mg | $> 0$ | Theoretical target mass ligand to weigh |
| `secondary_linker_mg` | `NUMERIC(10,4)` | mg | $\ge 0$ | Theoretical target mass of secondary ligand to weigh |
| `reactor_volume_ml` | `NUMERIC(5,1)` | mL | $> 0$ | Volume of reactor in milliliters (Default: HTS=2.5, ST=23.0, MW=30.0, DT=8.0) |

---

## 💧 Section 3: Solvents

| Column Name | SQL Data Type | Unit | Allowed / Valid Values | Description |
| :--- | :--- | :--- | :--- | :--- |
| `h2o_pure_ml` | `NUMERIC(10,4)` | mL | $\ge 0$ | Volume of Pure Deionized Water ($H_2O$) added directly as solvent |
| `h2o_total_ml` | `NUMERIC(10,4)` | mL | $\ge 0$ | Total homogenized water volume ($H_2O_{\text{pure}} + \sum H_2O_{\text{modulators}}$) |
| `meoh_ml` | `NUMERIC(10,4)` | mL | $\ge 0$ | Volume of Methanol ($MeOH$) added |
| `etoh_ml` | `NUMERIC(10,4)` | mL | $\ge 0$ | Volume of Ethanol ($EtOH$) added |
| `proh_1_ml` | `NUMERIC(10,4)` | mL | $\ge 0$ | Volume of 1-Propanol ($1\text{-}PrOH$) added |
| `dmf_ml` | `NUMERIC(10,4)` | mL | $\ge 0$ | Volume of N,N-Dimethylformamide ($DMF$) added |
| `def_ml` | `NUMERIC(10,4)` | mL | $\ge 0$ | Volume of N,N-Diethylformamide ($DEF$) added |
| `total_volume_ml` | `NUMERIC(10,4)` | mL | $> 0$ | Total reaction liquid volume ($V_{\text{total}}$) |

---

## 🌡️ Section 4: Thermal Ramp

| Column Name | SQL Data Type | Unit | Allowed / Valid Values | Description |
| :--- | :--- | :--- | :--- | :--- |
| `temp_initial_c` | `NUMERIC(6,2)` | °C | $[0, 300]$ | Initial heating start temperature (Default: 25.0 °C) |
| `heating_time_hours` | `NUMERIC(6,2)` | hours | $[0, 100]$ | Duration of heating ramp from initial to target temperature (Default: 0.0) |
| `heating_rate_c_min` | `NUMERIC(6,3)` | °C/min | $[0, 50]$ | Heating ramp rate in °C per minute (Default: 0.0) |
| `temp_target_c` | `NUMERIC(6,2)` | °C | $[20, 300]$ | Maximum reaction temperature setpoint |
| `time_hours` | `NUMERIC(6,2)` | hours | $[0, 500]$ | Isothermal reaction duration (plateau) |
| `cooling_time_hours` | `NUMERIC(6,2)` | hours | $[0, 100]$ | Duration of cooling ramp from target to final temperature (Default: 0.0) |
| `cooling_rate_c_min` | `NUMERIC(6,3)` | °C/min | $[0, 50]$ | Cooling ramp rate in °C per minute (Default: 0.0) |
| `temp_final_c` | `NUMERIC(6,2)` | °C | $[0, 300]$ | Final temperature after cooling ramp (Default: 25.0 °C) |

---

## ⚗️ Section 5: Active Modulator Millimoles (mmol)

| Column Name | SQL Data Type | Unit | Allowed / Valid Values | Description |
| :--- | :--- | :--- | :--- | :--- |
| `hcl_active_mmol` | `NUMERIC(10,4)` | mmol | $\ge 0$ | Active Hydrochloric Acid ($HCl$) in millimoles |
| `hf_active_mmol` | `NUMERIC(10,4)` | mmol | $\ge 0$ | Active Hydrofluoric Acid ($HF$) in millimoles |
| `koh_active_mmol` | `NUMERIC(10,4)` | mmol | $\ge 0$ | Active Potassium Hydroxide ($KOH$) in millimoles |
| `formic_acid_mmol` | `NUMERIC(10,4)` | mmol | $\ge 0$ | Active Formic Acid ($HCOOH$) in millimoles |
| `acetic_acid_mmol` | `NUMERIC(10,4)` | mmol | $\ge 0$ | Active Acetic Acid ($AcOH$) in millimoles |
| `propionic_acid_mmol` | `NUMERIC(10,4)` | mmol | $\ge 0$ | Active Propionic Acid in millimoles |
| `tfa_mmol` | `NUMERIC(10,4)` | mmol | $\ge 0$ | Active Trifluoroacetic Acid ($TFA$) in millimoles |
| `cf3so3h_mmol` | `NUMERIC(10,4)` | mmol | $\ge 0$ | Active Triflic Acid ($CF_3SO_3H$) in millimoles |
| `triethylamine_mmol` | `NUMERIC(10,4)` | mmol | $\ge 0$ | Active Triethylamine ($(C_2H_5)_3N$) in millimoles |
| `meo3s_mmol` | `NUMERIC(10,4)` | mmol | $\ge 0$ | Active Methanesulfonic Acid in millimoles |

---

## ⚖️ Section 6: Experimental Weighings

| Column Name | SQL Data Type | Unit | Allowed / Valid Values | Description |
| :--- | :--- | :--- | :--- | :--- |
| `exp_metal_mass_mg` | `NUMERIC(10,4)` | mg | $> 0$ | Real measured mass of metal precursor weighed on analytical balance |
| `exp_secondary_linker_mg` | `NUMERIC(10,4)` | mg | $\ge 0$ | Real measured mass of secondary ligand weighed on analytical balance |
| `exp_metal_conc_m` | `NUMERIC(10,4)` | M | $> 0$ | Real calculated metal concentration based on analytical mass weighing |
| `exp_lm_ratio` | `NUMERIC(10,4)` | mol/mol | $> 0$ | Real calculated Ligand to Metal molar ratio |

### Section 6: Performance
- **`mof_theo_mass_mg`**: Theoretical maximum expected MOF product yield (mg).

### Data Quality Gate & Audit Metadata
- **`file_hash_md5`**: MD5 checksum for anti-duplication data quality gate (`VARCHAR(64)`).
- **`measurement_status`**: Measurement audit state: `active` or `superseded` (`VARCHAR(20)`).
- **`created_at`**: Record creation timestamp (`TIMESTAMP WITH TIME ZONE`).
- **`updated_at`**: Record last update timestamp (`TIMESTAMP WITH TIME ZONE`).

---

## 📈 Section 7: Yield & Performance

| Column Name | SQL Data Type | Unit | Allowed / Valid Values | Description |
| :--- | :--- | :--- | :--- | :--- |
| `mof_exp_mass_mg` | `NUMERIC(10,4)` | mg | $\ge 0$ | Experimental isolated dry mass of crystalline product ($m_{\text{MOF,exp}}$) |
| `mof_theo_mass_mg` | `NUMERIC(10,4)` | mg | $> 0$ | Theoretical maximum stoichiometry yield mass ($m_{\text{MOF,theo}}$) |
| `yield_percent` | `NUMERIC(6,2)` | % | $[0, 100]$ | Percentage reaction yield based on limiting reagent ($R\%$) |
