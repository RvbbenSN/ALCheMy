#!/usr/bin/env python3
"""Una vecindad del grafo de conocimiento, para dibujarla en la pantalla 07.

Por que una vecindad y no el grafo entero
-----------------------------------------
El grafo tiene 6.506 nodos y 10.906 aristas. Dibujarlo entero da una maraña en
la que no se distingue nada: un grafo completo de ese tamaño no informa, decora.
Lo que el agente hace de verdad tampoco es mirarlo entero -- `explore_graph`
camina dos o tres saltos desde un nodo. Asi que se dibuja exactamente eso: una
muestra y lo que la rodea, que es la unidad de informacion que el grafo produce.

Se elige la muestra con mas conexiones para que el ejemplo no parezca escogido
para quedar bien y salga vacio.

Privacidad
----------
Los codigos de muestra y los nombres de ligando se sustituyen por seudonimos
estables dentro del fichero. Los metales se dejan: no son secreto.

Uso
---
    python scripts/build_graph_sample.py
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "web" / "src" / "data" / "graph_sample.json"
# Un salto, no dos. A dos saltos salen 160 nodos y 149 de ellos son muestras que
# comparten metal: el metal es un concentrador y se come el dibujo. Con un salto
# se ve la unidad util --una muestra y lo que la define-- y a cada vecino se le
# anota su GRADO, que dice cuantas muestras mas cuelgan de el sin tener que
# dibujarlas. Esa cifra es justamente lo que hace util al grafo.
HOPS = 1


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
        SELECT n.node_id, count(*) AS grado
          FROM kg_nodes n
          JOIN kg_edges e ON e.from_node = n.node_id OR e.to_node = n.node_id
         WHERE n.node_type = 'SAMPLE'
         GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 1
    """)
    fila = cur.fetchone()
    if not fila:
        print("el grafo esta vacio", file=sys.stderr)
        return 1
    centro, grado = fila

    # Dos saltos, sin direccion: al agente le da igual el sentido de la arista
    # para preguntar "que tiene esto alrededor".
    cur.execute("""
        WITH RECURSIVE camino(node_id, salto) AS (
            SELECT %s::text, 0
          UNION
            SELECT CASE WHEN e.from_node = c.node_id THEN e.to_node ELSE e.from_node END,
                   c.salto + 1
              FROM camino c
              JOIN kg_edges e ON e.from_node = c.node_id OR e.to_node = c.node_id
             WHERE c.salto < %s
        )
        SELECT DISTINCT node_id, min(salto) FROM camino GROUP BY 1
    """, (centro, HOPS))
    saltos = {r[0]: r[1] for r in cur.fetchall()}

    cur.execute("SELECT node_id, node_type, label FROM kg_nodes WHERE node_id = ANY(%s)",
                (list(saltos),))
    crudos = cur.fetchall()

    cur.execute("""
        SELECT from_node, to_node, edge_type FROM kg_edges
         WHERE from_node = ANY(%s) AND to_node = ANY(%s)
    """, (list(saltos), list(saltos)))
    aristas_crudas = cur.fetchall()

    # Seudonimos estables. El metal se deja tal cual.
    alias, contadores = {}, {"SAMPLE": 0, "LIGAND": 0, "MEASUREMENT": 0, "MODULATOR": 0}
    PREFIJO = {"SAMPLE": "SMP", "LIGAND": "LIG", "MEASUREMENT": "MEA", "MODULATOR": "MOD"}

    def etiqueta(node_id, tipo, label):
        if tipo in ("METAL",):
            return label or node_id.split(":")[-1]
        if node_id not in alias:
            contadores[tipo] = contadores.get(tipo, 0) + 1
            alias[node_id] = "%s-%03d" % (PREFIJO.get(tipo, "N"), contadores[tipo])
        return alias[node_id]

    cur.execute("""
        SELECT n.node_id, count(*) FROM kg_nodes n
          JOIN kg_edges e ON e.from_node = n.node_id OR e.to_node = n.node_id
         WHERE n.node_id = ANY(%s) GROUP BY 1
    """, (list(saltos),))
    grados = dict(cur.fetchall())

    # El id tambien se seudonimiza. Antes solo se cambiaba la etiqueta, asi que
    # el dibujo enseñaba SMP-001 mientras el JSON que lo alimenta llevaba
    # "SAMPLE:SMP-0100(Ni)" dentro. Un seudonimo que solo cubre lo que se ve no es
    # un seudonimo.
    def id_publico(nid, tipo):
        return "%s:%s" % (tipo, etiqueta(nid, tipo, None))

    nodos = [
        {
            "id": id_publico(nid, tipo),
            "type": tipo,
            "label": etiqueta(nid, tipo, lab),
            "hop": saltos[nid],
            "degree": grados.get(nid, 0),
        }
        for nid, tipo, lab in crudos
    ]
    tipo_de = {nid: tipo for nid, tipo, _ in crudos}
    aristas = [{"from": id_publico(a, tipo_de[a]), "to": id_publico(b, tipo_de[b]), "type": t}
               for a, b, t in aristas_crudas]

    salida = {
        "center": id_publico(centro, tipo_de[centro]),
        "centerLabel": alias.get(centro, centro),
        "hops": HOPS,
        "nodes": nodos,
        "edges": aristas,
        "totals": {},
    }

    cur.execute("SELECT count(*) FROM kg_nodes")
    salida["totals"]["nodes"] = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM kg_edges")
    salida["totals"]["edges"] = cur.fetchone()[0]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(salida, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")

    from collections import Counter
    print("centro          : grado %d -> %s (el codigo real no se escribe)"
          % (grado, salida["centerLabel"]))
    print("vecindad a %d saltos: %d nodos, %d aristas" % (HOPS, len(nodos), len(aristas)))
    print("por tipo        : %s" % dict(Counter(n["type"] for n in nodos)))
    print("por relacion    : %s" % dict(Counter(e["type"] for e in aristas)))
    print("grafo completo  : %d nodos, %d aristas"
          % (salida["totals"]["nodes"], salida["totals"]["edges"]))
    print("escrito %s (%.1f KB)" % (OUT.relative_to(ROOT), OUT.stat().st_size / 1024))
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
