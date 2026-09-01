import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card } from './ui.jsx'

/* --------------------------------------------------------------------------
   Simulator — predicciones del modelo real, servidas desde una rejilla.

   No hay backend y no se descarga el modelo. Lo que viaja al navegador son las
   respuestas ya calculadas para cada combinacion que el usuario puede elegir
   (scripts/build_simulator_grid.py). Eso tiene una consecuencia util ademas de
   la tecnica: **nadie puede sondear el modelo**. Sin un endpoint al que
   preguntar, no hay forma de hacerle miles de consultas para reconstruir la
   quimica que aprendio.

   El precio es que la rejilla cuantiza: los controles saltan entre los pasos
   precalculados en vez de moverse de forma continua. Se dice en pantalla.

   Los ejes no salen del rango observado en el laboratorio. Dejar pedir 200 C
   cuando el historico llega a 160 seria invitar al modelo a extrapolar y
   presentar el resultado como si valiera lo mismo.
   -------------------------------------------------------------------------- */

const LABEL = {
  temp_target_c: { text: 'Target temperature', unit: '°C' },
  time_hours: { text: 'Reaction time', unit: 'h' },
  lm_ratio: { text: 'Ligand : metal ratio', unit: '' },
  mod_carboxylic_mmol: { text: 'Carboxylic modulator', unit: 'mmol' },
}

const CLASS_UI = {
  AMORFO: { tone: 'amorphous', text: 'Amorphous solid' },
  INCIPIENTE: { tone: 'incipient', text: 'Incipient / mixed' },
  CRISTALINO: { tone: 'pure', text: 'Pure crystalline phase' },
}

