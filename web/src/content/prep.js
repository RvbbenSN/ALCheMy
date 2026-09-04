/* --------------------------------------------------------------------------
   prep.js — Contenido de la pantalla 03, Data Preparation.

   La pantalla tenia un problema de orientacion, no de contenido: entraba
   directamente en el tratamiento de la senal PXRD, que es la parte mas dura,
   sin haber dicho antes que hay dos vias de datos distintas ni que aspecto
   tiene ninguna de las dos. Este archivo aporta lo que faltaba:

     - una entradilla que dice que se hace en la etapa, que no es solo PXRD;
     - la tabla de sintesis vista por dentro, con datos sinteticos;
     - por que un elemento quimico se sustituye por sus propiedades;
     - por que de las nueve tecnicas la que manda es el PXRD;
     - y una tabla final que ensena la traduccion difractograma -> descriptores.

   Todas las cifras salen de consultas a la base de datos el 2026-09-02. Las
   filas de ejemplo son sinteticas: valores plausibles dentro de los rangos
   reales, con los codigos de muestra y los ligandos sustituidos.
   -------------------------------------------------------------------------- */

export const PREP_INTRO = {
  /* Que es un ETL, antes de nada. El titulo de la pantalla lo usa como si fuese
     obvio, y para un quimico no lo es. Antes era un unico parrafo con los tres
     verbos en negrita; ahora son tres bloques con icono, uno por verbo, sin
     caja propia (solo la seccion los envuelve), para que se lea como lo que
     es -- tres pasos distintos -- y no como una definicion de diccionario. */
  etlTitle: 'ETL: extract, transform, load',
  etlSteps: [
    {
      key: 'extract',
      label: 'Extract',
      body: 'Pull the data out of wherever it lives — a spreadsheet, an instrument file, a scanned report.',
    },
    {
      key: 'transform',
      label: 'Transform',
      body: 'Turn it into something consistent: same units, same names, same shape, with the errors found and fixed.',
    },
    {
      key: 'load',
      label: 'Load',
      body: 'Put it into the store the rest of the work reads from.',
    },
  ],
  lead:
    'Two independent data streams arrive at this stage, and neither is usable as it stands. One is five years of manual synthesis records (mixtures, ratios, temperatures). The other is 1,877 raw diffractograms—thousands of noisy data points per sample that must be standardized into discrete numerical features.',
  /* Dos guiones en vez de un parrafo largo: son dos trabajos distintos y se
     lee mucho mejor cuando se ven como dos, ademas de anunciar las dos
     secciones que vienen debajo. */
  halves: [
    {
      lane: 'synthesis',
      title: 'The synthesis table needs cleaning and enrichment',
      body: 'Normalising headers, turning free text into numbers, and replacing elements and linkers labels with their properties that explain its behavior.',
    },
    {
      lane: 'characterisation',
      title: 'The diffractograms need signal processing',
      body: 'Separating the crystalline signal from the background, so that each curve collapses into a fixed set of comparable numbers.',
    },
  ],
  halvesNote:
    'Those are the **two sections of this screen**, and they are read one at a time — pick one below, and the buttons come back at the bottom to switch.',
  note:
    '**Garbage in, garbage out**. This stage sets the quality for everything downstream.',
}

export const LANES = [
  {
    id: 'synthesis',
    label: 'Synthesis conditions',
    tag: 'Notebook 01',
    sub: 'A spreadsheet of recipes becomes a governed table',
    blurb:
      'What the chemist controls: metal, linker, solvent, temperature, time, modulator. Structured data that was never structured properly.',
  },
  {
    id: 'characterisation',
    label: 'Characterisation signal',
    tag: 'Notebooks 02 & 05',
    sub: 'A diffractogram becomes 29 comparable numbers',
    blurb:
      'What the material answers back. Raw instrument curves that have to be processed before any two of them can be compared.',
  },
]

/* --- La tabla de sintesis vista por dentro ------------------------------- */

