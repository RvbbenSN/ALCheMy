import { Link } from 'react-router-dom'
import { BIO_PULLQUOTE, BIO_SHORT, KPIS, PILLARS, SCREENS } from '../content/site.js'
import { Button, Card, KpiCard, SectionTitle, Term } from '../components/ui.jsx'
import StackGrid from '../components/StackGrid.jsx'

export default function Overview() {
  return (
    <div className="flex flex-col gap-16">
      {/* --- Hero --- */}
      <section>
        {/* Lockup completo: el cristal con el nombre debajo, igual que en el pie.
            En la barra superior se usa solo el isotipo, que es donde encaja. */}
        <span
          className="logo-lockup mb-8 block"
          role="img"
          aria-label="ALCheMy"
          style={{
            width: 'clamp(190px, 26vw, 280px)',
            height: 'clamp(104px, 14vw, 153px)',
            color: 'var(--accent-primary)',
          }}
        />
        <h1
          className="max-w-4xl text-4xl uppercase md:text-6xl"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '2.5px' }}
        >
          Autonomous Lab for Chemistry, Materials &amp; In-Silico Synthesis
        </h1>
        <p className="mt-6 max-w-3xl text-lg" style={{ color: 'var(--text-secondary)' }}>
          A materials-informatics and data-driven ecosystem built on agentic AI, data engineering and
          governed <Term k="MLOps" />. It accelerates the discovery of advanced hybrid coordination
          polymers — <Term k="MOF">metal-organic frameworks</Term> — replacing trial-and-error
          chemistry with guided in-silico screening.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button href="/the-model">Try the in-silico simulator</Button>
          <Button href="/data-collection" variant="secondary">
            See the end-to-end flow
          </Button>
        </div>
      </section>

      {/* --- KPIs --- */}
      <section>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {KPIS.map((k) => (
            <KpiCard key={k.label} {...k} />
          ))}
        </div>
        <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          Counts read live from PostgreSQL. Verified 2026-09-01.
        </p>
      </section>

      {/* --- Tres pilares --- */}
      <section>
        <SectionTitle eyebrow="What holds it up">Three synchronized pillars</SectionTitle>
        <div className="grid gap-6 lg:grid-cols-3">
          {PILLARS.map((p) => (
            <Card key={p.key} accent>
              <h3 className="text-lg">{p.title}</h3>
              <p className="mt-1 text-sm" style={{ color: 'var(--accent-secondary-text)' }}>
                {p.subtitle}
              </p>
              <ul className="mt-4 flex list-none flex-col gap-3 p-0 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {p.points.map((pt, i) => (
                  <li key={i} style={{ borderLeft: '2px solid var(--surface-border)', paddingLeft: '0.75rem' }}>
                    {pt}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      {/* --- Mapa CRISP-DM --- */}
      <section>
        <SectionTitle eyebrow="How to read this site">
          The tabs follow <Term k="CRISP-DM" /> in order
        </SectionTitle>
        <p className="mb-6 max-w-3xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          This is not a catalogue of features. Each tab is one phase of the data lifecycle, in the order
          the decisions were actually made — how the data arrived, how it was cleaned, what it turned out
          to say, and only then what a model could learn from it.
        </p>
        <ol className="grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {SCREENS.map((s) => (
            <li key={s.id}>
              <Link to={`/${s.slug}`} className="block no-underline">
                <Card className="h-full transition-transform hover:-translate-y-1">
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {s.id} · {s.crisp}
                  </div>
                  <div className="mt-1 text-base" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                    {s.title}
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* --- Bio corta --- */}
      <section>
        <SectionTitle eyebrow="Who is behind it">About the author</SectionTitle>
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card>
            {BIO_SHORT.map((p, i) => (
              <p key={i} className={i ? 'mt-4' : ''} style={{ color: 'var(--text-secondary)' }}>
                {p}
              </p>
            ))}
            <blockquote
              className="mt-6 p-4 text-lg italic"
              style={{
                borderLeft: '4px solid var(--accent-primary)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-heading)',
              }}
            >
              {BIO_PULLQUOTE}
            </blockquote>
            <div className="mt-6">
              <Button href="/about" variant="secondary">
                Full CV and publications
              </Button>
            </div>
          </Card>
          <Card>
            <h3 className="text-base uppercase tracking-wider">Stack</h3>
            <div className="mt-5">
              <StackGrid />
            </div>
          </Card>
        </div>
      </section>
    </div>
  )
}
