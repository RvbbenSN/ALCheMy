import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  Layers,
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
import { Badge } from './ui.jsx'

/* --------------------------------------------------------------------------
   WorkflowMap — el lienzo de n8n, navegable, con su capa didactica encima.

   Reconstruye el flujo con la geometria REAL del export
   (scripts/build_workflow_canvas.py): los 79 nodos donde Ruben los dejo, sus
   114 conexiones y los nueve marcos de area, que en n8n son sticky notes
   grandes y por tanto no hay que inventarlos.

   La lectura va de arriba abajo y es una sola pieza, no dos:

       indice de nueve paradas  ->  leyenda  ->  lienzo  ->  ficha del area activa

   Antes la explicacion de las areas vivia en tarjetas aparte, debajo del mapa,
   y habia que leerlas dos veces. Ahora hay una sola ficha, la del area activa,
   y va debajo del lienzo: la leyenda sube junto al mapa porque se consulta
   mientras se mira, y la ficha baja porque se lee despues de haber mirado.

   Cuatro bugs de las versiones anteriores y su causa, que conviene no repetir:

   1. **El lienzo empieza en coordenadas negativas** (-456, -1032). Un `<svg>`
      recorta todo lo anterior a su origen, asi que el area 5, que arranca en
      y = -912, salia con las conexiones truncadas. Se traslada el mundo entero
      por `-bounds` y todo pasa a ser positivo.

   2. **El arrastre expulsaba la vista.** Sin limites era posible empujar el
      flujo fuera de la ventana. `clampView` deja siempre un tercio dentro.

   3. **Las lineas desaparecian al alejarse.** Un trazo de 2,5 unidades a escala
      0,1 mide un cuarto de pixel. Los grosores se dividen por la escala.

   4. **El bucle de render.** `world` se calculaba en cada render, asi que
      `fitTo` cambiaba de identidad, el efecto del encuadre inicial se
      disparaba otra vez y devolvia la vista al area 1 — encima realimentandose.
      Sintomas: al pulsar una parada el marco cambiaba pero la vista no, la
      pagina se arrastraba y llegaba a bloquear la navegacion entre pestanas.
      Se arregla con `useMemo` sobre `world` y un `ref` que deja el encuadre
      inicial correr una sola vez.
   -------------------------------------------------------------------------- */

/* Familia visual de cada nodo. El icono dice que clase de trabajo hace, que es
   lo que de verdad ayuda a leer un flujo ajeno. */
const KIND = {
  trigger: { icon: Play, color: 'var(--status-pure)', label: 'Trigger' },
  file: { icon: FileInput, color: 'var(--status-pure)', label: 'File I/O' },
  transform: { icon: Wand2, color: 'var(--text-secondary)', label: 'Transform' },
  code: { icon: Braces, color: 'var(--accent-tertiary)', label: 'Code' },
  gate: { icon: GitBranch, color: 'var(--status-incipient)', label: 'Decision' },
  router: { icon: Shuffle, color: 'var(--status-incipient)', label: 'Router' },
  merge: { icon: GitMerge, color: 'var(--text-secondary)', label: 'Merge' },
  db: { icon: Database, color: 'var(--accent-tertiary)', label: 'Database' },
  reply: { icon: Send, color: 'var(--text-secondary)', label: 'Response' },
  ai: { icon: Bot, color: 'var(--accent-secondary-text)', label: 'AI agent' },
  model: { icon: Sparkles, color: 'var(--accent-secondary-text)', label: 'Model' },
}

/* La leyenda solo lista los tipos que el lienzo dibuja de verdad, en el orden
   en que se atraviesan. Anunciar categorias que no aparecen confunde mas que
   ayuda: el export de n8n no distingue, por ejemplo, un parser de cualquier
   otro Code node, asi que ese matiz vive en la ficha del area, no aqui. */
const LEGEND = ['trigger', 'file', 'transform', 'gate', 'router', 'merge', 'code', 'ai', 'model', 'db', 'reply']

