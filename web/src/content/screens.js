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
    'Modulators reach the reactor in two physically different forms, and each needs its own arithmetic.',
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
  body: 'The spreadsheet recorded thermal programs as free text. They are parsed into initial, target and final temperature, plateau hours, and two slopes in °C per minute.',
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
  body: 'Auditing the dataset uncovered 113 problematic entries: 43 duplicate scans (re-runs, washed samples) that would bias training, and 70 amorphous runs contaminated with metal oxide peaks that would poison class labels',
  decision:
    'Instead of destructive hard-deletions, every case was flagged with ml_include = NO. In scientific databases, deleting destroys experimental history; explicit flagging preserves the audit trail while delivering clean data to the models.',
  pullquote:
    'In a scientific data store, **deleting destroys evidence and labelling preserves it**.',
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
  hook: 'Everything below changed the plan before a single model was trained.',
  /* Misma forma visual que los tres verbos del ETL en la pantalla 03: tres
     bloques con icono, uno por idea, en vez de dos tarjetas de parrafos. */
  steps: [
    {
      key: 'look',
      label: 'Look',
      body: 'Plot every variable, count what is missing, check whether the classes are balanced and whether two columns say the same thing twice.',
    },
    {
      key: 'decide',
      label: 'Decide',
      body: 'It produces no model and no metric, which is why it gets skipped. What it produces is decisions: which rows to drop, which columns cannot be trusted.',
    },
    {
      key: 'catch',
      label: 'Catch confounders',
      body: 'Separate signal that comes from the chemistry from signal that comes from how the data was collected.',
    },
  ],
  rule:
    '**A model cannot warn you about a problem it has learned to exploit.** If a confounder sits in the training data, cross-validation rewards the model for using it. The only place to catch it is here.',
  found: [
    ['A confounder', 'One synthesis method had produced no amorphous samples at all — so the method itself predicted the answer'],
    ['Five kinds of gap', 'Nine per cent missing, from five unrelated causes, each needing a different fix'],
    ['A 6 : 1 imbalance', 'Between the largest and smallest class, enough to make accuracy meaningless'],
    ['Hidden structure', 'Rows that are not independent of one another, which makes a random split lie'],
  ],
  foundIntro: 'What this one found, in order:',
}

/* Antes habia dos secciones diciendo lo mismo con cifras que no cuadraban:
   una tabla de tres poblaciones (2.152 / 1.810 / 1.516) y el embudo de cinco
   escalones. El 1.810 no salia del embudo. Ahora hay una sola: el embudo, que
   es el que reproduce la consulta guardada en el registro. Auditado el
   2026-09-02. */
export const EDA_FUNNEL_INTRO = {
  title: 'From the full record to the training set',
  lead:
    'The laboratory performed **2,167 syntheses**. The chain below counts **rows of the feature table**, which is why it starts at 2,152: those are the syntheses the pipeline could turn into features.',
  chain:
    'Each step removes exactly one filter from the query the model registry stores for this dataset, so the last line is the number the registry holds. **Every drop is a deliberate exclusion with a stated reason.**',
  scope:
    'By the last row the model is no longer a model of this laboratory’s chemistry: it is a model of **combinatorial syntheses that produced a powder someone was willing to judge**. Everything below refers to those 1,516 rows unless it says otherwise.',
}

export const EDA_CONFOUNDER = {
  title: 'The confounder that nearly ruined the analysis',
  intro:
    'The record holds three ways of making a material, and version 2 of this analysis mixed them without looking. The numbers:',
  microwaveRowBefore: 'Look at the microwave row: the amorphous segment is not small, it is',
  microwaveRowEmphasis: 'absent',
  microwaveRowAfter: '.',
  tableHead: ['Synthesis type', 'Amorphous', 'Crystalline', 'Incipient', '% crystalline'],
  tableRows: [
    ['HTS — combinatorial screening', '401', '169', '971', '11.0%'],
    ['ST — standard solvothermal', '3', '71', '15', '79.8%'],
    ['MW — microwave-assisted', '0', '90', '4', '95.7%'],
  ],
  points: [
    {
      label: 'The shortcut',
      body: '**Zero amorphous samples in microwave.** Detecting that a synthesis was microwave-assisted, even indirectly through reactor volume or year, lets a model answer CRYSTALLINE and be right 96% of the time. Those 94 cases are 5% of the dataset and 27% of the crystalline class.',
    },
    {
      label: 'The cause is selection bias',
      body: 'Combinatorial screening is exploratory, so it is full of failures. Standard and microwave synthesis are used once the recipe is known to work. "Synthesis type" largely encodes **whether the outcome was already known**.',
    },
    {
      label: 'And the physics differ',
      body: 'Microwave heating is localised and fast, favouring kinetic phases over thermodynamic ones. Mixing the methods forces the model to learn two physics as one.',
    },
  ],
  decision: [
    'It is the only subset without success bias: it was designed to explore, not to confirm.',
    'It is what we actually want to predict — the next plate is an HTS plate.',
    'It is a single thermal regime, so the model learns one physics, not two.',
  ],
  price:
    'The price is stated: 90 of the 330 crystalline cases are lost, 27%, and the minority class becomes scarcer still. The alternative is **a higher score that measures the synthesis method** instead of the chemistry.',
}