export const SYNTH_PREVIEW = {
  caption: 'One row per synthesis, 46 columns. These eight are the ones a chemist would recognise first.',
  warning:
    'Synthetic rows. The values sit inside the real observed ranges but no row corresponds to an actual experiment; sample codes are placeholders and linker identities are withheld.',
  head: ['sample_code', 'metal_center', 'linker', 'metal_conc_m', 'lm_ratio', 'temp_target_c', 'time_hours', 'mod_total_mmol'],
  rows: [
    ['SYN-0001', 'Fe', 'L-A', '0.030', '0.50', '120', '48.0', '0.267'],
    ['SYN-0002', 'Ca', 'L-B', '0.080', '0.10', '25', '1.0', '2.040'],
    ['SYN-0003', 'Cu', 'L-A', '0.060', '0.50', '150', '48.0', '0.000'],
    ['SYN-0004', 'Zr', 'L-C', '0.030', '0.33', '120', '24.0', '0.512'],
    ['SYN-0005', 'Bi', 'L-A', '0.030', '0.50', '150', '48.0', '0.000'],
    ['SYN-0006', 'Ni', 'L-D', '0.090', '0.50', '130', '48.0', '0.118'],
  ],
}

export const SYNTH_GROUPS = [
  {
    title: 'Identity & audit',
    icon: 'id',
    body:
      'Who ran it, when, under which unit, and in which well of the high-throughput plate. Not predictive, but it is what makes a row traceable to a physical notebook page — the ISO-17025 requirement that turns a spreadsheet into a record.',
    fields: ['sample_code', 'synthesis_date', 'researcher_name', 'research_unit', 'hts_number', 'well_position', 'synthesis_type'],
  },
  {
    title: 'Theoretical design',
    icon: 'design',
    body:
      'The chemistry the experiment was meant to be. **lm_ratio** — linker to metal — is the single most argued-over number in the whole table: it decides whether there is enough organic strut to build a framework at all.',
    fields: ['metal_center', 'metal_source', 'linker', 'metal_conc_m', 'lm_ratio', 'metal_mass_mg', 'linker_mass_mg'],
  },
  {
    title: 'Solvent system',
    icon: 'solvent',
    body:
      'Six solvents recorded as absolute volumes in millilitres. Absolute volumes are not comparable between a 1,5 mL vial and a 15 mL autoclave, so they are later converted into **fractions of the total**, plus a `fill_fraction` that says how full the reactor was.',
    fields: ['h2o_total_ml', 'meoh_ml', 'etoh_ml', 'proh_1_ml', 'dmf_ml', 'def_ml', 'total_volume_ml', 'reactor_volume_ml'],
  },
  {
    title: 'Thermal ramp',
    icon: 'thermal',
    body:
      'Written in the notebooks as free text — *"ramp to 120 °C over 2 h, hold 48 h, cool overnight"*. Parsed into four numbers, because the **rate** of heating and cooling changes the product as much as the target temperature does.',
    fields: ['temp_initial_c', 'temp_target_c', 'temp_final_c', 'heating_time_hours', 'time_hours', 'cooling_time_hours', 'heating_rate_c_min', 'cooling_rate_c_min'],
  },
  {
    title: 'Modulators',
    icon: 'modulator',
    body:
      'Ten additives, each stored as **mmol of active species** rather than as microlitres of stock solution. The conversion is the single most delicate transformation in the notebook: a modulator added as an aqueous acid also contributes water, and forgetting that corrupts the solvent fractions above.',
    fields: ['formic_acid_mmol', 'acetic_acid_mmol', 'propionic_acid_mmol', 'tfa_mmol', 'hcl_active_mmol', 'hf_active_mmol', 'koh_active_mmol', 'triethylamine_mmol', 'cf3so3h_mmol', 'meo3s_mmol'],
  },
]

/* --- Del simbolo quimico a la fisica ------------------------------------- */

export const ELEMENT_INTRO = {
  problem:
    'A categorical label like "Fe" hides the physics and collapses **Fe(II)** (92 pm) and **Fe(III)** (78.5 pm) into the same bin. Replacing chemical symbols with **eight fundamental properties** (Shannon ionic radius, electronegativity, HSAB hardness, charge-to-radius ratio) enables the model to interpolate across the periodic table and predict outcomes for unseen metals',
  payoff:
    'Molecule names convey no spatial or chemical meaning. Using RDKit, each linker is featurized into **six geometric and topological descriptors**: denticity (binding points), max donor distance (pore-size proxy), acidic proton count, and rotatable bonds (flexibility)—capturing the structural rules of reticular assembly.',
}

