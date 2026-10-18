# -*- coding: utf-8 -*-
"""
train_crystallinity_v5.py -- entrena, valida y registra los modelos de cristalinidad v5.

QUE CAMBIA RESPECTO AL v4 (revision profunda del 2026-10-17)
-----------------------------------------------------------
No cambia el algoritmo: cambian los DATOS, y una decision sobre las rampas.

  1. Rampas termicas re-parseadas (src/fix_thermal_ramps_2026_10.py). Una placa
     entera pasa de "25 °C, 1 h" a 120 °C / 12 h, y 652 sintesis dejan de llevar
     velocidades inventadas (0,0 o 12,5 °C/min): ahora son NULL.
  2. 49 masas de metal corregidas (grupo A de T7: errores inequivocos).
  3. 28 etiquetas adjudicadas tras el reetiquetado ciego (21 cambian).

DECISION: LAS VELOCIDADES DE RAMPA SALEN DEL MODELO
---------------------------------------------------
En el conjunto HTS, 494 de 1.516 sintesis (33 %) no tienen escrito el tiempo de
subida ni de bajada. Que falte NO es aleatorio: depende de como se escribia el
cuaderno en cada epoca ('150ºC(48h)' frente a 'r.t.(8h)-150ºC(48h)-30ºC(8h)').
Cualquier forma de rellenar el hueco le devuelve al modelo esa informacion:

  - un 0,0 o un 12,5 inventado (lo que hacia el v4) es una marca de epoca;
  - la mediana imputada tambien: el arbol aprende a cortar justo en ese valor;
  - un indicador de "faltaba" es la marca de epoca escrita a las claras.

Se midio (3 particiones por placa + agrupado por metal y por sistema metal+linker):

    receta                              F1 placa (media 3)  F1 metal  F1 sistema
    A  rampas con mediana               0,450               0,412     0,424
    B  + indicador de hueco             0,454               0,418     0,397
    C  + indicador + cooling_mode       0,457               0,399     0,401
    E  sin velocidades de rampa         0,460               0,421     0,418

Empatan dentro del ruido (±0,05 entre pliegues). Si quitarlas no cuesta nada, la
opcion honesta es quitarlas: un modelo que no puede leer la epoca no puede hacer
trampa con ella. La rampa sigue en la base (con cooling_mode) para cuando haya
suficientes rampas programadas como para medir su efecto de verdad.

POR QUE EL F1 BAJA DE 0,517 A ~0,46, Y POR QUE ES BUENA NOTICIA
---------------------------------------------------------------
Se deshizo cada correccion por separado (_lab/scratch/review/v5_ablation.py):
las rampas viejas valian ~+0,01 y las etiquetas viejas ~+0,015. Y lo decisivo:
la generalizacion a un metal que el modelo no ha visto (0,42) y a un sistema
metal+linker nuevo (0,42) es LA MISMA que en el v4 (0,43 / 0,40). Lo que se ha
perdido es la parte del acierto que no generalizaba.

    python src/train_crystallinity_v5.py              # entrena y valida, no escribe
    python src/train_crystallinity_v5.py --registrar  # registra y mueve las ranuras

Antes de --registrar: revisar recuentos y `python scripts/backup_database.py`.
Despues: scripts/register_class_metrics.py --registrar (dos ranuras),
scripts/build_model_scorecard.py, scripts/build_simulator_grid.py y npm run build.
"""
import os
import sys

import numpy as np
import pandas as pd
import psycopg2
from dotenv import load_dotenv
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.model_selection import GroupKFold, StratifiedGroupKFold, cross_validate
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from lightgbm import LGBMClassifier

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)
from src.ml_model_registry import registrar_dataset, registrar_modelo  # noqa: E402

SEED = 42
SEMILLAS = [42, 7, 2026]
CLASES = ['AMORFO', 'INCIPIENTE', 'CRISTALINO']
CAT_COLS = ['scaffold', 'protection_state']
RAMPAS = ['heating_rate_c_min', 'cooling_rate_c_min']
PREGUNTA = ('Dadas las condiciones de una sintesis, antes de meterla en la estufa, '
            'sera el producto amorfo, incipiente o cristalino?')
METRICAS = ['f1_macro', 'balanced_accuracy', 'matthews_corrcoef', 'accuracy']

# El mismo conjunto que el v4: mismos filtros, mismo objetivo. Lo que cambia son
# las filas que hay debajo (rampas, masas, etiquetas), no la definicion.
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

COLS_LINKER = ['scaffold', 'protection_state', 'denticity', 'n_acidic_protons',
               'max_donor_distance_a', 'n_rotatable_bonds']
