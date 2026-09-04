/* --------------------------------------------------------------------------
   site.js — Contenido de la aplicacion, separado de los componentes.
   Rellenar aqui el guion definitivo (ver docs/ROADMAP_APP_WEB_Y_GUION.md, sec. 5).

   Los textos marcados PLACEHOLDER son de relleno: estructura correcta, prosa
   provisional. Los marcados FINAL vienen del guion ya redactado por Ruben.

   La app va integramente en ingles (decision D8).
   -------------------------------------------------------------------------- */

export const SITE = {
  name: 'ALCheMy',
  tagline: 'Augmented Laboratory for Chemistry & Materials',
  repo: 'https://github.com/RvbbenSN/ALCheMy',
  github: 'https://github.com/RvbbenSN',
  linkedin: 'https://www.linkedin.com/in/rubén-serrano-nieto',
  orcid: 'https://orcid.org/0000-0002-7785-0615',
  email: 'rubbenserrano@gmail.com',
  cv: '/ruben-serrano-nieto-resume.pdf',
}

/* Las 9 pestanas. El orden es la narrativa CRISP-DM y no debe reordenarse
   sin actualizar tambien la tabla 4.2 del roadmap. */
export const SCREENS = [
  { id: '00', slug: '', short: 'Overview', title: 'Overview', crisp: 'Business understanding' },
  { id: '01', slug: 'science', short: 'The Science', title: 'MOFs & Lab Daily-life', crisp: 'Data requirements' },
  { id: '02', slug: 'data-collection', short: 'Data Collection', title: 'The Ingestion Workflow', crisp: 'Data collection' },
  { id: '03', slug: 'data-preparation', short: 'Data Preparation', title: 'ETL & PXRD Signal Processing', crisp: 'Data preparation' },
  { id: '04', slug: 'data-understanding', short: 'Data Understanding', title: 'Exploratory data analysis', crisp: 'Data Understanding' },
  { id: '05', slug: 'modeling', short: 'Modeling', title: 'Training & Evaluation', crisp: 'Modeling · Evaluation' },
  { id: '06', slug: 'the-model', short: 'The Model', title: 'Simulator, Registry & Active Learning', crisp: 'Deployment · Feedback' },
  { id: '07', slug: 'rag', short: 'RAG Assistant', title: 'Scientific Co-pilot', crisp: 'Decision support' },
  { id: '08', slug: 'database', short: 'The Database', title: 'ALCheMy Database', crisp: 'Data governance' },
  { id: '09', slug: 'about', short: 'About', title: 'Bio, CV & Contact', crisp: 'About the author' },
]

/* KPIs: valores auditados el 2026-09-01 contra la base de datos.
   En produccion los sirve GET /api/v1/kpis; estos son el fallback. */
export const KPIS = [
  { value: '2,167', label: 'Syntheses performed', note: 'Five years at the bench' },
  { value: '1,877', label: 'Diffractograms labelled by hand', note: 'The ground truth the model learns from' },
  { value: '2×', label: 'Better than chance at predicting crystallinity', note: 'Macro F1 0.52 against a 0.26 baseline' },
  { value: '87,765', label: 'Literature passages vectorised', note: '956 papers, powering the RAG assistant' },
]

/* FINAL — texto ya redactado por Ruben. */
/* Intro a los tres pilares. Faltaba: se soltaban de golpe sin decir por que son
   tres ni que relacion tienen entre si. */
export const PILLARS_INTRO =
  'The platform is built in three layers: the first gets the data in and keeps it trustworthy; the second learns from it; the third puts what the field already knows next to what the laboratory has measured.'

