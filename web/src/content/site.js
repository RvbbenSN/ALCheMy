/* --------------------------------------------------------------------------
   site.js — Contenido de la aplicacion, separado de los componentes.
   Rellenar aqui el guion definitivo (ver docs/ROADMAP_APP_WEB_Y_GUION.md, sec. 5).

   Los textos marcados PLACEHOLDER son de relleno: estructura correcta, prosa
   provisional. Los marcados FINAL vienen del guion ya redactado por Ruben.

   La app va integramente en ingles (decision D8).
   -------------------------------------------------------------------------- */

export const SITE = {
  name: 'ALCheMy',
  tagline: 'Autonomous Lab for Chemistry, Materials & In-Silico Synthesis',
  github: 'https://github.com/RvbbenSN/ALCheMy',
  linkedin: 'https://www.linkedin.com/',
  cv: '/cv/ruben-serrano-cv.pdf',
}

/* Las 9 pestanas. El orden es la narrativa CRISP-DM y no debe reordenarse
   sin actualizar tambien la tabla 4.2 del roadmap. */
export const SCREENS = [
  { id: '00', slug: '', short: 'Overview', title: 'Overview', crisp: 'Business understanding' },
  { id: '01', slug: 'science', short: 'The Science', title: 'MOFs & Lab Daily-life', crisp: 'Analytic approach · Data requirements' },
  { id: '02', slug: 'data-collection', short: 'Data Collection', title: 'The n8n Ingestion Workflow', crisp: 'Data collection' },
  { id: '03', slug: 'data-preparation', short: 'Data Preparation', title: 'ETL & PXRD Signal Processing', crisp: 'Data preparation' },
  { id: '04', slug: 'eda', short: 'EDA', title: 'Exploratory Data Analysis', crisp: 'Data understanding' },
  { id: '05', slug: 'modeling', short: 'Modeling', title: 'Training & Evaluation', crisp: 'Modeling · Evaluation' },
  { id: '06', slug: 'the-model', short: 'The Model', title: 'Simulator, Registry & Active Learning', crisp: 'Deployment · Feedback' },
  { id: '07', slug: 'rag', short: 'RAG Assistant', title: 'IP-Shielded Scientific Co-pilot', crisp: 'Decision support' },
  { id: '08', slug: 'about', short: 'About', title: 'Bio, CV & Contact', crisp: '—' },
]

/* KPIs: valores auditados el 2026-09-01 contra la base de datos.
   En produccion los sirve GET /api/v1/kpis; estos son el fallback. */
export const KPIS = [
  { value: '2,167', label: 'Syntheses performed', note: 'Excludes placeholder rows' },
  { value: '1,877', label: 'Hand-labeled diffractograms', note: '4,964 expert judgements' },
  { value: '29', label: 'Descriptors per pattern', note: 'Extracted from raw signal' },
  { value: '87,765', label: 'Literature chunks vectorized', note: 'From 956 documents' },
]

/* FINAL — texto ya redactado por Ruben. */
export const PILLARS = [
  {
    key: 'ingestion',
    title: 'Automated Data Ingestion, Quality & Enterprise Governance',
    subtitle: 'ISO 17025 / FAIR compliant',
    points: [
      'Orchestrated ingestion pipelines built with n8n and PostgreSQL capture raw analytical files (PXRD, TGA, gas adsorption, FTIR, VT-XRD, EA, ICP-OES) via secure REST webhooks or forms.',
      'Cryptographic data quality gates: every incoming file passes an MD5 deduplication gate that prevents duplicate records, guarantees raw file lineage and eliminates redundant compute.',
      'Polymorphic instrument parsers write metadata and 2D curves into indexed JSONB containers, so adding a new technique never requires a schema migration.',
      'Agentic observability and IP protection: every AI interaction is logged, and confidential ligand formulas are masked before any external LLM call.',
    ],
  },
  {
    key: 'ml',
    title: 'Predictive Digital Twin & Governed Machine Learning',
    subtitle: 'From raw diffraction to a synthesis recommendation',
    points: [
      'Raw powder diffraction patterns are treated with arPLS to isolate baseline drift while preserving genuine amorphous halos. A 3-sigma Poisson noise model extracts a vector of 29 descriptors.',
      'Supervised classifiers (Random Forest and LightGBM) trained on 1,877 hand-labeled diffractograms predict whether a reaction matrix yields a pure crystalline phase, an incipient phase or an amorphous solid.',
      'A PostgreSQL model registry tracks binaries, hyperparameters, exact git commit hashes (including dirty-tree states) and cross-validation metrics under strict CHECK constraints.',
      'An active learning loop identifies high-uncertainty synthesis boundaries and recommends the next physical experiments.',
    ],
  },
  {
    key: 'rag',
    title: 'IP-Shielded Graph-Augmented Hybrid RAG',
    subtitle: 'A co-pilot that cites three sources of truth',
    points: [
      'A vectorized corpus powered by pgvector indexes 956 peer-reviewed papers and patents.',
      'Contextual chunking prevents loss of chemical meaning across synthetic procedures, stoichiometries and characterization sections.',
      'A knowledge graph maps relationships between performed syntheses, their characterization and literature citations.',
      'Local-first retrieval with role-based access control keeps proprietary records governed and compatible with zero-data-retention or fully local deployments.',
    ],
  },
]

