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
    when: 'Apr 2026 — present',
    what: "Master's in Applied AI & Process Optimisation",
    where: 'UTAMED (online)',
    detail:
      'Retrieval-augmented generation, vector databases, prompt engineering, natural language to SQL and to code, autonomous agents, Docker and cloud. Mentored by practitioners from Microsoft, Cloudflare, Sanofi and Google.',
    tags: ['In progress', 'RAG & agents'],
  },
  {
    when: 'Jun 2026 — present',
    what: 'IBM Data Science Professional Certificate',
    where: 'Coursera (online)',
    detail:
      'CRISP-DM end to end: Python, SQL, APIs and web scraping, exploratory analysis with pandas and NumPy, and deploying scikit-learn models through Streamlit. The methodology this whole platform is structured around.',
    tags: ['In progress', 'CRISP-DM'],
  },
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
    cites: 25,
    doi: 'https://doi.org/10.1021/acs.chemmater.3c00054',
    note: 'Outperforms the industrial benchmark MIL-125(Ti)-NH₂ in green hydrogen production.',
  },
  {
    title: 'Novel pyrene phosphonate metal-organic frameworks to efficiently degrade sulfamethazine in wastewater',
    journal: 'Journal of Environmental Chemical Engineering',
    year: '2025',
    tag: 'IF 7.2 · Q1',
    cites: 5,
    doi: 'https://doi.org/10.1016/j.jece.2025.115647',
    note: 'Tested on real urban water matrices.',
  },
  {
    title: 'Ca-Triazine Phosphonate Metal-Organic Framework as Fungicide Active Packaging',
    journal: 'Inorganic Chemistry Frontiers',
    year: '2025',
    tag: 'IF 6.4 · Q1',
    cites: 1,
    doi: 'https://doi.org/10.1039/D5QI01619C',
  },
  {
    title: 'Novel Purine Derivative ITH15004 Facilitates Exocytosis through a Mitochondrial Calcium-Mediated Mechanism',
    journal: 'International Journal of Molecular Sciences',
    year: '2022',
    tag: 'IF 5.6 · Q1',
    note: 'From an earlier medicinal-chemistry internship.',
  },
  {
    title: 'Triazine Mg-based Phosphonate Metal-Organic Framework for ε-Caprolactone Polymerization',
    journal: 'Inorganic Chemistry',
    year: '2025',
    tag: 'IF 4.7 · Q1',
    cites: 1,
    doi: 'https://doi.org/10.1021/acs.inorgchem.5c01174',
  },
  {
    title: 'Controlling Band-Bending for Perovskite Optoelectronic Devices Using Bismuth-Based Interlayers',
    journal: 'ACS Omega',
    year: '2025',
    tag: 'IF 4.3 · Q1',
    cites: 1,
    doi: 'https://doi.org/10.1021/acsomega.5c09745',
    note: 'From the Glasgow secondment; also uncovered unexpected memristive behaviour.',
  },
]

/* Media del factor de impacto y citas totales, para no obligar al lector a
   sumar de cabeza. Cifras de Scopus, mayo de 2026. */
export const PUBLICATION_SUMMARY = {
  meanIf: '5.9',
  cites: '31',
  hIndex: '2',
  firstAuthor: '6',
}

export const PROJECTS = [
  'H2-MOF',
  'MOFSEIDON',
  'C-MOF.cell',
  'NAPOLION',
  'H+MOFs',
  'VIRMOF-CM',
]

/* Los contratos competitivos que financiaron ese trabajo, con su dotacion.
   Se listan por referencia oficial y no por acronimo porque es asi como
   aparecen en la memoria: una convocatoria puede financiar varios proyectos.
   PI en todos ellos: Dra. Patricia Horcajada. */
export const FUNDING = {
  intro:
    'Four competitive pre-doctoral contracts under funded research projects, plus collaboration in two more.',
  contracts: [
    { ref: 'FEDER 2014–2020 / OE / REACT-UE 1', budget: '€1.07M', role: 'Pre-doctoral contract' },
    { ref: 'TED2021-132092B-C21', budget: '€206.9k', role: 'Pre-doctoral contract' },
    { ref: 'PID2019-104228RB-I00', budget: '€193.6k', role: 'Work team' },
    { ref: 'PID2022-139956OB-I00', budget: '€181.25k', role: 'Work team' },
    { ref: 'H+MOFs · Fundación Ramón Areces', budget: '€125k', role: 'Pre-doctoral contract' },
    { ref: 'PCI2020-111998 / AEI', budget: '€100k', role: 'Pre-doctoral contract' },
  ],
  total: '€1.88M',
}

export const SKILLS = [
  {
    group: 'Data science & AI',
    items: [
      'Python (Pandas, NumPy, SciPy, Scikit-learn, Statsmodels)',
      'SQL & PostgreSQL',
      'Machine learning',
      'GenAI & prompt engineering',
      'Docker',
      'Plotly, Matplotlib, Seaborn, Streamlit',
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
]
