#!/usr/bin/env python3
"""Genera `web/src/styles/tokens.css` a partir de `design_system/style_guide.yaml`.

El problema que resuelve
------------------------
El sistema de diseno vive en un YAML que ningun programa lee. Si el frontend
copia los colores a mano, el YAML y la web se desincronizan en cuanto alguien
retoca uno de los dos, y nadie se entera hasta que un grafico sale de otro color.
Este script convierte el YAML en variables CSS, que es lo unico que el navegador
entiende, y deja el YAML como unica fuente de verdad.

Por que el CSS generado se commitea
-----------------------------------
`design_system/` es privado (no se publica en GitHub). Si el CSS no estuviera
versionado, el repositorio publico no compilaria. Asi que el resultado se
commitea a proposito: el YAML es la fuente, el CSS es el artefacto publicable.

Las excepciones de accesibilidad
--------------------------------
Varios colores del YAML no llegan a WCAG AA cuando se usan como texto (el oro
sobre champan da 2.52:1, y hace falta 4.5:1). No se corrigen en el YAML porque
ahi siguen siendo validos como color de borde o de relleno: lo que falla es
usarlos como texto. `A11Y_OVERRIDES` anade variantes legibles sin tocar el
original, y el motivo queda escrito en el CSS generado.

Uso
---
    python scripts/build_design_tokens.py            # escribe el CSS
    python scripts/build_design_tokens.py --check    # sale 1 si esta desfasado

El modo `--check` sirve para un hook de pre-commit o para CI: convierte
"los tokens estan al dia" en algo que se comprueba, no que se supone.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
YAML_PATH = ROOT / "_lab" / "design_system" / "style_guide.yaml"
CSS_PATH = ROOT / "web" / "src" / "styles" / "tokens.css"

# Nombre del tema en el YAML -> selector CSS que lo activa.
THEME_SELECTORS = {
    "light_editorial_champan": ":root,\n[data-theme='light']",
    "dark_vino_satinado": "[data-theme='dark']",
    "ultra_dark_borgona": "[data-theme='ultra']",
}

THEME_SCHEME = {
    "light_editorial_champan": "light",
    "dark_vino_satinado": "dark",
    "ultra_dark_borgona": "dark",
}

# Clave del YAML -> nombre de la variable CSS.
COLOR_MAP = {
    "background": "--bg",
    "surface": "--surface",
    "surface_elevated": "--surface-elevated",
    "surface_border": "--surface-border",
    "text_primary": "--text-primary",
    "text_secondary": "--text-secondary",
    "text_muted": "--text-muted",
    "accent_primary": "--accent-primary",
    "accent_secondary": "--accent-secondary",
    "accent_tertiary": "--accent-tertiary",
    "accent_glow": "--accent-glow",
    "chart_bg": "--chart-bg",
}

# Correcciones de contraste, con su ratio medido para que nadie las revierta
# por parecer arbitrarias. Ver `scripts/check_contrast.py`.
A11Y_OVERRIDES = {
    "light_editorial_champan": {
        "--text-muted": ("#7a555c", "el original #8C686F daba 4.24:1 sobre el fondo"),
        "--accent-secondary-text": ("#856823", "variante legible del oro; el original da 2.52:1"),
        "--status-info": ("#0369a1", "el original #0284C7 daba 3.58:1 sobre el fondo"),
    },
    "dark_vino_satinado": {
        "--accent-secondary-text": ("#d97b92", "variante legible del borgonia; el original da 1.78:1"),
        "--accent-tertiary": ("#00b4c8", "el original #008D9E daba 4.05:1 sobre surface"),
        "--status-info": ("#38bdf8", "azul claro legible sobre fondo vino"),
    },
    "ultra_dark_borgona": {
        "--accent-secondary-text": ("#d97b92", "variante legible del borgonia"),
        "--accent-tertiary": ("#00a5b8", "el original #004048 daba 1.59:1, ilegible"),
        "--status-info": ("#38bdf8", "azul claro legible sobre fondo negro-vino"),
    },
}

# Semaforo cientifico. El YAML define el valor claro; el oscuro va en su
# descripcion en prosa, asi que se fija aqui de forma explicita.
SEMANTIC = {
    "light_editorial_champan": {
        "--status-pure": "#15803d",
        "--status-incipient": "#b45309",
        "--status-amorphous": "#b91c1c",
        "--status-info": "#0284c7",
    },
    "dark_vino_satinado": {
        "--status-pure": "#2ed573",
        "--status-incipient": "#e5d694",
        "--status-amorphous": "#ff5252",
        "--status-info": "#0284c7",
    },
    "ultra_dark_borgona": {
        "--status-pure": "#2ed573",
        "--status-incipient": "#e1d28c",
        "--status-amorphous": "#ff5252",
        "--status-info": "#0284c7",
    },
}

HEADER = """/* ==========================================================================
   tokens.css — Design tokens de ALCheMy
   GENERADO por scripts/build_design_tokens.py desde design_system/style_guide.yaml
   No editar a mano: edita el YAML y vuelve a generar.

   Se commitea el resultado a proposito, para que el repositorio publico compile
   sin necesitar design_system/, que es privado.

   Los valores anotados "fix a11y" se apartan del YAML porque el original no
   llegaba a WCAG AA como color de texto. En el YAML siguen siendo validos como
   borde o relleno; lo que falla es usarlos para texto.
   ========================================================================== */