export const METAL_FEATURES = [
  ['electronegativity_pauling', 'How strongly the metal pulls electron density from the linker. The classic scale.'],
  ['electronegativity_allen', 'A second scale, computed from spectroscopic energies. Computed here, but **dropped before training**: it is undefined for the lanthanides, so for Ce, La, Nd and Dy the value does not exist rather than being missing. Screen 04 tells that story.'],
  ['absolute_hardness_ev', 'Resistance to deformation of the electron cloud. Hard metals prefer hard donors — the HSAB rule, as a number.'],
  ['oxophilicity_kepp', 'Affinity for oxygen donors, which is what a carboxylate linker offers.'],
  ['polarizability_a3', 'How easily the electron cloud distorts. Governs the softer, less directional part of the bonding.'],
  ['oxidation_state', 'Recovered from the metal salt used, not from the element. This is what separates Fe(II) from Fe(III).'],
  ['shannon_radius_pm', 'Ionic radius for that specific oxidation state and coordination number. Sets how many linkers fit around the metal.'],
  ['charge_over_radius', 'Charge density: the field the metal projects onto its neighbours. Derived, and the most informative of the group.'],
]

export const LINKER_FEATURES = [
  ['scaffold', 'The rigid core the linker is built on. Governs the size of the pore that can form.'],
  ['denticity', 'How many points the linker can bind through. Two makes a chain, three or more makes a network.'],
  ['n_acidic_protons', 'How many protons have to leave before the linker can coordinate — which is what ties the outcome to pH and to the modulator.'],
  ['max_donor_distance_a', 'The distance between the outermost binding points, in ångström. The first-order estimate of pore size.'],
  ['protection_state', 'Whether the binding groups arrive masked as esters and have to be freed in situ.'],
  ['n_rotatable_bonds', 'Conformational freedom. A floppy linker is far less likely to give an ordered framework.'],
]

/* --- Por que el PXRD y no las otras ocho -------------------------------- */

export const WHY_PXRD = {
  lead:
    'In reticular chemistry, powder X-ray diffraction (PXRD) serves as the primary diagnostic benchmark. Fast and non-destructive, it provides immediate insight into long-range periodic order.',
  gate:
    'PXRD requires only milligrams and minutes of scan time without consuming the sample. It immediately reveals whether the reaction produced sharp Bragg reflections (characteristic of an ordered framework) or a diffuse amorphous profile, establishing whether the target crystalline phase assembled before investing in advanced characterization.',
  why_model:
    'For periodic MOFs, long-range order dictates pore architecture, internal surface area, and host-guest properties. Predicting whether a specific combination of synthetic variables will yield a crystalline network enables rational navigation of reaction space, filtering out unpromising synthesis conditions beforehand.',
  steps: [
    ['PXRD', 'Is it crystalline?', 'Minutes. Non-destructive. Run on everything.', true],
    ['FTIR · UV-Vis · ICP · EA', 'Which groups, which gap, which composition?', 'Confirmatory. Only once the material is worth confirming.', false],
    ['TGA', 'Up to what temperature does it survive?', 'Hours. Consumes the sample.', false],
    ['SEM', 'What do the crystals look like?', 'Booked instrument time, and a trained operator.', false],
    ['Gas adsorption', 'Is it actually porous, and how much?', 'A day per sample. Needs prior activation.', false],
  ],
}

/* --- La traduccion: de una curva a numeros ------------------------------- */

/* --- La traduccion: de una curva a numeros ------------------------------
   Los 29, no una seleccion. La version anterior mostraba siete y la pregunta
   inmediata era donde estaban los otros veintidos. Van agrupados por lo que
   miden, porque veintinueve filas seguidas no se leen.

   Cada celda es la MEDIANA de ese descriptor dentro de cada clase etiquetada,
   sobre los 1.855 difractogramas con veredicto humano (484 amorfos, 1.013
   incipientes, 358 cristalinos). Consultado el 2026-09-03. */

