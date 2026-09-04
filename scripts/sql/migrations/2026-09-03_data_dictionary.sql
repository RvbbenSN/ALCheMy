-- =============================================================================
-- COMMENTs nativos de las columnas nuevas de septiembre de 2026
-- =============================================================================
--
-- data_dictionary existe para que la web y los agentes lean la documentacion
-- DESDE la base en vez de llevarla escrita en el codigo, y eso solo funciona con
-- cobertura del 100 %: un agente que consulta el diccionario y no encuentra una
-- columna no puede distinguir entre "no esta documentada" y "no existe".
--
-- Estas 13 columnas se quedaron sin COMMENT al aplicar la correccion de unidades
-- (acoh_gl_ml, h2po4_ml, nh4oh_ml y sus fracciones), el registro de posiciones
-- (feature_position) y la vista del contrato de entrada. Se documentan aqui y
-- despues se sincroniza con:
--     python src/sync_data_dictionary.py --sync
--
-- Aplicar con:
--   docker exec -i alchemy_postgres psql -U alchemy_user -d alchemy_db \
--     < scripts/ddl_data_dictionary_2026_09.sql
-- =============================================================================

-- --- synthesis_experiments: los tres disolventes que faltaban por mapear ------

COMMENT ON COLUMN synthesis_experiments.acoh_gl_ml IS
    'Acido acetico glacial anadido, en mL. Cuenta DOS veces en v_ml_features y a '
    'proposito: es disolvente (lo es) y a la vez modulador carboxilico '
    '(x 17,4855 mmol/mL, su molaridad como liquido puro). Dejarlo fuera de '
    'cualquiera de los dos sitios describe mal el medio.';

COMMENT ON COLUMN synthesis_experiments.h2po4_ml IS
    'Acido fosforico anadido, en mL. En algunas sintesis constituye el volumen '
    'entero de reaccion, asi que sin esta columna sus fracciones de disolvente '
    'sumaban cero.';

COMMENT ON COLUMN synthesis_experiments.nh4oh_ml IS
    'Hidroxido de amonio anadido, en mL. Del bloque Q:AB del Excel maestro, es '
    'decir en mililitros, no en microlitros.';

-- --- v_ml_features: las fracciones correspondientes --------------------------

COMMENT ON COLUMN v_ml_features.frac_acoh IS
    'Fraccion del volumen total que es acido acetico glacial. Suma 1 junto a las '
    'otras nueve fracciones cuando solvent_breakdown_complete es TRUE.';

COMMENT ON COLUMN v_ml_features.frac_h2po4 IS
    'Fraccion del volumen total que es acido fosforico. Puede valer 1: hay '
    'sintesis cuyo medio es integramente H3PO4.';

COMMENT ON COLUMN v_ml_features.frac_nh4oh IS
    'Fraccion del volumen total que es hidroxido de amonio.';

-- --- v_ml_model_input_contract ----------------------------------------------

COMMENT ON COLUMN v_ml_model_input_contract.model_slug IS
    'Identificador estable del modelo, el mismo de ml_models.model_slug.';

COMMENT ON COLUMN v_ml_model_input_contract.status IS
    'Estado del modelo: active, superseded o invalid. Servir uno que no este '
    'active deberia ser una decision explicita, no un descuido.';

COMMENT ON COLUMN v_ml_model_input_contract.algorithm IS
    'Clase del estimador final del pipeline, p. ej. RandomForestClassifier.';

COMMENT ON COLUMN v_ml_model_input_contract.feature_position IS
    'Posicion 0-based de la columna. ORDER BY por esta columna es obligatorio: '
    'sin el, el orden de las filas no esta garantizado y el modelo puede predecir '
    'con las columnas cruzadas sin dar error.';

COMMENT ON COLUMN v_ml_model_input_contract.feature_name IS
    'Nombre de la columna tal y como debe aparecer en el DataFrame de entrada.';

COMMENT ON COLUMN v_ml_model_input_contract.feature_block IS
    'Bloque quimico al que pertenece: metal chemistry, linker chemistry, process '
    'o stoichiometry & medium. Sirve para agrupar la interpretacion.';

COMMENT ON COLUMN v_ml_model_input_contract.importance IS
    'Caida del F1 macro al barajar esa columna (permutation importance). Un valor '
    'NEGATIVO significa que barajarla mejora el modelo: es ruido, no señal.';
