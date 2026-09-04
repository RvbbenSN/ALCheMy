import { useBundle } from '../i18n/LocaleContext.jsx'
import * as UI_EN from '../content/ui.js'
import * as UI_ES from '../content/es/ui.js'
import { Badge, Card, Note, Rich, ScrollTable, SectionTitle, Term } from '../components/ui.jsx'
import NotebookList from '../components/NotebookList.jsx'
import WorkflowMap from '../components/WorkflowMap.jsx'
import GraphConstellation from '../components/GraphConstellation.jsx'
import * as RAG_EN from '../content/rag.js'
import * as RAG_ES from '../content/es/rag.js'
import {
  BookOpen,
  BrainCircuit,
  DoorOpen,
  Fingerprint,
  Layers,
  Wrench,
} from 'lucide-react'

/* Un simbolo por etapa del flujo RAG, para el indice de bolas del mapa. El
   mapa de la ingesta trae los suyos por defecto; estos se le pasan por prop. */
const RAG_AREA_ICON = {
  1: BookOpen,
  2: Fingerprint,
  3: BrainCircuit,
  4: DoorOpen,
  5: Layers,
  6: Wrench,
}

export default function Rag() {
  const { UI } = useBundle(UI_EN, UI_ES)
  const { RAG_AREAS, RAG_CONTEXTUAL, RAG_HERO, RAG_NUMBERS, RAG_POWERS, RAG_RETRIEVAL } = useBundle(RAG_EN, RAG_ES)

  return (
    <div className="flex flex-col gap-16">
      {/* --- Entrada --- */}
      <section>
        <Badge tone="accent">07 · RAG Assistant</Badge>
        <h1
          className="mt-4 text-3xl uppercase md:text-5xl"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '2px' }}
        >{UI.rag.scientificCoPilot}</h1>
        <p className="mt-6 max-w-3xl text-lg" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{RAG_HERO.lead}</Rich>
        </p>
        <p className="mt-3 max-w-3xl text-sm" style={{ color: 'var(--text-muted)' }}>
          <Rich>{RAG_HERO.sub}</Rich>
        </p>
      </section>

      {/* --- Que hay dentro --- */}
      <section>
        <SectionTitle eyebrow={UI.rag.whatIsActuallyIndexed.eyebrow}>{UI.rag.whatIsActuallyIndexed.title}</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {RAG_NUMBERS.map((k) => (
            <Card key={k.label}>
              <div
                className="text-3xl"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-primary)' }}
              >
                <Rich>{k.n}</Rich>
              </div>
              <div className="mt-1" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                <Rich>{k.label}</Rich>
              </div>
              <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                <Rich>{k.why}</Rich>
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* --- El mapa del flujo --- */}
      <section>
        <SectionTitle eyebrow={UI.rag.sixStagesEndTo.eyebrow}>{UI.rag.sixStagesEndTo.title}</SectionTitle>
        <p className="mb-4 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          Two flows share one canvas: the top band indexes documents and runs by hand whenever the
          corpus grows; the bottom band answers a question and runs on every message. Pick a stage
          to fly to it, or take the last stop for the whole thing at once.
        </p>
        <div className="mt-6">
          <WorkflowMap
            src="/data/rag_canvas.json"
            areaContent={RAG_AREAS}
            areaIcons={RAG_AREA_ICON}
          />
        </div>
      </section>

      {/* --- Los recuperadores --- */}
      <section>
        <SectionTitle eyebrow={UI.rag.ebRetrieval}>{RAG_RETRIEVAL.title}</SectionTitle>
        <p className="mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{RAG_RETRIEVAL.lead}</Rich>
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          {RAG_RETRIEVAL.layers.map((l) => (
            <Card key={l.name} accent={l.state === 'live'}>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-base">
                  <Rich>{l.name}</Rich>
                </h3>
                <Badge tone={l.state === 'live' ? 'pure' : 'amorphous'}>
                  {l.state === 'live' ? 'Live' : 'Disabled on purpose'}
                </Badge>
              </div>
              <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <Rich>{l.body}</Rich>
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* --- Recuperacion contextual: la parte honesta --- */}
      <section>
        <SectionTitle eyebrow={UI.rag.ebTheUpgrade}>{RAG_CONTEXTUAL.title}</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h3 className="text-base">{UI.rag.theProblem}</h3>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{RAG_CONTEXTUAL.problem}</Rich>
            </p>
          </Card>
          <Card>
            <h3 className="text-base">{UI.rag.theTechniqueBuiltEnd}</h3>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{RAG_CONTEXTUAL.technique}</Rich>
            </p>
          </Card>
        </div>
        <blockquote
          className="my-6 p-5 text-lg"
          style={{
            borderLeft: '4px solid var(--status-incipient)',
            background: 'var(--surface-elevated)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-heading)',
            margin: '1.5rem 0',
          }}
        >
          <Rich>{RAG_CONTEXTUAL.result}</Rich>
        </blockquote>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h3 className="text-base">{UI.rag.whyItDidNot}</h3>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{RAG_CONTEXTUAL.why}</Rich>
            </p>
          </Card>
          <Card>
            <h3 className="text-base">{UI.rag.soItIsBuilt}</h3>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{RAG_CONTEXTUAL.decision}</Rich>
            </p>
          </Card>
        </div>
        <Note>
          <Rich>{RAG_CONTEXTUAL.caveat}</Rich>
        </Note>
      </section>

      {/* --- Los poderes --- */}
      <section>
        <SectionTitle eyebrow={UI.rag.ebCapabilities}>{RAG_POWERS.title}</SectionTitle>
        <p className="mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{RAG_POWERS.lead}</Rich>
        </p>
        <ScrollTable
          head={['Tool', 'What it is allowed to ask']}
          rows={RAG_POWERS.tools.map(([a, b]) => [
            <code key={a}>
              <Rich>{a}</Rich>
            </code>,
            <Rich key={b}>{b}</Rich>,
          ])}
        />
        <Note>
          <Rich>{RAG_POWERS.boundary}</Rich>
        </Note>
      </section>

      {/* --- El grafo, que es lo que usan las dos ultimas herramientas --- */}
      <section>
        <SectionTitle eyebrow={UI.rag.theKnowledgeGraph.eyebrow}>{UI.rag.theKnowledgeGraph.title}</SectionTitle>
        <p className="mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          A vector search finds passages that <em>read</em> alike. It cannot answer{' '}
          <em>what do these two samples have in common</em>, because that is a question about
          relations rather than about text. So the same database also holds the record as a graph:
          samples, metals, linkers, modulators and measurements as nodes, and what connects them as
          edges. It runs in PostgreSQL with recursive queries, not in a separate graph database.
        </p>
        <GraphConstellation />
      </section>

      {/* --- Cuadernos --- */}
      <section>
        <SectionTitle eyebrow={UI.rag.notebooksBehindThisScreen.eyebrow}>{UI.rag.notebooksBehindThisScreen.title}</SectionTitle>
        <NotebookList only="07" />
      </section>
    </div>
  )
}
