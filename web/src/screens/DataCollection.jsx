import { useBundle } from '../i18n/LocaleContext.jsx'
import * as UI_EN from '../content/ui.js'
import * as UI_ES from '../content/es/ui.js'
import { ExternalLink, Fingerprint, Link2, ScrollText, Shapes } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, Card, Rich, ScrollTable, SectionTitle } from '../components/ui.jsx'
import NotebookList from '../components/NotebookList.jsx'
import WorkflowMap from '../components/WorkflowMap.jsx'
import IngestedRowTree from '../components/IngestedRowTree.jsx'
import STACK from '../data/stack_icons.json'
import * as SITE_EN from '../content/site.js'
import * as SITE_ES from '../content/es/site.js'
import * as COLLECTION_EN from '../content/collection.js'
import * as COLLECTION_ES from '../content/es/collection.js'

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
  const { UI } = useBundle(UI_EN, UI_ES)
  const { SITE } = useBundle(SITE_EN, SITE_ES)
  const { COLLECTION_CANVAS_INTRO, COLLECTION_HERO, COLLECTION_PROBLEM, COLLECTION_ROW_INTRO, COLLECTION_SCHEMA_NOTE, COLLECTION_TREE, ROW_SHAPE } = useBundle(COLLECTION_EN, COLLECTION_ES)

  return (
    <div className="flex flex-col gap-16">
      <section>
        <Badge tone="accent">02 · Data Collection</Badge>
        <h1 className="mt-4 text-3xl uppercase md:text-5xl" style={{ fontFamily: 'var(--font-display)', letterSpacing: '2px' }}>{UI.collection.theIngestionWorkflow}</h1>
        <p className="mt-6 max-w-3xl text-lg" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{COLLECTION_HERO.lead}</Rich>
        </p>
      </section>

      {/* --- El problema y su solucion, en un solo hilo --- */}
      <section>
        <SectionTitle eyebrow={UI.collection.whyThisExists.eyebrow}>{UI.collection.whyThisExists.title}</SectionTitle>
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
            {COLLECTION_PROBLEM.seeOnGithub}
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
        <SectionTitle eyebrow={UI.collection.theWorkflowCanvas.eyebrow}>{UI.collection.theWorkflowCanvas.title}</SectionTitle>
        <p className="mb-6 max-w-3xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{COLLECTION_CANVAS_INTRO}</Rich>
        </p>
        <WorkflowMap />
      </section>

      <section>
        <SectionTitle eyebrow={UI.collection.whatAIngestedMeasurement.eyebrow}>{UI.collection.whatAIngestedMeasurement.title}</SectionTitle>
        <p className="mb-6 max-w-3xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{COLLECTION_ROW_INTRO}</Rich>
        </p>
        <ScrollTable head={['Field', 'What it carries']} rows={ROW_SHAPE.map(([a, b]) => [<code key={a}><Rich>{a}</Rich></code>, b])} />
      </section>

      {/* --- La misma fila, pero de verdad --- */}
      <section>
        <SectionTitle eyebrow={UI.collection.ebTheSameRowOpened}>{COLLECTION_TREE.title}</SectionTitle>
        <p className="mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{COLLECTION_TREE.lead}</Rich>
        </p>
        <IngestedRowTree />
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card accent>
            <h3 className="text-base">{UI.collection.headerMetadata}</h3>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{COLLECTION_TREE.point}</Rich>
            </p>
          </Card>
          <Card>
            <h3 className="text-base">{UI.collection.rawData}</h3>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{COLLECTION_TREE.contract}</Rich>
            </p>
          </Card>
        </div>
      </section>

      <section>
        <SectionTitle eyebrow={UI.collection.thePostgresqlSchema.eyebrow}>{UI.collection.thePostgresqlSchema.title}</SectionTitle>
        <p className="max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{COLLECTION_SCHEMA_NOTE.before}</Rich>{' '}
          <Link to="/database" style={{ color: 'var(--accent-primary)' }}>
            {COLLECTION_SCHEMA_NOTE.linkText}
          </Link>{' '}
          {COLLECTION_SCHEMA_NOTE.after}
        </p>
      </section>

      <section>
        <SectionTitle eyebrow={UI.collection.notebooksBehindThisScreen.eyebrow}>{UI.collection.notebooksBehindThisScreen.title}</SectionTitle>
        <NotebookList only="02" />
      </section>
    </div>
  )
}
