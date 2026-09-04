/* GENERADO por scripts/generar_contenido_es.mjs. No editar a mano:
   se sobrescribe. Para corregir una frase, cambiarla en scripts/textos_es.json
   y volver a ejecutar el script. Lo que no este traducido sale en ingles. */

export const EDA_BIVARIATE = {
  "title": "¿Separa las clases alguna variable por sí sola?",
  "whichTitle": "Qué variables se están probando aquí",
  "which": "Los **29 descriptores PXRD** extraídos de cada difractograma: número de picos, fracción cristalina, anchura de pico, entropía, señal-ruido y el resto. No las condiciones de síntesis. La pregunta es si alguna medida tomada *del propio patrón* basta, por sí sola, para distinguir las tres clases.",
  "shapesTitle": "Qué aspecto tiene cada clase en números",
  "shapes": [
    {
      "klass": "Amorphous",
      "tone": "amorphous",
      "body": "**Ningún pico** (`n_peaks` = 0). El 88 % del área dispersada está bajo el halo difuso, y la relación pico-fondo se queda cerca de **0,03**."
    },
    {
      "klass": "Incipient",
      "tone": "incipient",
      "body": "Un puñado de reflexiones **anchas**: mediana de 8 picos a **0,240°** de FWHM, con cerca de la mitad del área cristalina y una relación pico-fondo próxima a **1,19**."
    },
    {
      "klass": "Crystalline",
      "tone": "pure",
      "body": "Muchas reflexiones **afiladas**: mediana de 19 picos a **0,162°** de FWHM, **77 %** de fracción cristalina y relación pico-fondo de **9,42**."
    }
  ],
  "shapesLink": "De dónde salen esos 29 números, descriptor a descriptor",
  "ordering": "Sí ordenan las clases con limpieza: todos los descriptores probados suben o bajan **monótonamente** de amorfo a incipiente y de ahí a cristalino. Los números coinciden con los veredictos humanos en la dirección del efecto.",
  "body": "Pero ordenar no es separar. En los diagramas de caja de abajo las cajas **se solapan en todas las variables probadas**: una muestra incipiente y una cristalina pueden compartir el mismo número de picos, la misma anchura, la misma entropía. Ese solape es la definición de un problema multivariante, y la razón de que haga falta un modelo y no un umbral.",
  "distributionsNote": "Las medianas se separan; las *distribuciones* que hay detrás se solapan. Una variable puede desplazarse de clase en clase y aun así no llegar a clasificar ni una sola muestra."
}

export const EDA_CONFOUNDER = {
  "title": "El factor de confusión que casi arruina el análisis",
  "intro": "El registro contiene tres formas de fabricar un material, y una versión anterior de este análisis las mezcló sin mirar. Los números:",
  "microwaveRowBefore": "Fíjate en la fila del microondas: el segmento amorfo no es pequeño, es",
  "microwaveRowEmphasis": "inexistente",
  "microwaveRowAfter": ".",
  "tableHead": [
    "Synthesis type",
    "Amorphous",
    "Crystalline",
    "Incipient",
    "% crystalline"
  ],
  "tableRows": [
    [
      "HTS — combinatorial screening",
      "401",
      "169",
      "971",
      "11.0%"
    ],
    [
      "ST — standard solvothermal",
      "3",
      "71",
      "15",
      "79.8%"
    ],
    [
      "MW — microwave-assisted",
      "0",
      "90",
      "4",
      "95.7%"
    ]
  ],
  "points": [
    {
      "label": "The shortcut",
      "body": "**Cero muestras amorfas en microondas.** Detectar que una síntesis fue asistida por microondas, aunque sea indirectamente por el volumen de reactor o el año, permite a un modelo responder CRISTALINO y acertar el 96 % de las veces. Esos 94 casos son el 5 % del conjunto de datos y el 27 % de la clase cristalina."
    },
    {
      "label": "La causa es sesgo de selección",
      "body": "El cribado combinatorio es exploratorio, así que está lleno de fracasos. La síntesis estándar y la de microondas se usan cuando ya se sabe que la receta funciona. \"Tipo de síntesis\" codifica en gran medida **si el resultado ya se conocía**."
    },
    {
      "label": "Y la física es distinta",
      "body": "El calentamiento por microondas es localizado y rápido, lo que favorece las fases cinéticas frente a las termodinámicas. Mezclar los métodos obliga al modelo a aprender dos físicas como si fueran una."
    }
  ],
  "decision": [
    "Es el único subconjunto sin sesgo de éxito: se diseñó para explorar, no para confirmar.",
    "Es lo que de verdad queremos predecir: la siguiente placa es una placa de HTS.",
    "Es un único régimen térmico, así que el modelo aprende una física, no dos."
  ],
  "price": "El precio queda dicho: se pierden 90 de los 330 casos cristalinos, un 27 %, y la clase minoritaria se vuelve aún más escasa. La alternativa es **una puntuación más alta que mide el método de síntesis** en vez de la química."
}

export const EDA_CORRELATION = {
  "title": "Correlación: dos preguntas distintas",
  "featureMapFigureAlt": "Mapa de correlación entre variables",
  "featureMapFigureCaption": "Variable contra variable. Los bloques rojos son en su mayoría propiedades del mismo metal, correlacionadas por física —no es un problema, sino la razón por la que la interpretación final se hace por bloque químico.",
  "targetAssociationFigureAlt": "Asociación de cada variable con la clase objetivo, veinte variables numéricas principales",
  "targetAssociationFigureCaption": "Asociación con el objetivo, medida por razón de correlación en vez de Pearson —el objetivo tiene tres categorías, no una magnitud.",
  "questions": [
    {
      "title": "¿Se mueven juntas dos variables de entrada?",
      "lead": "Esta va de **interpretación**, no de rendimiento.",
      "points": [
        [
          "Qué buscar",
          "No una correlación cero, sino saber **dónde** no es cero."
        ],
        [
          "Por qué importa",
          "Dos columnas que llevan casi la misma información hacen que el modelo **reparta el mérito entre ellas de forma arbitraria**. Leer entonces \"esta variable apenas importa\" sería un error: importa, pero su gemela se llevó el mérito."
        ],
        [
          "Qué se hace al respecto",
          "La interpretación final se lee **por bloque químico**, nunca variable a variable."
        ]
      ],
      "note": "Un mapa con bloques rojos no es un problema. Aquí son sobre todo propiedades del mismo metal, correlacionadas **por física**: la electronegatividad y la dureza de un catión no son independientes en la naturaleza."
    },
    {
      "title": "¿Se relaciona cada variable con la variable objetivo?",
      "lead": "Esta es la que **sí** quieres que sea alta: es literalmente la señal que el modelo va a explotar.",
      "points": [
        [
          "Por qué Pearson no vale",
          "La variable objetivo es **categórica con tres niveles**, no un número. Un coeficiente de Pearson entre \"amorfo\" y una temperatura no está definido."
        ],
        [
          "Qué se usa en su lugar",
          "La razón de correlación **η²** para numérica frente a categórica, y la **V de Cramér** para categórica frente a categórica."
        ],
        [
          "Cómo leerlo",
          "Las dos se representan abajo, en la misma escala, así que una asociación débil parece débil."
        ]
      ]
    }
  ],
  "blankTitle": "Las celdas en blanco no son datos ausentes",
  "blankBody": "Un cuadro blanco significa que la correlación **no está definida**, no que se haya perdido un valor. `reactor_volume_ml` vale 2,5 mL en todas las síntesis de alto rendimiento, así que su varianza es cero y cualquier correlación con ella divide entre cero.",
  "blankConsequence": "De ahí se sigue que `fill_fraction` es exactamente `total_volume_ml / 2.5`: la misma variable reescalada, en las 1.516 filas. **Las dos columnas quedan excluidas del modelo** — varianza cero en una, colinealidad perfecta en la otra.",
  "causation": "**Correlación no es causalidad**. Estos gráficos miden si dos cosas se mueven juntas, nada más. Que la temperatura aparezca asociada a la cristalinidad no demuestra que subirla cause la cristalización: pueden compartir una causa común, o ser una coincidencia de este registro. Establecer causalidad exige intervenir, cambiando solo la temperatura y viendo qué pasa."
}

