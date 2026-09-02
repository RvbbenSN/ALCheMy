/* --------------------------------------------------------------------------
   screens.js — Guion redactado de las pantallas 03, 04 y 05.

   Fuente: notebooks/01 y notebooks/06 (secciones 5 a 8). Redactado con tono de
   publicacion pero didactico, como pidio Ruben en la revision del 2026-09-01.

   Vive aparte de site.js porque este contenido es largo y se seguira ampliando
   pantalla a pantalla; site.js se queda con lo global (navegacion, KPIs, bio).
   -------------------------------------------------------------------------- */

/* ==========================================================================
   03 · DATA PREPARATION (ETL)
   ========================================================================== */

export const ETL_STOICHIOMETRY = {
  intro:
    'Modulators reach the reactor in two physically different forms, and each needs its own arithmetic. Treating them alike is what caused the worst defect in the entire dataset.',
  typeA: {
    title: 'Type A — aqueous molar solutions',
    body: 'HCl, HF and KOH are dosed as solutions of known molarity, so the active amount follows directly from volume times concentration.',
    formula: 'mmol = V(mL) × M',
  },
  typeB: {
    title: 'Type B — neat organic liquids',
    body: 'Formic, acetic, propionic, trifluoroacetic, triflic and methanesulfonic acids, plus triethylamine, are pipetted pure. The amount has to be reconstructed from density, purity and molecular weight.',
    formula: 'mmol = V(µL) × ρ(g/mL) × P(%) / (100 × MW)',
  },
}

export const ETL_THERMAL = {
  title: 'Parsing thermal ramps written in prose',
  body: 'The master spreadsheet recorded thermal programs as free text. They are parsed into initial, target and final temperature, plateau hours, and two slopes in °C per minute. Microwave runs that record "asap" cooling are assigned a 10-minute fan cooldown with no plateau, because the alternative — leaving them null — would silently drop every microwave synthesis from any feature that uses the cooling rate.',
  formulas: [
    'heating rate = (T_target − T_initial) / (t_heating × 60)',
    'cooling rate = (T_target − T_final) / (t_cooling × 60)',
  ],
}

export const ETL_DEFECTS = [
  {
    n: 1,
    defect: 'Neat liquid modulators stored as µmol but labelled mmol — a factor of 1,000',
    found: 'The median formic acid value read 1,168 "mmol", which is 54 g of formic acid in a 2.5 mL reactor. Physically impossible.',
    fix: 'Formula corrected in notebook 01; stored values divided by 1,000.',
  },
  {
    n: 2,
    defect: 'Adding mmol to µmol erased HCl from the strong-acid feature',
    found: 'A consequence of defect 1: HCl contributed ~0.004 against TFA at ~600.',
    fix: 'With coherent units, the most-used modulator in the whole dataset — 393 syntheses — becomes visible to the model again.',
  },
  {
    n: 3,
    defect: 'Synthesis type absent as a variable, while being the largest confounder',
    found: 'Microwave runs are 95.7% crystalline against 11.0% for combinatorial screening.',
    fix: 'Restrict training to high-throughput synthesis only.',
  },
  {
    n: 4,
    defect: '1-propanol and DEF missing from the feature view',
    found: 'Solvent fractions summed to 0.789 instead of 1.',
    fix: 'All six solvents included.',
  },
  {
    n: 5,
    defect: 'The liquid modulator is sometimes the solvent, and was not counted as medium',
    found: 'After fixing defect 4 the volume still did not close. One synthesis used 1.35 mL of propionic acid out of 1.5 mL total.',
    fix: 'A modulator fraction reconstructed from the millimoles.',
  },
  {
    n: 6,
    defect: 'HF grouped with HCl despite a different chemical role',
    found: 'Chemical argument: HF is a mineralising agent, and some frameworks only crystallise in its presence.',
    fix: 'Its own column, 25 syntheses.',
  },
  {
    n: 7,
    defect: '22 rows lost their ionic radius to a non-breaking space',
    found: 'A U+00A0 character inside precursor strings such as "MgCl2 · 6H2O" stopped them matching the lookup table.',
    fix: 'The join was normalised, rather than adding typographic variants by hand — that is a race you do not win.',
  },
]

export const ETL_ZERO_VS_NULL = {
  title: 'The correction that mattered more than the seven',
  body: 'Wherever the solvent breakdown failed to account for the total volume — about 18% of rows — the fractions were being stored as 0. They are now NULL, with an explicit completeness flag.',
  pullquote:
    'Writing a 0 where the value is unknown is not neutral: it asserts something false. "This synthesis contained no methanol" and "how much methanol it contained was never recorded" are different statements, and a model given a 0 has no way to tell them apart.',
}

