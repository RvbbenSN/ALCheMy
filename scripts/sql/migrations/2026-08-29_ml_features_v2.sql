-- =============================================================================
-- ddl_ml_features_v2.sql
--
-- Reconstruccion de v_ml_features tras la revision experta del cuaderno 06
-- (2026-08-29). Cierra los 6 defectos encontrados en la revision, mas un
-- septimo que aparecio al comprobar el primero. El factor x1000 de los
-- moduladores se corrige en los datos, no aqui: src/fix_modulator_units_2026_08.py.
--
-- QUE CAMBIA Y POR QUE
-- --------------------
-- 1. DISOLVENTES COMPLETOS. La v1 exponia 4 de las 6 columnas de disolvente:
--    faltaban proh_1_ml (1-propanol, 208 sintesis) y def_ml (DEF, 11). Las
--    fracciones sumaban 0,789 de media en vez de 1.
--
-- 2. EL MODULADOR ES PARTE DEL MEDIO, NO SOLO UN ADITIVO. Al comprobar el
--    punto 1 aparecio que el volumen seguia sin cuadrar. La causa no era un
--    fallo: en muchas sintesis el modulador liquido ES el disolvente. RS1188
--    lleva 17,91 mmol de acido propionico = 1,347 mL de 1,5 mL totales; con
--    los 0,153 mL de agua, el volumen cuadra exacto. Tratar eso como "un
--    aditivo" y no como composicion del medio era perder la mitad de la
--    quimica. Se reconstruye el volumen de modulador invirtiendo la formula
--    del cuaderno 01 y se expone como frac_modulator.
--
-- 3. CUANDO EL VOLUMEN NO CUADRA, LAS FRACCIONES SON NULL, NO CERO. Tras (1) y
--    (2) quedan ~324 sintesis HTS donde el desglose de disolvente no explica el
--    volumen total: el historico registro el total pero no el reparto. Poner 0
--    en esas fracciones le dice al modelo "no habia metanol", que es una
--    afirmacion falsa; NULL dice "no se registro", que es la verdad. Es la
--    diferencia entre un dato ausente y un dato negativo, y confundirlos es
--    exactamente lo que hace que un modelo aprenda de un artefacto de registro.
--
-- 4. HF SEPARADO DEL HCl. La v1 los sumaba como "acido fuerte". El HF es
--    mineralizante y altera la cinetica de forma cualitativamente distinta
--    (hay MOFs que solo cristalizan con HF). Son 25 sintesis: suficientes para
--    una columna propia sin riesgo de sobreajuste.
--
-- 5. MODULADORES COMO QUIMICA, NO COMO RECUENTO. La v1 sumaba mmol por rol,
--    tratando 1 mmol de formico (pKa 3,75) igual que 1 mmol de propionico
--    (pKa 4,87). Se anaden descriptores ponderados por cantidad -- pKa medio y
--    logP medio -- para que el modelo distinga acidez y polaridad sin necesitar
--    una columna por reactivo. Mismo patron ya aplicado a metales y linkers.
--
--    NOTA SOBRE LOS pKa: valores acuosos estandar a 25 C. En medio mixto
--    agua/alcohol se desplazan, asi que es una APROXIMACION DECLARADA. Se usan
--    como descriptor ordinal y NO se supone desprotonacion total, que
--    dependeria del medio.
--
-- 6. meo3s_mmol (acido metanosulfonico) DEJA DE PERDERSE. La v1 no lo incluia
--    en ninguna categoria: 6 sintesis desaparecian del modelo.
--
-- 7. synthesis_type EXPUESTO. Es el mayor factor de confusion del conjunto
--    (MW 95,7% cristalino vs HTS 11,0%, por sesgo de seleccion: la combinatoria
--    explora, la estandar y el microondas escalan recetas que ya funcionaban).
--    Tiene que ser visible para poder decidir sobre el, no invisible.
--
-- 8. EMPAREJAMIENTO DE PRECURSOR NORMALIZADO. 22 filas perdian oxidation_state
--    y radio ionico no por falta de quimica, sino porque el texto lleva un
--    ESPACIO DURO (U+00A0) en vez de uno normal: 'MgCl2 . 6H2O'. En vez de
--    anadir cada variante tipografica a mano -- una carrera que no se gana --
--    el join normaliza ambos lados. Deja 1 sin resolver, y ese es un 'UNKNOWN'
--    literal: desconocido de verdad.
--
-- 9. FILAS SIN METAL FUERA. RS94 y RS95 tienen metal_center = '-': sintesis sin
--    metal registrado. Son basura, no un valor ausente que imputar.
--
-- APLICAR CON
-- -----------
--   python scripts/backup_database.py     (checkpoint: esto es una migracion)
--   docker exec -i alchemy_postgres psql -U alchemy_user -d alchemy_db \
--       < scripts/ddl_ml_features_v2.sql
-- =============================================================================


