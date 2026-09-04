#!/usr/bin/env python3
"""Tapa lo que no debe verse en los dos videos de las herramientas.

Que se tapa, y por que
----------------------
Ruben pregunto por su direccion IP. La respuesta corta es que **192.168.1.141
es una direccion privada**: solo significa algo dentro de su propia red de casa
y no sirve para alcanzarle desde internet, asi que no es un problema de
seguridad. Pero al mirar el video aparecieron tres cosas que si lo son, porque
contradicen lo que el pie del sitio promete:

  - el nombre de un ligando sin publicar (`H6ttbmp` en el grabador de moviles,
    `Et8ptp` en el explorador),
  - codigos de muestra reales en el titulo de la grafica y en los avisos,
  - y, ya de paso, la IP, que se tapa igual porque tampoco aporta nada.

Como se tapa
------------
Con un desenfoque fuerte sobre regiones fijas. Se comprobo en fotogramas de
varios momentos del video que la maquetacion de las dos aplicaciones no se
mueve, asi que unas coordenadas fijas bastan y no hace falta seguir el texto.
El video sigue reproduciendose entero: no se corta ni un segundo.

Uso
---
    python scripts/redact_video.py            # escribe sobre web/public/video
    python scripts/redact_video.py --dry-run  # solo dice que haria
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VID = ROOT / "web" / "public" / "video"

# fichero -> [(x, y, w, h, que es), ...]. Coordenadas en pixeles del video.
# fichero -> [(x, y, w, h, color, que es), ...]. El color es el del fondo sobre
# el que cae la caja, para que la redaccion no cante mas de lo necesario.
REGIONES = {
    "pxrd_labeler.mp4": [
        (56, 88, 344, 64, "0x1c2b33", "barra de direcciones: la IP de la red local"),
        (92, 254, 448, 86, "0x1a1a1a", "aviso con el codigo de muestra"),
        # Solo el metal y el ligando. La temperatura y el tiempo se dejan a la
        # vista: no son secreto y son justo lo que da contexto al video.
        (14, 412, 124, 36, "0x0e1117", "linea de metadatos: metal y ligando"),
        (246, 508, 108, 30, "white", "titulo de la grafica: el codigo de muestra"),
    ],
    "pxrd_explorer.mp4": [
        (958, 74, 200, 26, "white", "cabecera: metal y ligando"),
    ],
}


def filtro(regs):
    """Una caja solida por region, encadenadas con comas.

    `drawbox` toma una entrada y devuelve una salida, asi que encadenar es
    trivial. El intento anterior usaba crop+overlay y reutilizaba la misma
    etiqueta como entrada del recorte y como base de la superposicion, lo que
    ffmpeg no hace sin `split`: se quedaba solo con el ultimo eslabon.
    """
    return ",".join(
        "drawbox=x=%d:y=%d:w=%d:h=%d:color=%s:t=fill" % (x, y, w, h, color)
        for x, y, w, h, color, _ in regs
    )


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not shutil.which("ffmpeg"):
        print("hace falta ffmpeg en el PATH", file=sys.stderr)
        return 2

    for nombre, regs in REGIONES.items():
        src = VID / nombre
        if not src.exists():
            print("no existe %s" % src, file=sys.stderr)
            return 1
        print("%s  (%d region(es))" % (nombre, len(regs)))
        for x, y, w, h, _color, que in regs:
            print("   %4d,%-4d %3dx%-3d  %s" % (x, y, w, h, que))
        if args.dry_run:
            continue

        tmp = src.with_suffix(".redacted.mp4")
        cmd = [
            "ffmpeg", "-v", "error", "-y", "-i", str(src),
            "-vf", filtro(regs),
            "-c:v", "libx264", "-crf", "30", "-preset", "medium",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an",
            str(tmp),
        ]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0:
            print(r.stderr[-1200:], file=sys.stderr)
            return 1
        antes, despues = src.stat().st_size, tmp.stat().st_size
        tmp.replace(src)
        print("   -> %.1f MB  (antes %.1f MB)" % (despues / 1e6, antes / 1e6))

    print("\nEl audio se descarta (-an): son capturas de pantalla y no lo tienen.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