export const ETL_EXCLUSION = {
  title: 'Exclusion as a label, never as a deletion',
  body: 'Counting rows returned more than counting distinct samples: 43 samples had more than one PXRD measurement labelled separately — one as-recovered and one washed, a re-scan, a refinement. Keeping them would have entered the same physical sample several times. A further 70 amorphous measurements carried intense oxide reflections, which would contaminate the amorphous class with a pattern that is genuinely crystalline, just not of the target product.',
  decision:
    'All 113 were reviewed one by one and then marked, not deleted. A new label ml_include = NO records the exclusion; the absence of that label means included.',
  pullquote:
    'In a scientific data store, **deleting destroys evidence and labelling preserves it**. A discarded label is still real human judgement about a real file.',
}

export const ETL_TANNIC = {
  title: 'Tannic acid: a chemical decision, then confirmed by measurement',
  body: '24 samples used tannic acid, a polyphenol and the only non-phosphonate chemistry in the record. Its denticity is not well defined — with roughly 25 phenolic hydroxyls there is no meaningful number of binding "teeth". The argument for removing them is chemical and comes first: 24 samples are not enough for a model to learn a separate chemical family, and their presence forces the linker descriptors to describe two incompatible things at once.',
  measure: 'Removing them raises macro F1 from 0.495 to 0.527, and MCC from 0.266 to 0.312.',
  caution:
    'Choosing what to remove because it improves the metric is a way of cheating: the number can always be raised by dropping the hard cases. Here the order was the right one — **chemical argument first, verification second** — and that is what makes the exclusion legitimate. Had the criterion been "let us try removing things and see what goes up", the result would be worth nothing.',
}

export const ETL_IMPUTATION = {
  title: 'Imputation: tested, not assumed',
  body: 'Numeric gaps are filled with the median and categorical ones with the mode — always inside the cross-validation pipeline, never before it.',
  leak: 'Imputing with the median of the whole dataset before splitting leaks information from the test fold into training: the test rows would have helped compute the median used on them. It is a subtle leak that inflates the result while nothing appears to fail. Inside the pipeline, each fold computes its median from its own data only.',
  tableHead: ['Configuration', 'F1 macro', 'MCC'],
  tableRows: [
    ['Random Forest, simple imputation', '0.496', '0.274'],
    ['Random Forest, missingness flagged', '0.495', '0.266'],
    ['SVM, simple imputation', '0.471', '0.275'],
    ['SVM, missingness flagged', '0.458', '0.258'],
  ],
  conclusion:
    'Flagging which values were missing adds nothing, so the simple version stays. That is worth recording precisely because it is a negative result: knowing that missingness is not informative means the gaps are recording accidents, not a pattern with chemical meaning.',
}

/* ==========================================================================
   04 · DATA UNDERSTANDING (EDA)
   ========================================================================== */

/* Que es un EDA, antes de hacer uno. La pestana se llama "Data Understanding"
   porque es el nombre de la fase en CRISP-DM, pero el trabajo que hay dentro se
   conoce en todas partes por sus tres siglas, y quien las busque tiene que
   encontrarlas aqui. */
export const EDA_INTRO = {
  acronym: 'EDA',
  expansion: 'Exploratory Data Analysis',
  what:
    'Looking at the data before modelling it. Nothing more than that: plotting every variable, counting what is missing, checking whether the classes are balanced and whether two columns say the same thing twice — **before** committing to an algorithm.',
  why:
    'It is the stage that returns the most per hour invested, and the one most often skipped, because it produces no model and no metric. What it produces is **decisions**: which rows to drop, which columns cannot be trusted, and which apparent signal is an artefact of how the data was collected rather than a property of the chemistry.',
  rule:
    'The rule that governs it: **a model cannot warn you about a problem it has learned to exploit.** If a confounder is in the training data, cross-validation will reward the model for using it. The only place to catch that is here, by looking.',
  found: [
    ['A confounder', 'One synthesis method had produced no amorphous samples at all — so the method itself predicted the answer'],
    ['Five kinds of gap', 'Nine per cent missing, from five unrelated causes, each needing a different fix'],
    ['A 5.8 : 1 imbalance', 'Between the largest and smallest class, enough to make accuracy meaningless'],
    ['Hidden structure', 'Rows that are not independent of one another, which makes a random split lie'],
  ],
}

/* Las cifras de esta pantalla pueden referirse a dos poblaciones distintas, y
   mezclarlas es la causa de que varios numeros parezcan contradecirse. Se dice
   una vez, arriba, y se mantiene. Auditado el 2026-09-02. */
export const EDA_POPULATION = {
  title: 'Which rows are we counting?',
  intro:
    'Two numbers in this screen can both be right and still disagree, because they count different things. It is worth fixing which is which before anything else.',
  rows: [
    ['2,152', 'The feature table', 'Every synthesis on record, including the methods the model does not use'],
    ['1,786', 'Restricted to high-throughput', 'The universe the model works in, before requiring a label'],
    ['1,516', 'The training set', 'What actually trained the model: combinatorial synthesis, with an expert verdict'],
  ],
  note:
    'Everything below refers to **the training set** unless it says otherwise. When a figure quotes the full table instead, it says so.',
}

