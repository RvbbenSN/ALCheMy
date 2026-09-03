# -*- coding: utf-8 -*-
"""
ml_model_registry.py -- guardar, consultar y recuperar modelos de ALCheMy.

QUE PROBLEMA RESUELVE
---------------------
"Guardo el modelo en un .pkl" no basta, y este proyecto tiene la prueba: el
modelo del cuaderno 06 v2 daba F1 0,62 y hoy no puede reconstruirse, porque los
datos sobre los que se entreno se corrigieron despues (un error de unidades de
factor 1000). Un .pkl guardado entonces seguiria cargando sin errores y dando
predicciones calculadas sobre una definicion de las variables que ya no existe.
Silenciosamente equivocado, que es la peor clase de error.

Por eso aqui se registra la RECETA completa -- datos, codigo, parametros,
semilla, versiones -- y el binario es solo una comodidad para no reentrenar.

USO
---
    from src.ml_model_registry import registrar_dataset, registrar_modelo, cargar_modelo

    dataset_id = registrar_dataset(conn, slug='hts_v2_2026_08', consulta=SQL, df=df, ...)
    registrar_modelo(conn, slug='crystallinity_v3_hts_full', pipeline=pipe, ...)
    modelo = cargar_modelo(conn, 'crystallinity_v3_hts_full')

CLI
---
    python src/ml_model_registry.py --list                # que modelos hay
    python src/ml_model_registry.py --show <slug>         # la ficha completa
    python src/ml_model_registry.py --export <slug> [dir] # sacar el binario a disco
"""
from __future__ import annotations

import hashlib
import io
import json
import os
import platform
import re
import subprocess
import sys

# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

def _sha256(datos: bytes) -> str:
    return hashlib.sha256(datos).hexdigest()


def _normalizar_sql(sql: str) -> str:
    """Colapsa espacios y baja a minusculas para que el hash identifique la
    consulta y no su formato. Dos consultas que solo difieren en sangrado son
    la misma consulta."""
    return re.sub(r'\s+', ' ', sql).strip().lower()


def _commit_git() -> str | None:
    """Commit actual del repositorio. Sin esto no se sabe QUE CODIGO produjo el
    modelo, por muchos hiperparametros que se guarden."""
    try:
        raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        out = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=raiz,
                             capture_output=True, text=True, timeout=10)
        if out.returncode == 0:
            commit = out.stdout.strip()
            sucio = subprocess.run(['git', 'status', '--porcelain'], cwd=raiz,
                                   capture_output=True, text=True, timeout=10)
            # Marcar el arbol sucio es importante: "commit abc123" con cambios
            # sin guardar NO identifica el codigo que se ejecuto.
            return commit + ('-dirty' if sucio.stdout.strip() else '')
    except Exception:
        pass
    return None


def _versiones() -> dict:
    """Versiones de las librerias relevantes. scikit-learn cambia valores por
    defecto entre versiones: el mismo codigo en otra version puede dar otro
    modelo sin avisar de nada."""
    v = {}
    for nombre in ['sklearn', 'numpy', 'pandas', 'scipy', 'lightgbm', 'xgboost', 'joblib']:
        try:
            v[nombre] = __import__(nombre).__version__
        except Exception:
            pass
    return v


# ---------------------------------------------------------------------------
# Registro
# ---------------------------------------------------------------------------

