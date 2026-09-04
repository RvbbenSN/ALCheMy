#!/usr/bin/env python3
"""Saca el mapa del esquema desde la base, para la pantalla que lo disecciona.

Que problema resuelve
---------------------
La pantalla 08 explica como esta organizada la base: cuantas tablas hay, en que
familias se agrupan, cuantas columnas y cuantas filas tiene cada una y para que
sirve. Escribir eso a mano en el contenido de la web garantiza que dentro de dos
migraciones sea mentira -- ya paso con la tabla del registro de modelos, que
publicaba los v3 como activos cuando la web ya servia el v4.

Asi que aqui no se escribe ningun hecho. Los recuentos de columnas y filas, y
las descripciones, se leen de `information_schema` y de los `COMMENT ON TABLE`
nativos, que es donde el proyecto ya los mantiene. Lo unico que se declara es a
que **familia** pertenece cada tabla, porque eso es una decision sobre como
contarlo y no un dato que la base conozca.

Como se cuentan las filas
-------------------------
Con `count(*)` de verdad, no con la estimacion de `pg_class.reltuples`: son
menos de cuarenta tablas y el numero se publica, asi que una estimacion que se
desvie un 3 % seria una cifra falsa en una pantalla que habla de gobernanza.

Uso
---
    python scripts/build_schema_map.py
"""

from __future__ import annotations

import datetime as dt
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "web" / "src" / "data" / "schema_map.json"

# La unica decision que se toma aqui: como se agrupa lo que hay. El orden es el
# del relato del sitio -- primero el laboratorio, luego lo que se deriva de el,
# luego lo que lo gobierna.
FAMILIES = [
    {
        "key": "lab",
        "title": "The laboratory record",
        "blurb": "The two tables everything else hangs off: one row per synthesis attempted, one row per instrument file measured.",
        "tables": ["synthesis_experiments", "characterization_measurements",
                   "characterization_measurements_test"],
    },
    {
        "key": "chem",
        "title": "Chemistry reference",
        "blurb": "Turns a chemical symbol into physics. Populated from mendeleev, pymatgen and RDKit, and every value traceable to a citation.",
        "tables": ["element_properties", "ion_properties", "linker_properties",
                   "metal_source_oxidation_state", "property_sources"],
    },
    {
        "key": "pxrd",
        "title": "Signal and ground truth",
        "blurb": "What the diffractograms became: 29 deterministic descriptors per curve, and the human verdicts that no pipeline can recompute.",
        "tables": ["pxrd_descriptors", "pxrd_labels"],
    },
    {
        "key": "ml",
        "title": "The model registry",
        "blurb": "Five tables holding the full lineage of every model trained: the recipe, the dataset snapshot, the features kept and excluded, the metrics, and the binary.",
        "tables": ["ml_models", "ml_datasets", "ml_model_features", "ml_model_metrics",
                   "ml_model_artifacts"],
    },
    {
        "key": "rag",
        "title": "The literature corpus",
        "blurb": "The catalogue, the passages with their vectors, and the contextual sentence written for each one.",
        "tables": ["rag_documents", "rag_chunks", "rag_chunk_context"],
    },
    {
        "key": "graph",
        "title": "The knowledge graph",
        "blurb": "Samples, ligands, metals, modulators and measurements as nodes, and what connects them as edges - in Postgres, not in a separate graph database.",
        "tables": ["kg_nodes", "kg_edges"],
    },
    {
        "key": "gov",
        "title": "Governance",
        "blurb": "Who did what, who is allowed to ask, and what every column means. The part that turns a database into a record.",
        "tables": ["data_dictionary", "audit_log", "authorized_researchers", "agent_chat_log",
                   "agent_owner_secret", "ai_agent_calls"],
    },
]

# Tablas que existen en la base pero no son de este proyecto. Se listan a
# proposito y a la vista: una excepcion escondida dentro de una consulta es una
# excepcion que nadie vuelve a revisar.
NOT_OURS = {"job_leads"}

# Vistas que existen en la base pero NO se publican en la web: duplicados en
# castellano que siguen ahi solo hasta migrar a quien las llama. Ensenarlas en
# la pantalla 08 obliga a explicar en cada fila que son una copia temporal, que
# es ruido para quien lee. Cuando se borren de la base, quitarlas de aqui.
VIEWS_HIDDEN = {"v_agente_muestras", "v_rag_biblioteca"}


def connect():
    import psycopg2
    from dotenv import load_dotenv

    for base in [ROOT, *ROOT.parents]:
        if (base / ".env").exists():
            load_dotenv(base / ".env")
            break
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", 5432)),
        dbname=os.getenv("POSTGRES_DB", "alchemy_db"),
        user=os.getenv("POSTGRES_USER"),
        password=os.getenv("POSTGRES_PASSWORD"),
    )


