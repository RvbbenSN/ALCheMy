/* --------------------------------------------------------------------------
   science.js — Contenido de la pantalla 01.

   Redactado a partir del capitulo 1 de la tesis. El objetivo aqui no es lucir
   quimica: es que un lector sin formacion entienda que es un MOF, por que se
   caracteriza con tantas tecnicas, y por que eso genera el problema de datos
   que resuelve el resto de la plataforma. Cada concepto se introduce donde hace
   falta, para que las pantallas siguientes no lo suelten de golpe.
   -------------------------------------------------------------------------- */

export const SCIENCE_INTRO =
  'Ever wondered what happens when you build crystalline materials like molecular *Lego*? Step inside the chemistry of Metal-Organic Frameworks (MOFs) and see why characterizing them requires an entire suite of analytical techniques.'

/* --- Que es un MOF --------------------------------------------------------- */

export const MOF_DEF = {
  acronym: 'MOF',
  expansion: 'Metal-Organic Framework',
  iupac:
    'A coordination network with organic ligands containing potential voids.',
  iupacNote: 'IUPAC recommendation, 2013.',
  plain:
    'In a nutshell, **metal ions or clusters** act as the joints, **organic molecules** act as the struts, and together they build a rigid scaffold.',
  why: 'Because both parts can be swapped independently, the **same architecture can be rebuilt** with a different metal or a different linker. That is what makes the family so large: they are the most diverse class of extended crystalline solids known today.',
}

export const MOF_FACTS = [
  {
    icon: 'grid',
    title: 'Built like a scaffold',
    body: '**Metal nodes joined by organic linkers** into a periodic network. Treating them as abstract nets — nodes and edges — is what allows a structure to be designed',
  },
  {
    icon: 'expand',
    title: 'Surface areas without precedent',
    body: 'A single gram can present the **surface area of a football pitch**. That is what makes them useful for storing gases, capturing CO₂ or hosting catalytic sites.',
  },
  {
    icon: 'sliders',
    title: 'Tunable by design',
    body: 'Change the linker and the pore changes size, shape and chemistry while the topology survives. This is the **isoreticular principle**.',
  },
  {
    icon: 'flask',
    title: 'Applied to real problems',
    body: '**Wide range of promising applications**. Green hydrogen production, water remediation, CO₂ conversion into cyclic carbonates, and polymerisation catalysis, among others.',
  },
]

export const MOF_NAMING = {
  title: 'A note on the names',
  body: 'Frameworks are usually named after the institution that first reported them: MIL-n from the Materials Institute Lavoisier, UiO-n from the University of Oslo, HKUST-n from Hong Kong. IEF-n is the series from the IMDEA Energy Institute — where the syntheses behind this platform were made.',
}

export const NOBEL = {
  year: '2025',
  title: 'Nobel Prize in Chemistry',
  laureates: 'Susumu Kitagawa, Richard Robson and Omar Yaghi',
  reason: 'For establishing the foundations of metal-organic frameworks and reticular chemistry.',
  credit: '© Nobel Prize Outreach. Illustration: Niklas Elmehed.',
}

/* --- Por que hay que caracterizar tanto ------------------------------------ */

export const WHY_CHARACTERISE = {
  title: 'Why one material needs a dozen measurements',
  /* Va como texto corrido, antes de la rejilla: es la premisa, no una nota. */
  lead:
    'Making a solid is not the same as knowing what it is. **A newly formed powder has to be interrogated** from several angles before anything can be claimed about it.',
  /* Y esto va en la caja de nota, condensado. */
  consequence:
    'Every promising sample generates files from several instruments, each written in its own format. Multiply that by thousands of samples and it stops being a chemistry problem — it becomes a **data management and processing challenge**.',
  /* Cifras auditadas el 2026-09-03. Las medidas salen de
     `characterization_measurements`. Los ficheros, de contar el data lake
     historico (`data/raw_datalake_historico`) descartando lo que no escribio un
     instrumento (8 `.gitkeep`, 25 `.docx`, 1 `.rar`): 6.107 - 34 = 6.073. La
     carpeta `data/raw_datalake` es material de prueba y no cuenta. */
  numbers: [
    ['6,073', 'raw instrument files'],
    ['3,926', 'measurements ingested'],
    ['9', 'analytical techniques'],
  ],
}

