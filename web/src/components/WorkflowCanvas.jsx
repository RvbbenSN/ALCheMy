import { useState } from 'react'
import {
  Bot,
  ChevronRight,
  CircleAlert,
  Database,
  Fingerprint,
  FlaskConical,
  GitBranch,
  Info,
  Play,
  Send,
  Shuffle,
  UserCheck,
  Wand2,
  X,
} from 'lucide-react'
import { AREAS, TARGET_ROW } from '../content/workflow.js'
import { Badge, Card } from './ui.jsx'

/* --------------------------------------------------------------------------
   WorkflowCanvas — el flujo de ingesta de n8n, redibujado.

   Tres decisiones, todas respuesta a lo que fallaba en el lienzo anterior:

   1. **Las casillas no pueden solaparse**, porque no se dibujan con las
      coordenadas de n8n sino con una rejilla CSS. En n8n los nodos se colocan a
      mano y al reescalarlos a un ancho de pagina se pisan unos a otros. Aqui la
      posicion la calcula el navegador y el solape es imposible por construccion.

   2. **Las sticky notes salen del lienzo.** Su texto vive en el pop-up de cada
      area. Sobre el lienzo solo queda el numero, el titulo y los nodos, que es
      lo que se necesita para seguir el flujo de un vistazo.

   3. **Iconos por tipo de trabajo, no emojis.** Un rombo de decision, un matraz
      de parser, un robot de agente: el icono dice que clase de nodo es, que es
      la informacion util al leer un flujo ajeno.
   -------------------------------------------------------------------------- */

const KIND = {
  trigger: { icon: Play, color: 'var(--status-pure)', label: 'Trigger' },
  transform: { icon: Wand2, color: 'var(--text-secondary)', label: 'Transform' },
  gate: { icon: GitBranch, color: 'var(--status-incipient)', label: 'Decision' },
  router: { icon: Shuffle, color: 'var(--status-incipient)', label: 'Router' },
  hash: { icon: Fingerprint, color: 'var(--accent-tertiary)', label: 'Hash' },
  parser: { icon: FlaskConical, color: 'var(--accent-primary)', label: 'Parser' },
  ai: { icon: Bot, color: 'var(--accent-secondary-text)', label: 'AI agent' },
  human: { icon: UserCheck, color: 'var(--accent-secondary-text)', label: 'Human in the loop' },
  db: { icon: Database, color: 'var(--accent-tertiary)', label: 'Database' },
  reply: { icon: Send, color: 'var(--text-secondary)', label: 'Response' },
  error: { icon: CircleAlert, color: 'var(--status-amorphous)', label: 'Error path' },
}

function Node({ node }) {
  const k = KIND[node.kind] ?? KIND.transform
  const Icon = k.icon
  return (
    <div
      className="flex items-center gap-2 rounded-[var(--radius-badge)] px-2.5 py-2"
      style={{
        border: `2px solid ${k.color}`,
        background: 'var(--surface)',
        minWidth: 0,
      }}
      title={k.label}
    >
      <Icon size={15} aria-hidden style={{ color: k.color, flexShrink: 0 }} />
      <span
        className="truncate text-xs"
        style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
      >
        {node.name}
      </span>
    </div>
  )
}

function AreaBlock({ area, onOpen }) {
  return (
    <div
      className="rounded-[var(--radius-card)] p-4"
      style={{ border: 'var(--border-card) solid var(--surface-border)', background: 'var(--surface-elevated)' }}
    >
      <div className="mb-3 flex items-start gap-3">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-badge)] text-sm"
          style={{
            background: 'var(--accent-primary)',
            color: 'var(--surface)',
            fontFamily: 'var(--font-display)',
          }}
        >
          {area.n}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base leading-tight">{area.title}</h3>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {area.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpen(area)}
          className="flex shrink-0 items-center gap-1 rounded-[var(--radius-badge)] px-2 py-1 text-xs"
          style={{ border: '2px solid var(--surface-border)', color: 'var(--accent-primary)' }}
          aria-label={`What area ${area.n} does`}
        >
          <Info size={13} aria-hidden />
          Detail
        </button>
      </div>

      <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
        {area.nodes.map((n) => (
          <Node key={n.name} node={n} />
        ))}
      </div>
    </div>
  )
}

export default function WorkflowCanvas() {
  const [open, setOpen] = useState(null)

  return (
    <div className="flex flex-col gap-4">
      {/* --- leyenda --- */}
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {Object.entries(KIND).map(([key, k]) => {
          const Icon = k.icon
          return (
            <span key={key} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              <Icon size={13} aria-hidden style={{ color: k.color }} />
              {k.label}
            </span>
          )
        })}
      </div>

      {/* --- las 9 areas, una debajo de otra con su flecha --- */}
      {AREAS.map((area, i) => (
        <div key={area.n}>
          <AreaBlock area={area} onOpen={setOpen} />
          {i < AREAS.length - 1 && (
            <div className="flex justify-center py-1.5" aria-hidden>
              <ChevronRight
                size={20}
                style={{ color: 'var(--accent-secondary)', transform: 'rotate(90deg)' }}
              />
            </div>
          )}
        </div>
      ))}

      {/* --- el destino --- */}
      <Card accent>
        <h3 className="text-base">Where every path has to arrive</h3>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          One row in <code>characterization_measurements</code>, carrying exactly these fields. Think of
          the item as a snowball rolling through the pipeline, picking up more of this shape at each
          stage.
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {TARGET_ROW.map((f) => (
            <code
              key={f}
              className="rounded-[var(--radius-badge)] px-2 py-1 text-xs"
              style={{ border: '1.5px solid var(--accent-primary)', color: 'var(--text-primary)' }}
            >
              {f}
            </code>
          ))}
        </div>
      </Card>

      {/* --- pop-up: aqui vive lo que antes eran sticky notes sobre el lienzo --- */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={open.title}
          onClick={() => setOpen(null)}
          onKeyDown={(e) => e.key === 'Escape' && setOpen(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[86vh] w-full max-w-2xl overflow-y-auto rounded-[var(--radius-card)] p-6"
            style={{
              background: 'var(--surface-elevated)',
              border: 'var(--border-card) solid var(--accent-primary)',
            }}
          >
            <div className="flex items-start gap-3">
              <Badge tone="accent">Area {open.n}</Badge>
              <button
                type="button"
                onClick={() => setOpen(null)}
                autoFocus
                aria-label="Close"
                className="ml-auto rounded-[var(--radius-badge)] p-1"
                style={{ border: '2px solid var(--surface-border)', color: 'var(--text-primary)' }}
              >
                <X size={16} aria-hidden />
              </button>
            </div>

            <h3 className="mt-3 text-xl">{open.title}</h3>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {open.subtitle}
            </p>

            <p className="mt-4" style={{ color: 'var(--text-secondary)' }}>
              {open.objective}
            </p>

            <h4 className="mt-5 text-xs uppercase tracking-wider" style={{ color: 'var(--accent-secondary-text)' }}>
              What this area adds to the item
            </h4>
            <ul className="mt-2 flex list-none flex-col gap-2 p-0 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {open.adds.map((a, i) => (
                <li key={i} style={{ borderLeft: '2px solid var(--surface-border)', paddingLeft: '0.75rem' }}>
                  {a}
                </li>
              ))}
            </ul>

            {open.note && (
              <p
                className="mt-5 p-3 text-sm"
                style={{
                  borderLeft: '4px solid var(--accent-secondary)',
                  background: 'var(--surface)',
                  color: 'var(--text-secondary)',
                }}
              >
                {open.note}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
