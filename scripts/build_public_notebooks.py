#!/usr/bin/env python3
"""Convierte los cuadernos en paginas HTML publicables, saneando lo sensible.

Que problema resuelve
---------------------
Los cuadernos son el rastro de razonamiento del proyecto y son lo que de verdad
demuestra como se trabajo. Pero no se pueden publicar tal cual, por dos motivos
que conviene no confundir:

1. **El codigo es inofensivo; los outputs no.** Un `.ipynb` guarda lo que
   imprimio cada celda. Ahi acaban `head()` de dataframes con codigos de muestra
   reales, nombres de ligando en las leyendas, y rutas del disco local en los
   mensajes de error. Sin el data lake, el codigo no tiene nada que leer — pero
   los resultados ya estan escritos dentro del fichero.

2. **Servir el `.ipynb` es servir el fichero.** Un visor tipo nbviewer entrega
   el cuaderno; una pagina HTML estatica, no. Por eso se genera HTML.

Y una regla que es la mas importante de todas:

    **Este script NUNCA ejecuta los cuadernos.**

Varios escriben en PostgreSQL. Reejecutarlos para producir una copia limpia
podria insertar filas duplicadas o borrar en cascada. Se transforma el `.ipynb`
ya ejecutado, en memoria, sin tocar el original en disco.

Que sanea
---------
- **Codigos de muestra** (`RS1883`, `LP26`, `RSMix17`, `IEF-8`) -> `SMP-0001`...
  El mapeo es secuencial sobre el conjunto ordenado de codigos encontrados en
  todo el corpus, no un hash: un hash de un espacio de codigos tan pequeno se
  invierte por fuerza bruta en segundos, y entonces el seudonimo no protege nada.
- **Ligandos no publicados** -> `LIG-A`, `LIG-B`... El metal se deja visible, que
  no es secreto industrial.
- **Rutas absolutas** del disco local -> ruta relativa al repositorio.
- **Correos electronicos** -> `nombre@dominio-oculto`.

Lo que NO puede sanear, y hay que auditar a mano
------------------------------------------------
**Las figuras.** Un grafico va incrustado como PNG en base64: si su titulo dice
`RS1883`, eso son pixeles, y ninguna expresion regular los alcanza. El modo
`--report` cuenta cuantas imagenes lleva cada cuaderno para que la revision
humana sepa donde mirar, y `--strip-images` permite publicar sin ellas si hiciera
falta. No se activa por defecto porque las figuras son justo lo que hace
didactico un cuaderno.

Uso
---
    python scripts/build_public_notebooks.py --report   # que hay, sin escribir
    python scripts/build_public_notebooks.py            # genera docs/notebooks/
    python scripts/build_public_notebooks.py --strip-images
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# Los .ipynb crudos viven en _lab/ porque llevan dentro codigos de muestra
# y ligandos sin publicar. Lo que se publica es la salida de este script.
NB_DIR = ROOT / "_lab" / "notebooks"
# Se escriben dentro de web/public/ y no en docs/, para que la propia aplicacion
# los sirva y pueda enlazarlos. Tenerlos en los dos sitios seria duplicar 6 MB
# que se desincronizarian a la primera regeneracion.
OUT_DIR = ROOT / "web" / "public" / "notebooks"

# Codigos de muestra, tal como los reconoce el resto del proyecto
# (mismo patron que usa el parser de caracterizacion).
RE_SAMPLE = re.compile(r"\b(?:RSMix\d+|RSMIX\d+|RS\d+|LP\d+|IEF-\d+)\b")

# Ligandos no publicados presentes en el historico. El metal no se toca.
LIGANDS = ["H6ttbmp", "Et6ttbmp", "H8ptp", "Et8ptp"]
RE_LIGAND = re.compile("|".join(re.escape(l) for l in sorted(LIGANDS, key=len, reverse=True)), re.I)

RE_ABSPATH = re.compile(r"[A-Za-z]:\\\\?(?:[^\\\s\"']+\\\\?)*|/(?:home|Users)/[^\s\"':]+")
RE_EMAIL = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.]+\b")

THEME_CSS = """
/* Tema ALCheMy para los cuadernos publicados. Deliberadamente ligero: sobrescribe
   color y tipografia, y deja intacta la maquetacion que genera nbconvert. */
