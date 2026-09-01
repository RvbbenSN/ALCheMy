#!/usr/bin/env python3
"""Extrae las figuras ya generadas dentro de los cuadernos, sin ejecutarlos.

Por que NO se ejecutan los cuadernos
------------------------------------
No hace falta: un `.ipynb` guarda la salida de cada celda, y las figuras estan
dentro del propio fichero como PNG en base64. Volver a ejecutar el cuaderno para
"regenerar" una imagen que ya existe seria correr un riesgo a cambio de nada:
varios de estos cuadernos escriben en PostgreSQL, y reejecutarlos podria
insertar filas duplicadas o borrar en cascada. Se leen, no se corren.

Que produce
-----------
- `web/public/figures/<cuaderno>-<n>.png`  las imagenes tal cual
- `web/public/figures/manifest.json`       indice con, para cada figura, el
  titulo de la seccion en la que aparece y las primeras lineas del texto que la
  precede, para poder elegirlas y rotularlas sin abrir el cuaderno

Privacidad
----------
Este script **no puede sanear las imagenes**: si el titulo de un grafico lleva
un codigo de muestra, eso son pixeles. El manifiesto marca con `needsReview`
toda figura cuyo texto circundante mencionaba un codigo o un ligando, para que
la revision humana sepa por donde empezar en vez de mirar las 31 a ciegas.

Uso
---
    python scripts/extract_notebook_figures.py
"""

from __future__ import annotations

import base64
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NB_DIR = ROOT / "notebooks"
OUT_DIR = ROOT / "web" / "public" / "figures"

RE_SAMPLE = re.compile(r"\b(?:RSMix\d+|RSMIX\d+|RS\d+|LP\d+|IEF-\d+)\b")
RE_LIGAND = re.compile(r"H6ttbmp|Et6ttbmp|H8ptp|Et8ptp", re.I)
RE_HEADING = re.compile(r"^#{1,4}\s+(.+)$", re.M)


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = []

    for nb_path in sorted(NB_DIR.glob("*.ipynb")):
        nb = json.loads(nb_path.read_text(encoding="utf-8"))
        stem = nb_path.stem.split("_")[0]  # "05", "06", ...
        heading = ""
        n = 0

        for cell in nb.get("cells", []):
            if cell["cell_type"] == "markdown":
                src = "".join(cell["source"])
                found = RE_HEADING.findall(src)
                if found:
                    heading = found[-1].strip()
                continue

            for out in cell.get("outputs", []):
                data = out.get("data", {})
                png = data.get("image/png")
                if not png:
                    continue
                n += 1
                raw = base64.b64decode(png if isinstance(png, str) else "".join(png))
                name = "nb%s-%02d.png" % (stem, n)
                (OUT_DIR / name).write_bytes(raw)

                # Contexto: el codigo de la celda que la produjo suele llevar el
                # titulo del grafico, que es lo que hace falta para rotularla.
                code = "".join(cell.get("source", []))
                titles = re.findall(r"set_title\(\s*[frb]*['\"]([^'\"]{3,90})", code)
                suptitles = re.findall(r"suptitle\(\s*[frb]*['\"]([^'\"]{3,90})", code)

                risky = bool(RE_SAMPLE.search(code) or RE_LIGAND.search(code))
                manifest.append(
                    {
                        "file": name,
                        "notebook": nb_path.stem,
                        "section": heading,
                        "titles": (suptitles + titles)[:4],
                        "bytes": len(raw),
                        "needsReview": risky,
                    }
                )

    (OUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, indent=1, ensure_ascii=False), encoding="utf-8"
    )

    print("%-14s %-9s %-8s %s" % ("fichero", "KB", "revisar", "seccion / titulo"))
    print("-" * 100)
    for m in manifest:
        label = m["titles"][0] if m["titles"] else m["section"]
        print("%-14s %-9.0f %-8s %s"
              % (m["file"], m["bytes"] / 1024, "SI" if m["needsReview"] else "", label[:60]))
    print("-" * 100)
    print("%d figuras extraidas -> %s" % (len(manifest), OUT_DIR.relative_to(ROOT)))
    print("%d marcadas para revision humana." % sum(1 for m in manifest if m["needsReview"]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