export const EDA_DISCRETE = {
  "title": "Las variables de proceso son **discretas en la práctica**",
  "body": "Una variable continua sobre el papel no es continua en el registro. En el conjunto de entrenamiento, tres de las principales variables de proceso toman estos valores y ningún otro:",
  "tableHead": [
    "Variable",
    "Distinct values",
    "Which ones"
  ],
  "tableRows": [
    [
      "temp_target_c",
      "9",
      "80 · 100 · 110 · 120 · 130 · 135 · 140 · 150 · 160 °C"
    ],
    [
      "lm_ratio",
      "8",
      "0.15 · 0.20 · 0.30 · 0.33 · 0.50 · 0.60 · 0.80 · 1.00"
    ],
    [
      "time_hours",
      "3",
      "24 · 48 · 72 h"
    ]
  ],
  "concentration": "Y tampoco se usan de forma uniforme: **710 de las síntesis están a 150 °C** y 370 a 120 °C, así que dos ajustes de nueve cubren siete décimas partes del registro.",
  "why": "Esto refleja cómo se diseña la síntesis combinatoria: **fijar una rejilla de condiciones y barrer la composición**. Un químico que llena una placa de 24 pocillos elige números redondos.",
  "consequence": "Trae una consecuencia para la interpretación: **una variable que apenas se varió no puede explicar mucha varianza, por importante que sea químicamente**. El tiempo de reacción toma tres valores en este registro, así que un modelo que lo encuentre irrelevante está describiendo el registro, no la química."
}

export const EDA_FUNNEL_INTRO = {
  "title": "Del registro completo al conjunto de entrenamiento",
  "lead": "El laboratorio realizó **2.167 síntesis**. La cadena de abajo cuenta **filas de la tabla de características**, y por eso empieza en 2.152: son las síntesis que el pipeline pudo convertir en características.",
  "chain": "Cada paso quita exactamente un filtro de la consulta que el registro de modelos guarda para este conjunto de datos, así que la última línea es el número que tiene el registro. **Cada caída es una exclusión deliberada con un motivo declarado.**",
  "scope": "En la última fila el modelo ya no es un modelo de la química de este laboratorio: es un modelo de **síntesis combinatorias que produjeron un polvo que alguien estuvo dispuesto a juzgar**. Todo lo de abajo se refiere a esas 1.516 filas salvo que diga otra cosa."
}

export const EDA_IMBALANCE = {
  "title": "La variable objetivo: cuánto desequilibrio hay",
  "intro": "En las 1.516 filas de entrenamiento las tres clases distan mucho de ser igual de frecuentes, y eso es química y no muestreo: la mayoría de los intentos aterrizan en un punto intermedio.",
  "tableHead": [
    "Class",
    "What it means",
    "Samples",
    "Share"
  ],
  "tableRows": [
    [
      "Incipient",
      "Broad reflections near a crystallisation boundary",
      "967",
      "63.8%"
    ],
    [
      "Amorphous",
      "No reflections at all",
      "382",
      "25.2%"
    ],
    [
      "Crystalline",
      "Sharp, well-ordered reflections",
      "167",
      "11.0%"
    ]
  ],
  "trivial": "Un modelo que no aprende nada, que responde siempre **INCIPIENTE**, acierta el 64 % de las veces. Por eso cada métrica de este proyecto se da contra ese suelo y no contra cero: informar de un \"64 % de exactitud\" describiría un modelo que no hace nada.",
  "ratio": "La diferencia entre la clase mayor y la menor es de **6 : 1**, y es más marcada que en el registro completo, porque restringir a síntesis de alto rendimiento quitó material que era casi todo cristalino. Se trata **ponderando las clases dentro de cada modelo**, que es más simple que remuestrear y no inventa muestras que nunca se hicieron."
}

export const EDA_INTRO = {
  "acronym": "EDA",
  "expansion": "Análisis Exploratorio de Datos",
  "hook": "Todo lo que sigue cambió el plan antes de entrenar un solo modelo.",
  "steps": [
    {
      "key": "look",
      "label": "Look",
      "body": "Representar todas las variables, contar lo que falta, comprobar si las clases están equilibradas y si dos columnas dicen lo mismo dos veces."
    },
    {
      "key": "decide",
      "label": "Decide",
      "body": "No produce ningún modelo ni ninguna métrica, y por eso se salta. Lo que produce son decisiones: qué filas descartar, de qué columnas no fiarse."
    },
    {
      "key": "catch",
      "label": "Catch confounders",
      "body": "Separar la señal que viene de la química de la que viene de cómo se recogieron los datos."
    }
  ],
  "rule": "**Un modelo no puede avisarte de un problema que ha aprendido a explotar.** Si hay un factor de confusión en los datos de entrenamiento, la validación cruzada premia al modelo por usarlo. El único sitio donde cazarlo es aquí.",
  "found": [
    [
      "A confounder",
      "Un método de síntesis no había producido ni una sola muestra amorfa, así que el propio método predecía la respuesta"
    ],
    [
      "Cinco tipos de hueco",
      "Un nueve por ciento ausente, por cinco causas sin relación entre sí, cada una con su arreglo distinto"
    ],
    [
      "Un desequilibrio de 6 : 1",
      "Entre la clase mayor y la menor, suficiente para que la exactitud no signifique nada"
    ],
    [
      "Hidden structure",
      "Filas que no son independientes entre sí, lo que hace que una partición aleatoria mienta"
    ]
  ],
  "foundIntro": "Lo que este encontró, en orden:"
}

