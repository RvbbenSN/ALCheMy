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
// Tercer campo opcional: mascara PNG en /logos/ para las marcas que no estan en
// simple-icons. Se pintan igual, con el color del tema, usando el PNG como
// mask-image: para una forma solida el resultado es el mismo que un SVG
// monocromo, sin tener que vectorizar nada.
const WANTED = [
  // fila 1 - datos e infraestructura
  ['siPython', 'Python'],
  ['siJupyter', 'Jupyter'],
  ['siPostgresql', 'PostgreSQL'],
  ['siN8n', 'n8n'],
  ['siDocker', 'Docker'],
  // fila 2 - ciencia de datos
  ['siPandas', 'Pandas'],
  ['siNumpy', 'NumPy'],
  ['siScipy', 'SciPy'],
  [null, 'Matplotlib', 'matplotlib.png'],
  [null, 'Seaborn', null, { light: 'seaborn_light.svg', dark: 'seaborn_dark.svg' }],
  ['siScikitlearn', 'Scikit-Learn'],
  ['siStreamlit', 'Streamlit'],
  ['siReact', 'React'],
  // fila 3 - entorno e IA
  [null, 'VS Code', 'vscode.png'], // Microsoft retiro su marca de simple-icons
  [null, 'Antigravity', 'antigravity.png'],
  ['siClaudecode', 'Claude Code'],
  ['siGooglegemini', 'Gemini'],
  ['siOllama', 'Ollama'],
  ['siCloudflare', 'Cloudflare'],
]

const ROWS = [5, 8, 6] // como se agrupan en pantalla

const out = []
const noIcon = []
const notFound = []

for (const [key, label, mask] of WANTED) {
  if (key === null) {
    out.push({ label, path: null, mask: mask ?? null })
    if (!mask) noIcon.push(label)
    continue
  }
  const icon = si[key]
  if (icon && icon.path) {
    out.push({ label, path: icon.path, mask: null })
  } else {
    out.push({ label, path: null, mask: mask ?? null })
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

// Iconos sociales, aparte del stack. LinkedIn no esta en simple-icons: lo
// retiraron a peticion de la propia marca, asi que en la web se usa un icono
// neutro en vez de reproducir su logotipo.
const SOCIAL = [
  ['siGithub', 'github'],
  ['siOrcid', 'orcid'],
]
const social = {}
for (const [key, name] of SOCIAL) {
  if (si[key]?.path) social[name] = si[key].path
}
writeFileSync(
  new URL('../src/data/social_icons.json', import.meta.url),
  JSON.stringify(social, null, 1),
  'utf8',
)
console.log(`escritos ${Object.keys(social).length} iconos sociales -> src/data/social_icons.json`)

console.log(`escritos ${out.length} elementos (${out.filter((i) => i.path).length} con logotipo)`)
if (noIcon.length) console.log(`sin marca, iran como etiqueta: ${noIcon.join(', ')}`)
if (notFound.length) console.log(`AVISO, slug no encontrado: ${notFound.join(', ')}`)
