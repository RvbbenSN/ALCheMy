import { MODELS } from '../content/site.js'
import {
  MODEL_ASSESSMENT,
  MODEL_CHEMISTRY,
  MODEL_ERRORS,
  MODEL_FINDINGS,
  MODEL_LINEUP,
  MODEL_METRICS,
  MODEL_SHAP,
  MODEL_TWO,
  MODEL_VALIDATION,
} from '../content/screens.js'
import { Badge, Card, Placeholder, ScrollTable, SectionTitle, Rich} from '../components/ui.jsx'
import NotebookList from '../components/NotebookList.jsx'
import NotebookFigure from '../components/NotebookFigure.jsx'
import ModelScorecard from '../components/ModelScorecard.jsx'

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
  return (
    <div className="flex flex-col gap-16">
      <section>
        <Badge tone="accent">05 · Modeling &amp; Evaluation</Badge>
        <h1 className="mt-4 text-3xl uppercase md:text-5xl" style={{ fontFamily: 'var(--font-display)', letterSpacing: '2px' }}>
          Training &amp; Evaluation
        </h1>
        <p className="mt-6 max-w-3xl text-lg" style={{ color: 'var(--text-secondary)' }}>
          With the problem framed and the data prepared, this stage is short. That is the correct order,
          and it is also why the figure reported here is lower than the one this analysis reported before
          the confounding was removed.
        </p>
      </section>

      {/* --- El planteamiento --- */}
      <section>
        <SectionTitle eyebrow="The framing">Classification, and why not regression</SectionTitle>
        <Card>
          <p style={{ color: 'var(--text-secondary)' }}>
            The target is the same three-way verdict the bench already used when triaging a 24-well plate:
            amorphous, incipient, or a well-ordered crystalline phase. Framing it as classification rather
            than regression is a decision that cannot be repaired later — there is no continuous
            &ldquo;degree of crystallinity&rdquo; that the human labels actually recorded, and inventing
            one would mean scoring the model against a quantity nobody measured.
          </p>
          <p className="mt-4" style={{ color: 'var(--text-secondary)' }}>
            One consequence follows immediately, and it is easy to get wrong: mean relative error, RMSE
            and R² do not apply. They belong to regression and measure distance to a number. In
            classification you either get the class right or you do not.
          </p>
        </Card>
      </section>

      {/* --- Los diez modelos --- */}
      <section>
        <SectionTitle eyebrow="Experimental design">Ten models, not one</SectionTitle>
        <p className="mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{MODEL_LINEUP.intro}</Rich>
        </p>
        <ScrollTable head={MODEL_LINEUP.tableHead} rows={MODEL_LINEUP.tableRows} />
        <div className="mt-6">
          <NotebookFigure
            src="nb06-09.png"
            alt="Comparison of the ten models by macro F1 and MCC, high-throughput syntheses only"
            caption="All ten compared under the same grouped cross-validation. The baseline is the bar everything else has to clear — and Naive Bayes does not clear it."
            source="notebook 06 §8"
          />
        </div>
        <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          Every model that supports it carries balanced class weights, which offsets the 5.8:1 imbalance
          by penalising errors on the minority classes more heavily.
        </p>
      </section>

      {/* --- Validacion --- */}
      <section>
        <SectionTitle eyebrow="Validation"><Rich>{MODEL_VALIDATION.title}</Rich></SectionTitle>
        <Card accent>
          <p style={{ color: 'var(--text-secondary)' }}><Rich>{MODEL_VALIDATION.body}</Rich></p>
        </Card>
      </section>

      {/* --- Dos modelos --- */}
      <section>
        <SectionTitle eyebrow="A criticism of the problem, not the execution"><Rich>{MODEL_TWO.title}</Rich></SectionTitle>
        <Pullquote><Rich>{MODEL_TWO.objection}</Rich></Pullquote>
        <p className="max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{MODEL_TWO.body}</Rich>
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card accent>
            <Badge tone="info">Full model</Badge>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{MODEL_TWO.full}</Rich>
            </p>
          </Card>
          <Card accent>
            <Badge tone="pure">Actionable model</Badge>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{MODEL_TWO.actionable}</Rich>
            </p>
          </Card>
        </div>
        <p className="mt-4 text-sm" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
          <Rich>{MODEL_TWO.note}</Rich>
        </p>
      </section>

      {/* --- Cifras de rendimiento, antes que la prosa --- */}
      <section>
        <SectionTitle eyebrow="Performance">Where the model stands</SectionTitle>
        <p className="mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          The figures first. Every number below is cross-validated with plates as groups, and is shown
          against the trivial baseline — without that reference an F1 of 0.52 could mean anything.
        </p>
        <ModelScorecard />
      </section>

      {/* --- La lectura honesta --- */}
      <section>
        <SectionTitle eyebrow="Assessment"><Rich>{MODEL_ASSESSMENT.title}</Rich></SectionTitle>
        <p className="mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{MODEL_ASSESSMENT.lead}</Rich>
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {MODEL_ASSESSMENT.points.map((p) => (
            <Card key={p.title}>
              <h3 className="text-base">{p.title}</h3>
              <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <Rich>{p.body}</Rich>
              </p>
            </Card>
          ))}
        </div>

        <Card accent className="mt-4">
          <h3 className="text-lg">{MODEL_ASSESSMENT.cause.title}</h3>
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

        <Card className="mt-4">
          <h3 className="text-base">{MODEL_ASSESSMENT.next.title}</h3>
          <ol className="mt-4 flex list-decimal flex-col gap-3 pl-5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {MODEL_ASSESSMENT.next.items.map((it, i) => (
              <li key={i}>
                <Rich>{it}</Rich>
              </li>
            ))}
          </ol>
        </Card>

        <Card accent className="mt-4">
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            <Rich>{MODEL_ASSESSMENT.closing}</Rich>
          </p>
        </Card>
      </section>

      {/* --- Metricas --- */}
      <section>
        <SectionTitle eyebrow="Evaluation">The metrics, and why accuracy misleads here</SectionTitle>
        <ScrollTable head={MODEL_METRICS.tableHead} rows={MODEL_METRICS.tableRows} />
        <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          <Rich>{MODEL_METRICS.note}</Rich>
        </p>
      </section>

      {/* --- Registro --- */}
      <section>
        <SectionTitle eyebrow="The registry">What was trained, and what survived</SectionTitle>
        <ScrollTable
          head={['Model', 'Algorithm', 'F1 macro', 'Size', 'Status']}
          rows={MODELS.map((m) => [
            <span key={m.name}>
              <code><Rich>{m.name}</Rich></code>
              <br />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}><Rich>{m.note}</Rich></span>
            </span>,
            m.algo,
            m.f1,
            m.size,
            <Badge key="s" tone={m.status === 'INVALID' ? 'amorphous' : 'pure'}>
              <Rich>{m.status}</Rich>
            </Badge>,
          ])}
        />
      </section>

      {/* --- Que dicen los numeros --- */}
      <section>
        <SectionTitle eyebrow="Results">What these numbers actually say</SectionTitle>
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
        <SectionTitle eyebrow="Error analysis"><Rich>{MODEL_ERRORS.title}</Rich></SectionTitle>
        <p className="mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{MODEL_ERRORS.intro}</Rich>
        </p>
        <ScrollTable head={MODEL_ERRORS.tableHead} rows={MODEL_ERRORS.tableRows} />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card>
            <Badge tone="pure">As hoped</Badge>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{MODEL_ERRORS.amorphous}</Rich>
            </p>
          </Card>
          <Card>
            <Badge tone="amorphous">The main weakness</Badge>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{MODEL_ERRORS.crystalline}</Rich>
            </p>
          </Card>
        </div>
        <div className="my-6">
          <NotebookFigure
            src="nb06-10.png"
            alt="Confusion matrix of the Random Forest model on held-out plates, as counts and row-normalised"
            caption="Left, raw counts; right, normalised by true class so each row reads as recall. The diagonal is where the model is right — and the crystalline row is where it is weakest."
            source="notebook 06 §8.3"
          />
        </div>
        <Pullquote tone="incipient"><Rich>{MODEL_ERRORS.usage}</Rich></Pullquote>
      </section>

      {/* --- Lectura quimica --- */}
      <section>
        <SectionTitle eyebrow="Interpretation"><Rich>{MODEL_CHEMISTRY.title}</Rich></SectionTitle>
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
        <Pullquote tone="incipient">⚠️ {MODEL_CHEMISTRY.caution}</Pullquote>
        <Card accent>
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            <Rich>{MODEL_CHEMISTRY.distinction}</Rich>
          </p>
        </Card>
      </section>

      {/* --- SHAP --- */}
      <section>
        <SectionTitle eyebrow="Direction, not just magnitude"><Rich>{MODEL_SHAP.title}</Rich></SectionTitle>
        <Card>
          <p style={{ color: 'var(--text-secondary)' }}><Rich>{MODEL_SHAP.body}</Rich></p>
          <p className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
            <Rich>{MODEL_SHAP.note}</Rich>
          </p>
        </Card>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <NotebookFigure
            src="nb06-11.png"
            alt="Permutation importance of the features, coloured by chemical block"
            caption="Permutation importance, coloured by chemical block. Metal chemistry dominates; the stoichiometry and medium block comes out negative, which is the operational definition of noise."
            source="notebook 06 §8.4"
          />
          <NotebookFigure
            src="nb06-12.png"
            alt="SHAP summary plot showing the direction in which each feature pushes the prediction"
            caption="SHAP values: horizontal position is how far a feature pushed the prediction towards crystalline, colour is the value of the feature itself."
            source="notebook 06 §8.4"
          />
        </div>
      </section>

      <section>
        <SectionTitle eyebrow="The code itself">The notebook behind this screen</SectionTitle>
        <NotebookList only="05" />
      </section>

      <section>
        <SectionTitle eyebrow="Takeaway">What the modeling stage established</SectionTitle>
        <Card accent>
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            There is real predictive signal in five years of laboratory records, and it is modest:
            roughly twice the trivial baseline. Most of what the model distinguishes is which
            metal-linker system was used rather than which conditions were applied — not because
            conditions do not matter chemically, but because this record did not vary them enough for
            their effect to be learnable.
          </p>
          <p className="mt-4 text-lg" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            That is a negative result, and it converts directly into an experimental instruction: the next
            campaign should sweep temperature and time far more widely than the last five years did.
          </p>
        </Card>
      </section>
    </div>
  )
}