function decode(base64) {
  const bin = atob(base64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function lookup(grid, bytes, metalIdx, idx) {
  // Orden C: metal, luego cada eje en el orden declarado.
  const axisKeys = grid.axisOrder.slice(1)
  let flat = metalIdx
  for (let a = 0; a < axisKeys.length; a++) {
    flat = flat * grid.axes[axisKeys[a]].length + idx[a]
  }
  const o = flat * 3
  const raw = [bytes[o], bytes[o + 1], bytes[o + 2]]
  const sum = raw[0] + raw[1] + raw[2] || 1
  return raw.map((v) => v / sum)
}

function StepSlider({ axis, values, index, onChange }) {
  const l = LABEL[axis]
  return (
    <label className="block">
      <span className="flex justify-between text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
        {l.text}
        <span className="mono" style={{ color: 'var(--accent-primary)' }}>
          {values[index]} {l.unit}
        </span>
      </span>
      <input
        type="range"
        min={0}
        max={values.length - 1}
        step={1}
        value={index}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full"
        style={{ accentColor: 'var(--accent-primary)' }}
        aria-valuetext={`${values[index]} ${l.unit}`}
      />
      <span className="mono flex justify-between text-[10px]" style={{ color: 'var(--text-muted)' }}>
        <span>{values[0]}</span>
        <span>{values[values.length - 1]}</span>
      </span>
    </label>
  )
}

export default function Simulator() {
  const [grid, setGrid] = useState(null)
  const [bytes, setBytes] = useState(null)
  const [failed, setFailed] = useState(false)
  const [metal, setMetal] = useState(0)
  const [idx, setIdx] = useState(null)

  // La rejilla se descarga al entrar a esta pantalla, no con el resto de la
  // aplicacion: son 152 KB que solo necesita quien abre el simulador.
  useEffect(() => {
    let alive = true
    fetch('/data/simulator_grid.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then((g) => {
        if (!alive) return
        setGrid(g)
        setBytes(decode(g.data))
        const zr = g.metals.indexOf('Zr')
        setMetal(zr >= 0 ? zr : 0)
        setIdx(g.axisOrder.slice(1).map((a) => Math.floor(g.axes[a].length / 2)))
      })
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [])

  const probs = useMemo(
    () => (grid && bytes && idx ? lookup(grid, bytes, metal, idx) : null),
    [grid, bytes, metal, idx],
  )

  if (failed) {
    return (
      <Card>
        <p style={{ color: 'var(--status-amorphous)' }}>
          The prediction grid could not be loaded, so the simulator is unavailable right now.
        </p>
      </Card>
    )
  }

  if (!grid || !probs) {
    return (
      <Card>
        <p style={{ color: 'var(--text-muted)' }}>Loading the prediction grid…</p>
      </Card>
    )
  }

  const AXIS_KEYS = grid.axisOrder.slice(1)
  const GRID = grid
  const defaults = AXIS_KEYS.map((a) => Math.floor(grid.axes[a].length / 2))
  const best = probs.indexOf(Math.max(...probs))
  const klass = GRID.classes[best]
  const ui = CLASS_UI[klass]
  const pct = Math.round(probs[best] * 100)

  const setAxis = (a, v) => setIdx((s) => s.map((x, i) => (i === a ? v : x)))

  return (
    <div className="flex flex-col gap-4">
      <div
        className="rounded-[var(--radius-card)] p-4 text-sm"
        style={{ border: '2px solid var(--accent-tertiary)', color: 'var(--text-secondary)' }}
      >
        <strong style={{ color: 'var(--text-primary)' }}>These are real predictions.</strong> They come from{' '}
        <code>{GRID.model}</code>, the Random Forest in the model registry, evaluated ahead of time over
        every combination below. The controls step between precomputed values rather than sliding
        continuously, and they stop at the limits actually explored in the laboratory — asking the model
        about 200 °C when the record ends at 160 would be extrapolation dressed as a prediction.
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <h3 className="text-base uppercase tracking-wider">Conditions</h3>

          <div className="mt-4">
            <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              Metal centre
            </span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {GRID.metals.map((m, i) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMetal(i)}
                  aria-pressed={metal === i}
                  className="mono rounded-[var(--radius-badge)] px-2.5 py-1 text-sm"
                  style={{
                    border: `2px solid ${metal === i ? 'var(--accent-primary)' : 'var(--surface-border)'}`,
                    background: metal === i ? 'var(--accent-primary)' : 'transparent',
                    color: metal === i ? 'var(--surface)' : 'var(--text-secondary)',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              Each metal starts from the median real synthesis made with it, so everything not exposed
              here — the ligand, the solvents, the volumes — stays chemically plausible instead of being
              an average of incompatible recipes. The ligand is deliberately not shown.
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-5">
            {AXIS_KEYS.map((a, i) => (
              <StepSlider
                key={a}
                axis={a}
                values={GRID.axes[a]}
                index={idx[i]}
                onChange={(v) => setAxis(i, v)}
              />
            ))}
          </div>

          <div className="mt-6">
            <Button variant="secondary" onClick={() => setIdx(defaults)}>
              Reset
            </Button>
          </div>
        </Card>

        <Card accent>
          <h3 className="text-base uppercase tracking-wider">Predicted outcome</h3>
          <div
            className="mt-6 text-5xl md:text-6xl"
            style={{ fontFamily: 'var(--font-display)', color: `var(--status-${ui.tone})` }}
          >
            {pct}%
          </div>
          <div className="mt-3">
            <Badge tone={ui.tone}>{ui.text}</Badge>
          </div>

          {/* Las tres probabilidades, no solo la ganadora: es lo que de verdad
              dice el modelo, y donde se ve si duda. */}
          <div className="mt-6 flex flex-col gap-3">
            {GRID.classes.map((c, i) => (
              <div key={c}>
                <div className="flex items-baseline justify-between text-xs">
                  <span style={{ color: 'var(--text-secondary)' }}>{CLASS_UI[c].text}</span>
                  <span className="mono" style={{ color: `var(--status-${CLASS_UI[c].tone})` }}>
                    {(probs[i] * 100).toFixed(1)}%
                  </span>
                </div>
                <div
                  className="mt-1 h-2.5 w-full overflow-hidden rounded-sm"
                  style={{ background: 'var(--surface-elevated)', border: '1px solid var(--surface-border)' }}
                >
                  <div
                    style={{
                      width: `${probs[i] * 100}%`,
                      height: '100%',
                      background: `var(--status-${CLASS_UI[c].tone})`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
            A classifier never returns just a label: it returns one probability per class, and the label
            is simply the largest. When two bars are close, the model is guessing — and those are exactly
            the syntheses worth running next.
          </p>
        </Card>
      </div>
    </div>
  )
}
