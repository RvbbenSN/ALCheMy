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
  lead:
    'Two independent streams of data arrive at this stage, and neither is usable as it stands. One is five years of synthesis conditions written by hand into a spreadsheet: what was mixed, in what proportion, at what temperature. The other is 1.877 raw diffractograms, each one a curve of several thousand points that no model can read as a curve.',
  body:
    'Preparing them means two different kinds of work. The synthesis table needs **cleaning and enrichment**: normalising headers, turning free text into numbers, and replacing labels such as "Fe" with the physical properties that actually explain a metal\'s behaviour. The diffractograms need **signal processing**: separating the crystalline signal from the background so that each curve collapses into a fixed set of comparable numbers. Only when both halves exist as rectangular tables of numbers can they be joined into a single row per experiment.',
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
  ['electronegativity_allen', 'A second scale, computed from spectroscopic energies. Kept alongside Pauling because they disagree exactly where it matters, among the transition metals.'],
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
    'That is why the model predicts crystallinity and not surface area or yield. It is not the most interesting property a MOF has; it is the property that **gates access to every other measurement**. Predicting it before the synthesis is run is what turns a screening campaign from exhaustive into selective.',
  steps: [
    ['PXRD', 'Is it crystalline?', 'Minutes. Non-destructive. Run on everything.', true],
    ['TGA', 'Up to what temperature does it survive?', 'Hours. Consumes the sample.', false],
    ['Gas adsorption', 'Is it actually porous, and how much?', 'A day per sample. Needs prior activation.', false],
    ['SEM', 'What do the crystals look like?', 'Booked instrument time, and a trained operator.', false],
    ['FTIR · UV-Vis · ICP · EA', 'Which groups, which gap, which composition?', 'Confirmatory. Only once the material is worth confirming.', false],
  ],
}

/* --- La traduccion: de una curva a numeros ------------------------------- */

export const DESCRIPTOR_RECAP = {
  lead:
    'A diffractogram is a few thousand intensity readings against angle. The pipeline turns it into a fixed row of 29 numbers, which is what makes two experiments comparable at all. The table below is the same summary as the synthesis one, for the other lane: the **median value of each descriptor within each expert-labelled class**, over the 1.855 labelled diffractograms.',
  head: ['Descriptor', 'What it measures', 'Amorphous', 'Incipient', 'Crystalline'],
  rows: [
    ['n_peaks', 'Peaks surviving detection', '0', '8', '19'],
    ['crystalline_fraction', 'Share of the area under sharp peaks', '0,010', '0,497', '0,770'],
    ['peak_to_background_ratio', 'Height of the signal over the hump', '0,03', '1,19', '9,42'],
    ['fwhm_median_deg', 'Typical peak width, in degrees', '0,231', '0,240', '0,162'],
    ['scherrer_size_nm', 'Crystallite size implied by that width', '37,4', '33,8', '58,7'],
    ['two_theta_first_peak', 'Angle of the first reflection', '24,48', '6,06', '8,62'],
    ['spectral_entropy', 'How spread out the signal is', '9,24', '8,94', '8,46'],
  ],
  reading:
    'Read down a column and you get the fingerprint of a class. **Amorphous** materials have no peaks at all, so `n_peaks` is zero and the "first peak" angle is meaningless noise at high angle. **Crystalline** ones concentrate their signal into few, narrow, intense reflections at low angle: entropy drops, the peak-to-background ratio jumps by two orders of magnitude. **Incipient** sits between the two, and that is exactly the problem — it overlaps both neighbours on almost every descriptor, which is why it is the class the model confuses most.',
  caveat:
    'One number in that table is a trap. `scherrer_size_nm` is *larger* for amorphous samples than for incipient ones, which is physically absurd — an amorphous solid has no crystallites. The Scherrer equation assumes a peak exists; applied to noise it returns a number anyway. It is kept in the table as a reminder that a descriptor is only valid inside the regime it was derived for.',
}
