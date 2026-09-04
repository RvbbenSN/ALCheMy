/* GENERADO por scripts/generar_contenido_es.mjs. No editar a mano:
   se sobrescribe. Para corregir una frase, cambiarla en scripts/textos_es.json
   y volver a ejecutar el script. Lo que no este traducido sale en ingles. */

export const DESCRIPTOR_GROUPS = [
  {
    "title": "Peak geometry",
    "icon": "ruler",
    "blurb": "Dónde están las reflexiones, cuántas hay y cómo de afiladas son.",
    "rows": [
      [
        "n_peaks",
        "Peaks surviving detection",
        "0",
        "8",
        "19"
      ],
      [
        "n_peaks_k3",
        "Peaks at a looser 3σ threshold",
        "2",
        "15",
        "22"
      ],
      [
        "n_peaks_below_15deg",
        "Peaks at low angle, where frameworks show",
        "0",
        "3",
        "4"
      ],
      [
        "two_theta_first_peak",
        "Angle of the first reflection (°)",
        "24.48",
        "6.06",
        "8.62"
      ],
      [
        "d_max_angstrom",
        "Largest lattice spacing implied by it (Å)",
        "3.63",
        "14.57",
        "10.25"
      ],
      [
        "fwhm_median_deg",
        "Typical peak width (°)",
        "0.231",
        "0.240",
        "0.162"
      ],
      [
        "fwhm_min_deg",
        "Width of the sharpest peak (°)",
        "0.167",
        "0.112",
        "0.074"
      ],
      [
        "scherrer_size_nm",
        "Crystallite size implied by that width (nm)",
        "37.4",
        "33.8",
        "58.7"
      ]
    ]
  },
  {
    "title": "Phase composition",
    "icon": "layers",
    "blurb": "Cómo se reparte la señal entre las reflexiones afiladas y el halo ancho.",
    "rows": [
      [
        "crystalline_fraction",
        "Share of area under sharp peaks",
        "0.010",
        "0.497",
        "0.770"
      ],
      [
        "crystalline_area",
        "That area, unnormalised",
        "0.0",
        "0.0",
        "0.1"
      ],
      [
        "amorphous_area",
        "Area under the broad halo, unnormalised",
        "0.0",
        "0.0",
        "0.0"
      ],
      [
        "amorphous_hump_center",
        "Where the halo peaks (°)",
        "19.94",
        "19.86",
        "23.61"
      ],
      [
        "amorphous_hump_fwhm",
        "How wide the halo is (°)",
        "14.13",
        "9.42",
        "9.71"
      ],
      [
        "amorphous_fraction_blank",
        "Halo share after subtracting the empty holder",
        "0.882",
        "0.529",
        "0.126"
      ],
      [
        "crystalline_fraction_blank",
        "Peak share after the same subtraction",
        "0.118",
        "0.471",
        "0.874"
      ],
      [
        "blank_scale_factor",
        "How much of the blank had to be removed",
        "0.000",
        "0.000",
        "0.000"
      ]
    ]
  },
  {
    "title": "Intensidad y estadísticos globales",
    "icon": "activity",
    "blurb": "Cómo de fuerte es la señal, y cómo de concentrada.",
    "rows": [
      [
        "peak_to_background_ratio",
        "Height of the peaks over the background",
        "0.03",
        "1.19",
        "9.42"
      ],
      [
        "frac_intensity_below_15deg",
        "Share of all intensity at low angle",
        "0.354",
        "0.357",
        "0.363"
      ],
      [
        "spectral_entropy",
        "How spread out the signal is",
        "9.24",
        "8.94",
        "8.46"
      ],
      [
        "snr_global",
        "Signal-to-noise over the whole scan",
        "3.9",
        "39.2",
        "268.6"
      ],
      [
        "signal_snr_area",
        "The same, weighted by area",
        "0.1",
        "1.7",
        "5.8"
      ],
      [
        "raw_counts_max",
        "Tallest raw count in the scan",
        "997",
        "1,936",
        "8,276"
      ]
    ]
  },
  {
    "title": "Parámetros y banderas de calidad",
    "icon": "shield",
    "blurb": "No son medidas de la muestra: son lo que hizo el pipeline, y si el resultado es de fiar.",
    "rows": [
      [
        "baseline_method",
        "Which baseline algorithm ran",
        "arPLS",
        "arPLS",
        "arPLS"
      ],
      [
        "baseline_lambda",
        "Its smoothing parameter",
        "1e5",
        "1e5",
        "1e5"
      ],
      [
        "broad_width_deg",
        "Width threshold separating halo from peak (°)",
        "3.00",
        "3.00",
        "3.00"
      ],
      [
        "peak_sigma_k",
        "Detection threshold, in noise sigmas",
        "3",
        "3",
        "3"
      ],
      [
        "nmf_weights",
        "Weights of the decomposition, stored as a vector",
        "—",
        "—",
        "—"
      ],
      [
        "d_max_saturated",
        "Fraction hitting the low-angle limit",
        "0.000",
        "0.000",
        "0.000"
      ],
      [
        "crystallinity_reliable",
        "Fraction the pipeline flags as trustworthy",
        "0.050",
        "0.647",
        "0.989"
      ]
    ]
  }
]

