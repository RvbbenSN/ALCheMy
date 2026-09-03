-- =============================================================================
-- ml_model_features: guardar TAMBIEN el orden de las columnas de entrada
-- 2026-09-03
-- =============================================================================
--
-- El problema. Un Pipeline de scikit-learn entrenado con un DataFrame recuerda
-- los nombres de sus columnas, pero exige recibirlas en el MISMO ORDEN. Las
-- instrucciones de carga de ml_model_artifacts ya lo advertian --"X con las
-- MISMAS columnas y en el MISMO orden"-- pero ese orden no estaba escrito en
-- ninguna parte: `SELECT feature_name FROM ml_model_features` devuelve las filas
-- en el orden que le apetezca al planificador.
--
-- Por que importa mas de lo que parece. Si el backend construye X con las
-- columnas desordenadas, scikit-learn NO siempre da error: si los nombres
-- coinciden, algunas versiones reordenan solas; si el consumidor pasa un array
-- de numpy en vez de un DataFrame, se predice con los valores cruzados y
-- **no se entera nadie**. Radio ionico entrando por la casilla de temperatura da
-- una prediccion perfectamente plausible y perfectamente falsa. Es el tipo de
-- fallo que este registro existe para hacer imposible.
--
-- Aplicar con:
--   docker exec -i alchemy_postgres psql -U alchemy_user -d alchemy_db \
--     < scripts/ddl_ml_model_features_position.sql
--
-- Es aditivo (ADD COLUMN IF NOT EXISTS, nullable): no rompe ninguna fila
-- existente ni ninguna consulta anterior. Aun asi, backup antes: es una
-- migracion.
-- =============================================================================

ALTER TABLE ml_model_features
    ADD COLUMN IF NOT EXISTS feature_position INTEGER;

COMMENT ON COLUMN ml_model_features.feature_position IS
    'Posicion (0-based) de la columna en el DataFrame con el que se entreno el '
    'pipeline. Solo tiene sentido para feature_role = ''input''; NULL en las '
    'demas. Para construir X hay que hacer ORDER BY feature_position: sin el, '
    'el orden de las filas no esta garantizado y el modelo puede predecir con '
    'las columnas cruzadas sin dar error.';

-- Un modelo no puede tener dos entradas en la misma posicion.
CREATE UNIQUE INDEX IF NOT EXISTS ux_ml_model_features_position
    ON ml_model_features (model_id, feature_position)
    WHERE feature_position IS NOT NULL;

-- Vista de conveniencia: el contrato de entrada de cada modelo, listo para que
-- lo lea el backend sin tener que conocer el esquema.
DROP VIEW IF EXISTS v_ml_model_input_contract;
CREATE VIEW v_ml_model_input_contract AS
SELECT m.model_slug,
       m.status,
       m.algorithm,
       f.feature_position,
       f.feature_name,
       f.feature_block,
       f.importance
  FROM ml_models m
  JOIN ml_model_features f ON f.model_id = m.model_id
 WHERE f.feature_role = 'input'
 ORDER BY m.model_slug, f.feature_position;

COMMENT ON VIEW v_ml_model_input_contract IS
    'Las columnas de entrada de cada modelo, en el orden exacto en que hay que '
    'pasarselas. Es lo que debe leer cualquier servicio que cargue un modelo del '
    'registro; no hardcodear la lista.';
