import { FUNNEL } from '../content/site.js'
import {
  EDA_BIVARIATE,
  EDA_CONFOUNDER,
  EDA_CORRELATION,
  EDA_DISCRETE,
  EDA_IMBALANCE,
  EDA_LEAKAGE,
  EDA_MISSING,
  EDA_PCA,
} from '../content/screens.js'
import { Badge, Card, Placeholder, ScrollTable, SectionTitle } from '../components/ui.jsx'
import NotebookList from '../components/NotebookList.jsx'
import { ConfounderFigure, SeparationFigure } from '../components/Figures.jsx'

function Pullquote({ children, tone = 'accent' }) {
  return (
    <blockquote
      className="my-6 p-5 text-lg"
      style={{
        borderLeft: `4px solid var(--${tone === 'accent' ? 'accent-primary' : `status-${tone}`})`,
        background: 'var(--surface-elevated)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-heading)',
        margin: '1.5rem 0',
      }}
    >
      {children}
    </blockquote>
  )
}

export default function Eda() {
  return (
    <div className="flex flex-col gap-16">
      <section>
        <Badge tone="accent">04 · Data Understanding</Badge>
        <h1 className="mt-4 text-3xl uppercase md:text-5xl" style={{ fontFamily: 'var(--font-display)', letterSpacing: '2px' }}>
          Exploratory Data Analysis
        </h1>
        <p className="mt-6 max-w-3xl text-lg" style={{ color: 'var(--text-secondary)' }}>
          The stage that returns the most per hour invested, and the one most often skipped. Everything
          below changed the plan before a single model was trained.
        </p>
      </section>

      {/* --- 1. El factor de confusion --- */}
      <section>
        <SectionTitle eyebrow="Before loading anything">{EDA_CONFOUNDER.title}</SectionTitle>
        <p className="mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          {EDA_CONFOUNDER.intro}
        </p>
        <ConfounderFigure />
        <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          Look at the microwave row: the amorphous segment is not small, it is <em>absent</em>.
        </p>
        <div className="mt-6">
          <ScrollTable head={EDA_CONFOUNDER.tableHead} rows={EDA_CONFOUNDER.tableRows} />
        </div>

        <Card accent className="mt-6">
          <p style={{ color: 'var(--text-secondary)' }}>{EDA_CONFOUNDER.shortcut}</p>
          <p className="mt-4" style={{ color: 'var(--text-secondary)' }}>
            {EDA_CONFOUNDER.bias}
          </p>
          <p className="mt-4" style={{ color: 'var(--text-secondary)' }}>
            {EDA_CONFOUNDER.thermal}
          </p>
        </Card>

        <Card className="mt-6">
          <h3 className="text-lg">The decision: high-throughput syntheses only</h3>
          <ol className="mt-4 flex list-decimal flex-col gap-2 pl-5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {EDA_CONFOUNDER.decision.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ol>
          <Pullquote>{EDA_CONFOUNDER.price}</Pullquote>
        </Card>
      </section>

      {/* --- 2. El embudo --- */}
      <section>
        <SectionTitle eyebrow="A worked example">Counting rows is not a metric</SectionTitle>
        <p className="mb-6 max-w-3xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          A raw row count of the database returns 3,204 syntheses and 4,964 labels. Both numbers are
          wrong, for two unrelated reasons, and neither reached the model. Every step below drops, and
          each drop has a stated reason.
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
          <Card>
            <h3 className="text-base">Why 3,204 is not 2,167</h3>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              1,037 rows are placeholders, created so a foreign key would not block loading a measurement
              whose sample had no synthesis record yet. They are typed{' '}
              <code>synthesis_type = &apos;PENDING_RECORD&apos;</code> precisely so they can be told apart,
              and the feature view excludes them in its own WHERE clause.
            </p>
          </Card>
          <Card>
            <h3 className="text-base">Why 4,964 is not 1,877</h3>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              The label table is keyed by <code>(file_hash, label_type)</code>: one row per{' '}
              <em>judgement</em>, not per pattern. 1,877 diffractograms received 4,964 independent expert
              verdicts between them. Not a single duplicate.
            </p>
          </Card>
        </div>
      </section>

      {/* --- 3. Ausentes --- */}
      <section>
        <SectionTitle eyebrow="Profiling">{EDA_MISSING.title}</SectionTitle>
        <p className="mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          {EDA_MISSING.intro}
        </p>
        <ScrollTable head={EDA_MISSING.tableHead} rows={EDA_MISSING.tableRows} />
        <Pullquote>{EDA_MISSING.lesson}</Pullquote>
      </section>

      {/* --- 4. Desequilibrio --- */}
      <section>
        <SectionTitle eyebrow="The target">{EDA_IMBALANCE.title}</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <Card accent>
            <div className="text-4xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--status-incipient)' }}>
              64%
            </div>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {EDA_IMBALANCE.trivial}
            </p>
          </Card>
          <Card accent>
            <div className="text-4xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-primary)' }}>
              5.8 : 1
            </div>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {EDA_IMBALANCE.ratio}
            </p>
          </Card>
        </div>
      </section>

      {/* --- 5. Variables discretas --- */}
      <section>
        <SectionTitle eyebrow="Distributions">{EDA_DISCRETE.title}</SectionTitle>
        <Card>
          <p style={{ color: 'var(--text-secondary)' }}>{EDA_DISCRETE.body}</p>
          <p className="mt-4" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            {EDA_DISCRETE.consequence}
          </p>
        </Card>
      </section>

      {/* --- 6. Correlacion --- */}
      <section>
        <SectionTitle eyebrow="Association">{EDA_CORRELATION.title}</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <Badge tone="info">Question 1</Badge>
            <h3 className="mt-3 text-base">{EDA_CORRELATION.q1title}</h3>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {EDA_CORRELATION.q1body}
            </p>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {EDA_CORRELATION.q1note}
            </p>
          </Card>
          <Card>
            <Badge tone="info">Question 2</Badge>
            <h3 className="mt-3 text-base">{EDA_CORRELATION.q2title}</h3>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {EDA_CORRELATION.q2body}
            </p>
          </Card>
        </div>
        <Pullquote tone="incipient">⚠️ {EDA_CORRELATION.causation}</Pullquote>
      </section>

      {/* --- 7. Bivariante --- */}
      <section>
        <SectionTitle eyebrow="Class separation">{EDA_BIVARIATE.title}</SectionTitle>
        <p className="mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          The descriptors do order the classes, and cleanly: every one of them rises monotonically from
          amorphous through incipient to crystalline. That is the reassuring half of the picture.
        </p>
        <SeparationFigure />
        <Card accent className="mt-6">
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            {EDA_BIVARIATE.body}
          </p>
          <p className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
            The medians above separate; the <em>distributions</em> behind them overlap. A median that
            moves is not the same as a boundary that holds, and confusing the two is how a promising
            plot becomes a disappointing model.
          </p>
        </Card>
      </section>

      {/* --- 8. Fuga por agrupamiento --- */}
      <section>
        <SectionTitle eyebrow="The most important subsection">{EDA_LEAKAGE.title}</SectionTitle>
        <Card accent>
          <p style={{ color: 'var(--text-secondary)' }}>{EDA_LEAKAGE.body}</p>
          <Pullquote tone="amorphous">{EDA_LEAKAGE.consequence}</Pullquote>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {EDA_LEAKAGE.drift}
          </p>
        </Card>
      </section>

      {/* --- 9. PCA --- */}
      <section>
        <SectionTitle eyebrow="A last look before modeling">{EDA_PCA.title}</SectionTitle>
        <p className="mb-6 text-sm uppercase tracking-wider" style={{ color: 'var(--accent-secondary-text)' }}>
          {EDA_PCA.disclaimer}
        </p>
        <Card>
          <h3 className="text-base">How it is built, in three steps</h3>
          <ol className="mt-4 flex list-decimal flex-col gap-3 pl-5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {EDA_PCA.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <p className="mt-5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {EDA_PCA.honest}
          </p>
        </Card>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {EDA_PCA.findings.map((f, i) => (
            <Card key={i}>
              <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Finding {i + 1}
              </div>
              <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {f}
              </p>
            </Card>
          ))}
        </div>
        <div className="mt-6">
          <Placeholder source="notebooks/06 (section 5.9)">
            Interactive projection pending: the 2D and 3D scatter coloured by class, with linker scaffold
            as the marker shape, plus the cumulative variance curve.
          </Placeholder>
        </div>
      </section>

      <section>
        <SectionTitle eyebrow="The code itself">The notebook behind this screen</SectionTitle>
        <NotebookList only="04" />
      </section>

      <section>
        <SectionTitle eyebrow="Takeaway">What this stage settled</SectionTitle>
        <Card accent>
          <ul className="flex list-none flex-col gap-3 p-0" style={{ color: 'var(--text-secondary)' }}>
            <li>
              <strong style={{ color: 'var(--text-primary)' }}>Which samples the model may see:</strong>{' '}
              high-throughput only, at a measured cost of 27% of the crystalline class.
            </li>
            <li>
              <strong style={{ color: 'var(--text-primary)' }}>Which metric can be trusted:</strong> not
              accuracy, because a model that learns nothing already scores 64%.
            </li>
            <li>
              <strong style={{ color: 'var(--text-primary)' }}>How to split the data:</strong> grouped by
              plate, because a random split would let the model pass by recognising the batch.
            </li>
            <li>
              <strong style={{ color: 'var(--text-primary)' }}>What to expect:</strong> no single variable
              separates the classes and no plane does either — so a linear model will not shine, and the
              honest ceiling is modest.
            </li>
          </ul>
        </Card>
      </section>
    </div>
  )
}