export const EDA_MISSING = {
  title: 'Missing values',
  intro:
    'A single "9% missing" figure hides unrelated problems, and only some of them are what imputation assumes.',
  tableHead: ['Property', 'Who is missing', 'Why', 'What was done'],
  figureAlt: 'Bar chart of the percentage of missing values per column',
  figureCaption: 'Missingness by column. The bars look similar; the causes behind them are not, and that is the whole point of the table below.',
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
      'A non-breaking space (U+00A0) in the precursor text',
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
}

/* De donde salen las dos columnas de modulador que el lector va a preguntar,
   con los dos matices que un quimico veria enseguida. */
export const EDA_MODULATORS = {
  title: 'Where the modulator descriptors come from',
  problem:
    'Ten columns of acids, nearly all zero in any given row, would let the model memorise which plate used which reagent instead of learning chemistry. So they were **grouped by chemical role** (carboxylic, strong acid, HF, base, fluorinated) and summed. Two extra columns carry the **mean pKa and mean logP of the acids present**, weighted by how much of each was added, so the chemistry the sum discards is not lost.',
  formula: 'mod_carbox_mean_pka = (3.75·formic + 4.76·acetic + 4.87·propionic) / total carboxylic mmol',
  /* Dos notas al pie, no dos secciones: son matices que un quimico preguntaria,
     no argumentos que sostengan nada. */
  caveats: [
    '**"Carboxylic" here means weak carboxylic.** Trifluoroacetic acid is grouped with the strong acids: the criterion was pKa, not functional family, and at pKa 0.23 it behaves like one. 82 syntheses.',
    '**The pKa and logP values carry no citation.** They are standard aqueous figures at 25 °C written into the SQL. Every other chemical property in the model traces to a reference in `property_sources`.',
  ],
}

export const EDA_IMBALANCE = {
  title: 'The target: how much imbalance there is',
  /* La distribucion por clase ya sale arriba, en la tabla del confounder. Aqui
     no se vuelve a presentar: se cuantifica el desequilibrio y se dice que hace
     con el, que es lo que esta seccion aporta. */
  intro:
    'Across the 1,516 training rows the three classes are far from equally common, and that is chemistry rather than sampling: most attempts land somewhere in between.',
  /* Recuentos tomados de ml_datasets.class_distribution para el conjunto
     crystallinity_v5_hts_2026_10_18 (1.516 filas). No editar a mano: si cambian,
     cambian ahi primero. */
  tableHead: ['Class', 'What it means', 'Samples', 'Share'],
  tableRows: [
    ['Incipient', 'Broad reflections near a crystallisation boundary', '951', '62.7%'],
    ['Amorphous', 'No reflections at all', '393', '25.9%'],
    ['Crystalline', 'Sharp, well-ordered reflections', '172', '11.3%'],
  ],
  trivial:
    'A model that learns nothing at all, always answering **INCIPIENT**, is right 63% of the time. That is why every metric in this project is quoted against that floor rather than against zero: reporting "63% accuracy" would describe a model that does nothing.',
  ratio:
    'The gap between the largest and smallest class is **5.5 : 1**, and it is sharper than over the whole record, because restricting to high-throughput synthesis removed material that was almost entirely crystalline. It is handled by **weighting the classes inside each model**, which is simpler than resampling and does not invent samples that were never made.',
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
    'And they are not evenly used either: **710 of the syntheses sit at 150 °C** and 370 at 120 °C, so two settings out of nine cover seven tenths of the record.',
  why:
    'This reflects how combinatorial synthesis is designed: **fix a grid of conditions and sweep composition**. A chemist filling a 24-well plate picks round numbers.',
  consequence:
    'It carries a consequence for interpretation: **a variable that was barely varied cannot explain much variance, however important it is chemically**. Reaction time takes three values in this record, so a model that finds it unimportant is describing the record, not the chemistry.',
}

