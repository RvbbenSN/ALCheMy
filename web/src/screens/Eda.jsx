import { useBundle } from '../i18n/LocaleContext.jsx'
import * as UI_EN from '../content/ui.js'
import * as UI_ES from '../content/es/ui.js'
import * as SITE_EN from '../content/site.js'
import * as SITE_ES from '../content/es/site.js'
import * as SCREENS_EN from '../content/screens.js'
import * as SCREENS_ES from '../content/es/screens.js'
import { Link } from 'react-router-dom'
import { Eye, ListChecks, ShieldAlert } from 'lucide-react'
import { Badge, Card, Note, Placeholder, ScrollTable, SectionTitle, Rich } from '../components/ui.jsx'
import NotebookList from '../components/NotebookList.jsx'
import NotebookFigure from '../components/NotebookFigure.jsx'
import { ConfounderFigure, SeparationFigure } from '../components/Figures.jsx'

// Un icono por idea del EDA, igual que los tres verbos del ETL en la 03.
const EDA_STEP_ICONS = { look: Eye, decide: ListChecks, catch: ShieldAlert }

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
  const { UI } = useBundle(UI_EN, UI_ES)
  const { FUNNEL } = useBundle(SITE_EN, SITE_ES)
  const { EDA_BIVARIATE, EDA_CONFOUNDER, EDA_INTRO, EDA_MODULATORS, EDA_FUNNEL_INTRO, EDA_CORRELATION, EDA_DISCRETE, EDA_IMBALANCE, EDA_LEAKAGE, EDA_MISSING, EDA_PCA } = useBundle(SCREENS_EN, SCREENS_ES)

  return (
    <div className="flex flex-col gap-16">
      <section>
        <Badge tone="accent">04 · Data Understanding</Badge>
        <h1 className="mt-4 text-3xl uppercase md:text-5xl" style={{ fontFamily: 'var(--font-display)', letterSpacing: '2px' }}>{UI.eda.dataUnderstanding}</h1>
        <p className="mt-6 max-w-3xl text-lg" style={{ color: 'var(--text-secondary)' }}>
          Everything below changed the plan before a single model was trained.
        </p>
      </section>

      {/* --- Que es un EDA --- */}
      <section>
        <SectionTitle eyebrow={UI.eda.ebFirstTheName}>
          {EDA_INTRO.acronym} &mdash; {EDA_INTRO.expansion}
        </SectionTitle>
        {/* Misma forma que los tres verbos del ETL en la pantalla 03: tres
            bloques con icono, sin caja exterior. */}
        <div className="grid gap-3 sm:grid-cols-3">
          {EDA_INTRO.steps.map((step) => {
            const Icon = EDA_STEP_ICONS[step.key]
            return (
              <div
                key={step.key}
                className="rounded-[var(--radius-card)] p-3"
                style={{ border: '1px solid var(--surface-border)', background: 'var(--surface-elevated)' }}
              >
                <div className="flex items-center gap-2">
                  <Icon size={16} aria-hidden style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                  <strong style={{ color: 'var(--text-primary)' }}>{step.label}</strong>
                </div>
                <p className="mt-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <Rich>{step.body}</Rich>
                </p>
              </div>
            )
          })}
        </div>

        <Card accent className="mt-4">
          <p className="text-lg" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            <Rich>{EDA_INTRO.rule}</Rich>
          </p>
        </Card>

        <p className="mb-3 mt-6 text-sm" style={{ color: 'var(--text-muted)' }}>
          What this one found, in order:
        </p>
        <ol className="flex list-none flex-col gap-2 p-0">
          {EDA_INTRO.found.map(([what, why], i) => (
            <li
              key={what}
              className="flex flex-wrap items-baseline gap-x-3 rounded-[var(--radius-badge)] p-3"
              style={{ border: '2px solid var(--surface-border)' }}
            >
              <span
                className="text-sm"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-primary)' }}
              >
                {i + 1}
              </span>
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{what}</span>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>&mdash; {why}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* --- 1. El factor de confusion --- */}
      <section>
        <SectionTitle eyebrow={UI.eda.ebBeforeLoadingAnything}><Rich>{EDA_CONFOUNDER.title}</Rich></SectionTitle>
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
          <ul className="flex list-none flex-col gap-3 p-0 text-sm">
            {EDA_CONFOUNDER.points.map((p) => (
              <li key={p.label} style={{ borderLeft: '2px solid var(--accent-primary)', paddingLeft: '0.75rem' }}>
                <strong style={{ color: 'var(--text-primary)' }}>{p.label}.</strong>{' '}
                <span style={{ color: 'var(--text-secondary)' }}><Rich>{p.body}</Rich></span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="mt-6">
          <h3 className="text-lg">{UI.eda.theDecisionHighThroughput}</h3>
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
        <SectionTitle eyebrow={UI.eda.ebWhichRowsTheModel}>{EDA_FUNNEL_INTRO.title}</SectionTitle>
        <p className="mb-3 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{EDA_FUNNEL_INTRO.lead}</Rich>
        </p>
        <p className="mb-6 max-w-3xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{EDA_FUNNEL_INTRO.chain}</Rich>
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
        <Note>
          <Rich>{EDA_FUNNEL_INTRO.scope}</Rich>
        </Note>
      </section>

      {/* --- 3. Ausentes --- */}
      <section>
        <SectionTitle eyebrow={UI.eda.ebProfiling}><Rich>{EDA_MISSING.title}</Rich></SectionTitle>
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
      </section>

      {/* --- De donde salen las columnas de modulador --- */}
      <section>
        <SectionTitle eyebrow={UI.eda.ebOneGapDeservesIts}>{EDA_MODULATORS.title}</SectionTitle>
        {/* Una sola tarjeta a todo el ancho: el texto es corto y no gana nada
            metido en media pantalla con la otra mitad vacia. */}
        <Card>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            <Rich>{EDA_MODULATORS.problem}</Rich>
          </p>
          <div
            className="mono mt-4 overflow-x-auto rounded-[var(--radius-badge)] p-3 text-xs"
            style={{ background: 'var(--surface-elevated)', border: '2px solid var(--surface-border)', color: 'var(--text-primary)' }}
          >
            {EDA_MODULATORS.formula}
          </div>
        </Card>
        {/* Dos notas al pie, no dos secciones. */}
        <ul className="mt-4 flex list-none flex-col gap-2 p-0">
          {EDA_MODULATORS.caveats.map((c, i) => (
            <li
              key={i}
              className="text-sm"
              style={{ borderLeft: '3px solid var(--status-incipient)', paddingLeft: '0.75rem', color: 'var(--text-secondary)' }}
            >
              <Rich>{c}</Rich>
            </li>
          ))}
        </ul>
      </section>

      {/* --- 4. Desequilibrio --- */}
      <section>
        <SectionTitle eyebrow={UI.eda.ebTheTarget}><Rich>{EDA_IMBALANCE.title}</Rich></SectionTitle>
        <p className="mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{EDA_IMBALANCE.intro}</Rich>
        </p>

        {/* Barras proporcionales: el desequilibrio se ve antes de leerlo. */}
        <div className="flex flex-col gap-2">
          {EDA_IMBALANCE.tableRows.map(([klass, what, n, pct], i) => {
            const tone = ['var(--status-incipient)', 'var(--status-amorphous)', 'var(--status-pure)'][i]
            return (
              <div key={klass} className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="w-24 shrink-0 text-sm uppercase tracking-wider" style={{ color: tone }}>
                  {klass}
                </span>
                <span
                  className="h-6 shrink-0 rounded-[var(--radius-badge)]"
                  style={{ width: pct, minWidth: 24, background: tone, opacity: 0.7 }}
                />
                <span className="mono text-sm" style={{ color: 'var(--text-primary)' }}>
                  {n} <span style={{ color: 'var(--text-muted)' }}>· {pct}</span>
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{what}</span>
              </div>
            )
          })}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
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
              6 : 1
            </div>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{EDA_IMBALANCE.ratio}</Rich>
            </p>
          </Card>
        </div>
      </section>

      {/* --- 5. Variables discretas --- */}
      <section>
        <SectionTitle eyebrow={UI.eda.ebDistributions}><Rich>{EDA_DISCRETE.title}</Rich></SectionTitle>
        <p className="mb-4 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{EDA_DISCRETE.body}</Rich>
        </p>
        <ScrollTable head={EDA_DISCRETE.tableHead} rows={EDA_DISCRETE.tableRows} />
        <p className="mt-4 max-w-3xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{EDA_DISCRETE.concentration}</Rich>
        </p>
        <p className="mt-3 max-w-3xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{EDA_DISCRETE.why}</Rich>
        </p>
        <Note>
          <Rich>{EDA_DISCRETE.consequence}</Rich>
        </Note>
      </section>

      {/* --- 6. Correlacion --- */}
      <section>
        <SectionTitle eyebrow={UI.eda.ebAssociation}><Rich>{EDA_CORRELATION.title}</Rich></SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          {EDA_CORRELATION.questions.map((q, qi) => (
            <Card key={q.title}>
              <Badge tone="info">Question {qi + 1}</Badge>
              <h3 className="mt-3 text-base"><Rich>{q.title}</Rich></h3>
              <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <Rich>{q.lead}</Rich>
              </p>
              <ul className="mt-4 flex list-none flex-col gap-3 p-0">
                {q.points.map(([label, body]) => (
                  <li key={label} style={{ borderLeft: '2px solid var(--accent-secondary)', paddingLeft: '0.75rem' }}>
                    <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--accent-secondary-text)' }}>
                      {label}
                    </div>
                    <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <Rich>{body}</Rich>
                    </p>
                  </li>
                ))}
              </ul>
              {q.note && (
                <p
                  className="mt-4 p-3 text-sm"
                  style={{ background: 'var(--surface-elevated)', color: 'var(--text-secondary)' }}
                >
                  <Rich>{q.note}</Rich>
                </p>
              )}
            </Card>
          ))}
        </div>

        {/* Una figura debajo de la otra: en dos columnas los mapas salian
            demasiado pequenos para leer las etiquetas de los ejes. */}
        <div className="mt-8 flex flex-col gap-8">
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

        <Card className="mt-6">
          <h3 className="text-base">{EDA_CORRELATION.blankTitle}</h3>
          <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <Rich>{EDA_CORRELATION.blankBody}</Rich>
          </p>
          <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <Rich>{EDA_CORRELATION.blankConsequence}</Rich>
          </p>
        </Card>

        <Pullquote tone="incipient">⚠️ <Rich>{EDA_CORRELATION.causation}</Rich></Pullquote>
      </section>

      {/* --- 7. Bivariante --- */}
      <section>
        <SectionTitle eyebrow={UI.eda.ebClassSeparation}><Rich>{EDA_BIVARIATE.title}</Rich></SectionTitle>
        <Card className="mb-6">
          <h3 className="text-base">{EDA_BIVARIATE.whichTitle}</h3>
          <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <Rich>{EDA_BIVARIATE.which}</Rich>
          </p>

          {/* Recordatorio de que aspecto tiene el vector de cada clase: se
              explico en la pantalla 03 y nadie lee en orden. */}
          <h4 className="mt-5 text-sm uppercase tracking-wider" style={{ color: 'var(--accent-secondary-text)' }}>{EDA_BIVARIATE.shapesTitle}</h4>
          <ul className="mt-3 flex list-none flex-col gap-2.5 p-0 text-sm">
            {EDA_BIVARIATE.shapes.map((s) => {
              const tone = `var(--status-${s.tone})`
              return (
                <li key={s.klass} style={{ borderLeft: `2px solid ${tone}`, paddingLeft: '0.75rem' }}>
                  <strong className="uppercase tracking-wider" style={{ color: tone }}>{s.klass}</strong>{' '}
                  <span style={{ color: 'var(--text-secondary)' }}><Rich>{s.body}</Rich></span>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-sm">
            <Link to="/data-preparation#descriptors" style={{ color: 'var(--accent-primary)' }}>
              {EDA_BIVARIATE.shapesLink} &rarr;
            </Link>
          </p>
        </Card>
        <p className="mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{EDA_BIVARIATE.ordering}</Rich>
        </p>
        <SeparationFigure />
        <Card accent className="mt-6">
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            <Rich>{EDA_BIVARIATE.body}</Rich>
          </p>
          <p className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
            The medians separate; the <em>distributions</em> behind them overlap. A variable can shift
            class by class and still fail to classify any single sample.
          </p>
        </Card>
      </section>

      {/* --- 8. Fuga por agrupamiento --- */}
      <section>
        <SectionTitle eyebrow={UI.eda.ebTheMostImportantSubsection}><Rich>{EDA_LEAKAGE.title}</Rich></SectionTitle>
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
            <Rich>{EDA_LEAKAGE.reminder}</Rich>
          </p>
          <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <Rich>{EDA_LEAKAGE.drift}</Rich>
          </p>
        </Card>
      </section>

      {/* --- 9. PCA --- */}
      <section>
        <SectionTitle eyebrow={UI.eda.ebALastLookBefore}><Rich>{EDA_PCA.title}</Rich></SectionTitle>
        <p className="mb-6 text-sm uppercase tracking-wider" style={{ color: 'var(--accent-secondary-text)' }}>
          <Rich>{EDA_PCA.disclaimer}</Rich>
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card accent>
            <h3 className="text-base">{EDA_PCA.whatTitle}</h3>
            <ul className="mt-3 flex list-none flex-col gap-2 p-0 text-sm">
              {EDA_PCA.what.map((w, i) => (
                <li
                  key={i}
                  style={{ borderLeft: '2px solid var(--accent-primary)', paddingLeft: '0.75rem', color: 'var(--text-secondary)' }}
                >
                  <Rich>{w}</Rich>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h3 className="text-base">{EDA_PCA.varsTitle}</h3>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{EDA_PCA.varsNote}</Rich>
            </p>
          </Card>
        </div>

        <Card className="mt-4">
          <h3 className="text-base">{EDA_PCA.stepsTitle}</h3>
          <ol className="mt-4 flex list-decimal flex-col gap-2 pl-5 text-sm" style={{ color: 'var(--text-secondary)' }}>
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
        <SectionTitle eyebrow={UI.eda.theNotebookBehindThis.eyebrow}>{UI.eda.theNotebookBehindThis.title}</SectionTitle>
        <NotebookList only="04" />
      </section>

      <section>
        <SectionTitle eyebrow={UI.eda.whatThisStageSettled.eyebrow}>{UI.eda.whatThisStageSettled.title}</SectionTitle>
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
