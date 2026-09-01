import { Badge, Card, Placeholder, ScrollTable, SectionTitle, Term } from '../components/ui.jsx'
import NotebookList from '../components/NotebookList.jsx'
import WorkflowCanvas from '../components/WorkflowCanvas.jsx'

const ROW_SHAPE = [
  ['sample_code', 'Foreign key into synthesis_experiments'],
  ['technique', 'PXRD / VT-XRD / TGA / FTIR / ADSORPTION / UV_VIS / SEM / ICP_OES / EA'],
  ['researcher_email, researcher_name, operator_name', 'Accountability, checked against a whitelist'],
  ['measurement_tag, instrument_name', 'Provenance of the measurement'],
  ['file_name, raw_file_path', 'Where the original bytes live'],
  ['file_hash', 'Real MD5 of the actual file bytes'],
  ['data_json', '{ header_metadata, raw_data } — the parser contract'],
]

export default function DataCollection() {
  return (
    <div className="flex flex-col gap-16">
      <section>
        <Badge tone="accent">02 · Data Collection</Badge>
        <h1 className="mt-4 text-3xl uppercase md:text-5xl" style={{ fontFamily: 'var(--font-display)', letterSpacing: '2px' }}>
          The n8n Ingestion Workflow
        </h1>
        <p className="mt-6 max-w-3xl text-lg" style={{ color: 'var(--text-secondary)' }}>
          Three ways in, one row out — and a gate at every step that can reject a file before it costs
          anything to process.
        </p>
      </section>

      <section>
        <SectionTitle eyebrow="Start from the goal, not the flow">
          What a row must look like when it lands
        </SectionTitle>
        <p className="mb-6 max-w-3xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          Every path through this workflow has to arrive at the database write carrying exactly these
          fields. Think of the item as a snowball rolling through the pipeline, picking up more of this
          shape at each stage. If a field is still missing when it arrives, the insert either hard-fails on
          a constraint or silently stores a null — and it is worth knowing which section was supposed to
          set it.
        </p>
        <ScrollTable head={['Field', 'What it carries']} rows={ROW_SHAPE.map(([a, b]) => [<code key={a}>{a}</code>, b])} />
      </section>

      <section>
        <SectionTitle eyebrow="Three details worth stopping on">Where the engineering shows</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card accent>
            <Badge tone="amorphous">Bug found and fixed</Badge>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              The <Term k="MD5" /> hash was being computed over the binary&rsquo;s metadata marker instead of
              the file bytes. Every file therefore looked unique and the deduplication gate was silently
              useless. Now it hashes the decoded bytes.
            </p>
          </Card>
          <Card accent>
            <Badge tone="info">Design decision</Badge>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Error handling used to be a sub-workflow called eleven times. It is now two shared nodes,
              because a webhook response cannot be sent from outside the workflow that owns the trigger —
              and because sharing nodes beats duplicating them.
            </p>
          </Card>
          <Card accent>
            <Badge tone="pure">Guardrail</Badge>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              The vision agent <em>adds</em> a qualitative morphology description to the deterministic
              parser output. It never replaces a measured value, and it never invents a numeric particle
              size.
            </p>
          </Card>
        </div>
      </section>

      <section>
        <SectionTitle eyebrow="Interactive">The workflow canvas</SectionTitle>
        <p className="mb-6 max-w-3xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          Nine framed areas, in the order the item travels through them. The icon on each node says what
          kind of work it does — a decision, a parser, an AI agent, a database write. Open the{' '}
          <strong>Detail</strong> of an area to read what it adds to the row and why.
        </p>
        <WorkflowCanvas />
      </section>

      <section>
        <SectionTitle eyebrow="Where it lands">The PostgreSQL schema</SectionTitle>
        <Placeholder source="scripts/init_db.sql, data_dictionary">
          Schema explorer pending: an entity diagram of the governed tables, with each column&rsquo;s
          description read from the <code>data_dictionary</code> table itself — documented at 100% coverage.
        </Placeholder>
      </section>

      <section>
        <SectionTitle eyebrow="The code itself">Notebooks behind this screen</SectionTitle>
        <NotebookList only="02" />
      </section>

      <section>
        <SectionTitle eyebrow="Governance">Audit log</SectionTitle>
        <Placeholder source="audit_log">
          Live table pending: timestamp, agent, action, verdict and cause for every automated decision.
          Sample codes and emails pseudonymized before display.
        </Placeholder>
      </section>
    </div>
  )
}
