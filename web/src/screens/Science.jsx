import { useState } from 'react'
import DataScale from '../components/DataScale.jsx'
import LabDiagram from '../components/LabDiagram.jsx'
import { Link } from 'react-router-dom'
import {
  Atom,
  AudioWaveform,
  ChevronDown,
  ChevronRight,
  Expand,
  Flame,
  FlaskConical,
  Grid3x3,
  Microscope,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Thermometer,
  Waves,
  Wind,
} from 'lucide-react'
import { LAB_CYCLE } from '../content/site.js'
import {
  BOTTLENECK,
  LAB_INTRO,
  MOF_DEF,
  MOF_FACTS,
  MOF_NAMING,
  NOBEL,
  SCIENCE_INTRO,
  TECHNIQUES,
  DATA_SCALE,
  WHY_CHARACTERISE,
} from '../content/science.js'
import { Badge, Card, Note, Rich, SectionTitle, Term } from '../components/ui.jsx'

const FACT_ICON = { grid: Grid3x3, expand: Expand, sliders: SlidersHorizontal, flask: FlaskConical }

/* Los pasos del ciclo de laboratorio, desplegables. Como pidio Ruben: una
   secuencia de hitos que se abren, en vez de cuatro bloques de texto seguidos
   que nadie termina de leer. */
