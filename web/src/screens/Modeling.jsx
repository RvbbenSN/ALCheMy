import { MODELS } from '../content/site.js'
import { Badge, Card, Placeholder, ScrollTable, SectionTitle, Term } from '../components/ui.jsx'

export default function Modeling() {
  return (
    <div className="flex flex-col gap-16">
      <section>
        <Badge tone="accent">05 · Modeling</Badge>
        <h1 className="mt-4 text-3xl uppercase md:text-5xl" style={{ fontFamily: 'var(--font-display)', letterSpacing: '2px' }}>
          Training &amp; Evaluation
        </h1>
        <p className="mt-6 max-w-3xl text-lg" style={{ color: 'var(--text-secondary)' }}>
          Three algorithms, one honest score, and one better-looking model that was thrown away on purpose.
        </p>
      </section>

      <section>
        <SectionTitle eyebrow="The setup">Classification, not regression</SectionTitle>
        <Placeholder source="notebooks/06_...ipynb">
          Copy pending: the target is the same three-way verdict the bench already used — pure crystalline,
          incipient, amorphous — and the argument for why framing this as classification rather than
          regression is a choice that cannot be repaired later.
        </Placeholder>
      </section>

      <section>
        <SectionTitle eyebrow="The candidates">Three algorithms and what each assumes</SectionTitle>
        <Placeholder source="notebooks/06_...ipynb">
          Copy pending: one card per algorithm — Random Forest, LightGBM, XGBoost — explaining how it works,
          what it assumes about the data, and why it was worth trying here. Stratified cross-validation
          throughout.
        </Placeholder>
      </section>

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

      <section>
        <SectionTitle eyebrow="The most important thing on this page">
          Why 0.522 is worth more than 0.620
        </SectionTitle>
        <Card accent>
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            Version 2 scored <strong style={{ color: 'var(--status-amorphous)' }}>0.620</strong> and is
            marked invalid. It had been trained on a mixture of high-throughput, solvothermal and
            microwave syntheses, so it partly learned to recognise <em>which method made the sample</em>{' '}
            rather than whether the chemistry would crystallise. The higher score was measuring the wrong
            thing.
          </p>
          <p className="mt-4 text-lg" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            Version 3 restricts training to one synthesis method and scores{' '}
            <strong style={{ color: 'var(--status-pure)' }}>0.522</strong>. That number is lower and it is
            real.
          </p>
          <p className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
            The right yardstick for an <Term k="F1 macro" /> of 0.522 is not 1.0 — it is what a trivial
            classifier would score on three imbalanced classes. That comparison belongs on screen, next to
            the number.
          </p>
        </Card>
      </section>

      <section>
        <SectionTitle eyebrow="Interpretation">What the model actually learned</SectionTitle>
        <Placeholder source="notebooks/06_...ipynb">
          Pending: interactive confusion matrix and SHAP feature importances, read chemically — metal centre
          and acidity dominating nucleation — plus the argument for why a metal is not a label, and physico-
          chemical descriptors beat one-hot encoding.
        </Placeholder>
      </section>
    </div>
  )
}
