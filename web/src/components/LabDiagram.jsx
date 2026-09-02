import { ChevronRight } from 'lucide-react'
import filtrationSvg from '../assets/filtration_kitasato.svg?raw'
import reactorSvg from '../assets/ST.svg?raw'
import applySvg from '../assets/apply_it.svg?raw'

/* --------------------------------------------------------------------------
   LabDiagram — los cuatro pasos de una semana en el laboratorio.

   Los dibujos los hizo Ruben; aqui solo se colocan y se sincronizan. Tres son
   SVG y entran con `?raw` para inyectarlos en linea en vez de por `<img>`: un
   SVG cargado como imagen queda aislado y sus `var(--...)` no ven los tokens de
   la pagina, asi que se quedaria con los colores del tema claro sobre un fondo
   oscuro. Inyectado en linea si los hereda, y el mismo dibujo sirve para los
   tres temas.

   El primero es un render con dos versiones ya preparadas —clara y oscura— asi
   que se pintan las dos y CSS oculta la que no toca (`.art-light` / `.art-dark`
   en global.css). Es la unica forma de cambiar un PNG con el tema sin duplicar
   estado de React.

   Pulsar un panel hace lo mismo que pulsar su numero en la lista: los dos
   gestos comparten `active` y `onPick`, asi que siempre hay exactamente un paso
   resaltado.
   -------------------------------------------------------------------------- */

const ART = [
  { kind: 'img', light: '/diagrams/HTS_light.png', dark: '/diagrams/HTS_dark.png',
    alt: 'Two stacked 24-well multi-autoclave blocks with their brass posts' },
  { kind: 'svg', markup: filtrationSvg },
  { kind: 'svg', markup: reactorSvg },
  { kind: 'svg', markup: applySvg },
]

function Art({ art }) {
  if (art.kind === 'img') {
    return (
      <>
        <img className="art-light" src={art.light} alt={art.alt} loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        <img className="art-dark" src={art.dark} alt="" aria-hidden loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </>
    )
  }
  return (
    <div
      aria-hidden
      style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      dangerouslySetInnerHTML={{ __html: art.markup }}
    />
  )
}

export default function LabDiagram({ active, onPick, steps }) {
  return (
    <figure className="m-0">
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max items-stretch gap-1">
          {steps.map((s, i) => {
            const on = active === s.step
            return (
              <div key={s.step} className="flex items-center">
                <button
                  type="button"
                  onClick={() => onPick(s.step)}
                  aria-pressed={on}
                  aria-label={`Step ${s.step}: ${s.title}`}
                  className="flex w-[172px] shrink-0 flex-col items-center gap-2 rounded-[var(--radius-card)] p-3"
                  style={{
                    border: `2px solid ${on ? 'var(--accent-primary)' : 'var(--surface-border)'}`,
                    background: on ? 'var(--accent-glow)' : 'transparent',
                    opacity: on ? 1 : 0.55,
                    transition: 'opacity 150ms',
                  }}
                >
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full text-sm"
                    style={{
                      border: `2px solid ${on ? 'var(--accent-primary)' : 'var(--surface-border)'}`,
                      background: on ? 'var(--accent-primary)' : 'transparent',
                      color: on ? 'var(--surface)' : 'var(--text-muted)',
                      fontFamily: 'var(--font-display)',
                    }}
                  >
                    {s.step}
                  </span>
                  <span style={{ width: '100%', height: 132, display: 'block' }}>
                    <Art art={ART[i]} />
                  </span>
                  <span
                    className="text-center text-[11px] uppercase tracking-wider"
                    style={{ color: on ? 'var(--accent-primary)' : 'var(--text-muted)' }}
                  >
                    {s.short}
                  </span>
                </button>
                {i < steps.length - 1 && (
                  <ChevronRight size={18} aria-hidden className="shrink-0" style={{ color: 'var(--accent-secondary)' }} />
                )}
              </div>
            )
          })}
        </div>
      </div>
      <figcaption className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        Pick a panel or a number to read that step.
      </figcaption>
    </figure>
  )
}
