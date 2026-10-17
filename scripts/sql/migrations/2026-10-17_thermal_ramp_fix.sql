-- =============================================================================
-- 2026-10-17_thermal_ramp_fix.sql
--
-- Migration: Thermal Ramp Honesty Fix (Hallazgos A1, A2; Decisión R3)
--
-- MOTIVATION & CONTEXT
-- --------------------
-- 1. Hallazgo A2: 24 syntheses (RS1502 through RS1525) were recorded at 25 °C
--    for 1 h because 'r.t.(1h)-120ºC(12h)-r.t.(-)' contained a hyphen inside
--    parens '(-)', causing the split to produce 4 parts and fall into the single-stage
--    fallback that read the room-temperature token (25 °C / 1 h). The true physical
--    synthesis conditions are 120 °C, 12 h, heating 1 h (1.5833 °C/min), cooling unknown.
--
-- 2. Hallazgo A1: When ramp durations were omitted in lab notebook records, the
--    parser historically imputed 0.0 °C/min for heating and 0.0 or 12.5 °C/min
--    (assuming 10 minutes) for cooling. These spurious numbers leaked into ML
--    features, causing models to learn notebook notation patterns rather than chemistry.
--
-- 3. Decisión R3: Cooling ending in '-r.t.' without explicit duration represents
--    natural cooling with the oven turned off (cooling_mode = 'free_oven_off').
--    Ramp rates must be NULL when duration is unknown. No rates are imputed in the DB.
--
-- 4. New Columns:
--    - cooling_mode VARCHAR(20): 'programmed', 'fan_asap', 'free_oven_off', or NULL.
--    - ramp_profile_known BOOLEAN: TRUE only if both heating and cooling durations are known.
--
-- EXECUTION SAFETY
-- ----------------
-- This migration script is delivered UNEXECUTED per project guidelines.
-- Before applying to production:
--   1. Run a physical database backup:
--      python scripts/backup_database.py
--   2. Apply in a transaction via psql:
--      docker exec -i alchemy_postgres psql -U alchemy_user -d alchemy_db < scripts/sql/migrations/2026-10-17_thermal_ramp_fix.sql
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1: PRE-MIGRATION AUDIT QUERIES (RECUENTO PREVIO)
-- =============================================================================

-- Recuento previo A2: Comprobar las 24 filas con temp_target_c = 25 y time_hours = 1 (RS1502-RS1525)
SELECT count(*) AS pre_count_a2_corrupted_syntheses
  FROM synthesis_experiments
 WHERE sample_code BETWEEN 'RS1502' AND 'RS1525'
   AND temp_target_c = 25.0
   AND time_hours = 1.0;

-- Recuento previo A1: Filas con velocidades imputadas (0.0 o 12.5) cuando falta tiempo
SELECT
    count(*) FILTER (WHERE heating_time_hours = 0.0 AND heating_rate_c_min = 0.0) AS pre_count_zero_heating_rate,
    count(*) FILTER (WHERE cooling_rate_c_min = 12.5000) AS pre_count_imputed_12_5_cooling_rate,
    count(*) FILTER (WHERE cooling_time_hours = 0.0 AND cooling_rate_c_min = 0.0) AS pre_count_zero_cooling_rate
  FROM synthesis_experiments;

-- =============================================================================
-- STEP 2: DDL EXTENSIONS (ADD COLUMNS & METADATA)
-- =============================================================================

ALTER TABLE synthesis_experiments
    ADD COLUMN IF NOT EXISTS cooling_mode VARCHAR(20) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS ramp_profile_known BOOLEAN DEFAULT NULL;

COMMENT ON COLUMN synthesis_experiments.cooling_mode IS
    'Cooling regime: programmed (explicit time), fan_asap (active microwave cooling, 10 min), free_oven_off (natural cooling, oven switched off), or NULL (unspecified)';

COMMENT ON COLUMN synthesis_experiments.ramp_profile_known IS
    'Flag indicating whether both heating and cooling ramp durations are fully and explicitly known (TRUE) or partially/completely unrecorded (FALSE)';

-- Update data dictionary if table exists
INSERT INTO data_dictionary (table_name, column_name, display_name, category, unit, data_type, expected_range, description)
VALUES
    ('synthesis_experiments', 'cooling_mode', 'Cooling Mode', 'THERMAL RAMP', NULL, 'VARCHAR(20)', 'programmed, fan_asap, free_oven_off, NULL', 'Cooling regime classification distinguishing programmed ramps from free cooling or microwave fan'),
    ('synthesis_experiments', 'ramp_profile_known', 'Ramp Profile Known', 'THERMAL RAMP', NULL, 'BOOLEAN', 'TRUE, FALSE', 'TRUE only if both heating and cooling ramp durations are known without imputation')
ON CONFLICT (table_name, column_name) DO UPDATE
    SET description = EXCLUDED.description,
        data_type = EXCLUDED.data_type,
        category = EXCLUDED.category;

-- =============================================================================
-- STEP 3: DML UPDATES
-- =============================================================================

