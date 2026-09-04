#!/usr/bin/env python3
"""Convierte la respuesta de Gemini en `scripts/translations/nb<NN>_en.py`.

De donde lee
------------
`_lab/handoff/markdown_cells_translated/<stem>.md` — la respuesta de Gemini,
guardada tal cual, para cada notebook que le hayas pasado (ver
`_lab/handoff/PROMPT_PARA_GEMINI.md`).

Que valida antes de escribir nada
----------------------------------
Que el conjunto de indices `=== CELL N ===` que devolvio Gemini sea
EXACTAMENTE igual al conjunto de celdas markdown del `.ipynb` original: ni
una de mas, ni una de menos, ni un indice inventado. Si algo no cuadra, no
escribe el fichero de traduccion y dice exactamente que celda falta o sobra
-- mejor eso que un notebook a medio traducir en produccion.

Uso
---
    python scripts/import_translated_cells.py                # los 6 pendientes
    python scripts/import_translated_cells.py --only 05
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NB_DIR = ROOT / "_lab" / "notebooks"
IN_DIR = ROOT / "_lab" / "handoff" / "markdown_cells_translated"
OUT_DIR = ROOT / "scripts" / "translations"

RE_BLOQUE = re.compile(r"===\s*CELL\s+(\d+)\s*===\s*\n(.*?)(?=\n===\s*CELL\s+\d+\s*===|\Z)", re.S)


def indices_markdown_originales(nb_path: Path) -> set[int]:
    nb = json.loads(nb_path.read_text(encoding="utf-8"))
    return {i for i, c in enumerate(nb.get("cells", [])) if c.get("cell_type") == "markdown"}


def escribir_modulo(stem: str, celdas: dict[int, str]) -> Path:
    numero = stem[:2]
    out = OUT_DIR / f"nb{numero}_en.py"
    lineas = [
        "# -*- coding: utf-8 -*-",
        f'"""Traduccion al ingles de las celdas markdown del notebook {numero}.',
        "",
        "Generado por scripts/import_translated_cells.py a partir de la respuesta",
        "de Gemini en _lab/handoff/markdown_cells_translated/. No editar a mano:",
        "si hay que corregir algo, corrigelo en el .md de origen y reimporta.",
        '"""',
        "",
        "CELLS = {",
    ]
    for i in sorted(celdas):
        lineas.append("    %d: %r," % (i, celdas[i]))
    lineas.append("}")
    out.write_text("\n".join(lineas) + "\n", encoding="utf-8")
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--only", help="solo el notebook cuyo nombre empieza por este prefijo")
    args = ap.parse_args()

    fuentes = sorted(IN_DIR.glob("*.md")) if IN_DIR.exists() else []
    if args.only:
        fuentes = [f for f in fuentes if f.stem.startswith(args.only)]
    if not fuentes:
        print("no hay nada en %s (¿ya guardaste las respuestas de Gemini ahi?)" % IN_DIR, file=sys.stderr)
        return 1

    ok, mal = [], []
    for f in fuentes:
        nb_path = NB_DIR / (f.stem + ".ipynb")
        if not nb_path.exists():
            print("AVISO: no encuentro el notebook original para %s, salto" % f.name)
            continue

        esperados = indices_markdown_originales(nb_path)
        texto = f.read_text(encoding="utf-8")
        celdas = {}
        for m in RE_BLOQUE.finditer(texto):
            idx = int(m.group(1))
            celdas[idx] = m.group(2).rstrip("\n") + "\n"

        recibidos = set(celdas)
        faltan = esperados - recibidos
        sobran = recibidos - esperados

        if faltan or sobran:
            mal.append(f.name)
            print("PROBLEMA en %s:" % f.name)
            if faltan:
                print("  faltan las celdas: %s" % sorted(faltan))
            if sobran:
                print("  celdas que no existen en el original: %s" % sorted(sobran))
            print("  -> no se genera scripts/translations/nb%s_en.py. Corrige el .md y reimporta." % f.stem[:2])
            continue

        out = escribir_modulo(f.stem, celdas)
        ok.append((f.stem, out, len(celdas)))

    print()
    for stem, out, n in ok:
        print("generado %-55s %2d celdas -> %s" % (stem, n, out.relative_to(ROOT)))
    if mal:
        print()
        print("Con problemas (no generados): %s" % ", ".join(mal))
    return 1 if mal else 0


if __name__ == "__main__":
    raise SystemExit(main())
