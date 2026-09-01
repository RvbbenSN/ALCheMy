import { useState } from 'react'
import { Maximize2, X } from 'lucide-react'

/* --------------------------------------------------------------------------
   NotebookFigure — muestra una figura generada en un cuaderno.

   Las imagenes se extraen del .ipynb sin ejecutarlo
   (scripts/extract_notebook_figures.py): ya estan dentro del fichero como PNG.
   Las que llevaban un codigo de muestra impreso en el titulo se redactan
   despues (scripts/redact_notebook_figures.py), porque ese texto son pixeles y
   el saneado por expresiones regulares no lo alcanza.

   Cada figura se puede ampliar: son graficos densos, con anotaciones que a
   ancho de columna no se leen.
   -------------------------------------------------------------------------- */

export default function NotebookFigure({ src, alt, caption, source, wide = false }) {
  const [zoom, setZoom] = useState(false)

  return (
    <figure className="m-0">
      <div
        className="relative overflow-hidden rounded-[var(--radius-card)]"
        style={{ border: 'var(--border-card) solid var(--surface-border)', background: '#ffffff' }}
      >
        <img
          src={`/figures/${src}`}
          alt={alt}
          loading="lazy"
          style={{ display: 'block', width: '100%', height: 'auto' }}
        />
        <button
          type="button"
          onClick={() => setZoom(true)}
          aria-label="Enlarge figure"
          className="absolute right-2 top-2 flex items-center gap-1.5 rounded-[var(--radius-badge)] px-2 py-1 text-xs"
          style={{
            background: 'var(--surface-elevated)',
            border: '2px solid var(--surface-border)',
            color: 'var(--text-secondary)',
          }}
        >
          <Maximize2 size={13} aria-hidden />
          Enlarge
        </button>
      </div>

      <figcaption className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
        {caption}
        {source && (
          <span className="mono ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            · {source}
          </span>
        )}
      </figcaption>

      {zoom && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onClick={() => setZoom(false)}
          onKeyDown={(e) => e.key === 'Escape' && setZoom(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.82)' }}
        >
          <button
            type="button"
            onClick={() => setZoom(false)}
            aria-label="Close"
            autoFocus
            className="absolute right-4 top-4 flex items-center gap-1.5 rounded-[var(--radius-button)] px-3 py-2 text-sm"
            style={{ background: 'var(--surface-elevated)', border: '2px solid var(--surface-border)', color: 'var(--text-primary)' }}
          >
            <X size={16} aria-hidden />
            Close
          </button>
          <img
            src={`/figures/${src}`}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '96vw',
              maxHeight: '92vh',
              background: '#fff',
              borderRadius: 'var(--radius-card)',
            }}
          />
        </div>
      )}
    </figure>
  )
}