export const DESCRIPTOR_RECAP = {
  "head": [
    "Descriptor",
    "What it measures",
    "Amorphous",
    "Incipient",
    "Crystalline"
  ],
  "lead": "Un difractograma continuo de miles de puntos se comprime en un **vector fijo de 29 dimensiones**. Abajo está el desglose completo de estos descriptores físicos —agrupados por trazabilidad, geometría de picos, composición de fases y estadísticos globales— junto a los valores medianos sobre las 1.855 muestras etiquetadas por un experto.",
  "counts": "484 amorphous · 1,013 incipient · 358 crystalline",
  "reading": [
    {
      "klass": "Amorphous",
      "icon": "waves",
      "tone": "amorphous",
      "title": "Domina el halo difuso — sin picos de Bragg",
      "points": [
        "Cero reflexiones genuinas (`n_peaks` = 0)",
        "La fracción amorfa supera el **85-90 %** del área total (0,88 en el reparto corregido con el blanco)",
        "La entropía espectral es la más alta de las tres clases; la relación pico-fondo se queda cerca de cero"
      ]
    },
    {
      "klass": "Incipient",
      "icon": "gitbranch",
      "tone": "incipient",
      "title": "Régimen intermedio — picos anchos, emergentes",
      "points": [
        "La zona de transición entre el desorden y el crecimiento cristalino",
        "Reflexiones emergentes y más anchas: FWHM mediana de 0,240°, incluso más ancha que la amorfa",
        "Relaciones pico-fondo moderadas; sus descriptores quedan a medio camino entre el halo y el orden cristalino, lo que la convierte en **la clase más difícil para el clasificador**"
      ]
    },
    {
      "klass": "Crystalline",
      "icon": "gem",
      "tone": "pure",
      "title": "Reflexiones de Bragg afiladas e intensas",
      "points": [
        "Picos intensos y estrechos a ángulos bajos: FWHM mediana de 0,162°, bastante por debajo de 0,20°",
        "La señal-ruido y la relación pico-fondo suben órdenes de magnitud sobre la amorfa (0,03 → 9,42)",
        "La fracción cristalina se lleva la inmensa mayoría de la intensidad dispersada; el pipeline se fía del 99 % de estas"
      ]
    }
  ],
  "caveat": "`scherrer_size_nm` exige matemáticamente un pico de Bragg real, y sin embargo sale **mayor para las muestras amorfas (37,4 nm) que para las incipientes (33,8 nm)**: físicamente absurdo, porque un sólido amorfo no tiene cristalitos. Calculada sobre el ruido de la línea base, la fórmula devuelve un número igualmente: un recordatorio de que una fórmula física solo vale dentro del dominio para el que se dedujo."
}

export const ELEMENT_INTRO = {
  "problem": "Una etiqueta categórica como \"Fe\" esconde la física y mete **Fe(II)** (92 pm) y **Fe(III)** (78,5 pm) en el mismo saco. Sustituir los símbolos químicos por **ocho propiedades fundamentales** (radio iónico de Shannon, electronegatividad, dureza HSAB, relación carga-radio) permite al modelo interpolar por la tabla periódica y predecir resultados para metales que no ha visto",
  "payoff": "Los nombres de molécula no transmiten significado espacial ni químico. Con RDKit, cada conector se convierte en **seis descriptores geométricos y topológicos**: denticidad (puntos de unión), distancia máxima entre donores (aproximación al tamaño de poro), número de protones ácidos y enlaces rotables (flexibilidad), que capturan las reglas estructurales del ensamblaje reticular."
}

