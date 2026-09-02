#!/usr/bin/env python3
"""Extrae el lienzo de n8n a un JSON que la web pueda dibujar y navegar.

Que problema resuelve
---------------------
El flujo de ingesta son 79 nodos repartidos por un lienzo de 11.500 x 4.500
unidades. Una captura de pantalla es ilegible y una lista de nodos pierde lo
unico que importa de un flujo: **como se conectan**. Este script saca la
geometria real del export de n8n para poder reconstruirlo como un mapa con zoom
y arrastre, igual que se ve dentro de la herramienta.

Que aprovecha del propio export
-------------------------------
Las **sticky notes grandes ya enmarcan las areas**. Las que empiezan por
`### <numero> — TITULO` llevan posicion, ancho y alto, asi que los nueve marcos
del mapa no hay que inventarlos: son los que Ruben dibujo en n8n. Las notas
pequenas restantes son anotaciones, y su texto va al panel de detalle en vez de
al lienzo.

Cada nodo se asigna al area cuyo marco lo contiene. Si cayera fuera de todos
—porque alguien lo movio— se marca como huerfano en vez de asignarlo al azar.

Uso
---
    python scripts/build_workflow_canvas.py
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "n8n_workflows" / "ALCheMy_master_v2.json"
OUT = ROOT / "web" / "public" / "data" / "workflow_canvas.json"

RE_AREA = re.compile(r"^###\s*(\d+)\s*[^\w]*\s*(.+?)\s*$", re.M)

# Tipo de nodo de n8n -> familia visual. Determina icono y color en la web.
KIND = {
    "manualTrigger": "trigger",
    "formTrigger": "trigger",
    "webhook": "trigger",
    "readWriteFile": "file",
    "set": "transform",
    "code": "code",
    "if": "gate",
    "switch": "router",
    "merge": "merge",
    "moveBinaryData": "transform",
    "postgres": "db",
    "emailSend": "reply",
    "respondToWebhook": "reply",
    "agent": "ai",
    "chainLlm": "ai",
    "lmChatGoogleGemini": "model",
    "lmChatOllama": "model",
    "outputParserStructured": "model",
}

NODE_W, NODE_H = 190, 58  # caja de nodo en unidades del lienzo


def main() -> int:
    if not SRC.exists():
        print("ERROR: no encuentro %s" % SRC, file=sys.stderr)
        return 2

    wf = json.loads(SRC.read_text(encoding="utf-8"))
    raw_nodes = wf.get("nodes", [])

    areas, notes, nodes = [], [], []

    for n in raw_nodes:
        short = n["type"].split(".")[-1]
        x, y = n["position"][0], n["position"][1]

        if short == "stickyNote":
            p = n.get("parameters", {})
            content = p.get("content") or ""
            w = p.get("width") or 300
            h = p.get("height") or 200
            m = RE_AREA.match(content)
            if m:
                areas.append(
                    {
                        "n": int(m.group(1)),
                        "title": m.group(2).strip(),
                        "x": x, "y": y, "w": w, "h": h,
                        "body": content.split("\n", 1)[1].strip() if "\n" in content else "",
                    }
                )
            else:
                notes.append({"x": x, "y": y, "w": w, "h": h, "content": content.strip()})
            continue

        nodes.append(
            {
                "id": n["name"],
                "name": n["name"],
                "kind": KIND.get(short, "transform"),
                "x": x, "y": y,
            }
        )

    areas.sort(key=lambda a: a["n"])

    # Cada nodo al area que lo contiene geometricamente.
    def area_of(px, py):
        for a in areas:
            if a["x"] <= px <= a["x"] + a["w"] and a["y"] <= py <= a["y"] + a["h"]:
                return a["n"]
        return None

    orphans = 0
    for nd in nodes:
        nd["area"] = area_of(nd["x"] + NODE_W / 2, nd["y"] + NODE_H / 2)
        if nd["area"] is None:
            orphans += 1

    # --- Aireado ---------------------------------------------------------
    # En n8n los nodos se colocan a mano y a veces quedan mas juntos que el
    # ancho de la caja que dibuja la web (sobre todo en las zonas de agentes,
    # 6 y 7). Una relajacion por pares los separa hasta dejar `AIR` px de hueco,
    # empujando por el eje donde menos se solapan y moviendo lo justo, asi que
    # el trazado relativo se conserva y las aristas siguen conectando.
    AIR = 26

    def overlaps(members):
        for i in range(len(members)):
            for j in range(i + 1, len(members)):
                p, q = members[i], members[j]
                if (NODE_W - abs((p["x"] - q["x"]))) > 0 and (NODE_H - abs((p["y"] - q["y"]))) > 0:
                    return True
        return False

    for a in areas:
        members = [n for n in nodes if n["area"] == a["n"]]
        # Solo se airea el area que de verdad tiene cajas encimadas. Tocar las
        # demas solo desplaza sus marcos hacia los vecinos sin ninguna ganancia.
        if not overlaps(members):
            continue
        for _ in range(200):
            moved = False
            for i in range(len(members)):
                for j in range(i + 1, len(members)):
                    p, q = members[i], members[j]
                    ox = (NODE_W + AIR) - abs((p["x"] + NODE_W / 2) - (q["x"] + NODE_W / 2))
                    oy = (NODE_H + AIR) - abs((p["y"] + NODE_H / 2) - (q["y"] + NODE_H / 2))
                    if ox > 0 and oy > 0:
                        if ox <= oy:
                            d = ox / 2 * (1 if p["x"] <= q["x"] else -1)
                            p["x"] -= d
                            q["x"] += d
                        else:
                            d = oy / 2 * (1 if p["y"] <= q["y"] else -1)
                            p["y"] -= d
                            q["y"] += d
                        moved = True
            if not moved:
                break
        # Estirar el marco solo si algun nodo aireado se sale, y lo justo: un
        # margen de 16 px. Asi no se inflan los marcos hacia los vecinos.
        if members:
            m = 16
            nx0 = min(n["x"] for n in members) - m
            ny0 = min(n["y"] for n in members) - m
            nx1 = max(n["x"] + NODE_W for n in members) + m
            ny1 = max(n["y"] + NODE_H for n in members) + m
            x0, y0 = min(a["x"], nx0), min(a["y"], ny0)
            a["w"] = max(a["x"] + a["w"], nx1) - x0
            a["h"] = max(a["y"] + a["h"], ny1) - y0
            a["x"], a["y"] = x0, y0

    # Cada nota pequena al area que la contiene, para el panel de detalle.
    for nt in notes:
        nt["area"] = area_of(nt["x"] + nt["w"] / 2, nt["y"] + nt["h"] / 2)

    # Conexiones. n8n las guarda por nombre de nodo de origen.
    by_name = {nd["id"]: nd for nd in nodes}
    edges = []
    for src, outs in (wf.get("connections") or {}).items():
        if src not in by_name:
            continue
        for _out_type, branches in outs.items():
            for branch_i, branch in enumerate(branches or []):
                for link in branch or []:
                    dst = link.get("node")
                    if dst in by_name:
                        edges.append({"from": src, "to": dst, "branch": branch_i})

    xs = [nd["x"] for nd in nodes] + [a["x"] for a in areas]
    ys = [nd["y"] for nd in nodes] + [a["y"] for a in areas]
    xs2 = [nd["x"] + NODE_W for nd in nodes] + [a["x"] + a["w"] for a in areas]
    ys2 = [nd["y"] + NODE_H for nd in nodes] + [a["y"] + a["h"] for a in areas]
    pad = 120
    bounds = {"x": min(xs) - pad, "y": min(ys) - pad,
              "w": max(xs2) - min(xs) + 2 * pad, "h": max(ys2) - min(ys) + 2 * pad}

    payload = {
        "nodeSize": {"w": NODE_W, "h": NODE_H},
        "bounds": bounds,
        "areas": areas,
        "nodes": nodes,
        "edges": edges,
        "notes": notes,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")

    print("areas    %d" % len(areas))
    for a in areas:
        n_in = sum(1 for nd in nodes if nd["area"] == a["n"])
        print("   %d  %-28s %2d nodos" % (a["n"], a["title"][:28], n_in))
    print("nodos    %d  (%d fuera de todo marco)" % (len(nodes), orphans))
    print("aristas  %d" % len(edges))
    print("notas    %d" % len(notes))
    print("lienzo   %dx%d" % (bounds["w"], bounds["h"]))
    print("escrito  %s (%.0f KB)" % (OUT.relative_to(ROOT), OUT.stat().st_size / 1024))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