function LabStep({ step, isLast, open, onOpen }) {
  return (
    <li>
      <div className="flex gap-4">
        {/* raíl vertical que une los hitos */}
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={onOpen}
            aria-expanded={open}
            aria-label={`${open ? 'Collapse' : 'Expand'} step ${step.step}: ${step.title}`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg transition-transform hover:scale-105"
            style={{
              border: '2.5px solid var(--accent-primary)',
              background: open ? 'var(--accent-primary)' : 'var(--surface)',
              color: open ? 'var(--surface)' : 'var(--accent-primary)',
              fontFamily: 'var(--font-display)',
            }}
          >
            <Rich>{step.step}</Rich>
          </button>
          {!isLast && <div className="w-0.5 flex-1" style={{ background: 'var(--surface-border)', minHeight: 16 }} />}
        </div>

        <div className="min-w-0 flex-1 pb-4">
          <button
            type="button"
            onClick={onOpen}
            className="flex w-full items-center gap-2 border-0 bg-transparent p-0 text-left"
          >
            <h3 className="text-lg" style={{ color: 'var(--text-primary)' }}>
              <Rich>{step.title}</Rich>
            </h3>
            <ChevronDown
              size={18}
              aria-hidden
              style={{
                color: 'var(--accent-primary)',
                transform: open ? 'rotate(180deg)' : 'none',
                transition: 'transform 150ms',
                flexShrink: 0,
              }}
            />
          </button>

          {open && (
            <div className="mt-3">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                <Rich>{step.body}</Rich>
              </p>
              {step.highlight && (
                <p
                  className="mt-3 p-3 text-sm"
                  style={{
                    borderLeft: '4px solid var(--accent-secondary)',
                    background: 'var(--surface-elevated)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <Rich>{step.highlight}</Rich>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

/* El mismo simbolo que lleva cada tecnica en el embudo de datos, para que las
   dos figuras se lean como una sola: el icono que aqui se aprende, alli se
   reconoce sin leyenda. */
const TECH_ICONS = {
  waves: Waves,
  flame: Flame,
  thermometer: Thermometer,
  wind: Wind,
  audio: AudioWaveform,
  sparkles: Sparkles,
  atom: Atom,
  microscope: Microscope,
  sun: Sun,
}

function TechIcon({ name, primary }) {
  const Icon = TECH_ICONS[name]
  if (!Icon) return null
  return (
    <Icon
      size={16}
      aria-hidden
      style={{ color: primary ? 'var(--accent-primary)' : 'var(--text-muted)' }}
    />
  )
}

export default function Science() {
  const [openStep, setOpenStep] = useState('1')
  const [openTech, setOpenTech] = useState(null)

  return (
    <div className="flex flex-col gap-16">
      <section>
        <Badge tone="accent">01 · The Science</Badge>
        <h1 className="mt-4 text-3xl uppercase md:text-5xl" style={{ fontFamily: 'var(--font-display)', letterSpacing: '2px' }}>
          MOFs &amp; Lab Daily-life
        </h1>
        <p className="mt-6 max-w-3xl text-lg" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{SCIENCE_INTRO}</Rich>
        </p>
      </section>

      {/* --- 1. Que es un MOF --- */}
      <section>
        <SectionTitle eyebrow="The material">
          What is a {MOF_DEF.acronym}?
        </SectionTitle>

        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          <div className="flex flex-col gap-4">
            <Card accent>
              <div className="text-xs uppercase tracking-[2px]" style={{ color: 'var(--accent-secondary-text)' }}>
                {MOF_DEF.acronym} — {MOF_DEF.expansion}
              </div>
              <blockquote
                className="mt-3 text-lg"
                style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', margin: 0 }}
              >
                &ldquo;{MOF_DEF.iupac}&rdquo;
              </blockquote>
              <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                <Rich>{MOF_DEF.iupacNote}</Rich>
              </div>
              <p className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <Rich>{MOF_DEF.plain}</Rich>
              </p>
              <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <Rich>{MOF_DEF.why}</Rich>
              </p>
            </Card>

            <Card>
              <h3 className="text-base"><Rich>{MOF_NAMING.title}</Rich></h3>
              <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <Rich>{MOF_NAMING.body}</Rich>
              </p>
            </Card>
          </div>

          <Card accent>
            <div className="text-xs uppercase tracking-[2px]" style={{ color: 'var(--accent-secondary-text)' }}>
              <Rich>{NOBEL.year}</Rich>
            </div>
            <div className="mt-2 text-2xl" style={{ fontFamily: 'var(--font-display)', letterSpacing: '1px' }}>
              <Rich>{NOBEL.title}</Rich>
            </div>
            <img
              src="/nobel-2025.jpg"
              alt="Illustrated portraits of the 2025 Nobel laureates in Chemistry"
              loading="lazy"
              className="mt-4"
              style={{
                display: 'block',
                width: '100%',
                height: 'auto',
                borderRadius: 'var(--radius-badge)',
                border: '2px solid var(--surface-border)',
              }}
            />
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <strong><Rich>{NOBEL.laureates}</Rich></strong>. {NOBEL.reason}
            </p>
            <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <Rich>{NOBEL.credit}</Rich>
            </p>
          </Card>
        </div>

        {/* Los cuatro rasgos, con icono */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MOF_FACTS.map((f) => {
            const Icon = FACT_ICON[f.icon]
            return (
              <Card key={f.title}>
                <Icon size={26} aria-hidden style={{ color: 'var(--accent-primary)' }} />
                <h3 className="mt-3 text-base"><Rich>{f.title}</Rich></h3>
                <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <Rich>{f.body}</Rich>
                </p>
              </Card>
            )
          })}
        </div>

        {/* La imagen va DESPUES de la explicacion, como se pidio */}
        <figure className="m-0 mt-8">
          <img
            src="/mof-formation.jpg"
            alt="Rendering of metal nodes, shown as golden octahedra, linked by burgundy organic ligands into an extended porous framework"
            loading="lazy"
            style={{
              display: 'block',
              width: '100%',
              height: 'auto',
              borderRadius: 'var(--radius-card)',
              border: 'var(--border-card) solid var(--surface-border)',
            }}
          />
          <figcaption className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
            Metal nodes, drawn as octahedra, joined by organic linkers into an extended network.
          </figcaption>
        </figure>
      </section>

      {/* --- 2. Por que hay que caracterizar --- */}
      <section>
        <SectionTitle eyebrow="Characterisation"><Rich>{WHY_CHARACTERISE.title}</Rich></SectionTitle>

        <p className="max-w-3xl text-lg" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{WHY_CHARACTERISE.lead}</Rich>
        </p>

        <Note>
          <Rich>{WHY_CHARACTERISE.consequence}</Rich>
          <span className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
            {WHY_CHARACTERISE.numbers.map(([v, l]) => (
              <span key={l} className="flex items-baseline gap-2">
                <span
                  className="text-xl leading-none"
                  style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-primary)' }}
                >
                  {v}
                </span>
                <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  {l}
                </span>
              </span>
            ))}
          </span>
        </Note>

        <p className="mb-4 mt-8 text-sm" style={{ color: 'var(--text-muted)' }}>
          The nine techniques behind this platform. Each answers one question; none answers two.
        </p>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {TECHNIQUES.map((t) => (
            <button
              key={t.abbr}
              type="button"
              onClick={() => setOpenTech(openTech === t.abbr ? null : t.abbr)}
              aria-expanded={openTech === t.abbr}
              className="rounded-[var(--radius-card)] p-4 text-left"
              style={{
                border: `var(--border-card) solid ${t.primary ? 'var(--accent-primary)' : 'var(--surface-border)'}`,
                background: 'var(--surface)',
                boxShadow: t.primary ? 'var(--shadow-card)' : 'none',
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <TechIcon name={t.icon} primary={t.primary} />
                  <span className="mono text-sm" style={{ color: 'var(--accent-primary)' }}>
                    <Rich>{t.abbr}</Rich>
                  </span>
                </span>
                <ChevronDown
                  size={15}
                  aria-hidden
                  style={{
                    color: 'var(--text-muted)',
                    transform: openTech === t.abbr ? 'rotate(180deg)' : 'none',
                    transition: 'transform 150ms',
                  }}
                />
              </div>
              <div className="mt-1 text-sm" style={{ color: 'var(--text-primary)' }}>
                <Rich>{t.name}</Rich>
              </div>
              <div className="mt-2 text-xs italic" style={{ color: 'var(--text-secondary)' }}>
                <Rich>{t.answers}</Rich>
              </div>
              {openTech === t.abbr && (
                <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <Rich>{t.body}</Rich>
                </p>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* --- 3. El dia en el laboratorio --- */}
      <section>
        <SectionTitle eyebrow="Inside the lab"><Rich>{LAB_INTRO.title}</Rich></SectionTitle>
        <p className="mb-8 max-w-3xl text-lg" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{LAB_INTRO.lead}</Rich>
        </p>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start">
          <ol className="flex list-none flex-col p-0">
            {LAB_CYCLE.map((s, i) => (
              <LabStep
                key={s.step}
                step={s}
                isLast={i === LAB_CYCLE.length - 1}
                open={openStep === s.step}
                onOpen={() => setOpenStep(s.step)}
              />
            ))}
          </ol>

          <figure className="m-0 lg:sticky lg:top-24">
            <LabDiagram steps={LAB_CYCLE} active={openStep} onPick={setOpenStep} />
            <figcaption className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              Schematic, not to scale. Pick a number or a panel to jump to that step.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* --- 4. El cuello de botella --- */}
      <section>
        <SectionTitle eyebrow="The bottleneck"><Rich>{BOTTLENECK.title}</Rich></SectionTitle>

        <h3 className="text-lg"><Rich>{DATA_SCALE.title}</Rich></h3>
        <p className="mb-6 mt-2 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{DATA_SCALE.lead}</Rich>
        </p>
        <DataScale />

        <p className="mt-8 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{BOTTLENECK.scale}</Rich>
        </p>
        <p className="mt-4 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{BOTTLENECK.problem}</Rich>
        </p>

        <Note>
          <Rich>{BOTTLENECK.turn}</Rich>
        </Note>
      </section>

      {/* --- 5. Gancho hacia la 02 --- */}
      <section>
        <SectionTitle eyebrow="Next">
          <Rich>{BOTTLENECK.hookTitle}</Rich>
        </SectionTitle>
        <Card>
          <p style={{ color: 'var(--text-secondary)' }}>
            <Rich>{BOTTLENECK.hook}</Rich>
          </p>
          <Link
            to="/data-collection"
            className="mt-4 inline-flex items-center gap-1.5 text-sm no-underline"
            style={{ color: 'var(--accent-primary)' }}
          >
            The ingestion workflow
            <ChevronRight size={15} aria-hidden />
          </Link>
        </Card>
      </section>
    </div>
  )
}
