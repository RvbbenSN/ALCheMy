import { Badge, Card, Placeholder, Rich, ScrollTable, SectionTitle } from '../components/ui.jsx'
import NotebookList from '../components/NotebookList.jsx'
import WorkflowMap from '../components/WorkflowMap.jsx'
import {
  COLLECTION_CANVAS_INTRO,
  COLLECTION_HERO,
  COLLECTION_HOW,
  COLLECTION_PENDING,
  COLLECTION_PROBLEM,
  COLLECTION_ROW_INTRO,
  ROW_SHAPE,
} from '../content/collection.js'

export default function DataCollection() {
  return (
    <div className="flex flex-col gap-16">
      <section>
        <Badge tone="accent">02 · Data Collection</Badge>
        <h1 className="mt-4 text-3xl uppercase md:text-5xl" style={{ fontFamily: 'var(--font-display)', letterSpacing: '2px' }}>
          The n8n Ingestion Workflow
        </h1>
        <p className="mt-6 max-w-3xl text-lg" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{COLLECTION_HERO.lead}</Rich>
        </p>
      </section>

      {/* --- Que problema resuelve esto, antes de nada --- */}
      <section>
        <SectionTitle eyebrow="The problem">Why this exists</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <p style={{ color: 'var(--text-secondary)' }}>
              <Rich>{COLLECTION_PROBLEM.body1}</Rich>
            </p>
            <p className="mt-4" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{COLLECTION_PROBLEM.body2}</Rich>
            </p>
          </Card>
          <Card accent>
            <h3 className="text-base"><Rich>{COLLECTION_PROBLEM.guaranteesTitle}</Rich></h3>
            <ul className="mt-3 flex list-none flex-col gap-2 p-0 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {COLLECTION_PROBLEM.guarantees.map(([lead, body]) => (
                <li key={lead}>
                  <strong><Rich>{lead}</Rich></strong> {body}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      {/* --- Que hay dentro del flujo, en una frase --- */}
      <section>
        <SectionTitle eyebrow="In one sentence">How it works</SectionTitle>
        <Card accent>
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            <Rich>{COLLECTION_HOW}</Rich>
          </p>
        </Card>
      </section>

      <section>
        <SectionTitle eyebrow="Interactive">The workflow canvas</SectionTitle>
        <p className="mb-6 max-w-3xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{COLLECTION_CANVAS_INTRO}</Rich>
        </p>
        <WorkflowMap />
      </section>

      <section>
        <SectionTitle eyebrow="Start from the goal, not the flow">
          What a row must look like when it lands
        </SectionTitle>
        <p className="mb-6 max-w-3xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{COLLECTION_ROW_INTRO}</Rich>
        </p>
        <ScrollTable head={['Field', 'What it carries']} rows={ROW_SHAPE.map(([a, b]) => [<code key={a}><Rich>{a}</Rich></code>, b])} />
      </section>

      <section>
        <SectionTitle eyebrow="Where it lands">The PostgreSQL schema</SectionTitle>
        <Placeholder source="scripts/init_db.sql, data_dictionary">
          <Rich>{COLLECTION_PENDING.schema}</Rich>
        </Placeholder>
      </section>

      <section>
        <SectionTitle eyebrow="The code itself">Notebooks behind this screen</SectionTitle>
        <NotebookList only="02" />
      </section>

      <section>
        <SectionTitle eyebrow="Governance">Audit log</SectionTitle>
        <Placeholder source="audit_log"><Rich>{COLLECTION_PENDING.audit}</Rich></Placeholder>
      </section>
    </div>
  )
}
