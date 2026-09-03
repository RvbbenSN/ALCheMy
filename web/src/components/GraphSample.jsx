import GRAPH from '../data/graph_sample.json'
import { Badge, Rich } from './ui.jsx'

/* --------------------------------------------------------------------------
   GraphSample — una vecindad del grafo de conocimiento, no el grafo entero.

   El grafo tiene 6.506 nodos. Dibujarlo completo da una maraña que decora sin
   informar, y ademas no es lo que el agente hace: `explore_graph` camina unos
   pocos saltos desde un nodo. Asi que se dibuja esa unidad -- una muestra y lo
   que la define -- y a cada vecino se le pone su GRADO, que dice cuantas otras
   muestras cuelgan de el sin tener que dibujarlas. Ese numero es justamente lo
   que hace util al grafo: el metal de esta muestra la conecta con cientos mas.

   Los datos salen de scripts/build_graph_sample.py, con los codigos de muestra
   y los ligandos ya seudonimizados.
   -------------------------------------------------------------------------- */

/* Ancho generoso: el texto del grado ("shared with 148 others") cuelga a la
   derecha de cada vecino y con 640 se salia del lienzo. */
const W = 780
const H = 300

const TYPE = {
  SAMPLE: { color: 'var(--accent-primary)', label: 'Sample' },
  METAL: { color: 'var(--status-pure)', label: 'Metal' },
  LIGAND: { color: 'var(--accent-secondary-text)', label: 'Ligand' },
  MODULATOR: { color: 'var(--status-incipient)', label: 'Modulator' },
  MEASUREMENT: { color: 'var(--text-secondary)', label: 'Measurement' },
}

export default function GraphSample() {
  const centro = GRAPH.nodes.find((n) => n.id === GRAPH.center)
  const vecinos = GRAPH.nodes.filter((n) => n.id !== GRAPH.center)

  /* Los vecinos se reparten en un abanico, agrupados por tipo, para que las
     seis medidas no se mezclen con el metal y el ligando. */
  const orden = ['METAL', 'LIGAND', 'MODULATOR', 'MEASUREMENT']
  const ordenados = [...vecinos].sort(
    (a, b) => orden.indexOf(a.type) - orden.indexOf(b.type) || a.label.localeCompare(b.label),
  )

  const cx = 132
  const cy = H / 2
  const rx = 360
  const pos = new Map()
  ordenados.forEach((n, i) => {
    const paso = (H - 70) / Math.max(ordenados.length - 1, 1)
    pos.set(n.id, [cx + rx, 35 + i * paso])
  })

  const tipos = [...new Set(ordenados.map((n) => n.type))]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">
          {GRAPH.totals.nodes.toLocaleString('en-GB')} nodes ·{' '}
          {GRAPH.totals.edges.toLocaleString('en-GB')} edges in the full graph
        </Badge>
        {tipos.map((t) => (
          <span key={t} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span
              aria-hidden
              style={{
                width: 9,
                height: 9,
                borderRadius: 9,
                background: TYPE[t]?.color ?? 'var(--text-muted)',
                display: 'inline-block',
              }}
            />
            {TYPE[t]?.label ?? t}
          </span>
        ))}
      </div>

      <div
        className="overflow-x-auto rounded-[var(--radius-card)] p-2"
        style={{ border: 'var(--border-card) solid var(--surface-border)', background: 'var(--surface-elevated)' }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ display: 'block', width: '100%', minWidth: 620 }}
          role="img"
          aria-label="One sample in the knowledge graph and everything directly connected to it"
        >
          {GRAPH.edges.map((e, i) => {
            const otro = e.from === GRAPH.center ? e.to : e.from
            const p = pos.get(otro)
            if (!p) return null
            return (
              <g key={i}>
                <path
                  d={`M${cx + 52},${cy} C${cx + 180},${cy} ${p[0] - 190},${p[1]} ${p[0] - 8},${p[1]}`}
                  fill="none"
                  stroke="var(--surface-border)"
                  strokeWidth="1.8"
                />
                <text
                  x={cx + 210}
                  y={(cy + p[1]) / 2 - 4}
                  style={{ fontSize: 9 }}
                  fill="var(--text-muted)"
                >
                  {e.type}
                </text>
              </g>
            )
          })}

          {/* la muestra */}
          <circle cx={cx} cy={cy} r="46" fill="var(--surface)" stroke={TYPE.SAMPLE.color} strokeWidth="3" />
          <text x={cx} y={cy - 2} textAnchor="middle" style={{ fontSize: 14, fontFamily: 'var(--font-heading)' }} fill="var(--text-primary)">
            {centro?.label}
          </text>
          <text x={cx} y={cy + 15} textAnchor="middle" style={{ fontSize: 10 }} fill="var(--text-muted)">
            sample
          </text>

          {/* los vecinos */}
          {ordenados.map((n) => {
            const [x, y] = pos.get(n.id)
            const c = TYPE[n.type]?.color ?? 'var(--text-muted)'
            return (
              <g key={n.id}>
                <circle cx={x} cy={y} r="7" fill={c} />
                <text x={x + 13} y={y + 4} style={{ fontSize: 11 }} fill="var(--text-primary)">
                  {n.label}
                </text>
                {/* El grado: cuantas cosas mas cuelgan de este vecino. Es la
                    cifra que convierte un dibujo bonito en una respuesta. */}
                {n.degree > 2 && (
                  <text x={x + 13} y={y + 16} style={{ fontSize: 9 }} fill="var(--text-muted)">
                    shared with {n.degree - 1} others
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        <Rich>
          This is one sample and everything directly attached to it — the metal, the linker and each
          measurement made on it. **The useful number is on the right**: the metal node alone
          connects this sample to hundreds of others, which is what lets a question like *what else
          did we make with this metal and this linker* be one traversal instead of three searches.
        </Rich>
      </p>
    </div>
  )
}