:root {
  --nb-bg: #f5efe4;
  --nb-surface: #fcfaf6;
  --nb-ink: #3b0b15;
  --nb-soft: #57333b;
  --nb-line: rgba(180, 140, 120, 0.55);
  --nb-accent: #85253c;
}
body { background: var(--nb-bg) !important; color: var(--nb-ink) !important;
       font-family: Inter, system-ui, sans-serif !important; }
#notebook, .jp-Notebook { background: transparent !important; }
h1, h2, h3, h4 { font-family: Marcellus, Georgia, serif !important; color: var(--nb-ink) !important; }
a { color: var(--nb-accent) !important; }
div.input_area, .jp-InputArea-editor, pre, code {
  font-family: 'JetBrains Mono', Consolas, monospace !important;
}
div.input_area, .jp-InputArea-editor {
  background: var(--nb-surface) !important;
  border: 2px solid var(--nb-line) !important; border-radius: 8px !important;
}
table { border-collapse: collapse !important; }
table th, table td { border: 1px solid var(--nb-line) !important; padding: 6px 10px !important; }
img { max-width: 100%; height: auto; }
.alchemy-banner {
  background: var(--nb-surface); border: 2.5px solid var(--nb-accent); border-radius: 8px;
  padding: 16px 20px; margin: 0 0 28px 0; font-size: 14px; color: var(--nb-soft);
  box-shadow: 6px 6px 0 var(--nb-accent);
}
.alchemy-banner strong { color: var(--nb-ink); }
"""

BANNER = """<div class="alchemy-banner">
<strong>Published copy.</strong> Sample identifiers and unpublished ligand names in this notebook have
been replaced by pseudonyms, and local file paths removed. Metal centres are shown unchanged &mdash;
they carry no trade secret. This page is a static, read-only render: the notebook file itself is not
served, and none of the code here was re-executed to produce it.
</div>
"""


class Sanitizer:
    """Mapea codigos y ligandos a seudonimos estables dentro de una ejecucion."""

    def __init__(self):
        self.samples: dict[str, str] = {}
        self.ligands: dict[str, str] = {}
        self.counts = {"sample": 0, "ligand": 0, "path": 0, "email": 0}

    def collect(self, text: str):
        for m in RE_SAMPLE.findall(text):
            self.samples.setdefault(m, "")
        for m in RE_LIGAND.findall(text):
            self.ligands.setdefault(m.lower(), "")

    def freeze(self):
        """Asigna los seudonimos una vez visto todo el corpus, en orden estable."""
        for i, code in enumerate(sorted(self.samples), start=1):
            self.samples[code] = "SMP-%04d" % i
        for i, lig in enumerate(sorted(self.ligands), start=1):
            self.ligands[lig] = "LIG-%s" % chr(ord("A") + i - 1)

    def apply(self, text: str) -> str:
        def sub_sample(m):
            self.counts["sample"] += 1
            return self.samples.get(m.group(0), "SMP-????")

        def sub_ligand(m):
            self.counts["ligand"] += 1
            return self.ligands.get(m.group(0).lower(), "LIG-?")

        def sub_path(m):
            self.counts["path"] += 1
            return "<path omitted>"

        def sub_email(m):
            self.counts["email"] += 1
            return "researcher@hidden"

        text = RE_SAMPLE.sub(sub_sample, text)
        text = RE_LIGAND.sub(sub_ligand, text)
        text = RE_ABSPATH.sub(sub_path, text)
        text = RE_EMAIL.sub(sub_email, text)
        return text


def walk_strings(cell: dict, fn):
    """Aplica fn a todo texto de una celda: fuente y salidas."""
    if "source" in cell:
        cell["source"] = [fn(s) for s in cell["source"]] if isinstance(cell["source"], list) else fn(cell["source"])
    for out in cell.get("outputs", []):
        for key in ("text",):
            if key in out:
                out[key] = [fn(s) for s in out[key]] if isinstance(out[key], list) else fn(out[key])
        data = out.get("data", {})
        for mime in ("text/plain", "text/html", "text/markdown"):
            if mime in data:
                v = data[mime]
                data[mime] = [fn(s) for s in v] if isinstance(v, list) else fn(v)
        if "traceback" in out:
            out["traceback"] = [fn(s) for s in out["traceback"]]


def count_images(nb: dict) -> int:
    n = 0
    for cell in nb.get("cells", []):
        for out in cell.get("outputs", []):
            for mime in out.get("data", {}):
                if mime.startswith("image/"):
                    n += 1
    return n


def strip_images(nb: dict) -> int:
    n = 0
    for cell in nb.get("cells", []):
        for out in cell.get("outputs", []):
            data = out.get("data", {})
            for mime in [m for m in data if m.startswith("image/")]:
                del data[mime]
                n += 1
    return n


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--report", action="store_true", help="informa de lo que hay, sin escribir nada")
    ap.add_argument("--strip-images", action="store_true", help="publica sin figuras")
    args = ap.parse_args()

    notebooks = sorted(NB_DIR.glob("*.ipynb"))
    if not notebooks:
        print("ERROR: no hay cuadernos en %s" % NB_DIR, file=sys.stderr)
        return 2

    raw = {p: json.loads(p.read_text(encoding="utf-8")) for p in notebooks}

    # Primera pasada: recoger todo el vocabulario sensible del corpus entero,
    # para que el mismo codigo reciba el mismo seudonimo en todos los cuadernos.
    san = Sanitizer()
    for nb in raw.values():
        for cell in nb.get("cells", []):
            walk_strings(cell, lambda s: (san.collect(s), s)[1])
    san.freeze()

    print("Corpus: %d cuadernos" % len(notebooks))
    print("  codigos de muestra distintos : %d" % len(san.samples))
    print("  ligandos distintos           : %d" % len(san.ligands))
    print()
    print("%-62s %7s %7s" % ("cuaderno", "celdas", "figuras"))
    print("-" * 80)
    total_img = 0
    for p, nb in raw.items():
        n_img = count_images(nb)
        total_img += n_img
        print("%-62s %7d %7d" % (p.name, len(nb.get("cells", [])), n_img))
    print("-" * 80)
    print("%-62s %7s %7d" % ("TOTAL", "", total_img))

    if args.report:
        print()
        print("Las %d figuras NO se sanean: su texto son pixeles." % total_img)
        print("Revisar a mano titulos y leyendas antes de publicar.")
        return 0

    try:
        from nbconvert import HTMLExporter
    except ImportError:
        print("ERROR: falta nbconvert (pip install nbconvert)", file=sys.stderr)
        return 2
    import nbformat

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    exporter = HTMLExporter(template_name="classic")
    exporter.exclude_input_prompt = True
    exporter.exclude_output_prompt = True

    written = []
    for p, nb in raw.items():
        for cell in nb.get("cells", []):
            walk_strings(cell, san.apply)
        if args.strip_images:
            strip_images(nb)

        node = nbformat.reads(json.dumps(nb), as_version=4)
        body, _ = exporter.from_notebook_node(node)
        body = body.replace("</head>", "<style>%s</style></head>" % THEME_CSS)
        body = re.sub(r"(<body[^>]*>)", r"\1" + BANNER, body, count=1)

        out = OUT_DIR / (p.stem + ".html")
        out.write_text(body, encoding="utf-8")
        written.append((out, len(body)))

    print()
    for out, size in written:
        print("escrito %-58s %8.1f KB" % (out.relative_to(ROOT), size / 1024))
    print()
    print("Sustituciones: %d codigos de muestra, %d ligandos, %d rutas, %d correos."
          % (san.counts["sample"], san.counts["ligand"], san.counts["path"], san.counts["email"]))
    if not args.strip_images and total_img:
        print("AVISO: %d figuras publicadas sin sanear. Revisar sus titulos a mano." % total_img)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
