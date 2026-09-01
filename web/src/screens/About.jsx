import { SITE } from '../content/site.js'
import { Badge, Button, Card, Placeholder, SectionTitle } from '../components/ui.jsx'

const TIMELINE = [
  { when: '2015 – 2020', what: 'BSc in Chemistry', where: 'Spain', note: "Thesis 9.3/10" },
  { when: '2020 – 2021', what: 'MSc in Chemical Science & Technology', where: 'Spain', note: 'Thesis 9.4/10 · overall 8.61/10' },
  {
    when: '2021 – 2025',
    what: 'PhD in Advanced Chemistry — outstanding cum laude, International Mention',
    where: 'Universidad Complutense de Madrid · IMDEA Energy (APMU)',
    note: 'Supervised by Dr. Patricia Horcajada. Rational design of photo/electroactive, hydrolytically stable phosphonate MOFs.',
  },
  {
    when: '2023',
    what: '14-week research secondment',
    where: 'University of Glasgow, UK',
    note: 'With Prof. Pablo Docampo. Bismuth perovskitoids as interlayers in lead-based solar cells; uncovered unexpected memristive behaviour.',
  },
]

const METRICS = [
  { v: '>2,000', l: 'Experiments performed' },
  { v: '12', l: 'New crystal structures solved' },
  { v: '6', l: 'Publications (+1 draft)' },
  { v: '11', l: 'Conference communications' },
]

const PAPERS = [
  {
    title: 'IEF-8: a Cu-based phosphonate framework outperforming MIL-125(Ti)-NH₂ in green hydrogen production',
    where: 'Chemistry of Materials, 2023, 35, 11, 4211–4219',
    tag: 'IF 7.2 · Q1',
  },
  {
    title: 'Bismuth-based perovskitoid interlayers in lead perovskite solar cells',
    where: 'ACS Omega, 2025, 10, 43, 52067–52075',
    tag: 'IF 4.3 · Q1',
  },
]

export default function About() {
  return (
    <div className="flex flex-col gap-16">
      <section>
        <Badge tone="accent">08 · About</Badge>
        <h1 className="mt-4 text-3xl uppercase md:text-5xl" style={{ fontFamily: 'var(--font-display)', letterSpacing: '2px' }}>
          Rubén Serrano
        </h1>
        <p className="mt-6 max-w-3xl text-lg" style={{ color: 'var(--text-secondary)' }}>
          Materials chemist turned data scientist. Five years at the bench, and a conviction that the data
          those years produced deserved better than a folder on a local disk.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button href={SITE.cv}>Download CV</Button>
          <Button href={SITE.github} variant="secondary">
            GitHub
          </Button>
          <Button href={SITE.linkedin} variant="secondary">
            LinkedIn
          </Button>
        </div>
      </section>

      <section>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {METRICS.map((m) => (
            <Card key={m.l} accent className="text-center">
              <div className="text-3xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-primary)' }}>
                {m.v}
              </div>
              <div className="mt-2 text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                {m.l}
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle eyebrow="Trajectory">Education &amp; research</SectionTitle>
        <ol className="flex list-none flex-col gap-4 p-0">
          {TIMELINE.map((t) => (
            <li key={t.when}>
              <Card>
                <div className="mono text-xs uppercase tracking-wider" style={{ color: 'var(--accent-secondary-text)' }}>
                  {t.when}
                </div>
                <h3 className="mt-1 text-lg">{t.what}</h3>
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {t.where}
                </div>
                {t.note && (
                  <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {t.note}
                  </p>
                )}
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <SectionTitle eyebrow="Selected work">Publications</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          {PAPERS.map((p) => (
            <Card key={p.title} accent>
              <Badge tone="info">{p.tag}</Badge>
              <h3 className="mt-3 text-base">{p.title}</h3>
              <div className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                {p.where}
              </div>
            </Card>
          ))}
        </div>
        <div className="mt-4">
          <Placeholder source="methodology/Profile.pdf">
            Full publication list, funded projects and conference record pending layout.
          </Placeholder>
        </div>
      </section>
    </div>
  )
}