-- 3.1. CORRECTION A2: Fix 24 syntheses (RS1502 - RS1525) misparsed due to '(-)'
-- Correct values: T_target = 120 °C, time = 12 h, heating = 1 h (1.5833 °C/min), cooling = NULL (free_oven_off)
UPDATE synthesis_experiments
   SET temp_initial_c     = 25.0,
       heating_time_hours = 1.0,
       heating_rate_c_min = 1.5833,
       temp_target_c      = 120.0,
       time_hours         = 12.0,
       cooling_time_hours = NULL,
       cooling_rate_c_min = NULL,
       temp_final_c       = 25.0,
       cooling_mode       = 'free_oven_off',
       ramp_profile_known = FALSE,
       updated_at         = CURRENT_TIMESTAMP
 WHERE sample_code BETWEEN 'RS1502' AND 'RS1525'
   AND temp_target_c = 25.0
   AND time_hours = 1.0;

-- 3.2. Populating cooling_mode and cleaning missing rates for syntheses with microwave asap cooling
-- Active fan cooling takes 10 min (0.1667 h); cooling rate is physically genuine.
UPDATE synthesis_experiments
   SET cooling_mode = 'fan_asap'
 WHERE (cooling_time_hours BETWEEN 0.160 AND 0.170)
   AND synthesis_type = 'MW'
   AND cooling_mode IS NULL;

-- 3.3. Populating cooling_mode for free oven cooling (syntheses ending in '-r.t.' without duration)
-- Historical artifact: previously cooling_time_hours was imputed as 0.1667 h (10 min) with cooling_rate ~ 12.5
-- Reset rate and time to NULL; set cooling_mode = 'free_oven_off'.
UPDATE synthesis_experiments
   SET cooling_time_hours = NULL,
       cooling_rate_c_min = NULL,
       cooling_mode       = 'free_oven_off'
 WHERE cooling_rate_c_min = 12.5000
   AND synthesis_type = 'HTS'
   AND cooling_mode IS NULL;

-- 3.4. Populating cooling_mode for single-stage syntheses (holding only, e.g. '150ºC(48h)')
-- No heating time recorded, no cooling time recorded. Rates should be NULL.
UPDATE synthesis_experiments
   SET heating_time_hours = NULL,
       heating_rate_c_min = NULL,
       cooling_time_hours = NULL,
       cooling_rate_c_min = NULL,
       cooling_mode       = NULL
 WHERE heating_rate_c_min = 0.0
   AND cooling_rate_c_min = 0.0
   AND cooling_time_hours = 0.0
   AND cooling_mode IS NULL;

-- 3.5. Clean heating rates where heating duration was never recorded (was set to 0.0)
UPDATE synthesis_experiments
   SET heating_time_hours = NULL,
       heating_rate_c_min = NULL
 WHERE heating_rate_c_min = 0.0
   AND heating_time_hours = 0.0;

-- 3.6. Populating cooling_mode for programmed cooling ramps
-- Where cooling duration was explicitly recorded and > 0
UPDATE synthesis_experiments
   SET cooling_mode = 'programmed'
 WHERE cooling_time_hours IS NOT NULL
   AND cooling_time_hours > 0
   AND cooling_mode IS NULL;

-- 3.7. Populate ramp_profile_known across all synthesis experiments
UPDATE synthesis_experiments
   SET ramp_profile_known = (
       heating_time_hours IS NOT NULL AND heating_time_hours > 0
       AND cooling_time_hours IS NOT NULL AND cooling_time_hours > 0
   );

-- =============================================================================
-- STEP 4: POST-MIGRATION VERIFICATION & RECOUNTS
-- =============================================================================

-- Verificación 1: Comprobar que no queda ninguna fila de RS1502-RS1525 a 25 °C / 1 h
SELECT count(*) AS post_count_a2_remaining_corrupted
  FROM synthesis_experiments
 WHERE sample_code BETWEEN 'RS1502' AND 'RS1525'
   AND temp_target_c = 25.0
   AND time_hours = 1.0;

-- Verificación 2: Distribución de cooling_mode
SELECT cooling_mode, count(*) AS n_syntheses
  FROM synthesis_experiments
 GROUP BY cooling_mode
 ORDER BY n_syntheses DESC;

-- Verificación 3: Distribución de ramp_profile_known
SELECT ramp_profile_known, count(*) AS n_syntheses
  FROM synthesis_experiments
 GROUP BY ramp_profile_known
 ORDER BY ramp_profile_known;

-- Verificación 4: Comprobar que ninguna fila con tiempo NULL conserva velocidad != NULL
SELECT count(*) AS post_count_inconsistent_rates
  FROM synthesis_experiments
 WHERE (heating_time_hours IS NULL AND heating_rate_c_min IS NOT NULL)
    OR (cooling_time_hours IS NULL AND cooling_rate_c_min IS NOT NULL);

-- =============================================================================
-- STEP 5: AUDIT LOG REGISTRATION
-- =============================================================================

INSERT INTO audit_log (agent, action, recipients, verdict, cause, result)
VALUES (
    'agy_agent_T1',
    'MIGRATION_THERMAL_RAMP_FIX',
    24,
    'ALLOW',
    'Fixed A2 bug (24 syntheses RS1502-RS1525 at 120C 12h) and A1 ramp honesty (NULL rates for unknown duration, cooling_mode, ramp_profile_known)',
    'PENDING_PRODUCTION_APPLY'
);

COMMIT;
