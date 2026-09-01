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
