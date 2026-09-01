# -*- coding: utf-8 -*-
"""
sync_data_dictionary.py -- audita y sincroniza data_dictionary con el esquema real.

POR QUE EXISTE
--------------
data_dictionary esta para que la aplicacion web y los agentes de IA lean la
documentacion del esquema DESDE la base, en vez de llevarla escrita a mano en el
codigo. Eso solo funciona si la cobertura es del 100 %: un agente que consulta el
diccionario y no encuentra una columna no puede distinguir entre "no esta
documentada" y "no existe".

Una auditoria del 2026-08-29 encontro un 42,4 % de cobertura, 14 objetos al 0 % y
8 filas huerfanas. Este script convierte esa comprobacion en algo que se puede
repetir en un segundo, para que la cobertura no vuelva a degradarse en silencio
cada vez que se anade una tabla.

USO
    python src/sync_data_dictionary.py --audit      # cobertura, huecos y huerfanas
    python src/sync_data_dictionary.py --sync       # copia COMMENTs nativos que falten
    python src/sync_data_dictionary.py --missing    # lista las columnas sin documentar
    python src/sync_data_dictionary.py --check      # salida 1 si no esta al 100 % (para CI)
"""
import os
import sys

# Objetos que no se exigen documentar. Vacio a proposito: si algo existe en el
# esquema, se documenta. Dejar la lista aqui, visible, obliga a justificar
# cualquier excepcion futura en vez de esconderla en una consulta.
EXCLUIDOS = set()


def _conectar():
    import psycopg2
    from dotenv import load_dotenv
    aqui = os.path.dirname(os.path.abspath(__file__))
    candidatos, d = [], aqui
    for _ in range(6):
        candidatos.append(os.path.join(d, '.env'))
        d = os.path.dirname(d)
    candidatos += ['.env', '../.env']
    for p in candidatos:
        if os.path.exists(p):
            load_dotenv(p)
            break
    return psycopg2.connect(host='localhost', port=5432, dbname='alchemy_db',
                            user=os.getenv('POSTGRES_USER'),
                            password=os.getenv('POSTGRES_PASSWORD'))


SQL_COBERTURA = """
WITH reales AS (
  SELECT c.relname AS objeto, a.attname AS columna,
         CASE c.relkind WHEN 'r' THEN 'TABLE' ELSE 'VIEW' END AS tipo,
         col_description(c.oid, a.attnum) AS comentario
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
   WHERE n.nspname = 'public' AND c.relkind IN ('r','v')
)
SELECT r.tipo, r.objeto, count(*) AS columnas,
       count(d.column_name) AS documentadas,
       count(*) - count(d.column_name) AS faltan,
       round(100.0*count(d.column_name)/count(*), 1) AS pct
  FROM reales r
  LEFT JOIN data_dictionary d
    ON d.table_name = r.objeto AND d.column_name = r.columna
 GROUP BY 1, 2 ORDER BY pct, columnas DESC
"""

SQL_FALTAN = """
WITH reales AS (
  SELECT c.relname AS objeto, a.attname AS columna, a.attnum,
         format_type(a.atttypid, a.atttypmod) AS tipo,
         col_description(c.oid, a.attnum) AS comentario
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
   WHERE n.nspname = 'public' AND c.relkind IN ('r','v')
)
SELECT r.objeto, r.columna, r.tipo, r.comentario
  FROM reales r
  LEFT JOIN data_dictionary d
    ON d.table_name = r.objeto AND d.column_name = r.columna
 WHERE d.column_name IS NULL
 ORDER BY r.objeto, r.attnum
"""

SQL_HUERFANAS = """
SELECT d.table_name, d.column_name
  FROM data_dictionary d
 WHERE NOT EXISTS (
   SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name=d.table_name
      AND c.column_name=d.column_name)
 ORDER BY 1, 2
"""

SQL_SIN_COMMENT = """
SELECT c.relname AS objeto,
       CASE c.relkind WHEN 'r' THEN 'TABLE' ELSE 'VIEW' END AS tipo
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','v')
   AND obj_description(c.oid) IS NULL
 ORDER BY 1
"""


