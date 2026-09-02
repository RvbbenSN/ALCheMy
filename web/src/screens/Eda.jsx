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
import { Badge, Card, Placeholder, ScrollTable, SectionTitle, Rich} from '../components/ui.jsx'
import NotebookList from '../components/NotebookList.jsx'
import NotebookFigure from '../components/NotebookFigure.jsx'
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
          Data Understanding
        </h1>
        <p className="mt-6 max-w-3xl text-lg" style={{ color: 'var(--text-secondary)' }}>
          The stage that returns the most per hour invested, and the one most often skipped. Everything
          below changed the plan before a single model was trained.
        </p>
      </section>

      {/* --- 1. El factor de confusion --- */}
      <section>
        <SectionTitle eyebrow="Before loading anything"><Rich>{EDA_CONFOUNDER.title}</Rich></SectionTitle>
        <p className="mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{EDA_CONFOUNDER.intro}</Rich>
        </p>
        <ConfounderFigure />
        <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          Look at the microwave row: the amorphous segment is not small, it is <em>absent</em>.
        </p>
        <div className="mt-6">
          <ScrollTable head={EDA_CONFOUNDER.tableHead} rows={EDA_CONFOUNDER.tableRows} />
        </div>

        <Card accent className="mt-6">
          <p style={{ color: 'var(--text-secondary)' }}><Rich>{EDA_CONFOUNDER.shortcut}</Rich></p>
          <p className="mt-4" style={{ color: 'var(--text-secondary)' }}>
            <Rich>{EDA_CONFOUNDER.bias}</Rich>
          </p>
          <p className="mt-4" style={{ color: 'var(--text-secondary)' }}>
            <Rich>{EDA_CONFOUNDER.thermal}</Rich>
          </p>
        </Card>

        <Card className="mt-6">
          <h3 className="text-lg">The decision: high-throughput syntheses only</h3>
          <ol className="mt-4 flex list-decimal flex-col gap-2 pl-5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {EDA_CONFOUNDER.decision.map((d, i) => (
              <li key={i}><Rich>{d}</Rich></li>
            ))}
          </ol>
          <Pullquote><Rich>{EDA_CONFOUNDER.price}</Rich></Pullquote>
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
                    <Rich>{f.n}</Rich>
                  </span>
                  <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}><Rich>{f.label}</Rich></span>
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
        <SectionTitle eyebrow="Profiling"><Rich>{EDA_MISSING.title}</Rich></SectionTitle>
        <p className="mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{EDA_MISSING.intro}</Rich>
        </p>
        <div className="mb-6">
          <NotebookFigure
            src="nb06-01.png"
            alt="Bar chart of the percentage of missing values per column"
            caption="Missingness by column. The bars look similar; the causes behind them are not, and that is the whole point of the table below."
            source="notebook 06 §5.3"
          />
        </div>
        <ScrollTable head={EDA_MISSING.tableHead} rows={EDA_MISSING.tableRows} />
        <Pullquote><Rich>{EDA_MISSING.lesson}</Rich></Pullquote>
      </section>

      {/* --- 4. Desequilibrio --- */}
      <section>
        <SectionTitle eyebrow="The target"><Rich>{EDA_IMBALANCE.title}</Rich></SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <Card accent>
            <div className="text-4xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--status-incipient)' }}>
              64%
            </div>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{EDA_IMBALANCE.trivial}</Rich>
            </p>
          </Card>
          <Card accent>
            <div className="text-4xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-primary)' }}>
              5.8 : 1
            </div>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{EDA_IMBALANCE.ratio}</Rich>
            </p>
          </Card>
        </div>
      </section>

      {/* --- 5. Variables discretas --- */}
      <section>
        <SectionTitle eyebrow="Distributions"><Rich>{EDA_DISCRETE.title}</Rich></SectionTitle>
        <Card>
          <p style={{ color: 'var(--text-secondary)' }}><Rich>{EDA_DISCRETE.body}</Rich></p>
          <p className="mt-4" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            <Rich>{EDA_DISCRETE.consequence}</Rich>
          </p>
        </Card>
      </section>

      {/* --- 6. Correlacion --- */}
      <section>
        <SectionTitle eyebrow="Association"><Rich>{EDA_CORRELATION.title}</Rich></SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <Badge tone="info">Question 1</Badge>
            <h3 className="mt-3 text-base"><Rich>{EDA_CORRELATION.q1title}</Rich></h3>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{EDA_CORRELATION.q1body}</Rich>
            </p>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{EDA_CORRELATION.q1note}</Rich>
            </p>
          </Card>
          <Card>
            <Badge tone="info">Question 2</Badge>
            <h3 className="mt-3 text-base"><Rich>{EDA_CORRELATION.q2title}</Rich></h3>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{EDA_CORRELATION.q2body}</Rich>
            </p>
          </Card>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <NotebookFigure
            src="nb06-04.png"
            alt="Feature-to-feature correlation map"
            caption="Feature against feature. The red blocks are mostly properties of the same metal, correlated by physics — not a problem, but the reason the final interpretation is done by chemical block."
            source="notebook 06 §5.6"
          />
          <NotebookFigure
            src="nb06-05.png"
            alt="Association of each feature with the target class, top twenty numeric features"
            caption="Association with the target, measured by correlation ratio rather than Pearson — the target has three categories, not a magnitude."
            source="notebook 06 §5.6"
          />
        </div>
        <Pullquote tone="incipient">⚠️ <Rich>{EDA_CORRELATION.causation}</Rich></Pullquote>
      </section>

      {/* --- 7. Bivariante --- */}
      <section>
        <SectionTitle eyebrow="Class separation"><Rich>{EDA_BIVARIATE.title}</Rich></SectionTitle>
        <p className="mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          The descriptors do order the classes, and cleanly: every one of them rises monotonically from
          amorphous through incipient to crystalline. That is the reassuring half of the picture.
        </p>
        <SeparationFigure />
        <Card accent className="mt-6">
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            <Rich>{EDA_BIVARIATE.body}</Rich>
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
        <SectionTitle eyebrow="The most important subsection"><Rich>{EDA_LEAKAGE.title}</Rich></SectionTitle>
        <Card accent>
          <p style={{ color: 'var(--text-secondary)' }}><Rich>{EDA_LEAKAGE.body}</Rich></p>
          <div className="my-5">
            <NotebookFigure
              src="nb06-07.png"
              alt="Distribution of samples across high-throughput plates, and how homogeneous each plate is"
              caption="Samples cluster in plates, and plates are internally homogeneous. Knowing one well of a plate tells you most of what its neighbours did."
              source="notebook 06 §5.8"
            />
          </div>
          <Pullquote tone="amorphous"><Rich>{EDA_LEAKAGE.consequence}</Rich></Pullquote>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            <Rich>{EDA_LEAKAGE.drift}</Rich>
          </p>
        </Card>
      </section>

      {/* --- 9. PCA --- */}
      <section>
        <SectionTitle eyebrow="A last look before modeling"><Rich>{EDA_PCA.title}</Rich></SectionTitle>
        <p className="mb-6 text-sm uppercase tracking-wider" style={{ color: 'var(--accent-secondary-text)' }}>
          <Rich>{EDA_PCA.disclaimer}</Rich>
        </p>
        <Card>
          <h3 className="text-base">How it is built, in three steps</h3>
          <ol className="mt-4 flex list-decimal flex-col gap-3 pl-5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {EDA_PCA.steps.map((s, i) => (
              <li key={i}><Rich>{s}</Rich></li>
            ))}
          </ol>
          <p className="mt-5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <Rich>{EDA_PCA.honest}</Rich>
          </p>
        </Card>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {EDA_PCA.findings.map((f, i) => (
            <Card key={i}>
              <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Finding {i + 1}
              </div>
              <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <Rich>{f}</Rich>
              </p>
            </Card>
          ))}
        </div>
        <div className="mt-6">
          <NotebookFigure
            src="nb06-08.png"
            alt="PCA projection of the syntheses, coloured by outcome class with linker scaffold as marker shape"
            caption="Colour is the outcome class, marker shape the linker scaffold. The scaffolds occupy distinct regions — the linker chemistry is a large part of what separates the space — but the classes themselves overlap heavily."
            source="notebook 06 §5.9"
          />
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
