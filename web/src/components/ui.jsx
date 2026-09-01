import { useEffect, useId, useRef, useState } from 'react'
import { GLOSSARY } from '../content/site.js'

/* --------------------------------------------------------------------------
   Piezas del sistema neo-brutalista: borde grueso, sombra solida, sin blur.
   Todas leen los tokens, ninguna trae colores propios.
   -------------------------------------------------------------------------- */

/* --------------------------------------------------------------------------
   Rich — resalta en negrita lo que va entre **dobles asteriscos**.

   El contenido de la web vive como cadenas de texto plano en content/, para que
   se pueda reescribir una frase sin tocar JSX ni arriesgarse a romper el
   maquetado. Pero el texto tecnico se lee mucho mejor con las palabras clave
   destacadas, y meter <strong> en las cadenas obligaria a convertirlas en JSX.

   Este componente resuelve las dos cosas: las cadenas siguen siendo texto, y
   marcar una palabra clave es escribir **asi**. No es Markdown completo a
   proposito — solo negrita — porque un parser mas ambicioso invita a meter
   maquetado en el contenido, que es justo lo que se quiere evitar.
   -------------------------------------------------------------------------- */
export function Rich({ children }) {
  if (typeof children !== 'string') return children
  const parts = children.split(/\*\*(.+?)\*\*/g)
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <strong key={i} style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
            {p}
          </strong>
        ) : (
          p
        ),
      )}
    </>
  )
}

export function Card({ children, className = '', accent = false, as: Tag = 'div' }) {
  return (
    <Tag
      className={`rounded-[var(--radius-card)] p-6 ${className}`}
      style={{
        background: 'var(--surface)',
        border: 'var(--border-card) solid var(--surface-border)',
        boxShadow: accent ? 'var(--shadow-card)' : 'none',
      }}
    >
      {children}
    </Tag>
  )
}

export function Badge({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'var(--text-secondary)',
    pure: 'var(--status-pure)',
    incipient: 'var(--status-incipient)',
    amorphous: 'var(--status-amorphous)',
    info: 'var(--status-info)',
    accent: 'var(--accent-primary)',
  }
  const color = tones[tone] ?? tones.neutral
  return (
    <span
      className="inline-block rounded-[var(--radius-badge)] px-2.5 py-1 text-xs uppercase tracking-wider"
      style={{ border: `var(--border-badge) solid ${color}`, color }}
    >
      {children}
    </span>
  )
}

export function Button({ children, href, onClick, variant = 'primary', ...rest }) {
  const primary = variant === 'primary'
  const Tag = href ? 'a' : 'button'
  return (
    <Tag
      href={href}
      onClick={onClick}
      className="inline-block cursor-pointer rounded-[var(--radius-button)] px-5 py-2.5 text-sm font-bold uppercase tracking-[1px] transition-transform hover:-translate-y-0.5"
      style={{
        border: `var(--border-button) solid ${primary ? 'var(--accent-primary)' : 'var(--surface-border)'}`,
        background: primary ? 'var(--accent-primary)' : 'transparent',
        color: primary ? 'var(--surface)' : 'var(--text-primary)',
        boxShadow: primary ? 'var(--shadow-button)' : 'none',
        fontFamily: 'var(--font-heading)',
      }}
      {...rest}
    >
      {children}
    </Tag>
  )
}

/* Tarjeta de KPI. El numero grande va en la display font. */
export function KpiCard({ value, label, note }) {
  return (
    <Card accent className="text-center">
      <div
        className="text-4xl leading-none md:text-5xl"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-primary)', letterSpacing: '1px' }}
      >
        {value}
      </div>
      <div className="mt-3 text-sm font-medium uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
        {label}
      </div>
      {note && (
        <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          {note}
        </div>
      )}
    </Card>
  )
}

/* --------------------------------------------------------------------------
   Term — la capa didactica de nivel 1.
   Subraya un termino y abre su explicacion al pasar el raton o al enfocarlo
   con el teclado. Si el termino no esta en el glosario, no rompe: solo
   renderiza el texto tal cual.
   -------------------------------------------------------------------------- */