export const EDA_CONFOUNDER = {
  title: 'The confounder that nearly ruined the analysis',
  intro:
    'The record holds three ways of making a material, and version 2 of this analysis mixed them without looking. The numbers:',
  tableHead: ['Synthesis type', 'Amorphous', 'Crystalline', 'Incipient', '% crystalline'],
  tableRows: [
    ['HTS — combinatorial screening', '401', '169', '971', '11.0%'],
    ['ST — standard solvothermal', '3', '71', '15', '79.8%'],
    ['MW — microwave-assisted', '0', '90', '4', '95.7%'],
  ],
  shortcut:
    '**Zero amorphous samples in microwave**. A model trained on all three mixed together has an enormous shortcut available: if it detects — even indirectly, through reactor volume or year — that a synthesis was microwave-assisted, it can answer CRYSTALLINE and be right 96% of the time. Those 94 microwave cases were 5% of the dataset but 27% of the entire crystalline class.',
  bias:
    'And this is not an effect of the method: it is **selection bias**. Combinatorial screening is exploratory — conditions are swept without knowing what will come out, so it is full of failures. Standard and microwave synthesis are used once you already know the recipe works and want to scale or accelerate it. The variable "synthesis type" largely encodes "did you already know this was going to work?". Predicting that is not chemistry, it is reading the lab history.',
  thermal:
    'There is also an independent thermal argument, which would hold even without the bias: microwave heating is localised and fast, which favours kinetic phases over thermodynamic ones. The relationship between conditions and product is not the same function in a microwave as in an oven. Mixing them forces the model to learn two physics as if they were one.',
  decision: [
    'It is the only subset without success bias: it was designed to explore, not to confirm.',
    'It is what we actually want to predict — the next plate is an HTS plate.',
    'It is a single thermal regime, so the model learns one physics, not two.',
  ],
  price:
    'The price is real and gets stated: 90 of the 330 crystalline cases are lost, 27%, and the minority class becomes scarcer still. It is paid deliberately. **A lower, honest F1 is worth more** than a high one that is really detecting the synthesis method.',
}

export const EDA_MISSING = {
  title: 'Missing values: five causes, five different fixes',
  intro:
    '"9% missing" is a reassuring figure that hides unrelated problems. A gap can mean "not measured", "does not exist", or "the record is internally inconsistent" — and only the first resembles what imputation assumes. Of the five causes below, **only one was a mistake made by this project**.',
  tableHead: ['Property', 'Who is missing', 'Why', 'What was done'],
  tableRows: [
    [
      'Allen electronegativity',
      'Ce, La, Nd, Dy',
      'The Allen scale is spectroscopic and is not defined for lanthanides',
      'Column dropped. This is not a gap — the quantity does not exist. Pauling covers all 20 metals and stays',
    ],
    [
      'Absolute hardness',
      'Mg, Zn',
      'η = (IE − EA)/2, and there is no measured electron affinity: their closed shells do not bind an extra electron',
      'Imputed, knowing it is imperfect',
    ],
    [
      'Kepp oxophilicity',
      'Ga',
      'Absent from the original paper — only B, Al and In of group III appear',
      'Permanent, documented null',
    ],
    [
      'Oxidation state, ionic radius',
      '22 rows',
      'A non-breaking space (U+00A0) in the precursor text — **the only one of the five that was our own bug**',
      'Fixed by normalising the join, not by hand-listing variants',
    ],
    [
      'Mean carboxylic pKa',
      '70% of rows',
      'Not a fault: those syntheses carry no carboxylic modulator, and "no acid" has no pKa',
      'Imputed; flagging it was tested and adds nothing',
    ],
    [
      'Solvent fractions',
      '18% of rows',
      'The volumes written down do not add up to the total volume declared',
      '**NULL, not 0**',
    ],
  ],
  /* La objecion natural de quien llevo el Excel, y por que no aplica. El texto
     anterior decia "el registro guardo el total pero no el desglose", que solo
     describe 20 de las 452 filas; en las otras 431 el desglose SI esta y lo que
     pasa es que no cuadra. */
  zeroTitle: 'An empty cell does read as zero — that is not what the null is about',
  zeroBody:
    'The obvious objection is that a blank cell in the master spreadsheet means "none of that solvent", not "unknown". **And the pipeline agrees**: it reads every blank solvent column as zero, with an explicit `COALESCE(column, 0)`. The null appears afterwards, for a different reason.',
  zeroDetail:
    'After turning every blank into a zero, the volumes are added up and compared with the total volume declared for that synthesis. In **431 of 452 flagged rows** the components are written down and simply do not reach the total. Sample RS1873 declares 15 mL of reaction and records 15 µL of water. Reading the rest as zeros there does not give "a synthesis without methanol": it gives **a synthesis without solvent**, which is impossible. Only 20 rows are the other case — a total with nothing itemised — and those are equally impossible for the same reason.',
  zeroRule:
    'So the flag does not distrust the chemist. It distrusts arithmetic that does not close: **a zero is a claim, a gap is not, and a model cannot tell them apart if it is handed a zero.**',
  lesson:
    'That is the underlying lesson of the whole table. Telling a model "this synthesis contained no methanol" when the truth is "the record of what it contained is incomplete" is feeding it a falsehood dressed as data.',
}