export const PILLARS = [
  {
    key: 'ingestion',
    title: 'Automated Data Ingestion, Quality & Enterprise Governance',
    subtitle: 'ISO 17025 / FAIR compliant',
    points: [
      '**Orchestrated ingestion pipelines** built with n8n and PostgreSQL capture raw analytical files (PXRD, TGA, gas adsorption, FTIR, VT-XRD, EA, ICP-OES) via secure REST webhooks or forms.',
      '**Cryptographic data quality gates** ensures that every incoming file passes an MD5 deduplication gate that prevents duplicate records and guarantees raw file lineage.',
      '**Instrument parsers** write metadata and 2D curves into indexed JSONB containers, so adding a new technique never requires a schema migration.',
      '**Agentic observability** tracks every AI interaction',
    ],
  },
  {
    key: 'ml',
    title: 'Digital Twin & Machine Learning',
    subtitle: 'From raw diffraction to a synthesis recommendation',
    points: [
      '**Raw powder diffraction patterns** are treated with arPLS to isolate baseline drift while preserving genuine amorphous halos. A 3-sigma Poisson noise model extracts a vector of 29 descriptors.',
      '**Supervised classifiers** (Random Forest and LightGBM) trained on 1,877 hand-labeled diffractograms predict whether a reaction matrix yields a pure crystalline phase, an incipient phase or an amorphous solid.',
      '**A PostgreSQL model registry tracks versions** (binaries, hyperparameters, git commit hashes and cross-validation metrics).',
      '**An active learning loop** identifies high-uncertainty synthesis boundaries and recommends the next experiments.',
    ],
  },
  {
    key: 'rag',
    title: 'Graph-Augmented Hybrid RAG',
    subtitle: 'A co-pilot that cites three sources of truth',
    points: [
      '**A vectorized corpus powered by pgvector** indexes 956 peer-reviewed papers and patents.',
      '**Contextual chunking** prevents loss of chemical meaning across synthetic procedures, stoichiometries and characterization sections.',
      '**A knowledge graph** maps relationships between performed syntheses, their characterization and literature citations.',
      '**Local-first retrieval** with role-based access control keeps proprietary records governed and compatible with fully local deployments.',
    ],
  },
]

export const STACK = [
  ['Python', 'SQL', 'Jupyter', 'PostgreSQL', 'pgAdmin', 'n8n', 'Docker'],
  ['Pandas', 'NumPy', 'SciPy', 'Matplotlib', 'Seaborn', 'Scikit-Learn', 'Streamlit', 'React'],
  ['VS Code', 'Antigravity', 'Claude Code', 'Gemini', 'Ollama', 'Cloudflare', 'Slack'],
]

/* Bio corta. Reescrita a partir del resumen de LinkedIn y del CV, para que
   suene a como Ruben se presenta y no a eslogan. */
/* Dos voces distintas a proposito. En el Overview el lector acaba de llegar y
   agradece una presentacion en primera persona; en el 08 ya ha decidido leer
   un CV y espera el registro profesional. */
export const BIO_SHORT = [
  "Hi! I'm Rubén, a PhD in Advanced Chemistry turned Data Science and AI enthusiast.",
  'For over five years I worked in the laboratory synthesizing new functional materials for sustainability challenges. During thousands of hours at the bench I realized something essential: experiments generate massive amounts of rich data, yet too often it remains trapped in lab notebooks or local disks.',
  'That sparked a genuine idea: bridging the gap between hands-on experimental chemistry and the data lifecycle. I specialize in turning laboratory observations into automated pipelines and machine learning models that drive smarter, faster scientific decisions.',
  'With the recent rise of generative AI, I firmly believe artificial intelligence is not here to replace us but to **augment human potential**. For me it has been a cognitive accelerator, flattening the learning curve across adjacent disciplines — software engineering, MLOps, data science. It does not make anyone a veteran overnight; what it grants is the scaffolding to genuinely understand and connect technical domains at a speed that was not available before.',
]

export const BIO_ABOUT = [
  'My professional focus lies at the intersection of experimental chemistry, data science and artificial intelligence: turning complex scientific data into reproducible pipelines, predictive models and decision-support tools.',
  'As a PhD in Advanced Chemistry I drove the end-to-end development of metal-organic frameworks for sustainability challenges — green hydrogen production, CO₂ valorisation, water treatment, biopolymers. That work meant generating, processing and analysing large datasets from a dozen characterisation techniques, and it is where the problem this platform solves first became obvious.',
  'ALCheMy is that analytical mindset moved into the digital domain: Python, SQL, machine learning and generative AI applied to the same chemistry, with the aim of accelerating materials design and extracting decisions from data that used to sit in a folder.',
]

export const BIO_PULLQUOTE =
  'ALCheMy is itself a living testament to that: agentic pair-programming was instrumental in architecting, coding and building the entire ecosystem from the ground up.'

