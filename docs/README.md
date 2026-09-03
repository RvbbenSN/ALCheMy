# `docs/` — Documentación pública del proyecto

Esta carpeta es **lo que sí se publica**. Todo lo que hay aquí puede leerlo cualquiera sin filtrar
datos de laboratorio, nombres de ligandos no publicados ni condiciones de síntesis reales.

Existe para resolver un problema concreto: la documentación del proyecto estaba repartida entre
carpetas privadas (`methodology/`, `design_system/`) y carpetas públicas, y no había forma de saber
de un vistazo qué era publicable y qué no. La regla ahora es simple: **si está en `docs/`, es
público; si no, no lo es.**

## Qué hay

| Archivo | Qué es |
|---|---|
| [`ROADMAP_APP_WEB_Y_GUION.md`](./ROADMAP_APP_WEB_Y_GUION.md) | Arquitectura de las 9 pantallas de la app y el guión de contenido de cada una. El documento maestro del frontend |
| [`CONCEPTOS_CLAVE.md`](./CONCEPTOS_CLAVE.md) | Explicaciones de una idea cada una: qué significa el porcentaje de un clasificador, rejilla congelada frente a modelo activo, y una valoración crítica y sin adornos de lo bueno que es el modelo |

## Cuadernos publicados ✅

Los 7 cuadernos se publican como **HTML estático de solo lectura** en
`web/public/notebooks/`, para que los sirva la propia aplicación y pueda enlazarlos desde la
pantalla a la que corresponde cada uno. No viven aquí para no duplicar 6 MB que se
desincronizarían a la primera regeneración.

Se generan con:

```bash
python scripts/build_public_notebooks.py --report   # qué hay, sin escribir nada
python scripts/build_public_notebooks.py            # genera el HTML saneado
python scripts/build_public_notebooks.py --strip-images
```

### Y una tercera salida: solo la prosa

`build_public_notebooks.py` produce HTML de 6,6 MB porque lleva las 31 figuras
incrustadas en base64. Eso está bien para leerlo en la web y fatal para
cualquier otra cosa: no cabe cómodo en la ventana de un modelo, no se revisa a
gusto y nadie lee un PNG. Para revisar, traducir o pulir **el texto**, hay una
salida más ligera:

```bash
python scripts/export_notebook_prose.py       # -> handoff/notebook_prose/*.md
```

Saca únicamente las celdas de markdown, pasadas por **el mismo saneador** —lo
importa, no lo reimplementa, para que las dos salidas no puedan divergir— y
deja una marca `> [FIGURA n de <cuaderno>]` donde había una imagen, para que el
texto no se quede hablando de algo que no está. Sin código y sin salidas de
celda: 187 KB en total frente a 6,6 MB.

Es lo único que se manda fuera del proyecto. `handoff/` está en `.gitignore`:
es material derivado, se regenera con un comando, y no debe confundirse con
algo versionado.

### Las dos reglas que sigue el generador

**1. Los outputs filtran más que el código.** Un `.ipynb` guarda lo que imprimió cada celda:
`head()` de dataframes con códigos de muestra reales, ligandos en las leyendas, rutas del disco
local en los mensajes de error. El código en sí es inofensivo — sin el data lake no tiene nada que
leer. El script sanea **fuente y salidas**, no solo el código.

**2. No ejecutar los cuadernos.** Varios escriben en PostgreSQL: reejecutarlos para producir una
copia limpia podría insertar filas duplicadas o borrar en cascada. Se transforma el `.ipynb` ya
ejecutado, en memoria, sin tocar el original.

### Qué sustituye, verificado

En la última generación: **111 códigos de muestra**, **57 nombres de ligando**, 10 rutas absolutas
y 3 correos. Comprobado sobre el HTML resultante que no queda ni un `RS…`/`LP…`/`IEF-…` real ni
ninguno de los cuatro ligandos. Los metales se dejan visibles: no son secreto industrial.

Los seudónimos son **secuenciales** (`SMP-0001`, `LIG-A`) y no un hash: un hash sobre un espacio de
códigos tan pequeño se invierte por fuerza bruta en segundos, y entonces no protege nada.

### ⚠️ Lo que el script NO puede sanear

**Las figuras.** Un gráfico va incrustado como PNG en base64: si su título dice `SMP-0100`, eso son
píxeles y ninguna expresión regular los alcanza. Hay **31 figuras** publicadas (19 en el cuaderno 05
y 12 en el 06) que **siguen pendientes de revisión humana**. `--report` dice dónde están y
`--strip-images` permite publicar sin ellas si hiciera falta.

## Qué falta por traer aquí

- **Glosario de términos.** Cada abreviatura de la app con su nombre completo y una explicación
  llana, generado desde `methodology/logbook/GUIA_DIDACTICA_PORTFOLIO.md` en vez de mantenerse a
  mano. La semilla de 13 términos ya vive en `web/src/content/site.js`.
- **Versión en español.** La app va íntegramente en inglés; los documentos llevarán las dos
  versiones cuando haya tiempo.

## Qué NO va aquí

`methodology/` (diario, roadmaps internos, revisiones), `design_system/` (moodboards, audio, el
`.docx` del guión, logos fuente), `data/` y `backups/` siguen siendo privados y están en
`.gitignore`. De `design_system/` solo salen **artefactos** ya publicables:
`web/src/styles/tokens.css` y los favicons de `web/public/`.
