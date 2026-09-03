#!/usr/bin/env python3
"""Saca la PROSA de los cuadernos a Markdown, ya saneada, para revision externa.

Que problema resuelve
---------------------
Los cuadernos son el rastro de razonamiento del proyecto, y su texto es lo que
se quiere revisar, traducir o pulir. Pero un `.ipynb` no se puede mandar fuera:
lleva dentro codigos de muestra reales, nombres de ligando sin publicar, rutas
del disco local y correos, todos escritos en las salidas de las celdas. Y el
HTML publicable que genera `build_public_notebooks.py` si esta saneado, pero
pesa 6,6 MB porque lleva las 31 figuras incrustadas en base64: no cabe comodo en
la ventana de un modelo, y de todas formas nadie revisa un PNG leyendolo.

Este script se queda con el punto intermedio: **solo las celdas de texto**, ya
pasadas por el mismo saneado, en Markdown plano. Unos 100 KB en vez de 6,6 MB,
sin una sola linea de codigo ni una sola salida de celda.

Por que reutiliza el saneador en vez de escribir otro
----------------------------------------------------
`build_public_notebooks.py` ya sabe sustituir codigos, ligandos, rutas y
correos, y su mapeo de seudonimos es secuencial sobre todo el corpus. Escribir
aqui una segunda copia de esas expresiones regulares garantizaria que un dia
diverjan, y que la de este fichero fuese la que se quedara corta. Se importa la
suya.

Que NO sale
-----------
- Codigo. Ni una celda.
- Salidas de celda: tablas, trazas de error, `head()` de dataframes.
- Figuras. En su sitio queda una marca `[FIGURA n de <cuaderno>]`, para que
  quien lea el texto sepa que ahi habia una imagen y no pierda el hilo cuando
  el parrafo siguiente diga "como se ve arriba".

Uso
---
    python scripts/export_notebook_prose.py
    python scripts/export_notebook_prose.py --out handoff/prosa
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

NB_DIR = ROOT / "_lab" / "notebooks"
DEFAULT_OUT = ROOT / "_lab" / "handoff" / "notebook_prose"


def cargar_saneador():
    """Trae el saneador del script de publicacion, sin duplicar sus reglas."""
    import importlib.util

    ruta = ROOT / "scripts" / "build_public_notebooks.py"
    spec = importlib.util.spec_from_file_location("build_public_notebooks", ruta)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", default=str(DEFAULT_OUT),
                    help="carpeta de salida (por defecto handoff/notebook_prose)")
    args = ap.parse_args()

    mod = cargar_saneador()
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    cuadernos = sorted(NB_DIR.glob("*.ipynb"))
    if not cuadernos:
        print("no hay cuadernos en %s" % NB_DIR)
        return 1

    # El seudonimizador es de corpus: se alimenta con TODOS los cuadernos antes
    # de escribir ninguno, para que SMP-0001 signifique lo mismo en todos ellos.
    sanitizer = mod.Sanitizer()
    for nb in cuadernos:
        sanitizer.collect(nb.read_text(encoding="utf-8"))
    sanitizer.freeze()

    total_celdas = total_figuras = 0
    for nb in cuadernos:
        datos = json.loads(nb.read_text(encoding="utf-8"))
        trozos = ["<!-- %s -->" % nb.stem, ""]
        celdas = figuras = 0

        for celda in datos.get("cells", []):
            if celda.get("cell_type") == "markdown":
                texto = "".join(celda.get("source", []))
                trozos.append(sanitizer.apply(texto))
                trozos.append("")
                celdas += 1
            else:
                for salida in celda.get("outputs", []):
                    if any(k.startswith("image/") for k in (salida.get("data") or {})):
                        figuras += 1
                        trozos.append("> [FIGURA %d de %s]" % (figuras, nb.stem))
                        trozos.append("")

        destino = out_dir / (nb.stem + ".md")
        destino.write_text("\n".join(trozos), encoding="utf-8")
        kb = destino.stat().st_size / 1024
        print("%-64s %3d celdas  %2d figuras  %6.1f KB"
              % (destino.name, celdas, figuras, kb))
        total_celdas += celdas
        total_figuras += figuras

    print("-" * 100)
    print("%d cuaderno(s), %d celdas de texto, %d huecos de figura"
          % (len(cuadernos), total_celdas, total_figuras))
    print("escrito en %s" % out_dir)
    print("sustituciones: %d codigos de muestra, %d ligandos, %d rutas, %d correos"
          % (sanitizer.counts["sample"], sanitizer.counts["ligand"],
             sanitizer.counts["path"], sanitizer.counts["email"]))
    print()
    print("Sin codigo y sin salidas de celda. Revisar igualmente antes de subirlo")
    print("a ningun servicio externo: el saneado cubre patrones conocidos, no todo.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
