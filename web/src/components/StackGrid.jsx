import STACK from '../data/stack_icons.json'

/* --------------------------------------------------------------------------
   StackGrid — el stack tecnologico con logotipo y nombre debajo.

   Los logotipos salen de simple-icons, extraidos en desarrollo a un JSON
   (web/scripts/build_stack_icons.mjs). La aplicacion no depende del paquete en
   ejecucion: son 3.457 iconos y aqui se usan quince.

   Se pintan con el color del tema, no con el color corporativo de cada marca.
   Veintidos colores distintos sobre una paleta champan serian un arcoiris y el
   conjunto dejaria de leerse como un sistema. Lo que no tiene logotipo —SQL,
   pgAdmin, Seaborn, VS Code, Antigravity, Slack— va como etiqueta de texto en
   vez de inventarle una marca.
   -------------------------------------------------------------------------- */

export default function StackGrid() {
  const { rows, items } = STACK
  const groups = []
  let i = 0
  for (const n of rows) {
    groups.push(items.slice(i, i + n))
    i += n
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group, gi) => (
        <div key={gi} className="flex flex-wrap gap-x-6 gap-y-5">
          {group.map((it) => (
            <div key={it.label} className="flex w-16 flex-col items-center gap-2 text-center">
              {it.path ? (
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden
                  style={{ width: 30, height: 30, fill: 'var(--accent-primary)', flexShrink: 0 }}
                >
                  <path d={it.path} />
                </svg>
              ) : it.mask ? (
                /* Marca sin SVG monocromo disponible: se usa el PNG como
                   mascara, asi que hereda el color del tema igual que el resto. */
                <span
                  aria-hidden
                  style={{
                    width: 30,
                    height: 30,
                    flexShrink: 0,
                    backgroundColor: 'var(--accent-primary)',
                    WebkitMaskImage: `url(/logos/${it.mask})`,
                    maskImage: `url(/logos/${it.mask})`,
                    WebkitMaskSize: 'contain',
                    maskSize: 'contain',
                    WebkitMaskRepeat: 'no-repeat',
                    maskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                    maskPosition: 'center',
                  }}
                />
              ) : (
                <span
                  aria-hidden
                  className="flex items-center justify-center rounded-[var(--radius-badge)]"
                  style={{
                    width: 30,
                    height: 30,
                    border: '2px solid var(--surface-border)',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                  }}
                >
                  {it.label.slice(0, 2)}
                </span>
              )}
              <span
                className="text-[11px] leading-tight"
                style={{ color: 'var(--text-secondary)' }}
              >
                {it.label}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
