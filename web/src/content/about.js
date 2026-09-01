/* --------------------------------------------------------------------------
   about.js — El CV desgranado en datos, no en prosa.

   Sale de `methodology/ruben_serrano_nieto_resume.pdf` y del perfil de LinkedIn.
   Se estructura en listas porque un bloque de texto largo esconde justo lo que
   un lector busca: cuantas publicaciones, con que factor de impacto, en que
   proyectos. Los datos duros se leen; los parrafos se saltan.
   -------------------------------------------------------------------------- */

export const HEADLINE =
  'PhD in Chemistry · Applied AI & Data Science · Advanced Materials'

export const METRICS = [
  { v: '>2,000', l: 'Syntheses performed' },
  { v: '18', l: 'Novel materials' },
  { v: '12', l: 'Crystal structures resolved' },
  { v: '6', l: 'Peer-reviewed publications' },
  { v: '12', l: 'Conference contributions' },
  { v: '6', l: 'Competitive R&D projects' },
]

export const EDUCATION = [
  {
    when: 'Nov 2022 — Dec 2025',
    what: 'PhD in Advanced Chemistry',
    where: 'Universidad Complutense de Madrid · IMDEA Energy (APMU)',
    detail:
      'Novel Phosphonate-based Metal-Organic Frameworks (P-MOFs): From Design to Application. Directed by Patricia Horcajada.',
    tags: ['Sobresaliente Cum Laude', 'International PhD Mention'],
  },
  {
    when: 'Sep 2020 — Sep 2021',
    what: 'MSc in Chemical Science & Technology',
    where: 'Universidad Complutense de Madrid',
    detail:
      'New electro/photoactive MOFs: synthesis, characterisation and properties — catalysis for green hydrogen and antibiotic removal from water.',
    tags: ['Nanoscience & materials'],
  },
  {
    when: 'Sep 2015 — Jul 2020',
    what: 'BSc in Chemistry',
    where: 'Universidad Complutense de Madrid',
    detail: 'Materials for clean energy storage based on porous metal-organic frameworks.',
    tags: [],
  },
]

export const EXPERIENCE = [
  {
    when: 'Mar 2022 — Dec 2025',
    what: 'R&D Researcher',
    where: 'IMDEA Energy Institute, Madrid',
    points: [
      'Led the design, synthesis and optimisation of novel hybrid materials — over 2,000 syntheses, 18 novel materials, 12 structures resolved — using high-throughput, solvothermal and microwave-assisted approaches.',
      'Ran multi-technique characterisation across up to twelve structural, textural and spectroscopic methods.',
      'Designed workflows linking structure, property and function, selecting materials for photocatalytic H₂ production, wastewater remediation, CO₂ conversion to cyclic carbonates and polymerisation catalysis — reaching benchmark-level efficiencies under mild conditions.',
      'Held technical responsibility for laboratory instrumentation and unit inventory.',
    ],
  },
  {
    when: 'Jun 2023 — Oct 2023',
    what: 'Research secondment',
    where: 'University of Glasgow, Scotland — Pablo Docampo group',
    points: [
      'María de Maeztu Mobility Programme. Solar-cell prototypes using bismuth-based perovskites and quantum-dot MOFs.',
    ],
  },
  {
    when: 'Apr 2021 — Feb 2022',
    what: 'Research assistant',
    where: 'IMDEA Energy Institute, Madrid',
    points: ['MOFs with ionic conductivity as exchange membranes for fuel cells (PEMFCs).'],
  },
]

/* Las publicaciones con su revista. El factor de impacto se anota donde se
   conoce; inventarlo para las demas seria peor que omitirlo. */
export const PUBLICATIONS = [
  {
    title: 'Two Cu-based Phosphonate Metal-Organic Frameworks as Efficient Water Splitting Photocatalysts',
    journal: 'Chemistry of Materials',
    year: '2023',
    tag: 'IF 7.2 · Q1',
    note: 'Outperforms the industrial benchmark MIL-125(Ti)-NH₂ in green hydrogen production.',
  },
  {
    title: 'Controlling Band-Bending for Perovskite Optoelectronic Devices Using Bismuth-Based Interlayers',
    journal: 'ACS Omega',
    year: '2025',
    tag: 'IF 4.3 · Q1',
    note: 'From the Glasgow secondment; also uncovered unexpected memristive behaviour.',
  },
  {
    title: 'Novel pyrene phosphonate metal-organic frameworks to efficiently degrade sulfamethazine in wastewater',
    journal: 'Journal of Environmental Chemical Engineering',
    year: '2025',
    tag: 'Q1',
    note: 'Tested on real urban water matrices.',
  },
  {
    title: 'Triazine Mg-based Phosphonate Metal-Organic Framework for ε-Caprolactone Polymerization',
    journal: 'Inorganic Chemistry',
    year: '2025',
    tag: 'Q1',
  },
  {
    title: 'Ca-Triazine Phosphonate Metal-Organic Framework as Fungicide Active Packaging',
    journal: 'Inorganic Chemistry Frontiers',
    year: '2025',
    tag: 'Q1',
  },
  {
    title: 'Novel Purine Derivative ITH15004 Facilitates Exocytosis through a Mitochondrial Calcium-Mediated Mechanism',
    journal: 'International Journal of Molecular Sciences',
    year: '2022',
    tag: 'Q1',
    note: 'From an earlier medicinal-chemistry internship.',
  },
]

export const PROJECTS = [
  'H2-MOF',
  'MOFSEIDON',
  'C-MOF.cell',
  'NAPOLION',
  'H+MOFs',
  'VIRMOF-CM',
]

export const SKILLS = [
  {
    group: 'Data science & AI',
    items: [
      'Python (Pandas, NumPy, SciPy, Scikit-learn, Statsmodels)',
      'SQL & PostgreSQL',
      'Machine learning',
      'GenAI & prompt engineering',
      'Docker',
      'Plotly, Power BI, Tableau',
      'No-code orchestration (n8n)',
    ],
  },
  {
    group: 'Chemistry & materials',
    items: [
      'High-throughput experimentation',
      'Solvothermal & microwave synthesis',
      'XRD (single-crystal and powder)',
      'Crystal refinement (LeBail, FullProf, Olex2)',
      'SEM, TEM, TGA, FTIR, UV-Vis',
      'ICP-OES, elemental analysis, NMR, HPLC',
      'Gas sorption & textural analysis',
    ],
  },
  {
    group: 'Other',
    items: [
      'Spanish (native)',
      'English (C1)',
      'Mandarin (HSK 2)',
      'Adobe Illustrator, Affinity, Blender 3D',
      'Scientific writing & technical reporting',
      'Agile / cross-functional R&D',
    ],
  },
]

/* Divulgacion: dos articulos en The Conversation con enlace real. */
export const OUTREACH = [
  {
    title: 'Los antibióticos están llegando a nuestros grifos: ¿podemos evitarlo?',
    where: 'The Conversation',
    when: 'March 2025',
    url: 'https://theconversation.com/los-antibioticos-estan-llegando-a-nuestros-grifos-podemos-evitarlo-250297',
  },
  {
    title: 'Así mejoramos las pilas de hidrógeno para que sean más duraderas y asequibles',
    where: 'The Conversation',
    when: 'April 2024',
    url: 'https://theconversation.com/asi-mejoramos-las-pilas-de-hidrogeno-para-que-sean-mas-duraderas-y-asequibles-224576',
  },
  {
    title: 'Science Week · Researchers Night · Día de la Mujer y la Niña en la Ciencia',
    where: 'IMDEA Energy',
    when: '2023 – 2024',
  },
]