export const LANES = [
  {
    "id": "synthesis",
    "label": "Synthesis conditions",
    "tag": "Notebook 01",
    "sub": "Una hoja de recetas se convierte en una tabla gobernada",
    "blurb": "Lo que controla el químico: metal, conector, disolvente, temperatura, tiempo, modulador. Datos estructurados que nunca se estructuraron bien."
  },
  {
    "id": "characterisation",
    "label": "Characterisation signal",
    "tag": "Cuadernos 02 y 05",
    "sub": "Un difractograma se convierte en 29 números comparables",
    "blurb": "Lo que responde el material. Curvas de instrumento en crudo que hay que procesar antes de poder comparar dos cualesquiera."
  }
]

export const LINKER_FEATURES = [
  [
    "scaffold",
    "El núcleo rígido sobre el que se construye el conector. Gobierna el tamaño del poro que puede formarse."
  ],
  [
    "denticity",
    "Por cuántos puntos puede unirse el conector. Dos dan una cadena; tres o más, una red."
  ],
  [
    "n_acidic_protons",
    "Cuántos protones tienen que salir antes de que el conector pueda coordinar, que es lo que ata el resultado al pH y al modulador."
  ],
  [
    "max_donor_distance_a",
    "La distancia entre los puntos de unión más externos, en ångström. La estimación de primer orden del tamaño de poro."
  ],
  [
    "protection_state",
    "Si los grupos de unión llegan enmascarados como ésteres y hay que liberarlos in situ."
  ],
  [
    "n_rotatable_bonds",
    "Libertad conformacional. Un conector flexible tiene muchas menos probabilidades de dar una red ordenada."
  ]
]

export const METAL_FEATURES = [
  [
    "electronegativity_pauling",
    "Con cuánta fuerza atrae el metal la densidad electrónica del conector. La escala clásica."
  ],
  [
    "electronegativity_allen",
    "Una segunda escala, calculada a partir de energías espectroscópicas. Se calcula aquí, pero se **descarta antes de entrenar**: no está definida para los lantánidos, así que para Ce, La, Nd y Dy el valor no existe, más que faltar. La pantalla 04 cuenta esa historia."
  ],
  [
    "absolute_hardness_ev",
    "Resistencia a la deformación de la nube electrónica. Los metales duros prefieren donores duros: la regla HSAB, convertida en número."
  ],
  [
    "oxophilicity_kepp",
    "Afinidad por donores de oxígeno, que es lo que ofrece un conector carboxilato."
  ],
  [
    "polarizability_a3",
    "Con cuánta facilidad se deforma la nube electrónica. Gobierna la parte más blanda y menos direccional del enlace."
  ],
  [
    "oxidation_state",
    "Recuperado de la sal metálica utilizada, no del elemento. Es lo que separa Fe(II) de Fe(III)."
  ],
  [
    "shannon_radius_pm",
    "Radio iónico para ese estado de oxidación y ese número de coordinación concretos. Fija cuántos conectores caben alrededor del metal."
  ],
  [
    "charge_over_radius",
    "Densidad de carga: el campo que el metal proyecta sobre sus vecinos. Derivada, y la más informativa del grupo."
  ]
]

