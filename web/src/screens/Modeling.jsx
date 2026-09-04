import { useBundle } from '../i18n/LocaleContext.jsx'
import * as UI_EN from '../content/ui.js'
import * as UI_ES from '../content/es/ui.js'
import * as SCREENS_EN from '../content/screens.js'
import * as SCREENS_ES from '../content/es/screens.js'
import { Badge, Card, Note, Placeholder, ScrollTable, SectionTitle, Rich} from '../components/ui.jsx'
import NotebookList from '../components/NotebookList.jsx'
import NotebookFigure from '../components/NotebookFigure.jsx'
import ModelScorecard from '../components/ModelScorecard.jsx'
import { FlaskConical, Gem, NotebookPen, Target } from 'lucide-react'

/* Un simbolo por propuesta de mejora: un experimento nuevo, mas muestras de la
   clase escasa, terminar de anotar lo que ya se hizo, y replantear el objetivo. */
const NEXT_ICON = {
  sweep: FlaskConical,
  minority: Gem,
  record: NotebookPen,
  target: Target,
}

function Pullquote({ children, tone = 'accent' }) {
  return (
    <blockquote
      className="p-5 text-lg"
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

export default function Modeling() {
  const { UI } = useBundle(UI_EN, UI_ES)
  const {
    MODEL_ASSESSMENT, MODEL_CHEMISTRY, MODEL_ERRORS, MODEL_FINDINGS, MODEL_FRAMING,
    MODEL_HERO_LEAD, MODEL_LINEUP, MODEL_METRICS, MODEL_SCORECARD_INTRO, MODEL_SHAP,
    MODEL_TAKEAWAY, MODEL_TWO, MODEL_VALIDATION, MODEL_WEIGHTS_NOTE,
  } = useBundle(SCREENS_EN, SCREENS_ES)

  return (
    <div className="flex flex-col gap-16">
      <section>
        <Badge tone="accent">05 · Modeling &amp; Evaluation</Badge>
        <h1 className="mt-4 text-3xl uppercase md:text-5xl" style={{ fontFamily: 'var(--font-display)', letterSpacing: '2px' }}>{UI.modeling.trainingEvaluation}</h1>
        <p className="mt-6 max-w-3xl text-lg" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{MODEL_HERO_LEAD}</Rich>
        </p>
      </section>

      {/* --- El planteamiento --- */}
      <section>
        <SectionTitle eyebrow={UI.modeling.classificationAndWhyNot.eyebrow}>{UI.modeling.classificationAndWhyNot.title}</SectionTitle>
        <Card>
          <p style={{ color: 'var(--text-secondary)' }}>
            <Rich>{MODEL_FRAMING}</Rich>
          </p>
        </Card>
      </section>

      {/* --- Los diez modelos --- */}
      <section>
        <SectionTitle eyebrow={UI.modeling.tenModelsNotOne.eyebrow}>{UI.modeling.tenModelsNotOne.title}</SectionTitle>
        <p className="mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{MODEL_LINEUP.intro}</Rich>
        </p>
        {/* Cada modelo se despliega en su sitio. Un <details> nativo en vez
            de estado en React: no hace falta, se puede abrir mas de uno a la
            vez, y funciona con teclado y con Ctrl+F del navegador sin que
            haya que programarlo. */}
        <ol className="flex list-none flex-col gap-2 p-0">
          {MODEL_LINEUP.models.map((m) => (
            <li key={m.name}>
              <details
                className="rounded-[var(--radius-card)] px-4 py-3"
                style={{
                  border: 'var(--border-card) solid var(--surface-border)',
                  background: 'var(--surface)',
                }}
              >
                <summary className="cursor-pointer list-none">
                  <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                      {m.name}
                    </span>
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {m.assumes}
                    </span>
                    <span className="ml-auto text-xs" style={{ color: 'var(--accent-primary)' }}>
                      {m.why}
                    </span>
                  </span>
                </summary>
                <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <Rich>{m.detail}</Rich>
                </p>
                <pre
                  className="mono mt-3 overflow-x-auto rounded-[var(--radius-badge)] p-3 text-xs"
                  style={{
                    background: 'var(--surface-elevated)',
                    border: '2px solid var(--surface-border)',
                    color: 'var(--text-primary)',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {m.code}
                </pre>
              </details>
            </li>
          ))}
        </ol>
        <div className="mt-6">
          <NotebookFigure
            src="nb06-09.png"
            alt={MODEL_LINEUP.comparisonFigureAlt}
            caption={MODEL_LINEUP.comparisonFigureCaption}
            source="notebook 06 §8"
          />
        </div>
        <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          <Rich>{MODEL_WEIGHTS_NOTE}</Rich>
        </p>
      </section>

      {/* --- Validacion --- */}
      <section>
        <SectionTitle eyebrow={UI.modeling.ebValidation}><Rich>{MODEL_VALIDATION.title}</Rich></SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h3 className="text-base">{UI.modeling.whatAPlateIs}</h3>
            <ul className="mt-3 flex list-none flex-col gap-2 p-0 text-sm">
              {MODEL_VALIDATION.setupPoints.map((p, i) => (
                <li key={i} style={{ borderLeft: '2px solid var(--surface-border)', paddingLeft: '0.75rem', color: 'var(--text-secondary)' }}>
                  <Rich>{p}</Rich>
                </li>
              ))}
            </ul>
          </Card>
          <Card accent>
            <h3 className="text-base">{UI.modeling.soTheSplitFollows}</h3>
            <ul className="mt-3 flex list-none flex-col gap-2 p-0 text-sm">
              {MODEL_VALIDATION.bodyPoints.map((p, i) => (
                <li key={i} style={{ borderLeft: '2px solid var(--accent-primary)', paddingLeft: '0.75rem', color: 'var(--text-secondary)' }}>
                  <Rich>{p}</Rich>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <Note>
          <Rich>{MODEL_VALIDATION.consequence}</Rich>
        </Note>
      </section>

      {/* --- Dos modelos --- */}
      <section>
        <SectionTitle eyebrow={UI.modeling.ebACriticismOfThe}><Rich>{MODEL_TWO.title}</Rich></SectionTitle>
        <Pullquote><Rich>{MODEL_TWO.objection}</Rich></Pullquote>
        <p className="max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{MODEL_TWO.body}</Rich>
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {MODEL_TWO.models.map((m, i) => (
            <Card key={m.name} accent>
              <Badge tone={i === 0 ? 'info' : 'pure'}>{m.name}</Badge>
              <p className="mt-3 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {m.inputs}
              </p>
              <p className="mt-2 text-sm" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                <Rich>{m.asks}</Rich>
              </p>
              <ul className="mt-3 flex list-none flex-col gap-2 p-0 text-sm">
                <li style={{ borderLeft: '2px solid var(--status-pure)', paddingLeft: '0.75rem', color: 'var(--text-secondary)' }}>
                  <Rich>{m.pro}</Rich>
                </li>
                <li style={{ borderLeft: '2px solid var(--status-amorphous)', paddingLeft: '0.75rem', color: 'var(--text-secondary)' }}>
                  <Rich>{m.limit}</Rich>
                </li>
              </ul>
            </Card>
          ))}
        </div>
        <p className="mt-4 text-sm" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
          <Rich>{MODEL_TWO.note}</Rich>
        </p>
      </section>

      {/* --- Cifras de rendimiento, antes que la prosa --- */}
      <section>
        <SectionTitle eyebrow={UI.modeling.whereTheModelStands.eyebrow}>{UI.modeling.whereTheModelStands.title}</SectionTitle>
        <p className="mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{MODEL_SCORECARD_INTRO}</Rich>
        </p>
        <ModelScorecard />
      </section>

      {/* --- La lectura honesta --- */}
      <section>
        <SectionTitle eyebrow={UI.modeling.ebAssessment}><Rich>{MODEL_ASSESSMENT.title}</Rich></SectionTitle>
        <p className="mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{MODEL_ASSESSMENT.lead}</Rich>
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {MODEL_ASSESSMENT.points.map((p) => (
            <Card key={p.title}>
              <h3 className="text-base"><Rich>{p.title}</Rich></h3>
              <ul className="mt-3 flex list-none flex-col gap-2.5 p-0 text-sm">
                {p.bullets.map((b, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span aria-hidden style={{ color: 'var(--accent-primary)', flexShrink: 0 }}>
                      &mdash;
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}><Rich>{b}</Rich></span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>

        <Card accent className="mt-4">
          <h3 className="text-lg"><Rich>{MODEL_ASSESSMENT.cause.title}</Rich></h3>
          <p className="mt-3" style={{ color: 'var(--text-secondary)' }}>
            <Rich>{MODEL_ASSESSMENT.cause.body}</Rich>
          </p>
          <p
            className="mt-4 p-3 text-sm"
            style={{
              borderLeft: '4px solid var(--accent-secondary)',
              background: 'var(--surface-elevated)',
              color: 'var(--text-secondary)',
            }}
          >
            <Rich>{MODEL_ASSESSMENT.cause.expectation}</Rich>
          </p>
        </Card>

        <div className="mt-4">
          <h3 className="mb-3 text-base"><Rich>{MODEL_ASSESSMENT.next.title}</Rich></h3>
          <ol className="grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2">
            {MODEL_ASSESSMENT.next.items.map((it, i) => {
              const Icon = NEXT_ICON[it.icon] ?? Target
              return (
                <li key={it.head}>
                  <Card className="h-full">
                    <div className="flex items-start gap-3">
                      <span
                        aria-hidden
                        className="flex items-center justify-center rounded-full"
                        style={{
                          width: 34, height: 34, flexShrink: 0,
                          border: '2.5px solid var(--accent-primary)',
                          color: 'var(--accent-primary)',
                        }}
                      >
                        <Icon size={17} />
                      </span>
                      <div>
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                            {i + 1}. {it.head}
                          </span>
                          <Badge tone="neutral">{it.cost}</Badge>
                        </div>
                        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                          <Rich>{it.body}</Rich>
                        </p>
                      </div>
                    </div>
                  </Card>
                </li>
              )
            })}
          </ol>
        </div>

        <Card accent className="mt-4">
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            <Rich>{MODEL_ASSESSMENT.closing}</Rich>
          </p>
        </Card>
      </section>

      {/* --- Metricas --- */}
      <section>
        <SectionTitle eyebrow={UI.modeling.theMetricsAndWhy.eyebrow}>{UI.modeling.theMetricsAndWhy.title}</SectionTitle>
        <ScrollTable head={MODEL_METRICS.tableHead} rows={MODEL_METRICS.tableRows} />
        <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          <Rich>{MODEL_METRICS.note}</Rich>
        </p>
      </section>

      {/* --- Que dicen los numeros --- */}
      <section>
        <SectionTitle eyebrow={UI.modeling.whatTheseNumbersActually.eyebrow}>{UI.modeling.whatTheseNumbersActually.title}</SectionTitle>
        <ol className="flex list-none flex-col gap-4 p-0">
          {MODEL_FINDINGS.map((f, i) => (
            <li key={i}>
              <Card accent={i === 1}>
                <div className="flex items-start gap-4">
                  <span
                    className="shrink-0 text-2xl"
                    style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-primary)' }}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-base"><Rich>{f.title}</Rich></h3>
                    <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <Rich>{f.body}</Rich>
                    </p>
                    {f.caveat && (
                      <p
                        className="mt-3 p-3 text-sm"
                        style={{
                          borderLeft: '4px solid var(--status-incipient)',
                          background: 'var(--surface-elevated)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <Rich>{f.caveat}</Rich>
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* --- Errores --- */}
      <section>
        <SectionTitle eyebrow={UI.modeling.ebErrorAnalysis}><Rich>{MODEL_ERRORS.title}</Rich></SectionTitle>
        <p className="mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{MODEL_ERRORS.intro}</Rich>
        </p>
        <ScrollTable head={MODEL_ERRORS.tableHead} rows={MODEL_ERRORS.tableRows} />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card>
            <Badge tone="pure">{MODEL_ERRORS.asHopedBadge}</Badge>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{MODEL_ERRORS.amorphous}</Rich>
            </p>
          </Card>
          <Card>
            <Badge tone="amorphous">{MODEL_ERRORS.mainWeaknessBadge}</Badge>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{MODEL_ERRORS.crystalline}</Rich>
            </p>
          </Card>
        </div>
        <div className="my-6">
          <NotebookFigure
            src="nb06-10.png"
            alt={MODEL_ERRORS.confusionFigureAlt}
            caption={MODEL_ERRORS.confusionFigureCaption}
            source="notebook 06 §8.3"
          />
        </div>
        <Pullquote tone="incipient"><Rich>{MODEL_ERRORS.usage}</Rich></Pullquote>
      </section>

      {/* --- Lectura quimica --- */}
      <section>
        <SectionTitle eyebrow={UI.modeling.ebInterpretation}><Rich>{MODEL_CHEMISTRY.title}</Rich></SectionTitle>
        <p className="mb-6 max-w-3xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{MODEL_CHEMISTRY.why}</Rich>
        </p>
        <div className="grid gap-4 lg:grid-cols-3">
          {MODEL_CHEMISTRY.blocks.map((b) => (
            <Card key={b.name} accent>
              <h3 className="text-base"><Rich>{b.name}</Rich></h3>
              <div className="mt-1 text-xs uppercase tracking-wider" style={{ color: 'var(--accent-secondary-text)' }}>
                <Rich>{b.rank}</Rich>
              </div>
              <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <Rich>{b.body}</Rich>
              </p>
            </Card>
          ))}
        </div>
        <Pullquote tone="incipient">⚠️ <Rich>{MODEL_CHEMISTRY.caution}</Rich></Pullquote>
        <Card accent>
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            <Rich>{MODEL_CHEMISTRY.distinction}</Rich>
          </p>
        </Card>
      </section>

      {/* --- SHAP --- */}
      <section>
        <SectionTitle eyebrow={UI.modeling.ebDirectionNotJustMagnitude}><Rich>{MODEL_SHAP.title}</Rich></SectionTitle>
        <Card>
          <p style={{ color: 'var(--text-secondary)' }}><Rich>{MODEL_SHAP.body}</Rich></p>
          <p className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
            <Rich>{MODEL_SHAP.note}</Rich>
          </p>
        </Card>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <NotebookFigure
            src="nb06-11.png"
            alt={MODEL_SHAP.permutationFigureAlt}
            caption={MODEL_SHAP.permutationFigureCaption}
            source="notebook 06 §8.4"
          />
          <NotebookFigure
            src="nb06-12.png"
            alt={MODEL_SHAP.shapFigureAlt}
            caption={MODEL_SHAP.shapFigureCaption}
            source="notebook 06 §8.4"
          />
        </div>
      </section>

      <section>
        <SectionTitle eyebrow={UI.modeling.theNotebookBehindThis.eyebrow}>{UI.modeling.theNotebookBehindThis.title}</SectionTitle>
        <NotebookList only="05" />
      </section>

      <section>
        <SectionTitle eyebrow={UI.modeling.whatTheModelingStage.eyebrow}>{UI.modeling.whatTheModelingStage.title}</SectionTitle>
        <Card accent>
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            <Rich>{MODEL_TAKEAWAY.body}</Rich>
          </p>
          <p className="mt-4 text-lg" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            <Rich>{MODEL_TAKEAWAY.close}</Rich>
          </p>
        </Card>
      </section>
    </div>
  )
}
