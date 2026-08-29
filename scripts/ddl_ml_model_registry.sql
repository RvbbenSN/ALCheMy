-- =============================================================================
-- ddl_ml_model_registry.sql
--
-- Registro de modelos de machine learning. Una fila por modelo entrenado, con
-- TODO lo necesario para saber que es, como se construyo, sobre que datos, y
-- si se puede volver a construir.
--
-- POR QUE UN MODELO NO ES UN FICHERO
-- ----------------------------------
-- La intuicion natural es "guardo el .pkl y ya". Es insuficiente, y este
-- proyecto tiene la prueba: el modelo del cuaderno 06 v2 reportaba F1 0,62 y
-- HOY NO SE PUEDE RECONSTRUIR -- no porque se perdiera un fichero, sino porque
-- los datos sobre los que se entreno se corrigieron despues (un error de
-- unidades de factor 1000). El binario, de haberlo guardado, seguiria cargando
-- sin errores y dando predicciones... calculadas sobre una definicion de las
-- variables que ya no existe. Silenciosamente equivocado.
--
-- Un modelo reproducible son SEIS cosas, y el binario es la menos importante:
--
--   1. LOS DATOS      -> que consulta, sobre que vista, cuantas filas, que
--                        distribucion de clases  (tabla ml_datasets)
--   2. EL CODIGO      -> que cuaderno o script, y en que commit de git
--   3. LOS PARAMETROS -> hiperparametros y preprocesado, explicitos
--   4. LA SEMILLA     -> sin ella, "el mismo codigo" da otro modelo
--   5. LAS VERSIONES  -> scikit-learn cambia defaults entre versiones
--   6. EL BINARIO     -> conveniencia: evita reentrenar. Nada mas.
--
-- Las cinco primeras van en ml_models / ml_datasets; la sexta en
-- ml_model_artifacts, separada a proposito (ver mas abajo).
--
-- POR QUE EL BINARIO VA EN SU PROPIA TABLA
-- ----------------------------------------
-- Mismo patron que rag_chunks y sus vectores (ver "Database safety" en
-- CLAUDE.md): lo pesado y regenerable se separa de lo ligero y consultable, de
-- forma que un volcado pueda excluirlo sin perder el conocimiento. Asi
-- ml_models se puede consultar, unir y volcar barato, y los blobs solo pesan
-- cuando de verdad hace falta llevarselos.
--
-- APLICAR CON
-- -----------
--   python scripts/backup_database.py     (checkpoint: es una migracion DDL)
--   docker exec -i alchemy_postgres psql -U alchemy_user -d alchemy_db \
--       < scripts/ddl_ml_model_registry.sql
-- =============================================================================


-- -----------------------------------------------------------------------------
-- ml_datasets: la INSTANTANEA de datos sobre la que se entreno.
--
-- Es la tabla que evita el fallo del v2. Guarda la consulta literal y su hash,
-- de forma que dos modelos entrenados con la "misma" consulta en momentos
-- distintos se distinguen por el recuento de filas y la distribucion de clases,
-- aunque el texto SQL sea identico.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ml_datasets (
    dataset_id          SERIAL PRIMARY KEY,
    dataset_slug        VARCHAR(80) UNIQUE NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    source_query        TEXT NOT NULL,          -- el SQL literal, sin resumir
    query_sha256        CHAR(64) NOT NULL,      -- hash del SQL normalizado
    feature_source      VARCHAR(80),            -- p.ej. 'v_ml_features v2'

    n_rows              INTEGER NOT NULL,
    n_features          INTEGER,
    n_groups            INTEGER,                -- nº de placas: el tamaño real de muestra
    target_column       VARCHAR(60),
    class_distribution  JSONB,                  -- {"INCIPIENTE": 967, ...}

    filters_human       TEXT,                   -- los filtros en lenguaje humano
    known_caveats       TEXT,                   -- lo que un lector debe saber antes de usarlo

    CONSTRAINT ml_datasets_rows_positive CHECK (n_rows > 0)
);

