# `web/` — Aplicación web pública de ALCheMy

La cara visible del proyecto: React + Vite + Tailwind v4, nueve pantallas que siguen la narrativa
CRISP-DM. Todo lo que hay aquí es **publicable**; ningún dato crudo, ningún binario de modelo y
ningún nombre de muestra real vive en esta carpeta.

El guión de contenido de cada pantalla está en
[`../docs/ROADMAP_APP_WEB_Y_GUION.md`](../docs/ROADMAP_APP_WEB_Y_GUION.md), sección 5.

## Arrancar

```bash
cd web
npm install
npm run dev      # http://localhost:5173
npm run build    # genera dist/
npm run preview  # sirve dist/ para comprobar el build
```

No hace falta base de datos ni backend: la app arranca con datos de relleno. Cuando exista la API,
`vite.config.js` ya redirige `/api` a `http://localhost:8000`.

## Cómo está organizado

| Ruta | Qué contiene |
|---|---|
| `src/content/site.js` | **El contenido.** Textos, KPIs, glosario. Aquí es donde se rellena el guión |
| `src/screens/` | Una pantalla por archivo, en el orden de las pestañas (00 a 08) |
| `src/components/ui.jsx` | Piezas del sistema neo-brutalista: tarjeta, badge, botón, KPI, tooltip |
| `src/components/Layout.jsx` | Navbar, navegación, pie, conmutador de tema, audio ambiental |
| `src/styles/tokens.css` | **Generado.** No editar a mano (ver abajo) |
| `src/styles/global.css` | Tipografía, campo estelar, foco visible, reducción de movimiento |
| `public/` | Favicons y manifiesto |

**Por qué el contenido está separado de los componentes.** El guión todavía se está escribiendo. Si
los textos estuvieran incrustados en el JSX, cada corrección de una frase obligaría a tocar código y
a arriesgarse a romper el maquetado. Con `site.js` aparte, rellenar una pantalla es editar un
objeto.

## Los design tokens no se editan aquí

`src/styles/tokens.css` **se genera** desde `design_system/style_guide.yaml`:

```bash
python scripts/build_design_tokens.py           # regenera el CSS
python scripts/build_design_tokens.py --check   # sale 1 si está desfasado
python scripts/check_contrast.py --strict       # audita WCAG; sale 1 si algo falla
```

Se commitea el CSS resultante a propósito: `design_system/` es privada y no se publica, así que sin
el artefacto versionado el repositorio público no compilaría.

Varios colores del YAML no llegan a WCAG AA **como color de texto** (el oro sobre champán da 2.52:1,
y hace falta 4.5:1). El generador añade variantes legibles —`--accent-secondary-text`— sin tocar el
original, que sigue siendo válido para bordes y rellenos. `check_contrast.py` lo verifica de verdad,
componiendo antes las superficies translúcidas sobre su fondo: medir contra el color declarado da un
resultado equivocado, porque lo que el ojo ve es la mezcla.

## Temas

Tres: `light` (Champán Editorial, el predeterminado), `dark` (Vino Satinado) y `ultra`. El tema se
aplica con `data-theme` en `<html>`, se guarda en `localStorage` y se restaura en `index.html`
**antes del primer pintado**, para que no haya un destello claro al recargar en modo oscuro. Si el
navegador tiene el almacenamiento bloqueado, la app sigue funcionando en claro.

## Estado actual

Es un **esqueleto navegable**, no la app terminada. Las nueve pantallas existen, con la estructura
definitiva y prosa provisional donde el guión aún no está escrito. Esos huecos se ven en pantalla
como bloques punteados con la etiqueta `Pending copy` y la fuente de la que saldrá el texto — un
hueco tiene que parecer un hueco mientras lo sea.

Lo que aún no existe:

- El backend. Todos los números y la predicción del simulador son de relleno; el simulador lo avisa
  en pantalla y no debe presentarse como salida del modelo real.
