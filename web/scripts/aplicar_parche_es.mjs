/* Mete un parche {ruta: traduccion} en scripts/textos_es.json.
   Valida que toda ruta exista y que el marcado (**negrita**, `codigo`) salga
   en la misma cantidad que el original, que es como se caza un ** perdido.

   Uso:  node scripts/aplicar_parche_es.mjs <fichero.json> */

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const TRAD = path.resolve('scripts/textos_es.json')
const parcheRuta = process.argv[2]
if (!parcheRuta) {
  console.error('Falta el fichero de parche.')
  process.exit(1)
}

const textos = JSON.parse(await readFile(TRAD, 'utf8'))
const porRuta = new Map(textos.map((t) => [t.path, t]))
const parche = JSON.parse(await readFile(path.resolve(parcheRuta), 'utf8'))

const marcas = (s) => ({
  b: (s.match(/\*\*/g) ?? []).length,
  c: (s.match(/`/g) ?? []).length,
})

let ok = 0
const problemas = []
for (const [ruta, es] of Object.entries(parche)) {
  const t = porRuta.get(ruta)
  if (!t) { problemas.push(`ruta inexistente: ${ruta}`); continue }
  const a = marcas(t.en), b = marcas(es)
  if (a.b !== b.b) problemas.push(`** descuadrado (${a.b} vs ${b.b}): ${ruta}`)
  if (a.c !== b.c) problemas.push(`\` descuadrado (${a.c} vs ${b.c}): ${ruta}`)
  t.es = es
  ok++
}

await writeFile(TRAD, JSON.stringify(textos, null, 1) + '\n', 'utf8')
console.log(`${ok} aplicadas. Traducidas en total: ${textos.filter((t) => t.es).length}/${textos.length}`)
if (problemas.length) {
  console.log(`\n${problemas.length} aviso(s) de marcado:`)
  for (const p of problemas) console.log('   ' + p)
}
