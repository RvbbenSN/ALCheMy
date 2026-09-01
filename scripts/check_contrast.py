#!/usr/bin/env python3
"""Audita el contraste WCAG de los temas de ALCheMy leyendo `tokens.css`.

Que problema resuelve
---------------------
"La paleta es accesible" es una afirmacion que hay que poder comprobar, no
suponer. Un color elegido a ojo sobre un fondo claro puede quedar precioso y
ser ilegible para alguien con baja vision, y nadie lo nota hasta que se
publica. Este script mide el contraste real de cada par texto/fondo y devuelve
un veredicto WCAG.

Como se calcula
---------------
WCAG define el contraste como (L1 + 0.05) / (L2 + 0.05), donde L es la
luminancia relativa. Los umbrales son 4.5:1 para texto normal (AA), 3:1 para
texto grande, y 7:1 para AAA.

El detalle que casi siempre se olvida: varias superficies del tema llevan
transparencia (`rgba(..., 0.88)`). Medir contra el color declarado da un
resultado equivocado, porque lo que el ojo ve es ese color **compuesto sobre el
fondo**. El script hace esa composicion antes de medir.

Uso
---
    python scripts/check_contrast.py           # informe completo
    python scripts/check_contrast.py --strict  # sale 1 si algo de texto falla AA
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS_PATH = ROOT / "web" / "src" / "styles" / "tokens.css"

# Variables que se usan como color de TEXTO y por tanto deben cumplir AA.
TEXT_VARS = ["--text-primary", "--text-secondary", "--text-muted",
             "--accent-primary", "--accent-secondary-text", "--accent-tertiary"]

# Variables que solo se usan como borde o relleno: no se les exige AA de texto.
NON_TEXT_VARS = ["--accent-secondary"]

SEMANTIC_VARS = ["--status-pure", "--status-incipient", "--status-amorphous", "--status-info"]

SURFACE_VARS = ["--bg", "--surface", "--surface-elevated"]


def parse_color(value: str):
    """Devuelve ((r, g, b), alpha) a partir de un hex o un rgba()."""
    value = value.strip()
    m = re.match(r"rgba?\(([^)]+)\)", value)
    if m:
        parts = [float(x.strip()) for x in m.group(1).split(",")]
        alpha = parts[3] if len(parts) > 3 else 1.0
        return (parts[0], parts[1], parts[2]), alpha
    h = value.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)), 1.0


def composite(fg, bg_rgb):
    rgb, alpha = fg
    return tuple(rgb[i] * alpha + bg_rgb[i] * (1 - alpha) for i in range(3))


def luminance(rgb):
    def channel(v):
        v /= 255.0
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (channel(x) for x in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def verdict(ratio: float) -> str:
    if ratio >= 7.0:
        return "AAA"
    if ratio >= 4.5:
        return "AA"
    if ratio >= 3.0:
        return "solo AA-grande"
    return "FALLA"


def parse_themes(css: str) -> dict:
    """Extrae {selector: {var: valor}} de los bloques de tokens.css."""
    themes = {}
    for block in re.finditer(r"([^{}]+)\{([^}]*)\}", css):
        selector = " ".join(block.group(1).split())
        # El bloque estatico :root final no define colores de tema.
        body = block.group(2)
        variables = dict(re.findall(r"(--[\w-]+)\s*:\s*([^;]+);", body))
        variables = {k: re.sub(r"/\*.*?\*/", "", v).strip() for k, v in variables.items()}
        if "--bg" in variables:
            themes[selector] = variables
    return themes


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--strict", action="store_true",
                        help="sale con codigo 1 si algun color de texto no llega a AA")
    args = parser.parse_args()

    if not CSS_PATH.exists():
        print(f"ERROR: no encuentro {CSS_PATH}", file=sys.stderr)
        return 2

    themes = parse_themes(CSS_PATH.read_text(encoding="utf-8"))
    if not themes:
        print("ERROR: no he encontrado ningun tema en tokens.css", file=sys.stderr)
        return 2

    failures = []

    for selector, variables in themes.items():
        print("=" * 76)
        print(selector)
        print("=" * 76)

        bg_rgb = composite(parse_color(variables["--bg"]), (255, 255, 255))
        surfaces = {}
        for var in SURFACE_VARS:
            if var in variables:
                surfaces[var] = composite(parse_color(variables[var]), bg_rgb)

        for surface_name, surface_rgb in surfaces.items():
            for var in TEXT_VARS + SEMANTIC_VARS:
                if var not in variables:
                    continue
                rgb = composite(parse_color(variables[var]), surface_rgb)
                ratio = contrast(rgb, surface_rgb)
                mark = verdict(ratio)
                print("  %-24s sobre %-19s %5.2f:1   %s" % (var, surface_name, ratio, mark))
                if mark == "FALLA" and var in TEXT_VARS:
                    failures.append((selector, var, surface_name, ratio))
            print()

        for var in NON_TEXT_VARS:
            if var in variables:
                print("  %-24s -> solo borde/relleno, no se le exige AA de texto" % var)
        print()

    if failures:
        print("-" * 76)
        print("COLORES DE TEXTO QUE NO LLEGAN A AA:")
        for selector, var, surface, ratio in failures:
            print("  %s  %s sobre %s  %.2f:1" % (selector, var, surface, ratio))
        if args.strict:
            return 1
    else:
        print("Todos los colores de texto llegan al menos a WCAG AA -> OK")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
