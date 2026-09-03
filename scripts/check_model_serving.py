# -*- coding: utf-8 -*-
"""Ensayo de despliegue: ¿se puede servir este modelo desde la base de datos?

Hace exactamente lo que tendrá que hacer el backend, y nada más:

  1. carga el binario desde `ml_model_artifacts` (verificando su SHA-256),
  2. lee el contrato de entrada de `v_ml_model_input_contract` --las columnas en
     el orden en que se entrenó--, sin escribir ninguna lista a mano,
  3. construye X con `reindex`, que falla ruidosamente si falta una columna,
  4. predice, y comprueba que las clases devueltas son las registradas,
  5. demuestra por qué el orden importa: repite la predicción pasando los mismos
     valores en otro orden como array de numpy, y enseña cuántas cambian.

El paso 5 no es adorno. Un pipeline al que le llega un DataFrame con los nombres
bien lo reordena solo; al que le llega un array de numpy, no. Predice con el
radio iónico entrando por la casilla de la temperatura y devuelve algo
perfectamente plausible y perfectamente falso, sin lanzar ningún error. Esa es la
razón de que el contrato viva en la base y no en el código del servicio.

Uso:
    python scripts/check_model_serving.py                       # el modelo activo
    python scripts/check_model_serving.py --slug OTRO_SLUG
    python scripts/check_model_serving.py --filas 200

Código de salida 1 si algo no cuadra.
"""
import argparse
import os
import sys
import warnings

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def conectar():
    import psycopg2
    from dotenv import load_dotenv
    raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for p in [os.path.join(raiz, '.env'), '.env', '../.env',
              os.path.join(os.path.expanduser('~'), 'Documents', 'ALCheMy', '.env')]:
        if os.path.exists(p):
            load_dotenv(p)
            break
    return psycopg2.connect(host=os.getenv('POSTGRES_HOST', 'localhost'),
                            port=os.getenv('POSTGRES_PORT', '5432'),
                            dbname=os.getenv('POSTGRES_DB'),
                            user=os.getenv('POSTGRES_USER'),
                            password=os.getenv('POSTGRES_PASSWORD'))


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--slug', default='crystallinity_v4_hts_full')
    p.add_argument('--filas', type=int, default=100,
                   help='cuantas sintesis usar para el ensayo (por defecto 100)')
    a = p.parse_args()
    warnings.filterwarnings('ignore')

    import numpy as np
    import pandas as pd
    from src.ml_model_registry import cargar_modelo, columnas_de_entrada

    cn = conectar()
    cur = cn.cursor()
    ok = True

    # --- 1. el modelo, desde la base ---
    cur.execute("select status, algorithm, is_reproducible, target_classes, git_commit "
                "from ml_models where model_slug=%s", (a.slug,))
    fila = cur.fetchone()
    if fila is None:
        print('[FALLO] no hay ningun modelo con slug %r' % a.slug)
        sys.exit(1)
    estado, algoritmo, reproducible, clases, commit = fila
    print('modelo    %s' % a.slug)
    print('  estado  %s   algoritmo %s   reproducible %s' % (estado, algoritmo, reproducible))
    print('  commit  %s' % commit)
    print('  clases  %s' % (clases,))
    if estado != 'active':
        print('  [AVISO] este modelo no esta en estado "active"')

    modelo = cargar_modelo(cn, a.slug)
    print('  binario cargado y SHA-256 verificado: %s' % type(modelo).__name__)

    # --- 2. el contrato de entrada, tambien desde la base ---
    cols = columnas_de_entrada(cn, a.slug)
    print('\ncontrato  %d columnas de entrada, en orden' % len(cols))
    print('  primeras: %s' % ', '.join(cols[:4]))
    print('  ultimas:  %s' % ', '.join(cols[-3:]))
    del_pipe = list(getattr(modelo, 'feature_names_in_', []))
    if del_pipe and del_pipe != cols:
        print('  [FALLO] el contrato registrado NO coincide con el del binario')
        ok = False
    else:
        print('  coincide con feature_names_in_ del binario: si')

    # --- 3. datos reales, construidos como lo hara el backend ---
    df = pd.read_sql('SELECT * FROM v_ml_features LIMIT %d' % a.filas, cn)
    faltan = [c for c in cols if c not in df.columns]
    if faltan:
        print('\n[FALLO] v_ml_features no tiene estas columnas del contrato: %s' % faltan)
        sys.exit(1)
    X = df.reindex(columns=cols)
    print('\nentrada   %d filas x %d columnas desde v_ml_features' % X.shape)

    # --- 4. prediccion ---
    pred = modelo.predict(X)
    vistas = sorted(set(pred))
    print('prediccion   %s' % dict(pd.Series(pred).value_counts()))
    desconocidas = [c for c in vistas if clases and c not in clases]
    if desconocidas:
        print('  [FALLO] devuelve clases que no estan registradas: %s' % desconocidas)
        ok = False
    else:
        print('  todas las clases devueltas estan en target_classes: si')
    if hasattr(modelo, 'predict_proba'):
        pr = modelo.predict_proba(X)
        print('  predict_proba disponible: %s, filas que suman 1: %d/%d'
              % (pr.shape, int(np.isclose(pr.sum(axis=1), 1).sum()), len(pr)))

    # --- 5. por que el orden importa ---
    revuelto = list(reversed(cols))
    pred_nombres = modelo.predict(X.reindex(columns=revuelto))
    iguales_nombres = int((pred_nombres == pred).sum())
    try:
        pred_array = modelo.predict(X.reindex(columns=revuelto).to_numpy())
        iguales_array = int((pred_array == pred).sum())
        aviso_array = '%d/%d iguales' % (iguales_array, len(pred))
    except Exception as e:
        aviso_array = 'da error (%s), que es el buen desenlace' % type(e).__name__
    print('\nel orden importa:')
    print('  columnas al reves, como DataFrame con nombres: %d/%d predicciones iguales'
          % (iguales_nombres, len(pred)))
    print('  columnas al reves, como array de numpy:        %s' % aviso_array)
    print('  -> por eso el backend debe leer v_ml_model_input_contract, no una lista fija.')

    print('\nveredicto: %s' % ('LISTO PARA SERVIR' if ok else 'HAY PROBLEMAS'))
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
