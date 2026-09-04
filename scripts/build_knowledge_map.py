#!/usr/bin/env python3
"""El mapa del conocimiento: donde se ha mirado, y hacia donde apunta el modelo.

La metafora
-----------
Ruben la describio asi: el espacio de sintesis es un mapa a oscuras con unas
pocas zonas iluminadas por los experimentos que ya se han hecho, y el modelo es
una brujula que dice hacia donde conviene caminar para ampliar la zona
iluminada.

Se puede dibujar de dos maneras. Una es una ilustracion: un mapa negro con
manchas de luz, bonito y falso. La otra es la que hace este script, que es
dibujar **el mapa de verdad**:

  - el fondo es la probabilidad de fase cristalina que el modelo desplegado
    asigna a cada combinacion de temperatura y modulador -- la misma rejilla que
    alimenta el simulador de la pantalla 06, no una recreacion;
  - los puntos son las condiciones que el laboratorio **si** ha probado, con su
    resultado real;
  - y la zona que se propone es donde el modelo duda, que es exactamente donde
    un experimento nuevo ensena mas.

Por que la duda y no la probabilidad alta
-----------------------------------------
Un experimento en una casilla donde el modelo ya esta seguro no ensena nada
--confirma lo que ya sabia--. Donde duda entre dos clases, cualquiera de los dos
resultados corrige el modelo. Se mide con la entropia de la distribucion de
probabilidades, normalizada a 1.

Uso
---
    python scripts/build_knowledge_map.py
"""

from __future__ import annotations

import base64
import json
import math
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GRID = ROOT / "web" / "public" / "data" / "simulator_grid.json"
OUT = ROOT / "web" / "src" / "data" / "knowledge_map.json"