def main() -> int:
    conn = connect()
    cur = conn.cursor()

    cur.execute("""
        SELECT c.relname,
               CASE c.relkind WHEN 'r' THEN 'table' WHEN 'v' THEN 'view' END AS kind,
               (SELECT count(*) FROM information_schema.columns k
                 WHERE k.table_schema = 'public' AND k.table_name = c.relname) AS n_cols,
               pg_total_relation_size(c.oid) AS bytes,
               obj_description(c.oid) AS comment
          FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v')
         ORDER BY c.relname
    """)
    # Los COMMENT se publican tal cual en la pantalla 08, y alguno enumera los
    # ligandos sin publicar. Se sanea aqui, igual que hace build_schema_sql.py
    # con el volcado del esquema: la base los conserva, la web no los ve.
    LIGANDOS = re.compile(r"\b(H8ptp|Et8ptp|H6ttbmp|Et6ttbmp)\b")
    MUESTRAS = re.compile(r"\b(RSMix\d+|RS\d{2,}|LP\d+|IEF-\d+)\b")

    def limpio(txt):
        txt = LIGANDOS.sub("LIG-x", txt or "")
        return MUESTRAS.sub("SMP-0001", txt)

    objetos = {r[0]: {"name": r[0], "kind": r[1], "columns": r[2],
                      "bytes": r[3], "comment": limpio(r[4])} for r in cur.fetchall()}

    # Funciones del proyecto. Las de pgvector y demas extensiones se quedan
    # fuera: no las escribio nadie aqui y contarlas inflaria la cifra.
    cur.execute(r"""
        SELECT DISTINCT p.proname
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.prokind = 'f'
           AND (p.proname LIKE 'agent\_%' OR p.proname LIKE 'rag\_%'
                OR p.proname LIKE 'kg\_%' OR p.proname LIKE 'ml\_%')
         ORDER BY 1
    """)
    funciones = [r[0] for r in cur.fetchall()]

    tablas = [o for o in objetos.values() if o["kind"] == "table"]
    vistas = [o for o in objetos.values()
              if o["kind"] == "view" and o["name"] not in VIEWS_HIDDEN]

    declaradas = {t for f in FAMILIES for t in f["tables"]}
    faltan = [t for t in declaradas if t not in objetos]
    sueltas = [t["name"] for t in tablas
               if t["name"] not in declaradas and t["name"] not in NOT_OURS]
    if faltan:
        print("ERROR: se declaran tablas que no existen: %s" % faltan, file=sys.stderr)
        return 1
    if sueltas:
        print("ERROR: tablas sin familia: %s\n"
              "       Anadalas a FAMILIES o a NOT_OURS; no se publican a ciegas."
              % sueltas, file=sys.stderr)
        return 1

    familias = []
    for f in FAMILIES:
        filas = []
        for nombre in f["tables"]:
            o = objetos[nombre]
            cur.execute('SELECT count(*) FROM "%s"' % nombre)
            n_filas = cur.fetchone()[0]
            filas.append({"name": nombre, "columns": o["columns"], "rows": n_filas,
                          "bytes": o["bytes"], "comment": o["comment"]})
        familias.append({"key": f["key"], "title": f["title"], "blurb": f["blurb"],
                         "tables": filas,
                         "totalRows": sum(t["rows"] for t in filas),
                         "totalBytes": sum(t["bytes"] for t in filas)})

    cur.execute("SELECT count(*) FROM data_dictionary")
    n_dicc = cur.fetchone()[0]
    nuestras = [o for o in objetos.values() if o["name"] not in NOT_OURS]
    documentadas = sum(1 for o in nuestras if o["comment"])

    salida = {
        "generatedAt": dt.date.today().isoformat(),
        "totals": {
            "tables": len([t for t in tablas if t["name"] not in NOT_OURS]),
            "views": len(vistas),
            "functions": len(funciones),
            "columns": sum(t["columns"] for t in tablas if t["name"] not in NOT_OURS),
            "dictionaryRows": n_dicc,
            "documented": documentadas,
            "documentedOf": len(nuestras),
        },
        "families": familias,
        "views": [{"name": v["name"], "columns": v["columns"], "comment": v["comment"]}
                  for v in vistas],
        "functions": funciones,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(salida, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")

    print("familias %d" % len(familias))
    for f in familias:
        print("   %-26s %2d tablas  %12s filas" % (f["title"], len(f["tables"]),
                                                   "{:,}".format(f["totalRows"])))
    print("tablas   %d   vistas %d   funciones %d"
          % (salida["totals"]["tables"], salida["totals"]["views"],
             salida["totals"]["functions"]))
    print("columnas %d   diccionario %d filas   documentadas %d/%d"
          % (salida["totals"]["columns"], n_dicc,
             salida["totals"]["documented"], salida["totals"]["documentedOf"]))
    print("escrito  %s (%.1f KB)" % (OUT.relative_to(ROOT), OUT.stat().st_size / 1024))
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