COMMENT ON TABLE ml_datasets IS
    'Instantanea de datos usada para entrenar. Guarda la consulta literal y su hash para que un cambio en los datos subyacentes sea detectable: dos modelos con la misma consulta pero distinto n_rows o class_distribution NO se entrenaron sobre lo mismo.';
COMMENT ON COLUMN ml_datasets.n_groups IS
    'Numero de grupos de validacion (placas HTS). Es el tamano de muestra EFECTIVO: 1.516 filas en 68 placas se parecen mas a 68 observaciones que a 1.516.';
COMMENT ON COLUMN ml_datasets.known_caveats IS
    'Lo que hay que saber antes de reutilizar este conjunto: sesgos conocidos, columnas dudosas, huecos declarados.';


-- -----------------------------------------------------------------------------
-- ml_models: el registro propiamente dicho.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ml_models (
    model_id            SERIAL PRIMARY KEY,
    model_slug          VARCHAR(80) UNIQUE NOT NULL,   -- 'crystallinity_v3_hts_full'
    display_name        TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- QUE PROBLEMA resuelve
    task_type           VARCHAR(40) NOT NULL,          -- multiclass_classification | binary | regression | clustering
    target_column       VARCHAR(60),
    target_classes      TEXT[],                        -- orden ORDINAL si lo tiene
    question            TEXT,                          -- la pregunta de laboratorio, en una frase

    -- COMO se construyo
    dataset_id          INTEGER REFERENCES ml_datasets(dataset_id),
    algorithm           VARCHAR(80) NOT NULL,          -- 'RandomForestClassifier'
    library             VARCHAR(40) NOT NULL,          -- 'scikit-learn' | 'lightgbm' | 'xgboost'
    hyperparameters     JSONB,                         -- los del estimador final
    preprocessing       JSONB,                         -- imputacion, escalado, codificacion
    validation_scheme   JSONB,                         -- {"cv":"StratifiedGroupKFold","n_splits":5,"group":"hts_number"}
    random_seed         INTEGER,

    -- CON QUE se construyo (sin esto, "mismo codigo" no significa "mismo modelo")
    source_notebook     TEXT,
    git_commit          VARCHAR(50),          -- 40 del hash + sufijo '-dirty'
    python_version      VARCHAR(20),
    library_versions    JSONB,                         -- {"scikit-learn":"1.5.1", "numpy":"1.26.4"}
    platform            TEXT,

    -- ESTADO en el ciclo de vida
    status              VARCHAR(20) NOT NULL DEFAULT 'active',   -- active | superseded | archived | invalid
    superseded_by       INTEGER REFERENCES ml_models(model_id),
    is_reproducible     BOOLEAN NOT NULL DEFAULT TRUE,
    not_reproducible_reason TEXT,
    is_deployed         BOOLEAN NOT NULL DEFAULT FALSE,

    notes               TEXT,                          -- por que existe y que cambio respecto al anterior

    CONSTRAINT ml_models_status_valido
        CHECK (status IN ('active', 'superseded', 'archived', 'invalid')),
    -- Un modelo no reproducible TIENE que decir por que. Sin esta regla, el
    -- campo se queda vacio justo en los casos en los que mas importa.
    CONSTRAINT ml_models_motivo_obligatorio
        CHECK (is_reproducible OR not_reproducible_reason IS NOT NULL)
);

COMMENT ON TABLE ml_models IS
    'Un registro por modelo entrenado. Contiene la RECETA completa (datos, codigo, parametros, semilla, versiones); el binario vive aparte en ml_model_artifacts porque es lo unico regenerable si la receta esta completa.';
COMMENT ON COLUMN ml_models.git_commit IS
    'Commit del repositorio en el momento de entrenar. Sin esto no se sabe que codigo produjo el modelo, por muchos hiperparametros que se guarden.';