export const EDA_CORRELATION = {
  title: 'Correlation: two different questions',
  featureMapFigureAlt: 'Feature-to-feature correlation map',
  featureMapFigureCaption: 'Feature against feature. The red blocks are mostly properties of the same metal, correlated by physics — not a problem, but the reason the final interpretation is done by chemical block.',
  targetAssociationFigureAlt: 'Association of each feature with the target class, top twenty numeric features',
  targetAssociationFigureCaption: 'Association with the target, measured by correlation ratio rather than Pearson — the target has three categories, not a magnitude.',
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
    'A white square means the correlation **is not defined**, not that a value was lost. `reactor_volume_ml` is 2.5 mL in every high-throughput synthesis, so its variance is zero and any correlation with it divides by zero.',
  blankConsequence:
    'It follows that `fill_fraction` is exactly `total_volume_ml / 2.5`: the same variable rescaled, across all 1,516 rows. **Both columns are excluded from the model** — zero variance for one, perfect collinearity for the other.',
  causation:
    '**Correlation is not causation**. These plots measure whether two things move together, nothing more. Temperature appearing associated with crystallinity does not demonstrate that raising it causes crystallisation: the two may share a common cause, or it may be a coincidence of this record. Establishing causation requires intervening, changing only the temperature and seeing what happens.',
}

export const EDA_LEAKAGE = {
  title: 'Hidden structure: why a random split would lie',
  body: 'Each row is **one synthesis**: one well of a 24-well plate, with its conditions and the verdict on its diffractogram. Those rows are **not independent of one another**. A plate is a batch prepared on the same day, with the same linker, the same thermal ramp and often the same metal, sweeping one variable. And plates are internally homogeneous: knowing one well tells you most of what its 23 neighbours did.',
  consequence:
    'A random split would put samples from the same plate in both training and test. The model would not need to learn any chemistry: **recognising the plate would be enough**. The score would come out inflated and false. Validation therefore groups by plate, so no plate ever appears on both sides.',
  plateFigureAlt: 'Distribution of samples across high-throughput plates, and how homogeneous each plate is',
  plateFigureCaption: 'Samples cluster in plates, and plates are internally homogeneous. Knowing one well of a plate tells you most of what its neighbours did.',
  /* Recordatorio del desequilibrio, porque aqui es donde se combina con el
     agrupamiento y donde mas dano hace. */
  reminder:
    'This compounds with the class imbalance. With **64% of samples incipient** and whole plates almost uniformly one class, a lucky split can hand the test set a plate that is 90% incipient, where the do-nothing baseline scores 90% and any model looks brilliant. Grouping by plate stops the split from choosing its own difficulty.',
  drift:
    'There is temporal drift too: the class proportions change year on year, because the laboratory was learning. Every bar carries its count, because **a proportion without its sample size misleads**: a year with seven samples shows a 100% bar that means nothing.',
}

export const EDA_PCA = {
  title: 'The PCA projection',
  disclaimer: 'This is a diagnostic, not a model.',
  figureAlt: 'PCA projection of the syntheses, coloured by outcome class with linker scaffold as marker shape',
  figureCaption: 'Colour is the outcome class, marker shape the linker scaffold. The scaffolds occupy distinct regions — the linker chemistry is a large part of what separates the space — but the classes themselves overlap heavily.',
  whatTitle: 'What a PCA does',
  /* Antes era un parrafo de seis lineas. Lo que hay que llevarse son cuatro
     hechos sueltos, no un argumento encadenado. */
  what: [
    'Each synthesis is a point in a space with one dimension per variable, which cannot be looked at directly.',
    'PCA finds the **direction along which the points are most spread out**, then the most spread-out direction perpendicular to it, and so on.',
    'Projecting onto the first two gives a flat picture that keeps as much of the original spread as any flat picture can.',
    'It is a **change of viewpoint, not a summary**: nothing is discarded.',
  ],
  varsTitle: 'What goes in',
  varsNote:
    'The **38 synthesis-condition columns**: metal properties, linker properties, solvent fractions, thermal ramp and modulators. Not the 29 PXRD descriptors, which describe the outcome. The question is whether what was *done* already separates the outcomes.',
  stepsTitle: 'How it is built',
  steps: [
    '**Standardise** the numeric variables after imputation. Without it, reaction time (up to 96) would crush a solvent fraction (0 to 1) through the scale of its units alone.',
    '**Find the direction of maximum variance**, a linear combination of every variable, and call it the first component. Then the maximum remaining variance perpendicular to it, and so on.',
    '**Project** the samples onto those components so they can be drawn.',
  ],
  honest:
    'PCA uses every variable and **does not know the classes**: it is unsupervised, and the colours are painted on afterwards. So any separation that appears is real structure in the synthesis conditions.',
  findings: [
    'There is structure, but the classes overlap heavily. The problem is genuinely multivariate and genuinely hard.',
    'Adding a third component reveals no hidden separation. That is a useful negative result: there is **no plane that separates the classes**, which already predicts that no linear model will shine.',
    'Reaching 90% of the variance takes many components. The information is spread across many variables rather than concentrated in two or three — so reducing dimensionality before modeling would throw away signal, and PCA is not used in the final pipeline.',
  ],
}

