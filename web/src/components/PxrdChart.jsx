import { useMemo, useState } from 'react'
import EXAMPLES from '../data/pxrd_examples.json'
import { Badge, Card } from './ui.jsx'

/* --------------------------------------------------------------------------
   PxrdChart — la figura central del proyecto.

   Dibuja difractogramas REALES del laboratorio, descompuestos por el mismo
   pipeline que llenó la tabla de descriptores (src/pxrd_descriptors.py). Los
   datos se congelan en build con scripts/build_pxrd_figure_data.py, asi que la
   figura no necesita backend y aun asi no es una ilustracion inventada.

   Se dibuja en SVG a mano en vez de con una libreria de graficos: son cuatro
   polilineas y unos triangulos, y una libreria costaria ~100 KB de bundle mas
   pelearse con su tema para que respete los tokens.

   El ejemplo de cada clase es el CASO MEDIANO por fraccion cristalina, no el
   mas vistoso. El amorfo se ve pobre a proposito: asi es un amorfo tipico.
   -------------------------------------------------------------------------- */

const W = 900
const H = 380
const M = { top: 18, right: 18, bottom: 42, left: 56 }

/* `fill` marca las capas que se pintan como area y no solo como linea: son las
   dos que componen lo que disperso la muestra, y verlas rellenas es lo unico
   que hace legible su proporcion de un vistazo. */
const LAYERS = [
  { key: 'raw', label: 'Raw scan', color: 'var(--text-muted)', width: 1.1 },
  { key: 'instrumental', label: 'Instrument (measured blank)', color: 'var(--accent-tertiary)', width: 1.6, dash: '6 4' },
  { key: 'amorphous', label: 'Amorphous halo', color: 'var(--status-incipient)', width: 1.6, fill: 0.35 },
  { key: 'crystalline', label: 'Bragg reflections', color: 'var(--accent-primary)', width: 1.4, fill: 0.3 },
]

const CLASS_TONE = { AMORFO: 'amorphous', INCIPIENTE: 'incipient', CRISTALINO: 'pure' }
const CLASS_LABEL = { AMORFO: 'Amorphous', INCIPIENTE: 'Incipient', CRISTALINO: 'Crystalline' }

function niceTicks(min, max, n = 5) {
  const span = max - min
  if (span <= 0) return [min]
  const raw = span / n
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10
  const start = Math.ceil(min / step) * step
  const out = []
  for (let v = start; v <= max + 1e-9; v += step) out.push(v)
  return out
}

