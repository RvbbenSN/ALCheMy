import { useState } from 'react'
import GRAPH from '../data/graph_sample.json'
import { Badge, Rich } from './ui.jsx'

/* --------------------------------------------------------------------------
   GraphConstellation — el grafo entero, como puntos alrededor de sus
   concentradores.

   Antes habia aqui una muestra y sus ocho vecinos, con etiquetas MEA-001 y
   relaciones HAS_MEASUREMENT escritas al lado. Preciso y opaco: obligaba a
   descifrar siglas para entender un dibujo, que es lo contrario de lo que un
   dibujo tiene que hacer.

   Lo que se enseña ahora es lo unico que un grafo tiene de particular: **que
   unas pocas cosas concentran a muchas**. Cada muestra es un punto y orbita
   alrededor del metal con el que se hizo, asi que se ve de un golpe que dos o
   tres metales se lo llevan casi todo y que hay una cola larga de metales
   probados una vez. Eso es una afirmacion sobre el laboratorio, no sobre
   teoria de grafos.

   Los datos salen de scripts/build_graph_sample.py. Los metales van con su
   nombre --no son secreto de nadie-- y los ligandos seudonimizados.
   -------------------------------------------------------------------------- */

const W = 760
const H = 470
const CX = W / 2
const CY = H / 2 - 8

/* Una semilla fija: el dibujo tiene que salir igual en cada carga, o cambia
   solo al navegar y parece que se mueve. */
function aleatorio(semilla) {
  let s = semilla
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

export default function GraphConstellation() {
  const [sobre, setSobre] = useState(null)
  const c = GRAPH.constellation
  if (!c) return null

  const metales = c.metals
  const total = c.samples

  const rnd = aleatorio(20260904)

  /* El radio de cada concentrador va con la RAIZ del recuento: con el recuento
     a secas, el mayor saldria veinte veces mas ancho que la cola y no cabria.
     La raiz es ademas lo honesto en un circulo, porque el ojo compara areas. */
  const radio = (n) => 6 + Math.sqrt(n) * 0.82

  /* El mayor va al centro y el resto lo rodea. Un anillo puro dejaba un agujero
     en medio, y ademas esta disposicion dice sola lo que dice el dato: hay uno
     que domina. */
  const [mayor, ...resto] = metales
  const nodos = [
    { ...mayor, x: CX, y: CY, r: radio(mayor.n) },
    ...resto.map((m, i) => {
      const ang = (i / resto.length) * Math.PI * 2 - Math.PI / 2
      return {
        ...m,
        x: CX + 258 * Math.cos(ang),
        y: CY + 176 * Math.sin(ang),
        r: radio(m.n),
      }
    }),
  ]

  /* Nombres que no caben en una esfera. El completo va en el <title>. */
  const CORTO = { NOT_APPLICABLE: 'n/a', UNKNOWN: '?' }
  const corto = (l) => CORTO[l] ?? l

  const dentro = (v, lo, hi) => Math.min(Math.max(v, lo), hi)

  /* Las muestras: una por punto, orbitando su metal. Se dibujan todas -- son
     2.216 circulos de radio 1,3, que el navegador traza sin despeinarse -- y
     dibujarlas todas es la mitad del argumento. */
  const puntos = []
  for (const m of nodos) {
    for (let k = 0; k < m.n; k += 1) {
      const a = rnd() * Math.PI * 2
      const d = m.r + 3 + Math.sqrt(rnd()) * (10 + Math.sqrt(m.n) * 1.9)
      puntos.push({
        // Acotados al lienzo: sin esto los del concentrador mayor se salian
        // por arriba y quedaban recortados por el borde del SVG.
        x: dentro(m.x + d * Math.cos(a), 6, W - 6),
        y: dentro(m.y + d * Math.sin(a) * 0.8, 6, H - 6),
        metal: m.label,
      })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">
          {GRAPH.totals.nodes.toLocaleString('en-GB')} nodes ·{' '}
          {GRAPH.totals.edges.toLocaleString('en-GB')} edges
        </Badge>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {total.toLocaleString('en-GB')} samples · {metales.length} metals ·{' '}
          {c.ligands.length} linkers · {c.measurements.toLocaleString('en-GB')} measurements
        </span>
      </div>

      <div
        className="overflow-x-auto rounded-[var(--radius-card)] p-2"
        style={{ border: 'var(--border-card) solid var(--surface-border)', background: 'var(--surface-elevated)' }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ display: 'block', width: '100%', minWidth: 620 }}
          role="img"
          aria-label="Every sample in the knowledge graph, drawn as a point orbiting the metal it was made with"
        >
          {/* cada muestra */}
          {puntos.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="1.35"
              fill="var(--accent-primary)"
              opacity={sobre && sobre !== p.metal ? 0.13 : 0.5}
            />
          ))}

          {/* los concentradores */}
          {nodos.map((m) => {
            const on = sobre === m.label
            return (
              <g
                key={m.label}
                onMouseEnter={() => setSobre(m.label)}
                onMouseLeave={() => setSobre(null)}
                style={{ cursor: 'default' }}
              >
                <circle
                  cx={m.x}
                  cy={m.y}
                  r={m.r}
                  fill="var(--surface)"
                  stroke={on ? 'var(--accent-primary)' : 'var(--status-pure)'}
                  strokeWidth={on ? 3 : 2}
                />
                <title>{`${m.label}: ${m.n} syntheses`}</title>
                <text
                  x={m.x}
                  y={m.r > 17 ? m.y : m.y + 4}
                  textAnchor="middle"
                  style={{
                    fontSize: Math.max(9, Math.min(15, m.r * 0.7)),
                    fontFamily: 'var(--font-heading)',
                  }}
                  fill="var(--text-primary)"
                >
                  {corto(m.label)}
                </text>
                {/* El recuento va DENTRO del circulo cuando cabe. Debajo caia
                    encima del concentrador vecino. */}
                {m.r > 17 && (
                  <text
                    x={m.x}
                    y={m.y + 14}
                    textAnchor="middle"
                    style={{ fontSize: 10 }}
                    fill="var(--text-muted)"
                  >
                    {m.n}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        <Rich>
          Every dot is one synthesis, orbiting the metal it was made with. The shape is the point:
          **three metals carry more than half the record and a dozen were tried once or twice**.
          A vector search over the literature cannot tell you that — it is a fact about relations,
          which is what the graph is for, and what lets the assistant answer *what else did we make
          with this metal and this linker* in a single traversal.
        </Rich>
      </p>
    </div>
  )
}
