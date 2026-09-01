import { Contact, Download, ExternalLink, Mail } from 'lucide-react'
import SOCIAL from '../data/social_icons.json'
import { BIO_SHORT, SITE } from '../content/site.js'
import {
  EDUCATION,
  EXPERIENCE,
  HEADLINE,
  METRICS,
  OUTREACH,
  PROJECTS,
  PUBLICATIONS,
  SKILLS,
} from '../content/about.js'
import { Badge, Card, SectionTitle } from '../components/ui.jsx'

function Tag({ children, tone = 'line' }) {
  return (
    <span
      className="rounded-[var(--radius-badge)] px-2 py-1 text-xs"
      style={{
        border: `1.5px solid ${tone === 'accent' ? 'var(--accent-primary)' : 'var(--surface-border)'}`,
        color: tone === 'accent' ? 'var(--accent-primary)' : 'var(--text-secondary)',
      }}
    >
      {children}
    </span>
  )
}

/* Marca real donde simple-icons la tiene. LinkedIn no esta ahi —la retiraron a
   peticion de la propia empresa— asi que ese boton usa un icono neutro en vez
   de reproducir su logotipo. */
function BrandIcon({ name, size = 16 }) {
  const d = SOCIAL[name]
  if (!d) return null
  return (
    <svg viewBox="0 0 24 24" aria-hidden style={{ width: size, height: size, fill: 'currentColor' }}>
      <path d={d} />
    </svg>
  )
}

function LinkButton({ href, icon: Icon, brand, children, primary = false, download = false }) {
  return (
    <a
      href={href}
      target={download ? undefined : '_blank'}
      rel="noopener noreferrer"
      download={download || undefined}
      className="inline-flex items-center gap-2 rounded-[var(--radius-button)] px-4 py-2.5 text-sm no-underline"
      style={{
        border: `2.5px solid ${primary ? 'var(--accent-primary)' : 'var(--surface-border)'}`,
        background: primary ? 'var(--accent-primary)' : 'transparent',
        color: primary ? 'var(--surface)' : 'var(--text-primary)',
        boxShadow: primary ? 'var(--shadow-button)' : 'none',
        fontFamily: 'var(--font-heading)',
      }}
    >
      {brand ? <BrandIcon name={brand} /> : <Icon size={16} aria-hidden />}
      {children}
    </a>
  )
}

export default function About() {
  return (
    <div className="flex flex-col gap-16">
      {/* --- cabecera --- */}
      <section>
        <Badge tone="accent">08 · About</Badge>
        <h1 className="mt-4 text-3xl uppercase md:text-5xl" style={{ fontFamily: 'var(--font-display)', letterSpacing: '2px' }}>
          Rubén Serrano Nieto
        </h1>
        <p className="mt-3 text-lg" style={{ color: 'var(--accent-secondary-text)', fontFamily: 'var(--font-heading)' }}>
          {HEADLINE}
        </p>
        <div className="mt-6 max-w-3xl">
          {BIO_SHORT.map((p, i) => (
            <p key={i} className={i ? 'mt-4' : ''} style={{ color: 'var(--text-secondary)' }}>
              {p}
            </p>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <LinkButton href={SITE.cv} icon={Download} primary download>
            Download CV
          </LinkButton>
          <LinkButton href={SITE.linkedin} icon={Contact}>
            LinkedIn
          </LinkButton>
          <LinkButton href={SITE.github} brand="github">
            GitHub
          </LinkButton>
          <LinkButton href={SITE.orcid} brand="orcid">
            ORCiD
          </LinkButton>
          <LinkButton href={`mailto:${SITE.email}`} icon={Mail}>
            Email
          </LinkButton>
        </div>
      </section>

      {/* --- cifras --- */}
      <section>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {METRICS.map((m) => (
            <Card key={m.l} accent className="text-center">
              <div className="text-2xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-primary)' }}>
                {m.v}
              </div>
              <div className="mt-2 text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                {m.l}
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* --- experiencia --- */}
      <section>
        <SectionTitle eyebrow="Experience">Where the chemistry happened</SectionTitle>
        <ol className="flex list-none flex-col gap-4 p-0">
          {EXPERIENCE.map((e) => (
            <li key={e.when}>
              <Card>
                <div className="mono text-xs uppercase tracking-wider" style={{ color: 'var(--accent-secondary-text)' }}>
                  {e.when}
                </div>
                <h3 className="mt-1 text-lg">{e.what}</h3>
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {e.where}
                </div>
                <ul className="mt-3 flex list-none flex-col gap-2 p-0 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {e.points.map((p, i) => (
                    <li key={i} style={{ borderLeft: '2px solid var(--surface-border)', paddingLeft: '0.75rem' }}>
                      {p}
                    </li>
                  ))}
                </ul>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* --- formacion --- */}
      <section>
        <SectionTitle eyebrow="Education">Training</SectionTitle>
        <ol className="flex list-none flex-col gap-4 p-0">
          {EDUCATION.map((e) => (
            <li key={e.when}>
              <Card>
                <div className="mono text-xs uppercase tracking-wider" style={{ color: 'var(--accent-secondary-text)' }}>
                  {e.when}
                </div>
                <h3 className="mt-1 text-lg">{e.what}</h3>
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {e.where}
                </div>
                <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {e.detail}
                </p>
                {e.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {e.tags.map((t) => (
                      <Tag key={t} tone="accent">
                        {t}
                      </Tag>
                    ))}
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* --- publicaciones --- */}
      <section>
        <SectionTitle eyebrow="Scientific production">Publications</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          {PUBLICATIONS.map((p) => (
            <Card key={p.title} accent={Boolean(p.note)}>
              <div className="flex flex-wrap items-center gap-2">
                <Tag tone="accent">{p.tag}</Tag>
                <span className="mono text-xs" style={{ color: 'var(--text-muted)' }}>
                  {p.year}
                </span>
              </div>
              <h3 className="mt-3 text-base">{p.title}</h3>
              <div className="mt-1 text-sm italic" style={{ color: 'var(--text-muted)' }}>
                {p.journal}
              </div>
              {p.note && (
                <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {p.note}
                </p>
              )}
            </Card>
          ))}
        </div>
      </section>

      {/* --- proyectos --- */}
      <section>
        <SectionTitle eyebrow="Funded research">Competitive R&amp;D projects</SectionTitle>
        <Card>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Six competitive projects at European, national and regional level, contributing to data
            analysis and technical reporting.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {PROJECTS.map((p) => (
              <Tag key={p} tone="accent">
                {p}
              </Tag>
            ))}
          </div>
        </Card>
      </section>

      {/* --- competencias --- */}
      <section>
        <SectionTitle eyebrow="Skills">What the toolbox holds</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-3">
          {SKILLS.map((s) => (
            <Card key={s.group}>
              <h3 className="text-base">{s.group}</h3>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {s.items.map((i) => (
                  <Tag key={i}>{i}</Tag>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* --- divulgacion --- */}
      <section>
        <SectionTitle eyebrow="Outreach">Writing for a wider audience</SectionTitle>
        <div className="grid gap-4 md:grid-cols-3">
          {OUTREACH.map((o) => (
            <Card key={o.title}>
              <div className="mono text-xs uppercase tracking-wider" style={{ color: 'var(--accent-secondary-text)' }}>
                {o.when} · {o.where}
              </div>
              <h3 className="mt-2 text-base">{o.title}</h3>
              {o.url && (
                <a
                  href={o.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-sm no-underline"
                  style={{ color: 'var(--accent-primary)' }}
                >
                  Read it
                  <ExternalLink size={13} aria-hidden />
                </a>
              )}
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
