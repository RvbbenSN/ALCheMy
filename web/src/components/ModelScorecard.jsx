import { Card } from './ui.jsx'

/* --------------------------------------------------------------------------
   ModelScorecard — el rendimiento del modelo, en cifras y antes de la prosa.

   Va delante del analisis a proposito. Un lector tecnico quiere el numero
   primero y la explicacion despues; enterrar las metricas al final de una
   pagina de texto obliga a leerlo todo para saber si merece la pena leerlo.

   Se declara tambien el rendimiento del clasificador trivial. Sin esa
   referencia, un F1 de 0,52 no significa nada: podria ser excelente o podria
   ser indistinguible de responder siempre la clase mayoritaria.

   Todas las cifras salen de la validacion cruzada agrupada por placa del
   cuaderno 06. No son cifras de entrenamiento.
   -------------------------------------------------------------------------- */

const HEADLINE = [
  {
    metric: 'F1 macro',
    baseline: '0.26',
    full: '0.522',
    actionable: '0.413',
    reads: 'Mean F1 across the three classes, weighting each equally.',
  },
  {
    metric: 'Matthews correlation',
    baseline: '0.00',
    full: '0.31',
    actionable: '0.13',
    reads: 'Correlation between prediction and truth. Zero is chance, whatever the accuracy.',
  },
  {
    metric: 'Balanced accuracy',
    baseline: '0.33',
    full: '0.57',
    actionable: '—',
    reads: 'Mean accuracy within each class.',
  },
]

const RECALL = [
  { klass: 'Amorphous', tone: 'amorphous', value: 0.5, n: 101 },
  { klass: 'Incipient', tone: 'incipient', value: 0.71, n: 229 },
  { klass: 'Crystalline', tone: 'pure', value: 0.5, n: 32 },
]

export default function ModelScorecard() {
  return (
    <div className="flex flex-col gap-4">
      {/* --- las tres cifras de cabecera --- */}
      <div
        className="overflow-x-auto rounded-[var(--radius-card)]"
        style={{ border: 'var(--border-card) solid var(--surface-border)' }}
      >
        <table className="w-full border-collapse text-sm" style={{ minWidth: '600px' }}>
          <thead>
            <tr style={{ background: 'var(--surface-elevated)' }}>
              {['Metric', 'Trivial baseline', 'Full model', 'Actionable model'].map((h) => (
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
            {HEADLINE.map((r) => (
              <tr key={r.metric} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                  {r.metric}
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {r.reads}
                  </div>
                </td>
                <td className="mono px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                  {r.baseline}
                </td>
                <td className="mono px-4 py-3 text-base" style={{ color: 'var(--accent-primary)' }}>
                  {r.full}
                </td>
                <td className="mono px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                  {r.actionable}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Cross-validated with plates as groups, so no plate contributes to both training and test. 1,516
        syntheses across 68 plates; 167 of them crystalline.
      </p>

      {/* --- recall por clase, que es donde esta la lectura util --- */}
      <Card>
        <h3 className="text-base">Recall by class — the number that decides whether this is useful</h3>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          A screening tool exists to find the successes. Its aggregate score matters less than how
          reliably it recovers the crystalline class.
        </p>
        <div className="mt-5 flex flex-col gap-4">
          {RECALL.map((r) => (
            <div key={r.klass}>
              <div className="flex items-baseline justify-between text-sm">
                <span style={{ color: 'var(--text-primary)' }}>
                  {r.klass}{' '}
                  <span className="mono text-xs" style={{ color: 'var(--text-muted)' }}>
                    n = {r.n}
                  </span>
                </span>
                <span className="mono" style={{ color: `var(--status-${r.tone})` }}>
                  {(r.value * 100).toFixed(0)}%
                </span>
              </div>
              <div
                className="mt-1 h-3 w-full overflow-hidden rounded-sm"
                style={{ background: 'var(--surface-elevated)', border: '1px solid var(--surface-border)' }}
              >
                <div
                  style={{ width: `${r.value * 100}%`, height: '100%', background: `var(--status-${r.tone})` }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-5 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Half of the crystalline syntheses are recovered. For a tool whose purpose is to shortlist
          candidates that is a meaningful limitation, and it is the figure to quote rather than the
          aggregate.
        </p>
      </Card>
    </div>
  )
}