def registrar_dataset(conn, slug, consulta, n_rows, n_features=None, n_groups=None,
                      target_column=None, class_distribution=None,
                      feature_source=None, filters_human=None, known_caveats=None):
    """Registra la instantanea de datos. Devuelve dataset_id.

    Idempotente por slug: volver a registrar el mismo slug ACTUALIZA la fila,
    de forma que re-ejecutar un cuaderno no crea duplicados.
    """
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO ml_datasets (dataset_slug, source_query, query_sha256, feature_source,
                                 n_rows, n_features, n_groups, target_column,
                                 class_distribution, filters_human, known_caveats)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (dataset_slug) DO UPDATE SET
            source_query = EXCLUDED.source_query,
            query_sha256 = EXCLUDED.query_sha256,
            feature_source = EXCLUDED.feature_source,
            n_rows = EXCLUDED.n_rows, n_features = EXCLUDED.n_features,
            n_groups = EXCLUDED.n_groups, target_column = EXCLUDED.target_column,
            class_distribution = EXCLUDED.class_distribution,
            filters_human = EXCLUDED.filters_human, known_caveats = EXCLUDED.known_caveats
        RETURNING dataset_id;
    """, (slug, consulta, _sha256(_normalizar_sql(consulta).encode('utf-8')),
          feature_source, n_rows, n_features, n_groups, target_column,
          json.dumps(class_distribution) if class_distribution else None,
          filters_human, known_caveats))
    return cur.fetchone()[0]


def registrar_modelo(conn, slug, display_name, task_type, algorithm, library,
                     dataset_id=None, pipeline=None, hyperparameters=None,
                     preprocessing=None, validation_scheme=None, random_seed=None,
                     target_column=None, target_classes=None, question=None,
                     source_notebook=None, metrics=None, features=None,
                     status='active', is_reproducible=True,
                     not_reproducible_reason=None, notes=None):
    """Registra un modelo con su receta completa y, si se pasa `pipeline`, su
    binario serializado.

    `pipeline` deberia ser el PIPELINE ENTERO (imputacion + escalado +
    codificacion + estimador), no solo el estimador: un modelo sin su
    preprocesado no puede predecir sobre datos crudos, y separarlos es la forma
    mas comun de que un modelo guardado resulte inservible.

    `metrics`  -> [{'metric_name','split','metric_value','metric_std','n_folds','class_name'}]
    `features` -> [{'feature_name','feature_role','feature_block','importance','exclusion_reason'}]
    """
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO ml_models (model_slug, display_name, task_type, target_column,
            target_classes, question, dataset_id, algorithm, library, hyperparameters,
            preprocessing, validation_scheme, random_seed, source_notebook, git_commit,
            python_version, library_versions, platform, status, is_reproducible,
            not_reproducible_reason, notes)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (model_slug) DO UPDATE SET
            display_name = EXCLUDED.display_name, hyperparameters = EXCLUDED.hyperparameters,
            task_type = EXCLUDED.task_type, target_column = EXCLUDED.target_column,
            target_classes = EXCLUDED.target_classes, question = EXCLUDED.question,
            algorithm = EXCLUDED.algorithm, library = EXCLUDED.library,
            python_version = EXCLUDED.python_version, platform = EXCLUDED.platform,
            preprocessing = EXCLUDED.preprocessing, validation_scheme = EXCLUDED.validation_scheme,
            random_seed = EXCLUDED.random_seed, source_notebook = EXCLUDED.source_notebook,
            git_commit = EXCLUDED.git_commit, library_versions = EXCLUDED.library_versions,
            status = EXCLUDED.status, is_reproducible = EXCLUDED.is_reproducible,
            not_reproducible_reason = EXCLUDED.not_reproducible_reason,
            notes = EXCLUDED.notes, dataset_id = EXCLUDED.dataset_id
        RETURNING model_id;
    """, (slug, display_name, task_type, target_column, target_classes, question,
          dataset_id, algorithm, library,
          json.dumps(hyperparameters, default=str) if hyperparameters else None,
          json.dumps(preprocessing, default=str) if preprocessing else None,
          json.dumps(validation_scheme, default=str) if validation_scheme else None,
          random_seed, source_notebook, _commit_git(),
          platform.python_version(), json.dumps(_versiones()), platform.platform(),
          status, is_reproducible, not_reproducible_reason, notes))
    model_id = cur.fetchone()[0]

    if metrics:
        cur.execute('DELETE FROM ml_model_metrics WHERE model_id = %s', (model_id,))
        for m in metrics:
            cur.execute("""INSERT INTO ml_model_metrics
                           (model_id, metric_name, split, metric_value, metric_std,
                            n_folds, class_name)
                           VALUES (%s,%s,%s,%s,%s,%s,%s)""",
                        (model_id, m['metric_name'], m.get('split', 'cv'),
                         m['metric_value'], m.get('metric_std'), m.get('n_folds'),
                         m.get('class_name', '')))

    if features:
        cur.execute('DELETE FROM ml_model_features WHERE model_id = %s', (model_id,))
        for f in features:
            cur.execute("""INSERT INTO ml_model_features
                           (model_id, feature_name, feature_role, feature_block,
                            importance, exclusion_reason)
                           VALUES (%s,%s,%s,%s,%s,%s)""",
                        (model_id, f['feature_name'], f.get('feature_role', 'input'),
                         f.get('feature_block'), f.get('importance'),
                         f.get('exclusion_reason')))

    if pipeline is not None:
        import joblib
        buf = io.BytesIO()
        joblib.dump(pipeline, buf, compress=3)
        datos = buf.getvalue()
        cur.execute("""
            INSERT INTO ml_model_artifacts (model_id, artifact_format, artifact_bytes,
                artifact_size_bytes, artifact_sha256, serialized_object, load_instructions)
            VALUES (%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (model_id) DO UPDATE SET
                artifact_bytes = EXCLUDED.artifact_bytes,
                artifact_size_bytes = EXCLUDED.artifact_size_bytes,
                artifact_sha256 = EXCLUDED.artifact_sha256,
                serialized_object = EXCLUDED.serialized_object,
                created_at = now();
        """, (model_id, 'joblib', psycopg2_binary(datos), len(datos), _sha256(datos),
              '%s.%s' % (type(pipeline).__module__, type(pipeline).__name__),
              'from src.ml_model_registry import cargar_modelo\n'
              'modelo = cargar_modelo(conn, "%s")\n'
              'pred = modelo.predict(X)   # X con las MISMAS columnas y en el MISMO orden\n'
              'Requiere las versiones de ml_models.library_versions.' % slug))
    return model_id


