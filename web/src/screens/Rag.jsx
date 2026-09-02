import { useState } from 'react'
import { Badge, Button, Card, Placeholder, SectionTitle, Term } from '../components/ui.jsx'
import NotebookList from '../components/NotebookList.jsx'

const SUGGESTED = [
  'Which temperature window favours crystalline zirconium phosphonates?',
  'What distinguishes an amorphous halo from a broad reflection?',
  'How does formic acid act as a modulator in solvothermal synthesis?',
]

/* Demostracion del enmascarado de IP. Es la pieza mas didactica del sitio:
   se ve la misma frase antes y despues de sanearla. */
const MASK_DEMO = {
  before: 'Does H6ttbmp form a crystalline framework with Zr at 130 °C in DMF?',
  after: 'Does LIG_HASH_8F2 form a crystalline framework with Zr at 130 °C in DMF?',
}

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
          Generative AI with governance: grounded in 956 real papers, and unable to leak a ligand name it
          was never allowed to send.
        </p>
      </section>

      <section>
        <SectionTitle eyebrow="The corpus">956 documents, 87,765 chunks</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <h3 className="text-base">Contextual chunking</h3>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Splitting a paper into fixed-size blocks destroys chemical meaning: a stoichiometry ends up
              severed from the procedure it belongs to. Each chunk is therefore given a written context
              sentence that is fused into its own embedding, so a passage still knows what it is about.
            </p>
          </Card>
          <Card>
            <h3 className="text-base">Three sources of truth</h3>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              The assistant cross-references the in-house historical database, the model&rsquo;s own active
              learning predictions, and peer-reviewed literature — so a suggestion arrives with
              multi-source backing rather than a confident guess. Retrieval runs on{' '}
              <Term k="pgvector" /> inside the same PostgreSQL instance.
            </p>
          </Card>
        </div>
      </section>

      <section>
        <SectionTitle eyebrow="The safeguard">IP data masking, shown live</SectionTitle>
        <Card accent>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Before any query leaves for an external model, unpublished ligand codes and proprietary
            formulas are substituted. The metal stays — it carries no trade secret. Toggle it and watch the
            question change.
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
            {masked ? MASK_DEMO.after : MASK_DEMO.before}
          </pre>
          <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            The ligand code shown here is illustrative, not a real unpublished compound.
          </p>
        </Card>
      </section>

      <section>
        <SectionTitle eyebrow="Try it">Ask the corpus</SectionTitle>
        <Card>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED.map((q) => (
              <span
                key={q}
                className="rounded-[var(--radius-badge)] px-3 py-1.5 text-xs"
                style={{ border: '1.5px solid var(--surface-border)', color: 'var(--text-secondary)' }}
              >
                {q}
              </span>
            ))}
          </div>
          <div className="mt-5">
            <Placeholder source="src/rag_query.py → POST /api/v1/rag/query">
              Chat interface pending backend. Restricted to the published-literature corpus only, with rate
              limiting and cached answers for common questions. Retrieved chunks will be listed with their
              cosine similarity so the answer can be checked against its sources.
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
        <Placeholder source="src/build_knowledge_graph.py">
          Pending: a graph linking performed syntheses to their characterization and to the literature that
          justified them — so &ldquo;what did we try, and what does the field say about it&rdquo; is one
          traversal rather than three searches.
        </Placeholder>
      </section>
    </div>
  )
}
