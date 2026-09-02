import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bot,
  Braces,
  Database,
  DoorOpen,
  FileInput,
  Fingerprint,
  FlaskConical,
  GitBranch,
  GitMerge,
  Maximize2,
  Microscope,
  Minus,
  Play,
  Plus,
  ScrollText,
  Send,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Tags,
  Wand2,
} from 'lucide-react'
import { AREAS } from '../content/workflow.js'

/* --------------------------------------------------------------------------
   WorkflowMap — el lienzo de n8n, navegable.

   Reconstruye el flujo con la geometria REAL del export
   (scripts/build_workflow_canvas.py): los 79 nodos donde Ruben los dejo, sus
   114 conexiones y los nueve marcos de area, que en n8n son sticky notes
   grandes y por tanto no hay que inventarlos.

   Por que un mapa y no una captura: un flujo de 11.900 x 4.500 unidades no cabe
   en una pagina. Reducido entero es ilegible, y recortado pierde lo unico que
   importa de un flujo, que es como se conectan las cosas.

   Cuatro problemas de la primera version y como se resuelven aqui:

   1. **El lienzo empieza en coordenadas negativas** (-456, -1032). Un `<svg>`
      recorta todo lo que caiga a la izquierda o por encima de su origen, asi
      que el area 5, que arranca en y = -912, salia con las conexiones
      cortadas. Se traslada el mundo entero por `-bounds` y todo pasa a ser
      positivo. Es la causa raiz de las lineas que se veian truncadas.

   2. **El arrastre expulsaba la vista.** No habia limites, asi que era posible
      empujar el flujo fuera de la ventana y quedarse mirando el vacio.
      `clamp()` obliga a que siempre quede lienzo en pantalla.

   3. **Abria con el flujo entero**, a un zoom donde nada es legible. Ahora
      entra enfocado en el area 1 y el lector se aleja si quiere.

   4. **Las lineas desaparecian al alejarse.** Un trazo de 2,5 unidades a escala
      0,1 mide un cuarto de pixel. Los grosores se dividen por la escala, asi
      que el trazo mide lo mismo en pantalla a cualquier zoom.

   El detalle de cada area NO se repite aqui: ya vive en el boton `(!)` de las
   tarjetas de abajo. Este mapa es para navegar, no para leer.
   -------------------------------------------------------------------------- */

/* Familia visual de cada nodo. El icono dice que clase de trabajo hace. */
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

/* Un simbolo por area, para el indice de arriba. */
const AREA_ICON = {
  1: DoorOpen,
  2: Tags,
  3: Fingerprint,
  4: Shuffle,
  5: FlaskConical,
  6: ScrollText,
  7: Microscope,
  8: Database,
  9: ShieldCheck,
}

const VIEW_H = 620
const MIN_K = 0.05
const MAX_K = 1.6

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi)

