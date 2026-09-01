import { useMemo, useState } from 'react'
import { Badge, Button, Card, Placeholder, SectionTitle, Term } from '../components/ui.jsx'

/* Metales con propiedades intrinsecas, como pidio Ruben: una tabla tocable
   donde detras de cada metal estan sus descriptores. Valores del catalogo
   element_properties; en produccion vendran de GET /api/v1/metals. */
const METALS = [
  { symbol: 'Zr', name: 'Zirconium', en: 1.33, oxo: 1.32, hard: 3.2 },
  { symbol: 'Ti', name: 'Titanium', en: 1.54, oxo: 1.28, hard: 3.4 },
  { symbol: 'Ce', name: 'Cerium', en: 1.12, oxo: 1.35, hard: 3.0 },
  { symbol: 'Hf', name: 'Hafnium', en: 1.3, oxo: 1.33, hard: 3.2 },
  { symbol: 'Fe', name: 'Iron', en: 1.83, oxo: 1.05, hard: 3.8 },
  { symbol: 'Cu', name: 'Copper', en: 1.9, oxo: 0.84, hard: 3.4 },
  { symbol: 'Ca', name: 'Calcium', en: 1.0, oxo: 1.18, hard: 4.0 },
  { symbol: 'Mg', name: 'Magnesium', en: 1.31, oxo: 1.15, hard: 4.7 },
  { symbol: 'Bi', name: 'Bismuth', en: 2.02, oxo: 0.95, hard: 3.7 },
  { symbol: 'Co', name: 'Cobalt', en: 1.88, oxo: 1.0, hard: 3.6 },
  { symbol: 'Ni', name: 'Nickel', en: 1.91, oxo: 0.98, hard: 3.3 },
]