COMMENT ON COLUMN ml_models.random_seed IS
    'Semilla. Sin ella, volver a ejecutar el mismo codigo sobre los mismos datos da un modelo DISTINTO en cualquier metodo con aleatoriedad (bosques, boosting, particiones).';
COMMENT ON COLUMN ml_models.library_versions IS
    'Versiones de las librerias. scikit-learn cambia valores por defecto entre versiones: el mismo codigo en otra version puede dar otro modelo sin avisar.';
COMMENT ON COLUMN ml_models.is_reproducible IS
    'FALSE cuando el modelo NO puede reconstruirse hoy, tipicamente porque los datos de entrenamiento cambiaron. Caso real: crystallinity_v2_mixed, invalidado por una correccion de unidades posterior.';
COMMENT ON COLUMN ml_models.status IS
    'active = vigente | superseded = sustituido por otro mejor | archived = se conserva por historia | invalid = sus resultados NO deben usarse.';


-- -----------------------------------------------------------------------------
-- ml_model_metrics: formato LARGO, una fila por (modelo, metrica, particion).
--
-- Largo y no ancho a proposito: anadir una metrica nueva no exige un ALTER
-- TABLE, y comparar modelos entre si es una consulta trivial. Es el mismo
-- criterio por el que data_dictionary es una tabla y no un diccionario en el
-- codigo.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ml_model_metrics (
    model_id        INTEGER NOT NULL REFERENCES ml_models(model_id) ON DELETE CASCADE,
    metric_name     VARCHAR(40) NOT NULL,      -- f1_macro | mcc | balanced_accuracy | accuracy
    split           VARCHAR(20) NOT NULL,      -- cv | holdout | train
    metric_value    DOUBLE PRECISION NOT NULL,
    metric_std      DOUBLE PRECISION,          -- desviacion entre pliegues: sin esto, un valor no se puede comparar
    n_folds         INTEGER,
    -- '' = metrica agregada; si no, la metrica de esa clase concreta.
    -- Cadena vacia y no NULL porque PostgreSQL prohibe NULL en una clave
    -- primaria (mismo criterio que ion_properties.spin_state).
    class_name      VARCHAR(40) NOT NULL DEFAULT '',
    PRIMARY KEY (model_id, metric_name, split, class_name)
);

COMMENT ON TABLE ml_model_metrics IS
    'Metricas en formato largo. Anadir una metrica nueva no requiere cambiar el esquema.';
COMMENT ON COLUMN ml_model_metrics.metric_std IS
    'Desviacion tipica entre pliegues. Un 0,52 con desviacion 0,05 y un 0,52 con desviacion 0,15 no son el mismo resultado, y sin esta columna parecen identicos.';


-- -----------------------------------------------------------------------------
-- ml_model_features: que columnas entraron, y en que papel.
--
-- Permite la consulta que de verdad importa cuando se descubre un fallo:
-- "que modelos usaron mod_strong_acid_mmol antes de la correccion?".
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ml_model_features (
    model_id        INTEGER NOT NULL REFERENCES ml_models(model_id) ON DELETE CASCADE,
    feature_name    VARCHAR(80) NOT NULL,
    feature_role    VARCHAR(20) NOT NULL,      -- input | group | target | excluded
    feature_block   VARCHAR(40),               -- metal | linker | process | medium
    importance      DOUBLE PRECISION,          -- por permutacion, si se midio
    exclusion_reason TEXT,                     -- por que se dejo fuera, si role='excluded'
    PRIMARY KEY (model_id, feature_name),
    CONSTRAINT ml_model_features_role_valido
        CHECK (feature_role IN ('input', 'group', 'target', 'excluded'))
);

COMMENT ON TABLE ml_model_features IS
    'Que columnas entraron en cada modelo y con que papel. Registrar tambien las EXCLUIDAS con su motivo es lo que convierte una decision en una decision auditable.';