def psycopg2_binary(datos):
    import psycopg2
    return psycopg2.Binary(datos)


def cargar_modelo(conn, slug, verificar_hash=True):
    """Recupera un modelo entrenado y lo devuelve listo para predecir.

    Avisa por stderr si el modelo esta marcado como no reproducible o invalido:
    cargar un modelo invalidado sin enterarse es exactamente lo que este
    registro existe para evitar.
    """
    import joblib
    cur = conn.cursor()
    cur.execute("""SELECT m.model_id, m.status, m.is_reproducible, m.not_reproducible_reason,
                          a.artifact_bytes, a.artifact_sha256, m.library_versions
                     FROM ml_models m
                     LEFT JOIN ml_model_artifacts a ON a.model_id = m.model_id
                    WHERE m.model_slug = %s""", (slug,))
    fila = cur.fetchone()
    if fila is None:
        raise KeyError('No hay ningun modelo con slug %r en el registro' % slug)
    model_id, status, reproducible, motivo, datos, sha, versiones = fila

    if status == 'invalid':
        print('[AVISO] El modelo %r esta marcado como INVALIDO. Sus resultados no '
              'deben usarse.' % slug, file=sys.stderr)
    if not reproducible:
        print('[AVISO] El modelo %r no es reproducible: %s' % (slug, motivo), file=sys.stderr)
    if datos is None:
        raise ValueError('El modelo %r esta registrado pero no tiene binario guardado. '
                         'Se conserva su receta (ml_models), no el objeto entrenado.' % slug)

    datos = bytes(datos)
    if verificar_hash and _sha256(datos) != sha:
        raise ValueError('El binario de %r no coincide con su SHA-256 registrado: '
                         'esta corrupto.' % slug)

    # Aviso de version: la causa mas comun de que un modelo cargue pero se
    # comporte distinto es un cambio de version de scikit-learn.
    try:
        import sklearn
        guardada = (versiones or {}).get('sklearn')
        if guardada and guardada != sklearn.__version__:
            print('[AVISO] El modelo se entreno con scikit-learn %s y aqui hay %s. '
                  'Puede cargar y comportarse distinto.' % (guardada, sklearn.__version__),
                  file=sys.stderr)
    except Exception:
        pass

    return joblib.load(io.BytesIO(datos))


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _conectar():
    import psycopg2
    from dotenv import load_dotenv
    # Sube por los directorios padre buscando el .env. Hace falta porque el
    # modulo se invoca desde la raiz, desde notebooks/ y desde un worktree de
    # git, donde el .env (gitignorado) esta varios niveles por encima.
    aqui = os.path.dirname(os.path.abspath(__file__))
    candidatos = []
    d = aqui
    for _ in range(6):
        candidatos.append(os.path.join(d, '.env'))
        d = os.path.dirname(d)
    candidatos += ['.env', '../.env']
    for p in candidatos:
        if os.path.exists(p):
            load_dotenv(p); break
    return psycopg2.connect(host='localhost', port=5432, dbname='alchemy_db',
                            user=os.getenv('POSTGRES_USER'),
                            password=os.getenv('POSTGRES_PASSWORD'))


