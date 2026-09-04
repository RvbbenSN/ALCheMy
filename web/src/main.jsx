import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import './styles/global.css'
import { LocaleProvider } from './i18n/LocaleContext.jsx'
import Layout from './components/Layout.jsx'
import Overview from './screens/Overview.jsx'
import Science from './screens/Science.jsx'
import DataCollection from './screens/DataCollection.jsx'
import DataPreparation from './screens/DataPreparation.jsx'
import Eda from './screens/Eda.jsx'
import Modeling from './screens/Modeling.jsx'
import TheModel from './screens/TheModel.jsx'
import Rag from './screens/Rag.jsx'
import DatabaseScreen from './screens/Database.jsx'
import About from './screens/About.jsx'

/* Las 9 pantallas, listadas UNA vez y montado el array dos veces (en / es)
   con `.map()` -- que si funciona con react-router v6, a diferencia de
   envolver <Route> en un componente propio (eso react-router no lo recorre:
   solo entiende <Route> directos o generados por .map()). Asi anadir una
   pantalla nueva no obliga a acordarse de repetirla en dos sitios. */
const SCREEN_ROUTES = [
  { key: 'overview', index: true, element: <Overview /> },
  { key: 'science', path: 'science', element: <Science /> },
  { key: 'data-collection', path: 'data-collection', element: <DataCollection /> },
  { key: 'data-preparation', path: 'data-preparation', element: <DataPreparation /> },
  { key: 'data-understanding', path: 'data-understanding', element: <Eda /> },
  { key: 'modeling', path: 'modeling', element: <Modeling /> },
  { key: 'the-model', path: 'the-model', element: <TheModel /> },
  { key: 'rag', path: 'rag', element: <Rag /> },
  { key: 'database', path: 'database', element: <DatabaseScreen /> },
  { key: 'about', path: 'about', element: <About /> },
  { key: 'fallback', path: '*', element: <Overview /> },
]

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Ingles: rutas sin prefijo, exactamente como antes de anadir espanol. */}
        <Route element={<LocaleProvider locale="en"><Layout /></LocaleProvider>}>
          {SCREEN_ROUTES.map((r) => (
            <Route key={`en-${r.key}`} index={r.index} path={r.path} element={r.element} />
          ))}
        </Route>
        {/* Espanol: mismo arbol de pantallas, bajo /es. Mientras el contenido
            no este migrado a {en, es}, useT() cae a ingles automaticamente --
            visitar /es hoy no rompe nada, solo se ve en ingles todavia. */}
        <Route path="es" element={<LocaleProvider locale="es"><Layout /></LocaleProvider>}>
          {SCREEN_ROUTES.map((r) => (
            <Route key={`es-${r.key}`} index={r.index} path={r.path} element={r.element} />
          ))}
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
