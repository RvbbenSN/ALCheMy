/**
 * Extrae los logotipos de marca del stack a un JSON pequeno y commiteado.
 *
 * Por que no se importa `simple-icons` en la aplicacion
 * ----------------------------------------------------
 * El paquete trae ~3.300 iconos. Importarlo desde el frontend arrastraria todo
 * el catalogo al bundle (varios MB) para usar veinte. Aqui se extraen solo los
 * que hacen falta, en tiempo de desarrollo, y el resultado se versiona: la
 * aplicacion no depende de simple-icons en ejecucion, solo del JSON.
 *
 * Las herramientas que no tienen icono de marca (n8n, pgAdmin, Antigravity,
 * Claude Code, Seaborn...) se quedan sin `path` a proposito y el componente
 * las dibuja como una etiqueta de texto. Inventarles un logo seria peor.
 *
 * Uso:  node scripts/build_stack_icons.mjs
 */

import { writeFileSync } from 'node:fs'
import * as si from 'simple-icons'

// El stack tal como lo escribio Ruben, en sus tres filas. El primer elemento es
// el slug de simple-icons; null para lo que no tiene logotipo de marca.
const WANTED = [
  // fila 1 - datos e infraestructura
  ['siPython', 'Python'],
  [null, 'SQL'],
  ['siJupyter', 'Jupyter'],
  ['siPostgresql', 'PostgreSQL'],
  [null, 'pgAdmin'],
  ['siN8n', 'n8n'],
  ['siDocker', 'Docker'],
  // fila 2 - ciencia de datos
  ['siPandas', 'Pandas'],
  ['siNumpy', 'NumPy'],
  ['siScipy', 'SciPy'],
  [null, 'Matplotlib'],
  [null, 'Seaborn'],
  ['siScikitlearn', 'Scikit-Learn'],
  ['siStreamlit', 'Streamlit'],
  ['siReact', 'React'],
  // fila 3 - entorno e IA
  [null, 'VS Code'], // Microsoft retiro su marca de simple-icons
  [null, 'Antigravity'],
  ['siClaudecode', 'Claude Code'],
  ['siGooglegemini', 'Gemini'],
  ['siOllama', 'Ollama'],
  ['siCloudflare', 'Cloudflare'],
  [null, 'Slack'],
]

const ROWS = [7, 8, 7] // como se agrupan en pantalla

const out = []
const noIcon = []
const notFound = []

for (const [key, label] of WANTED) {
  if (key === null) {
    out.push({ label, path: null })
    noIcon.push(label)
    continue
  }
  const icon = si[key]
  if (icon && icon.path) {
    out.push({ label, path: icon.path })
  } else {
    out.push({ label, path: null })
    notFound.push(`${label} (${key})`)
  }
}

// El color de marca no se exporta a proposito: los logos se pintan con el color
// del tema. Veintidos colores corporativos distintos sobre una paleta champan
// serian un arcoiris, y el conjunto dejaria de leerse como un sistema.
writeFileSync(
  new URL('../src/data/stack_icons.json', import.meta.url),
  JSON.stringify({ rows: ROWS, items: out }, null, 1),
  'utf8',
)

console.log(`escritos ${out.length} elementos (${out.filter((i) => i.path).length} con logotipo)`)
if (noIcon.length) console.log(`sin marca, iran como etiqueta: ${noIcon.join(', ')}`)
if (notFound.length) console.log(`AVISO, slug no encontrado: ${notFound.join(', ')}`)