/* De donde salen las dos columnas de modulador que el lector va a preguntar,
   con los dos matices que un quimico veria enseguida. */
export const EDA_MODULATORS = {
  title: 'Where the modulator descriptors come from',
  problem:
    'Ten columns of acids, nearly all zero in any given row, would let the model memorise which plate used which reagent instead of learning chemistry.',
  fix:
    'So they were **grouped by chemical role** — carboxylic, strong acid, HF, base, fluorinated — and summed. To avoid losing the chemistry that the sum discards, two extra columns carry the **mean pKa and mean logP of the acids present, weighted by how much of each was added**.',
  formula: 'mod_carbox_mean_pka = (3.75·formic + 4.76·acetic + 4.87·propionic) / total carboxylic mmol',
  consequence:
    'Which explains the gap directly: when a synthesis carries no carboxylic modulator the denominator is zero and the mean does not exist. That is 70% of the training set, and the correspondence is exact — **not one row** has a null pKa while carrying carboxylic acid.',
  caveats: [
    {
      title: '"Carboxylic" here means "weak carboxylic"',
      body: 'Trifluoroacetic acid **is** a carboxylic acid, but it was grouped with the strong acids, because the grouping criterion was pKa rather than functional family — at pKa 0.23 it behaves like a strong acid, not like a modulator. 82 syntheses. The chemistry is defensible; the column name is not entirely.',
    },
    {
      title: 'These two values have no cited source',
      body: 'The pKa and logP values are standard aqueous figures at 25 °C written directly into the SQL. Every other chemical property in the model — electronegativity, hardness, oxophilicity, ionic radius — is traceable to a reference in a `property_sources` table. **These two are the exception**, and saying so is cheaper than being caught.',
    },
  ],
}

export const EDA_IMBALANCE = {
  title: 'The target: how much imbalance there is',
  /* La pregunta era "desequilibrio entre que". Se responde con la tabla, no con
     una frase: son las tres clases de cristalinidad que etiqueto Ruben a mano. */
  intro:
    'The imbalance is **between the three crystallinity classes** — the verdict a human gave each diffractogram, and the thing the model has to predict. They are not equally common, and that is a property of the chemistry, not a sampling error: most attempts land somewhere in between.',
  tableHead: ['Class', 'What it means', 'Samples', 'Share'],
  tableRows: [
    ['Incipient', 'Broad reflections near a crystallisation boundary', '967', '64.1%'],
    ['Amorphous', 'No reflections at all', '382', '25.3%'],
    ['Crystalline', 'Sharp, well-ordered reflections', '160', '10.6%'],
  ],
  trivial:
    'That first row is the whole problem. A model that learns nothing — one that always answers **INCIPIENT** — is right 64% of the time. Reporting "64% accuracy" would sound like the model does something, when it would do nothing at all. This is why every metric on the next screen is compared against that floor rather than against zero.',
  ratio:
    'The gap between the largest and smallest class is **6 : 1**, and it is sharper than over the whole record, because restricting to high-throughput synthesis removed material that was almost entirely crystalline. It is handled by **weighting the classes inside each model**, which is simpler than resampling and does not invent samples that were never made.',
}

export const EDA_DISCRETE = {
  title: 'The process variables are **discrete in practice**',
  /* Los valores concretos, que era la peticion: decir "unos 13 valores" no
     permite juzgar nada. Medidos sobre el conjunto de entrenamiento. */
  body: 'A continuous variable on paper is not continuous in the record. Over the training set, three of the main process variables take these values and no others:',
  tableHead: ['Variable', 'Distinct values', 'Which ones'],
  tableRows: [
    ['temp_target_c', '9', '80 · 100 · 110 · 120 · 130 · 135 · 140 · 150 · 160 °C'],
    ['lm_ratio', '8', '0.15 · 0.20 · 0.30 · 0.33 · 0.50 · 0.60 · 0.80 · 1.00'],
    ['time_hours', '3', '24 · 48 · 72 h'],
  ],
  concentration:
    'And they are not evenly used either: **816 of the syntheses sit at 150 °C** and 442 at 120 °C, so two settings cover more than four fifths of the record.',
  why:
    'That is not a defect in the data. It reflects how combinatorial synthesis is actually designed — **fix a grid of conditions and sweep composition** — and a chemist filling a 24-well plate picks round numbers.',
  consequence:
    'But it carries a consequence that returns at the interpretation stage: **a variable that was barely varied cannot explain much variance, however important it is chemically**. Reaction time has three values; if the model says it does not matter, that is a statement about this record, not about chemistry.',
}

