import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bot,
  Braces,
  Crosshair,
  Database,
  FileInput,
  GitBranch,
  GitMerge,
  Info,
  Maximize2,
  Minus,
  Play,
  Plus,
  Send,
  Shuffle,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react'
import { AREAS } from '../content/workflow.js'
import { Badge } from './ui.jsx'

/* --------------------------------------------------------------------------
   WorkflowMap — el lienzo de n8n, navegable.

   Reconstruye el flujo con la geometria REAL del export
   (scripts/build_workflow_canvas.py): las posiciones de los 79 nodos, sus 114
   conexiones, y los nueve marcos de area, que en n8n son sticky notes grandes
   y por tanto no hay que inventarlos.

   Por que un mapa y no una captura: un flujo de 11.900 x 4.500 unidades no cabe
   en una pagina. Reducido entero es ilegible, y recortado pierde lo unico que
   importa de un flujo, que es como se conectan las cosas. Con desplazamiento y
   zoom se puede mirar de cerca sin perder el conjunto.

   Las chinchetas numeradas de arriba llevan la vista a cada area, y el panel de
   detalle recoge lo que en n8n son sticky notes de anotacion. Sobre el lienzo
   solo queda la estructura.
   -------------------------------------------------------------------------- */

const KIND = {
  trigger: { icon: Play, color: 'var(--status-pure)' },
  file: { icon: FileInput, color: 'var(--status-pure)' },
  transform: { icon: Wand2, color: 'var(--text-secondary)' },
  code: { icon: Braces, color: 'var(--accent-tertiary)' },
  gate: { icon: GitBranch, color: 'var(--status-incipient)' },
  router: { icon: Shuffle, color: 'var(--status-incipient)' },
  merge: { icon: GitMerge, color: 'var(--text-secondary)' },
  db: { icon: Database, color: 'var(--accent-tertiary)' },
  reply: { icon: Send, color: 'var(--text-secondary)' },
  ai: { icon: Bot, color: 'var(--accent-secondary-text)' },
  model: { icon: Sparkles, color: 'var(--accent-secondary-text)' },
}

const VIEW_H = 620
const MIN_K = 0.05
const MAX_K = 1.6