export const PREP_INTRO = {
  "etlTitle": "ETL: extraer, transformar, cargar",
  "etlSteps": [
    {
      "key": "extract",
      "label": "Extract",
      "body": "Saca los datos de donde sea que vivan: una hoja de cálculo, un fichero de instrumento, un informe escaneado."
    },
    {
      "key": "transform",
      "label": "Transform",
      "body": "Conviértelos en algo coherente: mismas unidades, mismos nombres, misma forma, con los errores encontrados y corregidos."
    },
    {
      "key": "load",
      "label": "Load",
      "body": "Déjalos en el almacén del que lee todo el resto del trabajo."
    }
  ],
  "lead": "A esta etapa llegan dos flujos de datos independientes, y ninguno es utilizable tal cual. Uno son cinco años de registros manuales de síntesis (mezclas, proporciones, temperaturas). El otro son 1.877 difractogramas en crudo: miles de puntos ruidosos por muestra que hay que estandarizar en características numéricas discretas.",
  "halves": [
    {
      "lane": "synthesis",
      "title": "La tabla de síntesis necesita limpieza y enriquecimiento",
      "body": "Normalizar cabeceras, convertir texto libre en números, y sustituir las etiquetas de elementos y conectores por las propiedades que explican su comportamiento."
    },
    {
      "lane": "characterisation",
      "title": "Los difractogramas necesitan procesado de señal",
      "body": "Separar la señal cristalina del fondo, para que cada curva se reduzca a un conjunto fijo de números comparables."
    }
  ],
  "halvesNote": "Esas son las **dos secciones de esta pantalla**, y se leen de una en una: elige una abajo, y los botones vuelven a aparecer al final para cambiar.",
  "note": "**Basura entra, basura sale**. Esta etapa fija la calidad de todo lo que viene después."
}

export const PREP_TAKEAWAY = {
  "title": "Por qué esta etapa decide el techo",
  "lead": "Un modelo no puede ser mejor que la matriz de características con la que entrena. Todo lo que hay aquí existe para convertir química en crudo en números tabulares rigurosos y con sentido físico.",
  "points": [
    {
      "icon": "flask",
      "title": "Síntesis: plausibilidad química por encima de la estadística",
      "body": "Limpiar las hojas de cálculo exigió criterio químico, no solo perfilado de datos. Cazar unidades imposibles y fracciones de disolvente ocultas impide que entren números corruptos al entrenamiento."
    },
    {
      "icon": "waves",
      "title": "Caracterización: de señal a características estructuradas",
      "body": "Los patrones de difracción se comprimen en descriptores físicos discretos, conservando rasgos críticos como el halo amorfo sin perder señal contra el ruido de la línea base."
    },
    {
      "icon": "link",
      "title": "La fila unificada: recetas emparejadas con resultados",
      "body": "Recetas sin resultados no entrenan nada; resultados sin recetas no explican nada. El entregable de verdad es el JOIN relacional limpio: un experimento completo por fila."
    }
  ],
  "close": "El conocimiento del dominio es insustituible durante la preparación de datos: solo un químico distingue un error imposible de un hallazgo científico genuino e inesperado."
}

export const SYNTH_GROUPS = [
  {
    "title": "Identidad y auditoría",
    "icon": "id",
    "body": "Quién la hizo, cuándo, bajo qué unidad y en qué pocillo de la placa de alto rendimiento. No es predictivo, pero es lo que hace una fila rastreable hasta una página física de cuaderno: el requisito ISO-17025 que convierte una hoja de cálculo en un registro.",
    "fields": [
      "sample_code",
      "synthesis_date",
      "researcher_name",
      "research_unit",
      "hts_number",
      "well_position",
      "synthesis_type"
    ]
  },
  {
    "title": "Theoretical design",
    "icon": "design",
    "body": "La química que el experimento pretendía ser. **lm_ratio** —conector frente a metal— es el número más discutido de toda la tabla: decide si hay suficiente puntal orgánico para levantar una red.",
    "fields": [
      "metal_center",
      "metal_source",
      "linker",
      "metal_conc_m",
      "lm_ratio",
      "metal_mass_mg",
      "linker_mass_mg"
    ]
  },
  {
    "title": "Solvent system",
    "icon": "solvent",
    "body": "Seis disolventes registrados como volúmenes absolutos en mililitros. Los volúmenes absolutos no son comparables entre un vial de 1,5 mL y un autoclave de 15 mL, así que después se convierten en **fracciones del total**, más un `fill_fraction` que dice cuán lleno estaba el reactor.",
    "fields": [
      "h2o_total_ml",
      "meoh_ml",
      "etoh_ml",
      "proh_1_ml",
      "dmf_ml",
      "def_ml",
      "total_volume_ml",
      "reactor_volume_ml"
    ]
  },
  {
    "title": "Thermal ramp",
    "icon": "thermal",
    "body": "Escritas en los cuadernos como texto libre: *\"rampa a 120 °C en 2 h, mantener 48 h, enfriar toda la noche\"*. Se parsean en cuatro números, porque la **velocidad** de calentamiento y de enfriamiento cambia el producto tanto como la temperatura objetivo.",
    "fields": [
      "temp_initial_c",
      "temp_target_c",
      "temp_final_c",
      "heating_time_hours",
      "time_hours",
      "cooling_time_hours",
      "heating_rate_c_min",
      "cooling_rate_c_min"
    ]
  },
  {
    "title": "Modulators",
    "icon": "modulator",
    "body": "Diez aditivos, cada uno guardado como **mmol de especie activa** y no como microlitros de disolución madre. La conversión es la transformación más delicada del cuaderno: un modulador añadido como ácido acuoso también aporta agua, y olvidarlo corrompe las fracciones de disolvente de arriba.",
    "fields": [
      "formic_acid_mmol",
      "acetic_acid_mmol",
      "propionic_acid_mmol",
      "tfa_mmol",
      "hcl_active_mmol",
      "hf_active_mmol",
      "koh_active_mmol",
      "triethylamine_mmol",
      "cf3so3h_mmol",
      "meo3s_mmol"
    ]
  }
]