export const EDA_LEAKAGE = {
  "title": "Estructura oculta: por qué una partición aleatoria mentiría",
  "body": "Cada fila es **una síntesis**: un pocillo de una placa de 24, con sus condiciones y el veredicto de su difractograma. Esas filas **no son independientes entre sí**. Una placa es un lote preparado el mismo día, con el mismo conector, la misma rampa térmica y a menudo el mismo metal, barriendo una variable. Y las placas son homogéneas por dentro: conocer un pocillo te dice casi todo lo que hicieron sus 23 vecinos.",
  "consequence": "Una partición aleatoria pondría muestras de la misma placa en entrenamiento y en test. El modelo no necesitaría aprender nada de química: **le bastaría con reconocer la placa**. La puntuación saldría inflada y falsa. Por eso la validación agrupa por placa, y ninguna placa aparece nunca en los dos lados.",
  "plateFigureAlt": "Distribución de muestras entre placas de alto rendimiento, y cómo de homogénea es cada placa",
  "plateFigureCaption": "Las muestras se agrupan en placas, y las placas son internamente homogéneas. Conocer un pocillo de una placa dice casi todo lo que hicieron sus vecinos.",
  "reminder": "Esto se suma al desequilibrio de clases. Con el **64 % de las muestras incipientes** y placas enteras casi uniformes en una clase, una partición afortunada puede darle al conjunto de test una placa que sea 90 % incipiente, donde la línea base que no hace nada saca un 90 % y cualquier modelo parece brillante. Agrupar por placa impide que la partición elija su propia dificultad.",
  "drift": "También hay deriva temporal: las proporciones de clase cambian año a año, porque el laboratorio estaba aprendiendo. Cada barra lleva su recuento, porque **una proporción sin su tamaño de muestra engaña**: un año con siete muestras enseña una barra del 100 % que no significa nada."
}

export const EDA_MISSING = {
  "title": "Missing values",
  "intro": "Una sola cifra de \"9 % ausente\" esconde problemas sin relación entre sí, y solo algunos son lo que la imputación da por supuesto.",
  "tableHead": [
    "Property",
    "Who is missing",
    "Why",
    "What was done"
  ],
  "figureAlt": "Gráfico de barras del porcentaje de valores ausentes por columna",
  "figureCaption": "Ausencia de datos por columna. Las barras se parecen; las causas detrás no, y ese es justo el sentido de la tabla de abajo.",
  "tableRows": [
    [
      "Allen electronegativity",
      "Ce, La, Nd, Dy",
      "The Allen scale is spectroscopic and is not defined for lanthanides",
      "Column dropped. This is not a gap — the quantity does not exist. Pauling covers all 20 metals and stays"
    ],
    [
      "Absolute hardness",
      "Mg, Zn",
      "η = (IE − EA)/2, and there is no measured electron affinity: their closed shells do not bind an extra electron",
      "Imputed, knowing it is imperfect"
    ],
    [
      "Kepp oxophilicity",
      "Ga",
      "Absent from the original paper — only B, Al and In of group III appear",
      "Permanent, documented null"
    ],
    [
      "Oxidation state, ionic radius",
      "22 rows",
      "A non-breaking space (U+00A0) in the precursor text",
      "Fixed by normalising the join, not by hand-listing variants"
    ],
    [
      "Mean carboxylic pKa",
      "70% of rows",
      "Not a fault: those syntheses carry no carboxylic modulator, and \"no acid\" has no pKa",
      "Imputed; flagging it was tested and adds nothing"
    ],
    [
      "Solvent fractions",
      "18% of rows",
      "The volumes written down do not add up to the total volume declared",
      "**NULL, not 0**"
    ]
  ]
}

export const EDA_MODULATORS = {
  "title": "De dónde salen los descriptores de modulador",
  "problem": "Diez columnas de ácidos, casi todas a cero en cualquier fila dada, dejarían al modelo memorizar qué placa usó qué reactivo en vez de aprender química. Así que se **agruparon por papel químico** (carboxílico, ácido fuerte, HF, base, fluorado) y se sumaron. Dos columnas extra llevan el **pKa medio y el logP medio de los ácidos presentes**, ponderados por cuánto se añadió de cada uno, para no perder la química que la suma descarta.",
  "formula": "mod_carbox_mean_pka = (3.75·formic + 4.76·acetic + 4.87·propionic) / total carboxylic mmol",
  "caveats": [
    "**Aquí \"carboxílico\" significa carboxílico débil.** El ácido trifluoroacético va agrupado con los ácidos fuertes: el criterio fue el pKa, no la familia funcional, y con un pKa de 0,23 se comporta como uno de ellos. 82 síntesis.",
    "**Los valores de pKa y logP no llevan cita.** Son cifras acuosas estándar a 25 °C escritas directamente en el SQL. Cualquier otra propiedad química del modelo se puede rastrear hasta una referencia en `property_sources`."
  ]
}