/* Los cuatro pasos del ciclo de laboratorio. FINAL, del guion. */
export const LAB_CYCLE = [
  {
    step: '1',
    title: 'Planning High-Throughput Synthesis',
    short: 'Plan the plate',
    body: 'Each campaign begins by designing a parameter matrix across 24-well Teflon multi-autoclave reactors: 48 individual weighings per batch, solvent mixtures and modulators, then 24 to 72-hour thermal programs in convection ovens.',
  },
  {
    step: '2',
    title: 'Recovery & Experimental Triage',
    short: 'Filter & triage',
    body: 'After cooling, each of the 24 vials is vacuum-filtered, washed and submitted for powder X-ray diffraction. The verdict is one of three: amorphous solid, incipient (broad reflections near a crystallization boundary), or a well-ordered crystalline phase.',
    highlight: 'These three classes are exactly the target the model learns to predict.',
  },
  {
    step: '3',
    title: 'Scale-Up & Analytical Suite',
    short: 'Scale up',
    body: 'Promising hits are scaled up via solvothermal liners or microwave-assisted synthesis, then characterized by TGA, VT-XRD, elemental analysis, ICP-OES, UV-Vis diffuse reflectance, FTIR and N2/CO2 physisorption.',
  },
  {
    step: '4',
    title: 'Functional Application',
    short: 'Apply it',
    body: 'Purified materials are tested for photocatalytic hydrogen evolution, degradation of emergent pollutants, and heterogeneous CO2 valorization.',
  },
]

/* Las 9 secciones del workflow n8n. FINAL, del guion. */
export const WORKFLOW_SECTIONS = [
  { n: 1, title: 'Entry — three ingestion lanes', adds: 'technique, sample_code, researcher identity, the binary file' },
  { n: 2, title: 'Tags, sample_code & whitelist', adds: 'Normalized fields, authorization gate' },
  { n: 3, title: 'Quality gate', adds: 'file_ext, base64 payload, the real MD5 file_hash' },
  { n: 4, title: 'Routing by technique', adds: 'Nothing — it only decides the downstream path' },
  { n: 5, title: 'Deterministic parsers (7 techniques)', adds: 'The full data_json payload, autonomy level L4' },
  { n: 6, title: 'AI extraction — PDF reports (ICP / EA)', adds: 'Elemental composition, confidence, human-in-the-loop' },
  { n: 7, title: 'AI extraction — Microscopy', adds: 'Qualitative morphology only, never a fabricated particle size' },
  { n: 8, title: 'DB write & response', adds: 'The row itself, plus the reply to the caller' },
  { n: 9, title: 'Governance — fallbacks, audit & errors', adds: 'audit_log with typed verdict, cause and result' },
]

/* Registro de modelos.
   Los HECHOS (algoritmo, F1, tamano, estado, filas) NO viven aqui: se leen de
   src/data/model_scorecard.json, que genera scripts/build_model_scorecard.py
   contra ml_models. Esta tabla estuvo escrita a mano y llego a publicar los dos
   modelos v3 como ACTIVE cuando la web ya servia el v4 -- en la pantalla que
   explica que existe un registro para no fiarse de la memoria.
   Aqui solo queda la frase de cada modelo, que es texto y no dato. Un modelo
   sin frase sale igualmente en la tabla, solo que sin glosa. */
export const MODEL_NOTES = {
  crystallinity_v4_hts_full:
    'The reference model: is there predictive signal in this data at all? First version with the volume units corrected.',
  crystallinity_v4_hts_actionable:
    'Process and medium only. Answers the question the bench actually asks: given this chemistry, which conditions help?',
  crystallinity_v3_hts_full:
    'Same design, but trained before the volume-unit defect was found. Superseded, not wrong to have existed.',
  crystallinity_v3_hts_actionable:
    'The actionable model of the previous generation, kept for comparison.',
  crystallinity_v2_mixed:
    'The highest score on this table, and the reason the table exists. It mixed HTS, ST and microwave syntheses, so it was partly detecting the synthesis method. Marked invalid rather than deleted.',
}

/* Embudo re-derivado el 2026-09-03 de la consulta que el registro guarda para
   el conjunto crystallinity_v4_hts_2026_09_02 (ml_datasets.source_query): se le
   quita un filtro cada vez y la cadena aterriza en las 1.516 filas registradas.
   Los dos primeros escalones cuentan trabajo de laboratorio; del tercero en
   adelante se cuentan filas de la tabla de rasgos, y el texto lo dice. */
/* Texto de la portada (Overview) que estaba escrito directamente en el JSX y
   por eso no paso ninguna de las dos rondas de extraccion (ni SectionTitle/h1,
   ni content/): se quedaba en ingles en /es sin que nada avisara. */
