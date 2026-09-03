import { Card } from './ui.jsx'
import scorecard from '../data/model_scorecard.json'

/* --------------------------------------------------------------------------
   ModelScorecard — el rendimiento del modelo, en cifras y antes de la prosa.

   Va delante del analisis a proposito. Un lector tecnico quiere el numero
   primero y la explicacion despues; enterrar las metricas al final de una
   pagina de texto obliga a leerlo todo para saber si merece la pena leerlo.

   Se declara tambien el rendimiento del clasificador trivial. Sin esa
   referencia, un F1 de 0,52 no significa nada: podria ser excelente o podria
   ser indistinguible de responder siempre la clase mayoritaria.

   NINGUNA CIFRA DE ESTE FICHERO ESTA ESCRITA A MANO.
   Todas salen de `src/data/model_scorecard.json`, que genera
   `scripts/build_model_scorecard.py` leyendo el registro de modelos de la base
   de datos: que modelo ocupa cada ranura de despliegue y que metricas tiene
   guardadas. Antes estaban escritas aqui dentro, y cuando se entreno el v4
   --que corrige un error de unidades de factor 1000-- esta pagina siguio
   ensenando las cifras del v3 sin que nada fallara. Un numero escrito a mano no
   se entera de que el modelo ha cambiado.

   Lo que si vive aqui son los TEXTOS: rotulos, nombres de clase en ingles y las
   frases de lectura. Eso es contenido, y corregir una frase no deberia obligar
   a tocar Python.

   Todas las cifras salen de la validacion cruzada agrupada por placa del
   cuaderno 06. No son cifras de entrenamiento.
   -------------------------------------------------------------------------- */

const { primary, actionable, baseline } = scorecard

// Como se llama cada metrica en la pagina, y como se lee. El orden es el de la
// tabla; la clave es la de `ml_model_metrics.metric_name`.
const METRICS = [
  {
    key: 'f1_macro',
    label: 'F1 macro',
    reads: 'Mean F1 across the three classes, weighting each equally.',
  },
  {
    key: 'matthews_corrcoef',
    label: 'Matthews correlation',
    reads: 'Correlation between prediction and truth. Zero is chance, whatever the accuracy.',
  },
  {
    key: 'balanced_accuracy',
    label: 'Balanced accuracy',
    reads: 'Mean accuracy within each class.',
  },
]

// El orden de lectura quimico: de menos a mas ordenado. La clave es la etiqueta
// tal y como esta en la base.
const CLASSES = [
  { key: 'AMORFO', label: 'Amorphous', tone: 'amorphous' },
  { key: 'INCIPIENTE', label: 'Incipient', tone: 'incipient' },
  { key: 'CRISTALINO', label: 'Crystalline', tone: 'pure' },
]

const fmt = (v, d = 3) => (v == null ? '—' : v.toFixed(d))
const miles = (n) => n.toLocaleString('en-US')

export default function ModelScorecard() {
  const ds = primary.dataset
  const crystalline = primary.perClass.CRISTALINO

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
            {METRICS.map((m) => (
              <tr key={m.key} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                  {m.label}
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {m.reads}
                  </div>
                </td>
                <td className="mono px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                  {fmt(baseline[m.key], 2)}
                </td>
                <td className="mono px-4 py-3 text-base" style={{ color: 'var(--accent-primary)' }}>
                  {fmt(primary.metrics[m.key]?.value)}
                  {/* La dispersion entre pliegues, cuando se registro: un 0,52 con
                      desviacion 0,04 y un 0,52 con desviacion 0,15 no son el mismo
                      resultado, y sin ella parecen identicos. */}
                  {primary.metrics[m.key]?.std != null && (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {' '}± {fmt(primary.metrics[m.key].std, 3)}
                    </span>
                  )}
                </td>
                <td className="mono px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                  {fmt(actionable.metrics[m.key]?.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Cross-validated with plates as groups, so no plate contributes to both training and test.{' '}
        {miles(ds.nRows)} syntheses across {ds.nGroups} plates;{' '}
        {miles(ds.classDistribution.CRISTALINO)} of them crystalline. Served model{' '}
        <span className="mono">{primary.slug}</span>, {primary.algorithm}.
      </p>

      {/* --- recall por clase, que es donde esta la lectura util --- */}
      <Card>
        <h3 className="text-base">Recall by class — the number that decides whether this is useful</h3>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          A screening tool exists to find the successes. Its aggregate score matters less than how
          reliably it recovers the crystalline class.
        </p>
        <div className="mt-5 flex flex-col gap-4">
          {CLASSES.map((c) => {
            const m = primary.perClass[c.key]
            if (!m) return null
            return (
              <div key={c.key}>
                <div className="flex items-baseline justify-between text-sm">
                  <span style={{ color: 'var(--text-primary)' }}>
                    {c.label}{' '}
                    <span className="mono text-xs" style={{ color: 'var(--text-muted)' }}>
                      n = {miles(m.support)}
                    </span>
                  </span>
                  <span className="mono" style={{ color: `var(--status-${c.tone})` }}>
                    {(m.recall * 100).toFixed(0)}%
                  </span>
                </div>
                <div
                  className="mt-1 h-3 w-full overflow-hidden rounded-sm"
                  style={{ background: 'var(--surface-elevated)', border: '1px solid var(--surface-border)' }}
                >
                  <div
                    style={{ width: `${m.recall * 100}%`, height: '100%', background: `var(--status-${c.tone})` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
        <p className="mt-5 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {(crystalline.recall * 100).toFixed(0)}% of the crystalline syntheses are recovered. For a
          tool whose purpose is to shortlist candidates that is a meaningful limitation, and it is the
          figure to quote rather than the aggregate.
        </p>
      </Card>
    </div>
  )
}