/* Un simbolo por area, para el indice. */
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
const OVERVIEW = 0 // la parada final del indice: el flujo entero

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
  const didFit = useRef(false)

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

  /* Memorizado: si este objeto cambiara de identidad en cada render, `fitTo`
     cambiaria con el y el efecto del encuadre inicial no pararia nunca. */
  const world = useMemo(
    () => (data ? { w: data.bounds.w, h: data.bounds.h, ox: -data.bounds.x, oy: -data.bounds.y } : null),
    [data],
  )

  /* Impide que el lienzo se salga del todo: siempre queda un tercio dentro. */
  const clampView = useCallback((v, w) => {
    if (!w) return v
    const el = wrapRef.current
    const vw = el ? el.clientWidth : 900
    const keep = 0.34
    return {
      k: v.k,
      x: clamp(v.x, vw * keep - w.w * v.k, vw * (1 - keep)),
      y: clamp(v.y, VIEW_H * keep - w.h * v.k, VIEW_H * (1 - keep)),
    }
  }, [])

  /* Encaja un rectangulo del lienzo (en coordenadas de n8n) en la ventana. */
  const fitTo = useCallback(
    (rect, margin = 70) => {
      const el = wrapRef.current
      if (!el || !world) return
      const vw = el.clientWidth
      const k = clamp(Math.min((vw - margin * 2) / rect.w, (VIEW_H - margin * 2) / rect.h), MIN_K, MAX_K)
      const cx = rect.x + world.ox + rect.w / 2
      const cy = rect.y + world.oy + rect.h / 2
      setView(clampView({ k, x: vw / 2 - cx * k, y: VIEW_H / 2 - cy * k }, world))
    },
    [world, clampView],
  )

  /* Encuadre inicial: el area 1, no el flujo entero. Una sola vez: el `ref`
     es lo que impide que cualquier render posterior devuelva la vista aqui. */
  useEffect(() => {
    if (!data || didFit.current) return
    didFit.current = true
    fitTo(data.areas.find((a) => a.n === 1) ?? data.bounds, 60)
  }, [data, fitTo])

  const goTo = (n) => {
    setActive(n)
    if (!data) return
    if (n === OVERVIEW) fitTo(data.bounds, 30)
    else {
      const a = data.areas.find((x) => x.n === n)
      if (a) fitTo(a, 50)
    }
  }

  const onPointerDown = (e) => {
    drag.current = { px: e.clientX, py: e.clientY, x: view.x, y: view.y }
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e) => {
    const d = drag.current
    if (!d) return
    setView((v) => clampView({ ...v, x: d.x + (e.clientX - d.px), y: d.y + (e.clientY - d.py) }, world))
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
      const k = clamp(v.k * f, MIN_K, MAX_K)
      return clampView(
        { k, x: cx - ((cx - v.x) / v.k) * k, y: VIEW_H / 2 - ((VIEW_H / 2 - v.y) / v.k) * k },
        world,
      )
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
  const card = active === OVERVIEW ? null : meta[active]
  /* Los grosores se compensan con la escala para que el trazo mida siempre lo
     mismo en pantalla. Sin esto las lineas desaparecen al alejarse. */
  const px = (n) => n / view.k

  return (
    <div className="flex flex-col gap-4">
      {/* ---------------------------------------------------------------
          Indice: nueve paradas en el orden en que el fichero las atraviesa,
          y al final la vista general.
          --------------------------------------------------------------- */}
      <div className="overflow-x-auto pb-1">
        <div className="relative flex min-w-max items-start gap-0">
          <div
            aria-hidden
            className="absolute"
            style={{ top: 21, left: 40, right: 40, height: 2, background: 'var(--surface-border)' }}
          />
          {[...areas.map((a) => ({ n: a.n, label: meta[a.n]?.title ?? a.title, icon: AREA_ICON[a.n] ?? Shuffle })),
            { n: OVERVIEW, label: 'Whole flow', icon: Layers }].map((s) => {
            const Icon = s.icon
            const on = active === s.n
            return (
              <button
                key={s.n}
                type="button"
                onClick={() => goTo(s.n)}
                className="relative flex w-[104px] shrink-0 flex-col items-center gap-1.5 bg-transparent px-1"
                title={s.n === OVERVIEW ? 'Fit the whole flow' : meta[s.n]?.subtitle ?? s.label}
                aria-current={on ? 'true' : undefined}
              >
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-full"
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
                  {s.n === OVERVIEW ? s.label : `${s.n} · ${s.label}`}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* --- leyenda: que significa cada icono de nodo --- */}
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {LEGEND.map((key) => {
          const k = KIND[key]
          const Icon = k.icon
          return (
            <span key={key} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              <Icon size={13} aria-hidden style={{ color: k.color }} />
              {k.label}
              <span style={{ fontFamily: 'var(--font-mono)', opacity: 0.7 }}>
                {nodes.filter((n) => n.kind === key).length}
              </span>
            </span>
          )
        })}
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
          {/* Marcos y conexiones. El grupo se desplaza por el origen negativo
              del lienzo de n8n: sin esto el SVG recorta el area 5. */}
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
                    {/* El rotulo va DENTRO del marco, no encima: fuera podia
                        pisar el area de al lado. Y su tamano se limita al ancho
                        del propio marco, porque a un zoom alejado un cuerpo fijo
                        en pantalla desbordaba areas que ya median cuatro pixeles
                        y todos los titulos acababan encimados. */}
                    {(() => {
                      const label = `${a.n} · ${(meta[a.n]?.title ?? a.title).toUpperCase()}`
                      const fits = (a.w - px(24)) / (label.length * 0.62)
                      const size = Math.min(px(15), fits)
                      if (size < px(6)) return null
                      return (
                        <text
                          x={a.x + px(12)}
                          y={a.y + size + px(10)}
                          fontSize={size}
                          fill={on ? 'var(--accent-primary)' : 'var(--text-muted)'}
                          fontFamily="var(--font-display)"
                          letterSpacing={size * 0.06}
                        >
                          {label}
                        </text>
                      )
                    })()}
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
            const dim = active !== OVERVIEW && n.area && n.area !== active
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

        <div className="absolute right-3 top-3 flex flex-col gap-1.5">
          {[
            [Plus, 'Zoom in', () => zoomBy(1.3)],
            [Minus, 'Zoom out', () => zoomBy(1 / 1.3)],
            [Maximize2, 'Fit whole flow', () => goTo(OVERVIEW)],
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
          Drag to pan · scroll to zoom
        </div>
      </div>

      {/* ---------------------------------------------------------------
          Ficha del area activa. Antes eran nueve tarjetas apiladas debajo
          del mapa; aqui solo se muestra la que se esta mirando.
          --------------------------------------------------------------- */}
      <div
        className="rounded-[var(--radius-card)] p-5"
        style={{
          border: 'var(--border-card) solid var(--accent-primary)',
          background: 'var(--surface-elevated)',
          minHeight: 190,
        }}
      >
        {card ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="accent">Area {card.n}</Badge>
              <h3 className="text-lg leading-tight">{card.title}</h3>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {card.subtitle}
              </span>
              <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {nodes.filter((n) => n.area === card.n).length} nodes
              </span>
            </div>

            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {card.objective}
            </p>

            <h4
              className="mt-4 text-xs uppercase tracking-wider"
              style={{ color: 'var(--accent-secondary-text)' }}
            >
              What this area adds to the item
            </h4>
            <ul
              className="mt-2 flex list-none flex-col gap-1.5 p-0 text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              {card.adds.map((a, i) => (
                <li key={i} style={{ borderLeft: '2px solid var(--surface-border)', paddingLeft: '0.75rem' }}>
                  {a}
                </li>
              ))}
            </ul>

            {card.note && (
              <p
                className="mt-4 p-3 text-sm"
                style={{
                  borderLeft: '4px solid var(--accent-secondary)',
                  background: 'var(--surface)',
                  color: 'var(--text-secondary)',
                }}
              >
                {card.note}
              </p>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="accent">Whole flow</Badge>
              <h3 className="text-lg leading-tight">Every lane, end to end</h3>
              <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {nodes.length} nodes · {edges.length} connections
              </span>
            </div>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Four entry points, one exit. Whatever the lane &mdash; a webhook, a watched folder, a web
              form, a manual run &mdash; the item is normalised into the same shape, gated on
              authorisation and on a duplicate check, then routed by technique: deterministic parsers on
              the left, AI agents for the formats no parser can read on the right. Every branch,
              including every failure, ends in a database write and an audit entry.
            </p>
            <ol
              className="mt-4 flex list-none flex-wrap items-center gap-x-2 gap-y-2 p-0 text-xs"
              style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
            >
              {AREAS.map((a, i) => (
                <li key={a.n} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => goTo(a.n)}
                    className="rounded-[var(--radius-badge)] px-2 py-1"
                    style={{ border: '1.5px solid var(--surface-border)', color: 'var(--text-secondary)' }}
                  >
                    {a.n} · {a.title}
                  </button>
                  {i < AREAS.length - 1 && <span aria-hidden style={{ color: 'var(--text-muted)' }}>›</span>}
                </li>
              ))}
            </ol>
          </>
        )}
      </div>

    </div>
  )
}
