import { ExternalLink, Fingerprint, Link2, ScrollText, Shapes } from 'lucide-react'
import { Badge, Card, Placeholder, Rich, ScrollTable, SectionTitle } from '../components/ui.jsx'
import NotebookList from '../components/NotebookList.jsx'
import WorkflowMap from '../components/WorkflowMap.jsx'
import IngestedRowTree from '../components/IngestedRowTree.jsx'
import STACK from '../data/stack_icons.json'
import { SITE } from '../content/site.js'
import {
  COLLECTION_CANVAS_INTRO,
  COLLECTION_HERO,
  COLLECTION_PENDING,
  COLLECTION_PROBLEM,
  COLLECTION_ROW_INTRO,
  COLLECTION_TREE,
  ROW_SHAPE,
} from '../content/collection.js'

const N8N = STACK.items.find((i) => i.label === 'n8n')

const GUARANTEE_ICONS = { link: Link2, fingerprint: Fingerprint, shapes: Shapes, scroll: ScrollText }

/* El logotipo se pinta como mascara para que herede el color del tema, igual
   que en la rejilla del Overview. */
function N8nMark({ size = 18 }) {
  if (!N8N) return null
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        background: 'currentColor',
        WebkitMask: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='${N8N.path}'/></svg>") center / contain no-repeat`,
        mask: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='${N8N.path}'/></svg>") center / contain no-repeat`,
        verticalAlign: '-3px',
      }}
    />
  )
}

export default function DataCollection() {
  return (
    <div className="flex flex-col gap-16">
      <section>
        <Badge tone="accent">02 · Data Collection</Badge>
        <h1 className="mt-4 text-3xl uppercase md:text-5xl" style={{ fontFamily: 'var(--font-display)', letterSpacing: '2px' }}>
          The Ingestion Workflow
        </h1>
        <p className="mt-6 max-w-3xl text-lg" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{COLLECTION_HERO.lead}</Rich>
        </p>
      </section>

      {/* --- El problema y su solucion, en un solo hilo --- */}
      <section>
        <SectionTitle eyebrow="The problem, and the fix">Why this exists</SectionTitle>
        <p className="max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{COLLECTION_PROBLEM.body1}</Rich>
        </p>
        <p className="mt-4 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{COLLECTION_PROBLEM.body2}</Rich>
        </p>

        <p className="mt-4 flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <N8nMark />
          <span>
            <Rich>{COLLECTION_PROBLEM.builtWith}</Rich>
          </span>
          <a
            href={`${SITE.repo}/tree/main/n8n_workflows`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 inline-flex items-center gap-1 no-underline"
            style={{ color: 'var(--accent-primary)' }}
          >
            See the workflow on GitHub
            <ExternalLink size={13} aria-hidden />
          </a>
        </p>

        <h3 className="mt-8 text-lg">{COLLECTION_PROBLEM.guaranteesTitle}</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {COLLECTION_PROBLEM.guarantees.map((g) => {
            const Icon = GUARANTEE_ICONS[g.icon] ?? Link2
            return (
              <Card key={g.lead}>
                <div className="flex items-center gap-2.5">
                  <Icon size={18} aria-hidden style={{ color: 'var(--accent-primary)' }} />
                  <h4 className="text-base">{g.lead}</h4>
                </div>
                <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <Rich>{g.body}</Rich>
                </p>
              </Card>
            )
          })}
        </div>
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

      {/* --- La misma fila, pero de verdad --- */}
      <section>
        <SectionTitle eyebrow="The same row, opened up">{COLLECTION_TREE.title}</SectionTitle>
        <p className="mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{COLLECTION_TREE.lead}</Rich>
        </p>
        <IngestedRowTree />
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card accent>
            <h3 className="text-base">The part worth opening</h3>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{COLLECTION_TREE.point}</Rich>
            </p>
          </Card>
          <Card>
            <h3 className="text-base">And the part that never changes</h3>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{COLLECTION_TREE.contract}</Rich>
            </p>
          </Card>
        </div>
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
