import {
  Aperture,
  AudioWaveform,
  ChevronRight,
  Database,
  Flame,
  FlaskConical,
  Gem,
  Microscope,
  Sun,
  Thermometer,
  Waves,
  Wind,
} from 'lucide-react'
import { DATA_SCALE, SYNTHESIS_NODE, TECHNIQUE_COUNTS } from '../content/science.js'
import { Rich } from './ui.jsx'

/* --------------------------------------------------------------------------
   DataScale — cuanto dato produce el laboratorio, y donde acaba.

   Sustituye a un embudo que dibujaba una mentira. Un embudo se lee como una
   secuencia —esta tecnica, luego esta otra, luego esta— y en el laboratorio no
   ocurre asi: solo el difractograma es rutinario, y el resto de tecnicas se
   piden cuando hay una pregunta concreta que responder, en el orden en que esa
   pregunta surge, y para la mayoria de muestras nunca.

   Lo que la figura si puede afirmar es un recuento. De izquierda a derecha:

       (sintesis)  ->  { nueve tecnicas, sin orden entre ellas }  ->  (base de datos)

   El corchete es deliberado: agrupa sin ordenar. Los circulos de dentro no van
   encadenados por flechas porque no se suceden, solo comparten origen y
   destino.

   El total de medidas va encima del icono de la base de datos y no en una
   columna propia: es el mismo dato —lo que el corchete recoge es exactamente lo
   que la base de datos guarda— y asi la figura ocupa una columna menos de
   ancho, que es lo que la hacia desbordar en pantallas estrechas.

   El diametro va con la raiz cuadrada del recuento. En proporcion lineal,
   SC-XRD (10) frente a PXRD (1.879) daria un circulo invisible; con la raiz se
   conserva el orden de magnitud y la etiqueta sigue siendo legible. El pie lo
   advierte, para que nadie mida areas con una regla.
   -------------------------------------------------------------------------- */

const ICONS = {
  flask: FlaskConical,
  waves: Waves,
  microscope: Microscope,
  aperture: Aperture,
  audio: AudioWaveform,
  wind: Wind,
  sun: Sun,
  flame: Flame,
  thermometer: Thermometer,
  gem: Gem,
}

const MIN_D = 62
const MAX_D = 108

/* Llave tipografica dibujada como trazo, para que estire a lo alto sin que el
   grosor cambie con ella. */