COLS_METAL = ['electronegativity_pauling', 'absolute_hardness_ev', 'oxophilicity_kepp',
              'polarizability_a3', 'oxidation_state', 'shannon_radius_pm', 'charge_over_radius']
BLOQUE = {**{c: 'metal' for c in COLS_METAL}, **{c: 'linker' for c in COLS_LINKER},
          **{c: 'process' for c in ['temp_target_c', 'time_hours'] + RAMPAS}}

PREPRO = {'numericas': 'SimpleImputer(median)',
          'categoricas': 'SimpleImputer(most_frequent) + OneHotEncoder(handle_unknown=ignore)',
          'nota': 'Dentro del pipeline de validacion cruzada, nunca antes. Sin velocidades '
                  'de rampa: su ausencia codifica la epoca del cuaderno.'}
VALID = {'cv': 'StratifiedGroupKFold', 'n_splits': 5, 'group': 'hts_number',
         'shuffle': True, 'random_state': SEED,
         'extra': 'Tambien GroupKFold(5) por metal y por sistema metal+linker, y la media '
                  'de 3 particiones por placa (semillas 42, 7, 2026).',
         'por_que': 'Agrupado por placa: las placas son internamente homogeneas y una '
                    'particion aleatoria dejaria que el modelo reconociera la placa.'}


def conectar():
    load_dotenv(os.path.join(RAIZ, '.env'))
    if not os.getenv('POSTGRES_USER'):
        load_dotenv(r'C:\Users\rubbe\Documents\ALCheMy\.env')
    return psycopg2.connect(host='localhost', port=int(os.getenv('POSTGRES_PORT', 5432)),
                            dbname=os.getenv('POSTGRES_DB', 'alchemy_db'),
                            user=os.getenv('POSTGRES_USER'),
                            password=os.getenv('POSTGRES_PASSWORD'))


def contrato_v4(conn, slug):
    """Las variables de entrada del v4, en su orden. El v5 parte de ellas."""
    cur = conn.cursor()
    cur.execute("""SELECT f.feature_name FROM ml_model_features f
                     JOIN ml_models m USING (model_id)
                    WHERE m.model_slug = %s AND f.feature_position IS NOT NULL
                    ORDER BY f.feature_position""", (slug,))
    return [r[0] for r in cur.fetchall()]


def preparar(df, cols):
    X = df[cols].copy()
    for c in cols:
        if c in CAT_COLS:
            continue
        if X[c].dtype == bool or X[c].dtype == object:
            X[c] = pd.to_numeric(X[c].map(lambda v: float(v) if isinstance(v, bool) else v),
                                 errors='coerce')
        else:
            X[c] = pd.to_numeric(X[c], errors='coerce')
    return X


def pipeline(cols, estimador):
    cn = [c for c in cols if c not in CAT_COLS]
    cc = [c for c in cols if c in CAT_COLS]
    prep = ColumnTransformer([
        ('num', Pipeline([('imp', SimpleImputer(strategy='median'))]), cn),
        ('cat', Pipeline([('imp', SimpleImputer(strategy='most_frequent')),
                          ('oh', OneHotEncoder(handle_unknown='ignore'))]), cc)])
    return Pipeline([('prep', prep), ('clf', estimador)])


def rf():
    return RandomForestClassifier(n_estimators=400, min_samples_leaf=2,
                                  class_weight='balanced_subsample', random_state=SEED, n_jobs=-1)


def lgbm():
    return LGBMClassifier(n_estimators=400, learning_rate=0.05, class_weight='balanced',
                          random_state=SEED, verbose=-1)


def evaluar(df, y, cols, fabrica):
    """Devuelve las metricas de la particion oficial (semilla 42) y las extra."""
    X = preparar(df, cols)
    placa = df['hts_number']
    oficial, f1_semillas = None, []
    for s in SEMILLAS:
        r = cross_validate(pipeline(cols, fabrica()), X, y, groups=placa, scoring=METRICAS,
                           cv=StratifiedGroupKFold(5, shuffle=True, random_state=s))
        f1_semillas.append(r['test_f1_macro'].mean())
        if s == SEED:
            oficial = r
    extra = {}
    for nombre, grupos in [('cv_group_metal', df['metal_center']),
                           ('cv_group_system', df['metal_center'] + '|' + df['linker'])]:
        r = cross_validate(pipeline(cols, fabrica()), X, y, groups=grupos, cv=GroupKFold(5),
                           scoring=['f1_macro', 'matthews_corrcoef'])
        extra[nombre] = r
    metricas = [{'metric_name': m, 'split': 'cv', 'metric_value': float(oficial['test_' + m].mean()),
                 'metric_std': float(oficial['test_' + m].std()), 'n_folds': 5} for m in METRICAS]
    metricas.append({'metric_name': 'f1_macro', 'split': 'cv_3seeds',
                     'metric_value': float(np.mean(f1_semillas)),
                     'metric_std': float(np.std(f1_semillas)), 'n_folds': 15})
    for nombre, r in extra.items():
        for m in ['f1_macro', 'matthews_corrcoef']:
            metricas.append({'metric_name': m, 'split': nombre,
                             'metric_value': float(r['test_' + m].mean()),
                             'metric_std': float(r['test_' + m].std()), 'n_folds': 5})
    return metricas, X