- Las gráficas (difractograma con capas, matriz de confusión, superficie 3D).
- El canvas del workflow n8n.
- El glosario completo: `site.js` lleva una semilla de 13 términos que se generará desde la guía
  didáctica.
- Diseño móvil. Se ha construido primero para escritorio, por decisión explícita.

## Despliegue en Cloudflare Pages

El sitio es **estático**: `npm run build` produce `dist/`, y eso es todo lo que se sirve. No
hay servidor, ni base de datos, ni API detrás.

### Los dos ficheros que hacen que funcione de verdad

Viven en `public/`, así que Vite los copia a `dist/` tal cual. Cloudflare Pages los lee al
desplegar; en local no hacen nada, y por eso es fácil olvidarse de ellos.

| Fichero | Qué resuelve |
|---|---|
| `public/_redirects` | El **fallback de SPA**. Sin él, recargar en `/the-model` o abrir un enlace directo a una sección devuelve **404**: esas rutas las resuelve React en el navegador, en el servidor no existen. Falla justo con quien llega de fuera |
| `public/_headers` | Las **cabeceras de seguridad**. Cloudflare pone el HTTPS y el anti-DDoS solo; lo que no pone solo es la política de contenido (CSP), que es la que impediría que un script inyectado llegara a ejecutarse |

**Mantenimiento de la CSP.** Autoriza por *hash* el único script incrustado que hay —el de
`index.html` que aplica el tema antes del primer pintado—, en vez de permitir scripts
incrustados en general. Si se toca ese script, hay que recalcular el hash; el propio
`_headers` lleva el comando en un comentario. El síntoma de olvidarlo es leve y visible: un
destello de tema claro al recargar en oscuro, con un error en la consola del navegador.

Y si algún día la web llama al FastAPI, hay que añadir su origen a `connect-src`. Mientras
tanto, `connect-src 'self'` significa que la página no habla con nadie.

### Conectar el repositorio (recomendado)

Cloudflare ha unificado Pages y Workers, y para proyectos nuevos ofrece el camino de
**Workers**: en vez de "dime dónde está el resultado del build", despliega ejecutando
`npx wrangler deploy`. Por eso existe `wrangler.jsonc` — es lo que le dice a wrangler qué
publicar. Sin ese fichero el despliegue falla, y ese es el único trámite que el camino
antiguo no pedía.

En Cloudflare, tras vincular el repositorio:

| Campo | Valor |
|---|---|
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` (el que viene por defecto) |
| Root directory (*Advanced settings*) | `web` |
| Variable de entorno | `NODE_VERSION` = `22` |

`NODE_VERSION` no es opcional: Cloudflare usa por defecto una versión de Node más antigua
que la que exige Vite 7, y el build falla con un error que no explica la causa.

A partir de ahí, cada `push` a `main` reconstruye y publica. **El repositorio manda**: el
sitio se regenera entero desde el código en cada despliegue, así que cualquier cambio hecho
en un editor visual sobre el sitio publicado —y no en estos ficheros— desaparece en el
siguiente `push`, sin error y sin aviso.

La alternativa es arrastrar la carpeta `dist/` a Pages (*Direct Upload*). Publica en un
minuto y sirve para probar, pero cada actualización es un arrastre manual y se pierde la
correspondencia entre lo publicado y un commit.

### Los dos ficheros que NUNCA se editan a mano

```
src/data/model_scorecard.json      <- lo genera scripts/build_model_scorecard.py
public/data/simulator_grid.json    <- lo genera scripts/build_simulator_grid.py
```

Salen del registro de modelos de la base de datos. Editarlos a mano —o dejar que lo haga un
asistente -- devuelve la web al estado que se corrigió el 2026-09-03: cifras que ya no
corresponden al modelo servido, sin que nada falle. Si hay que cambiarlos, se cambia el
modelo desplegado y se vuelven a generar (ver `src/README.md`, "Despliegue del modelo en la
web").
