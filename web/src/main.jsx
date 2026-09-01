import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import './styles/global.css'
import Layout from './components/Layout.jsx'
import Overview from './screens/Overview.jsx'
import Science from './screens/Science.jsx'
import DataCollection from './screens/DataCollection.jsx'
import DataPreparation from './screens/DataPreparation.jsx'
import Eda from './screens/Eda.jsx'
import Modeling from './screens/Modeling.jsx'
import TheModel from './screens/TheModel.jsx'
import Rag from './screens/Rag.jsx'
import About from './screens/About.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="science" element={<Science />} />
          <Route path="data-collection" element={<DataCollection />} />
          <Route path="data-preparation" element={<DataPreparation />} />
          <Route path="eda" element={<Eda />} />
          <Route path="modeling" element={<Modeling />} />
          <Route path="the-model" element={<TheModel />} />
          <Route path="rag" element={<Rag />} />
          <Route path="about" element={<About />} />
          <Route path="*" element={<Overview />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
