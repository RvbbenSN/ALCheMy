#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Compone la tarjeta social (Open Graph) que se ve al compartir el enlace.

Que problema resuelve
---------------------
Al pegar la direccion de la web en WhatsApp, LinkedIn o Slack, la vista previa
salia **borrosa**. La causa no es la imagen: es que no habia ninguna.

Cuando una pagina no declara `og:image`, la aplicacion que genera la vista
previa se busca la vida con lo que encuentre, y lo unico que habia eran los
iconos de pestana: 32x32 y, con suerte, el `apple-touch-icon` de 180x180.
WhatsApp los estira hasta ocupar la tarjeta --que pide unos 1200x630-- y un
icono de 180 px agrandado siete veces se ve exactamente asi de mal. No es un
problema de calidad del logo, es un problema de tamano de origen.

La solucion es dar una imagen pensada para ese hueco. Este script la compone a
partir de material que ya existe en el repositorio, en vez de anadir un PNG
suelto que nadie sepa de donde salio ni como rehacer.

Decisiones
----------
- **1200x630**, que es la proporcion 1,91:1 que esperan Open Graph y Twitter.
  Mas pequena se ve borrosa en pantallas de alta densidad; mas grande solo pesa.
- **Tema oscuro**, con la paleta real de `web/src/styles/tokens.css`. Una
  tarjeta social se ve casi siempre dentro de una conversacion, y el fondo
  borgonia recorta mucho mejor contra el blanco de WhatsApp que uno claro.
- El isotipo sale de `web/public/android-chrome-512x512.png`, que ya esta en el
  repositorio y tiene resolucion de sobra. No se toca `design_system/`, que es
  material privado y no siempre esta disponible.
- Tipografias del sistema (Georgia y Segoe UI). Las de la web --Marcellus,
  Poiret One-- se cargan de Google Fonts y no estan instaladas en la maquina,
  asi que usarlas exigiria descargarlas en tiempo de build. Georgia es una serif
  con el mismo aire y evita esa dependencia.

Uso
---
    python scripts/build_og_image.py

Escribe `web/public/og-card.png`. Las etiquetas que la referencian estan en
`web/index.html`; si cambia el dominio, hay que actualizar `og:url` y `og:image`
ahi, porque **deben ser direcciones absolutas**: quien genera la vista previa no
esta navegando por el sitio y no puede resolver una ruta relativa.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOGO = ROOT / "web" / "public" / "android-chrome-512x512.png"
OUT = ROOT / "web" / "public" / "og-card.png"

W, H = 1200, 630

# La paleta oscura de web/src/styles/tokens.css, copiada aqui a proposito: este
# PNG se genera una vez y se sirve como fichero, asi que no puede leer el CSS en
# tiempo de ejecucion como hace la web.
FONDO = (52, 11, 21)         # --bg
DORADO = (229, 214, 148)     # --accent-primary
CREMA = (247, 234, 215)      # --text-secondary
APAGADO = (209, 169, 162)    # --text-muted
BORDE = (180, 60, 85)        # --surface-border

TITULO = "ALCheMy"
SUBTITULO = "Augmented Laboratory for Chemistry & Materials"
PIE = "Materials informatics  ·  agentic AI  ·  governed MLOps"

FUENTES = {
    "titulo": ("C:/Windows/Fonts/georgiab.ttf", 92),
    "subtitulo": ("C:/Windows/Fonts/georgia.ttf", 34),
    "pie": ("C:/Windows/Fonts/segoeui.ttf", 25),
}


def cargar_fuente(ruta, tamano):
    from PIL import ImageFont
    try:
        return ImageFont.truetype(ruta, tamano)
    except OSError:
        # Sin la fuente del sistema la tarjeta sigue saliendo, solo que fea.
        # Preferible a que el script muera y nos quedemos sin imagen.
        print("[aviso] no encuentro %s, uso la fuente por defecto" % ruta)
        return ImageFont.load_default()