def resumen(nombre, metricas):
    d = {(m['metric_name'], m['split']): m['metric_value'] for m in metricas}
    print('  %-30s F1 placa %.3f (3 semillas %.3f)  MCC %.3f  |  F1 metal nuevo %.3f  '
          'sistema nuevo %.3f' % (nombre, d[('f1_macro', 'cv')], d[('f1_macro', 'cv_3seeds')],
                                  d[('matthews_corrcoef', 'cv')], d[('f1_macro', 'cv_group_metal')],
                                  d[('f1_macro', 'cv_group_system')]))
    return d[('f1_macro', 'cv_3seeds')]


def caracteristicas(cols, todas, accionable):
    cars = [{'feature_name': c, 'feature_role': 'input',
             'feature_block': BLOQUE.get(c, 'medium')} for c in cols]
    cars.append({'feature_name': 'hts_number', 'feature_role': 'group',
                 'exclusion_reason': 'Clave de agrupamiento en la validacion, nunca entrada.'})
    cars.append({'feature_name': 'ml_class', 'feature_role': 'target'})
    for c in RAMPAS:
        cars.append({'feature_name': c, 'feature_role': 'excluded', 'feature_block': 'process',
                     'exclusion_reason': 'Falta en el 33 % de las sintesis HTS y su ausencia '
                                         'codifica la epoca del cuaderno; quitarla no cuesta F1 '
                                         '(medido). Ver src/train_crystallinity_v5.py.'})
    for c, motivo in [
            ('electronegativity_allen', 'La escala de Allen no esta definida para lantanidos.'),
            ('reactor_volume_ml', 'Constante en HTS (2,5 mL): varianza cero.'),
            ('fill_fraction', 'Igual a total_volume_ml/2,5: colinealidad perfecta.'),
            ('synthesis_type', 'Constante en este conjunto; el confusor se resolvio filtrando.'),
            ('cooling_mode', 'Probado (receta C): no mejora y empeora la generalizacion a metal nuevo.')]:
        cars.append({'feature_name': c, 'feature_role': 'excluded', 'exclusion_reason': motivo})
    if accionable:
        for c in [c for c in todas if c not in cols and c not in RAMPAS]:
            cars.append({'feature_name': c, 'feature_role': 'excluded',
                         'feature_block': BLOQUE.get(c, 'medium'),
                         'exclusion_reason': 'Fuera del modelo accionable: variable de identidad '
                                             'quimica, no condicion sobre la que actuar.'})
    return cars


