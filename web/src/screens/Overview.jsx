import { Link } from 'react-router-dom'
import {
  Atom,
  BarChart3,
  Bot,
  Compass,
  Database,
  FlaskConical,
  LineChart,
  Microscope,
  UserRound,
} from 'lucide-react'
/* El contenido se lee por paquete, no por import suelto: `useBundle` devuelve
   el modulo espanol cuando la ruta va bajo /es, y cae al ingles export por
   export para lo que aun no este traducido. Ver src/i18n/LocaleContext.jsx. */
import * as SITE_EN from '../content/site.js'
import * as SITE_ES from '../content/es/site.js'
import { useBundle } from '../i18n/LocaleContext.jsx'
import * as UI_EN from '../content/ui.js'
import * as UI_ES from '../content/es/ui.js'
import { Button, Card, KpiCard, Rich, SectionTitle, Term } from '../components/ui.jsx'
import StackGrid from '../components/StackGrid.jsx'

/* Un icono por pestana. Representan la fase, no la decoran: una brujula para
   el planteamiento, una base de datos para la recoleccion, un matraz para la
   preparacion, y asi. */
const SCREEN_ICON = {
  '00': Compass,
  '01': Atom,
  '02': Database,
  '03': FlaskConical,
  '04': BarChart3,
  '05': LineChart,
  '06': Microscope,
  '07': Bot,
  '08': Database,
  '09': UserRound,
}

export default function Overview() {
  const { UI } = useBundle(UI_EN, UI_ES)
  const { BIO_PULLQUOTE, BIO_SHORT, KPIS, OVERVIEW_HERO, PILLARS, PILLARS_INTRO, SCREENS } =
    useBundle(SITE_EN, SITE_ES)

  return (
    <div className="flex flex-col gap-16">
      {/* --- Hero --- */}
      <section>
        {/* Lockup completo: el cristal con el nombre debajo, igual que en el pie.
            En la barra superior se usa solo el isotipo, que es donde encaja. */}
        <span
          className="logo-lockup mb-8 block"
          role="img"
          aria-label="ALCheMy"
          style={{
            width: 'clamp(190px, 26vw, 280px)',
            height: 'clamp(104px, 14vw, 153px)',
            color: 'var(--accent-primary)',
          }}
        />
        <h1
          className="max-w-4xl text-4xl uppercase md:text-6xl"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '2.5px' }}
        >{UI.overview.augmentedLaboratoryForChemistry}</h1>
        <p className="mt-6 max-w-3xl text-lg" style={{ color: 'var(--text-secondary)' }}>
          {OVERVIEW_HERO.leadBefore} <Term k="MLOps" />
          {OVERVIEW_HERO.leadAfter}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button href="/the-model">{OVERVIEW_HERO.ctaPrimary}</Button>
          <Button href="/data-collection" variant="secondary">
            {OVERVIEW_HERO.ctaSecondary}
          </Button>
        </div>
      </section>

      {/* --- KPIs --- */}
      <section>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {KPIS.map((k) => (
            <KpiCard key={k.label} {...k} />
          ))}
        </div>
        <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          {OVERVIEW_HERO.kpiFootnote}
        </p>
      </section>

      {/* --- Tres pilares --- */}
      <section>
        <SectionTitle eyebrow={UI.overview.threeSynchronizedPillars.eyebrow}>{UI.overview.threeSynchronizedPillars.title}</SectionTitle>
        <p className="mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{PILLARS_INTRO}</Rich>
        </p>
        <div className="grid gap-6 lg:grid-cols-3">
          {PILLARS.map((p) => (
            <Card key={p.key} accent>
              <h3 className="text-lg"><Rich>{p.title}</Rich></h3>
              <p className="mt-1 text-sm" style={{ color: 'var(--accent-secondary-text)' }}>
                <Rich>{p.subtitle}</Rich>
              </p>
              <ul className="mt-4 flex list-none flex-col gap-3 p-0 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {p.points.map((pt, i) => (
                  <li key={i} style={{ borderLeft: '2px solid var(--surface-border)', paddingLeft: '0.75rem' }}>
                    <Rich>{pt}</Rich>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      {/* --- Mapa CRISP-DM --- */}
      <section>
        {/* El titulo lleva un <Term> dentro, asi que va partido en dos claves:
            una cadena con JSX incrustado se pintaria literal. */}
        <SectionTitle eyebrow={UI.overview.theTabsFollowTerm.eyebrow}>
          {UI.overview.theTabsFollowTerm.titleBefore} <Term k="CRISP-DM" />{' '}
          {UI.overview.theTabsFollowTerm.titleAfter}
        </SectionTitle>
        <p className="mb-6 max-w-3xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          {OVERVIEW_HERO.crispBody}
        </p>
        <ol className="grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {SCREENS.map((s) => {
            const Icon = SCREEN_ICON[s.id] || Compass
            return (
              <li key={s.id}>
                <Link to={`/${s.slug}`} className="block no-underline">
                  <Card className="h-full transition-transform hover:-translate-y-1">
                    <div className="flex items-start gap-3">
                      <Icon size={22} aria-hidden style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: 2 }} />
                      <div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {s.id} · {s.crisp}
                        </div>
                        <div
                          className="mt-1 text-base"
                          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
                        >
                          <Rich>{s.title}</Rich>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              </li>
            )
          })}
        </ol>
      </section>

      {/* --- Bio corta --- */}
      <section>
        <SectionTitle eyebrow={UI.overview.aboutTheAuthor.eyebrow}>{UI.overview.aboutTheAuthor.title}</SectionTitle>
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card>
            {BIO_SHORT.map((p, i) => (
              <p key={i} className={i ? 'mt-4' : ''} style={{ color: 'var(--text-secondary)' }}>
                <Rich>{p}</Rich>
              </p>
            ))}
            <blockquote
              className="mt-6 p-4 text-lg italic"
              style={{
                borderLeft: '4px solid var(--accent-primary)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-heading)',
              }}
            >
              <Rich>{BIO_PULLQUOTE}</Rich>
            </blockquote>
            <div className="mt-6">
              <Button href="/about" variant="secondary">
                Full CV and publications
              </Button>
            </div>
          </Card>
          <Card>
            <h3 className="text-base uppercase tracking-wider">{UI.overview.stack}</h3>
            <div className="mt-5">
              <StackGrid />
            </div>
          </Card>
        </div>
      </section>
    </div>
  )
}