export const EDA_BIVARIATE = {
  title: 'Does any single variable separate the classes?',
  /* "A que te refieres con descriptores" — habia que decirlo. Y hacia falta
     recordar que aspecto tiene el vector de cada clase, porque eso se explico
     en la pantalla 03 y nadie lee en orden: aqui va el resumen numerico, con
     enlace al desglose completo. */
  whichTitle: 'Which variables are being tested here',
  which:
    'The **29 PXRD descriptors** extracted from each diffractogram: peak count, crystalline fraction, peak width, entropy, signal-to-noise and the rest. Not the synthesis conditions. The question is whether any single measurement taken *from the pattern* is enough, on its own, to tell the three classes apart.',
  /* Medianas por clase sobre los 1.855 difractogramas etiquetados. Mismas
     cifras que la tabla de descriptores de la pantalla 03. */
  shapesTitle: 'What each class looks like as numbers',
  shapes: [
    {
      klass: 'Amorphous',
      tone: 'amorphous',
      body: '**No peaks at all** (`n_peaks` = 0). 88 % of the scattered area sits under the diffuse halo, and peak-to-background stays near **0.03**.',
    },
    {
      klass: 'Incipient',
      tone: 'incipient',
      body: 'A handful of **broad** reflections: median 8 peaks at **0.240°** FWHM, with about half the area crystalline and peak-to-background near **1.19**.',
    },
    {
      klass: 'Crystalline',
      tone: 'pure',
      body: 'Many **sharp** reflections: median 19 peaks at **0.162°** FWHM, **77 %** crystalline fraction, and peak-to-background at **9.42**.',
    },
  ],
  shapesLink: 'Where those 29 numbers come from, descriptor by descriptor',
  ordering:
    'They do order the classes cleanly: every descriptor tested rises or falls **monotonically** from amorphous through incipient to crystalline. The numbers agree with the human verdicts on the direction of the effect.',
  body: 'But ordering is not separating. In the box plots below the boxes **overlap for every variable tested**: an incipient sample and a crystalline one can share the same peak count, the same width, the same entropy. That overlap is the definition of a multivariate problem, and the reason a model is needed instead of a threshold.',
  distributionsNote: 'The medians separate; the *distributions* behind them overlap. A variable can shift class by class and still fail to classify any single sample.',
}

/* El cierre de la pantalla 04: cuatro conclusiones etiqueta+cuerpo, que en el
   JSX vivian como <strong>Etiqueta:</strong> texto suelto. */
export const EDA_TAKEAWAY = [
  {
    label: 'Which samples the model may see',
    body: 'high-throughput only, at a measured cost of 27% of the crystalline class.',
  },
  {
    label: 'Which metric can be trusted',
    body: 'not accuracy, because a model that learns nothing already scores 64%.',
  },
  {
    label: 'How to split the data',
    body: 'grouped by plate, because a random split would let the model pass by recognising the batch.',
  },
  {
    label: 'What to expect',
    body: 'no single variable separates the classes and no plane does either — so a linear model will not shine, and the honest ceiling is modest.',
  },
]

/* ==========================================================================
   05 · MODELING
   ========================================================================== */

/* Texto de la pantalla 05 que vivia directamente en el JSX (hero, el
   planteamiento, el pie de los diez modelos, la cifras-primero y el cierre):
   ninguno paso por la extraccion de titulos porque son parrafos de cuerpo, ni
   por la de content/ porque no vivian ahi. */
export const MODEL_HERO_LEAD =
  'Ten model families are trained on the same 1,516 syntheses and compared under one validation scheme, grouped by plate. The deployed model (v5, trained on the reviewed data) scores **0.47 macro F1** against 0.26 for a model that always answers the majority class.'

export const MODEL_FRAMING =
  'The target is the same three-way verdict the bench already used when triaging a 24-well plate: amorphous, incipient, or a well-ordered crystalline phase. Framing it as classification rather than regression is a decision that cannot be repaired later — there is no continuous "degree of crystallinity" that the human labels actually recorded, and inventing one would mean scoring the model against a quantity nobody measured.'

