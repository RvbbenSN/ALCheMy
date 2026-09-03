# -*- coding: utf-8 -*-
"""Recalcula las metricas POR CLASE de un modelo del registro y las guarda.

Que problema resuelve
---------------------
`ml_model_metrics` guardaba solo las cifras agregadas (F1 macro, MCC, exactitud
equilibrada). La web, en cambio, ensena tambien el acierto por clase --cuantas
de las muestras cristalinas reales detecta el modelo-- y esas cifras estaban
escritas a mano en un componente de React, congeladas en los valores del v3.

Escribir una metrica a mano en el frontal tiene un fallo silencioso conocido: se
entrena un modelo nuevo, se despliega, y la pagina sigue ensenando el numero
viejo sin que nada avise. Este script cierra ese hueco: las cifras por clase se
calculan una vez, se guardan en la base, y el generador de la web las lee.

Por que se puede recalcular sin el cuaderno
-------------------------------------------
Porque el registro guarda la RECETA completa: `ml_datasets.source_query` (el SQL
literal), `ml_models.validation_scheme` (el esquema de validacion) y
`random_seed`. Se reconstruye el mismo conjunto, se reparte con la misma
particion agrupada por placa y se vuelve a validar el pipeline guardado. Si el
F1 macro que sale aqui no coincide con el registrado, algo ha cambiado --y eso
es justo lo que el script informa antes de escribir nada.

Se re-ajusta el pipeline en cada pliegue (`clone`, no el objeto entrenado): usar
el modelo ya ajustado sobre datos que vio al entrenar daria cifras optimistas.

Uso
---
    python scripts/register_class_metrics.py                  # comprueba y no escribe
    python scripts/register_class_metrics.py --registrar      # escribe en la base
    python scripts/register_class_metrics.py --slot actionable --registrar

Codigo de salida 1 si el F1 macro recalculado se aparta del registrado mas de
--tolerancia (por defecto 0,02), o si algo impide reproducir el conjunto.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def conectar():
    import psycopg2
    from dotenv import load_dotenv
    # Sube por los directorios padre buscando el .env: dentro de un worktree de
    # git (.claude/worktrees/...) el fichero no esta, porque esta ignorado, y
    # sin esto el script solo funciona desde la copia principal.
    for base in [ROOT, *ROOT.parents]:
        if (base / '.env').exists():
            load_dotenv(base / '.env')
            break
    return psycopg2.connect(
        host=os.getenv('POSTGRES_HOST', 'localhost'),
        port=int(os.getenv('POSTGRES_PORT', 5432)),
        dbname=os.getenv('POSTGRES_DB', 'alchemy_db'),
        user=os.getenv('POSTGRES_USER'),
        password=os.getenv('POSTGRES_PASSWORD'))


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--slot', default='primary', choices=['primary', 'actionable'])
    p.add_argument('--slug', help='salta la ranura y usa este modelo')
    p.add_argument('--registrar', action='store_true',
                   help='escribe las metricas en ml_model_metrics (sin esto solo comprueba)')
    p.add_argument('--tolerancia', type=float, default=0.02)
    a = p.parse_args()

    import warnings
    warnings.filterwarnings('ignore')
    import numpy as np
    import pandas as pd
    from sklearn.base import clone
    from sklearn.model_selection import StratifiedGroupKFold
    from sklearn.metrics import (precision_recall_fscore_support, f1_score,
                                 matthews_corrcoef, balanced_accuracy_score,
                                 accuracy_score)
    from src.ml_model_registry import cargar_modelo, columnas_de_entrada, modelo_desplegado

    conn = conectar()
    slug = a.slug or modelo_desplegado(conn, a.slot)
    print('modelo: %s' % slug)

    cur = conn.cursor()
    cur.execute("""SELECT m.model_id, m.target_column, m.random_seed, m.validation_scheme,
                          d.source_query, d.n_rows
                     FROM ml_models m JOIN ml_datasets d ON d.dataset_id = m.dataset_id
                    WHERE m.model_slug = %s""", (slug,))
    fila = cur.fetchone()
    if fila is None:
        print('[ERROR] %r no esta en el registro, o no tiene dataset asociado.' % slug)
        return 1
    model_id, target, semilla, esquema, consulta, n_rows_reg = fila
    esquema = esquema or {}
    grupo = esquema.get('group', 'hts_number')
    n_splits = int(esquema.get('n_splits', 5))
    seed = int(esquema.get('random_state', semilla or 42))

    # 1. Reconstruir el conjunto exacto sobre el que se entreno.
    df = pd.read_sql(consulta, conn)
    print('conjunto: %d filas (registradas %d), %d grupos por %r'
          % (len(df), n_rows_reg, df[grupo].nunique(), grupo))
    if len(df) != n_rows_reg:
        print('[ERROR] El conjunto ha cambiado de tamano desde que se entreno. '
              'Las cifras que saldrian de aqui NO serian las de este modelo.')
        return 1

    cols = columnas_de_entrada(conn, slug)
    X, y, g = df.reindex(columns=cols), df[target], df[grupo]

    # 2. Repetir la validacion cruzada agrupada, re-ajustando en cada pliegue.
    pipe = cargar_modelo(conn, slug)
    cv = StratifiedGroupKFold(n_splits=n_splits, shuffle=bool(esquema.get('shuffle', True)),
                              random_state=seed)
    y_true, y_pred, f1_por_pliegue = [], [], []
    for k, (tr, te) in enumerate(cv.split(X, y, groups=g), 1):
        m = clone(pipe).fit(X.iloc[tr], y.iloc[tr])
        pr = m.predict(X.iloc[te])
        f1_por_pliegue.append(f1_score(y.iloc[te], pr, average='macro'))
        y_true.append(y.iloc[te].to_numpy())
        y_pred.append(pr)
        print('  pliegue %d/%d: F1 macro %.3f' % (k, n_splits, f1_por_pliegue[-1]))
    y_true = np.concatenate(y_true)
    y_pred = np.concatenate(y_pred)

    f1m, sd = float(np.mean(f1_por_pliegue)), float(np.std(f1_por_pliegue))
    agregadas = {
        'f1_macro': (f1m, sd),
        'matthews_corrcoef': (float(matthews_corrcoef(y_true, y_pred)), None),
        'balanced_accuracy': (float(balanced_accuracy_score(y_true, y_pred)), None),
        'accuracy': (float(accuracy_score(y_true, y_pred)), None),
    }

    # 3. Contraste con lo registrado: si no cuadra, no se escribe nada.
    cur.execute("""SELECT metric_name, metric_value FROM ml_model_metrics
                    WHERE model_id = %s AND split = 'cv' AND class_name = ''""", (model_id,))
    registradas = dict(cur.fetchall())
    print('\n  metrica              recalculada   registrada')
    for k, (v, _) in agregadas.items():
        r = registradas.get(k)
        print('  %-20s %11.3f   %s' % (k, v, '%.3f' % r if r is not None else '   --'))
    ref = registradas.get('f1_macro')
    if ref is not None and abs(ref - f1m) > a.tolerancia:
        print('\n[ERROR] El F1 macro recalculado (%.3f) se aparta del registrado (%.3f) '
              'mas de %.3f. El modelo, los datos o las versiones han cambiado.'
              % (f1m, ref, a.tolerancia))
        return 1

    # 4. Las cifras por clase, que son las que faltaban.
    clases = sorted(pd.unique(y))
    pre, rec, f1c, sup = precision_recall_fscore_support(y_true, y_pred, labels=clases,
                                                         zero_division=0)
    print('\n  clase        soporte  precision  recall     F1')
    filas = []
    for i, c in enumerate(clases):
        print('  %-12s %7d %9.3f %8.3f %6.3f' % (c, sup[i], pre[i], rec[i], f1c[i]))
        filas += [('precision', c, float(pre[i])), ('recall', c, float(rec[i])),
                  ('f1', c, float(f1c[i])), ('support', c, float(sup[i]))]

    if not a.registrar:
        print('\n(ensayo: no se ha escrito nada. Anada --registrar para guardar)')
        return 0

    for nombre, clase, valor in filas:
        cur.execute("""INSERT INTO ml_model_metrics
                           (model_id, metric_name, split, metric_value, n_folds, class_name)
                       VALUES (%s, %s, 'cv', %s, %s, %s)
                       ON CONFLICT (model_id, metric_name, split, class_name)
                       DO UPDATE SET metric_value = EXCLUDED.metric_value,
                                     n_folds = EXCLUDED.n_folds""",
                    (model_id, nombre, valor, n_splits, clase))
    # La desviacion entre pliegues del F1 macro tambien se completa si faltaba.
    cur.execute("""UPDATE ml_model_metrics SET metric_std = %s, n_folds = %s
                    WHERE model_id = %s AND metric_name = 'f1_macro'
                      AND split = 'cv' AND class_name = ''
                      AND metric_std IS NULL""", (sd, n_splits, model_id))
    conn.commit()
    print('\n[OK] %d metricas por clase guardadas para %s' % (len(filas), slug))
    conn.close()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
