import { useState } from 'react'
import {
  ChevronDown,
  Expand,
  FlaskConical,
  Grid3x3,
  SlidersHorizontal,
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
  WHY_CHARACTERISE,
} from '../content/science.js'
import { Badge, Card, Rich, SectionTitle, Term } from '../components/ui.jsx'

const FACT_ICON = { grid: Grid3x3, expand: Expand, sliders: SlidersHorizontal, flask: FlaskConical }

/* Los pasos del ciclo de laboratorio, desplegables. Como pidio Ruben: una
   secuencia de hitos que se abren, en vez de cuatro bloques de texto seguidos
   que nadie termina de leer. */
function LabStep({ step, isLast, open, onToggle }) {
  return (
    <li>
      <div className="flex gap-4">
        {/* raíl vertical que une los hitos */}
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={onToggle}
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
            {step.step}
          </button>
          {!isLast && <div className="w-0.5 flex-1" style={{ background: 'var(--surface-border)', minHeight: 16 }} />}
        </div>

        <div className="min-w-0 flex-1 pb-4">
          <button
            type="button"
            onClick={onToggle}
            className="flex w-full items-center gap-2 border-0 bg-transparent p-0 text-left"
          >
            <h3 className="text-lg" style={{ color: 'var(--text-primary)' }}>
              {step.title}
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
                {step.body}
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
                  {step.highlight}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
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
          {SCIENCE_INTRO}
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
                {MOF_DEF.iupacNote}
              </div>
              <p className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {MOF_DEF.plain}
              </p>
              <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {MOF_DEF.why}
              </p>
            </Card>

            <Card>
              <h3 className="text-base">{MOF_NAMING.title}</h3>
              <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {MOF_NAMING.body}
              </p>
            </Card>
          </div>

          <Card accent>
            <div className="text-xs uppercase tracking-[2px]" style={{ color: 'var(--accent-secondary-text)' }}>
              {NOBEL.year}
            </div>
            <div className="mt-2 text-2xl" style={{ fontFamily: 'var(--font-display)', letterSpacing: '1px' }}>
              {NOBEL.title}
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
              <strong>{NOBEL.laureates}</strong>. {NOBEL.reason}
            </p>
            <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              {NOBEL.credit}
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
                <h3 className="mt-3 text-base">{f.title}</h3>
                <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {f.body}
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
        <SectionTitle eyebrow="Characterisation">{WHY_CHARACTERISE.title}</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <p style={{ color: 'var(--text-secondary)' }}>{WHY_CHARACTERISE.body}</p>
          </Card>
          <Card accent>
            <p style={{ color: 'var(--text-secondary)' }}>{WHY_CHARACTERISE.consequence}</p>
          </Card>
        </div>

        <p className="mb-4 mt-6 text-sm" style={{ color: 'var(--text-muted)' }}>
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
                <span className="mono text-sm" style={{ color: 'var(--accent-primary)' }}>
                  {t.abbr}
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
                {t.name}
              </div>
              <div className="mt-2 text-xs italic" style={{ color: 'var(--text-secondary)' }}>
                {t.answers}
              </div>
              {openTech === t.abbr && (
                <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {t.body}
                </p>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* --- 3. El dia en el laboratorio --- */}
      <section>
        <SectionTitle eyebrow="Inside the lab">{LAB_INTRO.title}</SectionTitle>
        <div className="mb-8 grid gap-4 lg:grid-cols-2">
          <Card>
            <p style={{ color: 'var(--text-secondary)' }}>{LAB_INTRO.body}</p>
          </Card>
          <Card accent>
            <p style={{ color: 'var(--text-secondary)' }}>{LAB_INTRO.cadence}</p>
          </Card>
        </div>

        <ol className="flex list-none flex-col p-0">
          {LAB_CYCLE.map((s, i) => (
            <LabStep
              key={s.step}
              step={s}
              isLast={i === LAB_CYCLE.length - 1}
              open={openStep === s.step}
              onToggle={() => setOpenStep(openStep === s.step ? null : s.step)}
            />
          ))}
        </ol>
      </section>

      {/* --- 4. El cuello de botella --- */}
      <section>
        <SectionTitle eyebrow="The bottleneck">{BOTTLENECK.title}</SectionTitle>
        <div className="flex flex-col gap-4">
          <Card>
            <p style={{ color: 'var(--text-secondary)' }}>{BOTTLENECK.scale}</p>
          </Card>
          <Card>
            <p style={{ color: 'var(--text-secondary)' }}>{BOTTLENECK.problem}</p>
          </Card>
          <Card accent>
            <p className="text-lg" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
              {BOTTLENECK.turn}
            </p>
          </Card>
        </div>
      </section>
    </div>
  )
}
