#!/usr/bin/env python3
"""Publica el notebook COMPLETO (codigo + salidas + figuras) en tres variantes.

Que problema resuelve
---------------------
Hasta ahora `build_public_notebooks.py` publicaba un unico HTML por cuaderno,
en el idioma mixto en que se escribio (sobre todo espanol, con jerga y
eyebrows en ingles), y por separado `export_notebook_prose.py` +
`build_prose_pages.py` publicaban una "version de lectura" en ingles y
espanol -- pero esa version de lectura **nunca lleva codigo**, por diseno.

Eso confundia: un lector que entraba por la bandera EN/ES nunca veia una
linea de codigo, aunque el punto de varios cuadernos (el 03 sobre todo, que
es casi todo codigo probando el webhook) es precisamente demostrar el
codigo funcionando. Este script sustituye esa version de lectura por el
**mismo notebook completo, con codigo, en cada idioma**:

- `<stem>.html`      -> el notebook tal cual se escribio (mixto, sin traducir).
                        Es lo que ya generaba `build_public_notebooks.py`; este
                        script no lo toca.
- `<stem>.es.html`   -> el mismo notebook completo. Como el original ya esta
                        mayoritariamente en espanol, es basicamente identico al
                        de arriba (normalizado el `%%` de escape de Python).
- `<stem>.en.html`   -> el mismo notebook completo, con las celdas MARKDOWN
                        traducidas al ingles celda por celda. Las celdas de
                        CODIGO y sus salidas se saneam igual que siempre, pero
                        no se traducen: el codigo Python/SQL no tiene idioma.

De donde salen las traducciones
--------------------------------
De `scripts/translations/nb<NN>_en.py`, un diccionario {indice_de_celda: texto}
escrito y revisado a mano, uno por notebook. Si un notebook no tiene fichero
de traduccion todavia, este script solo genera su `.html` y `.es.html` y avisa
que falta el ingles -- no rompe el resto.

Reutiliza el Sanitizer
-----------------------
Mismo saneador que `build_public_notebooks.py` (codigos de muestra, ligandos,
nombres de terceros, rutas, correos), importado en caliente para no duplicar
las expresiones regulares.

Uso
---
    python scripts/build_bilingual_full_notebooks.py
    python scripts/build_bilingual_full_notebooks.py --only 03
"""

from __future__ import annotations

import argparse
import copy
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NB_DIR = ROOT / "_lab" / "notebooks"
OUT_DIR = ROOT / "web" / "public" / "notebooks"
TRANS_DIR = ROOT / "scripts" / "translations"


def cargar_modulo_saneador():
    ruta = ROOT / "scripts" / "build_public_notebooks.py"
    spec = importlib.util.spec_from_file_location("build_public_notebooks", ruta)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def cargar_traduccion(stem: str) -> dict[int, str] | None:
    """Carga scripts/translations/nb<NN>_en.py si existe. NN son los 2 primeros
    caracteres del stem (el numero del notebook)."""
    numero = stem[:2]
    ruta = TRANS_DIR / f"nb{numero}_en.py"
    if not ruta.exists():
        return None
    spec = importlib.util.spec_from_file_location(f"nb{numero}_en", ruta)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.CELLS


def normaliza_escape_pct(texto: str) -> str:
    """`%%` es el escape de `%` en cadenas de formato de Python antiguo; en
    markdown solo se ve raro. Solo se toca en celdas markdown, nunca en codigo."""
    return texto.replace("%%", "%")


def construir_variante(nb_original: dict, traduccion: dict[int, str] | None) -> dict:
    """Copia profunda del notebook, sanea todo, y si hay traduccion sustituye
    el texto de las celdas markdown por su version en ingles."""
    nb = copy.deepcopy(nb_original)
    for i, cell in enumerate(nb.get("cells", [])):
        if cell.get("cell_type") == "markdown":
            if traduccion is not None and i in traduccion:
                cell["source"] = [traduccion[i]]
            elif traduccion is None:
                # Variante ES: mismo texto, solo normalizado.
                src = cell.get("source", [])
                texto = "".join(src) if isinstance(src, list) else src
                cell["source"] = [normaliza_escape_pct(texto)]
    # El saneado (codigos de muestra, ligandos, nombres, rutas, correos) se
    # aplica fuera de esta funcion, sobre el resultado, para que cubra tanto
    # las celdas recien traducidas como las de codigo/salidas sin tocar.
    return nb


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", help="solo procesar el notebook cuyo nombre empieza por este prefijo, p.ej. 03")
    args = ap.parse_args()

    mod = cargar_modulo_saneador()

    notebooks = sorted(NB_DIR.glob("*.ipynb"))
    if args.only:
        notebooks = [p for p in notebooks if p.stem.startswith(args.only)]
    if not notebooks:
        print("ERROR: no hay cuadernos que coincidan", file=sys.stderr)
        return 2

    try:
        from nbconvert import HTMLExporter
        import nbformat
    except ImportError:
        print("ERROR: falta nbconvert (pip install nbconvert)", file=sys.stderr)
        return 2

    # Sanitizer de corpus: se alimenta con TODOS los cuadernos del proyecto,
    # no solo los que se procesan aqui, para que un mismo codigo siga
    # significando lo mismo en todas partes.
    todos = sorted(NB_DIR.glob("*.ipynb"))
    san = mod.Sanitizer()
    for p in todos:
        nb = json.loads(p.read_text(encoding="utf-8"))
        for cell in nb.get("cells", []):
            mod.walk_strings(cell, lambda s: (san.collect(s), s)[1])
    san.freeze()

    exporter = HTMLExporter(template_name="classic")
    exporter.exclude_input_prompt = True
    exporter.exclude_output_prompt = True

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    faltan_traduccion = []

    for p in notebooks:
        nb_original = json.loads(p.read_text(encoding="utf-8"))
        traduccion = cargar_traduccion(p.stem)
        if traduccion is None:
            faltan_traduccion.append(p.stem)

        for lang, trad in (("es", None), ("en", traduccion)):
            if lang == "en" and trad is None:
                continue  # sin traduccion todavia: no se genera .en.html

            nb = construir_variante(nb_original, trad)
            for cell in nb.get("cells", []):
                mod.walk_strings(cell, san.apply)

            node = nbformat.reads(json.dumps(nb), as_version=4)
            body, _ = exporter.from_notebook_node(node)
            body = body.replace("</head>", "<style>%s</style></head>" % mod.THEME_CSS)
            body = __import__("re").sub(r"(<body[^>]*>)", r"\1" + mod.BANNER, body, count=1)

            out = OUT_DIR / f"{p.stem}.{lang}.html"
            out.write_text(body, encoding="utf-8")
            print("escrito %-70s %8.1f KB" % (out.relative_to(ROOT), len(body) / 1024))

    if faltan_traduccion:
        print()
        print("Sin traduccion al ingles todavia (solo se genero .es.html): %s"
              % ", ".join(faltan_traduccion))
        print("Anadir scripts/translations/nb<NN>_en.py para completarlos.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
