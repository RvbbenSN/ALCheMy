/* --------------------------------------------------------------------------
   LocaleContext.jsx — infraestructura de idioma para la version en espanol.

   Por que existe
   ---------------
   La web va a tener dos idiomas (en / es) bajo el mismo arbol de componentes:
   `/` sigue siendo ingles, `/es/*` es la version espanola. Los DATOS (los
   ficheros en `content/*.js`) se migraran campo a campo de `'texto'` a
   `{ en: 'texto', es: 'texto' }`; los COMPONENTES (los `.jsx`) no cambian de
   forma -- siguen leyendo `ALGO.campo` como siempre, pero envuelto en `t()`.

   Por que un campo puede no estar traducido todavia, y eso no debe romper nada
   ----------------------------------------------------------------------------
   Mientras se traduce contenido poco a poco, `t()` hace FALLBACK a ingles si
   falta la clave del idioma activo (incluido durante la migracion, cuando un
   campo todavia es un string plano en vez de `{en, es}`). Así `/es/*` se
   puede visitar en cualquier momento del proceso sin que aparezca un hueco
   en blanco: lo que no este traducido aun, sale en ingles.

   Como se usa
   -----------
       import { useT } from '../i18n/LocaleContext.jsx'

       function MiPantalla() {
         const t = useT()
         return <p><Rich>{t(PREP_INTRO.lead)}</Rich></p>
       }

   `t(field)` acepta:
     - un string plano            -> se devuelve tal cual (contenido sin migrar)
     - `{ en: '...', es: '...' }` -> devuelve la del idioma activo, o `en` si
                                      la del idioma activo es undefined/null/''
   -------------------------------------------------------------------------- */

import { createContext, useContext, useMemo } from 'react'

export const LOCALES = ['en', 'es']
export const DEFAULT_LOCALE = 'en'

const LocaleContext = createContext(DEFAULT_LOCALE)

export function LocaleProvider({ locale, children }) {
  const value = useMemo(() => (LOCALES.includes(locale) ? locale : DEFAULT_LOCALE), [locale])
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

/** El idioma activo ('en' | 'es'), tal cual, para casos que no son texto
 * (p. ej. formatear una fecha o elegir un prefijo de ruta). */
export function useLocale() {
  return useContext(LocaleContext)
}

/** La funcion de traduccion. Ver el docstring de arriba para el contrato. */
export function useT() {
  const locale = useContext(LocaleContext)
  return function t(field) {
    if (field == null) return field
    if (typeof field === 'string') return field
    const translated = field[locale]
    return translated || field[DEFAULT_LOCALE] || ''
  }
}

/** Antepone `/es` a una ruta interna cuando el idioma activo es espanol.
 * Uso: `<Link to={withLocale('/science', locale)}>`. Nunca toca rutas
 * externas (`http...`) ni el propio `/es` si ya lo llevaba. */
export function withLocale(path, locale) {
  if (locale !== 'es') return path
  if (/^https?:\/\//.test(path)) return path
  if (path === '/' ) return '/es'
  return `/es${path}`
}

/** Elige el paquete de contenido del idioma activo.
 *
 * Los ficheros de `content/` (ingles) y `content/es/` exportan los MISMOS
 * nombres, asi que una pantalla se traduce cambiando de que modulo lee, sin
 * tocar una linea de JSX:
 *
 *     import * as EN from '../content/prep.js'
 *     import * as ES from '../content/es/prep.js'
 *     ...
 *     const { PREP_INTRO, LANES } = useBundle(EN, ES)
 *
 * El spread hace el fallback solo: un export que todavia no exista en espanol
 * sale en ingles en vez de romper la pantalla. Por eso se puede traducir por
 * partes y visitar /es en cualquier momento. */
export function useBundle(en, es) {
  const locale = useContext(LocaleContext)
  return useMemo(() => (locale === 'es' && es ? { ...en, ...es } : en), [locale, en, es])
}

/** Dada la ruta ACTUAL (de `useLocation().pathname`), devuelve la misma
 * pantalla en el otro idioma -- para el boton EN/ES del nav, que tiene que
 * cambiar de idioma sin sacar a quien lo pulsa de donde estaba leyendo. */
export function toggleLocalePath(pathname) {
  if (pathname === '/es' || pathname.startsWith('/es/')) {
    const resto = pathname.slice(3)
    return resto === '' ? '/' : resto
  }
  return pathname === '/' ? '/es' : `/es${pathname}`
}
