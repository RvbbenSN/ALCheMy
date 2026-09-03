# -*- coding: utf-8 -*-
"""Comprueba que un cuaderno de modelado dice la verdad.

Dos preguntas, que son distintas y las dos importan:

  --diff      Las salidas guardadas en el cuaderno, ¿son las que ese mismo
              código produce HOY contra la base de datos? Un cuaderno cuyas
              cifras ya no se reproducen es un cuaderno que miente sin avisar:
              se lee igual de bien, y el texto que las interpreta también.

  --registro  Las métricas guardadas en `ml_model_metrics`, ¿coinciden con las
              que sale al re-entrenar? Un registro de modelos que no coincide
              con la realidad es peor que no tenerlo, porque da confianza.

Por qué existe. El 2026-09-03, auditando el modelo v4 de cristalinidad, este
procedimiento detectó que el cuaderno 06 mostraba F1 = 0,511 y una importancia
por bloques NEGATIVA para el medio, mientras que una ejecución limpia del mismo
código daba 0,517 y todos los bloques positivos. La interpretación química
escrita en §8.4 —"arreglar el dato no lo convirtió en señal"— se apoyaba en unos
números que ya no salían. Se re-ejecutó el cuaderno entero y se reescribió el
texto. Sin esta comprobación, el error habría llegado a la web pública.

Uso:
    python scripts/audit_model_reproducibility.py --diff NOTEBOOK
    python scripts/audit_model_reproducibility.py --registro NOTEBOOK --slug SLUG [--slug SLUG]
    python scripts/audit_model_reproducibility.py --diff --registro NOTEBOOK --slug SLUG

Devuelve código de salida 1 si algo no cuadra, para poder encadenarlo.

Limitación honesta: re-ejecuta el cuaderno hasta la última celda que menciona
`permutation_importance` (o hasta `--hasta`), y sólo compara la salida IMPRESA
(`print`), no las tablas que Jupyter muestra como resultado de la última
expresión ni las figuras. Es una red de seguridad, no una prueba formal.
"""
import argparse
import difflib
import io
import json
import os
import sys
import warnings


def celdas_de_codigo(ruta):
    nb = json.load(io.open(ruta, encoding='utf-8'))
    return [c for c in nb['cells'] if c['cell_type'] == 'code']


def salida_impresa(celda):
    """Sólo los `print`. Los display de Jupyter no se pueden reproducir con exec."""
    t = []
    for o in celda.get('outputs', []):
        if o.get('output_type') == 'stream':
            t.append(''.join(o['text']))
    return [l.rstrip() for l in ''.join(t).splitlines() if l.strip()]


def ejecutar(celdas, hasta, verboso=True):
    """Ejecuta las celdas en un único espacio de nombres, como haría un kernel.

    Devuelve (namespace, lista de (indice, salida_guardada, salida_de_ahora))."""
    G = {'__name__': '__main__'}
    filas = []
    for i, c in enumerate(celdas[:hasta + 1]):
        src = ''.join(c['source'])
        buf = io.StringIO()
        anterior, sys.stdout = sys.stdout, buf
        try:
            exec(compile(src, '<celda %d>' % i, 'exec'), G)
        except Exception as e:
            sys.stdout = anterior
            print('FALLO en la celda %d: %s: %s' % (i, type(e).__name__, e))
            print(src[:400])
            raise
        finally:
            sys.stdout = anterior
        filas.append((i, salida_impresa(c), [l.rstrip() for l in buf.getvalue().splitlines()
                                             if l.strip()], src))
    return G, filas


def informe_diff(filas):
    divergen = 0
    for i, antes, ahora, src in filas:
        if not antes and not ahora:
            continue
        if antes == ahora:
            continue
        divergen += 1
        print('=' * 72)
        print('CELDA %d DIVERGE  |  %s' % (i, src.strip().splitlines()[0][:70]))
        for l in difflib.unified_diff(antes, ahora, 'guardado', 'ahora', lineterm='', n=1):
            print('  ' + l[:150])
    if divergen == 0:
        print('[diff] el cuaderno reproduce exactamente sus salidas guardadas.')
    else:
        print('\n[diff] %d celdas ya no reproducen lo que muestran.' % divergen)
    return divergen == 0