export const EDA_PCA = {
  "title": "La proyección PCA",
  "disclaimer": "Esto es un diagnóstico, no un modelo.",
  "figureAlt": "Proyección PCA de las síntesis, coloreada por clase de resultado con el esqueleto del ligando como forma del marcador",
  "figureCaption": "El color es la clase de resultado, la forma del marcador el esqueleto del ligando. Los esqueletos ocupan regiones distintas —la química del ligando es buena parte de lo que separa el espacio— pero las clases en sí se solapan mucho.",
  "whatTitle": "Qué hace un PCA",
  "what": [
    "Cada síntesis es un punto en un espacio con una dimensión por variable, que no se puede mirar directamente.",
    "El PCA encuentra la **dirección en la que los puntos están más dispersos**, luego la dirección más dispersa perpendicular a esa, y así sucesivamente.",
    "Proyectar sobre las dos primeras da una imagen plana que conserva tanta dispersión original como puede conservar cualquier imagen plana.",
    "Es un **cambio de punto de vista, no un resumen**: no se descarta nada."
  ],
  "varsTitle": "Qué entra",
  "varsNote": "Las **38 columnas de condiciones de síntesis**: propiedades del metal, propiedades del conector, fracciones de disolvente, rampa térmica y moduladores. No los 29 descriptores PXRD, que describen el resultado. La pregunta es si lo que se *hizo* ya separa los resultados.",
  "stepsTitle": "Cómo se construye",
  "steps": [
    "**Estandarizar** las variables numéricas después de imputar. Sin ello, el tiempo de reacción (hasta 96) aplastaría una fracción de disolvente (de 0 a 1) solo por la escala de sus unidades.",
    "**Encontrar la dirección de máxima varianza**, una combinación lineal de todas las variables, y llamarla primera componente. Luego la máxima varianza restante perpendicular a ella, y así sucesivamente.",
    "**Proyectar** las muestras sobre esas componentes para poder dibujarlas."
  ],
  "honest": "El PCA usa todas las variables y **no conoce las clases**: es no supervisado, y los colores se pintan después. Así que cualquier separación que aparezca es estructura real en las condiciones de síntesis.",
  "findings": [
    "Hay estructura, pero las clases se solapan mucho. El problema es genuinamente multivariante y genuinamente difícil.",
    "Añadir una tercera componente no revela ninguna separación oculta. Es un resultado negativo útil: **no hay un plano que separe las clases**, lo que ya anticipa que ningún modelo lineal va a brillar.",
    "Llegar al 90 % de la varianza exige muchas componentes. La información está repartida entre muchas variables y no concentrada en dos o tres, así que reducir la dimensionalidad antes de modelar tiraría señal, y el PCA no se usa en el pipeline final."
  ]
}

export const EDA_TAKEAWAY = [
  {
    "label": "Qué muestras puede ver el modelo",
    "body": "solo alto rendimiento, a un coste medido del 27 % de la clase cristalina."
  },
  {
    "label": "Qué métrica es de fiar",
    "body": "la exactitud no, porque un modelo que no aprende nada ya saca un 64 %."
  },
  {
    "label": "Cómo partir los datos",
    "body": "agrupados por placa, porque una partición aleatoria dejaría pasar al modelo con solo reconocer el lote."
  },
  {
    "label": "Qué esperar",
    "body": "ninguna variable sola separa las clases, y ningún plano tampoco — así que un modelo lineal no va a brillar, y el techo honesto es modesto."
  }
]

export const ETL_DEFECTS = [
  {
    "n": 1,
    "defect": "Moduladores líquidos puros guardados como µmol pero etiquetados como mmol: un factor de 1.000",
    "found": "La mediana del ácido fórmico marcaba 1.168 \"mmol\", que son 54 g de ácido fórmico en un reactor de 2,5 mL. Físicamente imposible.",
    "fix": "Fórmula corregida en el cuaderno 01; los valores guardados divididos entre 1.000."
  },
  {
    "n": 2,
    "defect": "Sumar mmol con µmol borró el HCl de la característica de ácido fuerte",
    "found": "Consecuencia del defecto 1: el HCl aportaba ~0,004 frente al TFA a ~600.",
    "fix": "Con unidades coherentes, el modulador más usado de todo el conjunto de datos —393 síntesis— vuelve a ser visible para el modelo."
  },
  {
    "n": 3,
    "defect": "El tipo de síntesis no estaba como variable, siendo el mayor factor de confusión",
    "found": "Las ejecuciones por microondas son cristalinas en un 95,7 % frente al 11,0 % del cribado combinatorio.",
    "fix": "Restringir el entrenamiento a la síntesis de alto rendimiento."
  },
  {
    "n": 4,
    "defect": "El 1-propanol y el DEF faltaban en la vista de características",
    "found": "Las fracciones de disolvente sumaban 0,789 en vez de 1.",
    "fix": "Incluidos los seis disolventes."
  },
  {
    "n": 5,
    "defect": "El modulador líquido es a veces el disolvente, y no se contaba como medio",
    "found": "Tras arreglar el defecto 4 el volumen seguía sin cuadrar. Una síntesis usaba 1,35 mL de ácido propiónico de 1,5 mL totales.",
    "fix": "Una fracción de modulador reconstruida a partir de los milimoles."
  },
  {
    "n": 6,
    "defect": "El HF agrupado con el HCl pese a tener un papel químico distinto",
    "found": "Argumento químico: el HF es un agente mineralizante, y algunas redes solo cristalizan en su presencia.",
    "fix": "Su propia columna, 25 síntesis."
  },
  {
    "n": 7,
    "defect": "22 filas perdieron su radio iónico por un espacio de no separación",
    "found": "Un carácter U+00A0 dentro de cadenas de precursor como \"MgCl2 · 6H2O\" impedía que casaran con la tabla de consulta.",
    "fix": "Se normalizó el JOIN, en vez de ir añadiendo variantes tipográficas a mano: esa es una carrera que no se gana."
  }
]

export const ETL_EXCLUSION = {
  "title": "La exclusión como etiqueta, nunca como borrado",
  "body": "Auditar el conjunto de datos destapó 113 entradas problemáticas: 43 barridos duplicados (repeticiones, muestras lavadas) que sesgarían el entrenamiento, y 70 ejecuciones amorfas contaminadas con picos de óxido metálico que envenenarían las etiquetas de clase",
  "decision": "En vez de borrados destructivos, cada caso se marcó con ml_include = NO. En una base de datos científica, borrar destruye la historia experimental; marcar de forma explícita conserva la traza de auditoría y a la vez entrega datos limpios a los modelos.",
  "pullquote": "En un almacén de datos científicos, **borrar destruye evidencia y etiquetar la conserva**."
}

export const ETL_IMPUTATION = {
  "title": "Imputación: probada, no supuesta",
  "body": "Los huecos numéricos se rellenan con la mediana y los categóricos con la moda, siempre dentro del pipeline de validación cruzada, nunca antes.",
  "leak": "Imputar con la mediana del conjunto entero antes de partir filtra información del pliegue de test al entrenamiento: las filas de test habrían ayudado a calcular la mediana que se les aplica. Es una fuga sutil que infla el resultado sin que nada parezca fallar. Dentro del pipeline, cada pliegue calcula su mediana solo con sus propios datos.",
  "tableHead": [
    "Configuration",
    "F1 macro",
    "MCC"
  ],
  "tableRows": [
    [
      "Random Forest, simple imputation",
      "0.496",
      "0.274"
    ],
    [
      "Random Forest, missingness flagged",
      "0.495",
      "0.266"
    ],
    [
      "SVM, simple imputation",
      "0.471",
      "0.275"
    ],
    [
      "SVM, missingness flagged",
      "0.458",
      "0.258"
    ]
  ],
  "conclusion": "Marcar qué valores faltaban no aporta nada, así que se queda la versión simple. Merece la pena dejarlo escrito precisamente por ser un resultado negativo: saber que la ausencia no es informativa significa que los huecos registran accidentes, no un patrón con sentido químico."
}

