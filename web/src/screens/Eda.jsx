import { FUNNEL } from '../content/site.js'
import { Badge, Card, Placeholder, SectionTitle, Term } from '../components/ui.jsx'

export default function Eda() {
  return (
    <div className="flex flex-col gap-16">
      <section>
        <Badge tone="accent">04 · Data Understanding</Badge>
        <h1 className="mt-4 text-3xl uppercase md:text-5xl" style={{ fontFamily: 'var(--font-display)', letterSpacing: '2px' }}>
          Exploratory Data Analysis
        </h1>
        <p className="mt-6 max-w-3xl text-lg" style={{ color: 'var(--text-secondary)' }}>
          Looking at the data before modeling it — and letting what we saw change the plan.
        </p>
      </section>

      {/* Este bloque ya tiene contenido real: sale de la auditoria del 2026-09-01. */}
      <section>
        <SectionTitle eyebrow="Start here">Counting rows is not a metric</SectionTitle>
        <p className="mb-6 max-w-3xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          A raw row count of the database returns 3,204 syntheses and 4,964 labels. Both numbers are
          wrong, for two different reasons, and neither of them reached the model. This is the clearest
          argument in the project for querying a governed view instead of the tables underneath.
        </p>

        <ol className="flex list-none flex-col gap-3 p-0">
          {FUNNEL.map((f, i) => (
            <li key={f.label}>
              <Card>
                <div className="flex flex-wrap items-baseline gap-4">
                  <span
                    className="text-3xl"
                    style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-primary)', minWidth: '5ch' }}
                  >
                    {f.n}
                  </span>
                  <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>{f.label}</span>
                  <span className="ml-auto text-sm" style={{ color: 'var(--text-muted)' }}>
                    {i === 0 ? f.why : `↓ ${f.why}`}
                  </span>
                </div>
              </Card>
            </li>
          ))}
        </ol>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card accent>
            <h3 className="text-base">Why 3,204 is not 2,167</h3>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              1,037 rows are placeholders, created in one bulk ingestion so that a foreign key would not
              block loading a measurement whose sample had no synthesis record yet. They carry{' '}
              <code>synthesis_type = &apos;PENDING_RECORD&apos;</code> precisely so they can be told apart —
              and the feature view excludes them in its own WHERE clause.
            </p>
          </Card>
          <Card accent>
            <h3 className="text-base">Why 4,964 is not 1,877</h3>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              The label table is keyed by <code>(file_hash, label_type)</code>: one row per{' '}
              <em>judgement</em>, not per pattern. 1,877 diffractograms received 4,964 independent expert
              verdicts between them. Not a single duplicate.
            </p>
          </Card>
        </div>
      </section>

      <section>
        <SectionTitle eyebrow="Notebook 06 · section 5">What the descriptors say</SectionTitle>
        <Placeholder source="notebooks/06_...ipynb (section 5)">
          Copy pending: class distribution and the imbalance that justifies resampling; the correlation map,
          with the caveat that correlation is not causation and the map is still useful; and grouped
          leakage — why splitting at random lies when patterns from one synthesis batch land on both sides
          of the split.
        </Placeholder>
      </section>

      <section>
        <SectionTitle eyebrow="What we chose not to use">Discarded data, and why</SectionTitle>
        <Placeholder source="notebooks/06_...ipynb (section 6)">
          Copy pending: why only high-throughput syntheses were kept, the discrepancies found between
          records, and the microwave-versus-HTS bias that later invalidated version 2 of the model.
        </Placeholder>
      </section>

      <section>
        <SectionTitle eyebrow="A bug found by looking">The ×1000 unit error</SectionTitle>
        <Card accent>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Liquid modulator amounts were off by a factor of a thousand. It was not found by a failing
            model or a failing test — it was found by plotting the distribution and noticing the values were
            physically impossible. That makes it an <Term k="CRISP-DM">data understanding</Term> story, not a
            modeling one, which is why it is told here.
          </p>
        </Card>
      </section>
    </div>
  )
}