def main():
    registrar = '--registrar' in sys.argv
    conn = conectar()
    conn.autocommit = False

    df = pd.read_sql(CONSULTA, conn)
    y = df['ml_class']
    print('conjunto: %d filas, %d placas, clases %s'
          % (len(df), df['hts_number'].nunique(), y.value_counts().to_dict()))

    cols_full = [c for c in contrato_v4(conn, 'crystallinity_v4_hts_full') if c not in RAMPAS]
    cols_acc = [c for c in contrato_v4(conn, 'crystallinity_v4_hts_actionable') if c not in RAMPAS]
    print('variables: completo %d, accionable %d (sin velocidades de rampa)\n'
          % (len(cols_full), len(cols_acc)))

    candidatos = {}
    for papel, cols in [('full', cols_full), ('actionable', cols_acc)]:
        for nombre, fab, algo, lib in [('RandomForest', rf, 'RandomForestClassifier', 'scikit-learn'),
                                       ('LightGBM', lgbm, 'LGBMClassifier', 'lightgbm')]:
            met, X = evaluar(df, y, cols, fab)
            f1 = resumen('%s / %s' % (papel, nombre), met)
            candidatos.setdefault(papel, []).append((f1, nombre, fab, algo, lib, met, X, cols))
    # Se elige por la media de las 3 particiones, no por la oficial: una sola
    # particion por placa varia +-0,03 y elegir con ella es elegir la suerte.
    elegidos = {p: max(c, key=lambda t: t[0]) for p, c in candidatos.items()}
    print('\nelegidos: completo = %s, accionable = %s'
          % (elegidos['full'][1], elegidos['actionable'][1]))

    if not registrar:
        print('\nENSAYO: no se ha escrito nada. Usa --registrar para guardar.')
        return

    ds = registrar_dataset(
        conn, slug='crystallinity_v5_hts_2026_10_18', consulta=CONSULTA,
        n_rows=len(df), n_features=len(cols_full), n_groups=int(df['hts_number'].nunique()),
        target_column='ml_class', class_distribution=y.value_counts().to_dict(),
        feature_source='v_ml_features v3 + correcciones de la revision 2026-10-17',
        filters_human=('Solo sintesis en combinatoria (HTS); sin acido tanico; sin medidas '
                       'marcadas ml_include=NO; MEZCLA contada como CRISTALINO.'),
        known_caveats=('Primera version tras la revision profunda: rampas re-parseadas desde '
                       'el Excel (velocidades NULL cuando no se escribio el tiempo), 49 masas '
                       'de metal corregidas y 28 etiquetas adjudicadas tras reetiquetado ciego '
                       '(acuerdo intra-observador kappa 0,72). El pH sigue sin registrarse.'))

    ids = {}
    for papel, slug, nombre, notas in [
            ('full', 'crystallinity_v5_hts_full', 'Cristalinidad v5 -- modelo completo (HTS, datos revisados)',
             'Sustituye a crystallinity_v4_hts_full. F1 por placa mas bajo que el v4 y es lo '
             'esperado: se quito la informacion de epoca que llevaban las rampas inventadas y se '
             'corrigieron etiquetas frontera. La generalizacion a metal y sistema nuevos no cambia.'),
            ('actionable', 'crystallinity_v5_hts_actionable',
             'Cristalinidad v5 -- modelo accionable (solo proceso y medio)',
             'Responde "fijada la quimica, que condiciones ayudan?". Sin velocidades de rampa, '
             'como el completo. Su rendimiento, muy por debajo del completo, ES el resultado.')]:
        f1, nombre_algo, fab, algo, lib, met, X, cols = elegidos[papel]
        pipe = pipeline(cols, fab()).fit(X, y)
        est = pipe.named_steps['clf']
        hiper = {k: v for k, v in est.get_params().items()
                 if k in ('n_estimators', 'min_samples_leaf', 'class_weight', 'learning_rate',
                          'random_state')}
        ids[papel] = registrar_modelo(
            conn, slug=slug, display_name=nombre, dataset_id=ds, pipeline=pipe,
            task_type='multiclass_classification', target_column='ml_class',
            target_classes=CLASES, question=PREGUNTA, algorithm=algo, library=lib,
            hyperparameters=hiper, preprocessing=PREPRO, validation_scheme=VALID,
            random_seed=SEED, source_notebook='src/train_crystallinity_v5.py',
            metrics=met, features=caracteristicas(cols, cols_full, papel == 'actionable'),
            status='active', is_reproducible=True, notes=notas)

    cur = conn.cursor()
    # Mover el puntero: primero se vacia la ranura del v4 (el indice unico no
    # deja dos modelos en la misma), luego se marca el v4 como sustituido, y por
    # ultimo el v5 ocupa la ranura.
    for papel in ['full', 'actionable']:
        slot = 'primary' if papel == 'full' else 'actionable'
        cur.execute("UPDATE ml_models SET deployment_slot = NULL WHERE deployment_slot = %s", (slot,))
        cur.execute("""UPDATE ml_models SET status = 'superseded', superseded_by = %s
                        WHERE model_slug = %s""",
                    (ids[papel], 'crystallinity_v4_hts_%s' % papel))
        cur.execute("UPDATE ml_models SET deployment_slot = %s WHERE model_id = %s",
                    (slot, ids[papel]))
    cur.execute("""INSERT INTO audit_log (agent, action, recipients, verdict, cause, result)
                   VALUES ('train_crystallinity_v5', 'REGISTER_AND_DEPLOY_MODEL', 2, 'ALLOW', %s,
                           'EXECUTED')""",
                ('v5 full (%s) -> slot primary, v5 actionable (%s) -> slot actionable; v4 superseded. '
                 'Trained on %d HTS rows after the 2026-10-17 review.'
                 % (elegidos['full'][1], elegidos['actionable'][1], len(df)),))
    conn.commit()
    print('\nREGISTRADO y desplegado.')
    print(pd.read_sql("""SELECT m.model_slug, m.status, deployment_slot, m.algorithm,
                                round(f1_macro_cv::numeric,3) f1, round(mcc_cv::numeric,3) mcc
                           FROM v_ml_model_registry m JOIN ml_models USING (model_slug)
                          ORDER BY m.model_slug DESC""", conn).to_string(index=False))


if __name__ == '__main__':
    main()