export function Term({ k, children }) {
  const entry = GLOSSARY[k]
  const [open, setOpen] = useState(false)
  const id = useId()
  if (!entry) return <>{children ?? k}</>

  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        className="cursor-help border-0 bg-transparent p-0 font-inherit"
        style={{
          color: 'inherit',
          borderBottom: '2px dotted var(--accent-secondary)',
          font: 'inherit',
        }}
      >
        {children ?? k}
      </button>
      {open && (
        <span
          role="tooltip"
          id={id}
          className="absolute bottom-full left-1/2 z-50 mb-2 block w-72 -translate-x-1/2 rounded-[var(--radius-card)] p-3 text-left text-sm normal-case"
          style={{
            background: 'var(--surface-elevated)',
            border: 'var(--border-card) solid var(--accent-primary)',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: 'var(--text-primary)' }}>{entry.long}</strong>
          <br />
          {entry.text}
        </span>
      )}
    </span>
  )
}

/* Bloque de "todavia no escrito". Deliberadamente visible: mientras el
   esqueleto se rellena, un hueco tiene que verse como un hueco. */
export function Placeholder({ children, source }) {
  return (
    <div
      className="rounded-[var(--radius-card)] p-5 text-sm"
      style={{
        border: '2px dashed var(--surface-border)',
        color: 'var(--text-muted)',
        background: 'transparent',
      }}
    >
      <Badge tone="info">Pending copy</Badge>
      <p className="mt-3">{children}</p>
      {source && (
        <p className="mt-2 mono text-xs" style={{ color: 'var(--text-muted)' }}>
          Source: {source}
        </p>
      )}
    </div>
  )
}

export function SectionTitle({ eyebrow, children, id }) {
  return (
    <header className="mb-6" id={id}>
      {eyebrow && (
        <div className="mb-1 text-xs uppercase tracking-[2px]" style={{ color: 'var(--accent-secondary-text)' }}>
          {eyebrow}
        </div>
      )}
      <h2 className="text-2xl md:text-3xl" style={{ letterSpacing: '1px' }}>
        {children}
      </h2>
    </header>
  )
}

/* Tabla que scrollea dentro de su caja, nunca empuja el ancho de la pagina. */
export function ScrollTable({ head, rows }) {
  return (
    <div className="overflow-x-auto" style={{ border: '2px solid var(--surface-border)', borderRadius: 'var(--radius-card)' }}>
      <table className="w-full border-collapse text-sm" style={{ minWidth: '640px' }}>
        <thead>
          <tr style={{ background: 'var(--surface-elevated)' }}>
            {head.map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs uppercase tracking-wider"
                style={{ color: 'var(--text-primary)', borderBottom: '2px solid var(--surface-border)' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--surface-border)' }}>
              {r.map((cell, j) => (
                <td key={j} className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* Hook del tema. Persiste la eleccion; tolera almacenamiento bloqueado. */
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('alchemy-theme') || 'light'
    } catch {
      return 'light'
    }
  })
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('alchemy-theme', theme)
    } catch {
      /* sin persistencia: el tema sigue funcionando en esta pestana */
    }
  }, [theme])
  return [theme, setTheme]
}

/* Reproductor ambiental: apagado por defecto, nunca autoplay (decision D7). */
export function AmbientPlayer({ src = '/audio/ambient_theme.mp3' }) {
  const ref = useRef(null)
  const [on, setOn] = useState(false)
  const toggle = () => {
    const el = ref.current
    if (!el) return
    if (on) {
      el.pause()
      setOn(false)
    } else {
      el.volume = 0.2
      el.play().then(() => setOn(true)).catch(() => setOn(false))
    }
  }
  return (
    <>
      <audio ref={ref} src={src} loop preload="none" />
      <button
        type="button"
        onClick={toggle}
        aria-pressed={on}
        aria-label={on ? 'Turn ambient sound off' : 'Turn ambient sound on'}
        className="fixed bottom-4 right-4 z-40 rounded-[var(--radius-button)] px-3 py-2 text-xs uppercase tracking-wider"
        style={{
          background: 'var(--surface-elevated)',
          border: '2px solid var(--surface-border)',
          color: 'var(--text-secondary)',
        }}
      >
        {on ? 'Ambient · on' : 'Ambient · off'}
      </button>
    </>
  )
}
