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

## Qué falta por traer aquí

Pendiente de las fases F1 y F6 del roadmap:

- **Cuadernos refinados.** Versiones de los notebooks pensadas para leerse, no para ejecutarse:
  renderizadas a HTML estático de solo lectura, con lenguaje científico y didáctico.
- **Glosario de términos.** Cada abreviatura que aparece en la app, con su nombre completo y una
  explicación llana. Es la fuente de los tooltips del frontend, y se generará desde
  `methodology/logbook/GUIA_DIDACTICA_PORTFOLIO.md` en vez de mantenerse a mano.
- **Versión en español.** La app va íntegramente en inglés; los documentos de esta carpeta llevarán
  las dos versiones cuando haya tiempo.

## Dos reglas al traer algo aquí

**1. Los outputs de un cuaderno filtran más que el código.** Un `.ipynb` guarda lo que imprimió cada
celda: `head()` de dataframes con códigos de muestra reales, nombres de ligando en las leyendas de
las figuras, rutas del disco local en los mensajes de error. El código en sí es inofensivo — sin el
data lake no tiene nada que leer. Hay que auditar **celda por celda**, no solo revisar el código.

**2. No ejecutar los cuadernos para regenerarlos.** Varios escriben en PostgreSQL: reejecutarlos
para producir una copia limpia puede insertar filas duplicadas o borrar en cascada. Se transforma el
`.ipynb` ya ejecutado; no se vuelve a correr.

## Qué NO va aquí

`methodology/` (diario, roadmaps internos, revisiones), `design_system/` (moodboards, audio, el
`.docx` del guión, logos fuente), `data/` y `backups/` siguen siendo privados y están en
`.gitignore`. De `design_system/` solo salen **artefactos** ya publicables:
`web/src/styles/tokens.css` y los favicons de `web/public/`.
