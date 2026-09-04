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
     obvio, y para un quimico no lo es. */
  etlTitle: 'ETL: extract, transform, load',
  etl:
    'The three verbs name what happens to data between where it is produced and where it can be used. **Extract** it from wherever it lives — a spreadsheet, an instrument file, a scanned report. **Transform** it into something consistent: same units, same names, same shape, with the errors found and fixed. **Load** it into the store the rest of the work reads from. It is unglamorous and it is most of the job.',
  lead:
    'Two independent streams of data arrive at this stage, and neither is usable as it stands. One is five years of synthesis conditions written by hand into a spreadsheet: what was mixed, in what proportion, at what temperature. The other is 1,877 raw diffractograms, each one a curve of several thousand points that no model can read as a curve.',
  /* Dos guiones en vez de un parrafo largo: son dos trabajos distintos y se
     lee mucho mejor cuando se ven como dos, ademas de anunciar las dos
     secciones que vienen debajo. */
  halves: [
    {
      lane: 'synthesis',
      title: 'The synthesis table needs cleaning and enrichment',
      body: 'Normalising headers, turning free text into numbers, and replacing labels such as "Fe" with the physical properties that actually explain a metal\'s behaviour.',
    },
    {
      lane: 'characterisation',
      title: 'The diffractograms need signal processing',
      body: 'Separating the crystalline signal from the background, so that each curve collapses into a fixed set of comparable numbers.',
    },
  ],
  halvesNote:
    'Those are the **two sections of this screen**, and they are read one at a time — pick one below, and the buttons come back at the bottom to switch. Only when both halves exist as rectangular tables of numbers can they be joined into a single row per experiment.',
  note:
    'This is the longest stage of the project, and the one that decides how good everything downstream can possibly be. A model cannot recover information that was destroyed here.',
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
    'Synthetic rows. The values sit inside the real observed ranges but no row corresponds to an actual experiment; sample codes are placeholders and linker identities are withheld, since several are unpublished.',
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
    'A column that holds `Fe`, `Ca`, `Zr` is a **categorical label**. Encoded the usual way, one binary column per element, it tells a model only whether two experiments used the same metal — nothing about whether two different metals behave alike. Worse, it cannot generalise: a metal absent from the training set is a column of zeros, and the model has nothing to say about it.',
  fix:
    'So each symbol is replaced by the physical properties that actually drive coordination chemistry, pulled from `mendeleev` and `pymatgen` and stored in a reference table. The label disappears; the physics stays.',
  payoff:
    'The gain is not only statistical. **Fe(II) and Fe(III) stop being the same thing** — same symbol, but 92 pm against 78,5 pm of ionic radius, and a charge-to-radius ratio of 0,022 against 0,038. A one-hot column called "Fe" collapses that difference; a table of properties preserves it. And an unseen metal is no longer unseen: it lands somewhere between the ones already measured.',
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
    'Nine techniques are ingested, and they are not interchangeable. They answer different questions, they cost different amounts of instrument time, and — crucially — they are not run in parallel. They are run **in an order**, and that order is a decision tree.',
  gate:
    'Powder X-ray diffraction is the first branch of that tree. It is fast, it needs a few milligrams, it destroys nothing, and it answers the only question that matters at that moment: **did anything ordered form at all?**',
  consequence:
    'Everything else waits on that answer. A diffractogram with sharp peaks earns the sample a thermogravimetric run to check its stability, a gas adsorption isotherm to measure its porosity, an electron micrograph to see its habit. A flat, featureless curve ends the sample — no further instrument time is spent on it.',
  why_model:
    'That is why the model predicts crystallinity and not surface area or yield. It is the property that ** gates access to every other measurement**.Predicting it before the synthesis is run is what turns a screening campaign from exhaustive into selective.',
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
    'A diffractogram is a few thousand intensity readings against angle. The pipeline turns it into a fixed row of **29 numbers**, which is what makes two experiments comparable at all. Here are all of them, grouped by what they measure, with the **median value inside each expert-labelled class** over the 1,855 labelled diffractograms.',
  counts: '484 amorphous · 1,013 incipient · 358 crystalline',
  /* Tres lecturas, una por clase, como tarjetas con simbolo en vez de un
     parrafo corrido: es lo que de verdad hay que llevarse de la tabla. */
  reading: [
    {
      klass: 'Amorphous',
      icon: 'waves',
      tone: 'amorphous',
      title: 'No peaks at all, so half the table is meaningless',
      body: '`n_peaks` is zero, so the "first peak" angle is noise at high angle and the size derived from it means nothing. What does separate it is the **blank-corrected split**: 0.88 of the signal is halo. Entropy is the highest of the three, because the intensity is spread everywhere instead of concentrated.',
    },
    {
      klass: 'Crystalline',
      icon: 'gem',
      tone: 'pure',
      title: 'Few, narrow, intense reflections at low angle',
      body: '**Peak-to-background jumps by two orders of magnitude** over amorphous, 0.03 to 9.42, and signal-to-noise by seventy. Peaks are the narrowest (0.162°) and the crystallite size the largest. The pipeline trusts 99% of these.',
    },
    {
      klass: 'Incipient',
      icon: 'gitbranch',
      tone: 'incipient',
      title: 'Between the two on almost every descriptor',
      body: 'That is exactly the problem: it **overlaps both neighbours** rather than occupying its own region. Its median peak width (0.240°) is even slightly wider than amorphous, and its crystalline fraction sits halfway. It is the class the model confuses most, and this table is why.',
    },
  ],
  caveat:
    'One number in that table is a trap. `scherrer_size_nm` is larger for amorphous samples (37.4 nm) than for incipient ones (33.8 nm), which is physically absurd — an amorphous solid has no crystallites. The Scherrer equation assumes a peak exists; applied to noise it returns a number anyway. It is kept as a reminder that **a descriptor is only valid inside the regime it was derived for**.',
}