# El corte que se dibuja. Se elige el metal con mas historico para que la nube
# de puntos reales sea densa y el mapa no parezca vacio por casualidad.
EJE_X = "temp_target_c"
EJE_Y = "mod_carboxylic_mmol"


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
    if not GRID.exists():
        print("falta %s: ejecute antes build_simulator_grid.py" % GRID, file=sys.stderr)
        return 1
    g = json.loads(GRID.read_text(encoding="utf-8"))

    ejes = g["axes"]
    orden = g["axisOrder"]
    forma = g["shape"]
    clases = g["classes"]
    datos = base64.b64decode(g["data"])

    i_cris = clases.index("CRISTALINO")

    def prob(indices):
        """Devuelve las tres probabilidades de una casilla de la rejilla."""
        plano = 0
        for eje, i in zip(orden, indices):
            plano = plano * forma[orden.index(eje)] + i
        base = plano * len(clases)
        return [datos[base + k] / 255.0 for k in range(len(clases))]

    conn = connect()
    cur = conn.cursor()

    # Metal con mas sintesis en el conjunto del modelo.
    cur.execute("""
        SELECT metal_center, count(*) FROM v_ml_features
         WHERE synthesis_type = 'HTS' GROUP BY 1 ORDER BY 2 DESC LIMIT 1
    """)
    metal, n_metal = cur.fetchone()
    i_metal = g["metals"].index(metal) if metal in g["metals"] else 0
    metal = g["metals"][i_metal]

    # Las condiciones realmente probadas, leidas con la consulta que el registro
    # guarda para el conjunto del modelo. Reescribir aqui unos filtros parecidos
    # dejaba entrar filas que el modelo nunca vio: aparecian sintesis a 25 C
    # cuando el conjunto de entrenamiento empieza en 80.
    cur.execute("SELECT source_query FROM ml_datasets d JOIN ml_models m "
                "ON m.dataset_id = d.dataset_id WHERE m.model_slug = %s", (g["model"],))
    fila = cur.fetchone()
    if not fila:
        print("no encuentro el conjunto del modelo %s" % g["model"], file=sys.stderr)
        return 1
    cur.execute(
        "SELECT temp_target_c, mod_carboxylic_mmol, ml_class, count(*) "
        "FROM (%s) AS d WHERE metal_center = %%s AND temp_target_c IS NOT NULL "
        "AND mod_carboxylic_mmol IS NOT NULL GROUP BY 1, 2, 3" % fila[0], (metal,))
    crudos = [(float(a), float(b), c, n) for a, b, c, n in cur.fetchall()]

    # El eje del modulador es una escalera de siete valores redondos, pero el
    # modulador real es continuo. Cada sintesis va a la casilla mas cercana: es
    # lo que un mapa de casillas quiere decir, y sin esto los circulos se
    # dibujaban fuera de la rejilla.
    def acerca(v, valores):
        return min(valores, key=lambda u: abs(u - v))

    agrupados = {}
    for a, b, c, n in crudos:
        clave = (acerca(a, ejes[EJE_X]), acerca(b, ejes[EJE_Y]), c)
        agrupados[clave] = agrupados.get(clave, 0) + n
    puntos = [{"x": x, "y": y, "klass": c, "n": n}
              for (x, y, c), n in sorted(agrupados.items())]

    # El mapa: para cada (temperatura, modulador) se promedian las casillas del
    # resto de ejes, que es lo honesto -- el corte no fija tiempo ni ratio.
    xs, ys = ejes[EJE_X], ejes[EJE_Y]
    i_x, i_y = orden.index(EJE_X), orden.index(EJE_Y)
    otros = [k for k in range(len(orden)) if k not in (0, i_x, i_y)]

    celdas = []
    for ix, xv in enumerate(xs):
        for iy, yv in enumerate(ys):
            acc_c, acc_h, n = 0.0, 0.0, 0
            idx = [0] * len(orden)
            idx[0] = i_metal
            idx[i_x], idx[i_y] = ix, iy
            for a in range(forma[otros[0]]):
                for b in range(forma[otros[1]]):
                    idx[otros[0]], idx[otros[1]] = a, b
                    p = prob(idx)
                    total = sum(p) or 1.0
                    p = [v / total for v in p]
                    acc_c += p[i_cris]
                    acc_h += -sum(v * math.log(v, len(p)) for v in p if v > 0)
                    n += 1
            celdas.append({
                "x": xv, "y": yv,
                "pCrystalline": round(acc_c / n, 4),
                "uncertainty": round(acc_h / n, 4),
            })

    # Donde mas se aprende: alta duda, y sin experimentos hechos cerca.
    probadas = {(p["x"], p["y"]) for p in puntos}
    candidatas = sorted(
        (c for c in celdas if (c["x"], c["y"]) not in probadas),
        key=lambda c: -c["uncertainty"],
    )[:3]

    salida = {
        "model": g["model"],
        "metal": metal,
        "nSyntheses": n_metal,
        "axes": {"x": {"key": EJE_X, "label": "Target temperature (°C)", "values": xs},
                 "y": {"key": EJE_Y, "label": "Carboxylic modulator (mmol)", "values": ys}},
        "cells": celdas,
        "coverage": {"tried": len(probadas), "total": len(celdas)},
        "tried": puntos,
        "suggested": candidatas,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(salida, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")

    print("metal con mas historico : %s (%d sintesis)" % (metal, n_metal))
    print("rejilla del corte       : %d x %d = %d casillas" % (len(xs), len(ys), len(celdas)))
    print("condiciones ya probadas : %d casillas, %d sintesis"
          % (len(probadas), sum(p["n"] for p in puntos)))
    print("cobertura del mapa      : %.0f %% de las casillas"
          % (100.0 * len(probadas) / len(celdas)))
    print("donde el modelo mas duda:")
    for c in candidatas:
        print("   %5.0f C  %5.1f mmol   duda %.3f   P(cristalino) %.2f"
              % (c["x"], c["y"], c["uncertainty"], c["pCrystalline"]))
    print("escrito %s (%.1f KB)" % (OUT.relative_to(ROOT), OUT.stat().st_size / 1024))
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
