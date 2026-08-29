# -*- coding: utf-8 -*-
"""
register_crystallinity_models.py -- puebla el registro de modelos.

Entrena y registra los dos modelos vigentes del cuaderno 06 v3 (completo y
accionable) y deja constancia del modelo v2, que NO se puede reconstruir.

Idempotente: re-ejecutarlo actualiza las filas en vez de duplicarlas.

    python src/register_crystallinity_models.py
"""
import os
import sys
import numpy as np
import pandas as pd
import psycopg2
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.ml_model_registry import registrar_dataset, registrar_modelo  # noqa: E402

load_dotenv(r'C:\Users\rubbe\Documents\ALCheMy\.env')
conn = psycopg2.connect(host='localhost', port=5432, dbname='alchemy_db',
                        user=os.getenv('POSTGRES_USER'),
                        password=os.getenv('POSTGRES_PASSWORD'))
conn.autocommit = False

NOTEBOOK = 'notebooks/06_Crystallinity_Prediction_ML_and_Synthesis_Optimization.ipynb'
PREGUNTA = ('Dadas las condiciones de una sintesis, antes de meterla en la estufa, '
            'sera el producto amorfo, incipiente o cristalino?')
CLASES = ['AMORFO', 'INCIPIENTE', 'CRISTALINO']
SEED = 42

CONSULTA = """
SELECT v.*,
       CASE WHEN lc.label_value = 'MEZCLA' THEN 'CRISTALINO'
            ELSE lc.label_value END AS ml_class
  FROM v_ml_features v
  JOIN characterization_measurements cm ON cm.sample_code = v.sample_code
  JOIN pxrd_labels lc ON lc.measurement_id = cm.measurement_id
                     AND lc.label_type = 'crystallinity_class'
  LEFT JOIN pxrd_labels ex ON ex.measurement_id = cm.measurement_id
                          AND ex.label_type = 'ml_include'
                          AND ex.label_value = 'NO'
 WHERE lc.label_value <> 'SIN_MUESTRA'
   AND ex.measurement_id IS NULL
   AND v.synthesis_type = 'HTS'
   AND v.linker <> 'Tannic acid'
"""

# =============================================================================
# 1. El modelo v2: se registra aunque NO se pueda reconstruir.
#
# Es la razon de ser de este registro. Sin esta fila, dentro de seis meses
# alguien encontraria "F1 0,62" en un documento antiguo y lo tomaria por el
# mejor resultado del proyecto.
# =============================================================================
print('--- registrando el modelo v2 (historico, invalido) ---')
ds_v2 = registrar_dataset(
    conn, slug='crystallinity_v2_mixed_2026_08_28',
    consulta='-- Consulta del cuaderno 06 v2: identica a la v3 SALVO que no filtraba\n'
             "-- por synthesis_type ni excluia el acido tanico.\n"
             + CONSULTA.replace("   AND v.synthesis_type = 'HTS'\n", '')
                       .replace("   AND v.linker <> 'Tannic acid'\n", ''),
    n_rows=1724, n_features=38, n_groups=None,
    target_column='ml_class',
    class_distribution={'INCIPIENTE': 990, 'AMORFO': 404, 'CRISTALINO': 330},
    feature_source='v_ml_features v1',
    filters_human='Sin filtro de tipo de sintesis: mezclaba HTS, ST y MW.',
    known_caveats=(
        'CONJUNTO INVALIDADO. Tres problemas: (1) los moduladores liquidos puros estaban '
        'en umol etiquetados como mmol y se sumaban con HCl/HF en mmol, borrando el efecto '
        'del HCl; (2) mezclaba los tres metodos de sintesis, y MW da 95,7% de cristalino '
        'frente al 11,0% de HTS por sesgo de seleccion; (3) faltaban dos disolventes y el '
        'modulador liquido no contaba como medio. Los datos que definian estas columnas se '
        'corrigieron el 2026-08-29 y ya no existen.'))