export const STACK = [
  ['Python', 'SQL', 'Jupyter', 'PostgreSQL', 'pgAdmin', 'n8n', 'Docker'],
  ['Pandas', 'NumPy', 'SciPy', 'Matplotlib', 'Seaborn', 'Scikit-Learn', 'Streamlit', 'React'],
  ['VS Code', 'Antigravity', 'Claude Code', 'Gemini', 'Ollama', 'Cloudflare', 'Slack'],
]

/* FINAL — bio corta del guion. */
export const BIO_SHORT = [
  "Hi! I'm Rubén, a PhD in Advanced Chemistry turned Data Science and AI enthusiast.",
  'For over five years I worked in the laboratory synthesizing new functional materials for sustainability challenges. During thousands of hours at the bench I realized something essential: experiments generate massive amounts of rich data, yet too often it remains trapped in lab notebooks or local disks.',
  'That sparked a genuine idea: bridging the gap between hands-on experimental chemistry and the data lifecycle. I specialize in turning laboratory observations into automated pipelines and machine learning models that drive smarter, faster scientific decisions.',
]

export const BIO_PULLQUOTE =
  'ALCheMy itself is a living testament to this paradigm: agentic pair-programming was instrumental in architecting, coding and building this entire ecosystem from the ground up.'

/* Los cuatro pasos del ciclo de laboratorio. FINAL, del guion. */
export const LAB_CYCLE = [
  {
    step: '1',
    title: 'Planning High-Throughput Synthesis',
    body: 'Each campaign begins by designing a parameter matrix across 24-well Teflon multi-autoclave reactors: 48 individual weighings per batch, solvent mixtures and modulators, then 24 to 72-hour thermal programs in convection ovens.',
  },
  {
    step: '2',
    title: 'Recovery & Experimental Triage',
    body: 'After cooling, each of the 24 vials is vacuum-filtered, washed and submitted for powder X-ray diffraction. The verdict is one of three: amorphous solid, incipient (broad reflections near a crystallization boundary), or a well-ordered crystalline phase.',
    highlight: 'These three classes are exactly the target the model learns to predict.',
  },
  {
    step: '3',
    title: 'Scale-Up & Analytical Suite',
    body: 'Promising hits are scaled up via solvothermal liners or microwave-assisted synthesis, then characterized by TGA, VT-XRD, elemental analysis, ICP-OES, UV-Vis diffuse reflectance, FTIR and N2/CO2 physisorption.',
  },
  {
    step: '4',
    title: 'Functional Application',
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

/* Registro de modelos. Valores reales de ml_models / ml_datasets. */
export const MODELS = [
  {
    name: 'crystallinity_v3_hts_full',
    algo: 'Random Forest',
    f1: '0.522',
    size: '5.5 MB',
    status: 'ACTIVE',
    note: 'HTS only. 1,516 rows across 68 groups.',
  },
  {
    name: 'crystallinity_v3_hts_actionable',
    algo: 'LightGBM',
    f1: '0.413',
    size: '1.6 MB',
    status: 'ACTIVE',
    note: 'Reduced feature set, servable in public.',
  },
  {
    name: 'crystallinity_v2_mixed',
    algo: 'Random Forest',
    f1: '0.620',
    size: '—',
    status: 'INVALID',
    note: 'Higher score, but it mixed HTS, ST and MW syntheses. Retired for synthesis bias.',
  },
]

/* Embudo verificado el 2026-09-01. Es contenido de la pantalla de EDA. */
export const FUNNEL = [
  { n: '2,167', label: 'Syntheses performed', why: '1,037 placeholder rows excluded' },
  { n: '1,879', label: 'PXRD measurements', why: 'Not every synthesis reached the diffractometer' },
  { n: '1,877', label: 'Labeled diffractograms', why: 'Two left unlabeled' },
  { n: '1,611', label: 'Labeled HTS samples', why: 'Solvothermal and microwave runs excluded' },
  { n: '1,516', label: 'Rows in training set v3', why: 'No tannic acid, no ml_include = NO' },
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