export const MODEL_WEIGHTS_NOTE =
  'Every model that supports it carries balanced class weights, which offsets the 6:1 imbalance by penalising errors on the minority classes more heavily.'

export const MODEL_SCORECARD_INTRO =
  'The figures first. Every number below is cross-validated with plates as groups, and is shown against the trivial baseline — without that reference an F1 of 0.47 could mean anything.'

export const MODEL_TAKEAWAY = {
  body: 'There is real predictive signal in five years of laboratory records, and it is modest: a little under twice the trivial baseline. Most of what the model distinguishes is which metal-linker system was used rather than which conditions were applied. The record varied those conditions across only 9 temperatures and 3 reaction times, which is too narrow for their effect to be learnable.',
  close: 'That is a negative result, and it converts directly into an experimental instruction: the next campaign should sweep temperature and time far more widely than the last five years did.',
}

export const MODEL_LINEUP = {
  intro:
    'Ten models are compared, not one. Different model families assume different things about the shape of the boundary between classes, and with a new problem there is no way to know in advance which assumption is right.',
  tableHead: ['Model', 'What it assumes', 'Why it is here'],
  comparisonFigureAlt: 'Comparison of the ten models by macro F1 and MCC, high-throughput syntheses only',
  comparisonFigureCaption: 'All ten compared under the same grouped cross-validation. The baseline is the bar everything else has to clear — and Naive Bayes does not clear it.',
  /* Cada fila se despliega: `detail` explica como funciona el modelo sin
     formulas, y `code` es la linea real con la que se instancia en el cuaderno
     06 -- con sus hiperparametros, no un ejemplo generico. */
  models: [
    {
      name: 'Baseline (majority class)',
      assumes: 'Nothing: always the most frequent class',
      why: 'The bar. Everything else must clear it',
      detail:
        'It looks at no variable at all. It counts which class is commonest in the training data and answers that, every time. On this data it says INCIPIENT to everything and is right 64 % of the time. That is why accuracy is a useless headline here, and why this model is on the list: to give every other number a floor.',
      code: "DummyClassifier(strategy='most_frequent')",
    },
    {
      name: 'Logistic regression',
      assumes: 'A linear boundary',
      why: 'Interpretable reference; if it suffices, it wins',
      detail:
        'Draws a straight dividing surface through the 39-dimensional space and reads each variable\u2019s weight as its pull towards one class or another. If a straight line were enough, this would be the answer to keep: you can read the coefficients and argue about the chemistry. It is here to find out whether the problem needs anything more complicated.',
      code: "LogisticRegression(max_iter=2000, class_weight='balanced')",
    },
    {
      name: 'k-nearest neighbours',
      assumes: 'Similar samples share an outcome',
      why: 'Purely local, with no global model',
      detail:
        'Builds no model. For a new synthesis it finds the fifteen most similar ones already on record and takes a vote. That makes it a direct test of a chemical intuition — that similar conditions give similar products — and it is unforgiving about badly scaled variables, which is part of what made it useful for spotting the unit defects.',
      code: "KNeighborsClassifier(n_neighbors=15)",
    },
    {
      name: 'Naive Bayes',
      assumes: 'Variables independent given the class',
      why: 'Its failure measures how much the correlation structure matters',
      detail:
        'Assumes every variable contributes independently, which in this data is plainly false: the electronegativity and the hardness of a cation are tied together by physics. It is on the list precisely so that assumption can fail visibly. It scores below the trivial baseline, and that gap is a measurement of how much the correlation structure matters.',
      code: "GaussianNB()",
    },
    {
      name: 'SVM (RBF kernel)',
      assumes: 'A smooth non-linear boundary',
      why: 'Strong in medium dimension with few samples',
      detail:
        'Bends the boundary instead of keeping it straight, and cares only about the samples nearest the frontier. That makes it strong when there are many variables and few rows, which is this problem exactly. The price is that its decisions cannot be read off as "this variable mattered".',
      code: "SVC(kernel='rbf', probability=True, class_weight='balanced')",
    },
    {
      name: 'Decision tree',
      assumes: 'Threshold cuts, one at a time',
      why: 'Interpretable; the basis of what follows',
      detail:
        'Asks a chain of yes/no questions about single thresholds — is the temperature above 130, is there carboxylic modulator — until it reaches a verdict. Alone it overfits badly, but it is the building block of the four models below it, and it is the only one whose reasoning you can read out loud.',
      code: "DecisionTreeClassifier(max_depth=6, class_weight='balanced')",
    },
    {
      name: 'Random Forest',
      assumes: 'Many decorrelated trees',
      why: 'Robust, insensitive to hyperparameters',
      detail:
        'Grows hundreds of trees, each on a random slice of the rows and the columns, and averages them. The randomness is the point: individual trees overfit in different directions and the errors cancel. It is the model actually deployed here, chosen for being the best performer that is also hard to break by tuning it wrong.',
      code: "RandomForestClassifier(n_estimators=500, class_weight='balanced_subsample', random_state=42)",
    },
    {
      name: 'HistGradientBoosting',
      assumes: 'Sequential trees correcting each other',
      why: 'Handles missing values natively',
      detail:
        'Instead of averaging independent trees, each new tree is fitted to the errors the previous ones left behind. It bins the variables first, which makes it fast, and it takes missing values without imputing them — relevant here, where a null pKa means "no carboxylic acid" rather than "unknown".',
      code: "HistGradientBoostingClassifier(max_iter=300, random_state=42)",
    },
    {
      name: 'LightGBM',
      assumes: 'Optimised boosting',
      why: 'The industry reference',
      detail:
        'The same idea as above with a different growth strategy: it extends whichever leaf reduces the error most, rather than growing level by level. Fast and usually at the top of tabular benchmarks, which is why it is the yardstick. It is the model serving the actionable half of this project.',
      code: "LGBMClassifier(n_estimators=400, class_weight='balanced', random_state=42)",
    },
    {
      name: 'XGBoost',
      assumes: 'Boosting with regularisation',
      why: 'Standard comparison',
      detail:
        'Boosting again, with an explicit penalty on tree complexity written into what it optimises. That extra brake is what usually separates it from LightGBM on small datasets, and with 1,516 rows this one qualifies as small.',
      code: "XGBClassifier(n_estimators=400, max_depth=5, random_state=42)",
    },
  ],
}