export const SYNTH_PREVIEW = {
  "caption": "Una fila por síntesis, 46 columnas. Estas ocho son las que un químico reconocería primero.",
  "warning": "Filas sintéticas. Los valores están dentro de los rangos reales observados, pero ninguna fila corresponde a un experimento real; los códigos de muestra son marcadores y las identidades de los conectores se omiten.",
  "head": [
    "sample_code",
    "metal_center",
    "linker",
    "metal_conc_m",
    "lm_ratio",
    "temp_target_c",
    "time_hours",
    "mod_total_mmol"
  ],
  "rows": [
    [
      "SYN-0001",
      "Fe",
      "L-A",
      "0.030",
      "0.50",
      "120",
      "48.0",
      "0.267"
    ],
    [
      "SYN-0002",
      "Ca",
      "L-B",
      "0.080",
      "0.10",
      "25",
      "1.0",
      "2.040"
    ],
    [
      "SYN-0003",
      "Cu",
      "L-A",
      "0.060",
      "0.50",
      "150",
      "48.0",
      "0.000"
    ],
    [
      "SYN-0004",
      "Zr",
      "L-C",
      "0.030",
      "0.33",
      "120",
      "24.0",
      "0.512"
    ],
    [
      "SYN-0005",
      "Bi",
      "L-A",
      "0.030",
      "0.50",
      "150",
      "48.0",
      "0.000"
    ],
    [
      "SYN-0006",
      "Ni",
      "L-D",
      "0.090",
      "0.50",
      "130",
      "48.0",
      "0.118"
    ]
  ]
}

export const WHY_PXRD = {
  "lead": "En química reticular, la difracción de rayos X de polvo (PXRD) es el diagnóstico de referencia. Rápida y no destructiva, da información inmediata sobre el orden periódico de largo alcance.",
  "gate": "La PXRD solo necesita miligramos y minutos de barrido, sin consumir la muestra. Revela de inmediato si la reacción produjo reflexiones de Bragg afiladas (características de una red ordenada) o un perfil amorfo difuso, y así establece si la fase cristalina buscada se ensambló antes de invertir en caracterización avanzada.",
  "why_model": "En los MOF periódicos, el orden de largo alcance dicta la arquitectura del poro, la superficie interna y las propiedades huésped-anfitrión. Predecir si una combinación concreta de variables de síntesis dará una red cristalina permite navegar el espacio de reacción de forma racional, descartando de antemano las condiciones poco prometedoras.",
  "steps": [
    [
      "PXRD",
      "¿Es cristalino?",
      "Minutos. No destructiva. Se hace a todo.",
      true
    ],
    [
      "FTIR · UV-Vis · ICP · EA",
      "¿Qué grupos, qué band gap, qué composición?",
      "Confirmatoria. Solo cuando el material merece confirmarse.",
      false
    ],
    [
      "TGA",
      "¿Hasta qué temperatura sobrevive?",
      "Horas. Consume la muestra.",
      false
    ],
    [
      "SEM",
      "¿Qué aspecto tienen los cristales?",
      "Tiempo de instrumento reservado, y un operador con formación.",
      false
    ],
    [
      "Gas adsorption",
      "¿Es poroso de verdad, y cuánto?",
      "Un día por muestra. Necesita activación previa.",
      false
    ]
  ]
}