"""

STATIC_BLOCK = """
/* --------------------------------------------------------------------------
   Tokens que no dependen del tema
   -------------------------------------------------------------------------- */
:root {
  --font-display: 'Poiret One', 'Marcellus', serif;
  --font-heading: 'Marcellus', serif;
  --font-body: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  --radius-card: 8px;
  --radius-button: 6px;
  --radius-badge: 4px;
  --border-card: 2.5px;
  --border-button: 2.5px;
  --border-badge: 1.5px;
  --shadow-card: 6px 6px 0px var(--accent-primary);
  --shadow-button: 4px 4px 0px var(--text-primary);

  --space-section: clamp(3rem, 8vw, 6rem);
  --content-max: 1200px;
}
"""


def render(guide: dict) -> str:
    out = [HEADER]
    themes = guide.get("themes", {})

    for theme_key, selector in THEME_SELECTORS.items():
        theme = themes.get(theme_key)
        if theme is None:
            print(f"  aviso: el YAML no define el tema {theme_key}, se omite", file=sys.stderr)
            continue

        overrides = A11Y_OVERRIDES.get(theme_key, {})
        lines = [f"\n{selector} {{"]

        for yaml_key, css_var in COLOR_MAP.items():
            value = theme.get(yaml_key)
            if value is None:
                continue
            if css_var in overrides:
                fixed, why = overrides[css_var]
                lines.append(f"  {css_var}: {fixed}; /* fix a11y: {why} */")
            else:
                lines.append(f"  {css_var}: {value};")

        # Variantes de texto que no existen en el YAML.
        for css_var, (fixed, why) in overrides.items():
            if css_var not in COLOR_MAP.values() and css_var not in SEMANTIC[theme_key]:
                lines.append(f"  {css_var}: {fixed}; /* fix a11y: {why} */")

        for css_var, value in SEMANTIC[theme_key].items():
            if css_var in overrides:
                fixed, why = overrides[css_var]
                lines.append(f"  {css_var}: {fixed}; /* fix a11y: {why} */")
            else:
                lines.append(f"  {css_var}: {value};")

        stars = theme.get("star_colors") or []
        for i, star in enumerate(stars[:3], start=1):
            lines.append(f"  --star-{i}: {star};")

        lines.append(f"  color-scheme: {THEME_SCHEME[theme_key]};")
        lines.append("}")
        out.append("\n".join(lines))

    out.append(STATIC_BLOCK)
    return "\n".join(out).rstrip() + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="no escribe nada; sale con codigo 1 si el CSS no coincide con el YAML",
    )
    args = parser.parse_args()

    if not YAML_PATH.exists():
        print(f"ERROR: no encuentro {YAML_PATH}", file=sys.stderr)
        print("design_system/ es privado; este script solo corre en el checkout completo.", file=sys.stderr)
        return 2

    guide = yaml.safe_load(YAML_PATH.read_text(encoding="utf-8"))
    css = render(guide)

    if args.check:
        current = CSS_PATH.read_text(encoding="utf-8") if CSS_PATH.exists() else ""
        if current == css:
            print("tokens.css al dia con style_guide.yaml -> OK")
            return 0
        print("tokens.css DESFASADO respecto a style_guide.yaml", file=sys.stderr)
        print("ejecuta: python scripts/build_design_tokens.py", file=sys.stderr)
        return 1

    CSS_PATH.parent.mkdir(parents=True, exist_ok=True)
    CSS_PATH.write_text(css, encoding="utf-8")
    n_themes = sum(1 for k in THEME_SELECTORS if k in guide.get("themes", {}))
    print(f"escrito {CSS_PATH.relative_to(ROOT)} ({n_themes} temas)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
