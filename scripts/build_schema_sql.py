#!/usr/bin/env python3
"""Genera scripts/sql/schema.sql: el esquema de la base, tal y como esta hoy.

Que problema resuelve
---------------------
Habia diecisiete .sql sueltos mezclando el fichero de arranque, dieciseis
migraciones con sus versiones (v2, v3, v31, v32, v33) y un arreglo de datos.
Ninguno respondia a la pregunta que de verdad se hace quien llega: **como es la
base ahora**. Reconstruirla mentalmente aplicando las migraciones en orden no es
razonable, y mantener un fichero maestro a mano garantiza que se desvie.

Asi que no se mantiene: se genera. `pg_dump --schema-only` sobre la base viva.

Lo que sanea, y por que hace falta
----------------------------------
El volcado crudo NO es publicable, y esto se descubrio al mirarlo:

  - `researcher_email` lleva como valor DEFAULT el correo personal del autor,
    en dos tablas.
  - Un comentario de columna enumera los ligandos sin publicar.
  - Un mensaje de error y un comentario citan un codigo de muestra real.

Todo eso acabaria en un repositorio publico. Se sustituye aqui, en la copia que
se publica, y NO en la base: cambiar un DEFAULT en produccion por un motivo de
maquetacion es cambiar el comportamiento del sistema para arreglar un documento.
Lo que si queda es la anotacion de que el DEFAULT deberia dejar de ser un correo
personal, que es un arreglo de esquema y merece su propia decision.

Uso
---
    python scripts/build_schema_sql.py
    python scripts/build_schema_sql.py --check   # sale 1 si algo sensible pasa
"""

from __future__ import annotations

import argparse
import datetime as dt
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "scripts" / "sql" / "schema.sql"
CONTENEDOR = "alchemy_postgres"

# (patron, sustituto, por que). El orden importa: el correo antes que nada.
SANEADO = [
    (re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"),
     "researcher@example.org", "correos personales"),
    (re.compile(r"\b(H8ptp|Et8ptp|H6ttbmp|Et6ttbmp)\b"),
     "LIG-x", "ligandos sin publicar"),
    (re.compile(r"\b(RSMix\d+|RS\d{2,}|LP\d+|IEF-\d+)\b"),
     "SMP-0001", "codigos de muestra"),
]

# Lo que NO puede quedar en el fichero publicado. Se comprueba despues de sanear.
# El sustituto que escribe este mismo script tiene forma de correo, asi que la
# comprobacion tiene que dejarlo pasar. Se filtra por lista y no con un
# lookahead: un lookahead delante de un patron sin ancla no sirve, porque el
# motor puede empezar a casar una letra mas adelante y esquivarlo -- se vio,
# porque el script se acuso a si mismo por "esearcher@example.org".
PERMITIDO = {"researcher@example.org"}
PROHIBIDO = re.compile(
    r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"
    r"|\b(H8ptp|Et8ptp|H6ttbmp|Et6ttbmp)\b"
    r"|\b(RSMix\d+|RS\d{2,}|LP\d+|IEF-\d+)\b"
    r"|\b192\.168\.\d+\.\d+\b"
)

CABECERA = """--
--  ALCheMy - esquema de la base de datos
--  ======================================
--
--  GENERADO, NO ESCRITO A MANO.  %s
--
--  Este fichero es la fotografia del esquema tal y como esta hoy en la base
--  viva. Se produce con:
--
--      python scripts/build_schema_sql.py
--
--  Si quiere saber COMO es la base ahora, lea esto. Si quiere saber COMO SE
--  LLEGO hasta aqui, lea scripts/sql/migrations/, que guarda cada migracion
--  fechada y en orden. Y si va a crear la base desde cero, el que se ejecuta
--  es scripts/sql/init_db.sql, que es el que Docker monta.
--
--  No lo edite: el siguiente volcado se lo lleva por delante. Para cambiar el
--  esquema se escribe una migracion nueva, se aplica, y se regenera esto.
--
--  Saneado: los correos, los nombres de ligando sin publicar y los codigos de
--  muestra se sustituyen antes de escribir, porque este fichero se publica y
--  el volcado crudo los lleva dentro (en DEFAULT de columnas, en comentarios y
--  en mensajes de error de las funciones).
--

"""


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--check", action="store_true",
                    help="no escribe; sale 1 si algo sensible sobrevive al saneado")
    args = ap.parse_args()

    r = subprocess.run(
        ["docker", "exec", "-i", CONTENEDOR, "pg_dump", "-U", "alchemy_user",
         "-d", "alchemy_db", "--schema-only", "--no-owner", "--no-privileges"],
        capture_output=True, text=True, encoding="utf-8",
    )
    if r.returncode != 0:
        print("pg_dump fallo: %s" % r.stderr.strip()[:300], file=sys.stderr)
        return 1

    texto = r.stdout
    crudo = len(texto)

    # Las lineas \restrict de pg_dump 16 llevan una clave aleatoria por volcado:
    # sin quitarlas, el fichero cambia en cada regeneracion aunque el esquema no.
    texto = re.sub(r"^\\(un)?restrict .*\n", "", texto, flags=re.M)

    print("saneado:")
    for patron, sustituto, que in SANEADO:
        texto, n = patron.subn(sustituto, texto)
        print("   %-26s %d sustitucion(es)" % (que, n))

    fugas = sorted(set(m.group(0) for m in PROHIBIDO.finditer(texto)) - PERMITIDO)
    if fugas:
        print("\nERROR: sobrevive algo sensible: %s" % fugas[:8], file=sys.stderr)
        return 1
    print("   comprobado: no queda nada de la lista prohibida")

    salida = CABECERA % dt.date.today().isoformat() + texto

    if args.check:
        if OUT.exists() and OUT.read_text(encoding="utf-8") == salida:
            print("\nschema.sql esta al dia")
            return 0
        print("\nschema.sql NO esta al dia: regenerelo", file=sys.stderr)
        return 1

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(salida, encoding="utf-8")
    print("\nescrito %s  (%d lineas, %.0f KB; volcado crudo %.0f KB)"
          % (OUT.relative_to(ROOT), salida.count("\n"),
             len(salida) / 1024, crudo / 1024))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
