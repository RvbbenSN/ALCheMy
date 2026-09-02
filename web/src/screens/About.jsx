import { useState } from 'react'
import { Contact, Download, ExternalLink, Mail, Send } from 'lucide-react'
import SOCIAL from '../data/social_icons.json'
import { BIO_ABOUT, SITE } from '../content/site.js'
import {
  EDUCATION,
  EXPERIENCE,
  HEADLINE,
  METRICS,
  FUNDING,
  OUTREACH,
  PROJECTS,
  PUBLICATIONS,
  PUBLICATION_SUMMARY,
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

/* ---------------------------------------------------------------------------
   Formulario de contacto. No hay servidor detras y no lo va a haber en esta
   fase, asi que en vez de fingir un envio compone un `mailto:` con lo escrito
   y lo abre en el cliente de correo del visitante. Es honesto —el visitante ve
   exactamente lo que se manda y desde su propia cuenta— y no requiere guardar
   ningun dato de nadie.
   --------------------------------------------------------------------------- */
function ContactForm() {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  const href =
    `mailto:${SITE.email}` +
    `?subject=${encodeURIComponent(subject || 'ALCheMy')}` +
    `&body=${encodeURIComponent(body)}`

  return (
    <Card>
      <h3 className="text-base">Say something</h3>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Thoughts on the platform, a question about the chemistry, an opportunity — whatever it is, it
        reaches <code>{SITE.email}</code>.
      </p>

      <label className="mt-4 block text-xs uppercase tracking-wider" style={{ color: 'var(--accent-secondary-text)' }}>
        Subject
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="A note about ALCheMy"
          className="mt-1.5 w-full rounded-[var(--radius-badge)] p-2.5 text-sm"
          style={{
            border: '2px solid var(--surface-border)',
            background: 'var(--surface)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-body)',
            textTransform: 'none',
            letterSpacing: 'normal',
          }}
        />
      </label>

      <label className="mt-3 block text-xs uppercase tracking-wider" style={{ color: 'var(--accent-secondary-text)' }}>
        Message
        <textarea
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write here…"
          className="mt-1.5 w-full rounded-[var(--radius-badge)] p-2.5 text-sm"
          style={{
            border: '2px solid var(--surface-border)',
            background: 'var(--surface)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-body)',
            textTransform: 'none',
            letterSpacing: 'normal',
            resize: 'vertical',
          }}
        />
      </label>

      <a
        href={href}
        className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius-button)] px-4 py-2 text-sm no-underline"
        style={{
          border: 'var(--border-button) solid var(--accent-primary)',
          background: 'var(--accent-primary)',
          color: 'var(--surface)',
        }}
      >
        <Send size={15} aria-hidden />
        Open in my mail app
      </a>
      <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        This opens your own mail client with the message ready to send. Nothing is stored here.
      </p>
    </Card>
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
          {BIO_ABOUT.map((p, i) => (
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
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {p.doi && (
                  <a
                    href={p.doi}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm no-underline"
                    style={{ color: 'var(--accent-primary)' }}
                  >
                    Read the paper
                    <ExternalLink size={13} aria-hidden />
                  </a>
                )}
                {typeof p.cites === 'number' && (
                  <span className="mono text-xs" style={{ color: 'var(--text-muted)' }}>
                    {p.cites} {p.cites === 1 ? 'citation' : 'citations'}
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
        <p className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <strong>{PUBLICATION_SUMMARY.firstAuthor}</strong> works as first author · mean impact factor{' '}
          <strong>{PUBLICATION_SUMMARY.meanIf}</strong> · <strong>{PUBLICATION_SUMMARY.cites}</strong>{' '}
          citations · h-index <strong>{PUBLICATION_SUMMARY.hIndex}</strong>{' '}
          <span style={{ color: 'var(--text-muted)' }}>(Scopus, May 2026)</span>
        </p>
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

        <Card className="mt-4">
          <h3 className="text-base">The contracts behind them</h3>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {FUNDING.intro}
          </p>
          <ul className="mt-4 flex list-none flex-col gap-2 p-0">
            {FUNDING.contracts.map((c) => (
              <li
                key={c.ref}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
                style={{ borderLeft: '2px solid var(--surface-border)', paddingLeft: '0.75rem' }}
              >
                <span className="mono text-sm" style={{ color: 'var(--text-primary)' }}>{c.ref}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.role}</span>
                <span
                  className="mono ml-auto text-sm"
                  style={{ color: 'var(--accent-primary)' }}
                >
                  {c.budget}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Combined budget of the projects funding that work: <strong>{FUNDING.total}</strong>. Principal
            investigator in all of them: Dr. Patricia Horcajada.
          </p>
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
        <div className="grid gap-4 md:grid-cols-2">
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

      {/* --- contacto --- */}
      <section>
        <SectionTitle eyebrow="Get in touch">Contact</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <ContactForm />
          <Card accent>
            <h3 className="text-base">Or the direct route</h3>
            <div className="mt-4 flex flex-col gap-3">
              <a
                href={`mailto:${SITE.email}`}
                className="inline-flex items-center gap-2 text-sm no-underline"
                style={{ color: 'var(--accent-primary)' }}
              >
                <Mail size={15} aria-hidden />
                {SITE.email}
              </a>
              <a
                href={SITE.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm no-underline"
                style={{ color: 'var(--accent-primary)' }}
              >
                <Contact size={15} aria-hidden />
                LinkedIn
              </a>
            </div>
            <p className="mt-5 text-sm" style={{ color: 'var(--text-secondary)' }}>
              The code behind this platform is on GitHub; the data it runs on is not, and neither are the
              unpublished ligands. That distinction is deliberate and is explained on the screens
              themselves.
            </p>
          </Card>
        </div>
      </section>
    </div>
  )
}