-- -----------------------------------------------------------------------------
-- (a) La vista, version 2.
--
-- CREATE OR REPLACE no permite insertar columnas en medio de la lista, y la v2
-- anade varias. Hay que recrearla.
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS v_ml_features;
CREATE VIEW v_ml_features AS
WITH base AS (
    SELECT
        s.*,
        -- Clave normalizada para casar con metal_source_oxidation_state:
        -- espacio duro -> espacio, espacios colapsados, sin extremos.
        regexp_replace(btrim(replace(s.metal_source, chr(160), ' ')), '\s+', ' ', 'g')
            AS metal_source_norm,

        -- Moduladores por PAPEL QUIMICO, ya en unidades coherentes.
        -- "Fuerte" = pKa < 1, practicamente disociado del todo en agua.
        COALESCE(s.formic_acid_mmol, 0) + COALESCE(s.acetic_acid_mmol, 0)
          + COALESCE(s.propionic_acid_mmol, 0)                        AS m_carbox,
        COALESCE(s.hcl_active_mmol, 0) + COALESCE(s.tfa_mmol, 0)
          + COALESCE(s.cf3so3h_mmol, 0) + COALESCE(s.meo3s_mmol, 0)   AS m_strong,
        COALESCE(s.hf_active_mmol, 0)                                 AS m_hf,
        COALESCE(s.koh_active_mmol, 0) + COALESCE(s.triethylamine_mmol, 0) AS m_base,
        COALESCE(s.hf_active_mmol, 0) + COALESCE(s.tfa_mmol, 0)
          + COALESCE(s.cf3so3h_mmol, 0)                               AS m_fluor,

        -- Volumen (mL) ocupado por los moduladores liquidos puros, reconstruido
        -- invirtiendo la formula del cuaderno 01: uL = mmol * 100 * MW / (rho * P%).
        -- Las constantes son las mismas que alli (densidad, pureza, peso molecular).
        (  COALESCE(s.formic_acid_mmol, 0)    * 100 * 46.03  / (1.220 * 98.0)
         + COALESCE(s.acetic_acid_mmol, 0)    * 100 * 60.05  / (1.050 * 99.8)
         + COALESCE(s.propionic_acid_mmol, 0) * 100 * 74.08  / (0.990 * 99.5)
         + COALESCE(s.tfa_mmol, 0)            * 100 * 114.02 / (1.490 * 99.0)
         + COALESCE(s.cf3so3h_mmol, 0)        * 100 * 150.08 / (1.700 * 99.0)
         + COALESCE(s.triethylamine_mmol, 0)  * 100 * 101.19 / (0.726 * 99.5)
         + COALESCE(s.meo3s_mmol, 0)          * 100 * 96.11  / (1.480 * 99.5)
        ) / 1000.0                                                    AS mod_volume_ml,

        COALESCE(s.h2o_total_ml, 0) + COALESCE(s.meoh_ml, 0) + COALESCE(s.etoh_ml, 0)
          + COALESCE(s.proh_1_ml, 0) + COALESCE(s.dmf_ml, 0) + COALESCE(s.def_ml, 0)
                                                                      AS solv_sum_ml
    FROM synthesis_experiments s
),
vol AS (
    SELECT b.*,
        -- Lo que queda del volumen total tras contar disolventes Y moduladores.
        1.0 - (b.solv_sum_ml + b.mod_volume_ml) / NULLIF(b.total_volume_ml, 0)
            AS residual_frac
    FROM base b
)
SELECT
    v.sample_code,
    -- claves de agrupamiento para la validacion (roadmap SS8), nunca como entrada
    v.hts_number, v.synthesis_date, v.metal_center, v.linker, v.metal_source,
    -- expuesto por fin: el mayor factor de confusion del conjunto
    v.synthesis_type,

    -- ---- metal, como quimica ----
    ep.electronegativity_pauling,
    ep.electronegativity_allen,   -- NULL en lantanidos: la escala no esta definida
    ep.absolute_hardness_ev,      -- NULL en Mg y Zn: capas llenas, sin afinidad electronica
    ep.oxophilicity_kepp,         -- NULL en Ga: ausente de la Tabla 1 de Kepp
    ep.polarizability_a3,
    mso.oxidation_state, ip.shannon_radius_pm, ip.charge_over_radius,

    -- ---- linker, como quimica ----
    lp.scaffold, lp.protection_state, lp.denticity, lp.n_acidic_protons,
    lp.max_donor_distance_a, lp.n_rotatable_bonds,

    -- ---- proceso ----
    v.metal_conc_m, v.lm_ratio, v.temp_target_c, v.time_hours,
    v.heating_rate_c_min, v.cooling_rate_c_min,
    v.total_volume_ml, v.reactor_volume_ml,
    v.total_volume_ml / NULLIF(v.reactor_volume_ml, 0) AS fill_fraction,

    -- ---- composicion del medio ----
    -- NULL, no 0, cuando el desglose no explica el volumen: "no se registro"
    -- no es lo mismo que "no habia". Umbral 5%: por debajo, el descuadre es
    -- redondeo del cuaderno de laboratorio; por encima, falta un componente.
    CASE WHEN v.residual_frac > 0.05 THEN NULL
         ELSE v.h2o_total_ml / NULLIF(v.total_volume_ml, 0) END AS frac_h2o,
    CASE WHEN v.residual_frac > 0.05 THEN NULL
         ELSE v.meoh_ml      / NULLIF(v.total_volume_ml, 0) END AS frac_meoh,
    CASE WHEN v.residual_frac > 0.05 THEN NULL
         ELSE v.etoh_ml      / NULLIF(v.total_volume_ml, 0) END AS frac_etoh,
    CASE WHEN v.residual_frac > 0.05 THEN NULL
         ELSE v.proh_1_ml    / NULLIF(v.total_volume_ml, 0) END AS frac_proh,
    CASE WHEN v.residual_frac > 0.05 THEN NULL
         ELSE v.dmf_ml       / NULLIF(v.total_volume_ml, 0) END AS frac_dmf,
    CASE WHEN v.residual_frac > 0.05 THEN NULL
         ELSE v.def_ml       / NULLIF(v.total_volume_ml, 0) END AS frac_def,
    CASE WHEN v.residual_frac > 0.05 THEN NULL
         ELSE v.mod_volume_ml / NULLIF(v.total_volume_ml, 0) END AS frac_modulator,
    -- bandera de calidad, siempre poblada: permite modelar con y sin esas filas
    (v.residual_frac <= 0.05) AS solvent_breakdown_complete,

    -- ---- moduladores: cuanto ----
    v.m_carbox  AS mod_carboxylic_mmol,
    v.m_strong  AS mod_strong_acid_mmol,   -- HCl + TFA + triflico + metanosulfonico
    v.m_hf      AS mod_hf_mmol,            -- SEPARADO: mineralizante
    v.m_base    AS mod_base_mmol,
    v.m_fluor   AS mod_fluorinated_mmol,   -- HF + TFA + triflico
    v.m_carbox + v.m_strong + v.m_hf + v.m_base AS mod_total_mmol,

    -- ---- moduladores: que clase de acido, no solo cuanto ----
    -- Media ponderada por cantidad. NULL si no hubo modulador carboxilico, que
    -- es lo correcto: "sin acido" no es "pKa 0".
    (3.75 * COALESCE(v.formic_acid_mmol, 0)
   + 4.76 * COALESCE(v.acetic_acid_mmol, 0)
   + 4.87 * COALESCE(v.propionic_acid_mmol, 0)) / NULLIF(v.m_carbox, 0)
        AS mod_carbox_mean_pka,
    -- logP: proxy de polaridad / longitud de cadena. Cadena mas larga => menos
    -- polar => distinto efecto sobre la cinetica de coordinacion.
    (-0.54 * COALESCE(v.formic_acid_mmol, 0)
   + -0.17 * COALESCE(v.acetic_acid_mmol, 0)
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
  AND v.metal_center <> '-';     -- RS94 y RS95: sintesis sin metal registrado

COMMENT ON VIEW v_ml_features IS
    'Tabla de caracteristicas para ML, ensamblada en tiempo de consulta (v2, 2026-08-29). Frente a la v1: los seis disolventes en vez de cuatro, el volumen del modulador liquido contado como parte del medio (frac_modulator), fracciones a NULL cuando el desglose no explica el volumen (con bandera solvent_breakdown_complete), HF separado del HCl, acido metanosulfonico ya no se pierde, descriptores quimicos de modulador (pKa y logP medios ponderados), synthesis_type expuesto, emparejamiento de precursor normalizado frente al espacio duro U+00A0, y las filas sin metal fuera. metal_center/linker/hts_number/synthesis_date siguen siendo SOLO para agrupar en la validacion, nunca entradas del modelo.';


-- -----------------------------------------------------------------------------
-- (b) data_dictionary: las columnas nuevas, para que la vista siga siendo
--     auto-documentada desde la propia base.
-- -----------------------------------------------------------------------------
INSERT INTO data_dictionary
    (table_name, column_name, full_name, section_name, unit, data_type, valid_categories, description) VALUES
('v_ml_features','frac_modulator','Modulator volume fraction','MEDIUM',NULL,'DOUBLE PRECISION',NULL,
 'Fraccion del volumen total ocupada por los moduladores liquidos puros, reconstruida desde los mmol. En muchas sintesis el modulador ES el disolvente (p.ej. RS1188: 1,35 mL de acido propionico de 1,5 mL totales).'),
('v_ml_features','solvent_breakdown_complete','Solvent breakdown complete','QUALITY',NULL,'BOOLEAN',NULL,
 'FALSE cuando disolventes + moduladores no explican el volumen total (residuo > 5%): el historico registro el total pero no el reparto. Con FALSE, las fracciones son NULL en vez de 0, para no afirmar una ausencia que no consta.'),
('v_ml_features','mod_hf_mmol','HF modulator','MODULATOR','mmol','DOUBLE PRECISION',NULL,
 'HF activo, separado del resto de acidos fuertes por su papel mineralizante: altera la cinetica de forma cualitativamente distinta al HCl.'),
('v_ml_features','mod_carbox_mean_pka','Mean carboxylic pKa','MODULATOR',NULL,'DOUBLE PRECISION',NULL,
 'pKa medio ponderado por cantidad de los moduladores carboxilicos (formico 3,75; acetico 4,76; propionico 4,87). Valores acuosos estandar a 25 C: aproximacion declarada, en medio mixto se desplazan.'),
('v_ml_features','mod_carbox_mean_logp','Mean carboxylic logP','MODULATOR',NULL,'DOUBLE PRECISION',NULL,
 'logP medio ponderado por cantidad de los moduladores carboxilicos. Proxy de polaridad y longitud de cadena, que gobiernan el efecto sobre la cinetica de coordinacion.'),
('v_ml_features','synthesis_type','Synthesis type','DESIGN',NULL,'VARCHAR',NULL,
 'ST (estandar) | HTS (combinatoria) | MW (microondas). Mayor factor de confusion del conjunto: MW 95,7% cristalino frente a HTS 11,0%, por sesgo de seleccion y no por efecto del metodo.')
ON CONFLICT (table_name, column_name) DO UPDATE SET
    full_name = EXCLUDED.full_name, section_name = EXCLUDED.section_name,
    unit = EXCLUDED.unit, data_type = EXCLUDED.data_type,
    valid_categories = EXCLUDED.valid_categories, description = EXCLUDED.description;