export const EDA_CORRELATION = {
  title: 'Correlation: two different questions, and only one usually gets plotted',
  questions: [
    {
      title: 'Do two input variables move together?',
      lead: 'This one is about **interpretation**, not about performance.',
      points: [
        ['What to look for', 'Not zero correlation — knowing **where** it is not zero.'],
        ['Why it matters', 'Two columns carrying nearly the same information make the model **split the credit between them arbitrarily**. Reading "this variable barely matters" would then be a mistake: it matters, but its twin took the credit.'],
        ['What is done about it', 'The final interpretation is read **by chemical block**, never variable by variable.'],
      ],
      note:
        'A map with red blocks is not a problem. Here they are mostly properties of the same metal, correlated **by physics**: the electronegativity and hardness of a cation are not independent in nature.',
    },
    {
      title: 'Does each variable relate to the target?',
      lead: 'This is the one you **do** want to be high — it is literally the signal the model will exploit.',
      points: [
        ['Why Pearson does not apply', 'The target is **categorical with three levels**, not a number. A Pearson coefficient between "amorphous" and a temperature is undefined.'],
        ['What is used instead', 'The correlation ratio **η²** for numeric against categorical, and **Cramér\'s V** for categorical against categorical.'],
        ['How to read it', 'Both are plotted below, on the same scale, so a weak association looks weak.'],
      ],
    },
  ],
  /* Las casillas en blanco: la pregunta que se hizo Ruben y se hara cualquiera. */
  blankTitle: 'The blank cells are not missing data',
  blankBody:
    'A white square in the map means the correlation **is not defined**, not that the value was lost. It happens when a variable has **no variance** in this subset: `reactor_volume_ml` is 2.5 mL in every single high-throughput synthesis, so its standard deviation is zero and every correlation involving it divides by zero.',
  blankConsequence:
    'It also has a corollary worth stating, because it is the textbook case of the point made just above: since the reactor is always 2.5 mL, **`fill_fraction` is exactly `total_volume_ml / 2.5`**. The two columns are the same variable rescaled — perfect collinearity, verified across all 1,516 rows, not an approximation. Neither can be credited independently, and that is precisely why importance is read by block.',
  causation:
    '**Correlation is not causation**. These plots measure whether two things move together, nothing more. That temperature appears associated with crystallinity does not demonstrate that raising it causes crystallisation: they may share a common cause, or it may be a coincidence of this particular record. Establishing causation requires intervening — changing only the temperature and seeing what happens — which is precisely what the model suggests where to do, not what it proves.',
}

export const EDA_LEAKAGE = {
  title: 'Hidden structure: why a random split would lie',
  body: 'The rows of this dataset are **not independent of one another**. Samples come in plates: batches prepared on the same day, with the same linker, the same thermal ramp and often the same metal, sweeping one variable. And the plates are internally homogeneous — knowing one sample from a plate tells you almost the outcome of its neighbours.',
  consequence:
    'A random split would put samples from the same plate in both training and test. The model would not need to learn any chemistry: **recognising the plate would be enough**. The score would come out inflated and false. Validation therefore groups by plate, so no plate ever appears on both sides.',
  /* Recordatorio del desequilibrio, porque aqui es donde se combina con el
     agrupamiento y donde mas dano hace. */
  reminder:
    'And this compounds with the imbalance from two sections ago. With **64% of samples incipient** and whole plates that are almost uniformly one class, a lucky split can hand the test set a plate that is 90% incipient — where the do-nothing baseline scores 90% and any model looks brilliant. Grouping by plate is what stops the split from choosing its own difficulty.',
  drift:
    'There is temporal drift too: the class proportions change year on year, because the laboratory was learning. Counts are annotated on every bar deliberately — **a proportion without its sample size misleads**. A year with seven samples would show a 100% bar that means nothing.',
}