export const ETL_STOICHIOMETRY = {
  "intro": "Los moduladores llegan al reactor en dos formas físicamente distintas, y cada una necesita su propia aritmética.",
  "typeA": {
    "title": "Tipo A — disoluciones acuosas molares",
    "body": "El HCl, el HF y el KOH se dosifican como disoluciones de molaridad conocida, así que la cantidad activa sale directamente de volumen por concentración.",
    "formula": "mmol = V(mL) × M"
  },
  "typeB": {
    "title": "Tipo B — líquidos orgánicos puros",
    "body": "Los ácidos fórmico, acético, propiónico, trifluoroacético, tríflico y metanosulfónico, más la trietilamina, se pipetean puros. La cantidad hay que reconstruirla a partir de la densidad, la pureza y el peso molecular.",
    "formula": "mmol = V(µL) × ρ(g/mL) × P(%) / (100 × MW)"
  }
}

export const ETL_TANNIC = {
  "title": "Ácido tánico: una decisión química, confirmada después por la medida",
  "body": "24 muestras usaron ácido tánico, un polifenol y la única química no fosfonato del registro. Su denticidad no está bien definida: con unos 25 hidroxilos fenólicos no hay un número con sentido de \"dientes\" de unión. El argumento para quitarlas es químico y va primero: 24 muestras no bastan para que un modelo aprenda una familia química aparte, y su presencia obliga a los descriptores del conector a describir dos cosas incompatibles a la vez.",
  "measure": "Quitarlas sube el F1 macro de 0,495 a 0,527, y el MCC de 0,266 a 0,312.",
  "caution": "Elegir qué quitar porque mejora la métrica es una forma de hacer trampa: el número siempre se puede subir descartando los casos difíciles. Aquí el orden fue el correcto —**primero el argumento químico, después la verificación**— y eso es lo que hace legítima la exclusión. Si el criterio hubiera sido \"probemos a quitar cosas y a ver qué sube\", el resultado no valdría nada."
}

export const ETL_THERMAL = {
  "title": "Parsear rampas térmicas escritas en prosa",
  "body": "La hoja de cálculo registraba los programas térmicos como texto libre. Se parsean en temperatura inicial, objetivo y final, horas de meseta, y dos pendientes en °C por minuto.",
  "formulas": [
    "heating rate = (T_target − T_initial) / (t_heating × 60)",
    "cooling rate = (T_target − T_final) / (t_cooling × 60)"
  ]
}

export const ETL_ZERO_VS_NULL = {
  "title": "La corrección que importó más que los siete defectos",
  "body": "Allí donde el desglose de disolventes no daba cuenta del volumen total —alrededor del 18 % de las filas— las fracciones se estaban guardando como 0. Ahora son NULL, con una bandera explícita de completitud.",
  "pullquote": "Escribir un 0 donde el valor es desconocido no es neutral: afirma algo falso. \"Esta síntesis no contenía metanol\" y \"nunca se registró cuánto metanol contenía\" son afirmaciones distintas, y un modelo al que le dan un 0 no tiene forma de distinguirlas."
}

export const MODEL_ASSESSMENT = {
  "title": "Una lectura honesta del rendimiento",
  "lead": "El modelo completo duplica aproximadamente la línea base trivial y alcanza una correlación de Matthews de 0,31, una asociación real pero moderada. Dos rasgos del resultado importan más que ese titular.",
  "points": [
    {
      "title": "Tres cuartas partes de las síntesis cristalinas no se recuperan",
      "bullets": [
        "La exhaustividad sobre la clase cristalina es de **0,25** bajo la validación cruzada agrupada. Esa es la cifra que hay que citar: la herramienta existe para preseleccionar condiciones prometedoras, así que gobierna el valor práctico mucho más que el agregado.",
        "La matriz de confusión de arriba marca **0,53** para esa misma clase, porque es una única partición reservada y no la media de los cinco pliegues. Un conjunto afortunado de placas favorece a la clase más pequeña.",
        "Causa: **167 ejemplos cristalinos frente a 967 incipientes**, y la clase cristalina es la más heterogénea. Hay muchas formas de que una red cristalice y solo una de que no lo haga."
      ]
    },
    {
      "title": "El modelo accionable está cerca del límite de los datos",
      "bullets": [
        "Sin la química del metal y del conector, el F1 macro cae a **0,393** y el MCC a **0,095**.",
        "Por encima del azar, y todavía no una base para recomendar condiciones.",
        "Esta es la pregunta que de verdad se hace el laboratorio, así que es el más importante de los dos resultados."
      ]
    }
  ],
  "cause": {
    "title": "El límite está en el registro experimental, no en el modelo",
    "body": "A lo largo de cinco años el registro contiene 15 temperaturas objetivo distintas y 11 tiempos de reacción, y el subconjunto con el que se entrenó el modelo es aún más pobre: **9 temperaturas y 3 tiempos de reacción**. Además se variaron de forma confundida con la química: cada campaña barría un factor dentro de un sistema metal-conector. Un modelo supervisado no puede estimar el efecto de una variable que se mantuvo casi constante, ni separar un efecto de un factor con el que siempre apareció junto. Es una propiedad de los datos, y ninguna elección de algoritmo o de hiperparámetro recupera información que los experimentos no generaron.",
    "expectation": "Es razonable esperar que optimizar los hiperparámetros sobre este conjunto dé una mejora de 0,02 a 0,05 en F1 macro. Merece la pena hacerlo por completitud metodológica; no es una vía hacia un modelo sustancialmente mejor."
  },
  "next": {
    "title": "Qué lo mejoraría, por orden de retorno esperado",
    "items": [
      {
        "icon": "sweep",
        "head": "Un barrido diseñado",
        "cost": "1–2 plates",
        "body": "Variar temperatura, tiempo y modulador con finura **dentro de un único sistema metal-conector**. Ataca el factor de confusión de frente y cuesta una o dos placas: con diferencia, la intervención más eficiente disponible."
      },
      {
        "icon": "minority",
        "head": "Más ejemplos cristalinos",
        "cost": "bench time",
        "body": "Con **167** en el conjunto de entrenamiento, la clase minoritaria es la restricción que limita todas las métricas de arriba. Nada algorítmico la esquiva."
      },
      {
        "icon": "record",
        "head": "Terminar el registro de disolvente",
        "cost": "no experiments",
        "body": "El **18 %** de las filas no tiene el desglose, y ese bloque puntúa hoy como ruido. Su aportación real ni siquiera se puede medir hasta que el medio esté escrito por completo."
      },
      {
        "icon": "target",
        "head": "Replantear el objetivo",
        "cost": "later",
        "body": "Un índice de cristalinidad continuo puede llevar más información que una clase de tres niveles, aunque las tres clases siguen siendo el juicio que la poyata registró de verdad."
      }
    ]
  },
  "closing": "La puntuación es defendible: validada cruzadamente con las placas como grupos, calculada después de corregir siete defectos de datos, y publicada junto a la línea base que le da sentido. La limitación es de diseño experimental y no del modelo, lo que la convierte en un experimento concreto y accionable."
}