function Brace({ side }) {
  const d =
    side === 'left'
      ? 'M17,1 C7,1 12,44 2,50 C12,56 7,99 17,99'
      : 'M3,1 C13,1 8,44 18,50 C8,56 13,99 3,99'
  return (
    <svg
      viewBox="0 0 20 100"
      preserveAspectRatio="none"
      aria-hidden
      style={{ width: 18, alignSelf: 'stretch', flexShrink: 0 }}
    >
      <path
        d={d}
        fill="none"
        stroke="var(--accent-secondary)"
        strokeWidth={2.5}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function Node({ icon, count, label, note, primary }) {
  const Icon = ICONS[icon] ?? FlaskConical
  /* La columna tiene que ser mas ancha que el circulo. Con 112 px el circulo
     de origen (130 px) se desbordaba, y al ser el primer elemento de un
     contenedor con desplazamiento horizontal lo que sobraba quedaba recortado
     por la izquierda. */
  return (
    <div className={`flex ${primary ? 'w-[150px]' : 'w-[112px]'} shrink-0 flex-col items-center`}>
      <div
        className="flex flex-col items-center justify-center rounded-full"
        style={{
          width: primary ? MAX_D + 22 : undefined,
          height: primary ? MAX_D + 22 : undefined,
          border: `2.5px solid ${primary ? 'var(--accent-primary)' : 'var(--surface-border)'}`,
          background: primary ? 'var(--accent-glow)' : 'var(--surface-elevated)',
        }}
      >
        <Icon
          size={primary ? 22 : 18}
          aria-hidden
          style={{ color: primary ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
        />
        <span
          className="mt-0.5 leading-none"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: primary ? 20 : 15,
            color: primary ? 'var(--accent-primary)' : 'var(--text-primary)',
          }}
        >
          {count.toLocaleString('en-US')}
        </span>
      </div>
      <div
        className="mt-2 text-center text-xs uppercase tracking-wider"
        style={{ color: 'var(--text-primary)' }}
      >
        {label}
      </div>
      {note && (
        <p className="mt-0.5 px-1 text-center text-[11px] leading-snug" style={{ color: 'var(--text-muted)' }}>
          {note}
        </p>
      )}
    </div>
  )
}

export default function DataScale() {
  const roots = TECHNIQUE_COUNTS.map((t) => Math.sqrt(t.count))
  const hi = Math.max(...roots)
  const lo = Math.min(...roots)
  const total = TECHNIQUE_COUNTS.reduce((a, t) => a + t.count, 0)

  return (
    <figure className="m-0">
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max items-center gap-3">
          {/* --- origen --- */}
          <Node {...SYNTHESIS_NODE} primary />

          <ChevronRight size={20} aria-hidden className="mb-10 shrink-0" style={{ color: 'var(--accent-secondary)' }} />

          {/* --- las nueve tecnicas, agrupadas y sin orden entre si --- */}
          <div className="flex items-stretch gap-2">
            <Brace side="left" />
            <div className="grid grid-cols-5 gap-x-1 gap-y-4 py-2">
              {TECHNIQUE_COUNTS.map((t) => {
                const k = (Math.sqrt(t.count) - lo) / (hi - lo || 1)
                const d = MIN_D + k * (MAX_D - MIN_D)
                const Icon = ICONS[t.icon] ?? Waves
                return (
                  <div key={t.key} className="flex w-[112px] flex-col items-center">
                    <div className="flex h-[112px] items-center justify-center">
                      <div
                        className="flex flex-col items-center justify-center rounded-full"
                        style={{
                          width: d,
                          height: d,
                          border: '2.5px solid var(--surface-border)',
                          background: 'var(--surface-elevated)',
                        }}
                      >
                        <Icon size={17} aria-hidden style={{ color: 'var(--text-secondary)' }} />
                        <span
                          className="mt-0.5 leading-none"
                          style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--text-primary)' }}
                        >
                          {t.count.toLocaleString('en-US')}
                        </span>
                      </div>
                    </div>
                    <div className="text-center text-xs uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                      {t.label}
                    </div>
                    <p className="mt-0.5 px-1 text-center text-[11px] leading-snug" style={{ color: 'var(--text-muted)' }}>
                      {t.note}
                    </p>
                  </div>
                )
              })}
            </div>
            <Brace side="right" />
          </div>

          <ChevronRight size={20} aria-hidden className="mb-10 shrink-0" style={{ color: 'var(--accent-secondary)' }} />

          {/* --- destino, con el total del corchete justo encima --- */}
          <div className="flex w-[150px] shrink-0 flex-col items-center">
            <div className="mb-1 text-center">
              <div
                className="leading-none"
                style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--accent-secondary-text)' }}
              >
                {total.toLocaleString('en-US')}
              </div>
              <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {DATA_SCALE.bracketLabel}
              </div>
            </div>
            <div
              className="flex items-center justify-center rounded-[var(--radius-card)]"
              style={{
                width: 108,
                height: 108,
                border: '2.5px solid var(--accent-primary)',
                background: 'var(--accent-glow)',
              }}
            >
              <Database size={34} aria-hidden style={{ color: 'var(--accent-primary)' }} />
            </div>
            <div
              className="mt-2 text-center text-xs uppercase tracking-wider"
              style={{ color: 'var(--accent-primary)' }}
            >
              {DATA_SCALE.databaseLabel}
            </div>
            <p className="mt-0.5 text-center text-[11px] leading-snug" style={{ color: 'var(--text-muted)' }}>
              {DATA_SCALE.databaseNote}
            </p>
          </div>
        </div>
      </div>

      <figcaption className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        <Rich>{DATA_SCALE.footnote}</Rich>
      </figcaption>
    </figure>
  )
}
