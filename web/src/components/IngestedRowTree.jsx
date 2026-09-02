import { useState } from 'react'
import { ChevronRight, FileJson, Minimize2, Maximize2 } from 'lucide-react'
import EXAMPLE from '../data/ingested_example.json'
import { Badge } from './ui.jsx'

/* --------------------------------------------------------------------------
   IngestedRowTree — una fila ya ingestada, desplegable.

   La pantalla explica con una tabla que todo fichero acaba en una fila con la
   misma forma. Una tabla de nombres de campo no ensena lo que de verdad
   sorprende al verlo: que de un `.xrdml` salen **44 campos de cabecera** que
   nadie transcribio a mano —voltaje, rendijas, longitudes de onda, marcas de
   tiempo— y que quedan guardados para siempre junto a la curva. Eso solo se ve
   abriendo el arbol.

   Decisiones de dibujo:

   * Los dos nodos que importan —`header_metadata` y `raw_data`— vienen abiertos
     y el resto cerrado. Abrir todo de golpe son cincuenta lineas de JSON que
     nadie lee; cerrarlo todo esconde justo lo que hay que ver.
   * Las curvas se muestran con sus primeros y ultimos valores y una marca de
     cuantos hay en medio. Imprimir 3.580 numeros no informa de nada que no diga
     "3.580".
   * Los valores se tipan por color, como haria un editor: cadena, numero,
     nulo. Es lo que hace que un JSON largo se pueda barrer con la vista.

   Los datos son sinteticos en todo lo que identifica y reales en la estructura
   y en los parametros del instrumento. Lo dice el aviso de arriba, no una nota
   al pie: es la clase de matiz que se lee antes o no se lee.
   -------------------------------------------------------------------------- */

const OPEN_BY_DEFAULT = new Set(['data_json', 'header_metadata', 'raw_data'])

function Value({ v }) {
  if (v === null || v === undefined) {
    return <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>null</span>
  }
  if (typeof v === 'number') {
    return <span style={{ color: 'var(--accent-tertiary)' }}>{v}</span>
  }
  if (typeof v === 'string' && v.startsWith('… ')) {
    return <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{v}</span>
  }
  return <span style={{ color: 'var(--status-pure)' }}>&quot;{String(v)}&quot;</span>
}

function Node({ name, value, depth, openAll }) {
  const isBranch = value !== null && typeof value === 'object'
  const [open, setOpen] = useState(OPEN_BY_DEFAULT.has(name))
  const isOpen = openAll === null ? open : openAll

  if (!isBranch) {
    return (
      <div className="flex flex-wrap gap-x-2 py-[1px]" style={{ paddingLeft: depth * 16 + 18 }}>
        <span style={{ color: 'var(--text-secondary)' }}>{name}:</span>
        <Value v={value} />
      </div>
    )
  }

  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v])
    : Object.entries(value)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1 border-0 bg-transparent py-[1px] text-left"
        style={{ paddingLeft: depth * 16, font: 'inherit', color: 'var(--text-primary)' }}
        aria-expanded={isOpen}
      >
        <ChevronRight
          size={13}
          aria-hidden
          style={{
            color: 'var(--accent-primary)',
            transform: isOpen ? 'rotate(90deg)' : 'none',
            transition: 'transform 120ms',
            flexShrink: 0,
          }}
        />
        <span>{name}</span>
        <span style={{ color: 'var(--text-muted)' }}>
          {Array.isArray(value) ? `[${entries.length}]` : `{${entries.length}}`}
        </span>
      </button>
      {isOpen &&
        entries.map(([k, v]) => (
          <Node key={k} name={k} value={v} depth={depth + 1} openAll={openAll} />
        ))}
    </div>
  )
}

export default function IngestedRowTree() {
  const [openAll, setOpenAll] = useState(null)

  return (
    <figure className="m-0">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone="accent">Synthetic</Badge>
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          One row of <code>characterization_measurements</code>
        </span>
        <span className="mono ml-auto flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>{EXAMPLE.headerFieldCount} header fields</span>
          <span>{EXAMPLE.pointCount.toLocaleString('en-US')} points</span>
          <button
            type="button"
            onClick={() => setOpenAll((v) => (v === true ? null : true))}
            className="inline-flex items-center gap-1 rounded-[var(--radius-badge)] px-2 py-1"
            style={{ border: '2px solid var(--surface-border)', color: 'var(--text-secondary)' }}
          >
            {openAll ? <Minimize2 size={12} aria-hidden /> : <Maximize2 size={12} aria-hidden />}
            {openAll ? 'Collapse' : 'Expand all'}
          </button>
        </span>
      </div>

      <div
        className="mono overflow-auto rounded-[var(--radius-card)] p-4 text-xs"
        style={{
          border: 'var(--border-card) solid var(--surface-border)',
          background: 'var(--chart-bg)',
          maxHeight: 460,
          lineHeight: 1.6,
        }}
      >
        <div className="mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
          <FileJson size={13} aria-hidden />
          {EXAMPLE.row.file_name}
        </div>
        {Object.entries(EXAMPLE.row).map(([k, v]) => (
          <Node key={k} name={k} value={v} depth={0} openAll={openAll} />
        ))}
      </div>

      <figcaption className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        {EXAMPLE.note}
      </figcaption>
    </figure>
  )
}