export const EDA_PCA = {
  title: 'A global look: the PCA projection',
  disclaimer: 'This is a diagnostic, not a model.',
  /* Faltaba decir que es un PCA antes de contar como se aplico, y aclarar de
     que variables se habla: son las de SINTESIS, no los 29 descriptores. */
  whatTitle: 'What a PCA does, in one paragraph',
  what:
    'Each synthesis is a point in a space with as many dimensions as it has variables — impossible to look at. PCA finds the **direction along which the points are most spread out**, calls it the first component, then the most spread-out direction perpendicular to that one, and so on. Projecting onto the first two gives a flat picture that keeps as much of the original spread as any flat picture can. It is a **change of viewpoint**, not a summary: nothing is discarded, the cloud is only turned to be seen from its widest side.',
  varsNote:
    'The variables here are the **synthesis conditions** — 38 columns of metal properties, linker properties, solvent fractions, thermal ramp and modulators — not the 29 PXRD descriptors. Those describe the *outcome*; these describe what was *done*, and the question is whether what was done already separates the outcomes.',
  steps: [
    'The numeric synthesis variables are standardised after imputation. Without this, reaction time (up to 96) would crush a solvent fraction (0 to 1) purely through the scale of its units, and the result would measure the choice of units rather than the chemistry.',
    'The direction of maximum variance is found in that space. That direction is a linear combination of every variable — not a subset — and becomes the first component. Then the direction of maximum remaining variance perpendicular to it, and so on.',
    'The samples are projected onto those components so they can be drawn.',
  ],
  honest:
    'None of this decides which variables to collapse: PCA uses all of them and, crucially, **does not know the classes** — it is unsupervised. The colours are painted on afterwards. That is what makes it an honest diagnostic: if the classes come out separated, it is real structure in the synthesis conditions, not something the method went looking for.',
  findings: [
    'There is structure, but the classes overlap heavily. The problem is genuinely multivariate and genuinely hard.',
    'Adding a third component reveals no hidden separation. That is a useful negative result: there is **no plane that separates the classes**, which already predicts that no linear model will shine.',
    'Reaching 90% of the variance takes many components. The information is spread across many variables rather than concentrated in two or three — so reducing dimensionality before modeling would throw away signal, and PCA is not used in the final pipeline.',
  ],
}

export const EDA_BIVARIATE = {
  title: 'Does any single variable separate the classes?',
  /* "A que te refieres con descriptores" — habia que decirlo. */
  whichTitle: 'Which variables are being tested here',
  which:
    'The **29 PXRD descriptors**: the numbers extracted from each diffractogram on the previous screen — peak count, crystalline fraction, peak width, entropy, signal-to-noise and the rest. Not the synthesis conditions. The question is whether any single measurement taken *from the pattern* is enough, on its own, to tell the three classes apart.',
  ordering:
    'They do order the classes, and cleanly: every descriptor tested rises or falls **monotonically** from amorphous through incipient to crystalline. That is the reassuring half of the picture — the numbers agree with the human verdicts about the direction of the effect.',
  body: 'But ordering is not separating. The boxes **overlap for every variable tested**: an incipient sample and a crystalline one can share the same peak count, the same width, the same entropy. That is not bad news — it is the definition of a multivariate problem, and exactly why a model is needed instead of a threshold. If one variable separated the classes cleanly, machine learning would be unnecessary: a rule would do.',
}

/* ==========================================================================
   05 · MODELING
   ========================================================================== */

export const MODEL_LINEUP = {
  intro:
    'Ten models are compared, not one. Not out of indecision: different model families assume different things about the shape of the boundary between classes, and with a new problem there is no way to know in advance which assumption is right. **Comparing is more honest than betting**.',
  tableHead: ['Model', 'What it assumes', 'Why it is here'],
  tableRows: [
    ['Baseline (majority class)', 'Nothing: always the most frequent class', 'The bar. Everything else must clear it'],
    ['Logistic regression', 'A linear boundary', 'Interpretable reference; if it suffices, it wins'],
    ['k-nearest neighbours', 'Similar samples share an outcome', 'Purely local, with no global model'],
    ['Naive Bayes', 'Variables independent given the class', 'Its failure measures how much the correlation structure matters'],
    ['SVM (RBF kernel)', 'A smooth non-linear boundary', 'Strong in medium dimension with few samples'],
    ['Decision tree', 'Threshold cuts, one at a time', 'Interpretable; the basis of what follows'],
    ['Random Forest', 'Many decorrelated trees', 'Robust, insensitive to hyperparameters'],
    ['HistGradientBoosting', 'Sequential trees correcting each other', 'Handles missing values natively'],
    ['LightGBM', 'Optimised boosting', 'The industry reference'],
    ['XGBoost', 'Boosting with regularisation', 'Standard comparison'],
  ],
}

export const MODEL_VALIDATION = {
  title: 'Validation grouped by plate',
  body: 'Stratified group k-fold with five folds does two things at once. The grouping guarantees that no plate appears in both training and test — without it the model would pass by recognising the plate instead of the chemistry. The stratification keeps the class proportions in every fold, so no fold ends up with almost no crystalline samples.',
}

export const MODEL_TWO = {
  title: 'Two models, not one',
  objection:
    'The linker does not make a metal crystallise; the linker determines which material can exist at all. Changing it is not moving a reaction condition — it is changing chemistry.',
  body: 'That objection is correct, and it has consequences. The variables split in two: design variables (the chemistry of metal and linker), which can be changed but changing them changes the research target; and process variables (concentration, ligand-to-metal ratio, temperature, time, ramps, modulators, solvents), which can be changed within the same chemistry.',
  full: 'The full model answers: is there predictive signal in this data at all?',
  actionable:
    'The actionable model, stripped of metal and linker chemistry, answers: given this chemistry, which conditions make it crystallise? That is the question that helps design the next plate.',
  note: 'The difference between the two is itself a result.',
}