export const MODEL_CHEMISTRY = {
  "title": "La lectura química, por bloque y no variable a variable",
  "why": "Con variables muy correlacionadas, cualquier método de importancia reparte el mérito de forma arbitraria. Interpretar la electronegatividad de Pauling aislada de la dureza absoluta sería leer de más. El reparto por bloques es la lectura defendible.",
  "blocks": [
    {
      "name": "Metal chemistry",
      "rank": "Dominante, con diferencia",
      "body": "Entra por el radio iónico y la relación carga-radio, que juntos dan la **densidad de carga** del catión. Esa densidad de carga gobierna la fuerza de la interacción metal-fosfonato y, con ella, si el sistema tiene tiempo de ordenarse o precipita amorfo."
    },
    {
      "name": "Process conditions",
      "rank": "Segundo, por delante de la química del conector",
      "body": "Esto matiza la lectura fácil de los números principales. Las condiciones sí contribuyen, pero solo en combinación con la química: el modelo accionable, que las usa solas, se atasca en 0,41. La temperatura y el tiempo ayudan a decidir dentro de un sistema metal-conector, no entre sistemas. Las dos afirmaciones son ciertas y hay que leerlas juntas."
    },
    {
      "name": "Stoichiometry and reaction medium",
      "rank": "Importancia negativa en conjunto",
      "body": "No es un error de cálculo: barajar esas variables mejora ligeramente el modelo, que es la definición operativa de ruido. Tiene una causa identificable —el 18 % de filas sin desglose de disolvente— y una consecuencia práctica: son candidatas a quitarse la próxima vez, y su valor real no se sabrá hasta que el medio se registre por completo."
    }
  ],
  "caution": "La importancia por permutación tiende a repartir y a subestimar cuando las variables están correlacionadas: si dos columnas dicen casi lo mismo, barajar una apenas perjudica al modelo porque la otra cubre el hueco. Así que los valores absolutos no deben leerse como \"porcentaje de la química explicada\", y el reparto por bloques es más fiable que cualquier variable individual.",
  "distinction": "\"No importa\" y \"no se exploró\" son afirmaciones distintas, y solo la segunda es accionable. El modelo no dice que la temperatura sea irrelevante para la cristalización de fosfonatos; dice que en este registro **no se varió lo suficiente como para poder aprenderse**. La instrucción que se sigue es experimental: variarla."
}

export const MODEL_ERRORS = {
  "title": "Dónde se equivoca, y si los errores tienen sentido químico",
  "intro": "Una matriz de confusión enseña la dirección de los errores, no solo cuántos hay. Aquí el patrón ordinal se cumple con claridad en un sentido y solo a medias en el otro.",
  "tableHead": [
    "True class",
    "→ neighbouring class (incipient)",
    "→ opposite extreme"
  ],
  "tableRows": [
    [
      "Amorphous",
      "44.6%",
      "5.9% to crystalline"
    ],
    [
      "Crystalline",
      "28.1%",
      "21.9% to amorphous"
    ]
  ],
  "amorphous": "En las muestras amorfas el comportamiento es el que uno esperaría: cuando falla, confunde \"nada\" con \"casi nada\", que en el propio difractograma es una cuestión de grado y algo en lo que dos expertos podrían discrepar. El error grave —llamar cristalina a una muestra amorfa— es raro.",
  "crystalline": "En las cristalinas, no. Aproximadamente una de cada seis se clasifica como amorfa, el error más grave posible. El modelo no reconoce bien la clase minoritaria y, cuando la pierde, la pierde del todo. Con 167 casos frente a 967 incipientes, y siendo la más heterogénea de las tres (muchas formas de cristalizar, una sola de no hacerlo), era previsible. Sigue siendo la principal debilidad del modelo.",
  "usage": "Para el uso previsto, ordenar candidatos y llenar la siguiente placa, lo que importa es que los buenos candidatos suban en el ranking más que el que la etiqueta sea exacta. Pero el modelo comete un error grave en el **22 % de las muestras cristalinas**, y esa cifra hay que darla junto al agregado.",
  "asHopedBadge": "Como se esperaba",
  "mainWeaknessBadge": "La principal debilidad",
  "confusionFigureAlt": "Matriz de confusión del modelo Random Forest sobre placas reservadas, como recuentos y normalizada por fila",
  "confusionFigureCaption": "A la izquierda, recuentos brutos; a la derecha, normalizado por clase real para que cada fila se lea como sensibilidad (recall). La diagonal es donde el modelo acierta —y la fila cristalino es donde es más débil."
}

export const MODEL_FINDINGS = [
  {
    "title": "Hay señal predictiva real, y es modesta",
    "body": "El mejor modelo completo llega a un F1 macro de unos 0,52 frente a 0,26 de la línea base, el doble de bueno. El MCC se queda cerca de 0,31: una asociación real, pero lejos de ser fuerte."
  },
  {
    "title": "Excluir las síntesis confundidas cuesta 0,10 de F1 macro",
    "body": "Quitar las ejecuciones por microondas y las solvotermales estándar baja la puntuación de 0,62 a 0,52. Esa diferencia **mide la parte de la puntuación que venía de identificar el método de síntesis** y no la química."
  },
  {
    "title": "El modelo accionable cae más, y eso responde a la objeción",
    "body": "Sin la química del metal y del conector, el mejor modelo cae a 0,393 con un MCC cercano a 0,095: por encima del azar, pero débil. La mayor parte de lo que el modelo distingue en este registro es qué sistema metal-conector se usó, no qué condiciones se aplicaron.",
    "caveat": "Eso no hace que las condiciones sean químicamente irrelevantes. En este registro no se variaron lo suficiente como para poder aprenderse: **9 temperaturas y 3 tiempos de reacción** en todo el conjunto de entrenamiento."
  },
  {
    "title": "Ganan los modelos basados en árboles",
    "body": "Random Forest y LightGBM quedan por delante de k vecinos más cercanos y de SVM. Los métodos que construyen fronteras a partir de umbrales se benefician de variables que significan lo que dicen, que es justo lo que aportaron las correcciones de unidades de la etapa anterior."
  },
  {
    "title": "Naive Bayes se hunde por debajo de la línea base",
    "body": "Supone que las variables son independientes dada la clase, y el mapa de correlación enseña bloques marcados. Su fracaso mide cuánto importa esa correlación, que es por lo que está en la lista."
  }
]