export const OVERVIEW_HERO = {
  leadBefore: 'A materials-informatics and data-driven ecosystem built on agentic AI, data engineering and governed',
  leadAfter: '. It accelerates the discovery of advanced porous materials, enhancing trial-and-error chemistry with guided in-silico screening.',
  ctaPrimary: 'Try the in-silico simulator',
  ctaSecondary: 'See the end-to-end flow',
  kpiFootnote: 'Counts read live from PostgreSQL. Verified 2026-09-01.',
  crispBody: 'Each tab is one phase of the data lifecycle, in the order the decisions were actually made — how the data arrived, how it was cleaned, what it turned out to say, and only then what a model could learn from it.',
}

export const FUNNEL = [
  { n: '2,152', label: 'Rows in the feature table', why: 'Every synthesis the pipeline could turn into features' },
  { n: '1,839', label: 'With a labelled diffractogram', why: 'The rest never reached the diffractometer, or nobody has judged them yet' },
  { n: '1,723', label: 'Verdict usable', why: 'Drops SIN_MUESTRA and anything an expert marked ml_include = NO' },
  { n: '1,540', label: 'Combinatorial only', why: 'Solvothermal and microwave runs excluded — the confounder above' },
  { n: '1,516', label: 'Rows in the training set', why: 'No tannic acid' },
]

/* Glosario para los tooltips. Se generara desde la guia didactica
   (docs/, ver roadmap seccion 6.1); esto es la semilla. */
export const GLOSSARY = {
  MOF: {
    long: 'Metal-Organic Framework',
    text: 'A hybrid solid built from metal ions or clusters joined by organic linkers, forming an extended network riddled with pores. Because both halves can be swapped, its chemistry is tunable by design.',
  },
  PXRD: {
    long: 'Powder X-Ray Diffraction',
    text: 'Shines X-rays on a powder and records how they scatter. Sharp peaks mean an ordered, periodic crystal; a broad hump means a disordered, amorphous solid.',
  },
  arPLS: {
    long: 'Asymmetrically Reweighted Penalized Least Squares',
    text: 'A method that separates the slow, drifting background of a spectrum from the real peaks, without flattening the broad amorphous halo that carries genuine information.',
  },
  MD5: {
    long: 'Message Digest 5',
    text: "A short fingerprint computed from a file's bytes. Two identical files always give the same fingerprint, so it detects a duplicate upload before any compute is spent on it.",
  },
  JSONB: {
    long: 'Binary JSON (PostgreSQL)',
    text: 'A column type that stores a whole nested document and still lets you query inside it. It lets nine different instrument formats share one table without a schema migration each time.',
  },
  SSOT: {
    long: 'Single Source of Truth',
    text: 'One authoritative place where a fact lives. Everything else reads from it rather than keeping its own copy that can silently drift.',
  },
  MLOps: {
    long: 'Machine Learning Operations',
    text: 'The practice of treating a model like production software: versioned, tested, traceable to the exact data and code that produced it, and reproducible months later.',
  },
  'F1 macro': {
    long: 'Macro-averaged F1 score',
    text: 'Averages the F1 score of every class equally, so a rare class counts as much as a common one. With imbalanced data it is far more honest than plain accuracy.',
  },
  pgvector: {
    long: 'pgvector',
    text: 'A PostgreSQL extension that stores embeddings and finds the nearest ones, so semantic search happens inside the same database as the rest of the data.',
  },
  RAG: {
    long: 'Retrieval-Augmented Generation',
    text: 'Before answering, the system retrieves the most relevant passages from a real corpus and gives them to the model, so the answer is grounded in sources rather than recalled from memory.',
  },
  HITL: {
    long: 'Human-in-the-Loop',
    text: 'When an automated step is not confident enough, it stops and asks a person instead of guessing. Here it triggers on low-confidence PDF extractions.',
  },
  BET: {
    long: 'Brunauer-Emmett-Teller',
    text: 'The standard way to turn a gas adsorption isotherm into a specific surface area in square metres per gram — the number that says how porous a material really is.',
  },
  'CRISP-DM': {
    long: 'Cross-Industry Standard Process for Data Mining',
    text: 'A six-phase method for data projects, from understanding the problem to deployment and feedback. The tabs of this site follow it in order.',
  },
}
