-- =============================================================================
-- ddl_ml_features_v3.sql
--
-- v_ml_features, tercera version. Cierra el problema de unidades de volumen
-- descubierto el 2026-09-02 y, con el, el mayor hueco de datos que tenia el
-- proyecto.
--
-- QUE CAMBIA RESPECTO A LA v2
-- ---------------------------
-- La v2 daba por hecho que TODA columna de aditivo del Excel estaba en uL. No
-- lo estaba: la formula de la propia columna "V total" del Excel es
--
--     V total = SUM(Q:AB) + SUM(AE:AU)/1000
--
-- y ese "/1000" aplicado solo al segundo bloque demuestra que el primero esta
-- en mL. Las disoluciones DILUIDAS (HCl 0,6M, HCl 3M, HF 3M) se dosifican en
-- mililitros y hacen de disolvente; las concentradas y los liquidos puros van
-- en microlitros. Es coherente con como se trabaja en el banco.
--
-- Consecuencia sobre la v2: el agua que aportaban esas disoluciones se dividia
-- entre 1000 y desaparecia, de modo que el volumen "no cuadraba" y ~18 % de las
-- filas se marcaban como composicion desconocida. No faltaba un disolvente:
-- faltaba el agua de la dilucion. Corregido en synthesis_experiments por
-- src/fix_volume_units_2026_09.py.
--
--   1. Tres columnas nuevas del bloque en mL que nunca llegaron a la tabla y
--      ahora si entran en el balance: acoh_gl_ml, h2po4_ml, nh4oh_ml.
--      El acido acetico glacial es a la vez disolvente y modulador, asi que se
--      cuenta en el medio Y se suma al modulador carboxilico.
--   2. frac_acoh nueva, por lo mismo.
--   3. El resto de la logica de la v2 se mantiene: HF separado, descriptores de
--      pKa y logP, synthesis_type expuesto, emparejamiento de precursor
--      normalizado, filas sin metal fuera, y fracciones a NULL cuando el
--      volumen no cuadra.
--
-- APLICAR CON
--   python scripts/backup_database.py
--   docker exec -i alchemy_postgres psql -U alchemy_user -d alchemy_db \
--       < scripts/ddl_ml_features_v3.sql
-- =============================================================================