def main() -> int:
    try:
        from PIL import Image, ImageDraw, ImageFilter
    except ImportError:
        print("[ERROR] hace falta Pillow:  pip install Pillow")
        return 1

    if not LOGO.exists():
        print("[ERROR] no encuentro %s" % LOGO)
        return 1

    tarjeta = Image.new("RGB", (W, H), FONDO)

    # Halo detras del logo: un circulo dorado muy difuminado. Da profundidad y
    # evita que el isotipo quede flotando sobre un plano liso.
    halo = Image.new("L", (W, H), 0)
    ImageDraw.Draw(halo).ellipse([90, 145, 490, 545], fill=70)
    halo = halo.filter(ImageFilter.GaussianBlur(70))
    tarjeta.paste(Image.new("RGB", (W, H), DORADO), (0, 0), halo)

    # El isotipo, a la izquierda, RECOLOREADO EN DORADO.
    #
    # El PNG de origen es el icono de pestana: trazo borgonia sobre un cuadrado
    # BLANCO Y OPACO. Pegarlo tal cual planta una caja blanca en mitad de la
    # tarjeta. Asi que no se pega la imagen: se usa su tinta como mascara.
    # Pasandola a gris e invirtiendola, el trazo --oscuro-- se vuelve claro y el
    # fondo blanco se vuelve negro, es decir, transparente. Esa mascara se
    # rellena de dorado, y el isotipo queda dibujado en el color de la marca sin
    # ningun fondo. Ademas hereda el suavizado del original, asi que no aparecen
    # dientes de sierra en las curvas.
    logo = Image.open(LOGO).convert("L").resize((300, 300), Image.LANCZOS)
    from PIL import ImageOps, ImageChops
    mascara = ImageOps.invert(logo)
    # Un poco de contraste en la mascara: el blanco del original no es 255 puro
    # en los bordes y sin esto queda un halo gris alrededor del trazo.
    mascara = ImageChops.multiply(mascara, mascara)
    tarjeta.paste(Image.new("RGB", (300, 300), DORADO), (150, 165), mascara)

    d = ImageDraw.Draw(tarjeta)
    x = 500

    f_tit = cargar_fuente(*FUENTES["titulo"])

    # El texto se mide antes de pintarlo y la fuente se encoge hasta que cabe.
    # Sin esto el subtitulo se salia por el borde derecho: no se ve al escribir
    # el codigo, solo al mirar el PNG, y cualquier cambio en la frase --o una
    # fuente distinta en otra maquina-- lo rompe otra vez.
    ancho_util = W - x - 60

    def encoger(texto, ruta, tam):
        f = cargar_fuente(ruta, tam)
        while tam > 12 and d.textlength(texto, font=f) > ancho_util:
            tam -= 2
            f = cargar_fuente(ruta, tam)
        return f

    f_sub = encoger(SUBTITULO, *FUENTES["subtitulo"])
    f_pie = encoger(PIE, *FUENTES["pie"])

    d.text((x, 200), TITULO, font=f_tit, fill=DORADO)
    # Filete bajo el titulo: separa el nombre de la explicacion sin meter un
    # bloque de color. Se estira hasta el ancho real del subtitulo, no a ojo.
    ancho_filete = max(d.textlength(SUBTITULO, font=f_sub), 300)
    d.line([(x + 4, 322), (x + 4 + ancho_filete, 322)], fill=BORDE, width=2)
    d.text((x + 4, 348), SUBTITULO, font=f_sub, fill=CREMA)
    d.text((x + 4, 402), PIE, font=f_pie, fill=APAGADO)

    # Marco fino: en WhatsApp la tarjeta se recorta contra un fondo blanco y sin
    # borde el lado oscuro se funde con la burbuja del mensaje.
    d.rectangle([0, 0, W - 1, H - 1], outline=BORDE, width=3)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    tarjeta.save(OUT, "PNG", optimize=True)
    print("escrito %s  (%dx%d, %.0f KB)"
          % (OUT.relative_to(ROOT), W, H, OUT.stat().st_size / 1024))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