export const MODEL_VALIDATION = {
  title: 'Validation grouped by plate',
  setupPoints: [
    '**A plate is 24 wells**: one block, one oven, one thermal programme, 24 compositions swept in parallel.',
    'The training set is **1,516 syntheses across 68 plates**.',
    'So a plate is a batch that shared a reactor, a day, a solvent bottle and an operator, not an administrative label.',
  ],
  bodyPoints: [
    '**Stratified group k-fold, five folds.** Every plate stays entirely inside one fold, so no plate is ever in training and test at once.',
    '**Without it**, a model can score well by recognising which plate a sample came from instead of learning any chemistry.',
    '**The stratification** keeps class proportions even, so no fold ends up with almost no crystalline samples.',
  ],
  consequence:
    'It costs performance. A random split would report a higher number for a model that had learned less.',
}

export const MODEL_TWO = {
  title: 'Two models, not one',
  objection:
    'The linker does not make a metal crystallise; it determines which material can exist at all. Changing it changes the chemistry, not a reaction condition.',
  body: 'So the variables split in two: **design variables** (metal and linker chemistry), which change the research target itself, and **process variables** (concentration, ligand-to-metal ratio, temperature, time, ramps, modulators, solvents), which can be changed within the same chemistry. One model is trained on each split.',
  models: [
    {
      name: 'Full model',
      inputs: 'All 37 variables',
      asks: 'Is there predictive signal in this record at all?',
      pro: 'Best score of the two: **0.47 macro F1**, 1.8 times the baseline.',
      limit: 'Most of that signal is the metal-linker system, so it cannot tell you what to change.',
    },
    {
      name: 'Actionable model',
      inputs: 'Process variables only',
      asks: 'Given this chemistry, which conditions make it crystallise?',
      pro: 'The question the bench actually asks, and the one that designs the next plate.',
      limit: 'Falls to **0.41 macro F1**, MCC 0.15: above chance, not yet a basis for recommending conditions.',
    },
  ],
  note: 'The gap between the two scores measures how much of the signal comes from the chemistry rather than from the conditions.',
}

export const MODEL_METRICS = {
  tableHead: ['Metric', 'What it measures', 'Why it is here'],
  tableRows: [
    ['F1 macro', 'The mean F1 of each class, weighting all three equally', 'The headline metric. Ignoring the 172 crystalline samples sinks it'],
    ['Balanced accuracy', 'Mean accuracy within each class', 'Directly interpretable: "it gets X% of the crystalline ones right"'],
    ['MCC', 'Correlation between prediction and truth, −1 to +1', 'The most demanding: 0 means chance, however high the accuracy'],
    ['Accuracy', 'Percentage correct', 'Present only as a warning: the trivial baseline already scores ~63%'],
  ],
  note: 'Mean relative error, RMSE and R² do not apply here. They belong to regression and measure distance to a number. In classification you either get the class right or you do not.',
}

