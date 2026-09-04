#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Prepara una copia publicable del proyecto, con un unico commit y sin pasado.

Que problema resuelve
---------------------
El repositorio de trabajo **no se puede hacer publico tal cual**, y la razon no
es lo que contiene hoy: es lo que contuvo ayer.

`scripts/comprobar_privacidad.py` revisa el estado ACTUAL del arbol. Puede decir
"limpio" con toda la razon mientras el historial guarda, intactos, los nombres de
ligandos sin publicar y los codigos de muestra reales que se limpiaron despues.
Git conserva cada version anterior: borrar un dato hoy no lo borra del commit de
la semana pasada, y basta un `git log -S` para sacarlo.

Comprobado en este repositorio: el ligando `H6ttbmp` aparece en 25 commits, uno
de ellos titulado *"Un guardian de privacidad, y cerradas las fugas que
encontro"*. Y ni siquiera hace falta abrir un fichero -- este mensaje de commit
se lee en la portada del repositorio:

    Cierra F0: oxofilicidad de Kepp completa, RS253 por calculo de masa,
    identidades H6ttbmp/H8ptp confirmadas

Un codigo de muestra y dos ligandos, a la vista, sin mirar el codigo.

La solucion
-----------
Publicar el ESTADO, no la HISTORIA. Este script copia lo que git rastrea ahora
mismo a una carpeta nueva, sin `.git`, y crea alli un repositorio con **un solo
commit**. Lo que se publica es exactamente lo que el comprobador ha revisado.

Se pierde el historial publico, y es una perdida real: el recorrido de un
proyecto se lee bien en sus commits. Pero el historial de este repositorio no es
publicable sin reescribirlo entero, y reescribir un historial es mas peligroso
--y mas facil de hacer a medias-- que empezar uno limpio. El repositorio privado
conserva el recorrido completo para quien lo necesite.

Por que se copia `git ls-files` y no la carpeta
-----------------------------------------------
Copiar el directorio arrastraria todo lo ignorado: `_lab/`, `data/`, `.env`,
`backups/`, `node_modules/`. Preguntandole a git QUE rastrea, lo ignorado no
puede colarse por accidente -- la lista de exclusiones ya existe y esta probada,
que es el `.gitignore`. Un fichero que no esta en el indice no se copia, y no
hay una segunda lista que mantener sincronizada.

Uso
---
    python scripts/preparar_repo_publico.py --dry-run     # que se copiaria
    python scripts/preparar_repo_publico.py               # crea la copia

Se ejecuta desde el repositorio principal, con `main` al dia. Al terminar
imprime los comandos de GitHub, pero **no los ejecuta**: crear un repositorio
publico es una decision, no un efecto secundario.

Codigo de salida 1 si el comprobador de privacidad encuentra algo, antes o
despues de copiar. La segunda comprobacion no es redundante: verifica la copia
real, que es lo que de verdad se va a publicar.
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

MENSAJE = "ALCheMy: a governed data platform for a materials chemistry laboratory"


def corre(orden, cwd=None, capturar=True):
    return subprocess.run(orden, cwd=cwd or ROOT, capture_output=capturar,
                          text=True, encoding="utf-8", errors="replace")