def _listar(conn):
    import pandas as pd
    df = pd.read_sql('SELECT * FROM v_ml_model_registry', conn)
    if df.empty:
        print('El registro esta vacio.'); return
    cols = ['model_slug', 'status', 'is_reproducible', 'algorithm', 'n_rows',
            'f1_macro_cv', 'mcc_cv', 'has_artifact', 'artifact_size', 'created_on']
    print(df[[c for c in cols if c in df.columns]].to_string(index=False))


def _mostrar(conn, slug):
    import pandas as pd
    m = pd.read_sql('SELECT * FROM ml_models WHERE model_slug = %(s)s', conn,
                    params={'s': slug})
    if m.empty:
        print('No existe el modelo %r' % slug); return
    fila = m.iloc[0]
    print('=' * 72)
    print(fila['display_name'])
    print('=' * 72)
    for k in ['model_slug', 'status', 'is_reproducible', 'not_reproducible_reason',
              'algorithm', 'library', 'random_seed', 'git_commit', 'python_version',
              'source_notebook', 'created_at']:
        if k in fila and pd.notna(fila[k]):
            print('  %-24s %s' % (k, fila[k]))
    print('\n  pregunta: %s' % fila.get('question'))
    print('\n  hiperparametros: %s' % fila.get('hyperparameters'))
    print('  validacion     : %s' % fila.get('validation_scheme'))
    print('  versiones      : %s' % fila.get('library_versions'))

    mid = int(fila['model_id'])
    d = pd.read_sql('SELECT * FROM ml_datasets WHERE dataset_id = %(i)s', conn,
                    params={'i': fila['dataset_id']}) if pd.notna(fila['dataset_id']) else None
    if d is not None and not d.empty:
        dd = d.iloc[0]
        print('\n  --- datos ---')
        print('  %s: %d filas, %s grupos, clases %s'
              % (dd['dataset_slug'], dd['n_rows'], dd['n_groups'], dd['class_distribution']))
        if dd['known_caveats']:
            print('  cautelas: %s' % dd['known_caveats'])

    mt = pd.read_sql("""SELECT metric_name, split, metric_value, metric_std
                          FROM ml_model_metrics WHERE model_id = %(i)s
                         ORDER BY split, metric_name""", conn, params={'i': mid})
    if not mt.empty:
        print('\n  --- metricas ---')
        print(mt.to_string(index=False))

    if fila.get('notes'):
        print('\n  --- notas ---\n  %s' % fila['notes'])


def _exportar(conn, slug, destino='.'):
    cur = conn.cursor()
    cur.execute("""SELECT a.artifact_bytes, a.artifact_format, a.artifact_sha256
                     FROM ml_model_artifacts a JOIN ml_models m USING (model_id)
                    WHERE m.model_slug = %s""", (slug,))
    fila = cur.fetchone()
    if not fila:
        print('El modelo %r no tiene binario guardado.' % slug); return
    datos, fmt, sha = bytes(fila[0]), fila[1], fila[2]
    ruta = os.path.join(destino, '%s.%s' % (slug, 'joblib' if fmt == 'joblib' else fmt))
    with open(ruta, 'wb') as fh:
        fh.write(datos)
    print('escrito %s  (%d bytes, sha256 %s)' % (ruta, len(datos), sha[:16] + '...'))


if __name__ == '__main__':
    args = sys.argv[1:]
    if not args or args[0] in ('-h', '--help'):
        print(__doc__)
    else:
        conn = _conectar()
        if args[0] == '--list':
            _listar(conn)
        elif args[0] == '--show' and len(args) > 1:
            _mostrar(conn, args[1])
        elif args[0] == '--export' and len(args) > 1:
            _exportar(conn, args[1], args[2] if len(args) > 2 else '.')
        else:
            print(__doc__)