export const MODEL_FINDINGS = [
  {
    title: 'There is real predictive signal, and it is modest',
    body: 'The deployed full model reaches a macro F1 of about 0.47 against 0.26 for the baseline, 1.8 times better. MCC lands near 0.26: a real association, but far from strong.',
  },
  {
    title: 'Excluding the confounded syntheses costs 0.10 of macro F1',
    body: 'Removing microwave and standard solvothermal runs dropped the score from 0.62 to 0.52 (model v3). That gap **measures the portion of the score that came from identifying the synthesis method** rather than the chemistry.',
  },
  {
    title: 'The actionable model drops further, and that answers the objection',
    body: 'Without metal and linker chemistry the best model falls to 0.41 with MCC near 0.15: above chance, but weak. Most of what the model distinguishes in this record is which metal-linker system was used, not which conditions were applied.',
    caveat:
      'That does not make conditions chemically unimportant. In this record they were not varied enough to be learnable: **9 temperatures and 3 reaction times** across the training set.',
  },
  {
    title: 'Tree-based models win',
    body: 'Random Forest and LightGBM come out ahead of k-nearest neighbours and SVM. Methods that build boundaries from thresholds benefit from variables that mean what they say, which is what the unit corrections in the previous stage delivered.',
  },
  {
    title: 'Naive Bayes sinks below the baseline',
    body: 'It assumes the variables are independent given the class, and the correlation map shows strong blocks. Its failure measures how much that correlation matters, which is why it is on the list.',
  },
  {
    title: 'Correcting the data lowered the score, and that is the point',
    body: 'Model v4 scored 0.52; v5 scores 0.47 on the same 1,516 syntheses after a deep review: 652 invented ramp rates removed, a whole plate re-parsed from 25 °C to 120 °C, 49 metal masses fixed and 28 labels re-adjudicated after a blind relabelling. Undoing each fix separately shows where the 0.05 went: the fake ramp rates encoded which notebook era a synthesis came from, and the borderline labels were the easy ones to fit. What did not move is the score on a metal the model has never seen (0.42) or a new metal-linker system (0.42) — the same as v4. **The part of the score that was lost is the part that did not generalise.**',
  },
]

export const MODEL_ERRORS = {
  title: 'Where it goes wrong, and whether the errors make chemical sense',
  intro:
    'A confusion matrix shows the direction of the errors, not just how many there are. Here the ordinal pattern holds clearly one way and only half-way the other.',
  tableHead: ['True class', '→ neighbouring class (incipient)', '→ opposite extreme'],
  tableRows: [
    ['Amorphous', '44.6%', '5.9% to crystalline'],
    ['Crystalline', '28.1%', '21.9% to amorphous'],
  ],
  amorphous:
    'For amorphous samples the behaviour is what you would hope: when it fails, it confuses "nothing" with "almost nothing", which in the diffractogram itself is a matter of degree and something two experts could disagree about. The severe error — calling an amorphous sample crystalline — is rare.',
  crystalline:
    'For crystalline samples it is not. Roughly one in seven is classified as amorphous, the most serious error available, and most of the rest land in incipient. The model does not recognise the minority class well, and when it loses it, it loses it completely. With 172 cases against 951 incipient, and the most heterogeneous class of the three (many ways to crystallise, one way not to), this was predictable. It remains the model\'s main weakness.',
  usage:
    'For the intended use, ranking candidates and filling the next plate, what matters is that good candidates rise in the ranking rather than that the label is exact. But the model makes a serious mistake on **22% of crystalline samples**, and that figure has to be quoted alongside the aggregate.',
  asHopedBadge: 'As hoped',
  mainWeaknessBadge: 'The main weakness',
  confusionFigureAlt: 'Confusion matrix of the Random Forest model on held-out plates, as counts and row-normalised',
  confusionFigureCaption: 'Left, raw counts; right, normalised by true class so each row reads as recall. The diagonal is where the model is right — and the crystalline row is where it is weakest.',
}

