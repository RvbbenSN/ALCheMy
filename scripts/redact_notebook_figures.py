#!/usr/bin/env python3
"""Tapa los codigos de muestra que aparecen DENTRO de las figuras extraidas.

Por que hace falta un paso aparte
---------------------------------
`build_public_notebooks.py` sanea texto, y eso cubre el codigo y las salidas de
texto de un cuaderno. Pero el titulo de un grafico no es texto: son pixeles de
un PNG, y ninguna expresion regular lo alcanza. Este script cubre esa grieta.

Como lo hace, y por que asi
---------------------------
Pinta un rectangulo del color del fondo sobre la region que contiene el codigo y
vuelve a escribir el rotulo con el nombre saneado. No se recorta la figura,
porque perder el titulo deja al lector sin saber que esta mirando; y no se
regenera desde el cuaderno, porque eso obligaria a ejecutarlo.

Las cajas van escritas a mano, una por figura, tras mirar cada imagen. No hay
forma automatica fiable de localizar el texto en un PNG sin OCR, y un OCR que
falle en silencio seria peor que no tener nada: dejaria pasar la fuga creyendo
que la ha tapado.

Es idempotente: volver a ejecutarlo sobre una figura ya redactada la deja igual.

Uso
---
    python scripts/redact_notebook_figures.py
    python scripts/redact_notebook_figures.py --check   # sale 1 si falta alguna
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
FIG_DIR = ROOT / "web" / "public" / "figures"

# (fichero, [(caja, texto_de_reemplazo, tamano, ancla_x)])
# caja = (x0, y0, x1, y1). ancla_x = centro horizontal del texto nuevo.
REDACTIONS = {
    "nb05-02.png": [
        ((0, 0, 1417, 38), "The same sample measured twice: 32.9x more counts, identical phase", 17, 708),
    ],
    "nb05-07.png": [
        ((0, 0, 1692, 36), "A mostly amorphous sample: effect of the arPLS stiffness parameter on the recovered halo", 16, 846),
    ],
    "nb05-15.png": [
        ((0, 0, 1527, 30), "Crystalline sample:  19 peaks at 3 sigma, 19 at 5.2 sigma", 14, 400),
        ((0, 0, 1527, 30), "Amorphous sample:  8 peaks at 3 sigma, 1 at 5.2 sigma", 14, 1150),
    ],
    "nb05-17.png": [
        ((698, 62, 902, 96), "[SMP-069]", 15, 800),
    ],
}


def load_font(size: int):
    """DejaVuSans viene con matplotlib; es la que uso el propio grafico."""
    for candidate in (
        Path(sys.prefix) / "Lib/site-packages/matplotlib/mpl-data/fonts/ttf/DejaVuSans.ttf",
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        Path("C:/Windows/Fonts/segoeui.ttf"),
    ):
        if candidate.exists():
            try:
                return ImageFont.truetype(str(candidate), size)
            except OSError:
                pass
    return ImageFont.load_default()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true",
                    help="no escribe; sale 1 si falta alguna figura por redactar")
    args = ap.parse_args()

    missing = [f for f in REDACTIONS if not (FIG_DIR / f).exists()]
    if missing:
        print("ERROR: faltan figuras: %s" % ", ".join(missing), file=sys.stderr)
        print("Ejecuta antes scripts/extract_notebook_figures.py", file=sys.stderr)
        return 2

    if args.check:
        print("%d figuras con redaccion definida; todas presentes -> OK" % len(REDACTIONS))
        return 0

    for name, boxes in REDACTIONS.items():
        path = FIG_DIR / name
        im = Image.open(path).convert("RGB")
        draw = ImageDraw.Draw(im)

        # Color de fondo tomado de la esquina: matplotlib deja margen blanco,
        # pero se lee en vez de asumirlo por si la figura tiene otro estilo.
        bg = im.getpixel((2, 2))

        for (x0, y0, x1, y1), text, size, cx in boxes:
            draw.rectangle([x0, y0, x1, y1], fill=bg)

        for (x0, y0, x1, y1), text, size, cx in boxes:
            font = load_font(size)
            tw = draw.textlength(text, font=font)
            cy = (y0 + y1) / 2
            draw.text((cx - tw / 2, cy - size * 0.68), text, fill=(30, 30, 30), font=font)

        im.save(path, optimize=True)
        print("redactada %-14s  %d region(es)" % (name, len(boxes)))

    print()
    print("Recordatorio: la redaccion es por cajas escritas a mano. Si se")
    print("reexportan las figuras desde los cuadernos, hay que volver a mirarlas.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
