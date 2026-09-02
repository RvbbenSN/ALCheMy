import { useState } from 'react'
import { Badge, Card, Placeholder, Rich, SectionTitle, Term } from '../components/ui.jsx'
import NotebookList from '../components/NotebookList.jsx'
import {
  RAG_CORPUS,
  RAG_HERO,
  RAG_MASKING,
  RAG_PENDING,
  RAG_SUGGESTED,
} from '../content/rag.js'

export default function Rag() {
  const [masked, setMasked] = useState(true)

  return (
    <div className="flex flex-col gap-16">
      <section>
        <Badge tone="accent">07 · RAG Assistant</Badge>
        <h1 className="mt-4 text-3xl uppercase md:text-5xl" style={{ fontFamily: 'var(--font-display)', letterSpacing: '2px' }}>
          Scientific Co-pilot
        </h1>
        <p className="mt-6 max-w-3xl text-lg" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{RAG_HERO.lead}</Rich>
        </p>
      </section>

      <section>
        <SectionTitle eyebrow="The corpus">956 documents, 87,765 chunks</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <h3 className="text-base"><Rich>{RAG_CORPUS.chunkingTitle}</Rich></h3>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{RAG_CORPUS.chunkingBody}</Rich>
            </p>
          </Card>
          <Card>
            <h3 className="text-base"><Rich>{RAG_CORPUS.sourcesTitle}</Rich></h3>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{RAG_CORPUS.sourcesBody}</Rich> Retrieval runs on <Term k="pgvector" /> inside the
              same PostgreSQL instance.
            </p>
          </Card>
        </div>
      </section>

      <section>
        <SectionTitle eyebrow="The safeguard">IP data masking, shown live</SectionTitle>
        <Card accent>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            <Rich>{RAG_MASKING.intro}</Rich>
          </p>
          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMasked((v) => !v)}
              aria-pressed={masked}
              className="rounded-[var(--radius-button)] px-4 py-2 text-xs uppercase tracking-wider"
              style={{
                border: '2.5px solid var(--accent-primary)',
                background: masked ? 'var(--accent-primary)' : 'transparent',
                color: masked ? 'var(--surface)' : 'var(--text-primary)',
              }}
            >
              Masking {masked ? 'on' : 'off'}
            </button>
            <Badge tone={masked ? 'pure' : 'amorphous'}>
              {masked ? 'Safe to send' : 'Would leak IP'}
            </Badge>
          </div>
          <pre
            className="mono mt-5 overflow-x-auto rounded-[var(--radius-card)] p-4 text-sm"
            style={{
              background: 'var(--surface-elevated)',
              border: `2px solid ${masked ? 'var(--status-pure)' : 'var(--status-amorphous)'}`,
              color: 'var(--text-secondary)',
              whiteSpace: 'pre-wrap',
            }}
          >
            {masked ? RAG_MASKING.after : RAG_MASKING.before}
          </pre>
          <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            <Rich>{RAG_MASKING.footnote}</Rich>
          </p>
        </Card>
      </section>

      <section>
        <SectionTitle eyebrow="Try it">Ask the corpus</SectionTitle>
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
          <div className="mt-5">
            <Placeholder source="src/rag_query.py → POST /api/v1/rag/query">
              <Rich>{RAG_PENDING.chat}</Rich>
            </Placeholder>
          </div>
        </Card>
      </section>

      <section>
        <SectionTitle eyebrow="The code itself">Notebooks behind this screen</SectionTitle>
        <NotebookList only="07" />
      </section>

      <section>
        <SectionTitle eyebrow="Beyond vectors">The knowledge graph</SectionTitle>
        <Placeholder source="src/build_knowledge_graph.py"><Rich>{RAG_PENDING.graph}</Rich></Placeholder>
      </section>
    </div>
  )
}