registrar_modelo(
    conn, slug='crystallinity_v2_mixed', dataset_id=ds_v2,
    display_name='Cristalinidad v2 -- KNN sobre los tres metodos de sintesis (INVALIDO)',
    task_type='multiclass_classification', target_column='ml_class',
    target_classes=CLASES, question=PREGUNTA,
    algorithm='KNeighborsClassifier', library='scikit-learn',
    hyperparameters={'n_neighbors': 15},
    preprocessing={'numericas': 'SimpleImputer(median) + StandardScaler',
                   'categoricas': 'SimpleImputer(most_frequent) + OneHotEncoder'},
    validation_scheme={'cv': 'StratifiedGroupKFold', 'n_splits': 5,
                       'group': 'hts_number', 'shuffle': True, 'random_state': SEED},
    random_seed=SEED,
    source_notebook='notebooks/archive/06_v2_2026-08-28_todos_los_tipos_de_sintesis.ipynb',
    metrics=[{'metric_name': 'f1_macro', 'split': 'cv', 'metric_value': 0.625, 'n_folds': 5},
             {'metric_name': 'f1_macro', 'split': 'cv', 'metric_value': 0.242,
              'class_name': '__baseline__', 'n_folds': 5}],
    status='invalid', is_reproducible=False,
    not_reproducible_reason=(
        'Los datos de entrenamiento ya no existen: el 2026-08-29 se corrigio un error de '
        'unidades de factor 1000 en siete columnas de modulador '
        '(src/fix_modulator_units_2026_08.py) y se reconstruyo v_ml_features. No hay '
        'binario guardado, y aunque lo hubiera cargaria sin errores prediciendo sobre una '
        'definicion de las variables que ya no es la vigente.'),
    notes=(
        'Se conserva por su valor historico y como caso de estudio: reportaba F1 macro '
        '0,625, un 20% mas que el modelo vigente, y ese exceso venia de detectar el metodo '
        'de sintesis (sesgo de seleccion) y de una variable de acidez rota. Sustituido por '
        'crystallinity_v3_hts_full. El procedimiento queda en el cuaderno archivado.'))
conn.commit()
print('   v2 registrado como invalido, sin binario\n')

# =============================================================================
# 2. Los modelos v3: se entrenan de verdad y se guardan.
# =============================================================================
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.model_selection import StratifiedGroupKFold, cross_validate
from sklearn.ensemble import RandomForestClassifier
from lightgbm import LGBMClassifier

df = pd.read_sql(CONSULTA, conn)
ID_COLS = ['sample_code', 'hts_number', 'synthesis_date', 'metal_center',
           'linker', 'metal_source', 'synthesis_type']
DROP_COLS = ['electronegativity_allen']
CAT_COLS = ['scaffold', 'protection_state']

dfn = df.copy()
dfn['solvent_breakdown_complete'] = dfn['solvent_breakdown_complete'].astype(float)
num_cols = [c for c in dfn.columns if c not in ID_COLS + DROP_COLS + CAT_COLS + ['ml_class']]
dfn[num_cols] = dfn[num_cols].apply(pd.to_numeric, errors='coerce')

y = df['ml_class']
X = dfn[num_cols + CAT_COLS]
groups = df['hts_number'].where(df['hts_number'] != 'N/A', df['sample_code'])
print('--- conjunto v3: %d filas, %d variables, %d placas ---'
      % (X.shape[0], X.shape[1], groups.nunique()))

ds_v3 = registrar_dataset(
    conn, slug='crystallinity_v3_hts_2026_08_29', consulta=CONSULTA,
    n_rows=len(df), n_features=X.shape[1], n_groups=int(groups.nunique()),
    target_column='ml_class',
    class_distribution=df['ml_class'].value_counts().to_dict(),
    feature_source='v_ml_features v2 (scripts/ddl_ml_features_v2.sql)',
    filters_human=('Solo sintesis en combinatoria (HTS); sin acido tanico; sin medidas '
                   'marcadas ml_include=NO; MEZCLA contada como CRISTALINO.'),
    known_caveats=(
        'Solo HTS a proposito: ST y MW arrastran sesgo de seleccion (se usan cuando la '
        'receta YA funciona) y el microondas es otro regimen termico. El pH no se registro '
        'nunca y es probablemente la variable ausente mas importante. El 18% de las filas '
        'no tiene desglose de disolvente y sus fracciones son NULL, no 0.'))

