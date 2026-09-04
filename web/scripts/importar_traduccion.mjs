/* --------------------------------------------------------------------------
   importar_traduccion.mjs — mete la respuesta de Gemini en textos_es.json.

   Lee _lab/handoff/web_es/traducido/*.txt, que tienen la misma forma que se
   envio (bloques `@@ruta` seguidos del texto), y valida ANTES de escribir:

   - que toda `@@ruta` exista de verdad en textos_es.json;
   - que no falte ninguna de las que se mandaron a traducir;
   - que el marcado (`**negrita**`, acentos graves) salga en la misma cantidad
     que en el original, que es la forma barata de cazar un `**` perdido que
     dejaria media frase en negrita hasta el final del parrafo.

   Si un fichero no cuadra, NO se aplica ninguna de sus cadenas y se explica
   que pasa. Mejor un idioma incompleto --que cae a ingles-- que uno a medias
   con las frases descolocadas.

   Uso
   ---
       node scripts/importar_traduccion.mjs
       node scripts/importar_traduccion.mjs --forzar   # aplica pese a los avisos
   -------------------------------------------------------------------------- */

import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const TRAD = path.resolve('scripts/textos_es.json')
const IN_DIR = path.resolve('../_lab/handoff/web_es/traducido')
const FORZAR = process.argv.includes('--forzar')

const textos = JSON.parse(await readFile(TRAD, 'utf8'))
const porRuta = new Map(textos.map((t) => [t.path, t]))

let ficheros = []
try {
  ficheros = (await readdir(IN_DIR)).filter((f) => f.endsWith('.txt')).sort()
} catch {
  console.error(`No existe ${IN_DIR}. ¿Ha dejado Gemini ahi las respuestas?`)
  process.exit(1)
}

/** Cuenta marcadores para comparar original y traduccion. */
function marcas(s) {
  return {
    negrita: (s.match(/\*\*/g) ?? []).length,
    codigo: (s.match(/`/g) ?? []).length,
  }
}

let aplicadasTotal = 0
let ficherosMal = 0

for (const f of ficheros) {
  const bruto = await readFile(path.join(IN_DIR, f), 'utf8')
  const bloques = [...bruto.matchAll(/^@@(\S+)\n([\s\S]*?)(?=\n@@\S|\s*$)/gm)]

  const problemas = []
  const pendientes = []

  for (const [, ruta, cuerpoBruto] of bloques) {
    const cuerpo = cuerpoBruto.trim()
    const entrada = porRuta.get(ruta)
    if (!entrada) {
      problemas.push(`ruta que no existe: ${ruta}`)
      continue
    }
    if (!cuerpo) {
      problemas.push(`bloque vacio: ${ruta}`)
      continue
    }
    const a = marcas(entrada.en)
    const b = marcas(cuerpo)
    if (a.negrita !== b.negrita) problemas.push(`** descuadrado en ${ruta}`)
    if (a.codigo !== b.codigo) problemas.push(`\` descuadrado en ${ruta}`)
    pendientes.push([entrada, cuerpo])
  }

  const esperadas = textos.filter(
    (t) => t.path.startsWith(f.replace('.txt', '.js') + ':') && !t.es,
  ).length
  if (bloques.length !== esperadas) {
    problemas.push(`llegan ${bloques.length} bloques y se esperaban ${esperadas}`)
  }

  if (problemas.length && !FORZAR) {
    ficherosMal++
    console.log(`${f}  NO SE APLICA, ${problemas.length} problema(s):`)
    for (const p of problemas.slice(0, 8)) console.log(`   ${p}`)
    if (problemas.length > 8) console.log(`   ... y ${problemas.length - 8} mas`)
    continue
  }

  for (const [entrada, cuerpo] of pendientes) entrada.es = cuerpo
  aplicadasTotal += pendientes.length
  const aviso = problemas.length ? `  (${problemas.length} aviso(s), forzado)` : ''
  console.log(`${f.padEnd(18)} ${String(pendientes.length).padStart(4)} cadenas${aviso}`)
}

if (aplicadasTotal) {
  await writeFile(TRAD, JSON.stringify(textos, null, 1) + '\n', 'utf8')
}

const sinTraducir = textos.filter((t) => !t.es).length
console.log(`\n${aplicadasTotal} cadenas aplicadas. Quedan ${sinTraducir} sin traducir (saldran en ingles).`)
if (ficherosMal) {
  console.log(`${ficherosMal} fichero(s) sin aplicar: corrige y vuelve a importar.`)
  process.exit(1)
}
