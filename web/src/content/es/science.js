/* GENERADO por scripts/generar_contenido_es.mjs. No editar a mano:
   se sobrescribe. Para corregir una frase, cambiarla en scripts/textos_es.json
   y volver a ejecutar el script. Lo que no este traducido sale en ingles. */

export const BOTTLENECK = {
  "title": "Donde empieza el problema de los datos",
  "scale": "Dos placas por semana, 24 condiciones cada una, durante cinco años. El diagrama de arriba es lo que eso produce: **2.167 síntesis**, **6.073 ficheros de instrumento**, repartidos entre carpetas, cuadernos y discos locales.",
  "problem": "Nada de eso es raro, es como trabaja la mayoría de los laboratorios. Pero significa que una pregunta sencilla — *¿qué condiciones han producido alguna vez un material prometedor?* — solo se responde tan bien como recuerde alguien dónde se guardaron las cosas.",
  "turn": "La solución es una **base de datos gobernada**: una fila por síntesis, una fila por medida, cada fichero con su huella y su autoría. Una vez que el registro es una tabla, la pregunta de arriba se convierte en una consulta, y un modelo puede aprender de todo el registro.",
  "hookTitle": "Lo que deja un problema sin resolver",
  "hook": "Miles de ficheros de instrumento, varios formatos... y nada que impida guardar el mismo fichero dos veces con dos nombres. Lo que hace falta es concreto: **una forma de dejar caer un fichero en algún sitio y que acabe en la base de datos, correctamente atribuido, sin que nadie teclee nada.**"
}

export const DATA_SCALE = {
  "title": "Cuántos datos produce un solo laboratorio",
  "lead": "A la izquierda, todas las síntesis realizadas. En el medio, todas las medidas tomadas sobre esas muestras, por técnica. A la derecha, el único sitio donde tiene que acabar todo. **Un auténtico reto de escala.**",
  "bracketLabel": "measurements",
  "databaseLabel": "Una base de datos gobernada",
  "databaseNote": "Una fila por síntesis, una fila por medida, cada fichero con su huella.",
  "footnote": "Recuentos de medidas leídos de la base el 3 de septiembre de 2026; ICP y AE, en trazo discontinuo, siguen siendo informes PDF a la espera de la rama de IA, así que ese círculo cuenta ficheros y no filas. El tamaño del círculo escala con el recuento para que las técnicas pequeñas sigan siendo legibles: lee los números, no las áreas."
}

export const LAB_INTRO = {
  "title": "Cómo es de verdad una semana de poyata",
  "lead": "Una estructura se puede diseñar sobre el papel, pero su **síntesis hay que descubrirla**. La receta ideal se encuentra cribando incontables ensayos de reacción. El pipeline es así:"
}

export const MOF_DEF = {
  "acronym": "MOF",
  "expansion": "Metal-Organic Framework",
  "iupac": "Una red de coordinación con ligandos orgánicos que contiene huecos potenciales.",
  "iupacNote": "Recomendación de la IUPAC, 2013.",
  "plain": "En pocas palabras, **los iones o clústeres metálicos** hacen de nudos, **las moléculas orgánicas** hacen de vigas, y juntos levantan un andamio rígido.",
  "why": "Como las dos partes se pueden intercambiar por separado, la **misma arquitectura se puede reconstruir** con otro metal o con otro conector. Eso es lo que hace tan grande a la familia: son la clase más diversa de sólidos cristalinos extendidos que se conoce hoy."
}

export const MOF_FACTS = [
  {
    "icon": "grid",
    "title": "Construidos como un andamio",
    "body": "**Nudos metálicos unidos por conectores orgánicos** en una red periódica. Tratarlos como redes abstractas, de nudos y aristas, es lo que permite diseñar una estructura"
  },
  {
    "icon": "expand",
    "title": "Superficies sin precedente",
    "body": "Un solo gramo puede presentar la **superficie de un campo de fútbol**. Eso es lo que los hace útiles para almacenar gases, capturar CO₂ o alojar centros catalíticos."
  },
  {
    "icon": "sliders",
    "title": "Ajustables por diseño",
    "body": "Cambia el conector y el poro cambia de tamaño, forma y química mientras la topología sobrevive. Es el **principio isorreticular**."
  },
  {
    "icon": "flask",
    "title": "Aplicados a problemas reales",
    "body": "**Un abanico amplio de aplicaciones prometedoras**. Producción de hidrógeno verde, remediación de aguas, conversión de CO₂ en carbonatos cíclicos y catálisis de polimerización, entre otras."
  }
]

export const MOF_NAMING = {
  "title": "Una nota sobre los nombres",
  "body": "Las redes suelen llevar el nombre de la institución que las publicó primero: MIL-n del Materials Institute Lavoisier, UiO-n de la Universidad de Oslo, HKUST-n de Hong Kong. IEF-n es la serie del Instituto IMDEA Energía, donde se hicieron las síntesis que hay detrás de esta plataforma."
}

export const NOBEL = {
  "year": "2025",
  "title": "Premio Nobel de Química",
  "laureates": "Susumu Kitagawa, Richard Robson y Omar Yaghi",
  "reason": "Por sentar las bases de las redes metal-orgánicas y de la química reticular.",
  "credit": "© Nobel Prize Outreach. Ilustración: Niklas Elmehed."
}

export const SCIENCE_INTRO = "¿Alguna vez te has preguntado qué pasa cuando construyes materiales cristalinos como si fueran *Lego* molecular? Asómate a la química de las redes metal-orgánicas (MOF) y descubre por qué caracterizarlas exige toda una batería de técnicas analíticas."

export const SYNTHESIS_NODE = {
  "label": "Syntheses",
  "icon": "flask",
  "count": 2167,
  "note": "Dos placas de 24 pocillos por semana, cinco años."
}

