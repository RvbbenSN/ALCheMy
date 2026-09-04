#!/usr/bin/env python3
"""Exporta las celdas markdown (ya saneadas) de cada cuaderno, para traducir.

Que problema resuelve
---------------------
`build_bilingual_full_notebooks.py` necesita, para el ingles, un diccionario
{indice_de_celda: texto_en_ingles} por cuaderno (ver `scripts/translations/`).
Escribirlo a mano funciono para el notebook 03 (30 celdas); para los otros 6
(hasta 56 celdas markdown en el 05) conviene delegar la traduccion a un
revisor externo (Gemini), igual que ya se hizo con `export_notebook_prose.py`.

La diferencia con `export_notebook_prose.py`
----------------------------------------------
Aquel script concatenaba TODAS las celdas markdown en un unico documento
fluido, pensado para publicarse como pagina de lectura. Aqui hace falta lo
contrario: **una traduccion por celda, con el indice preservado**, porque
el resultado tiene que reinsertarse exactamente en el hueco de cada celda del
notebook completo (que conserva el codigo). Por eso el formato de salida son
bloques `=== CELL N ===`, uno por celda, y no un texto corrido.

Que se sanea antes de salir
----------------------------
Lo mismo que en `build_public_notebooks.py`: codigos de muestra, ligandos no
publicados, nombres de terceros, rutas absolutas y correos. Nunca sale nada
de eso hacia un servicio externo.

Uso
---
    python scripts/export_markdown_cells_for_translation.py
    python scripts/export_markdown_cells_for_translation.py --only 05
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NB_DIR = ROOT / "_lab" / "notebooks"
OUT_DIR = ROOT / "_lab" / "handoff" / "markdown_cells_for_translation"


def cargar_saneador():
    ruta = ROOT / "scripts" / "build_public_notebooks.py"
    spec = importlib.util.spec_from_file_location("build_public_notebooks", ruta)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--only", help="solo notebooks cuyo nombre empieza por este prefijo, p.ej. 05")
    args = ap.parse_args()

    mod = cargar_saneador()
    notebooks_todos = sorted(NB_DIR.glob("*.ipynb"))
    if not notebooks_todos:
        print("no hay cuadernos en %s" % NB_DIR, file=sys.stderr)
        return 1

    # Sanitizer de corpus completo, para que un mismo codigo/nombre reciba
    # siempre el mismo seudonimo, se exporte o no ese notebook en concreto.
    san = mod.Sanitizer()
    for p in notebooks_todos:
        nb = json.loads(p.read_text(encoding="utf-8"))
        for cell in nb.get("cells", []):
            mod.walk_strings(cell, lambda s: (san.collect(s), s)[1])
    san.freeze()

    objetivo = notebooks_todos
    if args.only:
        objetivo = [p for p in objetivo if p.stem.startswith(args.only)]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for p in objetivo:
        nb = json.loads(p.read_text(encoding="utf-8"))
        bloques = []
        n_celdas = 0
        for i, cell in enumerate(nb.get("cells", [])):
            if cell.get("cell_type") != "markdown":
                continue
            texto = "".join(cell["source"]) if isinstance(cell["source"], list) else cell["source"]
            texto = san.apply(texto)
            bloques.append("=== CELL %d ===\n%s" % (i, texto))
            n_celdas += 1

        out = OUT_DIR / (p.stem + ".md")
        out.write_text("\n\n".join(bloques) + "\n", encoding="utf-8")
        print("escrito %-70s %2d celdas markdown" % (out.relative_to(ROOT), n_celdas))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
