import { Badge, Card, Placeholder, Rich, SectionTitle } from '../components/ui.jsx'
import Simulator from '../components/Simulator.jsx'
import {
  MODEL_ACTIVE_LEARNING,
  MODEL_DATASHEET,
  MODEL_HERO,
  MODEL_NEXT_BLOCK,
  MODEL_REGISTRY,
} from '../content/model.js'

export default function TheModel() {
  return (
    <div className="flex flex-col gap-16">
      <section>
        <Badge tone="accent">06 · The Model</Badge>
        <h1 className="mt-4 text-3xl uppercase md:text-5xl" style={{ fontFamily: 'var(--font-display)', letterSpacing: '2px' }}>
          Simulator, Registry &amp; Active Learning
        </h1>
        <p className="mt-6 max-w-3xl text-lg" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{MODEL_HERO.lead}</Rich>
        </p>
      </section>

      <section>
        <SectionTitle eyebrow="The virtual lab">In-silico synthesis</SectionTitle>
        <Simulator />
      </section>

      <section>
        <SectionTitle eyebrow="Closing the loop">Design tomorrow&rsquo;s 24-well block</SectionTitle>
        <Placeholder source="notebooks/06_...ipynb (section 9)"><Rich>{MODEL_NEXT_BLOCK}</Rich></Placeholder>
      </section>

      <section>
        <SectionTitle eyebrow="Governance">The model registry</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{MODEL_REGISTRY.body}</Rich>
            </p>
          </Card>
          <Card accent>
            <h3 className="text-base">
              <Rich>{MODEL_REGISTRY.dirtyTitle}</Rich>
            </h3>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{MODEL_REGISTRY.dirtyBody}</Rich>
            </p>
          </Card>
        </div>
      </section>

      <section>
        <SectionTitle eyebrow="Feedback">Active learning</SectionTitle>
        <Card>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            <Rich>{MODEL_ACTIVE_LEARNING}</Rich>
          </p>
        </Card>
      </section>

      <section>
        <SectionTitle eyebrow="Deliverable">One-page technical datasheet</SectionTitle>
        <Placeholder source="design_system/templates/, n8n"><Rich>{MODEL_DATASHEET}</Rich></Placeholder>
      </section>
    </div>
  )
}