-- -----------------------------------------------------------------------------
-- ml_model_artifacts: el binario. Separado a proposito.
--
-- Sobre el FORMATO (la pregunta "en que extension se guarda un modelo"):
--
--   joblib/pickle (.joblib, .pkl)
--       Lo estandar en scikit-learn. Guarda el PIPELINE ENTERO -- imputador,
--       escalador, codificador y estimador -- que es justo lo que hace falta,
--       porque un modelo sin su preprocesado no sirve para nada.
--       PEROS: (a) solo Python; (b) fragil entre versiones de libreria;
--       (c) al cargarlo EJECUTA CODIGO -- nunca cargar un .pkl de origen
--       desconocido, es equivalente a ejecutar un script ajeno.
--
--   ONNX (.onnx)
--       Formato abierto e independiente del lenguaje. Estable entre versiones y
--       NO ejecuta codigo al cargar. Ideal para poner un modelo en produccion.
--       PERO: no todo se convierte, y se pierde la introspeccion (deja de ser
--       un objeto de scikit-learn que puedas inspeccionar).
--
--   Formatos nativos (LightGBM .txt, XGBoost .json/.ubj)
--       Estables, documentados y legibles. Guardan SOLO el estimador: el
--       preprocesado hay que guardarlo aparte.
--
--   Aprendizaje profundo (.pt, .safetensors, .keras)
--       Otra familia. safetensors existe precisamente para evitar el problema
--       de ejecucion de codigo del pickle.
--
-- SI, todos los tipos de modelo se pueden guardar -- pero con garantias
-- distintas. Aqui se usa joblib porque lo que se guarda es un Pipeline
-- completo de scikit-learn, y se acepta su fragilidad a cambio de registrar
-- las versiones en ml_models.library_versions, que es la mitigacion correcta.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ml_model_artifacts (
    model_id            INTEGER PRIMARY KEY REFERENCES ml_models(model_id) ON DELETE CASCADE,
    artifact_format     VARCHAR(20) NOT NULL,      -- joblib | onnx | lightgbm_txt | xgboost_json
    artifact_bytes      BYTEA NOT NULL,
    artifact_size_bytes BIGINT NOT NULL,
    artifact_sha256     CHAR(64) NOT NULL,
    serialized_object   TEXT,                      -- 'sklearn.pipeline.Pipeline' -- QUE es lo que hay dentro
    load_instructions   TEXT NOT NULL,             -- como volver a cargarlo, literal
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ml_model_artifacts_tamano CHECK (artifact_size_bytes > 0)
);

COMMENT ON TABLE ml_model_artifacts IS
    'El binario serializado, en su propia tabla para poder excluirlo de un volcado ligero sin perder el registro (mismo patron que los vectores de rag_chunks). Es la parte REGENERABLE si la receta de ml_models esta completa.';
COMMENT ON COLUMN ml_model_artifacts.artifact_sha256 IS
    'Huella del binario. Permite detectar corrupcion y comprobar que el fichero que alguien tiene en disco es de verdad este modelo.';
COMMENT ON COLUMN ml_model_artifacts.load_instructions IS
    'Como cargarlo, escrito literalmente. Un binario sin instrucciones de carga es un problema futuro garantizado.';


-- -----------------------------------------------------------------------------
-- Vista de consulta: el registro legible de un vistazo, sin los blobs.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_ml_model_registry AS
SELECT
    m.model_id, m.model_slug, m.display_name, m.status, m.is_reproducible,
    m.algorithm, m.library, m.created_at::date AS created_on,
    d.dataset_slug, d.n_rows, d.n_groups,
    MAX(mt.metric_value) FILTER (WHERE mt.metric_name = 'f1_macro'
                                   AND mt.split = 'cv') AS f1_macro_cv,
    MAX(mt.metric_value) FILTER (WHERE mt.metric_name = 'matthews_corrcoef'
                                   AND mt.split = 'cv') AS mcc_cv,
    (a.model_id IS NOT NULL) AS has_artifact,
    pg_size_pretty(a.artifact_size_bytes) AS artifact_size,
    m.git_commit, m.source_notebook, m.notes