def auditar(conn, silencioso=False):
    """Devuelve (pct_global, faltan, huerfanas). Imprime el informe salvo que
    se pida silencio."""
    import pandas as pd
    cob = pd.read_sql(SQL_COBERTURA, conn)
    huer = pd.read_sql(SQL_HUERFANAS, conn)
    sinc = pd.read_sql(SQL_SIN_COMMENT, conn)

    total, doc = int(cob['columnas'].sum()), int(cob['documentadas'].sum())
    pct = 100.0 * doc / total if total else 100.0

    if not silencioso:
        pd.set_option('display.width', 200)
        pd.set_option('display.max_rows', 200)
        incompletos = cob[cob['faltan'] > 0]
        print('=' * 68)
        print('AUDITORIA DE data_dictionary')
        print('=' * 68)
        if len(incompletos):
            print('\nObjetos con columnas sin documentar:')
            print(incompletos.to_string(index=False))
        else:
            print('\nTodos los objetos estan completos.')
        print('\n-- Resumen --')
        print('  objetos             : %d  (%d tablas, %d vistas)'
              % (len(cob), (cob['tipo'] == 'TABLE').sum(), (cob['tipo'] == 'VIEW').sum()))
        print('  columnas            : %d' % total)
        print('  documentadas        : %d  (%.1f %%)' % (doc, pct))
        print('  sin documentar      : %d' % (total - doc))
        print('  filas huerfanas     : %d%s'
              % (len(huer), '' if not len(huer) else
                 '  <- describen columnas que ya no existen'))
        if len(huer):
            for _, r in huer.iterrows():
                print('        %s.%s' % (r['table_name'], r['column_name']))
        print('  objetos sin COMMENT : %d' % len(sinc))
        if len(sinc):
            for _, r in sinc.iterrows():
                print('        %s (%s)' % (r['objeto'], r['tipo']))
    return pct, total - doc, len(huer)


def listar_faltan(conn):
    import pandas as pd
    df = pd.read_sql(SQL_FALTAN, conn)
    if df.empty:
        print('No falta ninguna columna: cobertura del 100 %.')
        return
    for obj, g in df.groupby('objeto', sort=False):
        print('\n### %s  (%d sin documentar)' % (obj, len(g)))
        for _, r in g.iterrows():
            extra = ('   [hay COMMENT nativo: %s]' % r['comentario'][:60]) if r['comentario'] else ''
            print('   %-34s %-26s%s' % (r['columna'], r['tipo'], extra))


def sincronizar(conn):
    """Copia a data_dictionary los COMMENT nativos de columnas que aun no tengan
    fila. NO inventa descripciones: solo rescata las que ya estaban escritas en
    el esquema pero no llegaron al diccionario."""
    import pandas as pd
    df = pd.read_sql(SQL_FALTAN, conn)
    conRecuperable = df[df['comentario'].notna()]
    if conRecuperable.empty:
        print('No hay COMMENTs nativos que rescatar.')
        return 0
    cur = conn.cursor()
    for _, r in conRecuperable.iterrows():
        cur.execute("""
            INSERT INTO data_dictionary
                (table_name, column_name, full_name, section_name, data_type, description)
            VALUES (%s,%s,%s,%s,%s,%s)
            ON CONFLICT (table_name, column_name) DO NOTHING
        """, (r['objeto'], r['columna'],
              r['columna'].replace('_', ' ').capitalize(),
              'UNCLASSIFIED', r['tipo'].upper(), r['comentario']))
    conn.commit()
    print('rescatados %d COMMENTs nativos al diccionario.' % len(conRecuperable))
    print('Quedan marcados con section_name = UNCLASSIFIED para revisarlos a mano.')
    return len(conRecuperable)


if __name__ == '__main__':
    args = sys.argv[1:]
    if not args or args[0] in ('-h', '--help'):
        print(__doc__)
        sys.exit(0)
    conn = _conectar()
    if args[0] == '--audit':
        auditar(conn)
    elif args[0] == '--missing':
        listar_faltan(conn)
    elif args[0] == '--sync':
        sincronizar(conn)
        auditar(conn)
    elif args[0] == '--check':
        pct, faltan, huer = auditar(conn, silencioso=True)
        ok = (faltan == 0 and huer == 0)
        print('cobertura %.1f %% | sin documentar %d | huerfanas %d -> %s'
              % (pct, faltan, huer, 'OK' if ok else 'INCOMPLETO'))
        sys.exit(0 if ok else 1)
    else:
        print(__doc__)
