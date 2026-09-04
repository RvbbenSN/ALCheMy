import { useBundle } from '../i18n/LocaleContext.jsx'
import * as UI_EN from '../content/ui.js'
import * as UI_ES from '../content/es/ui.js'
import {
  Bot,
  BookOpenCheck,
  FileCheck2,
  GitMerge,
  ScrollText,
  Table2,
} from 'lucide-react'
import { Badge, Card, Rich, ScrollTable, SectionTitle } from '../components/ui.jsx'
import SchemaMap from '../components/SchemaMap.jsx'
import SCHEMA from '../data/schema_map.json'
import * as DATABASE_EN from '../content/database.js'
import * as DATABASE_ES from '../content/es/database.js'

/* Un simbolo por razon. No son adornos: dicen de que clase de garantia habla
   cada tarjeta antes de que el lector se meta en el texto. */
const WHY_ICON = {
  meaning: BookOpenCheck,
  rules: FileCheck2,
  lanes: GitMerge,
  memory: ScrollText,
  dictionary: Table2,
}

/* Las cifras de cabecera se derivan del mapa generado, no se escriben. Si
   manana hay una tabla mas, esta fila cambia sola. */
function headline(t) {
  return [
    { n: String(t.tables), label: 'Tables', why: 'Grouped into the seven families below' },
    { n: String(t.views), label: 'Views', why: 'The surface the app and the agent actually query' },
    { n: String(t.columns), label: 'Columns', why: 'Every one of them documented' },
    { n: String(t.functions), label: 'Stored functions', why: 'The only way the AI agent reaches the data' },
    { n: t.dictionaryRows.toLocaleString('en-GB'), label: 'Dictionary rows', why: 'The schema documentation, as queryable data' },
    {
      n: `${Math.round((100 * t.documented) / t.documentedOf)}%`,
      label: 'Objects with a description',
      why: `${t.documented} of ${t.documentedOf}, checked by a script that fails if it slips`,
    },
  ]
}

export default function DatabaseScreen() {
  const { UI } = useBundle(UI_EN, UI_ES)
  const { DB_BOUNDARY, DB_HERO, DB_VIEWS, DB_WHY } = useBundle(DATABASE_EN, DATABASE_ES)

  const stats = headline(SCHEMA.totals)
  /* Las tablas que el agente puede leer a traves de sus funciones. Se derivan
     del propio mapa para que la lista no se quede corta al crecer el esquema. */
  const readable = SCHEMA.families
    .filter((f) => ['lab', 'chem', 'pxrd', 'rag', 'graph'].includes(f.key))
    .flatMap((f) => f.tables.map((t) => t.name))
    .filter((n) => !n.endsWith('_test'))

  return (
    <div className="flex flex-col gap-16">
      {/* --- Entrada --- */}
      <section>
        <Badge tone="accent">08 · The Database</Badge>
        <h1
          className="mt-4 text-3xl uppercase md:text-5xl"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '2px' }}
        >{UI.database.oneSchemaDocumented}</h1>
        <p className="mt-6 max-w-3xl text-lg" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{DB_HERO.lead}</Rich>
        </p>
        <p className="mt-3 max-w-3xl text-sm" style={{ color: 'var(--text-muted)' }}>
          <Rich>{DB_HERO.sub}</Rich>
        </p>
      </section>

      {/* --- Cifras --- */}
      <section>
        <SectionTitle eyebrow={UI.database.whatIsInThere.eyebrow}>{UI.database.whatIsInThere.title}</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((k) => (
            <Card key={k.label}>
              <div
                className="text-3xl"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-primary)' }}
              >
                {k.n}
              </div>
              <div
                className="mt-1"
                style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
              >
                {k.label}
              </div>
              <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                {k.why}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* --- El diagrama --- */}
      <section>
        <SectionTitle eyebrow={UI.database.sevenFamiliesAndWhat.eyebrow}>{UI.database.sevenFamiliesAndWhat.title}</SectionTitle>
        <p className="mb-5 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          Everything starts at the laboratory record and fans out from it. Pick a block to see its
          tables, their size, and the description each one carries inside PostgreSQL.
        </p>
        <SchemaMap />
      </section>

      {/* --- Por que una base de datos --- */}
      <section>
        <SectionTitle eyebrow={UI.database.ebTheCaseForIt}>{DB_WHY.title}</SectionTitle>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {DB_WHY.cards.map((c) => {
            const Icon = WHY_ICON[c.icon] ?? BookOpenCheck
            return (
              <Card key={c.head} className="h-full">
                <span
                  aria-hidden
                  className="flex items-center justify-center rounded-full"
                  style={{
                    width: 36,
                    height: 36,
                    border: '2.5px solid var(--accent-primary)',
                    color: 'var(--accent-primary)',
                  }}
                >
                  <Icon size={18} />
                </span>
                <h3 className="mt-3 text-base">{c.head}</h3>
                <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <Rich>{c.body}</Rich>
                </p>
              </Card>
            )
          })}
        </div>
      </section>

      {/* --- La frontera del agente, como corchete --- */}
      <section>
        <SectionTitle eyebrow={UI.database.ebTheBoundary}>{DB_BOUNDARY.title}</SectionTitle>
        <p className="mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{DB_BOUNDARY.body}</Rich>
        </p>
        <Card>
          <div className="flex flex-wrap items-center gap-6 sm:flex-nowrap">
            {/* El agente, grande, a la izquierda del corchete. */}
            <div className="flex shrink-0 flex-col items-center gap-2">
              <span
                aria-hidden
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 86,
                  height: 86,
                  border: '3px solid var(--accent-primary)',
                  color: 'var(--accent-primary)',
                  background: 'var(--surface-elevated)',
                }}
              >
                <Bot size={42} />
              </span>
              <span
                className="text-xs uppercase tracking-wider"
                style={{ color: 'var(--text-muted)' }}
              >
                The agent
              </span>
            </div>

            {/* El corchete, igual que el de las tecnicas de la 01. */}
            <svg width="26" height="200" viewBox="0 0 26 200" aria-hidden className="shrink-0">
              <path
                d="M4 10 C 16 10, 16 10, 16 24 L16 92 C16 100, 18 100, 24 100 C18 100, 16 100, 16 108 L16 176 C16 190, 16 190, 4 190"
                fill="none"
                stroke="var(--surface-border)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>

            <div className="min-w-0 flex-1">
              <p className="mb-3 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {DB_BOUNDARY.bracketTitle}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {readable.map((t) => (
                  <code
                    key={t}
                    className="rounded-[var(--radius-badge)] px-2.5 py-1 text-xs"
                    style={{
                      border: '1.5px solid var(--surface-border)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {t}
                  </code>
                ))}
              </div>
              <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                Reached only through these {SCHEMA.functions.length} stored functions:
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SCHEMA.functions.map((f) => (
                  <code key={f} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {f}
                  </code>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* --- Las vistas --- */}
      <section>
        <SectionTitle eyebrow={UI.database.ebTheSurface}>{DB_VIEWS.title}</SectionTitle>
        <p className="mb-5 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{DB_VIEWS.lead}</Rich>
        </p>
        <ScrollTable
          head={['View', 'Columns', 'What it is for']}
          rows={SCHEMA.views.map((v) => [
            <code key={v.name}>{v.name}</code>,
            String(v.columns),
            v.comment || '—',
          ])}
        />
      </section>
    </div>
  )
}
