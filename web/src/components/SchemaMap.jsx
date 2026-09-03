import { useState } from 'react'
import {
  BookText,
  Database,
  FlaskConical,
  Network,
  ShieldCheck,
  Sigma,
  Waves,
} from 'lucide-react'
import SCHEMA from '../data/schema_map.json'
import { Badge, Rich } from './ui.jsx'

/* --------------------------------------------------------------------------
   SchemaMap — las siete familias del esquema, y como se alimentan.

   Los HECHOS no estan aqui: cuantas tablas, cuantas columnas, cuantas filas y
   que dice el COMMENT de cada tabla salen de `src/data/schema_map.json`, que
   genera `scripts/build_schema_map.py` leyendo la propia base. Este fichero
   solo decide DONDE se dibuja cada bloque y que flechas los unen.

   Las flechas no son decorativas: cada una es una relacion que existe de
   verdad. Las continuas son claves ajenas declaradas en el esquema; las
   discontinuas son dependencias que no son FK -- una vista que hace el JOIN, o
   un script que deriva una tabla de otra -- y se dibujan distinto justo porque
   la base no las obliga y por tanto pueden romperse en silencio.
   -------------------------------------------------------------------------- */

const ICON = {
  lab: FlaskConical,
  chem: Sigma,
  pxrd: Waves,
  ml: Database,
  rag: BookText,
  graph: Network,
  gov: ShieldCheck,
}

/* Rejilla del diagrama, en unidades del viewBox. */
const BOX = {
  lab: { x: 350, y: 16, w: 300, h: 104 },
  chem: { x: 14, y: 190, w: 270, h: 104 },
  pxrd: { x: 716, y: 190, w: 270, h: 104 },
  ml: { x: 350, y: 340, w: 300, h: 104 },
  rag: { x: 14, y: 340, w: 270, h: 104 },
  graph: { x: 716, y: 340, w: 270, h: 104 },
  /* Antes ocupaba los 960 de ancho para tres lineas de texto, y hacia que el
     resto pareciera una nota al pie. Mismo tamano que las demas, centrada
     debajo, que es ademas donde encaja: recoge lo que hacen todas. */
  gov: { x: 350, y: 492, w: 300, h: 104 },
}

/* from -> to, y si la base la obliga o no. `label` va sobre la flecha. */
const LINKS = [
  { from: 'lab', to: 'pxrd', fk: true, label: 'measurement_id' },
  { from: 'lab', to: 'graph', fk: false, label: 'derived' },
  { from: 'lab', to: 'ml', fk: false, label: 'v_ml_features' },
  { from: 'chem', to: 'ml', fk: false, label: 'joined in' },
  { from: 'pxrd', to: 'ml', fk: false, label: 'the target' },
  { from: 'rag', to: 'graph', fk: false, label: 'cited by' },
]

/* Centro de un lado del bloque, para enganchar la flecha donde toca. */
const anchor = (k, side) => {
  const b = BOX[k]
  if (side === 'bottom') return [b.x + b.w / 2, b.y + b.h]
  if (side === 'top') return [b.x + b.w / 2, b.y]
  if (side === 'left') return [b.x, b.y + b.h / 2]
  return [b.x + b.w, b.y + b.h / 2]
}

/* Que lados usa cada flecha. Se declara porque adivinarlo por posicion produce
   lineas que cruzan los bloques. */
const SIDES = {
  'lab>pxrd': ['right', 'top'],
  'lab>graph': ['right', 'top'],
  'lab>ml': ['bottom', 'top'],
  'chem>ml': ['right', 'left'],
  'pxrd>ml': ['left', 'right'],
  'rag>graph': ['bottom', 'bottom'],
}

function path(from, to) {
  const [sa, sb] = SIDES[`${from}>${to}`]
  const [x1, y1] = anchor(from, sa)
  const [x2, y2] = anchor(to, sb)
  if (from === 'rag' && to === 'graph') {
    // Por debajo, esquivando el bloque del registro de modelos.
    return `M ${x1} ${y1} C ${x1} ${y1 + 60}, ${x2} ${y2 + 60}, ${x2} ${y2}`
  }
  if (sa === 'bottom' || sa === 'top') {
    return `M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`
  }
  return `M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`
}

const kb = (n) =>
  n > 1e9 ? `${(n / 1e9).toFixed(1)} GB` : n > 1e6 ? `${Math.round(n / 1e6)} MB` : `${Math.round(n / 1e3)} kB`

