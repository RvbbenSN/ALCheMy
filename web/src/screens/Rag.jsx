import { Badge, Card, Note, Rich, ScrollTable, SectionTitle, Term } from '../components/ui.jsx'
import NotebookList from '../components/NotebookList.jsx'
import WorkflowMap from '../components/WorkflowMap.jsx'
import {
  RAG_ACCESS,
  RAG_AREAS,
  RAG_CONTEXTUAL,
  RAG_HERO,
  RAG_NUMBERS,
  RAG_POWERS,
  RAG_RETRIEVAL,
  RAG_SUGGESTED,
} from '../content/rag.js'
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
  return (
    <div className="flex flex-col gap-16">
      {/* --- Entrada --- */}
      <section>
        <Badge tone="accent">07 · RAG Assistant</Badge>
        <h1
          className="mt-4 text-3xl uppercase md:text-5xl"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '2px' }}
        >
          Scientific Co-pilot
        </h1>
        <p className="mt-6 max-w-3xl text-lg" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{RAG_HERO.lead}</Rich>
        </p>
        <p className="mt-3 max-w-3xl text-sm" style={{ color: 'var(--text-muted)' }}>
          <Rich>{RAG_HERO.sub}</Rich>
        </p>
      </section>

      {/* --- Que hay dentro --- */}
      <section>
        <SectionTitle eyebrow="The corpus">What is actually indexed</SectionTitle>
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
        <SectionTitle eyebrow="The workflow">Six stages, end to end</SectionTitle>
        <p className="mb-4 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          Two flows share one canvas: the top band indexes documents and runs by hand whenever the
          corpus grows; the bottom band answers a question and runs on every message. Pick a stage
          to fly to it, or take the last stop for the whole thing at once.
        </p>
        <Note>
          Unlike the ingestion map on screen 02 — which reproduces the n8n canvas pixel for pixel,
          because the frames there were drawn by hand around their nodes — this one is{' '}
          <strong>laid out for reading</strong>. Every node, name, type and each of the 48
          connections comes straight from the workflow export; only the positions are composed, and
          only because two stages genuinely share a column in n8n and their frames would overlap.
        </Note>
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
        <SectionTitle eyebrow="Retrieval">{RAG_RETRIEVAL.title}</SectionTitle>
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
        <SectionTitle eyebrow="The upgrade">{RAG_CONTEXTUAL.title}</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h3 className="text-base">The problem</h3>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{RAG_CONTEXTUAL.problem}</Rich>
            </p>
          </Card>
          <Card>
            <h3 className="text-base">The technique, built end to end</h3>
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
            <h3 className="text-base">Why it did not help much here</h3>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{RAG_CONTEXTUAL.why}</Rich>
            </p>
          </Card>
          <Card>
            <h3 className="text-base">So it is built and not switched on</h3>
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
        <SectionTitle eyebrow="Capabilities">{RAG_POWERS.title}</SectionTitle>
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

      {/* --- Control de acceso --- */}
      <section>
        <SectionTitle eyebrow="Governance">{RAG_ACCESS.title}</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card accent>
            <h3 className="text-base">Coarse by default</h3>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{RAG_ACCESS.body}</Rich>
            </p>
          </Card>
          <Card>
            <h3 className="text-base">The token is never stored</h3>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{RAG_ACCESS.owner}</Rich>
            </p>
          </Card>
        </div>
        <p className="mt-4 max-w-3xl text-sm" style={{ color: 'var(--text-muted)' }}>
          <Rich>{RAG_ACCESS.honest}</Rich>
        </p>
      </section>

      

      {/* --- Preguntas de ejemplo --- */}
      <section>
        <SectionTitle eyebrow="What it gets asked">Questions from the bench</SectionTitle>
        <Card>
          <div className="flex flex-wrap gap-2">
            {RAG_SUGGESTED.map((q) => (
              <span
                key={q}
                className="rounded-[var(--radius-badge)] px-3 py-1.5 text-xs"
                style={{ border: '1.5px solid var(--surface-border)', color: 'var(--text-secondary)' }}
              >
                <Rich>{q}</Rich>
              </span>
            ))}
          </div>
          <p className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
            The first is answered from the literature, the second from the methodology of screen 03,
            and the third from both at once. Retrieval runs on <Term k="pgvector" /> inside the same
            PostgreSQL instance that holds the syntheses — which is why one answer can cite a paper
            and a sample in the same sentence.
          </p>
        </Card>
      </section>

      

      {/* --- Cuadernos --- */}
      <section>
        <SectionTitle eyebrow="The code itself">Notebooks behind this screen</SectionTitle>
        <NotebookList only="07" />
      </section>
    </div>
  )
}
