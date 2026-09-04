/* --------------------------------------------------------------------------
   extraer_textos.mjs — saca todo el texto traducible de src/content/*.js.

   Por que en Node y no con expresiones regulares
   ----------------------------------------------
   Los ficheros de contenido son modulos de datos puros: no importan nada y no
   tienen efectos secundarios. Asi que se pueden IMPORTAR de verdad y recorrer
   el objeto resultante, en vez de adivinar su forma con regex. Eso garantiza
   que la traduccion se reinserte en el sitio exacto: cada cadena viaja con su
   ruta completa (fichero, export, indices de array, claves anidadas), y el
   importador reconstruye la misma estructura por construccion.

   Que NO sale
   -----------
   - Cadenas que son datos y no prosa: codigos de columna (`sample_code`),
     formulas, valores numericos, rutas de fichero, claves internas (`key`,
     `icon`, `tone`, `slug`, `id`, `kind`...). Traducir `n_peaks` romperia la
     tabla; traducir `icon: 'waves'` romperia el icono.
   - Cadenas de menos de 3 palabras que ademas no llevan espacios: casi siempre
     son identificadores.

   Uso
   ---
       node scripts/extraer_textos.mjs            # escribe textos_en.json
   -------------------------------------------------------------------------- */

import { readdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const DIR = path.resolve('src/content')
const OUT = path.resolve('scripts/textos_en.json')

/* Claves cuyo valor NUNCA se traduce: son identificadores o datos, no prosa. */
const CLAVES_TECNICAS = new Set([
  'key', 'icon', 'tone', 'slug', 'id', 'kind', 'n', 'name', 'code', 'formula',
  'crisp', 'lane', 'state', 'file', 'src', 'href', 'repo', 'github', 'linkedin',
  'orcid', 'email', 'cv', 'value', 'rows', 'tableRows', 'tableHead',
  'formulas', 'fields', 'nodes', 'models', 'counts', 'inputs',
])

/* Un valor es prosa si tiene espacios y al menos tres palabras. Lo demas es
   casi siempre una etiqueta corta o un identificador, y traducirlo a ciegas
   rompe mas de lo que arregla. */
function esProsa(s) {
  if (typeof s !== 'string') return false
  const palabras = s.trim().split(/\s+/)
  return palabras.length >= 3
}

/* En ui.js el filtro de tres palabras no vale: ahi TODO es texto que se ve en
   pantalla, y los titulos cortos ("Stack", "How to read it") son justo los que
   mas cantan sin traducir. */
const SIEMPRE_TRADUCIBLE = new Set(['ui.js'])

/* Rutas concretas que los filtros generales excluirian con razon en casi
   todos los casos, pero que aqui SI son texto visible:
   - `name` protege los nombres reales de los nodos de n8n (no se tocan), pero
     en TECHNIQUES y en MODEL_LINEUP.models la misma clave guarda el nombre
     legible de una tecnica o de un modelo, que si se lee en pantalla.
   - `guarantees[].lead` en collection.js son titulos de una o dos palabras
     ("No duplicates"), y el filtro de tres palabras los descarta. */
const RUTAS_FORZADAS = [
  /^science\.js:TECHNIQUES\[\d+\]\.name$/,
  /^screens\.js:MODEL_LINEUP\.models\[\d+\]\.name$/,
  /^collection\.js:COLLECTION_PROBLEM\.guarantees\[\d+\]\.lead$/,
  /^prep\.js:DESCRIPTOR_RECAP\.head\[\d+\]$/,
  /^workflow\.js:AREAS\[\d+\]\.table\.head\[\d+\]$/,
  /^prep\.js:PREP_UI\.(metalFeaturizationTitle|linkerFeaturizationTitle|fixLabel|labelerTitle|explorerTitle)$/,
  /^model\.js:MODEL_LOOP\.coverageOf$/,
  /^screens\.js:MODEL_ERRORS\.asHopedBadge$/,
  /^screens\.js:EDA_CONFOUNDER\.microwaveRowEmphasis$/,
]

const textos = []

function recorrer(valor, ruta, claveActual, todo = false) {
  if (typeof valor === 'string') {
    const forzada = RUTAS_FORZADAS.some((re) => re.test(ruta))
    if (!todo && !forzada && CLAVES_TECNICAS.has(claveActual)) return
    if (!todo && !forzada && !esProsa(valor)) return
    textos.push({ path: ruta, en: valor })
    return
  }
  if (Array.isArray(valor)) {
    valor.forEach((v, i) => recorrer(v, `${ruta}[${i}]`, claveActual, todo))
    return
  }
  if (valor && typeof valor === 'object') {
    for (const [k, v] of Object.entries(valor)) recorrer(v, `${ruta}.${k}`, k, todo)
  }
}

const ficheros = (await readdir(DIR)).filter((f) => f.endsWith('.js')).sort()

for (const f of ficheros) {
  const mod = await import(pathToFileURL(path.join(DIR, f)).href)
  for (const [nombre, valor] of Object.entries(mod)) {
    recorrer(valor, `${f}:${nombre}`, nombre, SIEMPRE_TRADUCIBLE.has(f))
  }
}

await writeFile(OUT, JSON.stringify(textos, null, 1) + '\n', 'utf8')

const palabras = textos.reduce((t, x) => t + x.en.split(/\s+/).length, 0)
console.log(`${textos.length} cadenas, ${palabras} palabras -> scripts/textos_en.json`)
