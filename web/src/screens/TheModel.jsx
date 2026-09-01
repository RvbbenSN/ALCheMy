import { Badge, Card, Placeholder, SectionTitle, Term } from '../components/ui.jsx'
import NotebookList from '../components/NotebookList.jsx'
import Simulator from '../components/Simulator.jsx'

export default function TheModel() {
  return (
    <div className="flex flex-col gap-16">
      <section>
        <Badge tone="accent">06 · The Model</Badge>
        <h1 className="mt-4 text-3xl uppercase md:text-5xl" style={{ fontFamily: 'var(--font-display)', letterSpacing: '2px' }}>
          Simulator, Registry &amp; Active Learning
        </h1>
        <p className="mt-6 max-w-3xl text-lg" style={{ color: 'var(--text-secondary)' }}>
          Play with the synthesis conditions and watch the prediction move — then see the governance that
          keeps this from being a loose pickle file.
        </p>
      </section>

      <section>
        <SectionTitle eyebrow="The virtual lab">In-silico synthesis</SectionTitle>
        <Simulator />
      </section>

      <section>
        <SectionTitle eyebrow="Closing the loop">Design tomorrow&rsquo;s 24-well block</SectionTitle>
        <Placeholder source="notebooks/06_...ipynb (section 9)">
          Pending: the model proposes 24 conditions — exactly one multi-autoclave block — ranked by
          probability of yielding a crystalline phase. The platform hands the lab back its own working
          format.
        </Placeholder>
      </section>

      <section>
        <SectionTitle eyebrow="Governance">The model registry</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Five relational tables and one view hold the full lineage of every model: the exact git
              commit, hyperparameters, excluded variables <em>with their scientific justification</em>,
              metrics in long format, and the serialized binary — all under strict CHECK constraints, and
              included in the database backup routine.
            </p>
          </Card>
          <Card accent>
            <h3 className="text-base">The <code>-dirty</code> suffix</h3>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              If a model is trained while the working tree has uncommitted changes, the recorded commit
              hash gets a <code>-dirty</code> suffix. It is a small thing, and it is the difference between
              a lineage record you can trust and one you merely hope is right.
            </p>
          </Card>
        </div>
      </section>

      <section>
        <SectionTitle eyebrow="Feedback">Active learning</SectionTitle>
        <Card>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            The loop identifies the regions where the model hesitates between incipient and amorphous — the
            crystallization boundary — and prioritises them for the next real experiments. Prediction feeds
            the bench; the bench feeds the next model version.
          </p>
        </Card>
      </section>

      <section>
        <SectionTitle eyebrow="Deliverable">One-page technical datasheet</SectionTitle>
        <Placeholder source="design_system/templates/, n8n">
          Pending: a printable one-page report per sample with pseudonymized identifier, conditions, the
          analysed diffractogram and the model verdict, generated automatically.
        </Placeholder>
      </section>
    </div>
  )
}