export default function WorkflowMap() {
  const wrapRef = useRef(null)
  const [data, setData] = useState(null)
  const [failed, setFailed] = useState(false)
  const [view, setView] = useState({ x: 0, y: 0, k: 0.35 })
  const [active, setActive] = useState(1)
  const [hover, setHover] = useState(null)
  const [dragging, setDragging] = useState(false)
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

  const world = data
    ? { w: data.bounds.w, h: data.bounds.h, ox: -data.bounds.x, oy: -data.bounds.y }
    : null

  /* Impide que el lienzo se salga del todo: siempre queda un tercio dentro. */
  const clampView = useCallback(
    (v, w) => {
      if (!w) return v
      const el = wrapRef.current
      const vw = el ? el.clientWidth : 900
      const keep = 0.34
      return {
        k: v.k,
        x: clamp(v.x, vw * keep - w.w * v.k, vw * (1 - keep)),
        y: clamp(v.y, VIEW_H * keep - w.h * v.k, VIEW_H * (1 - keep)),
      }
    },
    [],
  )

  /* Encaja un rectangulo del lienzo (en coordenadas de n8n) en la ventana. */
  const fitTo = useCallback(
    (rect, margin = 70) => {
      const el = wrapRef.current
      if (!el || !world) return
      const vw = el.clientWidth
      const k = clamp(
        Math.min((vw - margin * 2) / rect.w, (VIEW_H - margin * 2) / rect.h),
        MIN_K,
        MAX_K,
      )
      const cx = rect.x + world.ox + rect.w / 2
      const cy = rect.y + world.oy + rect.h / 2
      setView(clampView({ k, x: vw / 2 - cx * k, y: VIEW_H / 2 - cy * k }, world))
    },
    [world, clampView],
  )

  /* Encuadre inicial: el area 1, no el flujo entero. Entrar viendolo todo a la
     vez abruma y no se lee nada. */
  useEffect(() => {
    if (!data) return
    const first = data.areas.find((a) => a.n === 1) ?? data.bounds
    fitTo(first, 60)
  }, [data, fitTo])

  const onPointerDown = (e) => {
    drag.current = { px: e.clientX, py: e.clientY, x: view.x, y: view.y, moved: false }
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.px
    const dy = e.clientY - d.py
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true
    setView((v) => clampView({ ...v, x: d.x + dx, y: d.y + dy }, world))
  }
  const onPointerUp = () => {
    drag.current = null
    setDragging(false)
  }

  /* Zoom anclado al cursor: el punto bajo el raton no se mueve. */
  const onWheel = (e) => {
    if (!wrapRef.current) return
    e.preventDefault()
    const box = wrapRef.current.getBoundingClientRect()
    const mx = e.clientX - box.left
    const my = e.clientY - box.top
    setView((v) => {
      const k = clamp(v.k * (e.deltaY < 0 ? 1.15 : 1 / 1.15), MIN_K, MAX_K)
      return clampView({ k, x: mx - ((mx - v.x) / v.k) * k, y: my - ((my - v.y) / v.k) * k }, world)
    })
  }

  const zoomBy = (f) =>
    setView((v) => {
      const el = wrapRef.current
      const cx = el ? el.clientWidth / 2 : 0
      const cy = VIEW_H / 2
      const k = clamp(v.k * f, MIN_K, MAX_K)
      return clampView({ k, x: cx - ((cx - v.x) / v.k) * k, y: cy - ((cy - v.y) / v.k) * k }, world)
    })

  if (failed) {
    return <p style={{ color: 'var(--status-amorphous)' }}>The workflow map could not be loaded.</p>
  }
  if (!data || !world) {
    return <p style={{ color: 'var(--text-muted)' }}>Loading the workflow map…</p>
  }

  const { nodeSize, areas, nodes, edges } = data
  const pos = Object.fromEntries(nodes.map((n) => [n.id, n]))
  const meta = Object.fromEntries(AREAS.map((a) => [a.n, a]))
  /* Los grosores se compensan con la escala para que el trazo mida siempre lo
     mismo en pantalla. Sin esto las lineas desaparecen al alejarse. */
  const px = (n) => n / view.k

  return (
    <div className="flex flex-col gap-4">
      {/* ---------------------------------------------------------------
          Indice: nueve paradas de izquierda a derecha, en el orden en que
          el fichero las atraviesa. Cada una lleva la vista a su zona.
          --------------------------------------------------------------- */}
      <div className="overflow-x-auto pb-1">
        <div className="relative flex min-w-max items-start gap-0">
          {/* la linea que las une, por detras */}
          <div
            aria-hidden
            className="absolute"
            style={{
              top: 21,
              left: 32,
              right: 32,
              height: 2,
              background: 'var(--surface-border)',
            }}
          />
          {areas.map((a) => {
            const Icon = AREA_ICON[a.n] ?? Shuffle
            const on = active === a.n
            return (
              <button
                key={a.n}
                type="button"
                onClick={() => {
                  setActive(a.n)
                  fitTo(a, 50)
                }}
                className="relative flex w-[104px] shrink-0 flex-col items-center gap-1.5 bg-transparent px-1"
                title={meta[a.n]?.subtitle ?? a.title}
              >
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-full transition-transform"
                  style={{
                    border: `2.5px solid ${on ? 'var(--accent-primary)' : 'var(--surface-border)'}`,
                    background: on ? 'var(--accent-primary)' : 'var(--surface)',
                    color: on ? 'var(--surface)' : 'var(--text-secondary)',
                    transform: on ? 'scale(1.12)' : 'none',
                  }}
                >
                  <Icon size={19} aria-hidden />
                </span>
                <span
                  className="text-center text-[11px] leading-tight"
                  style={{
                    color: on ? 'var(--accent-primary)' : 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {a.n} · {meta[a.n]?.title ?? a.title}
                </span>
              </button>
            )
          })}
        </div>
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
          cursor: dragging ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            transformOrigin: '0 0',
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
            width: world.w,
            height: world.h,
            willChange: 'transform',
          }}
        >
          {/* Marcos de area y conexiones. El grupo se desplaza por el origen
              negativo del lienzo de n8n: sin esto el SVG recorta el area 5. */}
          <svg
            width={world.w}
            height={world.h}
            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }}
            aria-hidden
          >
            <g transform={`translate(${world.ox}, ${world.oy})`}>
              {areas.map((a) => {
                const on = active === a.n
                return (
                  <g key={a.n}>
                    <rect
                      x={a.x}
                      y={a.y}
                      width={a.w}
                      height={a.h}
                      rx={20}
                      fill={on ? 'var(--accent-glow)' : 'var(--surface-elevated)'}
                      fillOpacity={on ? 1 : 0.5}
                      stroke={on ? 'var(--accent-primary)' : 'var(--text-muted)'}
                      strokeWidth={px(on ? 3.5 : 1.5)}
                      strokeDasharray={on ? 'none' : `${px(9)} ${px(7)}`}
                    />
                    <text
                      x={a.x + px(14)}
                      y={a.y - px(10)}
                      fontSize={px(15)}
                      fill={on ? 'var(--accent-primary)' : 'var(--text-muted)'}
                      fontFamily="var(--font-display)"
                      letterSpacing={px(1)}
                    >
                      {a.n} · {(meta[a.n]?.title ?? a.title).toUpperCase()}
                    </text>
                  </g>
                )
              })}

              {edges.map((e, i) => {
                const a = pos[e.from]
                const b = pos[e.to]
                if (!a || !b) return null
                const x1 = a.x + nodeSize.w
                const y1 = a.y + nodeSize.h / 2
                const x2 = b.x
                const y2 = b.y + nodeSize.h / 2
                /* Curva en S. El tirador crece con la distancia para que los
                   saltos largos entre areas no crucen los nodos de en medio. */
                const dx = Math.max(70, Math.abs(x2 - x1) * 0.4)
                const lit = hover && (e.from === hover || e.to === hover)
                return (
                  <path
                    key={i}
                    d={`M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`}
                    fill="none"
                    stroke={lit ? 'var(--accent-primary)' : 'var(--text-secondary)'}
                    strokeWidth={px(lit ? 2.6 : 1.3)}
                    opacity={lit ? 1 : 0.55}
                    strokeLinecap="round"
                  />
                )
              })}
            </g>
          </svg>

          {/* nodos */}
          {nodes.map((n) => {
            const k = KIND[n.kind] ?? KIND.transform
            const Icon = k.icon
            const dim = active && n.area && n.area !== active
            return (
              <div
                key={n.id}
                data-node
                onMouseEnter={() => setHover(n.id)}
                onMouseLeave={() => setHover(null)}
                title={n.name}
                style={{
                  position: 'absolute',
                  left: n.x + world.ox,
                  top: n.y + world.oy,
                  width: nodeSize.w,
                  height: nodeSize.h,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '0 10px',
                  borderRadius: 8,
                  border: `${px(1.6)}px solid ${k.color}`,
                  background: 'var(--surface)',
                  opacity: dim ? 0.45 : 1,
                  boxShadow: hover === n.id ? `0 0 0 ${px(3)}px var(--accent-glow)` : 'none',
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

        {/* controles, flotando sobre el lienzo */}
        <div className="absolute right-3 top-3 flex flex-col gap-1.5">
          {[
            [Plus, 'Zoom in', () => zoomBy(1.3)],
            [Minus, 'Zoom out', () => zoomBy(1 / 1.3)],
            [Maximize2, 'Fit whole flow', () => fitTo(data.bounds, 30)],
          ].map(([Icon, label, fn]) => (
            <button
              key={label}
              type="button"
              onClick={fn}
              aria-label={label}
              title={label}
              className="rounded-[var(--radius-badge)] p-1.5"
              style={{
                border: '2px solid var(--surface-border)',
                background: 'var(--surface)',
                color: 'var(--text-secondary)',
              }}
            >
              <Icon size={14} aria-hidden />
            </button>
          ))}
        </div>

        <div
          className="pointer-events-none absolute bottom-2 left-3 text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          Drag to pan · scroll to zoom · {nodes.length} nodes · {edges.length} connections
        </div>
      </div>
    </div>
  )
}
