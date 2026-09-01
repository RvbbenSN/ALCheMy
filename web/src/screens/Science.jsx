import { LAB_CYCLE } from '../content/site.js'
import { Badge, Card, Placeholder, Rich, SectionTitle, Term } from '../components/ui.jsx'

export default function Science() {
  return (
    <div className="flex flex-col gap-16">
      <section>
        <Badge tone="accent">01 · The Science</Badge>
        <h1 className="mt-4 text-3xl uppercase md:text-5xl" style={{ fontFamily: 'var(--font-display)', letterSpacing: '2px' }}>
          MOFs &amp; Lab Daily-life
        </h1>
        <p className="mt-6 max-w-3xl text-lg" style={{ color: 'var(--text-secondary)' }}>
          Why this project exists at all: five years of benchwork that produced more data than any
          spreadsheet could hold.
        </p>
      </section>

      <section>
        <SectionTitle eyebrow="The material">What is a MOF?</SectionTitle>
        <figure className="m-0 mb-8">
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
            Metal nodes (the octahedra) joined by organic linkers into an extended network. The empty space
            between them is the point: that is where guest molecules go.
          </figcaption>
        </figure>

        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          <Card>
            <p style={{ color: 'var(--text-secondary)' }}>
              A <strong>hybrid compound</strong> formed by inorganic <strong>metal ions or clusters</strong>{' '}
              bonded to organic <strong>polydentate ligands</strong>, giving rise to extended structures
              riddled with <strong>potential voids</strong>.
            </p>
            <p className="mt-4" style={{ color: 'var(--text-secondary)' }}>
              <Term k="MOF">MOFs</Term> are attractive because of their <strong>tunability</strong> — swap
              the metal, swap the linker — which changes chemical functionality on demand. As a result they
              can display <strong>exceptional surface areas</strong>, well-defined active sites, and highly
              controlled environments for adsorption, catalysis, separation or light-driven processes.
            </p>
          </Card>
          <Card accent>
            <div className="text-xs uppercase tracking-[2px]" style={{ color: 'var(--accent-secondary-text)' }}>
              2025
            </div>
            <div className="mt-2 text-2xl" style={{ fontFamily: 'var(--font-display)', letterSpacing: '1px' }}>
              Nobel Prize in Chemistry
            </div>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Susumu Kitagawa, Richard Robson and Omar Yaghi, for establishing the foundations of MOFs and
              reticular chemistry.
            </p>
          </Card>
        </div>
      </section>

      <section>
        <SectionTitle eyebrow="Inside the lab">From high-throughput benchwork to the data avalanche</SectionTitle>
        <ol className="flex list-none flex-col gap-4 p-0">
          {LAB_CYCLE.map((s) => (
            <li key={s.step}>
              <Card>
                <div className="flex items-start gap-4">
                  <div
                    className="shrink-0 text-3xl"
                    style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-primary)' }}
                  >
                    <Rich>{s.step}</Rich>
                  </div>
                  <div>
                    <h3 className="text-lg"><Rich>{s.title}</Rich></h3>
                    <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <Rich>{s.body}</Rich>
                    </p>
                    {s.highlight && (
                      <p
                        className="mt-3 p-3 text-sm"
                        style={{
                          borderLeft: '4px solid var(--accent-secondary)',
                          color: 'var(--text-primary)',
                          background: 'var(--surface-elevated)',
                        }}
                      >
                        <Rich>{s.highlight}</Rich>
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <SectionTitle eyebrow="The bottleneck">The experimental data avalanche</SectionTitle>
        <Card accent>
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            Running this cycle roughly twice a week across multiple 24-well blocks, scale-ups and microwave
            runs generated a massive data avalanche: thousands of raw <Term k="PXRD" /> scans and synthesis
            metadata scattered across lab folders. Managing that complexity with manual spreadsheets does
            not work.
          </p>
          <p className="mt-4 text-lg" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            ALCheMy was conceptualized to solve exactly this pain: turning the experimental avalanche into a
            governed, predictive digital twin.
          </p>
        </Card>
        <div className="mt-6">
          <Placeholder source="design_system/assets/HTS.png, ST.png, MOF_formation.jfif">
            Visual pending: animated counter that accumulates scattered files until it overflows, then snaps
            into order when the reader moves to the ingestion tab.
          </Placeholder>
        </div>
      </section>
    </div>
  )
}
