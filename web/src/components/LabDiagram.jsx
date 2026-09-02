/* --------------------------------------------------------------------------
   LabDiagram — los cuatro pasos de una semana en el laboratorio, dibujados.

   Una sola pieza SVG con cuatro grupos, uno por paso, de izquierda a derecha y
   unidos por flechas. El grupo del paso activo va a plena opacidad y con trazo
   de acento; los otros tres se atenuan. Pulsar un panel hace lo mismo que
   pulsar su numero en la lista de al lado — los dos gestos comparten `active` y
   `onPick`, asi que la figura siempre tiene exactamente un paso resaltado.

   Es esquematico a proposito: siluetas de una linea, sin sombras ni texturas.
     1 · el bloque multireactor de 24 pocillos, evocado, no calcado de la foto
     2 · embudo Buchner con su papel de filtro y un kitasato
     3 · un autoclave solvotermal
     4 · los tres campos de aplicacion como glifos (H2, aguas, CO2)
   -------------------------------------------------------------------------- */

const PANEL_W = 150
const GAP = 30
const VIEW_H = 150
const TOTAL_W = PANEL_W * 4 + GAP * 3

function Arrow({ x }) {
  return (
    <path
      d={`M${x},${VIEW_H / 2 - 6} l10,6 l-10,6`}
      fill="none"
      stroke="var(--accent-secondary)"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
}

function groupProps(on) {
  return {
    stroke: on ? 'var(--accent-primary)' : 'var(--text-muted)',
    opacity: on ? 1 : 0.38,
    fill: 'none',
    strokeLinejoin: 'round',
    strokeLinecap: 'round',
  }
}

/* --- Paso 1: bloque multireactor de alto rendimiento --------------------- */
function PlateGlyph() {
  return (
    <>
      <path d="M12,96 L104,74 L136,90 L44,112 Z" fill="var(--surface-elevated)" strokeWidth={2} />
      {Array.from({ length: 4 }).map((_, r) =>
        Array.from({ length: 6 }).map((_, c) => (
          <ellipse
            key={`${r}-${c}`}
            cx={30 + c * 14 + r * 6}
            cy={97 - c * 3.1 + r * 4.2}
            rx={3.6}
            ry={2.2}
            strokeWidth={1.3}
          />
        )),
      )}
      <rect x="8" y="70" width="8" height="30" rx="3" strokeWidth={2} />
      <rect x="118" y="60" width="8" height="30" rx="3" strokeWidth={2} />
    </>
  )
}

/* --- Paso 2: filtracion, embudo Buchner + papel + kitasato -------------- */
function FilterGlyph() {
  return (
    <>
      <ellipse cx="75" cy="33" rx="30" ry="7" fill="var(--surface-elevated)" strokeWidth={1.6} />
      <path d="M45,33 L105,33 L88,62 L84,84 L66,84 L62,62 Z" strokeWidth={2} />
      <path d="M58,90 L92,90 L112,136 Q75,148 38,136 Z" fill="var(--surface-elevated)" strokeWidth={2} />
      <path d="M92,98 L118,94" strokeWidth={2} />
      <path d="M64,112 q11,6 22,0" strokeWidth={1.3} />
    </>
  )
}

/* --- Paso 3: autoclave solvotermal ------------------------------------ */
function ReactorGlyph() {
  return (
    <>
      <rect x="52" y="18" width="46" height="16" rx="3" strokeWidth={2} />
      <path d="M60,18 v16 M68,18 v16 M76,18 v16 M84,18 v16 M92,18 v16" strokeWidth={1} />
      <path d="M46,34 L104,34 L104,118 Q75,130 46,118 Z" fill="var(--surface-elevated)" strokeWidth={2} />
      <path d="M58,42 L92,42 L92,106 Q75,114 58,106 Z" strokeWidth={1.4} />
      <path d="M60,86 Q75,92 90,86" strokeWidth={1.4} strokeDasharray="3 3" />
    </>
  )
}

/* --- Paso 4: aplicacion en varios campos ---------------------------- */
function ApplyGlyph() {
  return (
    <>
      {/* fotocatalisis */}
      <circle cx="28" cy="46" r="9" strokeWidth={2} />
      <path
        d="M28,31 v-6 M28,61 v6 M13,46 h-6 M43,46 h6 M17,35 l-4,-4 M39,57 l4,4 M39,35 l4,-4 M17,57 l-4,4"
        strokeWidth={1.6}
      />
      <text x="28" y="88" textAnchor="middle" fontSize="12" fill="currentColor" stroke="none" fontFamily="var(--font-mono)">
        H₂
      </text>
      {/* aguas residuales */}
      <path d="M75,30 Q88,50 75,62 Q62,50 75,30 Z" strokeWidth={2} />
      <path d="M69,50 q6,6 12,0" strokeWidth={1.3} />
      <text x="75" y="88" textAnchor="middle" fontSize="10" fill="currentColor" stroke="none" fontFamily="var(--font-mono)">
        H₂O
      </text>
      {/* valorizacion de CO2 */}
      <circle cx="110" cy="46" r="5.5" strokeWidth={1.8} />
      <circle cx="124" cy="46" r="7.5" strokeWidth={1.8} />
      <circle cx="138" cy="46" r="5.5" strokeWidth={1.8} />
      <text x="124" y="88" textAnchor="middle" fontSize="12" fill="currentColor" stroke="none" fontFamily="var(--font-mono)">
        CO₂
      </text>
    </>
  )
}

const GLYPHS = [PlateGlyph, FilterGlyph, ReactorGlyph, ApplyGlyph]

export default function LabDiagram({ active, onPick, steps }) {
  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${TOTAL_W} ${VIEW_H + 26}`}
        role="group"
        aria-label="Schematic of the four weekly lab steps"
        style={{ width: '100%', minWidth: 480, maxWidth: TOTAL_W, height: 'auto' }}
      >
        {GLYPHS.map((Glyph, i) => {
          const n = String(i + 1)
          const on = active === n
          const ox = i * (PANEL_W + GAP)
          return (
            <g key={n}>
              {i > 0 && <Arrow x={ox - GAP + 8} />}
              <g transform={`translate(${ox},0)`} onClick={() => onPick(n)} style={{ cursor: 'pointer' }}>
                <rect
                  x="0"
                  y="0"
                  width={PANEL_W}
                  height={VIEW_H}
                  rx="12"
                  fill={on ? 'var(--accent-glow)' : 'transparent'}
                  stroke={on ? 'var(--accent-primary)' : 'var(--surface-border)'}
                  strokeWidth={on ? 2 : 1}
                />
                <g {...groupProps(on)}>
                  <Glyph />
                </g>
                <text
                  x="12"
                  y={VIEW_H + 18}
                  fontSize="12"
                  fontFamily="var(--font-display)"
                  fill={on ? 'var(--accent-primary)' : 'var(--text-muted)'}
                  stroke="none"
                >
                  {n} · {(steps[i]?.short ?? '').toUpperCase()}
                </text>
              </g>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