DROP VIEW IF EXISTS v_ml_features;
CREATE VIEW v_ml_features AS
WITH base AS (
    SELECT
        s.*,
        regexp_replace(btrim(replace(s.metal_source, chr(160), ' ')), '\s+', ' ', 'g')
            AS metal_source_norm,

        -- El acido acetico glacial es disolvente Y modulador: cuenta en los dos
        -- sitios. 1,05 g/mL y 60,05 g/mol -> 17,49 mmol por mL.
        COALESCE(s.acoh_gl_ml, 0) * 17.4855                            AS acoh_mmol,

        COALESCE(s.formic_acid_mmol, 0) + COALESCE(s.acetic_acid_mmol, 0)
          + COALESCE(s.propionic_acid_mmol, 0)
          + COALESCE(s.acoh_gl_ml, 0) * 17.4855                        AS m_carbox,
        COALESCE(s.hcl_active_mmol, 0) + COALESCE(s.tfa_mmol, 0)
          + COALESCE(s.cf3so3h_mmol, 0) + COALESCE(s.meo3s_mmol, 0)    AS m_strong,
        COALESCE(s.hf_active_mmol, 0)                                  AS m_hf,
        COALESCE(s.koh_active_mmol, 0) + COALESCE(s.triethylamine_mmol, 0) AS m_base,
        COALESCE(s.hf_active_mmol, 0) + COALESCE(s.tfa_mmol, 0)
          + COALESCE(s.cf3so3h_mmol, 0)                                AS m_fluor,

        -- Volumen de los moduladores organicos puros, reconstruido desde los
        -- mmol invirtiendo la formula del cuaderno 01 (todos en uL en origen).
        (  COALESCE(s.formic_acid_mmol, 0)    * 100 * 46.03  / (1.220 * 98.0)
         + COALESCE(s.acetic_acid_mmol, 0)    * 100 * 60.05  / (1.050 * 99.8)
         + COALESCE(s.propionic_acid_mmol, 0) * 100 * 74.08  / (0.990 * 99.5)
         + COALESCE(s.tfa_mmol, 0)            * 100 * 114.02 / (1.490 * 99.0)
         + COALESCE(s.cf3so3h_mmol, 0)        * 100 * 150.08 / (1.700 * 99.0)
         + COALESCE(s.triethylamine_mmol, 0)  * 100 * 101.19 / (0.726 * 99.5)
         + COALESCE(s.meo3s_mmol, 0)          * 100 * 96.11  / (1.480 * 99.5)
        ) / 1000.0                                                     AS mod_volume_ml,

        -- Suma de disolventes: ahora con las tres columnas recuperadas. El agua
        -- total ya incluye el agua de las disoluciones acuosas, en su unidad
        -- correcta.
        COALESCE(s.h2o_total_ml, 0) + COALESCE(s.meoh_ml, 0) + COALESCE(s.etoh_ml, 0)
          + COALESCE(s.proh_1_ml, 0) + COALESCE(s.dmf_ml, 0) + COALESCE(s.def_ml, 0)
          + COALESCE(s.acoh_gl_ml, 0) + COALESCE(s.h2po4_ml, 0)
          + COALESCE(s.nh4oh_ml, 0)                                    AS solv_sum_ml
    FROM synthesis_experiments s
),
vol AS (
    SELECT b.*,
        1.0 - (b.solv_sum_ml + b.mod_volume_ml) / NULLIF(b.total_volume_ml, 0)
            AS residual_frac
    FROM base b
)
SELECT
    v.sample_code,
    v.hts_number, v.synthesis_date, v.metal_center, v.linker, v.metal_source,
    v.synthesis_type,

    -- ---- metal ----
    ep.electronegativity_pauling,
    ep.electronegativity_allen,
    ep.absolute_hardness_ev,
    ep.oxophilicity_kepp,
    ep.polarizability_a3,
    mso.oxidation_state, ip.shannon_radius_pm, ip.charge_over_radius,

    -- ---- linker ----
    lp.scaffold, lp.protection_state, lp.denticity, lp.n_acidic_protons,
    lp.max_donor_distance_a, lp.n_rotatable_bonds,

    -- ---- proceso ----
    v.metal_conc_m, v.lm_ratio, v.temp_target_c, v.time_hours,
    v.heating_rate_c_min, v.cooling_rate_c_min,
    v.total_volume_ml, v.reactor_volume_ml,
    v.total_volume_ml / NULLIF(v.reactor_volume_ml, 0) AS fill_fraction,

    -- ---- composicion del medio ----
    CASE WHEN abs(v.residual_frac) > 0.05 THEN NULL
         ELSE v.h2o_total_ml / NULLIF(v.total_volume_ml, 0) END AS frac_h2o,
    CASE WHEN abs(v.residual_frac) > 0.05 THEN NULL
         ELSE v.meoh_ml      / NULLIF(v.total_volume_ml, 0) END AS frac_meoh,
    CASE WHEN abs(v.residual_frac) > 0.05 THEN NULL
         ELSE v.etoh_ml      / NULLIF(v.total_volume_ml, 0) END AS frac_etoh,
    CASE WHEN abs(v.residual_frac) > 0.05 THEN NULL
         ELSE v.proh_1_ml    / NULLIF(v.total_volume_ml, 0) END AS frac_proh,
    CASE WHEN abs(v.residual_frac) > 0.05 THEN NULL
         ELSE v.dmf_ml       / NULLIF(v.total_volume_ml, 0) END AS frac_dmf,
    CASE WHEN abs(v.residual_frac) > 0.05 THEN NULL
         ELSE v.def_ml       / NULLIF(v.total_volume_ml, 0) END AS frac_def,
    CASE WHEN abs(v.residual_frac) > 0.05 THEN NULL
         ELSE COALESCE(v.acoh_gl_ml,0) / NULLIF(v.total_volume_ml, 0) END AS frac_acoh,
    CASE WHEN abs(v.residual_frac) > 0.05 THEN NULL
         ELSE COALESCE(v.h2po4_ml,0) / NULLIF(v.total_volume_ml, 0) END AS frac_h2po4,
    CASE WHEN abs(v.residual_frac) > 0.05 THEN NULL
         ELSE COALESCE(v.nh4oh_ml,0) / NULLIF(v.total_volume_ml, 0) END AS frac_nh4oh,
    CASE WHEN abs(v.residual_frac) > 0.05 THEN NULL
         ELSE v.mod_volume_ml / NULLIF(v.total_volume_ml, 0) END AS frac_modulator,
    -- Valor absoluto: un residuo NEGATIVO significa que los componentes SUPERAN
    -- el volumen total declarado, y eso es tan inconsistente como que falten.
    (abs(v.residual_frac) <= 0.05) AS solvent_breakdown_complete,

    -- ---- moduladores ----
    v.m_carbox  AS mod_carboxylic_mmol,
    v.m_strong  AS mod_strong_acid_mmol,
    v.m_hf      AS mod_hf_mmol,
    v.m_base    AS mod_base_mmol,
    v.m_fluor   AS mod_fluorinated_mmol,
    v.m_carbox + v.m_strong + v.m_hf + v.m_base AS mod_total_mmol,

    -- pKa y logP medios ponderados por cantidad. El acetico glacial entra con
    -- los mismos valores que el acetico en disolucion: es el mismo acido.
    (3.75 * COALESCE(v.formic_acid_mmol, 0)
   + 4.76 * (COALESCE(v.acetic_acid_mmol, 0) + v.acoh_mmol)
   + 4.87 * COALESCE(v.propionic_acid_mmol, 0)) / NULLIF(v.m_carbox, 0)
        AS mod_carbox_mean_pka,
    (-0.54 * COALESCE(v.formic_acid_mmol, 0)
   + -0.17 * (COALESCE(v.acetic_acid_mmol, 0) + v.acoh_mmol)
   +  0.33 * COALESCE(v.propionic_acid_mmol, 0)) / NULLIF(v.m_carbox, 0)
        AS mod_carbox_mean_logp

FROM vol v
LEFT JOIN linker_properties             lp  ON lp.linker_code = v.linker
LEFT JOIN metal_source_oxidation_state  mso
       ON regexp_replace(btrim(replace(mso.metal_source, chr(160), ' ')), '\s+', ' ', 'g')
        = v.metal_source_norm
LEFT JOIN element_properties            ep  ON ep.symbol = v.metal_center
LEFT JOIN ion_properties                ip  ON ip.symbol = mso.symbol
                                            AND ip.oxidation_state = mso.oxidation_state
                                            AND ip.coordination_number = 6
WHERE v.synthesis_type NOT IN ('REFERENCE', 'PENDING_RECORD')
  AND v.metal_center <> '-';

COMMENT ON VIEW v_ml_features IS
    'Tabla de caracteristicas para ML (v3, 2026-09-02). Frente a la v2: unidades de volumen corregidas -- las disoluciones diluidas del Excel (HCl 0,6M, HCl 3M, HF 3M) estan en mL y no en uL, y su agua entra ahora en el balance --, mas tres columnas de disolvente recuperadas (AcOH glacial, H2PO4, NH4OH). El acido acetico glacial cuenta a la vez como disolvente y como modulador carboxilico.';
