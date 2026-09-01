import { Card } from './ui.jsx'

/* --------------------------------------------------------------------------
   Figuras de datos reales, en SVG a mano.

   Todas las cifras salen de consultas verificadas contra PostgreSQL o del
   cuaderno 06. Ninguna es ilustrativa: si un numero cambia en la base, hay que
   cambiarlo aqui, y por eso cada figura lleva anotada su fuente en pantalla.
   -------------------------------------------------------------------------- */

const TONE = { AMORFO: 'amorphous', INCIPIENTE: 'incipient', CRISTALINO: 'pure' }

/* ---------------------------------------------------------------
   1. El factor de confusion: % cristalino por tipo de sintesis.
   Fuente: cuaderno 06, §5.0.
   --------------------------------------------------------------- */
const CONFOUNDER = [
  { type: 'HTS', full: 'Combinatorial screening', amorf: 401, cryst: 169, incip: 971, pct: 11.0 },
  { type: 'ST', full: 'Standard solvothermal', amorf: 3, cryst: 71, incip: 15, pct: 79.8 },
  { type: 'MW', full: 'Microwave-assisted', amorf: 0, cryst: 90, incip: 4, pct: 95.7 },
]

export function ConfounderFigure() {
  const W = 760
  const rowH = 74
  const H = CONFOUNDER.length * rowH + 46
  const barX = 190
  const barW = W - barX - 70

  return (
    <div
      className="overflow-x-auto rounded-[var(--radius-card)] p-4"
      style={{ border: 'var(--border-card) solid var(--surface-border)', background: 'var(--chart-bg)' }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: 'block', width: '100%', minWidth: '560px', height: 'auto' }}
        role="img"
        aria-label="Percentage of crystalline outcomes by synthesis type: combinatorial screening 11 percent, standard solvothermal 79.8 percent, microwave 95.7 percent"
      >
        {CONFOUNDER.map((r, i) => {
          const y = i * rowH + 26
          const total = r.amorf + r.cryst + r.incip
          const seg = [
            { n: r.amorf, tone: 'amorphous', label: 'amorphous' },
            { n: r.incip, tone: 'incipient', label: 'incipient' },
            { n: r.cryst, tone: 'pure', label: 'crystalline' },
          ]
          let acc = 0
          return (
            <g key={r.type}>
              <text x={0} y={y + 14} fontSize="15" fill="var(--text-primary)" fontFamily="var(--font-heading)">
                {r.type}
              </text>
              <text x={0} y={y + 32} fontSize="11" fill="var(--text-muted)">
                {r.full}
              </text>
              <text x={0} y={y + 48} fontSize="11" fill="var(--text-muted)" fontFamily="var(--font-mono)">
                n = {total}
              </text>
              {seg.map((s) => {
                const w = (s.n / total) * barW
                const x = barX + acc
                acc += w
                return (
                  <g key={s.label}>
                    <rect
                      x={x}
                      y={y}
                      width={Math.max(w, 0)}
                      height={34}
                      fill={`var(--status-${s.tone})`}
                      opacity={s.tone === 'pure' ? 1 : 0.55}
                    />
                    {w > 34 && (
                      <text
                        x={x + w / 2}
                        y={y + 22}
                        textAnchor="middle"
                        fontSize="12"
                        fill="var(--chart-bg)"
                        fontFamily="var(--font-mono)"
                      >
                        {s.n}
                      </text>
                    )}
                  </g>
                )
              })}
              <text
                x={W - 62}
                y={y + 24}
                fontSize="17"
                fill="var(--status-pure)"
                fontFamily="var(--font-display)"
              >
                {r.pct}%
              </text>
            </g>
          )
        })}
        <g>
          {[
            { t: 'amorphous', l: 'Amorphous' },
            { t: 'incipient', l: 'Incipient' },
            { t: 'pure', l: 'Crystalline' },
          ].map((s, i) => (
            <g key={s.t} transform={`translate(${barX + i * 150}, ${H - 10})`}>
              <rect x={0} y={-9} width={12} height={12} fill={`var(--status-${s.t})`} opacity={s.t === 'pure' ? 1 : 0.55} />
              <text x={18} y={1} fontSize="12" fill="var(--text-secondary)">
                {s.l}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  )
}

/* ---------------------------------------------------------------
   2. Separacion de clases por descriptor.
   Fuente: consulta directa a pxrd_descriptors join pxrd_labels,
   verificada el 2026-09-01. Medianas por clase.
   --------------------------------------------------------------- */
const SEPARATION = [
  {
    metric: 'Crystallinity index',
    unit: '',
    max: 1,
    rows: [
      { k: 'AMORFO', v: 0.01 },
      { k: 'INCIPIENTE', v: 0.497 },
      { k: 'CRISTALINO', v: 0.77 },
    ],
  },
  {
    metric: 'Accepted reflections',
    unit: '',
    max: 20,
    rows: [
      { k: 'AMORFO', v: 0 },
      { k: 'INCIPIENTE', v: 8 },
      { k: 'CRISTALINO', v: 19 },
    ],
  },
  {
    metric: 'Signal-to-noise ratio',
    unit: '',
    max: 270,
    rows: [
      { k: 'AMORFO', v: 3.93 },
      { k: 'INCIPIENTE', v: 39.19 },
      { k: 'CRISTALINO', v: 268.56 },
    ],
  },
]

const N_BY_CLASS = { AMORFO: 484, INCIPIENTE: 1013, CRISTALINO: 358 }

export function SeparationFigure() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {SEPARATION.map((m) => (
        <Card key={m.metric}>
          <h3 className="text-sm uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            {m.metric}
          </h3>
          <div className="mt-4 flex flex-col gap-3">
            {m.rows.map((r) => (
              <div key={r.k}>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    {r.k.toLowerCase()}
                  </span>
                  <span className="mono text-sm" style={{ color: `var(--status-${TONE[r.k]})` }}>
                    {r.v}
                  </span>
                </div>
                <div
                  className="mt-1 h-2.5 w-full overflow-hidden rounded-sm"
                  style={{ background: 'var(--surface-elevated)', border: '1px solid var(--surface-border)' }}
                >
                  <div
                    style={{
                      width: `${Math.max((r.v / m.max) * 100, r.v > 0 ? 2 : 0)}%`,
                      height: '100%',
                      background: `var(--status-${TONE[r.k]})`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
      <p className="text-xs md:col-span-3" style={{ color: 'var(--text-muted)' }}>
        Median value per class over {N_BY_CLASS.AMORFO + N_BY_CLASS.INCIPIENTE + N_BY_CLASS.CRISTALINO} labelled
        diffractograms (amorphous {N_BY_CLASS.AMORFO}, incipient {N_BY_CLASS.INCIPIENTE}, crystalline{' '}
        {N_BY_CLASS.CRISTALINO}). Queried directly from the descriptor table, joined to the labels by file
        hash rather than by sample code — 43 samples carry more than one labelled measurement, and joining
        by sample would pair a scan with someone else&rsquo;s verdict.
      </p>
    </div>
  )
}
