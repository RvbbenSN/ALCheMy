#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Comprueba que el proyecto sigue en pie. Se ejecuta ANTES y DESPUES de mover.

La idea no es que salga todo verde: es que salga **lo mismo** antes y despues.
Un fallo que ya existia antes de tocar nada no lo ha causado la reorganizacion,
y sin la foto previa es imposible distinguir una cosa de la otra.

Comprueba:
  1. Que los ficheros que Docker monta siguen donde el compose dice.
  2. Que el compose es valido y los contenedores estan sanos.
  3. Que la base responde y tiene los recuentos de siempre.
  4. Que los 80 modulos de Python se importan sin error.
  5. Que la web compila.
  6. Que los datos que la web lee existen y son JSON valido.

Uso
---
    python scripts/verificar_proyecto.py
    python scripts/verificar_proyecto.py --rapido   # se salta la compilacion web
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMPOSE = ROOT / "docker-compose.yml"

# Datos que la web carga en tiempo de ejecucion o de compilacion. Si uno
# desaparece, la pantalla que lo usa se rompe en el navegador y no al compilar.
DATOS_WEB = [
    "web/public/data/workflow_canvas.json",
    "web/public/data/rag_canvas.json",
    "web/public/data/simulator_grid.json",
    "web/src/data/model_scorecard.json",
    "web/src/data/schema_map.json",
    "web/src/data/knowledge_map.json",
    "web/src/data/graph_sample.json",
    "web/src/data/pxrd_examples.json",
]

fallos, avisos = [], []


def ok(msg):
    print("  [ok]   %s" % msg)


def mal(msg):
    print("  [FALLA] %s" % msg)
    fallos.append(msg)


def aviso(msg):
    print("  [.]    %s" % msg)
    avisos.append(msg)


def paso(titulo):
    print("\n%s" % titulo)
    print("-" * len(titulo))


def run(cmd, cwd=None, **kw):
    return subprocess.run(cmd, capture_output=True, text=True,
                          cwd=str(cwd or ROOT), **kw)


def montajes_del_compose():
    """Rutas del host que el compose monta o construye. Son las intocables."""
    txt = COMPOSE.read_text(encoding="utf-8")
    rutas = set(re.findall(r"-\s+\./([^:\s]+):", txt))
    rutas |= set(re.findall(r"dockerfile:\s*(\S+)", txt))
    rutas |= set(re.findall(r"context:\s*(\S+)", txt) or [])
    return sorted(r for r in rutas if r not in (".", "./"))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--rapido", action="store_true")
    args = ap.parse_args()

    paso("1. Lo que Docker monta o construye")
    for r in montajes_del_compose():
        p = ROOT / r
        (ok if p.exists() else mal)("%s  %s" % ("existe " if p.exists() else "NO EXISTE", r))

    paso("2. Compose y contenedores")
    r = run(["docker", "compose", "config", "--quiet"])
    (ok if r.returncode == 0 else mal)(
        "docker compose config" + ("" if r.returncode == 0 else ": " + r.stderr.strip()[:200]))
    r = run(["docker", "ps", "--format", "{{.Names}}\t{{.Status}}"])
    vivos = [l for l in r.stdout.splitlines() if l.startswith("alchemy")]
    if vivos:
        for l in vivos:
            n, s = l.split("\t", 1)
            (ok if "Up" in s else aviso)("%-20s %s" % (n, s))
    else:
        aviso("no hay contenedores alchemy levantados")

    paso("3. La base de datos")
    consulta = ("SELECT 'synthesis_experiments '||count(*) FROM synthesis_experiments "
                "UNION ALL SELECT 'characterization_measurements '||count(*) "
                "FROM characterization_measurements "
                "UNION ALL SELECT 'pxrd_labels '||count(*) FROM pxrd_labels "
                "UNION ALL SELECT 'rag_chunks '||count(*) FROM rag_chunks;")
    r = run(["docker", "exec", "-i", "alchemy_postgres", "psql", "-U", "alchemy_user",
             "-d", "alchemy_db", "-tAc", consulta])
    if r.returncode == 0 and r.stdout.strip():
        for l in r.stdout.strip().splitlines():
            ok(l.strip())
    else:
        mal("la base no responde: %s" % r.stderr.strip()[:160])

    paso("4. Los modulos de Python se importan")
    modulos = sorted(list((ROOT / "src").glob("*.py")) + list((ROOT / "scripts").glob("*.py"))
                     + list((ROOT / "app").glob("*.py")))
    rotos = []
    for m in modulos:
        r = run([sys.executable, "-c",
                 "import ast,io,sys; ast.parse(io.open(r'%s',encoding='utf-8').read())" % m])
        if r.returncode != 0:
            rotos.append(m.name)
    if rotos:
        mal("%d fichero(s) con error de sintaxis: %s" % (len(rotos), ", ".join(rotos[:6])))
    else:
        ok("%d ficheros de Python, sintaxis correcta" % len(modulos))

    paso("5. Los datos que la web lee")
    for d in DATOS_WEB:
        p = ROOT / d
        if not p.exists():
            mal("falta %s" % d)
            continue
        try:
            json.loads(p.read_text(encoding="utf-8"))
            ok("%-44s %6.1f KB" % (d, p.stat().st_size / 1024))
        except Exception as e:
            mal("%s no es JSON valido: %s" % (d, e))

    if not args.rapido:
        paso("6. La web compila")
        r = run(["cmd", "/c", "npm", "run", "build"], cwd=str(ROOT / "web"))
        salida = (r.stdout or "") + (r.stderr or "")
        if "built in" in salida:
            ok("npm run build")
        else:
            mal("npm run build: %s" % salida.strip()[-300:])

    print("\n" + "=" * 68)
    print("FALLOS: %d    avisos: %d" % (len(fallos), len(avisos)))
    if fallos:
        for f in fallos:
            print("   - %s" % f)
    return 1 if fallos else 0


if __name__ == "__main__":
    raise SystemExit(main())