function Slider({ label, unit, min, max, step, value, onChange }) {
  return (
    <label className="block">
      <span className="flex justify-between text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
        {label}
        <span className="mono" style={{ color: 'var(--accent-primary)' }}>
          {value} {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full"
        style={{ accentColor: 'var(--accent-primary)' }}
      />
    </label>
  )
}

export default function TheModel() {
  const [metal, setMetal] = useState('Zr')
  const [temp, setTemp] = useState(120)
  const [hours, setHours] = useState(24)
  const [modulator, setModulator] = useState(1.5)
  const [ratio, setRatio] = useState(2.0)

  /* MOCK. Superficie suave y deterministica, solo para que la interfaz viva.
     Se sustituye por POST /api/v1/predict/phase cuando exista el backend.
     NO es la salida del modelo real y no debe presentarse como tal. */
  const prediction = useMemo(() => {
    const m = METALS.find((x) => x.symbol === metal) ?? METALS[0]
    const tOpt = 100 + m.oxo * 30
    const tScore = Math.exp(-((temp - tOpt) ** 2) / 1800)
    const modScore = Math.exp(-((modulator - m.oxo * 1.6) ** 2) / 2.2)
    const timeScore = Math.min(1, hours / 24)
    const ratioScore = Math.exp(-((ratio - 2.2) ** 2) / 3)
    const p = tScore * 0.4 + modScore * 0.3 + timeScore * 0.15 + ratioScore * 0.15
    const pct = Math.round(p * 100)
    if (pct >= 70) return { pct, label: 'Pure crystalline phase', tone: 'pure' }
    if (pct >= 40) return { pct, label: 'Incipient / mixed', tone: 'incipient' }
    return { pct, label: 'Amorphous solid', tone: 'amorphous' }
  }, [metal, temp, hours, modulator, ratio])

  return (
    <div className="flex flex-col gap-16">
      <section>
        <Badge tone="accent">06 · The Model</Badge>
        <h1 className="mt-4 text-3xl uppercase md:text-5xl" style={{ fontFamily: 'var(--font-display)', letterSpacing: '2px' }}>
          Simulator, Registry &amp; Active Learning
        </h1>
        <p className="mt-6 max-w-3xl text-lg" style={{ color: 'var(--text-secondary)' }}>
          Play with the synthesis conditions and watch the prediction move — then see the governance that
          keeps this from being a loose pickle file.
        </p>
      </section>

      <section>
        <SectionTitle eyebrow="The virtual lab">In-silico synthesis</SectionTitle>

        <div
          className="mb-6 rounded-[var(--radius-card)] p-4 text-sm"
          style={{ border: '2px dashed var(--status-incipient)', color: 'var(--text-secondary)' }}
        >
          <strong style={{ color: 'var(--status-incipient)' }}>Demonstration surface.</strong> This skeleton
          uses a smooth placeholder function so the interface can be built and reviewed. It is not the
          trained classifier and its numbers mean nothing yet.
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Card>
            <h3 className="text-base uppercase tracking-wider">Conditions</h3>

            <div className="mt-4">
              <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                Metal centre
              </span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {METALS.map((m) => (
                  <button
                    key={m.symbol}
                    type="button"
                    onClick={() => setMetal(m.symbol)}
                    title={`${m.name} · electronegativity ${m.en} · oxophilicity ${m.oxo}`}
                    className="mono rounded-[var(--radius-badge)] px-2.5 py-1 text-sm"
                    style={{
                      border: `2px solid ${metal === m.symbol ? 'var(--accent-primary)' : 'var(--surface-border)'}`,
                      background: metal === m.symbol ? 'var(--accent-primary)' : 'transparent',
                      color: metal === m.symbol ? 'var(--surface)' : 'var(--text-secondary)',
                    }}
                  >
                    {m.symbol}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                Each metal carries its own descriptors — electronegativity, oxophilicity, hardness, ionic
                radius. The model never sees the symbol as a bare category.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-5">
              <Slider label="Temperature" unit="°C" min={80} max={220} step={5} value={temp} onChange={setTemp} />
              <Slider label="Reaction time" unit="h" min={1} max={72} step={1} value={hours} onChange={setHours} />
              <Slider label="Acid modulator" unit="mmol" min={0} max={5} step={0.1} value={modulator} onChange={setModulator} />
              <Slider label="Ligand : metal ratio" unit="" min={0.5} max={6} step={0.1} value={ratio} onChange={setRatio} />
            </div>
          </Card>

          <Card accent>
            <h3 className="text-base uppercase tracking-wider">Predicted outcome</h3>
            <div
              className="mt-6 text-5xl md:text-6xl"
              style={{ fontFamily: 'var(--font-display)', color: `var(--status-${prediction.tone})` }}
            >
              {prediction.pct}%
            </div>
            <div className="mt-3">
              <Badge tone={prediction.tone}>{prediction.label}</Badge>
            </div>
            <div
              className="mt-6 h-3 w-full overflow-hidden rounded"
              style={{ border: '2px solid var(--surface-border)' }}
              role="img"
              aria-label={`Confidence ${prediction.pct} percent`}
            >
              <div
                className="h-full transition-all"
                style={{ width: `${prediction.pct}%`, background: `var(--status-${prediction.tone})` }}
              />
            </div>
            <p className="mt-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
              In production this calls <code>POST /api/v1/predict/phase</code> and returns the verdict of{' '}
              <code>crystallinity_v3_hts_actionable</code>, together with the model version that produced
              it.
            </p>
            <div className="mt-6">
              <Button variant="secondary" onClick={() => { setTemp(120); setHours(24); setModulator(1.5); setRatio(2.0) }}>
                Reset to baseline
              </Button>
            </div>
          </Card>
        </div>
      </section>

      <section>
        <SectionTitle eyebrow="Closing the loop">Design tomorrow&rsquo;s 24-well block</SectionTitle>
        <Placeholder source="notebooks/06_...ipynb (section 9)">
          Pending: the model proposes 24 conditions — exactly one multi-autoclave block — ranked by
          probability of yielding a crystalline phase. The platform hands the lab back its own working
          format.
        </Placeholder>
      </section>

      <section>
        <SectionTitle eyebrow="Governance">The model registry</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Five relational tables and one view hold the full lineage of every model: the exact git
              commit, hyperparameters, excluded variables <em>with their scientific justification</em>,
              metrics in long format, and the serialized binary — all under strict CHECK constraints, and
              included in the database backup routine.
            </p>
          </Card>
          <Card accent>
            <h3 className="text-base">The <code>-dirty</code> suffix</h3>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              If a model is trained while the working tree has uncommitted changes, the recorded commit
              hash gets a <code>-dirty</code> suffix. It is a small thing, and it is the difference between
              a lineage record you can trust and one you merely hope is right.
            </p>
          </Card>
        </div>
      </section>

      <section>
        <SectionTitle eyebrow="Feedback">Active learning</SectionTitle>
        <Card>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            The loop identifies the regions where the model hesitates between incipient and amorphous — the
            crystallization boundary — and prioritises them for the next real experiments. Prediction feeds
            the bench; the bench feeds the next model version.
          </p>
        </Card>
      </section>

      <section>
        <SectionTitle eyebrow="Deliverable">One-page technical datasheet</SectionTitle>
        <Placeholder source="design_system/templates/, n8n">
          Pending: a printable one-page report per sample with pseudonymized identifier, conditions, the
          analysed diffractogram and the model verdict, generated automatically.
        </Placeholder>
      </section>
    </div>
  )
}