PREPRO = {'numericas': 'SimpleImputer(median)',
          'categoricas': 'SimpleImputer(most_frequent) + OneHotEncoder(handle_unknown=ignore)',
          'nota': 'Todo dentro del pipeline de validacion cruzada, nunca antes: imputar '
                  'con la mediana global filtraria informacion del conjunto de prueba.'}
VALID = {'cv': 'StratifiedGroupKFold', 'n_splits': 5, 'group': 'hts_number',
         'shuffle': True, 'random_state': SEED,
         'por_que': 'Agrupado por placa: el 100% de las muestras vive en 68 placas '
                    'internamente homogeneas, y una particion aleatoria dejaria que el '
                    'modelo reconociera la placa en vez de aprender quimica.'}
METRICAS = ['f1_macro', 'balanced_accuracy', 'matthews_corrcoef', 'accuracy']
cv = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=SEED)


def preprocesador(cols_num, cols_cat):
    return ColumnTransformer([
        ('num', Pipeline([('imp', SimpleImputer(strategy='median'))]), cols_num),
        ('cat', Pipeline([('imp', SimpleImputer(strategy='most_frequent')),
                          ('oh', OneHotEncoder(handle_unknown='ignore'))]), cols_cat)])


BLOQUE = {}
COLS_LINKER = ['scaffold', 'protection_state', 'denticity', 'n_acidic_protons',
               'max_donor_distance_a', 'n_rotatable_bonds']
COLS_METAL = ['electronegativity_pauling', 'absolute_hardness_ev', 'oxophilicity_kepp',
              'polarizability_a3', 'oxidation_state', 'shannon_radius_pm',
              'charge_over_radius']
for c in COLS_METAL:
    BLOQUE[c] = 'metal'
for c in COLS_LINKER:
    BLOQUE[c] = 'linker'
for c in ['temp_target_c', 'time_hours', 'heating_rate_c_min', 'cooling_rate_c_min']:
    BLOQUE[c] = 'process'


def entrenar_y_registrar(Xd, slug, nombre, estimador, algoritmo, libreria, hiper, notas):
    cn = [c for c in Xd.columns if c not in CAT_COLS]
    cc = [c for c in Xd.columns if c in CAT_COLS]
    pipe = Pipeline([('prep', preprocesador(cn, cc)), ('clf', estimador)])

    r = cross_validate(pipe, Xd, y, groups=groups, cv=cv, scoring=METRICAS, n_jobs=1)
    metricas = [{'metric_name': m, 'split': 'cv',
                 'metric_value': float(r['test_' + m].mean()),
                 'metric_std': float(r['test_' + m].std()), 'n_folds': 5}
                for m in METRICAS]
    print('  %-34s F1=%.3f  MCC=%.3f'
          % (slug, r['test_f1_macro'].mean(), r['test_matthews_corrcoef'].mean()))

    # Se guarda el modelo REENTRENADO SOBRE TODO el conjunto: la validacion
    # cruzada sirve para ESTIMAR el rendimiento, no para producir el modelo
    # final. Las metricas guardadas son las de la CV; el binario es el de
    # entrenar con todo, que es lo que se usaria en produccion.
    pipe.fit(Xd, y)

    caracteristicas = [{'feature_name': c, 'feature_role': 'input',
                        'feature_block': BLOQUE.get(c, 'medium')} for c in Xd.columns]
    caracteristicas.append({'feature_name': 'hts_number', 'feature_role': 'group',
                            'exclusion_reason': 'Clave de agrupamiento en la validacion, '
                                                'nunca entrada del modelo.'})
    caracteristicas.append({'feature_name': 'ml_class', 'feature_role': 'target'})
    caracteristicas.append({'feature_name': 'electronegativity_allen',
                            'feature_role': 'excluded', 'feature_block': 'metal',
                            'exclusion_reason': 'La escala de Allen no esta definida para '
                                                'lantanidos (Ce, La, Dy, Nd): no es un '
                                                'hueco, es que no existe. Pauling la cubre.'})
    caracteristicas.append({'feature_name': 'synthesis_type', 'feature_role': 'excluded',
                            'exclusion_reason': 'Constante en este conjunto (solo HTS). '
                                                'Es el mayor factor de confusion y por eso '
                                                'se resolvio filtrando, no modelando.'})
    for c in Xd.columns:
        pass
    for c in [c for c in X.columns if c not in Xd.columns]:
        caracteristicas.append({'feature_name': c, 'feature_role': 'excluded',
                                'feature_block': BLOQUE.get(c, 'medium'),
                                'exclusion_reason': 'Fuera del modelo accionable: es una '
                                                    'variable de identidad quimica, no una '
                                                    'condicion sobre la que se pueda actuar '
                                                    'sin cambiar de material.'})

    registrar_modelo(
        conn, slug=slug, display_name=nombre, dataset_id=ds_v3, pipeline=pipe,
        task_type='multiclass_classification', target_column='ml_class',
        target_classes=CLASES, question=PREGUNTA,
        algorithm=algoritmo, library=libreria, hyperparameters=hiper,
        preprocessing=PREPRO, validation_scheme=VALID, random_seed=SEED,
        source_notebook=NOTEBOOK, metrics=metricas, features=caracteristicas,
        status='active', is_reproducible=True, notes=notas)