export const MODEL_METRICS = {
  tableHead: ['Metric', 'What it measures', 'Why it is here'],
  tableRows: [
    ['F1 macro', 'The mean F1 of each class, weighting all three equally', 'The headline metric. Ignoring the 167 crystalline samples sinks it'],
    ['Balanced accuracy', 'Mean accuracy within each class', 'Directly interpretable: "it gets X% of the crystalline ones right"'],
    ['MCC', 'Correlation between prediction and truth, −1 to +1', 'The most demanding: 0 means chance, however high the accuracy'],
    ['Accuracy', 'Percentage correct', 'Present only as a warning: the trivial baseline already scores ~64%'],
  ],
  note: 'Mean relative error, RMSE and R² do not apply here. They belong to regression and measure distance to a number. In classification you either get the class right or you do not.',
}

export const MODEL_FINDINGS = [
  {
    title: 'There is real predictive signal, and it is more modest than it looked',
    body: 'The best full model reaches a macro F1 of about 0.52 against 0.26 for the baseline — twice as good. MCC lands near 0.31: a real association, but far from strong.',
  },
  {
    title: 'The earlier figure of 0.62 did not measure what it appeared to',
    body: 'The drop from 0.62 to 0.52 corresponds precisely to the removal of microwave and standard solvothermal syntheses — that is, to the portion of the score that derived from identifying the synthesis method rather than the chemistry. Quantifying that difference is **arguably the most useful outcome of this stage**.',
  },
  {
    title: 'The actionable model drops further, and that answers the objection',
    body: 'Without metal and linker chemistry the best model falls to about 0.41 with MCC near 0.13: above chance, but weak. In plain terms, most of what the model distinguishes in this record is which metal-linker system was used, not which conditions were applied.',
    caveat:
      'This does not mean conditions are chemically unimportant. It means that in this data they were not varied enough for their effect to be learnable — about 13 temperatures and 9 reaction times across the whole record. The suspicion that the linker was acting as the directing variable was correct, and it is now measured.',
  },
  {
    title: 'Tree-based models now win',
    body: 'In the earlier version, with the dirty variables, k-nearest neighbours and SVM came out on top. With the variables corrected, Random Forest and LightGBM move ahead. That is coherent: methods that build boundaries from thresholds benefit from variables that genuinely mean what they say.',
  },
  {
    title: 'Naive Bayes sinks below the baseline',
    body: 'Not an implementation failure: it assumes the variables are independent given the class, and the correlation map showed strong blocks. Its failure is a measurement of how much that correlation matters — which is why it is on the list at all.',
  },
]

export const MODEL_ERRORS = {
  title: 'Where it goes wrong, and whether the errors make chemical sense',
  intro:
    'A confusion matrix says far more than any single metric. What matters is not how much the model fails but in which direction. The ordinal pattern holds clearly one way and only half-way the other.',
  tableHead: ['True class', '→ neighbouring class (incipient)', '→ opposite extreme'],
  tableRows: [
    ['Amorphous', '44.6%', '5.9% to crystalline'],
    ['Crystalline', '28.1%', '21.9% to amorphous'],
  ],
  amorphous:
    'For amorphous samples the behaviour is what you would hope: when it fails, it confuses "nothing" with "almost nothing", which in the diffractogram itself is a matter of degree and something two experts could disagree about. The severe error — calling an amorphous sample crystalline — is rare.',
  crystalline:
    'For crystalline samples it is not. One in five crystalline samples is classified as amorphous, the most serious error available. That is not a clean ordinal pattern: it means the model does not recognise the minority class well, and when it loses it, it loses it completely. With 167 cases against 967 incipient ones, and being the most heterogeneous class — there are many ways to crystallise and only one way not to — it was the predictable outcome, but predictable does not stop it being the model\'s main weakness.',
  usage:
    'For the intended use — ranking candidates and filling the next plate — this matters less than it appears: what is needed is for good candidates to rise in the ranking, not for the label to be exact. But it refutes any reading along the lines of "the model rarely makes a serious mistake". It makes a serious mistake on **22% of crystalline samples**, and that has to be accounted for.',
}