export const MODEL_FRAMING = "La variable objetivo es el mismo veredicto de tres clases que ya usaba la poyata al triar una placa de 24 pocillos: amorfo, incipiente, o una fase cristalina bien ordenada. Plantearlo como clasificación y no como regresión es una decisión que no se puede reparar después: no existe un \"grado de cristalinidad\" continuo que las etiquetas humanas registraran de verdad, e inventar uno significaría puntuar al modelo contra una cantidad que nadie midió."

export const MODEL_HERO_LEAD = "Se entrenan diez familias de modelos sobre las mismas 1.516 síntesis y se comparan bajo un único esquema de validación, agrupado por placa. La cifra principal es **0,52 de F1 macro** frente a 0,26 de un modelo que siempre responde la clase mayoritaria."

export const MODEL_LINEUP = {
  "intro": "Se comparan diez modelos, no uno. Distintas familias de modelos suponen cosas distintas sobre la forma de la frontera entre clases, y ante un problema nuevo no hay manera de saber de antemano qué suposición es la acertada.",
  "tableHead": [
    "Model",
    "What it assumes",
    "Why it is here"
  ],
  "comparisonFigureAlt": "Comparación de los diez modelos por F1 macro y MCC, solo síntesis de alto rendimiento",
  "comparisonFigureCaption": "Los diez comparados bajo la misma validación cruzada agrupada. La línea base es el listón que todo lo demás tiene que superar —y Naive Bayes no lo supera.",
  "models": [
    {
      "name": "Línea base (clase mayoritaria)",
      "assumes": "Nada: siempre la clase más frecuente",
      "why": "El listón. Todo lo demás tiene que superarlo",
      "detail": "No mira ni una sola variable. Cuenta qué clase es la más común en los datos de entrenamiento y responde esa, siempre. Con estos datos dice INCIPIENTE a todo y acierta el 64 % de las veces. Por eso la exactitud es un titular inútil aquí, y por eso este modelo está en la lista: para darle un suelo a todos los demás números.",
      "code": "DummyClassifier(strategy='most_frequent')"
    },
    {
      "name": "Regresión logística",
      "assumes": "Una frontera lineal",
      "why": "Referencia interpretable; si basta, gana",
      "detail": "Traza una superficie divisoria recta por el espacio de 39 dimensiones y lee el peso de cada variable como su tirón hacia una clase u otra. Si bastara con una recta, esta sería la respuesta a conservar: se pueden leer los coeficientes y discutir la química. Está aquí para averiguar si el problema necesita algo más complicado.",
      "code": "LogisticRegression(max_iter=2000, class_weight='balanced')"
    },
    {
      "name": "k vecinos más cercanos",
      "assumes": "Las muestras parecidas comparten resultado",
      "why": "Puramente local, sin modelo global",
      "detail": "No construye ningún modelo. Ante una síntesis nueva busca las quince más parecidas que ya hay en el registro y hace una votación. Eso lo convierte en una prueba directa de una intuición química —que condiciones parecidas dan productos parecidos— y es implacable con las variables mal escaladas, que es parte de lo que lo hizo útil para detectar los defectos de unidades.",
      "code": "KNeighborsClassifier(n_neighbors=15)"
    },
    {
      "name": "Naive Bayes",
      "assumes": "Variables independientes dada la clase",
      "why": "Su fracaso mide cuánto importa la estructura de correlación",
      "detail": "Supone que cada variable contribuye de forma independiente, lo que con estos datos es sencillamente falso: la electronegatividad y la dureza de un catión están atadas por la física. Está en la lista precisamente para que esa suposición falle a la vista. Puntúa por debajo de la línea base trivial, y esa diferencia es una medida de cuánto importa la estructura de correlación.",
      "code": "GaussianNB()"
    },
    {
      "name": "SVM (núcleo RBF)",
      "assumes": "Una frontera no lineal suave",
      "why": "Fuerte en dimensión media con pocas muestras",
      "detail": "Curva la frontera en vez de mantenerla recta, y solo le importan las muestras más cercanas al límite. Eso lo hace fuerte cuando hay muchas variables y pocas filas, que es exactamente este problema. El precio es que sus decisiones no se pueden leer como \"esta variable importó\".",
      "code": "SVC(kernel='rbf', probability=True, class_weight='balanced')"
    },
    {
      "name": "Árbol de decisión",
      "assumes": "Cortes por umbral, de uno en uno",
      "why": "Interpretable; la base de lo que viene después",
      "detail": "Hace una cadena de preguntas de sí o no sobre umbrales sueltos —¿está la temperatura por encima de 130?, ¿hay modulador carboxílico?— hasta llegar a un veredicto. Por sí solo sobreajusta mucho, pero es el ladrillo de los cuatro modelos que tiene debajo, y el único cuyo razonamiento se puede leer en voz alta.",
      "code": "DecisionTreeClassifier(max_depth=6, class_weight='balanced')"
    },
    {
      "name": "Random Forest",
      "assumes": "Muchos árboles descorrelacionados",
      "why": "Robusto, insensible a los hiperparámetros",
      "detail": "Hace crecer cientos de árboles, cada uno sobre una porción aleatoria de las filas y de las columnas, y los promedia. La aleatoriedad es la clave: los árboles individuales sobreajustan en direcciones distintas y los errores se cancelan. Es el modelo que está desplegado aquí, elegido por ser el que mejor rinde y a la vez el más difícil de estropear ajustándolo mal.",
      "code": "RandomForestClassifier(n_estimators=500, class_weight='balanced_subsample', random_state=42)"
    },
    {
      "name": "HistGradientBoosting",
      "assumes": "Árboles secuenciales que se corrigen entre sí",
      "why": "Maneja los valores ausentes de forma nativa",
      "detail": "En vez de promediar árboles independientes, cada árbol nuevo se ajusta a los errores que dejaron los anteriores. Primero agrupa las variables en intervalos, lo que lo hace rápido, y acepta valores ausentes sin imputarlos, algo relevante aquí, donde un pKa nulo significa \"sin ácido carboxílico\" y no \"desconocido\".",
      "code": "HistGradientBoostingClassifier(max_iter=300, random_state=42)"
    },
    {
      "name": "LightGBM",
      "assumes": "Optimised boosting",
      "why": "La referencia del sector",
      "detail": "La misma idea que el anterior con otra estrategia de crecimiento: extiende la hoja que más reduce el error, en vez de crecer nivel a nivel. Rápido y normalmente en lo alto de los benchmarks tabulares, que es por lo que sirve de vara de medir. Es el modelo que sirve la mitad accionable de este proyecto.",
      "code": "LGBMClassifier(n_estimators=400, class_weight='balanced', random_state=42)"
    },
    {
      "name": "XGBoost",
      "assumes": "Boosting con regularización",
      "why": "Standard comparison",
      "detail": "Boosting otra vez, con una penalización explícita a la complejidad de los árboles escrita en lo que optimiza. Ese freno de más es lo que suele separarlo de LightGBM en conjuntos pequeños, y con 1.516 filas este cuenta como pequeño.",
      "code": "XGBClassifier(n_estimators=400, max_depth=5, random_state=42)"
    }
  ]
}

