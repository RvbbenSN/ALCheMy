import { useState } from 'react'
import MAP from '../data/knowledge_map.json'
import { Badge, Rich } from './ui.jsx'

/* --------------------------------------------------------------------------
   KnowledgeMap — el mapa a oscuras, dibujado con datos y no ilustrado.

   La metafora es de Ruben: el espacio de sintesis como un mapa negro con unas
   pocas zonas iluminadas por lo que ya se ha probado, y el modelo como una
   brujula que dice hacia donde caminar. Se puede dibujar de dos maneras. Una es
   una ilustracion bonita y falsa. La otra, que es esta, es dibujar el mapa de
   verdad: el fondo es la salida del modelo desplegado sobre la misma rejilla
   que alimenta el simulador, y los puntos son las sintesis que existen.

   Y al dibujarlo aparece algo que la ilustracion habria escondido: para el
   metal mas estudiado, casi todas las casillas estan probadas y el modelo sigue
   dudando en casi todas. El mapa no esta a oscuras por falta de experimentos,
   sino porque estos experimentos no lo alumbran. Es la misma conclusion de la
   pantalla 05, ahora en una imagen.

   Se generan con scripts/build_knowledge_map.py.
   -------------------------------------------------------------------------- */

const W = 640
const H = 400
const PAD = { l: 62, r: 18, t: 18, b: 46 }

const CLASS_COLOR = {
  CRISTALINO: 'var(--status-pure)',
  INCIPIENTE: 'var(--status-incipient)',
  AMORFO: 'var(--status-amorphous)',
}

const MODES = [
  {
    key: 'uncertainty',
    label: 'Where it hesitates',
    legend: 'Darker = the model is sure. Brighter = it cannot decide, and an experiment there teaches most.',
  },
  {
    key: 'pCrystalline',
    label: 'Where it expects crystals',
    legend: 'Brighter = higher predicted probability of a crystalline phase.',
  },
]

export default function KnowledgeMap() {
  const [mode, setMode] = useState('uncertainty')
  const xs = MAP.axes.x.values
  const ys = MAP.axes.y.values

  /* Los ejes son categoricos: el laboratorio uso nueve temperaturas y siete
     dosis, no un continuo, asi que se reparten en celdas iguales en vez de a
     escala. Poner 0 y 16 mmol a distancia real dejaria cinco celdas apretadas
     en el margen izquierdo. */
  const cw = (W - PAD.l - PAD.r) / xs.length
  const ch = (H - PAD.t - PAD.b) / ys.length
  const cx = (v) => PAD.l + xs.indexOf(v) * cw
  const cy = (v) => H - PAD.b - (ys.indexOf(v) + 1) * ch

  const valores = MAP.cells.map((c) => c[mode])
  const lo = Math.min(...valores)
  const hi = Math.max(...valores)
  const norm = (v) => (hi === lo ? 0.5 : (v - lo) / (hi - lo))

  const activo = MODES.find((m) => m.key === mode)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMode(m.key)}
            aria-pressed={mode === m.key}
            className="rounded-[var(--radius-button)] px-3 py-1.5 text-xs uppercase tracking-wider"
            style={{
              border: '2px solid var(--accent-primary)',
              background: mode === m.key ? 'var(--accent-primary)' : 'transparent',
              color: mode === m.key ? 'var(--surface)' : 'var(--text-primary)',
            }}
          >
            {m.label}
          </button>
        ))}
        <Badge tone="neutral">
          {MAP.metal} · {MAP.nSyntheses} syntheses
        </Badge>
      </div>

      <div
        className="overflow-x-auto rounded-[var(--radius-card)] p-2"
        style={{ border: 'var(--border-card) solid var(--surface-border)', background: 'var(--surface-elevated)' }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ display: 'block', width: '100%', minWidth: 520 }}
          role="img"
          aria-label={`Model output over target temperature and carboxylic modulator for ${MAP.metal}, with the conditions actually run marked`}
        >
          {/* el terreno */}
          {MAP.cells.map((c) => (
            <rect
              key={`${c.x}-${c.y}`}
              x={cx(c.x)}
              y={cy(c.y)}
              width={cw}
              height={ch}
              fill="var(--accent-primary)"
              opacity={0.06 + 0.72 * norm(c[mode])}
            />
          ))}

          {/* Lo que se ha probado de verdad. Se dibujan de mayor a menor: en
              una casilla puede haber tres veredictos, y sin ordenar el circulo
              mas grande tapaba a los otros dos. */}
          {[...MAP.tried].sort((a, b) => b.n - a.n).map((p) => (
            <circle
              key={`${p.x}-${p.y}-${p.klass}`}
              cx={cx(p.x) + cw / 2}
              cy={cy(p.y) + ch / 2}
              r={Math.min(cw, ch) * 0.14 + Math.min(7, Math.sqrt(p.n) * 1.6)}
              fill={CLASS_COLOR[p.klass] ?? 'var(--text-muted)'}
              opacity={0.9}
              stroke="var(--surface)"
              strokeWidth="1.2"
            />
          ))}

          {/* hacia donde apunta la brujula */}
          {mode === 'uncertainty' &&
            MAP.suggested.map((c) => (
              <rect
                key={`s-${c.x}-${c.y}`}
                x={cx(c.x) + 1.5}
                y={cy(c.y) + 1.5}
                width={cw - 3}
                height={ch - 3}
                fill="none"
                stroke="var(--text-primary)"
                strokeWidth="2.5"
                strokeDasharray="6 4"
              />
            ))}

          {/* ejes */}
          {xs.map((v) => (
            <text
              key={`x${v}`}
              x={cx(v) + cw / 2}
              y={H - PAD.b + 18}
              textAnchor="middle"
              style={{ fontSize: 12 }}
              fill="var(--text-muted)"
            >
              {v}
            </text>
          ))}
          {ys.map((v) => (
            <text
              key={`y${v}`}
              x={PAD.l - 8}
              y={cy(v) + ch / 2 + 4}
              textAnchor="end"
              style={{ fontSize: 12 }}
              fill="var(--text-muted)"
            >
              {v}
            </text>
          ))}
          <text
            x={PAD.l + (W - PAD.l - PAD.r) / 2}
            y={H - 8}
            textAnchor="middle"
            style={{ fontSize: 12 }}
            fill="var(--text-secondary)"
          >
            {MAP.axes.x.label}
          </text>
          <text
            x={14}
            y={PAD.t + (H - PAD.t - PAD.b) / 2}
            textAnchor="middle"
            transform={`rotate(-90 14 ${PAD.t + (H - PAD.t - PAD.b) / 2})`}
            style={{ fontSize: 12 }}
            fill="var(--text-secondary)"
          >
            {MAP.axes.y.label}
          </text>
        </svg>
      </div>

      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        <Rich>{activo.legend}</Rich>{' '}
        Each circle is a condition the laboratory actually ran, sized by how many times and coloured
        by what came out — {' '}
        <span style={{ color: 'var(--status-pure)' }}>crystalline</span>,{' '}
        <span style={{ color: 'var(--status-incipient)' }}>incipient</span>,{' '}
        <span style={{ color: 'var(--status-amorphous)' }}>amorphous</span>.
        {mode === 'uncertainty' && ' The dashed cells are the three the loop would propose next.'}
      </p>
    </div>
  )
}
