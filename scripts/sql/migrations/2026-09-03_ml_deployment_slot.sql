-- =============================================================================
-- ddl_ml_deployment_slot.sql
--
-- Convierte el registro de modelos en el PUNTERO DE DESPLIEGUE: la base deja de
-- decir solo "que modelos existen" y pasa a decir "cual se esta sirviendo".
--
-- EL PROBLEMA QUE RESUELVE
-- -----------------------
-- Antes de esto, el slug del modelo que alimenta la web estaba escrito a mano
-- en `scripts/build_simulator_grid.py` (MODEL_SLUG = 'crystallinity_v3_...') y
-- las metricas estaban escritas a mano en un componente de React. Consecuencia
-- real y comprobada: se entreno el v4 --que corrige un error de unidades de
-- factor 1000-- y la web siguio sirviendo predicciones del v3 sin que nada
-- fallara ni avisara. Un modelo obsoleto no da error: da respuestas.
--
-- La regla que impone este fichero es que **cambiar de modelo sea un UPDATE**,
-- no una edicion de codigo repartida por tres ficheros.
--
-- POR QUE UNA RANURA Y NO UN BOOLEANO SUELTO
-- ------------------------------------------
-- La web sirve DOS modelos a la vez con papeles distintos: el completo (todas
-- las variables, el mejor numero) y el accionable (solo variables que el
-- quimico puede fijar antes de sintetizar). Un `is_deployed` booleano no
-- distingue papeles: diria "estos dos estan desplegados" sin decir cual va en
-- cada sitio. La ranura nombra el papel, y el indice unico garantiza que solo
-- haya UN modelo en cada uno -- no se puede desplegar dos primarios por
-- descuido.
--
-- `is_deployed` se conserva, pero pasa a ser GENERATED: se calcula de la
-- ranura. Asi no hay dos fuentes de verdad que puedan discrepar.
--
-- APLICAR CON
-- -----------
--   python scripts/backup_database.py     (checkpoint: es una migracion DDL)
--   docker exec -i alchemy_postgres psql -U alchemy_user -d alchemy_db \
--       < scripts/ddl_ml_deployment_slot.sql
-- =============================================================================

BEGIN;

-- 1. La ranura. NULL = el modelo existe en el registro pero no se sirve.
ALTER TABLE ml_models ADD COLUMN IF NOT EXISTS deployment_slot VARCHAR(30);

-- 2. `is_deployed` deja de ser un dato que alguien pueda olvidar actualizar y
--    pasa a ser un espejo de la ranura, calculado por la base.
ALTER TABLE ml_models DROP COLUMN IF EXISTS is_deployed;
ALTER TABLE ml_models ADD COLUMN is_deployed BOOLEAN
    GENERATED ALWAYS AS (deployment_slot IS NOT NULL) STORED;

-- 3. Solo hay dos papeles, y son los que la web sabe consumir. Un slug mal
--    escrito ('primaria', 'full') tiene que fallar aqui y no seis pasos mas
--    tarde con un generador que no encuentra nada.
ALTER TABLE ml_models DROP CONSTRAINT IF EXISTS ml_models_slot_valido;
ALTER TABLE ml_models ADD CONSTRAINT ml_models_slot_valido
    CHECK (deployment_slot IS NULL OR deployment_slot IN ('primary', 'actionable'));

-- 4. Un modelo que ya no es vigente no puede quedarse servido. Esto es lo que
--    obliga a MOVER el puntero al sustituir un modelo: marcar el viejo como
--    'superseded' falla mientras siga ocupando su ranura.
ALTER TABLE ml_models DROP CONSTRAINT IF EXISTS ml_models_slot_solo_activo;
ALTER TABLE ml_models ADD CONSTRAINT ml_models_slot_solo_activo
    CHECK (deployment_slot IS NULL OR status = 'active');

-- 5. Un unico modelo por ranura. Parcial porque los NULL no compiten.
CREATE UNIQUE INDEX IF NOT EXISTS ml_models_slot_unico
    ON ml_models (deployment_slot) WHERE deployment_slot IS NOT NULL;

COMMENT ON COLUMN ml_models.deployment_slot IS
    'Papel con el que este modelo se esta sirviendo: primary (el modelo completo, el que alimenta el simulador) o actionable (solo variables fijables antes de sintetizar). NULL = registrado pero no servido. Es el puntero de despliegue: cambiar de modelo en produccion es un UPDATE de esta columna mas volver a generar los artefactos de la web.';
COMMENT ON COLUMN ml_models.is_deployed IS
    'Calculada: TRUE si el modelo ocupa una ranura de despliegue. No se escribe a mano, para que no pueda discrepar de deployment_slot.';


-- -----------------------------------------------------------------------------
-- Estado inicial: se sirve el v4, que es el entrenado despues de corregir las
-- unidades de volumen. El v3 se queda 'superseded' y sin ranura.
-- -----------------------------------------------------------------------------
UPDATE ml_models SET deployment_slot = NULL;
UPDATE ml_models SET deployment_slot = 'primary'
 WHERE model_slug = 'crystallinity_v4_hts_full';