def conectar():
    import psycopg2
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass
    return psycopg2.connect(host=os.getenv('POSTGRES_HOST', 'localhost'),
                            port=os.getenv('POSTGRES_PORT', '5432'),
                            dbname=os.getenv('POSTGRES_DB'),
                            user=os.getenv('POSTGRES_USER'),
                            password=os.getenv('POSTGRES_PASSWORD'))


def informe_registro(G, slugs, var_resultados):
    """Compara ml_model_metrics con lo que acaba de salir.

    `var_resultados` empareja cada slug con el DataFrame de resultados del
    cuaderno, cuya primera fila es el modelo ganador."""
    cn = conectar()
    cur = cn.cursor()
    cur.execute("select m.model_slug, k.metric_name, k.metric_value "
                "from ml_model_metrics k join ml_models m using(model_id) "
                "where m.model_slug = any(%s) "
                "and k.metric_name in ('f1_macro','matthews_corrcoef')", (list(slugs),))
    registrado = {(a, b): float(c) for a, b, c in cur.fetchall()}

    todo_ok = True
    print('\n[registro] guardado en la base  vs  re-obtenido ahora')
    for slug, nombre_var in var_resultados.items():
        res = G.get(nombre_var)
        if res is None:
            print('  %-34s no encuentro la variable %r en el cuaderno' % (slug, nombre_var))
            todo_ok = False
            continue
        fila = res.iloc[0]
        for metrica, columna in [('f1_macro', 'F1 macro'), ('matthews_corrcoef', 'MCC')]:
            ahora = float(fila[columna])
            antes = registrado.get((slug, metrica))
            bien = antes is not None and abs(antes - ahora) < 1e-4
            todo_ok &= bien
            print('  %-34s %-18s base=%s  ahora=%.4f  %s'
                  % (slug, metrica, '%.4f' % antes if antes is not None else 'AUSENTE',
                     ahora, 'OK' if bien else 'DIFIERE'))
    cn.close()
    return todo_ok


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('notebook')
    p.add_argument('--diff', action='store_true',
                   help='comparar las salidas guardadas con las de ahora')
    p.add_argument('--registro', action='store_true',
                   help='comparar ml_model_metrics con las metricas de ahora')
    p.add_argument('--slug', action='append', default=[],
                   help='slug del modelo a comprobar; repetible')
    p.add_argument('--variable', action='append', default=[],
                   help='nombre de la variable del cuaderno con los resultados de cada '
                        'slug, en el mismo orden (por defecto res_completo y res_accionable)')
    p.add_argument('--hasta', type=int, default=None,
                   help='ultima celda de codigo a ejecutar (por defecto, la ultima que '
                        'menciona permutation_importance)')
    a = p.parse_args()
    if not (a.diff or a.registro):
        a.diff = a.registro = True

    warnings.filterwarnings('ignore')
    import matplotlib
    matplotlib.use('Agg')

    celdas = celdas_de_codigo(a.notebook)
    hasta = a.hasta
    if hasta is None:
        candidatas = [i for i, c in enumerate(celdas)
                      if 'permutation_importance' in ''.join(c['source'])]
        hasta = candidatas[-1] if candidatas else len(celdas) - 1
    print('re-ejecutando %s: celdas de codigo 0..%d' % (a.notebook, hasta))
    G, filas = ejecutar(celdas, hasta)

    ok = True
    if a.diff:
        ok &= informe_diff(filas)
    if a.registro:
        if not a.slug:
            print('\n[registro] hace falta al menos un --slug')
            ok = False
        else:
            variables = a.variable or ['res_completo', 'res_accionable']
            ok &= informe_registro(G, a.slug, dict(zip(a.slug, variables)))

    print('\nveredicto: %s' % ('TODO CUADRA' if ok else 'HAY DISCREPANCIAS'))
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
