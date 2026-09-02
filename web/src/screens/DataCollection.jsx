import { Badge, Card, Placeholder, ScrollTable, SectionTitle, Term } from '../components/ui.jsx'
import NotebookList from '../components/NotebookList.jsx'
import WorkflowMap from '../components/WorkflowMap.jsx'

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

      {/* --- Que problema resuelve esto, antes de nada --- */}
      <section>
        <SectionTitle eyebrow="The problem">Why this exists</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <p style={{ color: 'var(--text-secondary)' }}>
              At the end of the previous screen the laboratory has thousands of instrument files spread
              across network folders, written by nine different machines in nine different formats. None
              of them knows which synthesis it belongs to, and nothing stops the same file being saved
              twice under two names.
            </p>
            <p className="mt-4" style={{ color: 'var(--text-secondary)' }}>
              What is needed is unglamorous and specific: <strong>a way to drop a file somewhere and have
              it end up in a database, correctly attributed, without anyone retyping anything.</strong>
            </p>
          </Card>
          <Card accent>
            <h3 className="text-base">What the workflow guarantees</h3>
            <ul className="mt-3 flex list-none flex-col gap-2 p-0 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <li>
                <strong>Attribution.</strong> Every measurement is linked to the synthesis it came from,
                by sample code, and to the person who submitted it.
              </li>
              <li>
                <strong>No duplicates.</strong> A cryptographic fingerprint of the file contents rejects
                a second copy before it is parsed.
              </li>
              <li>
                <strong>Uniform shape.</strong> Nine formats become one row shape, so a query can span
                techniques without knowing anything about instruments.
              </li>
              <li>
                <strong>A record of every decision.</strong> Accepted or rejected, with the reason, in an
                audit table written by code and never by a language model.
              </li>
            </ul>
          </Card>
        </div>
      </section>

      {/* --- Que hay dentro del flujo, en una frase --- */}
      <section>
        <SectionTitle eyebrow="In one sentence">How it works</SectionTitle>
        <Card accent>
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            A file arrives by one of three routes. Its metadata is normalised and the sender checked
            against a whitelist. Its fingerprint is taken and compared against what is already stored. It
            is then routed by technique to one of three extraction strategies — a deterministic parser
            for the seven formats that are well understood, an AI agent for the reports that only exist
            as PDFs, and a vision agent that adds a description to microscopy images without ever
            inventing a measurement. Whatever happens, the outcome is written to the audit log.
          </p>
        </Card>
      </section>

      <section>
        <SectionTitle eyebrow="Interactive">The workflow canvas</SectionTitle>
        <p className="mb-6 max-w-3xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          The flow as it exists in n8n &mdash; <strong>79 nodes</strong>, <strong>114 connections</strong>,
          nine framed areas &mdash; read straight from the exported workflow, not redrawn by hand.
          Pick a stop and the map flies to it, with the card above saying what that area adds to the
          row and why. The last stop pulls back to the whole flow.
        </p>
        <WorkflowMap />
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
