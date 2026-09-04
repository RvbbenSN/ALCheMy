#!/usr/bin/env python3
"""Extrae los assets de logo publicables desde `design_system/assets/logo/`.

Que problema resuelve
---------------------
El logo original es un **lockup vertical**: el isotipo (un cristal con una orbita
y digitos binarios) arriba, y la palabra "ALCheMy" debajo. Eso funciona en una
portada, pero no en una barra de navegacion horizontal de 48 px de alto, donde
un lockup vertical o se ve diminuto o desplaza toda la barra.

Ademas el color esta quemado dentro del SVG, y hay dos ficheros —uno borgonia y
uno champan— que hay que elegir a mano segun el tema. Con tres temas eso son
tres decisiones que el CSS ya sabe tomar solo.

Que genera
----------
- `web/public/logo-mark.svg`    — solo el isotipo, recortado a su caja, cuadrado
- `web/public/logo-lockup.svg`  — el lockup completo, para pie de pagina y portada

Ambos con `fill="currentColor"`, asi que **heredan el color del texto** que los
rodea y cambian solos con el tema. Un fichero en vez de seis.

Nota sobre los nombres del original, que despistan: `logo_alchemy_light.svg` es
el **champan** (para fondo oscuro) y `logo_alchemy_dark.svg` es el **borgonia**
(para fondo claro). Se toma el borgonia como fuente porque la geometria es
identica en ambos y el color se descarta de todos modos.

Uso
---
    python scripts/build_logo_assets.py
    python scripts/build_logo_assets.py --check
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "_lab" / "design_system" / "assets" / "logo" / "logo_alchemy_dark.svg"
OUT_MARK = ROOT / "web" / "public" / "logo-mark.svg"
OUT_LOCKUP = ROOT / "web" / "public" / "logo-lockup.svg"

# El lockup separa limpiamente por la coordenada Y: el isotipo vive por encima
# de y=130 y la palabra por debajo. Se parte ahi en vez de por indice de path,
# para que siga funcionando si el diseno se reexporta con otro orden.
Y_SPLIT = 130.0
PAD = 6.0  # margen alrededor del isotipo recortado, en unidades del viewBox


def path_bbox(d: str):
    nums = [float(x) for x in re.findall(r"-?\d+\.?\d*", d)]
    xs, ys = nums[0::2], nums[1::2]
    if not xs or not ys:
        return None
    return min(xs), max(xs), min(ys), max(ys)


def build(svg_text: str):
    paths = re.findall(r'<path\s+d="([^"]+)"', svg_text)
    if not paths:
        raise ValueError("no he encontrado ningun <path> en el SVG de origen")

    mark, word = [], []
    for d in paths:
        bb = path_bbox(d)
        if bb is None:
            continue
        (mark if bb[3] < Y_SPLIT else word).append((d, bb))

    if not mark or not word:
        raise ValueError(
            "el corte en y=%s no separa isotipo y texto (isotipo=%d, texto=%d). "
            "El logo se ha reexportado con otra geometria: revisar Y_SPLIT."
            % (Y_SPLIT, len(mark), len(word))
        )

    # --- isotipo recortado a su propia caja, dejandolo cuadrado ---
    x0 = min(b[0] for _, b in mark) - PAD
    x1 = max(b[1] for _, b in mark) + PAD
    y0 = min(b[2] for _, b in mark) - PAD
    y1 = max(b[3] for _, b in mark) + PAD
    w, h = x1 - x0, y1 - y0
    side = max(w, h)
    x0 -= (side - w) / 2
    y0 -= (side - h) / 2

    mark_svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="%.2f %.2f %.2f %.2f" '
        'fill="currentColor" role="img" aria-label="ALCheMy">\n' % (x0, y0, side, side)
        + "\n".join('  <path d="%s"/>' % d for d, _ in mark)
        + "\n</svg>\n"
    )

    # --- lockup completo, viewBox original ---
    vb = re.search(r'viewBox="([^"]+)"', svg_text)
    viewbox = vb.group(1) if vb else "0 0 363.293 198.235"
    lockup_svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s" '
        'fill="currentColor" role="img" aria-label="ALCheMy">\n' % viewbox
        + "\n".join('  <path d="%s"/>' % d for d in paths)
        + "\n</svg>\n"
    )

    return mark_svg, lockup_svg, len(mark), len(word)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--check", action="store_true",
                    help="no escribe; sale 1 si los assets no coinciden con el origen")
    args = ap.parse_args()

    if not SRC.exists():
        print("ERROR: no encuentro %s" % SRC, file=sys.stderr)
        print("design_system/ es privado; este script solo corre en el checkout completo.",
              file=sys.stderr)
        return 2

    mark_svg, lockup_svg, n_mark, n_word = build(SRC.read_text(encoding="utf-8"))

    if args.check:
        ok = (OUT_MARK.exists() and OUT_MARK.read_text(encoding="utf-8") == mark_svg
              and OUT_LOCKUP.exists() and OUT_LOCKUP.read_text(encoding="utf-8") == lockup_svg)
        if ok:
            print("assets de logo al dia -> OK")
            return 0
        print("assets de logo DESFASADOS; ejecuta: python scripts/build_logo_assets.py",
              file=sys.stderr)
        return 1

    OUT_MARK.parent.mkdir(parents=True, exist_ok=True)
    OUT_MARK.write_text(mark_svg, encoding="utf-8")
    OUT_LOCKUP.write_text(lockup_svg, encoding="utf-8")
    print("escrito %s (isotipo, %d paths)" % (OUT_MARK.relative_to(ROOT), n_mark))
    print("escrito %s (lockup, %d paths)" % (OUT_LOCKUP.relative_to(ROOT), n_mark + n_word))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