export const TECHNIQUES = [
  {
    "abbr": "PXRD",
    "icon": "waves",
    "name": "Powder X-ray diffraction",
    "answers": "¿Es cristalino, y es la fase que yo quería?",
    "body": "Los rayos X dispersados por una red ordenada producen picos afilados a ángulos concretos. Un sólido desordenado produce en su lugar una joroba ancha. Es la primera prueba que pasa cualquier muestra nueva, y la que modela esta plataforma.",
    "primary": true
  },
  {
    "abbr": "TGA",
    "icon": "flame",
    "name": "Thermogravimetric analysis",
    "answers": "¿Cuánto disolvente hay atrapado dentro, y cuánto calor aguanta?",
    "body": "Se calienta la muestra mientras se pesa. Las pérdidas de masa revelan las moléculas huésped saliendo de los poros y, al final, la propia red descomponiéndose."
  },
  {
    "abbr": "VT-XRD",
    "icon": "thermometer",
    "name": "Variable-temperature XRD",
    "answers": "¿Sobrevive la estructura al calentamiento?",
    "body": "Difracción medida mientras sube la temperatura, que muestra si la red aguanta, se transforma o colapsa."
  },
  {
    "abbr": "BET",
    "icon": "wind",
    "name": "Gas physisorption",
    "answers": "¿Cuánto espacio vacío es accesible de verdad?",
    "body": "Se dosifica nitrógeno o CO₂ sobre el material y la cantidad adsorbida se convierte en superficie específica en metros cuadrados por gramo, más la distribución de tamaño de poro."
  },
  {
    "abbr": "FTIR",
    "icon": "audio",
    "name": "Infrared spectroscopy",
    "answers": "¿Se ha unido el conector al metal de verdad?",
    "body": "Los enlaces químicos absorben luz infrarroja a frecuencias características. Los desplazamientos de esas bandas distinguen un ligando coordinado del material de partida libre y sin reaccionar."
  },
  {
    "abbr": "ICP-OES",
    "icon": "sparkles",
    "name": "Inductively coupled plasma",
    "answers": "¿Cuánto metal hay ahí dentro?",
    "body": "La muestra se vaporiza en un plasma y la luz que emite cuantifica cada elemento, lo que da la proporción real entre metal y ligando."
  },
  {
    "abbr": "EA",
    "icon": "atom",
    "name": "Elemental analysis",
    "answers": "¿Coincide la composición orgánica con la fórmula?",
    "body": "El análisis por combustión devuelve los porcentajes de carbono, hidrógeno, nitrógeno y azufre, que se comparan con la fórmula propuesta."
  },
  {
    "abbr": "SEM / TEM",
    "icon": "microscope",
    "name": "Electron microscopy",
    "answers": "¿Qué aspecto tienen las partículas?",
    "body": "Los haces de electrones toman imagen de la morfología y el tamaño de los cristales, desde la forma de una cara hasta la escala nanométrica."
  },
  {
    "abbr": "UV-Vis",
    "icon": "sun",
    "name": "Diffuse reflectance spectroscopy",
    "answers": "¿Puede absorber luz, y a qué energía?",
    "body": "La absorción óptica da el band gap, que decide si un material puede impulsar una reacción fotocatalítica."
  }
]

export const TECHNIQUE_COUNTS = [
  {
    "key": "pxrd",
    "label": "PXRD",
    "icon": "waves",
    "count": 1879,
    "note": "Rutinaria en todo"
  },
  {
    "key": "sem",
    "label": "SEM",
    "icon": "microscope",
    "count": 1659,
    "note": "Crystal habit"
  },
  {
    "key": "fesem",
    "label": "FESEM",
    "icon": "aperture",
    "count": 132,
    "note": "Finer morphology"
  },
  {
    "key": "ftir",
    "label": "FTIR",
    "icon": "audio",
    "count": 77,
    "note": "¿Se unió el conector?"
  },
  {
    "key": "ads",
    "label": "Adsorption",
    "icon": "wind",
    "count": 68,
    "note": "Accessible porosity"
  },
  {
    "key": "uv",
    "label": "UV-Vis",
    "icon": "sun",
    "count": 44,
    "note": "Band gap óptico"
  },
  {
    "key": "tga",
    "label": "TGA",
    "icon": "flame",
    "count": 31,
    "note": "Thermal stability"
  },
  {
    "key": "vtxrd",
    "label": "VT-XRD",
    "icon": "thermometer",
    "count": 26,
    "note": "Estructura durante el calentamiento"
  },
  {
    "key": "scxrd",
    "label": "SC-XRD",
    "icon": "gem",
    "count": 10,
    "note": "Estructura resuelta por completo"
  },
  {
    "key": "icpea",
    "label": "ICP · EA",
    "icon": "droplet",
    "count": 28,
    "note": "Composición, en PDF",
    "pending": true
  }
]

export const WHY_CHARACTERISE = {
  "title": "Por qué un solo material necesita una docena de medidas",
  "lead": "Fabricar un sólido no es lo mismo que saber qué es. **A un polvo recién formado hay que interrogarlo** desde varios ángulos antes de poder afirmar nada sobre él.",
  "consequence": "Cada muestra prometedora genera ficheros de varios instrumentos, cada uno escrito en su propio formato. Multiplica eso por miles de muestras y deja de ser un problema de química: pasa a ser un **reto de gestión y procesado de datos**.",
  "numbers": [
    [
      "6,073",
      "ficheros de instrumento en crudo"
    ],
    [
      "3,926",
      "measurements ingested"
    ],
    [
      "9",
      "analytical techniques"
    ]
  ]
}