export default function SchemaMap() {
  const [open, setOpen] = useState('lab')
  const byKey = Object.fromEntries(SCHEMA.families.map((f) => [f.key, f]))
  const sel = byKey[open]

  return (
    <div className="flex flex-col gap-5">
      <div
        className="overflow-x-auto rounded-[var(--radius-card)] p-2"
        style={{ border: 'var(--border-card) solid var(--surface-border)', background: 'var(--surface-elevated)' }}
      >
        <svg viewBox="0 0 1000 620" style={{ display: 'block', width: '100%', minWidth: 720 }} role="img"
             aria-label="Map of the seven table families in the database and how they feed each other">
          <defs>
            <marker id="sm-arrow" viewBox="0 0 10 10" refX="9" refY="5"
                    markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--text-muted)" />
            </marker>
          </defs>

          {LINKS.map((l) => {
            const d = path(l.from, l.to)
            return (
              <g key={`${l.from}-${l.to}`}>
                <path
                  d={d}
                  fill="none"
                  stroke="var(--text-muted)"
                  strokeWidth="2"
                  strokeDasharray={l.fk ? undefined : '7 5'}
                  markerEnd="url(#sm-arrow)"
                  opacity={open === l.from || open === l.to ? 1 : 0.45}
                />
              </g>
            )
          })}

          {SCHEMA.families.map((f) => {
            const b = BOX[f.key]
            const on = open === f.key
            return (
              <g
                key={f.key}
                onClick={() => setOpen(f.key)}
                style={{ cursor: 'pointer' }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpen(f.key)}
              >
                <rect
                  x={b.x} y={b.y} width={b.w} height={b.h} rx="10"
                  fill={on ? 'var(--surface)' : 'var(--surface)'}
                  stroke={on ? 'var(--accent-primary)' : 'var(--surface-border)'}
                  strokeWidth={on ? 3 : 2}
                />
                <g transform={`translate(${b.x + 16}, ${b.y + 16})`}
                   style={{ color: on ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                  {(() => {
                    const Icon = ICON[f.key]
                    return <Icon size={20} aria-hidden />
                  })()}
                </g>
                <text x={b.x + 46} y={b.y + 32} style={{ fontSize: 17, fontFamily: 'var(--font-heading)' }}
                      fill="var(--text-primary)">
                  {f.title}
                </text>
                <text x={b.x + 18} y={b.y + 62} style={{ fontSize: 14 }} fill="var(--text-secondary)">
                  {f.tables.length} {f.tables.length === 1 ? 'table' : 'tables'}
                  {'  ·  '}
                  {f.totalRows.toLocaleString('en-GB')} rows
                </text>
                <text x={b.x + 18} y={b.y + 84} style={{ fontSize: 13 }} fill="var(--text-muted)">
                  {kb(f.totalBytes)} on disk
                </text>
              </g>
            )
          })}

          <text x="500" y="614" textAnchor="middle" style={{ fontSize: 13 }} fill="var(--text-muted)">
            solid = foreign key enforced by the database   ·   dashed = a view or a script joins them
          </text>
        </svg>
      </div>

      {/* --- Panel de la familia elegida --- */}
      <div
        className="rounded-[var(--radius-card)] p-5"
        style={{ border: 'var(--border-card) solid var(--surface-border)', background: 'var(--surface)' }}
      >
        <div className="flex flex-wrap items-center gap-3">
          {(() => {
            const Icon = ICON[sel.key]
            return <Icon size={20} aria-hidden style={{ color: 'var(--accent-primary)' }} />
          })()}
          <h3 className="text-lg" style={{ fontFamily: 'var(--font-heading)' }}>{sel.title}</h3>
          <Badge tone="neutral">{sel.tables.length} tables</Badge>
        </div>
        <p className="mt-3 max-w-3xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{sel.blurb}</Rich>
        </p>

        <ul className="mt-5 flex list-none flex-col gap-4 p-0">
          {sel.tables.map((t) => (
            <li key={t.name}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <code style={{ color: 'var(--accent-primary)' }}>{t.name}</code>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {t.columns} columns · {t.rows.toLocaleString('en-GB')} rows · {kb(t.bytes)}
                </span>
              </div>
              {t.comment && (
                <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {t.comment}
                </p>
              )}
            </li>
          ))}
        </ul>

        <p className="mt-5 text-xs" style={{ color: 'var(--text-muted)' }}>
          Every description above is the table&rsquo;s own <code>COMMENT</code> inside PostgreSQL,
          read straight from the database — not a copy kept elsewhere that could drift from it.
        </p>
      </div>
    </div>
  )
}