FROM ml_models m
LEFT JOIN ml_datasets d ON d.dataset_id = m.dataset_id
LEFT JOIN ml_model_metrics mt ON mt.model_id = m.model_id
LEFT JOIN ml_model_artifacts a ON a.model_id = m.model_id
GROUP BY m.model_id, d.dataset_slug, d.n_rows, d.n_groups,
         a.model_id, a.artifact_size_bytes
ORDER BY m.created_at DESC;

COMMENT ON VIEW v_ml_model_registry IS
    'El registro de modelos en forma legible, sin los binarios: que modelos hay, sobre que datos, con que resultado y si siguen siendo reproducibles.';


-- =============================================================================
-- data_dictionary
-- =============================================================================
INSERT INTO data_dictionary
    (table_name, column_name, full_name, section_name, unit, data_type, valid_categories, description) VALUES
('ml_models','model_slug','Model slug','IDENTITY',NULL,'VARCHAR(80)',NULL,
 'Identificador legible y estable del modelo, p.ej. crystallinity_v3_hts_full.'),
('ml_models','is_reproducible','Is reproducible','QUALITY',NULL,'BOOLEAN',NULL,
 'FALSE cuando el modelo no puede reconstruirse hoy, normalmente porque los datos de entrenamiento se corrigieron despues. Exige rellenar not_reproducible_reason.'),
('ml_models','status','Lifecycle status','QUALITY',NULL,'VARCHAR(20)','active | superseded | archived | invalid',
 'Estado en el ciclo de vida. invalid significa que sus resultados no deben usarse.'),
('ml_models','random_seed','Random seed','REPRODUCIBILITY',NULL,'INTEGER',NULL,
 'Semilla aleatoria. Sin ella el mismo codigo sobre los mismos datos produce un modelo distinto.'),
('ml_models','library_versions','Library versions','REPRODUCIBILITY',NULL,'JSONB',NULL,
 'Versiones de las librerias en el momento de entrenar; scikit-learn cambia defaults entre versiones.'),
('ml_datasets','query_sha256','Query hash','IDENTITY',NULL,'CHAR(64)',NULL,
 'Hash del SQL normalizado que definio el conjunto. Junto con n_rows detecta que los datos cambiaron aunque la consulta sea la misma.'),
('ml_datasets','n_groups','Number of groups','STATISTICS',NULL,'INTEGER',NULL,
 'Grupos de validacion (placas). Es el tamano de muestra efectivo.'),
('ml_model_metrics','metric_std','Metric std. dev.','STATISTICS',NULL,'DOUBLE PRECISION',NULL,
 'Desviacion entre pliegues de validacion cruzada. Un valor medio sin su dispersion no es comparable.'),
('ml_model_artifacts','artifact_format','Artifact format','STORAGE',NULL,'VARCHAR(20)','joblib | onnx | lightgbm_txt | xgboost_json',
 'Formato de serializacion. joblib guarda el pipeline completo pero es fragil entre versiones y ejecuta codigo al cargar; onnx es portable y seguro pero pierde introspeccion.'),
('ml_model_artifacts','artifact_sha256','Artifact hash','QUALITY',NULL,'CHAR(64)',NULL,
 'SHA-256 del binario, para detectar corrupcion y verificar identidad.')
ON CONFLICT (table_name, column_name) DO UPDATE SET
    full_name = EXCLUDED.full_name, section_name = EXCLUDED.section_name,
    unit = EXCLUDED.unit, data_type = EXCLUDED.data_type,
    valid_categories = EXCLUDED.valid_categories, description = EXCLUDED.description;