export const MODEL_METRICS = {
  "tableHead": [
    "Metric",
    "What it measures",
    "Why it is here"
  ],
  "tableRows": [
    [
      "F1 macro",
      "The mean F1 of each class, weighting all three equally",
      "The headline metric. Ignoring the 167 crystalline samples sinks it"
    ],
    [
      "Balanced accuracy",
      "Mean accuracy within each class",
      "Directly interpretable: \"it gets X% of the crystalline ones right\""
    ],
    [
      "MCC",
      "Correlation between prediction and truth, −1 to +1",
      "The most demanding: 0 means chance, however high the accuracy"
    ],
    [
      "Accuracy",
      "Percentage correct",
      "Present only as a warning: the trivial baseline already scores ~64%"
    ]
  ],
  "note": "El error relativo medio, el RMSE y el R² no aplican aquí. Pertenecen a la regresión y miden distancia a un número. En clasificación, o aciertas la clase o no."
}

export const MODEL_SCORECARD_INTRO = "Primero las cifras. Cada número de abajo está validado cruzadamente con las placas como grupos, y se muestra junto a la línea base trivial: sin esa referencia, un F1 de 0,52 podría significar cualquier cosa."

export const MODEL_SHAP = {
  "title": "Cómo leer el gráfico SHAP",
  "body": "Cada punto es una síntesis. Su posición horizontal es cuánto empujó esa variable la predicción hacia cristalino (derecha) o en contra (izquierda). El color es el valor de la variable: rojo alto, azul bajo. Así que \"rojo a la derecha\" significa que los valores altos de esa variable favorecen la cristalización.",
  "note": "Complementa a la importancia por permutación: aquella dice cuánto importa una variable, esta dice en qué dirección y para qué muestras.",
  "permutationFigureAlt": "Importancia por permutación de las variables, coloreada por bloque químico",
  "permutationFigureCaption": "Importancia por permutación, coloreada por bloque químico. La química del metal domina; el bloque de estequiometría y medio sale negativo, que es la definición operativa de ruido.",
  "shapFigureAlt": "Gráfico resumen SHAP mostrando la dirección en que cada variable empuja la predicción",
  "shapFigureCaption": "Valores SHAP: la posición horizontal es cuánto empujó una variable la predicción hacia cristalino, el color es el valor de la propia variable."
}

export const MODEL_TAKEAWAY = {
  "body": "Hay señal predictiva real en cinco años de registros de laboratorio, y es modesta: aproximadamente el doble de la línea base trivial. La mayor parte de lo que distingue el modelo es qué sistema metal-conector se usó, no qué condiciones se aplicaron. El registro varió esas condiciones a lo largo de solo 9 temperaturas y 3 tiempos de reacción, demasiado poco para que su efecto se pueda aprender.",
  "close": "Eso es un resultado negativo, y se convierte directamente en una instrucción experimental: la próxima campaña debería barrer temperatura y tiempo con mucha más amplitud de lo que hicieron los últimos cinco años."
}

export const MODEL_TWO = {
  "title": "Dos modelos, no uno",
  "objection": "El conector no hace que un metal cristalice; determina qué material puede existir siquiera. Cambiarlo cambia la química, no una condición de reacción.",
  "body": "Así que las variables se parten en dos: **variables de diseño** (la química del metal y del conector), que cambian el propio objetivo de la investigación, y **variables de proceso** (concentración, relación ligando-metal, temperatura, tiempo, rampas, moduladores, disolventes), que se pueden cambiar dentro de la misma química. Se entrena un modelo con cada mitad.",
  "models": [
    {
      "name": "Full model",
      "inputs": "All 39 variables",
      "asks": "¿Hay algo de señal predictiva en este registro?",
      "pro": "La mejor puntuación de los dos: **0,52 de F1 macro**, el doble que la línea base.",
      "limit": "La mayor parte de esa señal es el sistema metal-conector, así que no te dice qué cambiar."
    },
    {
      "name": "Actionable model",
      "inputs": "Process variables only",
      "asks": "Dada esta química, ¿qué condiciones la hacen cristalizar?",
      "pro": "La pregunta que de verdad se hace en la poyata, y la que diseña la siguiente placa.",
      "limit": "Cae a **0,393 de F1 macro**, con MCC de 0,095: por encima del azar, todavía no una base para recomendar condiciones."
    }
  ],
  "note": "La diferencia entre las dos puntuaciones mide cuánta de la señal viene de la química y no de las condiciones."
}

export const MODEL_VALIDATION = {
  "title": "Validación agrupada por placa",
  "setupPoints": [
    "**Una placa son 24 pocillos**: un bloque, una estufa, un programa térmico, 24 composiciones barridas en paralelo.",
    "El conjunto de entrenamiento son **1.516 síntesis repartidas en 68 placas**.",
    "Así que una placa es un lote que compartió reactor, día, bote de disolvente y operador, no una etiqueta administrativa."
  ],
  "bodyPoints": [
    "**k-fold agrupado y estratificado, cinco pliegues.** Cada placa se queda entera dentro de un pliegue, así que ninguna está nunca a la vez en entrenamiento y en test.",
    "**Sin eso**, un modelo puede puntuar bien reconociendo de qué placa viene una muestra en vez de aprender nada de química.",
    "**La estratificación** mantiene parejas las proporciones de clase, así que ningún pliegue acaba casi sin muestras cristalinas."
  ],
  "consequence": "Cuesta rendimiento. Una partición aleatoria daría un número más alto para un modelo que había aprendido menos."
}

export const MODEL_WEIGHTS_NOTE = "Todos los modelos que lo permiten llevan pesos de clase equilibrados, que compensan el desequilibrio de 6:1 penalizando más los errores en las clases minoritarias."
