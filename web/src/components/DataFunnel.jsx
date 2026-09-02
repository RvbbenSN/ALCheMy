import {
  Atom,
  AudioWaveform,
  ChevronRight,
  Flame,
  FlaskConical,
  Microscope,
  Sparkles,
  Sun,
  Thermometer,
  Waves,
  Wind,
} from 'lucide-react'
import { FUNNEL, FUNNEL_STAGES } from '../content/science.js'
import { Rich } from './ui.jsx'

/* --------------------------------------------------------------------------
   DataFunnel — de izquierda a derecha, como crece y luego se estrecha el
   volumen de datos del laboratorio.

   Por que un embudo y no una lista: el argumento de la pantalla siguiente
   depende de una forma, no de unas cifras. Todo lo que sale del horno recibe un
   difractograma —1.879 de ellos— y a partir de ahi cada tecnica se reserva para
   lo que sobrevivio a la anterior, hasta 36 medidas de estructura. Puesto en
   columna eso son cinco numeros; dibujado, se ve de un vistazo que **el paso
   mas ancho es tambien el mas barato**, que es exactamente por lo que merece la
   pena predecirlo.

   Las alturas se calculan con la raiz cuadrada del recuento, no con el recuento
   en crudo. Con proporcion lineal, 36 frente a 2.167 daria una barra de menos
   de un pixel: cierta, pero ilegible. La raiz conserva el orden y mantiene
   visible la etapa pequena, y el pie de figura dice que la escala no es lineal
   para que nadie mida con una regla.
   -------------------------------------------------------------------------- */

const ICONS = {
  flask: FlaskConical,
  waves: Waves,
  microscope: Microscope,
  wind: Wind,
  thermometer: Thermometer,
  flame: Flame,
  audio: AudioWaveform,
  sparkles: Sparkles,
  atom: Atom,
  sun: Sun,
}

const MIN_H = 44
const MAX_H = 132

export default function DataFunnel() {
  const counts = FUNNEL_STAGES.map((s) => Math.sqrt(s.count))
  const hi = Math.max(...counts)
  const lo = Math.min(...counts)

  return (
    <figure className="m-0">
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max items-stretch gap-0">
          {FUNNEL_STAGES.map((stage, i) => {
            const Icon = ICONS[stage.icon] ?? FlaskConical
            const t = (Math.sqrt(stage.count) - lo) / (hi - lo || 1)
            const h = MIN_H + t * (MAX_H - MIN_H)
            const first = i === 0
            return (
              <div key={stage.key} className="flex items-center">
                <div className="flex w-[168px] flex-col items-center">
                  {/* la barra, alta en proporcion al volumen */}
                  <div className="flex h-[140px] w-full items-center justify-center">
                    <div
                      className="flex w-full flex-col items-center justify-center rounded-[var(--radius-badge)]"
                      style={{
                        height: h,
                        border: `2.5px solid ${first ? 'var(--accent-primary)' : 'var(--surface-border)'}`,
                        background: first ? 'var(--accent-glow)' : 'var(--surface-elevated)',
                      }}
                    >
                      <Icon
                        size={20}
                        aria-hidden
                        style={{ color: first ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
                      />
                      <span
                        className="mt-1 text-lg leading-none"
                        style={{
                          fontFamily: 'var(--font-display)',
                          color: first ? 'var(--accent-primary)' : 'var(--text-primary)',
                        }}
                      >
                        {stage.count.toLocaleString('en-US')}
                      </span>
                    </div>
                  </div>

                  <div
                    className="mt-2 text-center text-xs uppercase tracking-wider"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {stage.label}
                  </div>
                  <p
                    className="mt-1 px-2 text-center text-[11px] leading-snug"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {stage.note}
                  </p>
                </div>

                {i < FUNNEL_STAGES.length - 1 && (
                  <ChevronRight
                    size={18}
                    aria-hidden
                    className="mb-16 shrink-0"
                    style={{ color: 'var(--accent-secondary)' }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <figcaption className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        <Rich>{FUNNEL.footnote}</Rich> Bar heights follow the square root of each count, so the
        smallest stage stays legible; read the numbers, not the heights.
      </figcaption>
    </figure>
  )
}