export const MODEL_CHEMISTRY = {
  title: 'The chemical reading, by block rather than variable by variable',
  why: 'With strongly correlated variables, any importance method splits the credit arbitrarily. Interpreting Pauling electronegativity in isolation from absolute hardness would be over-reading. The block-level split is the defensible reading.',
  blocks: [
    {
      name: 'Metal chemistry',
      rank: 'Dominant, by a wide margin',
      body: 'It enters through ionic radius and charge-over-radius, which together give the **charge density** of the cation. That charge density governs the strength of the metal-phosphonate interaction, and with it whether the system has time to order or precipitates amorphous.',
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
    '"It does not matter" and "it was not explored" are different claims, and only the second is actionable. The model is not saying temperature is irrelevant to phosphonate crystallisation; it is saying that in this record it **was not varied enough to be learnable**. The instruction that follows is experimental: vary it.',
}

/* Valoracion del rendimiento. Tono de discusion de articulo: se declara la
   limitacion, se identifica su causa, y se propone el experimento que la
   resolveria. Sin dramatizar y sin disculparse. */
export const MODEL_ASSESSMENT = {
  title: 'An honest reading of the performance',
  lead:
    'The full model scores 1.8 times the trivial baseline and reaches a Matthews correlation of 0.26, a real but moderate association. Two features of the result matter more than that headline.',
  points: [
    {
      title: 'Most crystalline syntheses are not recovered',
      bullets: [
        'Recall on the crystalline class is **0.12** under the grouped cross-validation, and between 0.11 and 0.21 depending on which plates are held out. That is the figure to quote: the tool exists to shortlist promising conditions, so it governs practical value far more than the aggregate does.',
        'The confusion matrix above (model v4) reads **0.53** for the same class — because it is one held-out split, not the five-fold average. A lucky set of plates flatters the smallest class.',
        'Cause: **172 crystalline examples against 951 incipient**, and the crystalline class is the most heterogeneous. There are many ways for a framework to crystallise and only one way for it not to.',
      ],
    },
    {
      title: 'The actionable model sits close to the limit of the data',
      bullets: [
        'Stripped of metal and linker chemistry, macro F1 falls to **0.41** and MCC to **0.15**.',
        'Above chance — and not yet a basis for recommending conditions.',
        'This is the question the laboratory actually asks, so it is the more important of the two results.',
      ],
    },
  ],
  cause: {
    title: 'The limit lies in the experimental record, not in the model',
    body: 'Across five years the record contains 15 distinct target temperatures and 11 reaction times, and the subset the model was trained on is poorer still — **9 temperatures and 3 reaction times**. They were also varied in a manner confounded with chemistry: each campaign swept one factor within one metal-linker system. A supervised model cannot estimate the effect of a variable that was held nearly constant, nor separate an effect from a factor it always co-occurred with. This is a property of the data, and no choice of algorithm or hyperparameter can recover information the experiments did not generate.',
    expectation:
      'Hyperparameter optimisation on this dataset can reasonably be expected to yield an improvement of 0.02 to 0.05 in macro F1. It is worth doing for methodological completeness; it is not a route to a materially better model.',
  },
  next: {
    title: 'What would improve it, in order of expected return',
    items: [
      {
        icon: 'sweep',
        head: 'One designed sweep',
        cost: '1–2 plates',
        body: 'Vary temperature, time and modulator finely **within a single metal-linker system**. It attacks the confounding head-on and costs one or two plates — by a wide margin the most efficient intervention available.',
      },
      {
        icon: 'minority',
        head: 'More crystalline examples',
        cost: 'bench time',
        body: 'With **172** in the training set, the minority class is the binding constraint on every metric above. Nothing algorithmic gets around it.',
      },
      {
        icon: 'record',
        head: 'Finish the solvent record',
        cost: 'no experiments',
        body: '**18 %** of rows lack the breakdown, and that block currently scores as noise. Its real contribution cannot even be measured until the medium is written down completely.',
      },
      {
        icon: 'target',
        head: 'Revisit the target',
        cost: 'later',
        body: 'A continuous crystallinity index may carry more than a three-way class — though the three classes remain the judgement the bench actually recorded.',
      },
    ],
  },
  closing:
    'The score is defensible: cross-validated with plates as groups, computed after seven data defects were corrected, and reported alongside the baseline that gives it meaning. The limitation is one of experimental design rather than of the model, which makes it a specific and actionable experiment.',
}

export const MODEL_SHAP = {
  title: 'Reading the SHAP plot',
  body: 'Each point is one synthesis. Its horizontal position is how far that variable pushed the prediction towards crystalline (right) or against it (left). The colour is the value of the variable — red high, blue low. So "red on the right" means high values of this variable favour crystallisation.',
  note: 'It complements permutation importance: that says how much a variable matters, this says in which direction and for which samples.',
  permutationFigureAlt: 'Permutation importance of the features, coloured by chemical block',
  permutationFigureCaption: 'Permutation importance, coloured by chemical block. Metal chemistry dominates; the stoichiometry and medium block comes out negative, which is the operational definition of noise.',
  shapFigureAlt: 'SHAP summary plot showing the direction in which each feature pushes the prediction',
  shapFigureCaption: 'SHAP values: horizontal position is how far a feature pushed the prediction towards crystalline, colour is the value of the feature itself.',
}
