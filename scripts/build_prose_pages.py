#!/usr/bin/env python3
"""Publica la prosa revisada de los cuadernos como paginas de lectura bilingues.

De donde sale
-------------
`export_notebook_prose.py` saca el texto saneado; un revisor externo lo pule y
lo traduce, y devuelve dos ficheros por cuaderno a `handoff/gemini_back/`. Este
script los convierte en HTML y los deja junto a los cuadernos completos, para
que la web pueda ofrecer la version inglesa y la espanola de cada uno.

Por que existe esta pagina si ya se publica el cuaderno entero
--------------------------------------------------------------
`build_public_notebooks.py` publica el `.ipynb` completo: codigo, salidas y
figuras, en el idioma en que se escribio, que en varios cuadernos es una mezcla.
Eso sirve para auditar el trabajo. Estas paginas sirven para **leerlo**: solo la
narrativa, pulida, en un idioma coherente de principio a fin. Son dos usos
distintos y conviven.

Las figuras
-----------
La prosa exportada deja una marca `> [FIGURA n de <cuaderno>]` donde habia una
imagen. Aqui se sustituye por la figura real, que ya esta publicada y --lo que
importa-- **ya paso por el saneado de `redact_notebook_figures.py`**. Si falta
una figura el script lo dice y deja el hueco visible; no publica un texto que
habla de una imagen que no esta.

Uso
---
    python scripts/build_prose_pages.py
    python scripts/build_prose_pages.py --check   # sale 1 si algo no cuadra
"""

from __future__ import annotations

import argparse
import html
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IN_DIR = ROOT / "_lab" / "handoff" / "gemini_back"
FIG_DIR = ROOT / "web" / "public" / "figures"
OUT_DIR = ROOT / "web" / "public" / "notebooks"

RE_FIGURA = re.compile(r"^>\s*\[FIGURA\s+(\d+)\s+de\s+(\S+)\]\s*$", re.M)

LANG = {
    "en": {"label": "English", "other": "Español", "code": "es"},
    "es": {"label": "Español", "other": "English", "code": "en"},
}

BANNER = {
    "en": ("<strong>Reading copy.</strong> This is the narrative of the notebook, edited for "
           "reading and translated — not the executable notebook, which is published separately "
           "with its code and outputs. Sample identifiers and unpublished ligand names are "
           "pseudonymised. Every figure below was produced by the notebook itself; none of the "
           "code was re-executed to build this page."),
    "es": ("<strong>Copia de lectura.</strong> Esta es la narrativa del cuaderno, editada para "
           "leerse y traducida — no el cuaderno ejecutable, que se publica aparte con su código y "
           "sus salidas. Los códigos de muestra y los ligandos sin publicar van seudonimizados. "
           "Todas las figuras las produjo el propio cuaderno; para construir esta página no se "
           "reejecutó nada."),
}

CSS = """
:root {
  --bg: #f5efe4; --surface: #fcfaf6; --ink: #3b0b15; --soft: #57333b;
  --line: rgba(180, 140, 120, 0.55); --accent: #85253c;
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--ink);
  font-family: Inter, system-ui, -apple-system, sans-serif;
  font-size: 16px; line-height: 1.65;
}
.wrap { max-width: 820px; margin: 0 auto; padding: 32px 20px 96px; }
h1, h2, h3, h4 { font-family: Marcellus, Georgia, serif; line-height: 1.25; margin: 2em 0 .6em; }
h1 { font-size: 2rem; margin-top: .4em; }
h2 { font-size: 1.5rem; border-bottom: 2px solid var(--line); padding-bottom: .3em; }
h3 { font-size: 1.2rem; }
p, li { color: var(--soft); }
a { color: var(--accent); }
code {
  font-family: 'JetBrains Mono', Consolas, monospace; font-size: .88em;
  background: var(--surface); border: 1px solid var(--line); border-radius: 4px; padding: 1px 5px;
}
pre {
  font-family: 'JetBrains Mono', Consolas, monospace; font-size: .85em;
  background: var(--surface); border: 2px solid var(--line); border-radius: 8px;
  padding: 14px 16px; overflow-x: auto;
}
pre code { background: none; border: 0; padding: 0; }
blockquote {
  margin: 1.4em 0; padding: .1em 1.1em; border-left: 4px solid var(--accent);
  background: var(--surface);
}
table { border-collapse: collapse; width: 100%; display: block; overflow-x: auto; margin: 1.4em 0; }
th, td { border: 1px solid var(--line); padding: 7px 11px; text-align: left; font-size: .92em; }
th { background: var(--surface); font-family: Marcellus, Georgia, serif; }
figure { margin: 2em 0; }
figure img {
  display: block; width: 100%; height: auto;
  background: #fff; border: 2px solid var(--line); border-radius: 8px;
}
figcaption { margin-top: .5em; font-size: .8rem; color: var(--soft); opacity: .85; }
.missing {
  border: 2px dashed var(--accent); border-radius: 8px; padding: 18px;
  color: var(--accent); font-size: .9rem;
}
.banner {
  background: var(--surface); border: 2.5px solid var(--accent); border-radius: 8px;
  padding: 16px 20px; margin: 0 0 28px; font-size: 14px; color: var(--soft);
  box-shadow: 6px 6px 0 var(--accent);
}
.banner strong { color: var(--ink); }
.langbar { display: flex; gap: 10px; align-items: center; margin: 0 0 22px; font-size: .85rem; }
.langbar a, .langbar span {
  text-decoration: none; border: 2px solid var(--line); border-radius: 6px;
  padding: 5px 11px; color: var(--soft); background: var(--surface);
}
.langbar .on { border-color: var(--accent); color: var(--ink); font-weight: 700; }
.langbar .back { margin-left: auto; border: 0; background: none; }
"""


