import { MODELS } from '../content/site.js'
import {
  MODEL_CHEMISTRY,
  MODEL_ERRORS,
  MODEL_FINDINGS,
  MODEL_LINEUP,
  MODEL_METRICS,
  MODEL_SHAP,
  MODEL_TWO,
  MODEL_VALIDATION,
} from '../content/screens.js'
import { Badge, Card, Placeholder, ScrollTable, SectionTitle } from '../components/ui.jsx'

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
          With the problem properly framed and the data prepared, this stage is surprisingly short. That
          is the correct order — and the reason the honest score here is lower than the dishonest one that
          preceded it.
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
          {MODEL_LINEUP.intro}
        </p>
        <ScrollTable head={MODEL_LINEUP.tableHead} rows={MODEL_LINEUP.tableRows} />
        <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          Every model that supports it carries balanced class weights, which offsets the 5.8:1 imbalance
          by penalising errors on the minority classes more heavily.
        </p>
      </section>

      {/* --- Validacion --- */}
      <section>
        <SectionTitle eyebrow="Validation">{MODEL_VALIDATION.title}</SectionTitle>
        <Card accent>
          <p style={{ color: 'var(--text-secondary)' }}>{MODEL_VALIDATION.body}</p>
        </Card>
      </section>

      {/* --- Dos modelos --- */}
      <section>
        <SectionTitle eyebrow="A criticism of the problem, not the execution">{MODEL_TWO.title}</SectionTitle>
        <Pullquote>{MODEL_TWO.objection}</Pullquote>
        <p className="max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          {MODEL_TWO.body}
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card accent>
            <Badge tone="info">Full model</Badge>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {MODEL_TWO.full}
            </p>
          </Card>
          <Card accent>
            <Badge tone="pure">Actionable model</Badge>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {MODEL_TWO.actionable}
            </p>
          </Card>
        </div>
        <p className="mt-4 text-sm" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
          {MODEL_TWO.note}
        </p>
      </section>

      {/* --- Metricas --- */}
      <section>
        <SectionTitle eyebrow="Evaluation">The metrics, and why accuracy misleads here</SectionTitle>
        <ScrollTable head={MODEL_METRICS.tableHead} rows={MODEL_METRICS.tableRows} />
        <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          {MODEL_METRICS.note}
        </p>
      </section>

      {/* --- Registro --- */}
      <section>
        <SectionTitle eyebrow="The registry">What was trained, and what survived</SectionTitle>
        <ScrollTable
          head={['Model', 'Algorithm', 'F1 macro', 'Size', 'Status']}
          rows={MODELS.map((m) => [
            <span key={m.name}>
              <code>{m.name}</code>
              <br />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>{m.note}</span>
            </span>,
            m.algo,
            m.f1,
            m.size,
            <Badge key="s" tone={m.status === 'INVALID' ? 'amorphous' : 'pure'}>
              {m.status}
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
                    <h3 className="text-base">{f.title}</h3>
                    <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {f.body}
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
                        {f.caveat}
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
        <SectionTitle eyebrow="Error analysis">{MODEL_ERRORS.title}</SectionTitle>
        <p className="mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          {MODEL_ERRORS.intro}
        </p>
        <ScrollTable head={MODEL_ERRORS.tableHead} rows={MODEL_ERRORS.tableRows} />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card>
            <Badge tone="pure">As hoped</Badge>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {MODEL_ERRORS.amorphous}
            </p>
          </Card>
          <Card>
            <Badge tone="amorphous">The main weakness</Badge>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {MODEL_ERRORS.crystalline}
            </p>
          </Card>
        </div>
        <Pullquote tone="incipient">{MODEL_ERRORS.usage}</Pullquote>
        <Placeholder source="notebooks/06 (section 8.3)">
          Interactive confusion matrix pending, normalised by true class.
        </Placeholder>
      </section>

      {/* --- Lectura quimica --- */}
      <section>
        <SectionTitle eyebrow="Interpretation">{MODEL_CHEMISTRY.title}</SectionTitle>
        <p className="mb-6 max-w-3xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          {MODEL_CHEMISTRY.why}
        </p>
        <div className="grid gap-4 lg:grid-cols-3">
          {MODEL_CHEMISTRY.blocks.map((b) => (
            <Card key={b.name} accent>
              <h3 className="text-base">{b.name}</h3>
              <div className="mt-1 text-xs uppercase tracking-wider" style={{ color: 'var(--accent-secondary-text)' }}>
                {b.rank}
              </div>
              <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {b.body}
              </p>
            </Card>
          ))}
        </div>
        <Pullquote tone="incipient">⚠️ {MODEL_CHEMISTRY.caution}</Pullquote>
        <Card accent>
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            {MODEL_CHEMISTRY.distinction}
          </p>
        </Card>
      </section>

      {/* --- SHAP --- */}
      <section>
        <SectionTitle eyebrow="Direction, not just magnitude">{MODEL_SHAP.title}</SectionTitle>
        <Card>
          <p style={{ color: 'var(--text-secondary)' }}>{MODEL_SHAP.body}</p>
          <p className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
            {MODEL_SHAP.note}
          </p>
        </Card>
        <div className="mt-4">
          <Placeholder source="notebooks/06 (section 8.4)">
            SHAP beeswarm plot pending, plus the block-level permutation importance chart.
          </Placeholder>
        </div>
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