export const TECHNIQUES = [
  {
    abbr: 'PXRD',
    icon: 'waves',
    name: 'Powder X-ray diffraction',
    answers: 'Is it crystalline, and is it the phase I wanted?',
    body: 'X-rays scattered by an ordered lattice produce sharp peaks at specific angles. A disordered solid produces a broad hump instead. This is the first test any new sample faces, and the one this platform models.',
    primary: true,
  },
  {
    abbr: 'TGA',
    icon: 'flame',
    name: 'Thermogravimetric analysis',
    answers: 'How much solvent is trapped inside, and how hot can it get?',
    body: 'The sample is heated while being weighed. Mass losses reveal guest molecules leaving the pores and, eventually, the framework itself decomposing.',
  },
  {
    abbr: 'VT-XRD',
    icon: 'thermometer',
    name: 'Variable-temperature XRD',
    answers: 'Does the structure survive heating?',
    body: 'Diffraction measured while the temperature rises, showing whether the lattice holds, transforms or collapses.',
  },
  {
    abbr: 'BET',
    icon: 'wind',
    name: 'Gas physisorption',
    answers: 'How much empty space is really accessible?',
    body: 'Nitrogen or CO₂ is dosed onto the material and the uptake converted into a specific surface area in square metres per gram, plus the pore size distribution.',
  },
  {
    abbr: 'FTIR',
    icon: 'audio',
    name: 'Infrared spectroscopy',
    answers: 'Did the linker actually bind to the metal?',
    body: 'Chemical bonds absorb infrared light at characteristic frequencies. Shifts in those bands distinguish a coordinated ligand from free, unreacted starting material.',
  },
  {
    abbr: 'ICP-OES',
    icon: 'sparkles',
    name: 'Inductively coupled plasma',
    answers: 'How much metal is in there?',
    body: 'The sample is vaporised in a plasma and the light it emits quantifies each element, giving the real metal-to-ligand ratio.',
  },
  {
    abbr: 'EA',
    icon: 'atom',
    name: 'Elemental analysis',
    answers: 'Does the organic composition match the formula?',
    body: 'Combustion analysis returns carbon, hydrogen, nitrogen and sulfur percentages, which are compared against the proposed formula.',
  },
  {
    abbr: 'SEM / TEM',
    icon: 'microscope',
    name: 'Electron microscopy',
    answers: 'What do the particles look like?',
    body: 'Electron beams image crystal morphology and size, from the shape of a facet down to the nanometre scale.',
  },
  {
    abbr: 'UV-Vis',
    icon: 'sun',
    name: 'Diffuse reflectance spectroscopy',
    answers: 'Can it absorb light, and at what energy?',
    body: 'Optical absorption gives the band gap, which decides whether a material can drive a photocatalytic reaction.',
  },
]

/* --- El día en el laboratorio ---------------------------------------------- */

export const LAB_INTRO = {
  title: 'What a week at the bench actually looks like',
  /* Como en la seccion anterior: la premisa va suelta, no encerrada en una
     tarjeta. La cadencia se ha quitado porque la repite el esquema de abajo. */
  lead:
    'A structure can be designed on paper, but its **synthesis must be discovered**. The ideal recipe is found by screening countless reaction trials. This is how pipeline looks like:',
}

/* --- El cuello de botella -------------------------------------------------- */