export const MODEL_CHEMISTRY = {
  title: 'The chemical reading, by block rather than variable by variable',
  why: 'With strongly correlated variables, any importance method splits the credit arbitrarily. Interpreting Pauling electronegativity in isolation from absolute hardness would be over-reading. The block-level split is the defensible reading.',
  blocks: [
    {
      name: 'Metal chemistry',
      rank: 'Dominant, by a wide margin',
      body: 'It enters through ionic radius and charge-over-radius — that is, the **charge density** of the cation, which governs the strength of the metal-phosphonate interaction and with it whether the system has time to order or precipitates amorphous. A result with direct physical meaning, not an artefact.',
    },
    {
      name: 'Process conditions',
      rank: 'Second, ahead of linker chemistry',
      body: 'This qualifies the easy reading of the headline numbers. Conditions do contribute, but only in combination with the chemistry: the actionable model, which uses them alone, stalls at 0.41. Temperature and time help decide within a metal-linker system, not between systems. Both statements are true and have to be read together.',
    },
    {
      name: 'Stoichiometry and reaction medium',
      rank: 'Negative importance overall',
      body: 'Not a calculation error: shuffling those variables slightly improves the model, which is the operational definition of noise. It has an identifiable cause — the 18% of rows with no solvent breakdown — and a practical consequence: they are candidates for removal next time round, and their real value will not be known until the medium is recorded completely.',
    },
  ],
  caution:
    'Permutation importance tends to split and to understate when variables are correlated: if two columns say almost the same thing, shuffling one barely hurts the model because the other covers the gap. So the absolute values should not be read as "percentage of the chemistry explained", and the block-level split is more reliable than any individual variable.',
  distinction:
    '"It does not matter" and "it was not explored" are different things, and only the second is actionable. The model is not saying temperature is irrelevant to phosphonate crystallisation — that would be chemically absurd. It is saying that in this record it **was not varied enough to be learnable**. That turns a negative result into a concrete experimental instruction.',
}

/* Valoracion del rendimiento. Tono de discusion de articulo: se declara la
   limitacion, se identifica su causa, y se propone el experimento que la
   resolveria. Sin dramatizar y sin disculparse. */
export const MODEL_ASSESSMENT = {
  title: 'An honest reading of the performance',
  lead:
    'The full model roughly doubles the trivial baseline and reaches a Matthews correlation of 0.31 — a real but moderate association. Two features of these results deserve to be stated plainly rather than left for the reader to infer.',
  points: [
    {
      title: 'Half of the crystalline syntheses are not recovered',
      body: 'Recall on the crystalline class is 0.50. Since the purpose of the tool is to shortlist promising conditions, this is the figure that governs its practical value, and it is a meaningful limitation. It is also the expected consequence of a class with 167 examples against 967 incipient ones, and of that class being the most heterogeneous: there are many ways for a framework to crystallise and only one way for it not to.',
    },
    {
      title: 'The actionable model is close to the limit of what the data supports',
      body: 'Restricted to process variables — the model that answers "given this chemistry, which conditions favour crystallisation?" — performance falls to a Matthews correlation of 0.13. That is above chance and it is not yet a basis for recommending conditions. Since this is the question the laboratory actually asks, it is the more important of the two results.',
    },
  ],
  cause: {
    title: 'The limit lies in the experimental record, not in the model',
    body: 'Across five years the record contains roughly thirteen distinct target temperatures and nine reaction times, and these were varied in a manner confounded with chemistry: each campaign swept one factor within one metal-linker system. A supervised model cannot estimate the effect of a variable that was held nearly constant, nor separate an effect from a factor it always co-occurred with. This is a property of the data, and no choice of algorithm or hyperparameter can recover information the experiments did not generate.',
    expectation:
      'Hyperparameter optimisation on this dataset can reasonably be expected to yield an improvement of 0.02 to 0.05 in macro F1. It is worth doing for methodological completeness; it is not a route to a materially better model.',
  },
  next: {
    title: 'What would improve it, in order of expected return',
    items: [
      'A designed sweep of temperature, time and modulator at fine resolution within a single metal-linker system. This addresses the confounding directly and amounts to one or two high-throughput plates — by a wide margin the most efficient intervention available.',
      'More crystalline examples. With 167 in the training set, the minority class is the binding constraint on every metric reported above.',
      'Completion of the solvent breakdown for the 18% of records that lack it. That block currently scores as noise under permutation importance, and its true contribution cannot be assessed until the medium is recorded completely.',
      'Revisiting the target once more data exists. A continuous crystallinity index may carry more information than a three-way class, although the three classes remain the judgement the bench actually recorded.',
    ],
  },
  closing:
    'The value of this stage does not rest on the magnitude of the score. It rests on the score being defensible: cross-validated with plates as groups, computed after seven data defects were corrected, and reported alongside the baseline that gives it meaning. A previous version of this analysis reported a higher figure that was later shown to reflect the synthesis method rather than the chemistry. Establishing that the present limitation is one of experimental design converts a negative result into a specific and actionable experiment.',
}

export const MODEL_SHAP = {
  title: 'Reading the SHAP plot',
  body: 'Each point is one synthesis. Its horizontal position is how far that variable pushed the prediction towards crystalline (right) or against it (left). The colour is the value of the variable — red high, blue low. So "red on the right" means high values of this variable favour crystallisation.',
  note: 'It complements permutation importance: that says how much a variable matters, this says in which direction and for which samples.',
}
