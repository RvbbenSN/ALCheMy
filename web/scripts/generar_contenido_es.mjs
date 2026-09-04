/* --------------------------------------------------------------------------
   generar_contenido_es.mjs — construye src/content/es/*.js desde la traduccion.

   Como funciona
   -------------
   Importa cada modulo ingles de verdad (son datos puros), lo clona, y sobre la
   copia escribe la traduccion de cada cadena EN SU RUTA EXACTA, la que genero
   `extraer_textos.mjs`. La estructura no se reconstruye a mano en ningun
   momento: se hereda del original, asi que un array no puede quedarse corto ni
   una clave cambiar de nombre. Lo unico que cambia son las hojas de texto.

   Lo que no este traducido se queda en ingles, a proposito: la web se puede
   visitar en espanol en cualquier punto del proceso sin huecos en blanco.

   Uso
   ---
       node scripts/generar_contenido_es.mjs        # lee scripts/textos_es.json
   -------------------------------------------------------------------------- */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const DIR = path.resolve('src/content')
const OUT_DIR = path.resolve('src/content/es')
const TRAD = path.resolve('scripts/textos_es.json')

/* "EDUCATION[0].tags[1]" -> ['EDUCATION', 0, 'tags', 1] */
function trocear(ruta) {
  const partes = []
  for (const trozo of ruta.split('.')) {
    const m = trozo.match(/^([^[\]]*)((\[\d+\])*)$/)
    if (m[1]) partes.push(m[1])
    for (const i of m[2].matchAll(/\[(\d+)\]/g)) partes.push(Number(i[1]))
  }
  return partes
}

function fijar(raiz, partes, valor) {
  let o = raiz
  for (let i = 0; i < partes.length - 1; i++) {
    o = o[partes[i]]
    if (o === undefined) return false
  }
  const ultima = partes[partes.length - 1]
  if (o === undefined || o[ultima] === undefined) return false
  o[ultima] = valor
  return true
}

const traducciones = JSON.parse(await readFile(TRAD, 'utf8'))
const porFichero = new Map()
for (const t of traducciones) {
  if (!t.es || t.es === t.en) continue
  const [fichero, resto] = t.path.split(':')
  if (!porFichero.has(fichero)) porFichero.set(fichero, [])
  porFichero.get(fichero).push({ ruta: resto, es: t.es })
}

await mkdir(OUT_DIR, { recursive: true })
const ficheros = (await readdir(DIR)).filter((f) => f.endsWith('.js')).sort()

let totalAplicadas = 0
let totalFallidas = 0

for (const f of ficheros) {
  const mod = await import(pathToFileURL(path.join(DIR, f)).href)
  const datos = structuredClone(
    Object.fromEntries(Object.entries(mod).map(([k, v]) => [k, v])),
  )

  let aplicadas = 0
  const fallidas = []
  for (const { ruta, es } of porFichero.get(f) ?? []) {
    const partes = trocear(ruta)
    if (fijar(datos, partes, es)) aplicadas++
    else fallidas.push(ruta)
  }
  totalAplicadas += aplicadas
  totalFallidas += fallidas.length

  const cuerpo = Object.entries(datos)
    .map(([nombre, valor]) => `export const ${nombre} = ${JSON.stringify(valor, null, 2)}\n`)
    .join('\n')

  const cabecera = `/* GENERADO por scripts/generar_contenido_es.mjs. No editar a mano:
   se sobrescribe. Para corregir una frase, cambiarla en scripts/textos_es.json
   y volver a ejecutar el script. Lo que no este traducido sale en ingles. */\n\n`

  await writeFile(path.join(OUT_DIR, f), cabecera + cuerpo, 'utf8')
  const aviso = fallidas.length ? `  AVISO: ${fallidas.length} rutas no encontradas` : ''
  console.log(`${f.padEnd(16)} ${String(aplicadas).padStart(4)} cadenas${aviso}`)
  for (const r of fallidas.slice(0, 5)) console.log(`     sin sitio: ${r}`)
}

console.log(`\nTotal: ${totalAplicadas} aplicadas, ${totalFallidas} sin sitio`)
