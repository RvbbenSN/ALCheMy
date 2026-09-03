import { NotebookText, ExternalLink } from 'lucide-react'
import { Badge, Card } from './ui.jsx'

/* Los cuadernos publicados. Se generan con scripts/build_public_notebooks.py
   y se sirven como HTML estatico de solo lectura: el .ipynb nunca sale. */
export const NOTEBOOKS = [
  {
    n: '01',
    file: '01_Excel_Ingestion_and_Transformation',
    title: 'Excel ingestion & chemical feature engineering',
    blurb:
      'Five years of handwritten synthesis conditions turned into a governed table: header mapping, stoichiometry, thermal ramps parsed from prose, and an UPSERT that cannot delete what the automated lane wrote.',
    screens: ['03'],
  },
  {
    n: '02',
    file: '02_Multimodal_Data_Lake_and_Characterization_Parsers',
    title: 'The data lake and the parser contract',
    blurb:
      'Nine incompatible instrument formats, one dictionary shape out. Where the parser contract was designed and why it is the load-bearing abstraction of the platform.',
    screens: ['02', '03'],
  },
  {
    n: '03',
    file: '03_n8n_Webhook_Interactive_Tester',
    title: 'Testing the ingestion webhook',
    blurb:
      'Firing real files at the n8n endpoint and reading back what the pipeline made of them — including the debugging of the MD5 hash that was fingerprinting the wrong bytes.',
    screens: ['02'],
  },
  {
    n: '04',
    file: '04_RAG_Corpus_Ingestion_from_Zotero',
    title: 'Building the literature corpus',
    blurb:
      '956 papers out of Zotero and into pgvector: cataloguing, chunking and embedding, and why cataloguing and vectorising are two separate steps.',
    screens: ['07'],
  },
  {
    n: '05',
    file: '05_PXRD_Signal_Processing_and_Crystallinity_Descriptors',
    title: 'PXRD signal processing & the 29 descriptors',
    blurb:
      'The longest notebook and the most visual: arPLS baselines, the amorphous halo, Poisson noise at three sigma, and the derivation of every one of the 29 numbers that describe a diffractogram.',
    screens: ['03'],
    highlight: true,
  },
  {
    n: '06',
    file: '06_Crystallinity_Prediction_ML_and_Synthesis_Optimization',
    title: 'Crystallinity prediction, end to end',
    blurb:
      'The full CRISP-DM case in ten stages: the confounder that nearly ruined the analysis, seven data defects found by chemical reading, ten models compared, and why an honest 0.52 replaced a flattering 0.62.',
    screens: ['04', '05', '06'],
    highlight: true,
  },
  {
    n: '07',
    file: '07_RAG_Contextual_Chunking_Protocol',
    title: 'Contextual chunking protocol',
    blurb:
      'Why splitting a paper into fixed blocks destroys chemical meaning, and how a written context sentence fused into each embedding fixes it.',
    screens: ['07'],
  },
]

export default function NotebookList({ only }) {
  const items = only ? NOTEBOOKS.filter((nb) => nb.screens.includes(only)) : NOTEBOOKS

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((nb) => (
        <Card key={nb.n} accent={nb.highlight} className="flex h-full flex-col">
          <div className="flex items-start gap-3">
            <NotebookText
              size={26}
              aria-hidden
              style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: 2 }}
            />
            <div>
              <span className="mono text-xs" style={{ color: 'var(--text-muted)' }}>
                Notebook {nb.n}
              </span>
              <h3 className="text-base">
                <a
                  href={`/notebooks/${nb.file}.html`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="no-underline"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {nb.title}
                  <ExternalLink
                    size={13}
                    aria-hidden
                    style={{ display: 'inline', marginLeft: 6, verticalAlign: 'baseline' }}
                  />
                </a>
              </h3>
            </div>
          </div>
          <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {nb.blurb}
          </p>
          {/* Tres destinos, y son cosas distintas: el titulo abre el cuaderno
              entero con su codigo, para auditarlo; las banderas abren la
              narrativa pulida en un idioma, para leerla. */}
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
            <Badge tone="info">Full notebook</Badge>
            <span className="ml-auto flex items-center gap-1.5">
              <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Read
              </span>
              {[
                ['en', '\uD83C\uDDEC\uD83C\uDDE7', 'Read in English'],
                ['es', '\uD83C\uDDEA\uD83C\uDDF8', 'Leer en espanol'],
              ].map(([code, flag, label]) => (
                <a
                  key={code}
                  href={`/notebooks/${nb.file}.${code}.html`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={label}
                  aria-label={label}
                  className="rounded-[var(--radius-badge)] px-2 py-1 text-base leading-none no-underline"
                  style={{ border: '2px solid var(--surface-border)', background: 'var(--surface-elevated)' }}
                >
                  {flag}
                </a>
              ))}
            </span>
          </div>
        </Card>
      ))}
    </div>
  )
}