export const DESCRIPTOR_GROUPS = [
  {
    title: 'Peak geometry',
    icon: 'ruler',
    blurb: 'Where the reflections are, how many, and how sharp.',
    rows: [
      ['n_peaks', 'Peaks surviving detection', '0', '8', '19'],
      ['n_peaks_k3', 'Peaks at a looser 3σ threshold', '2', '15', '22'],
      ['n_peaks_below_15deg', 'Peaks at low angle, where frameworks show', '0', '3', '4'],
      ['two_theta_first_peak', 'Angle of the first reflection (°)', '24.48', '6.06', '8.62'],
      ['d_max_angstrom', 'Largest lattice spacing implied by it (Å)', '3.63', '14.57', '10.25'],
      ['fwhm_median_deg', 'Typical peak width (°)', '0.231', '0.240', '0.162'],
      ['fwhm_min_deg', 'Width of the sharpest peak (°)', '0.167', '0.112', '0.074'],
      ['scherrer_size_nm', 'Crystallite size implied by that width (nm)', '37.4', '33.8', '58.7'],
    ],
  },
  {
    title: 'Phase composition',
    icon: 'layers',
    blurb: 'How the signal splits between sharp reflections and the broad halo.',
    rows: [
      ['crystalline_fraction', 'Share of area under sharp peaks', '0.010', '0.497', '0.770'],
      ['crystalline_area', 'That area, unnormalised', '0.0', '0.0', '0.1'],
      ['amorphous_area', 'Area under the broad halo, unnormalised', '0.0', '0.0', '0.0'],
      ['amorphous_hump_center', 'Where the halo peaks (°)', '19.94', '19.86', '23.61'],
      ['amorphous_hump_fwhm', 'How wide the halo is (°)', '14.13', '9.42', '9.71'],
      ['amorphous_fraction_blank', 'Halo share after subtracting the empty holder', '0.882', '0.529', '0.126'],
      ['crystalline_fraction_blank', 'Peak share after the same subtraction', '0.118', '0.471', '0.874'],
      ['blank_scale_factor', 'How much of the blank had to be removed', '0.000', '0.000', '0.000'],
    ],
  },
  {
    title: 'Intensity & global statistics',
    icon: 'activity',
    blurb: 'How strong the signal is, and how concentrated.',
    rows: [
      ['peak_to_background_ratio', 'Height of the peaks over the background', '0.03', '1.19', '9.42'],
      ['frac_intensity_below_15deg', 'Share of all intensity at low angle', '0.354', '0.357', '0.363'],
      ['spectral_entropy', 'How spread out the signal is', '9.24', '8.94', '8.46'],
      ['snr_global', 'Signal-to-noise over the whole scan', '3.9', '39.2', '268.6'],
      ['signal_snr_area', 'The same, weighted by area', '0.1', '1.7', '5.8'],
      ['raw_counts_max', 'Tallest raw count in the scan', '997', '1,936', '8,276'],
    ],
  },
  {
    title: 'Parameters & quality flags',
    icon: 'shield',
    blurb: 'Not measurements of the sample: what the pipeline did, and whether the result can be trusted.',
    rows: [
      ['baseline_method', 'Which baseline algorithm ran', 'arPLS', 'arPLS', 'arPLS'],
      ['baseline_lambda', 'Its smoothing parameter', '1e5', '1e5', '1e5'],
      ['broad_width_deg', 'Width threshold separating halo from peak (°)', '3.00', '3.00', '3.00'],
      ['peak_sigma_k', 'Detection threshold, in noise sigmas', '3', '3', '3'],
      ['nmf_weights', 'Weights of the decomposition, stored as a vector', '—', '—', '—'],
      ['d_max_saturated', 'Fraction hitting the low-angle limit', '0.000', '0.000', '0.000'],
      ['crystallinity_reliable', 'Fraction the pipeline flags as trustworthy', '0.050', '0.647', '0.989'],
    ],
  },
]