/* --- Cierre de la pantalla ------------------------------------------------
   El anterior hablaba solo de los siete defectos del ETL de sintesis, y salia
   igual leyendo la mitad de caracterizacion, donde no venia a cuento. Este
   cierra las dos: lo que las dos mitades tienen en comun es que el modelo solo
   puede ver lo que esta etapa deje preparado. */
export const PREP_TAKEAWAY = {
  title: 'Why this stage decides the ceiling',
  lead:
    'A model does not see a laboratory. It sees a rectangle of numbers, and it can only be as good as that rectangle. Everything on this screen exists to build one: **one row per experiment**, every column meaning the same thing in every row, every gap either filled for a stated reason or left empty on purpose.',
  points: [
    {
      icon: 'flask',
      title: 'On the synthesis side, the work was interpretation',
      body: 'Seven defects survived every statistical check — including a unit error that made the most-used modulator in the record invisible to the model, while the column still looked like a plausible number. They were found by reading the values **chemically** rather than statistically: nobody flags 54 grams of formic acid in a 2.5 mL reactor except someone who has weighed formic acid.',
    },
    {
      icon: 'waves',
      title: 'On the characterisation side, the work was measurement',
      body: 'A curve of several thousand points had to become a fixed row of comparable numbers without discarding the part that matters — and the amorphous halo, which is easy to mistake for background, is precisely what separates a failed synthesis from a disordered solid.',
    },
    {
      icon: 'link',
      title: 'And neither half is useful alone',
      body: 'Conditions without an outcome cannot train anything; an outcome without its conditions cannot explain anything. The join between them, one row per experiment, is the actual deliverable of this stage.',
    },
  ],
  close:
    'That is the argument for a domain expert staying in the loop through data preparation — not as a reviewer at the end, but as the person who can tell a wrong number from an unusual one.',
}