UPDATE ml_models SET deployment_slot = 'actionable'
 WHERE model_slug = 'crystallinity_v4_hts_actionable';


-- -----------------------------------------------------------------------------
-- v_ml_deployed: que se esta sirviendo ahora mismo, de un vistazo.
--
-- Es la consulta que responde "el numero que sale en la web, de donde viene",
-- y la que usan los generadores en vez de llevar un slug escrito dentro.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_ml_deployed AS
SELECT
    m.deployment_slot,
    m.model_slug,
    m.display_name,
    m.status,
    m.algorithm,
    m.git_commit,
    m.source_notebook,
    d.dataset_slug,
    d.n_rows,
    d.n_groups,
    (a.model_id IS NOT NULL) AS has_artifact,
    a.artifact_sha256
FROM ml_models m
LEFT JOIN ml_datasets d ON d.dataset_id = m.dataset_id
LEFT JOIN ml_model_artifacts a ON a.model_id = m.model_id
WHERE m.deployment_slot IS NOT NULL
ORDER BY m.deployment_slot;

COMMENT ON VIEW v_ml_deployed IS
    'Los modelos que se estan sirviendo ahora mismo y con que papel. Una fila por ranura; si esta vacia, no hay nada desplegado.';


-- =============================================================================
-- data_dictionary
-- =============================================================================
INSERT INTO data_dictionary
    (table_name, column_name, full_name, section_name, unit, data_type, valid_categories, description) VALUES
('ml_models','deployment_slot','Deployment slot','DEPLOYMENT',NULL,'VARCHAR(30)','primary | actionable',
 'Papel con el que el modelo se sirve en la web. NULL significa registrado pero no servido. Solo un modelo por ranura, y solo si su estado es active.'),
('ml_models','is_deployed','Is deployed','DEPLOYMENT',NULL,'BOOLEAN',NULL,
 'Calculada a partir de deployment_slot. TRUE si el modelo ocupa una ranura de despliegue.'),
-- Las columnas de la vista van tambien al diccionario: `src/sync_data_dictionary.py`
-- audita tablas Y vistas, y una vista sin documentar baja la cobertura global.
('v_ml_deployed','deployment_slot','Deployment slot','DEPLOYMENT',NULL,'VARCHAR(30)','primary | actionable',
 'Papel con el que se sirve el modelo: primary alimenta el simulador de la web, actionable es el modelo restringido a variables fijables antes de sintetizar.'),
('v_ml_deployed','model_slug','Model slug','IDENTITY',NULL,'VARCHAR(80)',NULL,
 'Identificador estable del modelo que ocupa la ranura.'),
('v_ml_deployed','display_name','Display name','IDENTITY',NULL,'TEXT',NULL,
 'Nombre legible del modelo, tal y como se muestra en la web.'),
('v_ml_deployed','status','Lifecycle status','QUALITY',NULL,'VARCHAR(20)','active',
 'Estado del modelo. Solo un modelo active puede ocupar una ranura, por restriccion de la tabla.'),
('v_ml_deployed','algorithm','Algorithm','METHOD',NULL,'VARCHAR(80)',NULL,
 'Clase del estimador final del pipeline servido.'),
('v_ml_deployed','git_commit','Git commit','REPRODUCIBILITY',NULL,'VARCHAR(50)',NULL,
 'Commit del repositorio en el momento de entrenar el modelo servido.'),
('v_ml_deployed','source_notebook','Source notebook','REPRODUCIBILITY',NULL,'TEXT',NULL,
 'Cuaderno o script que produjo el modelo servido.'),
('v_ml_deployed','dataset_slug','Dataset slug','IDENTITY',NULL,'VARCHAR(80)',NULL,
 'Instantanea de datos sobre la que se entreno el modelo servido.'),
('v_ml_deployed','n_rows','Training rows','STATISTICS',NULL,'INTEGER',NULL,
 'Filas del conjunto de entrenamiento del modelo servido.'),
('v_ml_deployed','n_groups','Training groups','STATISTICS',NULL,'INTEGER',NULL,
 'Grupos de validacion (placas) del conjunto: el tamano de muestra efectivo.'),
('v_ml_deployed','has_artifact','Has artifact','STORAGE',NULL,'BOOLEAN',NULL,
 'TRUE si el binario del modelo esta guardado en ml_model_artifacts. Una ranura ocupada por un modelo sin binario no se puede servir.'),
('v_ml_deployed','artifact_sha256','Artifact hash','QUALITY',NULL,'CHAR(64)',NULL,
 'SHA-256 del binario servido. Permite comprobar que lo que se carga es exactamente lo registrado.')
ON CONFLICT (table_name, column_name) DO UPDATE SET
    full_name = EXCLUDED.full_name, section_name = EXCLUDED.section_name,
    unit = EXCLUDED.unit, data_type = EXCLUDED.data_type,
    valid_categories = EXCLUDED.valid_categories, description = EXCLUDED.description;

COMMIT;