export default function PxrdChart() {
  const [klass, setKlass] = useState('CRISTALINO')
  const [on, setOn] = useState({ raw: true, instrumental: true, amorphous: true, crystalline: true })
  const [showPeaks, setShowPeaks] = useState(true)
  const [showNoise, setShowNoise] = useState(true)

  const ex = EXAMPLES.find((e) => e.klass === klass) ?? EXAMPLES[0]

  const geom = useMemo(() => {
    const xs = ex.x
    const xMin = xs[0]
    const xMax = xs[xs.length - 1]

    // La escala vertical se calcula solo con las capas visibles: si no, activar
    // la curva cruda aplasta las demas y no se ve lo que se quiere ensenar.
    let yMax = 0
    for (const l of LAYERS) {
      if (!on[l.key]) continue
      for (const v of ex[l.key]) if (v > yMax) yMax = v
    }
    if (showPeaks) for (const p of ex.peaks) if (p.y > yMax) yMax = p.y
    if (yMax <= 0) yMax = 1

    const px = (v) => M.left + ((v - xMin) / (xMax - xMin)) * (W - M.left - M.right)
    const py = (v) => H - M.bottom - (v / yMax) * (H - M.top - M.bottom)

    const line = (key) => {
      const arr = ex[key]
      let d = ''
      for (let i = 0; i < xs.length; i++) {
        d += (i ? 'L' : 'M') + px(xs[i]).toFixed(1) + ' ' + py(arr[i]).toFixed(1)
      }
      return d
    }

    /* La misma curva cerrada contra el eje, para poder rellenarla. */
    const area = (key) => {
      const y0 = py(0).toFixed(1)
      return `${line(key)} L${px(xs[xs.length - 1]).toFixed(1)} ${y0} L${px(xs[0]).toFixed(1)} ${y0} Z`
    }

    return { px, py, line, area, xMin, xMax, yMax }
  }, [ex, on, showPeaks])

  const xTicks = niceTicks(geom.xMin, geom.xMax, 6)

  return (
    <div className="flex flex-col gap-4">
      {/* --- selector de clase --- */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
          Median case of
        </span>
        {EXAMPLES.map((e) => (
          <button
            key={e.klass}
            type="button"
            onClick={() => setKlass(e.klass)}
            aria-pressed={klass === e.klass}
            className="rounded-[var(--radius-badge)] px-3 py-1.5 text-xs uppercase tracking-wider"
            style={{
              border: `2px solid var(--status-${CLASS_TONE[e.klass]})`,
              background: klass === e.klass ? `var(--status-${CLASS_TONE[e.klass]})` : 'transparent',
              color: klass === e.klass ? 'var(--surface)' : 'var(--text-primary)',
            }}
          >
            {CLASS_LABEL[e.klass]}
          </button>
        ))}
        <span className="mono ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>
          {ex.sample}
        </span>
      </div>

      {/* --- la grafica --- */}
      <div
        className="overflow-x-auto rounded-[var(--radius-card)]"
        style={{ border: 'var(--border-card) solid var(--surface-border)', background: 'var(--chart-bg)' }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ display: 'block', width: '100%', minWidth: '620px', height: 'auto' }}
          role="img"
          aria-label={`Powder diffractogram of the median ${CLASS_LABEL[klass].toLowerCase()} sample, with its decomposition layers`}
        >
          {/* rejilla y eje X */}
          {xTicks.map((t) => (
            <g key={t}>
              <line
                x1={geom.px(t)}
                x2={geom.px(t)}
                y1={M.top}
                y2={H - M.bottom}
                stroke="var(--surface-border)"
                strokeWidth="1"
                strokeDasharray="3 4"
              />
              <text
                x={geom.px(t)}
                y={H - M.bottom + 18}
                textAnchor="middle"
                fontSize="12"
                fill="var(--text-muted)"
                fontFamily="var(--font-mono)"
              >
                {t}
              </text>
            </g>
          ))}
          <line
            x1={M.left}
            x2={W - M.right}
            y1={H - M.bottom}
            y2={H - M.bottom}
            stroke="var(--text-secondary)"
            strokeWidth="2"
          />
          <line x1={M.left} x2={M.left} y1={M.top} y2={H - M.bottom} stroke="var(--text-secondary)" strokeWidth="2" />

          <text
            x={(W + M.left) / 2}
            y={H - 6}
            textAnchor="middle"
            fontSize="12"
            fill="var(--text-secondary)"
            fontFamily="var(--font-body)"
          >
            2θ (degrees, Cu Kα₁)
          </text>
          <text
            x={14}
            y={(H - M.bottom + M.top) / 2}
            textAnchor="middle"
            fontSize="12"
            fill="var(--text-secondary)"
            fontFamily="var(--font-body)"
            transform={`rotate(-90 14 ${(H - M.bottom + M.top) / 2})`}
          >
            Intensity (area-normalised)
          </text>

          {/* umbral 3 sigma */}
          {showNoise && (
            <>
              <line
                x1={M.left}
                x2={W - M.right}
                y1={geom.py(ex.noise3sigma)}
                y2={geom.py(ex.noise3sigma)}
                stroke="var(--status-amorphous)"
                strokeWidth="1.5"
                strokeDasharray="8 4"
              />
              <text
                x={W - M.right - 4}
                y={geom.py(ex.noise3sigma) - 6}
                textAnchor="end"
                fontSize="11"
                fill="var(--status-amorphous)"
                fontFamily="var(--font-mono)"
              >
                3σ
              </text>
            </>
          )}

          {/* capas: primero las areas rellenas, para que las lineas queden
              encima y no las tape el relleno de la siguiente */}
          {LAYERS.filter((l) => on[l.key] && l.fill).map((l) => (
            <path key={`${l.key}-fill`} d={geom.area(l.key)} fill={l.color} fillOpacity={l.fill} stroke="none" />
          ))}
          {LAYERS.filter((l) => on[l.key]).map((l) => (
            <path
              key={l.key}
              d={geom.line(l.key)}
              fill="none"
              stroke={l.color}
              strokeWidth={l.width}
              strokeDasharray={l.dash}
              strokeLinejoin="round"
            />
          ))}

          {/* picos aceptados */}
          {showPeaks &&
            ex.peaks.map((p, i) => (
              <polygon
                key={i}
                points={`${geom.px(p.x)},${geom.py(p.y) - 6} ${geom.px(p.x) - 5},${geom.py(p.y) - 15} ${
                  geom.px(p.x) + 5
                },${geom.py(p.y) - 15}`}
                fill="var(--accent-primary)"
              />
            ))}
        </svg>
      </div>

      {/* --- controles --- */}
      <div className="flex flex-wrap gap-2">
        {LAYERS.map((l) => (
          <button
            key={l.key}
            type="button"
            onClick={() => setOn((s) => ({ ...s, [l.key]: !s[l.key] }))}
            aria-pressed={on[l.key]}
            className="flex items-center gap-2 rounded-[var(--radius-badge)] px-3 py-1.5 text-xs"
            style={{
              border: `2px solid ${on[l.key] ? l.color : 'var(--surface-border)'}`,
              color: on[l.key] ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            <span aria-hidden style={{ display: 'inline-block', width: 14, height: 3, background: l.color }} />
            {l.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowPeaks((v) => !v)}
          aria-pressed={showPeaks}
          className="rounded-[var(--radius-badge)] px-3 py-1.5 text-xs"
          style={{
            border: `2px solid ${showPeaks ? 'var(--accent-primary)' : 'var(--surface-border)'}`,
            color: showPeaks ? 'var(--text-primary)' : 'var(--text-muted)',
          }}
        >
          ▼ Accepted peaks ({ex.peaks.length})
        </button>
        <button
          type="button"
          onClick={() => setShowNoise((v) => !v)}
          aria-pressed={showNoise}
          className="rounded-[var(--radius-badge)] px-3 py-1.5 text-xs"
          style={{
            border: `2px solid ${showNoise ? 'var(--status-amorphous)' : 'var(--surface-border)'}`,
            color: showNoise ? 'var(--text-primary)' : 'var(--text-muted)',
          }}
        >
          3σ detection threshold
        </button>
      </div>

      {/* --- descriptores --- */}
      <Card>
        <div className="flex flex-wrap items-baseline gap-3">
          <h3 className="text-base">Descriptors extracted from this scan</h3>
          <Badge tone={CLASS_TONE[klass]}>{CLASS_LABEL[klass]}</Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {ex.descriptors.map((d) => (
            <div key={d.label}>
              <div
                className="mono text-xl"
                style={{ color: 'var(--accent-primary)' }}
              >
                {d.value === null ? '—' : d.value}
                {d.unit && <span className="text-sm"> {d.unit}</span>}
              </div>
              <div className="mt-1 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {d.label}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-5 text-sm" style={{ color: 'var(--text-secondary)' }}>
          These eight are the ones you can read straight off the figure. The full vector has 29, and every
          one of them is stored per scan.
        </p>
      </Card>
    </div>
  )
}
