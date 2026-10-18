#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Impide que algo privado acabe en un commit. Se ejecuta antes de publicar.

Por que hace falta si ya esta .gitignore
----------------------------------------
`.gitignore` protege de lo que uno recuerda ignorar. No protege de:

  - un `git add -f`, que lo salta sin avisar;
  - un fichero publicable que CONTIENE algo privado dentro (un correo en un
    comentario, un codigo de muestra en un docstring, el nombre de un ligando
    sin publicar en un ejemplo);
  - una carpeta privada nueva a la que nadie le puso su linea.

Los tres han pasado ya en este proyecto. El volcado del esquema llevaba dentro
el correo personal del autor como valor por defecto de una columna, y la web
publicaba un codigo de muestra real en el texto de una pantalla. Ninguno de los
dos ficheros estaba gitignorado, porque ninguno de los dos debia estarlo: lo que
no debia estar era su contenido.

Que comprueba
-------------
1. Que no hay nada de `_lab/`, `data/`, `backups/` ni `.env` en el indice.
2. Que ningun fichero que SI se publica contiene un correo real, un codigo de
   muestra, un ligando sin publicar o una IP privada.

Uso
---
    python scripts/comprobar_privacidad.py            # todo lo publicable
    python scripts/comprobar_privacidad.py --staged   # solo lo que va a commit
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

CARPETAS_PROHIBIDAS = ("_lab/", "data/", "backups/", ".env")

PATRONES = [
    ("correo personal", re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")),
    ("codigo de muestra", re.compile(r"\b(RSMix\d+|RS\d{3,}|LP\d{2,}|IEF-\d+)\b")),
    ("ligando sin publicar", re.compile(r"\b(H8ptp|Et8ptp|H6ttbmp|Et6ttbmp)\b", re.I)),
    ("IP privada", re.compile(r"\b(?:192\.168|10\.\d+|172\.(?:1[6-9]|2\d|3[01]))\.\d+\.\d+\b")),
    ("credencial postgres", re.compile(r"postgres(?:ql)?://[^:\s]+:[^@\s]+@")),
]

# Lo que puede contener esos patrones con razon. Se lista a la vista, no se
# esconde dentro de una expresion: cada excepcion tiene que poder discutirse.
EXCEPCIONES = {
    # El propio comprobador lleva los patrones dentro.
    "scripts/comprobar_privacidad.py": "es este fichero",
    # Los saneadores necesitan nombrar lo que sanean.
    "scripts/build_public_notebooks.py": "define el saneado",
    "scripts/extract_notebook_figures.py": "define el saneado",
    "scripts/build_schema_sql.py": "define el saneado",
    "scripts/build_schema_map.py": "define el saneado",
    "scripts/redact_video.py": "documenta que tapa y por que",
    "scripts/export_notebook_prose.py": "documenta el saneado",
    "src/parse_adsorption_xls.py": "el regex que reconoce un codigo de muestra",
    "src/parse_ftir_csv.py": "idem",
    "src/parse_microscopy_image.py": "idem, y explica el fallo del contador",
    "src/parse_pxrd_xrdml.py": "idem",
    "src/parse_tga_txt.py": "idem",
    "src/parse_uvvis_asc.py": "idem",
    "src/parse_vtxrd_brml.py": "idem",
    "src/verify_webhook_pipeline.py": "nombra ficheros reales del data lake",
    "CLAUDE.md": "documenta el regex de los codigos de muestra",
    "src/README.md": "explica el fallo del contador del SEM, y los digitos SON la explicacion",
    # El correo de la 09 es el contacto del portfolio: esta puesto a proposito.
    "web/src/content/site.js": "el correo es el contacto publico del autor",
    # Clon generado del anterior para la version en espanol. Lo genera
    # web/scripts/generar_contenido_es.mjs clonando el modulo ingles, asi que
    # hereda el correo por construccion: la excepcion es la misma de arriba.
    "web/src/content/es/site.js": "clon generado de content/site.js, mismo motivo",
}

# Correos que no son de nadie de este proyecto. Se listan a la vista en vez de
# ampliar el patron, que es lo que convierte un comprobador en un colador.
CORREOS_AJENOS = {
    # nbconvert incrusta el CSS de highlight.js en cada cuaderno publicado, y
    # ese CSS lleva dentro el correo de su autor.
    "maniac@softwaremaniacs.org",
    # Dominios reservados por la RFC 2606 justamente para ejemplos.
}

BINARIOS = (".png", ".jpg", ".jpeg", ".pdf", ".mp4", ".mp3", ".ico", ".woff",
            ".woff2", ".ttf", ".eps", ".xlsx", ".xls", ".dump", ".svg")


def disculpado(que, hallazgo):
    """Coincidencias que no son una fuga: correos ajenos y marcadores de password."""
    if que == "correo personal":
        h = hallazgo.lower()
        return h in CORREOS_AJENOS or h.endswith((".example", "@example.org", "@example.com"))
    if que == "credencial postgres":
        h = hallazgo.lower()
        return "<password>" in h or "&lt;password&gt;" in h
    return False


def ficheros(solo_staged: bool):
    cmd = (["git", "diff", "--cached", "--name-only", "--diff-filter=ACM"]
           if solo_staged else ["git", "ls-files"])
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT))
    return [l for l in r.stdout.splitlines() if l.strip()]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--staged", action="store_true",
                    help="mira solo lo que esta preparado para el commit")
    args = ap.parse_args()

    lista = ficheros(args.staged)
    print("%d fichero(s) %s\n" % (len(lista), "en el indice" if args.staged else "publicables"))

    problemas = []

    print("1. Carpetas privadas")
    coladas = [f for f in lista if any(f.startswith(c) for c in CARPETAS_PROHIBIDAS)]
    if coladas:
        for f in coladas:
            print("   [FUGA] %s" % f)
        problemas += coladas
    else:
        print("   [ok]   nada de %s" % ", ".join(CARPETAS_PROHIBIDAS))

    print("\n2. Contenido privado dentro de ficheros publicables")
    revisados = 0
    for f in lista:
        if f.endswith(BINARIOS) or f in EXCEPCIONES:
            continue
        p = ROOT / f
        if not p.exists():
            continue
        try:
            texto = p.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        revisados += 1
        for que, patron in PATRONES:
            m = next((mm for mm in patron.finditer(texto) if not disculpado(que, mm.group(0))),
                     None)
            if m:
                linea = texto[:m.start()].count("\n") + 1
                print("   [FUGA] %s:%d  %s: %s" % (f, linea, que, m.group(0)))
                problemas.append(f)
                break
    if not problemas or all(p in coladas for p in problemas):
        print("   [ok]   %d ficheros de texto revisados, nada dentro" % revisados)

    print("\n   (%d excepciones declaradas: saneadores y parsers, que necesitan"
          " nombrar lo que reconocen)" % len(EXCEPCIONES))

    print("\n" + "=" * 66)
    if problemas:
        print("NO PUBLICAR. %d fichero(s) con material privado." % len(set(problemas)))
        return 1
    print("Limpio: se puede publicar.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