def comprobar_privacidad(carpeta) -> bool:
    """Ejecuta el guardian dentro de `carpeta`. True si esta limpio."""
    guardian = carpeta / "scripts" / "comprobar_privacidad.py"
    if not guardian.exists():
        print("[ERROR] no encuentro %s" % guardian)
        return False
    r = corre([sys.executable, str(guardian)], cwd=carpeta)
    print(r.stdout.strip()[-800:] if r.stdout else "")
    return r.returncode == 0


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--destino", default=str(ROOT.parent / "ALCheMy_public"),
                   help="carpeta a crear (por defecto, ALCheMy_public al lado del repo)")
    p.add_argument("--dry-run", action="store_true",
                   help="solo dice que se copiaria, sin tocar el disco")
    p.add_argument("--forzar", action="store_true",
                   help="borra la carpeta destino si ya existe")
    a = p.parse_args()
    destino = Path(a.destino).resolve()

    # 1. El arbol actual tiene que estar limpio ANTES de copiar nada.
    print("== 1. Comprobando el arbol actual ==")
    if not comprobar_privacidad(ROOT):
        print("\n[ABORTADO] El arbol actual tiene material privado. "
              "Arreglelo antes de preparar nada publicable.")
        return 1

    # 2. Que se publicaria.
    r = corre(["git", "ls-files"])
    if r.returncode != 0:
        print("[ERROR] no puedo listar los ficheros rastreados:", r.stderr.strip())
        return 1
    ficheros = [f for f in r.stdout.splitlines() if f.strip()]
    print("\n== 2. Se publicarian %d ficheros rastreados por git ==" % len(ficheros))
    for f in sorted(ficheros)[:8]:
        print("   ", f)
    print("    ... y %d mas" % max(0, len(ficheros) - 8))

    rama = corre(["git", "rev-parse", "--abbrev-ref", "HEAD"]).stdout.strip()
    commit = corre(["git", "rev-parse", "--short", "HEAD"]).stdout.strip()
    print("\n    origen: rama %s, commit %s" % (rama, commit))
    if rama != "main":
        print("    [AVISO] no esta en main. Lo que se publique sera el contenido")
        print("            de %s, que puede no ser lo que espera." % rama)

    if a.dry_run:
        print("\n(ensayo: no se ha creado nada)")
        return 0

    # 3. La copia.
    if destino.exists():
        if not a.forzar:
            print("\n[ERROR] %s ya existe. Use --forzar para reemplazarla." % destino)
            return 1
        shutil.rmtree(destino, ignore_errors=True)
    print("\n== 3. Copiando a %s ==" % destino)
    for rel in ficheros:
        origen = ROOT / rel
        if not origen.exists():      # borrado en el arbol pero aun en el indice
            continue
        dst = destino / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(origen, dst)
    print("    %d ficheros copiados" % len(ficheros))

    # 4. Un repositorio nuevo, con un solo commit y sin pasado.
    print("\n== 4. Repositorio nuevo, un solo commit ==")
    for orden in (["git", "init", "-b", "main"],
                  ["git", "add", "-A"],
                  ["git", "commit", "-m", MENSAJE]):
        r = corre(orden, cwd=destino)
        if r.returncode != 0:
            print("[ERROR] fallo %s: %s" % (" ".join(orden), (r.stderr or "").strip()))
            return 1
    n = corre(["git", "rev-list", "--count", "HEAD"], cwd=destino).stdout.strip()
    print("    commits en el historial nuevo: %s" % n)

    # 5. La comprobacion que de verdad cuenta: sobre la copia.
    print("\n== 5. Comprobando LA COPIA ==")
    if not comprobar_privacidad(destino):
        print("\n[ABORTADO] la copia no esta limpia. NO la publique.")
        return 1

    print("""
== Listo. Lo que queda es suyo ==

Cree el repositorio en github.com --publico, SIN README ni .gitignore inicial--
y luego, desde %s:

    git remote add origin https://github.com/<usuario>/<nombre>.git
    git push -u origin main

Despues, dos cosas que no hace este script:

  1. El enlace del sitio. `web/src/content/site.js` apunta al repositorio
     privado; hay que cambiarlo al nuevo o los visitantes veran un 404 desde la
     pantalla Data Collection.
  2. El repositorio de trabajo se queda PRIVADO. Es el que conserva el
     historial, y el historial es justamente lo que no se puede publicar.

Para actualizar lo publico mas adelante, se vuelve a ejecutar esto con --forzar
y se empuja de nuevo. Cada actualizacion es un commit mas en el repositorio
publico; el privado sigue siendo el que se trabaja.
""" % destino)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