export default function WorkflowMap() {
  const wrapRef = useRef(null)
  const [data, setData] = useState(null)
  const [failed, setFailed] = useState(false)
  const [view, setView] = useState({ x: 0, y: 0, k: 0.1 })
  const [detail, setDetail] = useState(null)
  const [hover, setHover] = useState(null)
  const drag = useRef(null)

  useEffect(() => {
    let alive = true
    fetch('/data/workflow_canvas.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then((d) => alive && setData(d))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [])

  /* Encaja un rectangulo del lienzo en la ventana visible. */
  const fitTo = useCallback((rect, margin = 60) => {
    const el = wrapRef.current
    if (!el) return
    const w = el.clientWidth
    const k = Math.min(
      Math.max(Math.min((w - margin * 2) / rect.w, (VIEW_H - margin * 2) / rect.h), MIN_K),
      MAX_K,
    )
    setView({
      k,
      x: w / 2 - (rect.x + rect.w / 2) * k,
      y: VIEW_H / 2 - (rect.y + rect.h / 2) * k,
    })
  }, [])

  // Encuadre inicial: el flujo entero.
  useEffect(() => {
    if (data) fitTo(data.bounds)
  }, [data, fitTo])

  const onPointerDown = (e) => {
    if (e.target.closest('[data-node]')) return
    drag.current = { px: e.clientX, py: e.clientY, x: view.x, y: view.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e) => {
    if (!drag.current) return
    setView((v) => ({
      ...v,
      x: drag.current.x + (e.clientX - drag.current.px),
      y: drag.current.y + (e.clientY - drag.current.py),
    }))
  }
  const onPointerUp = () => {
    drag.current = null
  }

  /* Zoom anclado al cursor: el punto bajo el raton no se mueve. */
  const onWheel = (e) => {
    if (!wrapRef.current) return
    e.preventDefault()
    const box = wrapRef.current.getBoundingClientRect()
    const mx = e.clientX - box.left
    const my = e.clientY - box.top
    setView((v) => {
      const k = Math.min(Math.max(v.k * (e.deltaY < 0 ? 1.15 : 1 / 1.15), MIN_K), MAX_K)
      return { k, x: mx - ((mx - v.x) / v.k) * k, y: my - ((my - v.y) / v.k) * k }
    })
  }

  const zoomBy = (f) =>
    setView((v) => {
      const el = wrapRef.current
      const cx = el ? el.clientWidth / 2 : 0
      const cy = VIEW_H / 2
      const k = Math.min(Math.max(v.k * f, MIN_K), MAX_K)
      return { k, x: cx - ((cx - v.x) / v.k) * k, y: cy - ((cy - v.y) / v.k) * k }
    })

  if (failed) {
    return (
      <p style={{ color: 'var(--status-amorphous)' }}>
        The workflow map could not be loaded.
      </p>
    )
  }
  if (!data) {
    return <p style={{ color: 'var(--text-muted)' }}>Loading the workflow map…</p>
  }

  const { nodeSize, bounds, areas, nodes, edges, notes } = data
  const pos = Object.fromEntries(nodes.map((n) => [n.id, n]))
  const detailArea = detail ? AREAS.find((a) => a.n === detail) : null
  const detailNotes = detail ? notes.filter((n) => n.area === detail && n.content) : []

  return (
    <div className="flex flex-col gap-3">
      {/* --- chinchetas: llevan la vista a cada area --- */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => fitTo(bounds)}
          className="flex items-center gap-1.5 rounded-[var(--radius-badge)] px-3 py-1.5 text-xs uppercase tracking-wider"
          style={{ border: '2px solid var(--surface-border)', color: 'var(--text-secondary)' }}
        >
          <Maximize2 size={13} aria-hidden />
          Whole flow
        </button>
        {areas.map((a) => (
          <button
            key={a.n}
            type="button"
            onClick={() => {
              fitTo(a, 40)
              setDetail(a.n)
            }}
            className="flex items-center gap-1.5 rounded-[var(--radius-badge)] px-2.5 py-1.5 text-xs"
            style={{
              border: `2px solid ${detail === a.n ? 'var(--accent-primary)' : 'var(--surface-border)'}`,
              background: detail === a.n ? 'var(--accent-primary)' : 'transparent',
              color: detail === a.n ? 'var(--surface)' : 'var(--text-secondary)',
            }}
            title={a.title}
          >
            <Crosshair size={12} aria-hidden />
            {a.n}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => zoomBy(1 / 1.3)}
            aria-label="Zoom out"
            className="rounded-[var(--radius-badge)] p-1.5"
            style={{ border: '2px solid var(--surface-border)', color: 'var(--text-secondary)' }}
          >
            <Minus size={14} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => zoomBy(1.3)}
            aria-label="Zoom in"
            className="rounded-[var(--radius-badge)] p-1.5"
            style={{ border: '2px solid var(--surface-border)', color: 'var(--text-secondary)' }}
          >
            <Plus size={14} aria-hidden />
          </button>
        </span>
      </div>

      {/* --- el lienzo --- */}
      <div
        ref={wrapRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        className="relative overflow-hidden rounded-[var(--radius-card)]"
        style={{
          height: VIEW_H,
          border: 'var(--border-card) solid var(--surface-border)',
          background: 'var(--chart-bg)',
          cursor: drag.current ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            transformOrigin: '0 0',
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
            width: bounds.x + bounds.w,
            height: bounds.y + bounds.h,
          }}
        >
          {/* marcos de area + conexiones */}
          <svg
            width={bounds.x + bounds.w}
            height={bounds.y + bounds.h}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            aria-hidden
          >
            {areas.map((a) => (
              <g key={a.n}>
                <rect
                  x={a.x}
                  y={a.y}
                  width={a.w}
                  height={a.h}
                  rx={16}
                  fill={detail === a.n ? 'var(--accent-glow)' : 'transparent'}
                  stroke={detail === a.n ? 'var(--accent-primary)' : 'var(--surface-border)'}
                  strokeWidth={detail === a.n ? 8 : 4}
                  strokeDasharray="18 12"
                />
                <text
                  x={a.x + 20}
                  y={a.y + 56}
                  fontSize={44}
                  fill="var(--accent-primary)"
                  fontFamily="var(--font-display)"
                >
                  {a.n} · {a.title}
                </text>
              </g>
            ))}

            {edges.map((e, i) => {
              const a = pos[e.from]
              const b = pos[e.to]
              if (!a || !b) return null
              const x1 = a.x + nodeSize.w
              const y1 = a.y + nodeSize.h / 2
              const x2 = b.x
              const y2 = b.y + nodeSize.h / 2
              const dx = Math.max(60, Math.abs(x2 - x1) * 0.4)
              const lit = hover && (e.from === hover || e.to === hover)
              return (
                <path
                  key={i}
                  d={`M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`}
                  fill="none"
                  stroke={lit ? 'var(--accent-primary)' : 'var(--surface-border)'}
                  strokeWidth={lit ? 5 : 2.5}
                  opacity={lit ? 1 : 0.75}
                />
              )
            })}
          </svg>

          {/* nodos */}
          {nodes.map((n) => {
            const k = KIND[n.kind] ?? KIND.transform
            const Icon = k.icon
            return (
              <div
                key={n.id}
                data-node
                onMouseEnter={() => setHover(n.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => n.area && setDetail(n.area)}
                title={n.name}
                style={{
                  position: 'absolute',
                  left: n.x,
                  top: n.y,
                  width: nodeSize.w,
                  height: nodeSize.h,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '0 10px',
                  borderRadius: 8,
                  border: `3px solid ${k.color}`,
                  background: 'var(--surface)',
                  boxShadow: hover === n.id ? `0 0 0 6px var(--accent-glow)` : 'none',
                  cursor: 'pointer',
                  overflow: 'hidden',
                }}
              >
                <Icon size={20} aria-hidden style={{ color: k.color, flexShrink: 0 }} />
                <span
                  style={{
                    fontSize: 13,
                    lineHeight: 1.15,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {n.name}
                </span>
              </div>
            )
          })}
        </div>

        <div
          className="pointer-events-none absolute bottom-2 left-3 text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          Drag to pan · scroll to zoom · {nodes.length} nodes, {edges.length} connections
        </div>
      </div>

      {/* --- panel de detalle: lo que en n8n son sticky notes --- */}
      {detailArea && (
        <div
          className="rounded-[var(--radius-card)] p-5"
          style={{
            border: 'var(--border-card) solid var(--accent-primary)',
            background: 'var(--surface-elevated)',
          }}
        >
          <div className="flex items-start gap-3">
            <Badge tone="accent">Area {detailArea.n}</Badge>
            <div className="min-w-0">
              <h3 className="text-lg leading-tight">{detailArea.title}</h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {detailArea.subtitle}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDetail(null)}
              aria-label="Close detail"
              className="ml-auto rounded-[var(--radius-badge)] p-1"
              style={{ border: '2px solid var(--surface-border)', color: 'var(--text-primary)' }}
            >
              <X size={15} aria-hidden />
            </button>
          </div>

          <p className="mt-4" style={{ color: 'var(--text-secondary)' }}>
            {detailArea.objective}
          </p>

          <h4 className="mt-5 text-xs uppercase tracking-wider" style={{ color: 'var(--accent-secondary-text)' }}>
            What this area adds to the item
          </h4>
          <ul className="mt-2 flex list-none flex-col gap-2 p-0 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {detailArea.adds.map((a, i) => (
              <li key={i} style={{ borderLeft: '2px solid var(--surface-border)', paddingLeft: '0.75rem' }}>
                {a}
              </li>
            ))}
          </ul>

          {detailArea.note && (
            <p
              className="mt-4 p-3 text-sm"
              style={{
                borderLeft: '4px solid var(--accent-secondary)',
                background: 'var(--surface)',
                color: 'var(--text-secondary)',
              }}
            >
              {detailArea.note}
            </p>
          )}

          {detailNotes.length > 0 && (
            <>
              <h4 className="mt-5 flex items-center gap-1.5 text-xs uppercase tracking-wider" style={{ color: 'var(--accent-secondary-text)' }}>
                <Info size={13} aria-hidden />
                Notes pinned to this area in n8n
              </h4>
              <div className="mt-2 flex flex-col gap-2">
                {detailNotes.map((n, i) => (
                  <pre
                    key={i}
                    className="mono overflow-x-auto rounded-[var(--radius-badge)] p-3 text-xs"
                    style={{
                      background: 'var(--surface)',
                      border: '1.5px solid var(--surface-border)',
                      color: 'var(--text-secondary)',
                      whiteSpace: 'pre-wrap',
                      margin: 0,
                    }}
                  >
                    {n.content}
                  </pre>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