export const DESCRIPTOR_RECAP = {
  head: ['Descriptor', 'What it measures', 'Amorphous', 'Incipient', 'Crystalline'],
  lead:
    'A continuous diffractogram of thousands of data points is compressed into a fixed **29-dimensional vector**. Below is the complete breakdown of these physical descriptors—grouped by traceability, peak geometry, phase composition, and global statistics—alongside median values across the 1,855 expert-labelled samples.',
  counts: '484 amorphous · 1,013 incipient · 358 crystalline',
  /* Tres lecturas, una por clase, como tarjetas con simbolo en vez de un
     parrafo corrido: es lo que de verdad hay que llevarse de la tabla. */
  /* `points` en vez de un `body` corrido: tres frases seguidas por tarjeta se
     leian como un bloque, y lo que hay que llevarse de cada clase son datos
     sueltos (un umbral, un porcentaje), no un argumento encadenado. */
  reading: [
    {
      klass: 'Amorphous',
      icon: 'waves',
      tone: 'amorphous',
      title: 'Diffuse halo dominates — no Bragg peaks',
      points: [
        'Zero genuine reflections (`n_peaks` = 0)',
        'Amorphous fraction exceeds **85–90%** of total area (0.88 on the blank-corrected split)',
        'Spectral entropy is the highest of the three classes; peak-to-background ratio stays near zero',
      ],
    },
    {
      klass: 'Incipient',
      icon: 'gitbranch',
      tone: 'incipient',
      title: 'Intermediate regime — broad, emerging peaks',
      points: [
        'The transition zone between disorder and crystal growth',
        'Emerging, broader reflections — median FWHM 0.240°, even wider than amorphous',
        'Moderate peak-to-background ratios; descriptors sit midway between halo and crystalline order, making it **the most challenging class for the classifier**',
      ],
    },
    {
      klass: 'Crystalline',
      icon: 'gem',
      tone: 'pure',
      title: 'Sharp, intense Bragg reflections',
      points: [
        'Intense, narrow peaks at low angles — median FWHM 0.162°, well under 0.20°',
        'Signal-to-noise and peak-to-background jump orders of magnitude over amorphous (0.03 → 9.42)',
        'Crystalline fraction accounts for the vast majority of scattered intensity; the pipeline trusts 99% of these',
      ],
    },
  ],
  /* Version corta a proposito: la anterior explicaba el mismo caso en cuatro
     frases; esta lo deja en dos, y la comparacion numerica (37.4 vs 33.8 nm)
     hace el trabajo de convencer sin que haga falta razonarlo mas. */
  caveat:
    '`scherrer_size_nm` mathematically requires a real Bragg peak, yet it comes out **larger for amorphous samples (37.4 nm) than for incipient ones (33.8 nm)** — physically absurd, since an amorphous solid has no crystallites. Calculated over baseline noise, the formula still returns a number: a reminder that a physical formula only applies within its intended domain.',
}

/* --- Cierre de la pantalla ------------------------------------------------
   El anterior hablaba solo de los siete defectos del ETL de sintesis, y salia
   igual leyendo la mitad de caracterizacion, donde no venia a cuento. Este
   cierra las dos: lo que las dos mitades tienen en comun es que el modelo solo
   puede ver lo que esta etapa deje preparado. */
export const PREP_TAKEAWAY = {
  title: 'Why this stage decides the ceiling',
  lead:
    'A model is only as good as the feature matrix it trains on. Everything here exists to transform raw chemistry into rigorous, physically meaningful tabular numbers.',
  points: [
    {
      icon: 'flask',
      title: 'Synthesis: Chemical plausibility over statistics',
      body: 'Cleaning spreadsheets required chemical insight, not just data profiling. Catching impossible units and hidden solvent fractions prevents corrupt numbers from entering training.',
    },
    {
      icon: 'waves',
      title: 'Characterization: Signal into structured features',
      body: 'Diffraction patterns are compressed into discrete physical descriptors, preserving critical features like the amorphous halo without losing signal to baseline noise.',
    },
    {
      icon: 'link',
      title: 'The unified row: Recipes paired with outcomes',
      body: 'Recipes without outcomes cannot train a model; outcomes without recipes explain nothing. The true deliverable is the clean relational join: one complete experiment per row.',
    },
  ],
  close:
    'Domain knowledge is irreplaceable during data preparation: only a chemist can distinguish an impossible data error from a genuine, unexpected scientific discovery.',
}
