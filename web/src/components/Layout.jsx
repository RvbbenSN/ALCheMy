import { NavLink, Link, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { SCREENS, SITE } from '../content/site.js'
import { AmbientPlayer, useTheme } from './ui.jsx'

function ThemeToggle() {
  const [theme, setTheme] = useTheme()
  const next = theme === 'light' ? 'dark' : 'light'
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
      className="rounded-[var(--radius-button)] px-3 py-1.5 text-xs uppercase tracking-wider"
      style={{ border: '2px solid var(--surface-border)', color: 'var(--text-secondary)' }}
    >
      {theme === 'light' ? 'Dark' : 'Light'}
    </button>
  )
}

function StatusBadge() {
  // Verde solo si la API contesta de verdad. Un badge de estado que miente
  // es peor que no tener badge (roadmap, seccion 4.3).
  const [live, setLive] = useState(null)
  useEffect(() => {
    let alive = true
    fetch('/api/v1/health')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(() => alive && setLive(true))
      .catch(() => alive && setLive(false))
    return () => {
      alive = false
    }
  }, [])
  const color = live ? 'var(--status-pure)' : 'var(--text-muted)'
  const label = live === null ? 'Checking…' : live ? 'Smart Lab live' : 'Static preview'
  return (
    <span className="hidden items-center gap-2 text-xs uppercase tracking-wider lg:inline-flex" style={{ color }}>
      <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

export default function Layout() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => {
    setOpen(false)
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:px-4 focus:py-2"
        style={{ background: 'var(--surface-elevated)', color: 'var(--text-primary)' }}
      >
        Skip to content
      </a>

      <header
        className="sticky top-0 z-30 backdrop-blur-none"
        style={{ background: 'var(--surface-elevated)', borderBottom: '2.5px solid var(--surface-border)' }}
      >
        <div className="mx-auto flex max-w-[var(--content-max)] items-center gap-4 px-4 py-3">
          <Link
            to="/"
            className="flex items-center gap-2.5 no-underline"
            style={{ color: 'var(--accent-primary)' }}
            aria-label="ALCheMy — home"
          >
            {/* El isotipo hereda el color por mask-image, asi que cambia solo con el tema. */}
            <span className="logo-mark" aria-hidden style={{ width: '34px', height: '34px' }} />
            <span
              className="text-xl uppercase"
              style={{ fontFamily: 'var(--font-display)', letterSpacing: '2.5px', color: 'var(--text-primary)' }}
            >
              ALCheMy
            </span>
          </Link>

          <StatusBadge />

          <div className="ml-auto flex items-center gap-2">
            <a
              href={SITE.github}
              className="hidden text-xs uppercase tracking-wider no-underline sm:inline"
              style={{ color: 'var(--text-secondary)' }}
            >
              GitHub
            </a>
            <a
              href={SITE.linkedin}
              className="hidden text-xs uppercase tracking-wider no-underline sm:inline"
              style={{ color: 'var(--text-secondary)' }}
            >
              LinkedIn
            </a>
            <ThemeToggle />
            <button
              type="button"
              className="rounded-[var(--radius-button)] px-3 py-1.5 text-xs uppercase lg:hidden"
              style={{ border: '2px solid var(--surface-border)', color: 'var(--text-secondary)' }}
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mainnav"
            >
              Menu
            </button>
          </div>
        </div>

        <nav
          id="mainnav"
          className={`${open ? 'block' : 'hidden'} lg:block`}
          style={{ borderTop: '1px solid var(--surface-border)' }}
        >
          <ul className="mx-auto flex max-w-[var(--content-max)] list-none flex-col gap-0 px-4 py-2 lg:flex-row lg:flex-wrap lg:gap-1">
            {SCREENS.map((s) => (
              <li key={s.id}>
                <NavLink
                  to={`/${s.slug}`}
                  end={s.slug === ''}
                  className="block px-3 py-2 text-xs uppercase tracking-wider no-underline"
                  style={({ isActive }) => ({
                    color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    borderBottom: isActive ? '2.5px solid var(--accent-primary)' : '2.5px solid transparent',
                    fontWeight: isActive ? 700 : 400,
                  })}
                >
                  <span style={{ color: 'var(--text-muted)' }}>{s.id}.</span> {s.short}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main id="main" className="mx-auto max-w-[var(--content-max)] px-4 py-10 md:py-16">
        <Outlet />
      </main>

      <footer
        className="mt-16 px-4 py-8 text-xs"
        style={{ borderTop: '2.5px solid var(--surface-border)', color: 'var(--text-muted)' }}
      >
        <div className="mx-auto flex max-w-[var(--content-max)] flex-col gap-6 md:flex-row md:items-start md:justify-between">
          {/* El lockup completo (isotipo + palabra) cabe aqui, donde hay espacio vertical. */}
          <span
            className="logo-lockup shrink-0"
            aria-label="ALCheMy"
            role="img"
            style={{ width: '120px', height: '66px', color: 'var(--accent-primary)' }}
          />
          <div className="flex flex-col gap-2 md:text-right">
            <span>
              © {new Date().getFullYear()} Rubén Serrano · {SITE.tagline}
            </span>
            <span>
              Sample identifiers and unpublished ligand names shown on this site are pseudonymized. No raw
              instrument data is served.
            </span>
          </div>
        </div>
      </footer>

      <AmbientPlayer />
    </>
  )
}
