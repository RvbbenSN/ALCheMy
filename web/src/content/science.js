/* --------------------------------------------------------------------------
   science.js — Contenido de la pantalla 01.

   Redactado a partir del capitulo 1 de la tesis. El objetivo aqui no es lucir
   quimica: es que un lector sin formacion entienda que es un MOF, por que se
   caracteriza con tantas tecnicas, y por que eso genera el problema de datos
   que resuelve el resto de la plataforma. Cada concepto se introduce donde hace
   falta, para que las pantallas siguientes no lo suelten de golpe.
   -------------------------------------------------------------------------- */

export const SCIENCE_INTRO =
  'This screen is the context for everything that follows. It explains what these materials are, how they are made and why making one requires measuring it in a dozen different ways — which is where the data problem begins.'

/* --- Que es un MOF --------------------------------------------------------- */

export const MOF_DEF = {
  acronym: 'MOF',
  expansion: 'Metal-Organic Framework',
  iupac:
    'A coordination network with organic ligands containing potential voids.',
  iupacNote: 'IUPAC recommendation, 2013.',
  plain:
    'In plain terms: metal ions or clusters act as the joints, organic molecules act as the struts, and together they build a rigid scaffold. What matters is what the scaffold does not contain — the empty space running through it.',
  why: 'Because both halves can be swapped independently, the same architecture can be rebuilt with a different metal or a different linker. That is what makes the family so large: they are the most diverse class of extended crystalline solids known today.',
}

export const MOF_FACTS = [
  {
    icon: 'grid',
    title: 'Built like a scaffold',
    body: 'Metal nodes joined by organic linkers into a periodic network. Treating them as abstract nets — nodes and edges — is what allows a structure to be designed rather than discovered.',
  },
  {
    icon: 'expand',
    title: 'Surface areas without precedent',
    body: 'A single gram can present the surface area of a football pitch. That is what makes them useful for storing gases, capturing CO₂ or hosting catalytic sites.',
  },
  {
    icon: 'sliders',
    title: 'Tunable by design',
    body: 'Change the linker and the pore changes size, shape and chemistry while the topology survives. This is the isoreticular principle, and it is why one good architecture becomes a family.',
  },
  {
    icon: 'flask',
    title: 'Applied to real problems',
    body: 'Green hydrogen production, degradation of pharmaceuticals in wastewater, CO₂ conversion into cyclic carbonates, and polymerisation catalysis — the four applications this laboratory works on.',
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
  body: 'Making a solid is not the same as knowing what it is. A newly formed powder has to be interrogated from several independent angles before anything can be claimed about it: whether it is ordered, what it is made of, how much empty space it holds, how hot it can get before it collapses. No single technique answers more than one of those questions.',
  consequence:
    'This is the root of the data problem. Every promising sample generates files from several instruments, each in its own format, each written by a different manufacturer. Multiply that by thousands of samples and the result is not a chemistry problem any more.',
}

export const TECHNIQUES = [
  {
    abbr: 'PXRD',
    name: 'Powder X-ray diffraction',
    answers: 'Is it crystalline, and is it the phase I wanted?',
    body: 'X-rays scattered by an ordered lattice produce sharp peaks at specific angles. A disordered solid produces a broad hump instead. This is the first test any new sample faces, and the one this platform models.',
    primary: true,
  },
  {
    abbr: 'TGA',
    name: 'Thermogravimetric analysis',
    answers: 'How much solvent is trapped inside, and how hot can it get?',
    body: 'The sample is heated while being weighed. Mass losses reveal guest molecules leaving the pores and, eventually, the framework itself decomposing.',
  },
  {
    abbr: 'VT-XRD',
    name: 'Variable-temperature XRD',
    answers: 'Does the structure survive heating?',
    body: 'Diffraction measured while the temperature rises, showing whether the lattice holds, transforms or collapses.',
  },
  {
    abbr: 'BET',
    name: 'Gas physisorption',
    answers: 'How much empty space is really accessible?',
    body: 'Nitrogen or CO₂ is dosed onto the material and the uptake converted into a specific surface area in square metres per gram, plus the pore size distribution.',
  },
  {
    abbr: 'FTIR',
    name: 'Infrared spectroscopy',
    answers: 'Did the linker actually bind to the metal?',
    body: 'Chemical bonds absorb infrared light at characteristic frequencies. Shifts in those bands distinguish a coordinated ligand from free, unreacted starting material.',
  },
  {
    abbr: 'ICP-OES',
    name: 'Inductively coupled plasma',
    answers: 'How much metal is in there?',
    body: 'The sample is vaporised in a plasma and the light it emits quantifies each element, giving the real metal-to-ligand ratio.',
  },
  {
    abbr: 'EA',
    name: 'Elemental analysis',
    answers: 'Does the organic composition match the formula?',
    body: 'Combustion analysis returns carbon, hydrogen, nitrogen and sulfur percentages, which are compared against the proposed formula.',
  },
  {
    abbr: 'SEM / TEM',
    name: 'Electron microscopy',
    answers: 'What do the particles look like?',
    body: 'Electron beams image crystal morphology and size, from the shape of a facet down to the nanometre scale.',
  },
  {
    abbr: 'UV-Vis',
    name: 'Diffuse reflectance spectroscopy',
    answers: 'Can it absorb light, and at what energy?',
    body: 'Optical absorption gives the band gap, which decides whether a material can drive a photocatalytic reaction.',
  },
]

/* --- El día en el laboratorio ---------------------------------------------- */

export const LAB_INTRO = {
  title: 'What a week at the bench actually looks like',
  body: 'Designing a framework is not a matter of deciding what to make and then making it. Which combination of metal, linker, solvent, temperature and time produces an ordered solid cannot be predicted reliably, so it is explored — by preparing many candidate conditions at once and seeing which ones work.',
  cadence:
    'The cycle below ran roughly twice a week for five years. Each pass through it produces one plate of 24 candidate syntheses, and everything that follows in this platform exists because of what that cycle generates.',
}

/* --- El cuello de botella -------------------------------------------------- */

export const BOTTLENECK = {
  title: 'Where the data problem begins',
  scale:
    'Two plates a week, 24 conditions each, for five years. Every promising sample then passed through several of the techniques above, each writing its own file in its own format. The result was thousands of instrument files spread across network folders and local disks, plus one master spreadsheet holding the synthesis conditions.',
  problem:
    'Nothing about that is unusual, and that is the point. It is how most laboratories work. But it means the answer to a simple question — which conditions have ever produced a crystalline phase with this metal? — requires opening dozens of files by hand, and the answer is only as reliable as the person\'s memory of where things were saved.',
  turn:
    'ALCheMy was built to make that question answerable by query rather than by recollection: one governed database, one row per synthesis, one row per measurement, and a model on top that learns from the whole record rather than from what anyone remembers.',
}