print('\n--- entrenando y registrando los modelos v3 ---')
entrenar_y_registrar(
    X, 'crystallinity_v3_hts_full', 'Cristalinidad v3 -- modelo completo (HTS)',
    RandomForestClassifier(n_estimators=400, min_samples_leaf=2,
                           class_weight='balanced_subsample', random_state=SEED, n_jobs=-1),
    'RandomForestClassifier', 'scikit-learn',
    {'n_estimators': 400, 'min_samples_leaf': 2,
     'class_weight': 'balanced_subsample', 'random_state': SEED},
    ('Modelo de referencia: responde "hay senal predictiva en estos datos?". Usa toda la '
     'quimica disponible. Sustituye a crystallinity_v2_mixed, cuyo F1 aparentemente mejor '
     'venia de un sesgo. SIN ajuste de hiperparametros ni calibracion: los valores son '
     'razonables por defecto, no optimos.'))

X_acc = X.drop(columns=[c for c in COLS_LINKER + COLS_METAL if c in X.columns])
entrenar_y_registrar(
    X_acc, 'crystallinity_v3_hts_actionable',
    'Cristalinidad v3 -- modelo accionable (solo proceso y medio)',
    LGBMClassifier(n_estimators=400, learning_rate=0.05, class_weight='balanced',
                   random_state=SEED, verbose=-1),
    'LGBMClassifier', 'lightgbm',
    {'n_estimators': 400, 'learning_rate': 0.05, 'class_weight': 'balanced',
     'random_state': SEED},
    ('Responde la pregunta que de verdad sirve para disenar la proxima placa: "fijada la '
     'quimica, que condiciones ayudan?". Excluye a proposito la quimica de metal y linker, '
     'que son variables de identidad y no condiciones accionables. Su rendimiento, muy por '
     'debajo del completo, es EL RESULTADO: mide cuanto del acierto venia de saber que '
     'sistema se uso y no que condiciones se aplicaron.'))

# Enlazar la sustitucion en los dos sentidos
cur = conn.cursor()
cur.execute("""UPDATE ml_models SET superseded_by =
                 (SELECT model_id FROM ml_models WHERE model_slug = 'crystallinity_v3_hts_full')
               WHERE model_slug = 'crystallinity_v2_mixed'""")
conn.commit()

print('\n--- registro ---')
print(pd.read_sql("""SELECT model_slug, status, is_reproducible, algorithm, n_rows,
                            round(f1_macro_cv::numeric,3) f1, round(mcc_cv::numeric,3) mcc,
                            has_artifact, artifact_size
                       FROM v_ml_model_registry""", conn).to_string(index=False))
