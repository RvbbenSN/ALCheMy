#!/usr/bin/env python3
"""Compone el lienzo del flujo RAG a partir de su grafo, no de sus pixeles.

Por que aqui NO se copia la geometria de n8n, y en la ingesta si
----------------------------------------------------------------
`build_workflow_canvas.py` conserva las coordenadas exactas del flujo de
ingesta, y puede hacerlo porque alli las nueve areas son sticky notes que Ruben
dibujo **envolviendo** a sus nodos: los marcos existen, no se inventan, y no se
pisan.

El flujo RAG no tiene eso. Sus dos notas grandes son banderolas de 1000 x 264
puestas encima de cada mitad, y las cinco restantes son anotaciones al margen.
Al agrupar por etapas y calcular el marco de cada grupo, los marcos salen
superpuestos — y no por un descuido del script, sino porque en el lienzo real
hay nodos de etapas distintas compartiendo columna: `Discard Already Indexed`
(x -448) y `Embeddings bge-m3` (x -352) estan a 96 unidades, con cajas de 190,
asi que la proyeccion horizontal de las dos etapas se solapa de verdad. En n8n
no molesta porque estan a alturas distintas; un marco rectangular por etapa no
puede evitarlo.

Asi que aqui se compone la posicion. Lo que se conserva intacto es lo unico que
un mapa de un flujo tiene que contar: **que nodos hay, como se llaman, de que
tipo son y como se conectan**. Las 48 aristas se leen del export, una por una.
Lo que cambia es donde se dibuja cada caja, y la web lo dice al lado del mapa.

Uso
---
    python scripts/build_rag_canvas.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "n8n_workflows" / "ALCheMy-RAG.json"
OUT = ROOT / "web" / "public" / "data" / "rag_canvas.json"

NODE_W, NODE_H = 190, 58
COL_GAP, ROW_GAP = 96, 46      # hueco entre cajas dentro de un area
PAD = 34                        # del marco a la caja mas exterior
AREA_GAP_X, AREA_GAP_Y = 150, 130

KIND = {
    "manualTrigger": "trigger",
    "chatTrigger": "trigger",
    "readWriteFile": "file",
    "set": "transform",
    "crypto": "code",
    "if": "gate",
    "merge": "merge",
    "postgres": "db",
    "postgresTool": "tool",
    "vectorStorePGVector": "vector",
    "embeddingsOllama": "embed",
    "textSplitterRecursiveCharacterTextSplitter": "transform",
    "documentDefaultDataLoader": "file",
    "agent": "ai",
    "lmChatGoogleGemini": "model",
    "lmChatOllama": "model",
    "memoryBufferWindow": "memory",
    "rerankerCohere": "rerank",
}

# Cada area: sus columnas, de izquierda a derecha; cada columna, sus filas.
# `band` y `order` colocan las areas entre si: banda 0 = indexado, 1 = consulta,
# 2 = las herramientas, que cuelgan de las dos agentes de la banda 1.
AREAS = [
    {
        "n": 1, "band": 0, "order": 0,
        "title": "The corpus arrives",
        "body": "Two folders, two sensitivity labels. **The folder a PDF sits in decides whether it is PUBLIC literature or an INTERNAL lab notebook** — the label is structural, not a field somebody has to remember to fill in. That single decision is what later lets the agent answer from the literature in public while keeping the notebooks behind the identity check.",
        "cols": [["▶ Run Ingestion"],
                 ["Read PUBLIC Corpus", "Read INTERNAL Corpus"],
                 ["Label PUBLIC", "Label INTERNAL"]],
    },
    {
        "n": 2, "band": 0, "order": 1,
        "title": "Nothing is indexed twice",
        "body": "The MD5 of each file is compared against the hashes already registered, and a Merge in *keep non-matches* mode drops whatever is already in. So **re-running the ingestion over the whole folder is safe and nearly free**: only genuinely new files reach the embedder. Without this, every re-run would duplicate 87,765 chunks and quietly poison retrieval with near-identical neighbours.",
        "cols": [["Compute File MD5", "Already Indexed Hashes"],
                 ["Discard Already Indexed"]],
    },
    {
        "n": 3, "band": 0, "order": 2,
        "title": "Split, embed, store",
        "body": "Recursive splitter at **1,200 characters with 250 of overlap**, then a single embeddings node: `bge-m3` running locally in Ollama, 1,024 dimensions. One node and not two, deliberately — if the indexing side and the query side ever embedded with different models, the vector store would return nonsense **without raising a single error**. Sharing the node makes that failure impossible rather than unlikely.",
        "cols": [["Split Text (Chunking)", "Document Loader", "Embeddings bge-m3 (Local Ollama)"],
                 ["Insert into pgvector", "Register in rag_documents"]],
    },
    {
        "n": 4, "band": 1, "order": 0,
        "title": "Who is asking",
        "body": "Before a single token reaches a model: identify the caller, check them against the researcher whitelist, and branch. **A denied request is logged and answered** — it does not fail silently. This is the same gate the ingestion workflow uses, and it is the reason the agent can be exposed to anyone at all.",
        "cols": [["Chat: Ask the Lab"], ["Identify Caller"], ["Authorise Caller"],
                 ["Is Caller Allowed?"], ["Log Denied Access", "Denied Reply"]],
    },
    {
        "n": 5, "band": 1, "order": 1,
        "title": "The agent, and its understudy",
        "body": "Gemini answers. If it fails — quota, outage, anything — the error output routes to a **second, complete Agent node** wired to Qwen3 14B running locally. n8n's Agent node refuses two language models on one node, so the fallback had to be built at workflow level instead of inside it; that was found by trying twice and reading the error. Every exchange is logged before the reply goes back.",
        "cols": [["Chat Model", "Conversation Memory"],
                 ["Agent - ALCheMy Lab Assistant"],
                 ["Qwen Chat Model (Local Fallback)"],
                 ["Agent - ALCheMy Lab Assistant (Qwen Fallback)"],
                 ["Log Exchange", "Reply"]],
    },
    {
        "n": 6, "band": 2, "order": 0,
        "title": "Nine tools, and one switched off",
        "body": "**The agent never writes SQL.** Every tool is a call to a stored function with typed parameters, so what it can ask is bounded by the database rather than by the prompt. Six read the laboratory, one reads the schema dictionary, one searches the literature semantically, two walk the knowledge graph. The Cohere reranker sits wired but **disabled on purpose**: it is the one component that would send chunk text to a third party.",
        "cols": [["search_synthesis", "read_data_dictionary"],
                 ["get_characterisation", "search_documentation"],
                 ["sample_summary", "find_graph_node"],
                 ["statistics", "explore_graph"],
                 ["search_library", "Reranker (Cohere) - DISABLED"]],
    },
]


def main() -> int:
    if not SRC.exists():
        print("ERROR: no encuentro %s" % SRC, file=sys.stderr)
        return 2

    wf = json.loads(SRC.read_text(encoding="utf-8"))

    nodes, notes = [], []
    for n in wf.get("nodes", []):
        short = n["type"].split(".")[-1]
        if short == "stickyNote":
            p = n.get("parameters", {})
            notes.append({"content": (p.get("content") or "").strip()})
            continue
        nodes.append({"id": n["name"], "name": n["name"],
                      "kind": KIND.get(short, "transform"),
                      "disabled": bool(n.get("disabled"))})

    by_name = {nd["id"]: nd for nd in nodes}

    # --- Comprobacion antes de dibujar nada -------------------------------
    declarados = [m for a in AREAS for col in a["cols"] for m in col]
    faltan = [m for m in declarados if m not in by_name]
    sobran = [nd["id"] for nd in nodes if nd["id"] not in set(declarados)]
    if faltan or sobran:
        if faltan:
            print("ERROR: se declaran nodos que no existen: %s" % faltan, file=sys.stderr)
        if sobran:
            print("ERROR: nodos del flujo sin area: %s" % sobran, file=sys.stderr)
        return 1
    if len(declarados) != len(set(declarados)):
        print("ERROR: hay nodos declarados en dos areas", file=sys.stderr)
        return 1

    # --- Tamano de cada area a partir de su rejilla ------------------------
    for a in AREAS:
        n_cols = len(a["cols"])
        n_rows = max(len(c) for c in a["cols"])
        a["w"] = n_cols * NODE_W + (n_cols - 1) * COL_GAP + 2 * PAD
        a["h"] = n_rows * NODE_H + (n_rows - 1) * ROW_GAP + 2 * PAD

    # --- Colocacion de las areas: bandas apiladas --------------------------
    y = 0
    for band in sorted({a["band"] for a in AREAS}):
        fila = sorted([a for a in AREAS if a["band"] == band], key=lambda a: a["order"])
        x = 0
        for a in fila:
            a["x"], a["y"] = x, y
            x += a["w"] + AREA_GAP_X
        y += max(a["h"] for a in fila) + AREA_GAP_Y

    # Cada banda se centra respecto a la mas ancha, que queda mejor y ademas
    # coloca las herramientas justo debajo de los agentes que las usan.
    ancho = max(a["x"] + a["w"] for a in AREAS)
    for band in sorted({a["band"] for a in AREAS}):
        fila = [a for a in AREAS if a["band"] == band]
        sobra = ancho - max(a["x"] + a["w"] for a in fila)
        for a in fila:
            a["x"] += sobra // 2

    # --- Nodos dentro de su area ------------------------------------------
    for a in AREAS:
        for ci, col in enumerate(a["cols"]):
            # Una columna con menos filas que la mas alta se centra en vertical.
            n_rows = max(len(c) for c in a["cols"])
            alto_col = len(col) * NODE_H + (len(col) - 1) * ROW_GAP
            alto_max = n_rows * NODE_H + (n_rows - 1) * ROW_GAP
            y0 = a["y"] + PAD + (alto_max - alto_col) // 2
            for ri, nombre in enumerate(col):
                nd = by_name[nombre]
                nd["area"] = a["n"]
                nd["x"] = a["x"] + PAD + ci * (NODE_W + COL_GAP)
                nd["y"] = y0 + ri * (NODE_H + ROW_GAP)

    # --- Aristas, leidas del export tal cual -------------------------------
    edges = []
    for src, outs in (wf.get("connections") or {}).items():
        if src not in by_name:
            continue
        for _tipo, ramas in outs.items():
            for i, rama in enumerate(ramas or []):
                for link in rama or []:
                    if link.get("node") in by_name:
                        edges.append({"from": src, "to": link["node"], "branch": i})

    # --- Ningun marco puede pisar a otro -----------------------------------
    for i in range(len(AREAS)):
        for j in range(i + 1, len(AREAS)):
            a, b = AREAS[i], AREAS[j]
            dx = min(a["x"] + a["w"], b["x"] + b["w"]) - max(a["x"], b["x"])
            dy = min(a["y"] + a["h"], b["y"] + b["h"]) - max(a["y"], b["y"])
            if dx > 0 and dy > 0:
                print("ERROR: los marcos %d y %d se solapan" % (a["n"], b["n"]), file=sys.stderr)
                return 1

    areas = [{k: a[k] for k in ("n", "title", "body", "x", "y", "w", "h")} for a in AREAS]

    pad = 90
    x0 = min(a["x"] for a in areas) - pad
    y0 = min(a["y"] for a in areas) - pad
    bounds = {"x": x0, "y": y0,
              "w": max(a["x"] + a["w"] for a in areas) + pad - x0,
              "h": max(a["y"] + a["h"] for a in areas) + pad - y0}

    payload = {"nodeSize": {"w": NODE_W, "h": NODE_H}, "bounds": bounds,
               "areas": areas, "nodes": nodes, "edges": edges, "notes": [],
               "composed": True}

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")

    print("areas    %d" % len(areas))
    for a in areas:
        print("   %d. %-34s %2d nodos  %5dx%-5d en (%d,%d)"
              % (a["n"], a["title"], sum(1 for nd in nodes if nd["area"] == a["n"]),
                 a["w"], a["h"], a["x"], a["y"]))
    print("nodos    %d (%d desactivado)"
          % (len(nodes), sum(1 for nd in nodes if nd["disabled"])))
    print("aristas  %d  (leidas del export, sin tocar)" % len(edges))
    print("lienzo   %dx%d" % (bounds["w"], bounds["h"]))
    print("escrito  %s (%.1f KB)" % (OUT.relative_to(ROOT), OUT.stat().st_size / 1024))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