def render(md_text: str, stem: str, lang: str, problemas: list) -> str:
    import mistune

    # Primero las figuras: se sustituye la marca por un marcador unico que
    # mistune no toque, y se reinyecta el HTML despues. Meter el <figure> antes
    # de convertir haria que el conversor lo escapara o lo envolviera en <p>.
    figuras = {}

    def marca(m):
        n = int(m.group(1))
        fichero = "nb%s-%02d.png" % (stem[:2], n)
        idx = "@@FIG%d@@" % n
        if (FIG_DIR / fichero).exists():
            cap = ("Figure %d, produced by notebook %s." % (n, stem[:2])) if lang == "en" \
                else ("Figura %d, generada por el cuaderno %s." % (n, stem[:2]))
            figuras[idx] = ('<figure><img src="/figures/%s" alt="%s" loading="lazy">'
                            '<figcaption>%s</figcaption></figure>' % (fichero, cap, cap))
        else:
            problemas.append("%s [%s]: falta la figura %s" % (stem, lang, fichero))
            figuras[idx] = ('<p class="missing">Figure %d is not published.</p>' % n)
        return "\n\n%s\n\n" % idx

    md_text = RE_FIGURA.sub(marca, md_text)
    cuerpo = mistune.create_markdown(plugins=["table", "strikethrough"])(md_text)
    for idx, bloque in figuras.items():
        cuerpo = cuerpo.replace("<p>%s</p>" % idx, bloque).replace(idx, bloque)
    return cuerpo


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--check", action="store_true", help="no escribe; sale 1 si algo falla")
    args = ap.parse_args()

    fuentes = sorted(IN_DIR.glob("*.??.md"))
    if not fuentes:
        print("no hay nada en %s" % IN_DIR, file=sys.stderr)
        return 1

    problemas, escritos = [], 0
    for f in fuentes:
        stem, lang = f.name.rsplit(".", 2)[0], f.name.rsplit(".", 2)[1]
        if lang not in LANG:
            problemas.append("idioma desconocido en %s" % f.name)
            continue

        md_text = f.read_text(encoding="utf-8")
        # La primera linea del export es un comentario HTML con el nombre del
        # cuaderno. mistune lo deja pasar tal cual y acaba VISIBLE en la pagina.
        md_text = re.sub(r"^\s*<!--.*?-->\s*", "", md_text, count=1, flags=re.S)
        n_figs = len(RE_FIGURA.findall(md_text))
        cuerpo = render(md_text, stem, lang, problemas)

        titulo = stem.replace("_", " ")
        otro = LANG[lang]["code"]
        volver = "Back to the site" if lang == "en" else "Volver al sitio"
        page = (
            "<!DOCTYPE html>\n<html lang=\"%s\"><head><meta charset=\"utf-8\">\n"
            "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
            "<title>%s</title>\n<style>%s</style></head><body><div class=\"wrap\">\n"
            "<div class=\"langbar\"><span class=\"on\">%s</span>"
            "<a href=\"./%s.%s.html\">%s</a>"
            "<a class=\"back\" href=\"/\">&larr; %s</a></div>\n"
            "<div class=\"banner\">%s</div>\n%s\n</div></body></html>\n"
            % (lang, html.escape(titulo), CSS, LANG[lang]["label"],
               stem, otro, LANG[lang]["other"], volver, BANNER[lang], cuerpo)
        )

        destino = OUT_DIR / ("%s.%s.html" % (stem, lang))
        if not args.check:
            OUT_DIR.mkdir(parents=True, exist_ok=True)
            destino.write_text(page, encoding="utf-8")
            escritos += 1
        print("%-58s %s  %2d figuras  %6.1f KB"
              % (stem[:58], lang, n_figs, len(page) / 1024))

    print("-" * 96)
    if problemas:
        print("PROBLEMAS (%d):" % len(problemas), file=sys.stderr)
        for p in problemas:
            print("   %s" % p, file=sys.stderr)
        return 1
    print("%d paginas %s, sin incidencias"
          % (escritos or len(fuentes), "comprobadas" if args.check else "escritas"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