export const BOTTLENECK = {
  title: 'Where the data problem begins',
  scale:
    'Two plates a week, 24 conditions each, for five years. The diagram above is what that produces: **2,167 syntheses**, **6,073 instrument files**, across folders, notebooks and local disks.',
  problem:
    'Nothing about that is unusual, it is how most laboratories work. But it means a simple question — *which conditions have ever produced a promising material?* — and the answer is only as good as someone\'s memory of where things were saved.',
  /* Va en la caja de nota. El enfasis, por peticion, en la base de datos. */
  turn:
    'The fix is a **governed database**: one row per synthesis, one row per measurement, every file fingerprinted and attributed. Once the record is a table, the question above becomes a query — and a model can learn from the whole record.',
  /* Gancho hacia la 02, con las mismas palabras con que abre esa pantalla. */
  hookTitle: 'Which leaves one problem unsolved',
  hook:
    'Thousands of instrument files, several formats... and nothing stopping the same file being saved twice under two names. What is needed is specific: **a way to drop a file somewhere and have it end up in the database, correctly attributed, without anyone retyping anything.**',
}

/* --- La escala del dato ----------------------------------------------------
   Un recuento, no una secuencia. La primera version dibujaba esto como un
   embudo y era enganoso: sugeria que las tecnicas se aplican uma tras otra en
   un orden fijo, y no es asi. Solo el PXRD es rutinario; las demas se piden
   segun lo que haga falta saber de cada muestra, en el orden que convenga y
   muchas veces ninguna.

   Lo que si es cierto —y es lo unico que la figura debe decir— es cuanto
   material genera el laboratorio y donde acaba: muchas sintesis a la izquierda,
   un monton de medidas repartidas entre nueve tecnicas en el centro, y una sola
   base de datos a la derecha que las recoge todas.

   Recuentos reales de `characterization_measurements`, 2026-09-02. */

export const SYNTHESIS_NODE = {
  label: 'Syntheses',
  icon: 'flask',
  count: 2167,
  note: 'Two 24-well plates a week, five years.',
}

export const TECHNIQUE_COUNTS = [
  { key: 'pxrd', label: 'PXRD', icon: 'waves', count: 1879, note: 'Routine on everything' },
  { key: 'sem', label: 'SEM', icon: 'microscope', count: 1659, note: 'Crystal habit' },
  { key: 'fesem', label: 'FESEM', icon: 'aperture', count: 132, note: 'Finer morphology' },
  { key: 'ftir', label: 'FTIR', icon: 'audio', count: 77, note: 'Did the linker bind?' },
  { key: 'ads', label: 'Adsorption', icon: 'wind', count: 68, note: 'Accessible porosity' },
  { key: 'uv', label: 'UV-Vis', icon: 'sun', count: 44, note: 'Optical band gap' },
  { key: 'tga', label: 'TGA', icon: 'flame', count: 31, note: 'Thermal stability' },
  { key: 'vtxrd', label: 'VT-XRD', icon: 'thermometer', count: 26, note: 'Structure while heated' },
  { key: 'scxrd', label: 'SC-XRD', icon: 'gem', count: 10, note: 'Full structure solved' },
  {
    key: 'icpea',
    label: 'ICP · EA',
    icon: 'droplet',
    count: 28,
    note: 'Composition, as PDF',
    /* Cero filas todavia en la base de datos: llegan como informe PDF y pasan
       por la rama de IA del flujo, aun sin ejecutar sobre el historico. Son 15
       informes de ICP y 13 de analisis elemental (CHNS). Se dibuja con trazo
       discontinuo para que no se confunda con lo ya ingerido. */
    pending: true,
  },
]

export const DATA_SCALE = {
  title: 'How much data one laboratory produces',
  lead:
    'On the left, every synthesis ever performed. In the middle, every measurement taken on those samples, by technique. On the right, the one place all of it has to end up. **A true challenge of scale.**',
  bracketLabel: 'measurements',
  databaseLabel: 'One governed database',
  databaseNote: 'One row per synthesis, one row per measurement, every file fingerprinted.',
  footnote:
    'Measurement counts read from the database on 3 September 2026; ICP and EA, shown dashed, are still PDF reports awaiting the AI branch, so that circle counts files, not rows. Circle size scales with the count so the small techniques stay legible — read the numbers, not the areas.',
}

