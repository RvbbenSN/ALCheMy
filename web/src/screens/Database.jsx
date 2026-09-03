import { Badge, Card, Note, Rich, ScrollTable, SectionTitle } from '../components/ui.jsx'
import SchemaMap from '../components/SchemaMap.jsx'
import SCHEMA from '../data/schema_map.json'
import {
  DB_BACKUP,
  DB_BOUNDARY,
  DB_DICTIONARY,
  DB_HERO,
  DB_HONEST,
  DB_WHY,
  VIEW_NOTES,
} from '../content/database.js'

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
  const stats = headline(SCHEMA.totals)

  return (
    <div className="flex flex-col gap-16">
      {/* --- Entrada --- */}
      <section>
        <Badge tone="accent">08 · The Database</Badge>
        <h1
          className="mt-4 text-3xl uppercase md:text-5xl"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '2px' }}
        >
          One Schema, Documented
        </h1>
        <p className="mt-6 max-w-3xl text-lg" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{DB_HERO.lead}</Rich>
        </p>
        <p className="mt-3 max-w-3xl text-sm" style={{ color: 'var(--text-muted)' }}>
          <Rich>{DB_HERO.sub}</Rich>
        </p>
      </section>

      {/* --- Cifras --- */}
      <section>
        <SectionTitle eyebrow="At a glance">What is in there</SectionTitle>
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
        <SectionTitle eyebrow="The map">Seven families, and what feeds what</SectionTitle>
        <p className="mb-5 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          Everything starts at the laboratory record and fans out from it. Pick a block to see its
          tables, their size, and the description each one carries inside PostgreSQL.
        </p>
        <SchemaMap />
      </section>

      {/* --- Por que una base de datos --- */}
      <section>
        <SectionTitle eyebrow="The case for it">{DB_WHY.title}</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          {DB_WHY.points.map(([t, b]) => (
            <Card key={t}>
              <h3 className="text-base">{t}</h3>
              <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <Rich>{b}</Rich>
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* --- El diccionario --- */}
      <section>
        <SectionTitle eyebrow="Documentation">{DB_DICTIONARY.title}</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card accent>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{DB_DICTIONARY.body}</Rich>
            </p>
          </Card>
          <Card>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{DB_DICTIONARY.why}</Rich>
            </p>
          </Card>
        </div>
        <Note>
          <Rich>{DB_DICTIONARY.rule}</Rich>
        </Note>
      </section>

      {/* --- Las vistas --- */}
      <section>
        <SectionTitle eyebrow="The surface">The views everything reads through</SectionTitle>
        <p className="mb-5 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          Nothing queries the raw tables directly if a view exists for it. A view is where a join
          gets decided once instead of being re-invented in every script — and it is also the thing
          that can be documented, versioned and pointed at.
        </p>
        <ScrollTable
          head={['View', 'Columns', 'What it is for']}
          rows={SCHEMA.views.map((v) => [
            <code key={v.name}>{v.name}</code>,
            String(v.columns),
            <Rich key={v.name}>{VIEW_NOTES[v.name] || v.comment || '—'}</Rich>,
          ])}
        />
      </section>

      {/* --- La frontera del agente --- */}
      <section>
        <SectionTitle eyebrow="The boundary">{DB_BOUNDARY.title}</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card accent>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{DB_BOUNDARY.body}</Rich>
            </p>
          </Card>
          <Card>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{DB_BOUNDARY.detail}</Rich>
            </p>
          </Card>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {SCHEMA.functions.map((f) => (
            <code
              key={f}
              className="rounded-[var(--radius-badge)] px-2.5 py-1 text-xs"
              style={{ border: '1.5px solid var(--surface-border)', color: 'var(--text-secondary)' }}
            >
              {f}
            </code>
          ))}
        </div>
      </section>

      {/* --- Copias de seguridad --- */}
      <section>
        <SectionTitle eyebrow="Durability">{DB_BACKUP.title}</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card accent>
            <h3 className="text-base">What cannot be recomputed</h3>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{DB_BACKUP.body}</Rich>
            </p>
          </Card>
          <Card>
            <h3 className="text-base">Event-driven, never scheduled</h3>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{DB_BACKUP.policy}</Rich>
            </p>
          </Card>
          <Card>
            <h3 className="text-base">Why the vectors are left out</h3>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{DB_BACKUP.size}</Rich>
            </p>
          </Card>
        </div>
      </section>

      {/* --- Lo que no esta limpio --- */}
      <section>
        <SectionTitle eyebrow="In the interest of honesty">{DB_HONEST.title}</SectionTitle>
        <div className="flex flex-col gap-3">
          {DB_HONEST.items.map(([t, b]) => (
            <Card key={t}>
              <div style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                {t}
              </div>
              <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <Rich>{b}</Rich>
              </p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
