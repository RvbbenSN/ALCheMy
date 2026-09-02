import { Badge } from './ui.jsx'

/* --------------------------------------------------------------------------
   ScreenRecording — una herramienta interna, ensenada en video.

   El etiquetador y el explorador escriben en la base de datos de produccion, y
   servirlos en vivo desde un portfolio significaria dejar que cualquiera
   modifique las etiquetas humanas, que son lo unico que ningun pipeline puede
   reconstruir. Un video muestra la herramienta sin exponerla.

   Van sin sonido, sin reproduccion automatica y con `preload="none"`: la
   pantalla no debe descargar seis megas a quien no ha pedido verlos.
   -------------------------------------------------------------------------- */

export default function ScreenRecording({ src, poster, title, note, duration }) {
  return (
    <figure className="m-0">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge tone="accent">Screen recording</Badge>
        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{title}</span>
        {duration && (
          <span className="mono text-xs" style={{ color: 'var(--text-muted)' }}>{duration}</span>
        )}
      </div>
      <video
        controls
        muted
        playsInline
        preload="none"
        poster={poster}
        style={{
          width: '100%',
          display: 'block',
          borderRadius: 'var(--radius-card)',
          border: 'var(--border-card) solid var(--surface-border)',
          background: 'var(--surface-elevated)',
        }}
      >
        <source src={src} type="video/mp4" />
        Your browser cannot play this recording.
      </video>
      {note && (
        <figcaption className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          {note}
        </figcaption>
      )}
    </figure>
  )
}
