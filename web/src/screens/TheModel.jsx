import { useBundle } from '../i18n/LocaleContext.jsx'
import { Badge, Card, Note, Rich, ScrollTable, SectionTitle } from '../components/ui.jsx'
import Simulator from '../components/Simulator.jsx'
import KnowledgeMap from '../components/KnowledgeMap.jsx'
import KMAP from '../data/knowledge_map.json'
import SCORECARD from '../data/model_scorecard.json'
import * as SITE_EN from '../content/site.js'
import * as SITE_ES from '../content/es/site.js'
import * as MODEL_EN from '../content/model.js'
import * as MODEL_ES from '../content/es/model.js'

export default function TheModel() {
  const { MODEL_NOTES } = useBundle(SITE_EN, SITE_ES)
  const { MODEL_HERO, MODEL_LOOP, MODEL_REGISTRY } = useBundle(MODEL_EN, MODEL_ES)

  return (
    <div className="flex flex-col gap-16">
      <section>
        <Badge tone="accent">06 · The Model</Badge>
        <h1
          className="mt-4 text-3xl uppercase md:text-5xl"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '2px' }}
        >
          Simulator, Registry & Active Learning
        </h1>
        <p className="mt-6 max-w-3xl text-lg" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{MODEL_HERO.lead}</Rich>
        </p>
      </section>

      {/* --- El simulador --- */}
      <section>
        <SectionTitle eyebrow="The virtual lab">In-silico synthesis</SectionTitle>
        <Simulator />
      </section>

      {/* --- Como se guarda un modelo --- */}
      <section>
        <SectionTitle eyebrow="Governance">{MODEL_REGISTRY.title}</SectionTitle>
        <p className="mb-3 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{MODEL_REGISTRY.lead}</Rich>
        </p>
        <p className="mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{MODEL_REGISTRY.ruling}</Rich>
        </p>

        {/* Las cinco tablas, en cadena: cada una responde a una pregunta. */}
        <ol className="flex list-none flex-col gap-3 p-0">
          {MODEL_REGISTRY.tables.map((t, i) => (
            <li key={t.name}>
              <Card>
                <div className="flex flex-wrap items-baseline gap-3">
                  <span
                    aria-hidden
                    className="flex items-center justify-center rounded-full text-xs"
                    style={{
                      width: 26,
                      height: 26,
                      border: '2px solid var(--accent-primary)',
                      color: 'var(--accent-primary)',
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </span>
                  <code style={{ color: 'var(--accent-primary)' }}>{t.name}</code>
                  <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                    {t.head}
                  </span>
                </div>
                <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <Rich>{t.body}</Rich>
                </p>
              </Card>
            </li>
          ))}
        </ol>

        <Note>
          <Rich>{MODEL_REGISTRY.slot}</Rich>
        </Note>
      </section>

      {/* --- El registro, con lo que hay dentro. Venia de la 05, que iba
              sobrecargada, y encaja mejor aqui: esta pantalla habla de lo que
              se despliega, no de lo que se entrena. --- */}
      <section>
        <SectionTitle eyebrow="The registry">What was trained, and what survived</SectionTitle>
        <ScrollTable
          head={['Model', 'Algorithm', 'F1 macro', 'Size', 'Status']}
          rows={SCORECARD.registry.map((m) => [
            <span key={m.name}>
              <code>
                <Rich>{m.name}</Rich>
              </code>
              <br />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>
                <Rich>{MODEL_NOTES[m.name] || m.note}</Rich>
              </span>
            </span>,
            m.algo,
            m.f1,
            m.size,
            // Tres estados, tres lecturas: vigente, retirado por otro mejor, y
            // "no use estos resultados".
            <Badge key="s" tone={{ ACTIVE: 'pure', INVALID: 'amorphous' }[m.status] ?? 'neutral'}>
              <Rich>{m.status}</Rich>
            </Badge>,
          ])}
        />
      </section>

      {/* --- El bucle, y el mapa --- */}
      <section>
        <SectionTitle eyebrow="Feedback">{MODEL_LOOP.title}</SectionTitle>
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <Card accent>
            <h3 className="text-base">The map in the dark</h3>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{MODEL_LOOP.metaphor}</Rich>
            </p>
          </Card>
          <Card>
            <h3 className="text-base">Where it points</h3>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{MODEL_LOOP.method}</Rich>
            </p>
          </Card>
        </div>

        <KnowledgeMap />

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card>
            <h3 className="text-base">What the map actually says</h3>
            <ul className="mt-3 flex list-none flex-col gap-2 p-0 text-sm">
              {/* La cifra se lee del propio mapa: escribirla a mano fue un error
                  una vez ya, contando veredictos en vez de casillas. */}
              <li style={{ borderLeft: '2px solid var(--accent-primary)', paddingLeft: '0.75rem', color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {KMAP.coverage.tried} of {KMAP.coverage.total} cells have been run
                </strong>{' '}
                — and that is for {KMAP.metal}, the metal with the most history behind it
                ({KMAP.nSyntheses} syntheses).
              </li>
              {MODEL_LOOP.readingPoints.map((p, i) => (
                <li key={i} style={{ borderLeft: '2px solid var(--accent-primary)', paddingLeft: '0.75rem', color: 'var(--text-secondary)' }}>
                  <Rich>{p}</Rich>
                </li>
              ))}
            </ul>
          </Card>
          <Card accent>
            <h3 className="text-base">And it agrees with the diagnosis</h3>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{MODEL_LOOP.consequence}</Rich>
            </p>
          </Card>
        </div>
      </section>
    </div>
  )
}
