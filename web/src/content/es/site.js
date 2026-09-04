/* GENERADO por scripts/generar_contenido_es.mjs. No editar a mano:
   se sobrescribe. Para corregir una frase, cambiarla en scripts/textos_es.json
   y volver a ejecutar el script. Lo que no este traducido sale en ingles. */

export const BIO_ABOUT = [
  "Mi foco profesional está en la intersección entre la química experimental, la ciencia de datos y la inteligencia artificial: convertir datos científicos complejos en pipelines reproducibles, modelos predictivos y herramientas de apoyo a la decisión.",
  "Como doctor en Química Avanzada dirigí el desarrollo completo de redes metal-orgánicas para retos de sostenibilidad: producción de hidrógeno verde, valorización de CO₂, tratamiento de aguas, biopolímeros. Ese trabajo significaba generar, procesar y analizar grandes conjuntos de datos de una docena de técnicas de caracterización, y es donde se hizo evidente el problema que resuelve esta plataforma.",
  "ALCheMy es esa misma mentalidad analítica llevada al terreno digital: Python, SQL, aprendizaje automático e IA generativa aplicados a la misma química, con el objetivo de acelerar el diseño de materiales y sacar decisiones de datos que antes se quedaban en una carpeta."
]

export const BIO_PULLQUOTE = "ALCheMy es en sí mismo una prueba viva de eso: la programación en pareja con agentes fue decisiva para diseñar, escribir y construir el ecosistema entero desde cero."

export const BIO_SHORT = [
  "¡Hola! Soy Rubén, doctor en Química Avanzada reconvertido a la ciencia de datos y la IA.",
  "Durante más de cinco años trabajé en el laboratorio sintetizando materiales funcionales nuevos para retos de sostenibilidad. En esas miles de horas de poyata me di cuenta de algo esencial: los experimentos generan cantidades enormes de datos ricos, y demasiadas veces se quedan atrapados en cuadernos de laboratorio o en discos locales.",
  "De ahí salió una idea concreta: cerrar la distancia entre la química experimental de banco y el ciclo de vida del dato. Me dedico a convertir observaciones de laboratorio en pipelines automatizados y modelos de aprendizaje automático que sostienen decisiones científicas más rápidas y mejor fundadas.",
  "Con la irrupción reciente de la IA generativa, creo firmemente que la inteligencia artificial no está aquí para sustituirnos, sino para **aumentar el potencial humano**. Para mí ha sido un acelerador cognitivo, que aplana la curva de aprendizaje en disciplinas vecinas: ingeniería de software, MLOps, ciencia de datos. No convierte a nadie en veterano de un día para otro; lo que da es el andamiaje para entender y conectar dominios técnicos de verdad, a una velocidad que antes no existía."
]

export const FUNNEL = [
  {
    "n": "2,152",
    "label": "Filas en la tabla de características",
    "why": "Todas las síntesis que el pipeline pudo convertir en características"
  },
  {
    "n": "1,839",
    "label": "Con difractograma etiquetado",
    "why": "El resto nunca llegó al difractómetro, o nadie las ha juzgado todavía"
  },
  {
    "n": "1,723",
    "label": "Verdict usable",
    "why": "Quita SIN_MUESTRA y todo lo que un experto marcó ml_include = NO"
  },
  {
    "n": "1,540",
    "label": "Combinatorial only",
    "why": "Excluidas las solvotermales y las de microondas: el factor de confusión de arriba"
  },
  {
    "n": "1,516",
    "label": "Filas del conjunto de entrenamiento",
    "why": "Sin ácido tánico"
  }
]

export const GLOSSARY = {
  "MOF": {
    "long": "Metal-Organic Framework",
    "text": "Un sólido híbrido construido con iones o clústeres metálicos unidos por conectores orgánicos, que forman una red extendida acribillada de poros. Como se pueden intercambiar las dos mitades, su química es ajustable por diseño."
  },
  "PXRD": {
    "long": "Difracción de rayos X de polvo",
    "text": "Ilumina un polvo con rayos X y registra cómo se dispersan. Los picos afilados indican un cristal ordenado y periódico; una joroba ancha indica un sólido desordenado y amorfo."
  },
  "arPLS": {
    "long": "Mínimos cuadrados penalizados con repesado asimétrico",
    "text": "Un método que separa el fondo lento y a la deriva de un espectro de los picos reales, sin aplanar el halo amorfo ancho, que sí lleva información legítima."
  },
  "MD5": {
    "long": "Message Digest 5",
    "text": "Una huella corta calculada a partir de los bytes de un fichero. Dos ficheros idénticos dan siempre la misma huella, así que detecta una subida duplicada antes de gastar cómputo en ella."
  },
  "JSONB": {
    "long": "JSON binario (PostgreSQL)",
    "text": "Un tipo de columna que guarda un documento anidado entero y aun así permite consultar dentro. Deja que nueve formatos de instrumento distintos compartan una tabla sin una migración de esquema cada vez."
  },
  "SSOT": {
    "long": "Fuente única de verdad",
    "text": "Un único sitio con autoridad donde vive un dato. Todo lo demás lo lee de ahí en vez de guardar su propia copia, que puede desviarse en silencio."
  },
  "MLOps": {
    "long": "Operaciones de aprendizaje automático",
    "text": "La práctica de tratar un modelo como software de producción: versionado, probado, trazable hasta los datos y el código exactos que lo produjeron, y reproducible meses después."
  },
  "F1 macro": {
    "long": "F1 promediado por macro",
    "text": "Promedia por igual el F1 de cada clase, así que una clase rara cuenta tanto como una común. Con datos desequilibrados es mucho más honesto que la exactitud a secas."
  },
  "pgvector": {
    "long": "pgvector",
    "text": "Una extensión de PostgreSQL que guarda embeddings y encuentra los más cercanos, de modo que la búsqueda semántica ocurre dentro de la misma base de datos que el resto."
  },
  "RAG": {
    "long": "Retrieval-Augmented Generation",
    "text": "Antes de responder, el sistema recupera los pasajes más relevantes de un corpus real y se los da al modelo, así que la respuesta se apoya en fuentes en vez de salir de la memoria."
  },
  "HITL": {
    "long": "Human-in-the-Loop",
    "text": "Cuando un paso automático no tiene confianza suficiente, se detiene y pregunta a una persona en vez de adivinar. Aquí se dispara con extracciones de PDF de baja confianza."
  },
  "BET": {
    "long": "Brunauer-Emmett-Teller",
    "text": "La forma estándar de convertir una isoterma de adsorción de gas en superficie específica en metros cuadrados por gramo: el número que dice cómo de poroso es un material de verdad."
  },
  "CRISP-DM": {
    "long": "Proceso estándar intersectorial para minería de datos",
    "text": "Un método de seis fases para proyectos de datos, desde entender el problema hasta el despliegue y la retroalimentación. Las pestañas de esta web lo siguen en orden."
  }
}

export const KPIS = [
  {
    "value": "2,167",
    "label": "Syntheses performed",
    "note": "Cinco años de poyata"
  },
  {
    "value": "1,877",
    "label": "Difractogramas etiquetados a mano",
    "note": "La verdad de referencia con la que aprende el modelo"
  },
  {
    "value": "2×",
    "label": "Mejor que el azar prediciendo cristalinidad",
    "note": "F1 macro de 0,52 frente a una línea base de 0,26"
  },
  {
    "value": "87,765",
    "label": "Pasajes de literatura vectorizados",
    "note": "956 artículos, que alimentan el asistente RAG"
  }
]

export const LAB_CYCLE = [
  {
    "step": "1",
    "title": "Planificación de la síntesis de alto rendimiento",
    "short": "Planificar la placa",
    "body": "Cada campaña empieza diseñando una matriz de parámetros sobre reactores multiautoclave de teflón de 24 pocillos: 48 pesadas individuales por tanda, mezclas de disolventes y moduladores, y luego programas térmicos de 24 a 72 horas en estufas de convección."
  },
  {
    "step": "2",
    "title": "Recuperación y triaje experimental",
    "short": "Filtrar y triar",
    "body": "Tras enfriar, cada uno de los 24 viales se filtra a vacío, se lava y se manda a difracción de rayos X de polvo. El veredicto es uno de tres: sólido amorfo, incipiente (reflexiones anchas cerca de la frontera de cristalización) o una fase cristalina bien ordenada.",
    "highlight": "Esas tres clases son exactamente el objetivo que aprende a predecir el modelo."
  },
  {
    "step": "3",
    "title": "Escalado y batería analítica",
    "short": "Scale up",
    "body": "Los aciertos prometedores se escalan en camisas solvotermales o por síntesis asistida por microondas, y luego se caracterizan por TGA, VT-XRD, análisis elemental, ICP-OES, reflectancia difusa UV-Vis, FTIR y fisisorción de N2/CO2."
  },
  {
    "step": "4",
    "title": "Functional Application",
    "short": "Apply it",
    "body": "Los materiales purificados se ensayan en producción fotocatalítica de hidrógeno, degradación de contaminantes emergentes y valorización heterogénea de CO2."
  }
]

export const MODEL_NOTES = {
  "crystallinity_v4_hts_full": "El modelo de referencia: ¿hay señal predictiva en estos datos? Primera versión con las unidades de volumen corregidas.",
  "crystallinity_v4_hts_actionable": "Solo proceso y medio. Responde a la pregunta que de verdad se hace en la poyata: dada esta química, ¿qué condiciones ayudan?",
  "crystallinity_v3_hts_full": "Mismo diseño, pero entrenado antes de encontrar el defecto en las unidades de volumen. Superado, no equivocado por haber existido.",
  "crystallinity_v3_hts_actionable": "El modelo accionable de la generación anterior, conservado para comparar.",
  "crystallinity_v2_mixed": "La puntuación más alta de esta tabla, y la razón de que la tabla exista. Mezclaba síntesis HTS, ST y de microondas, así que en parte estaba detectando el método de síntesis. Marcado como inválido en vez de borrado."
}

export const PILLARS = [
  {
    "key": "ingestion",
    "title": "Ingesta automatizada, calidad del dato y gobernanza",
    "subtitle": "Conforme a ISO 17025 y a los principios FAIR",
    "points": [
      "**Pipelines de ingesta orquestados** con n8n y PostgreSQL capturan los ficheros analíticos en crudo (PXRD, TGA, adsorción de gases, FTIR, VT-XRD, AE, ICP-OES) por webhooks REST seguros o por formulario.",
      "**Barreras criptográficas de calidad**: cada fichero pasa por una comprobación MD5 que impide registros duplicados y garantiza la trazabilidad del fichero original.",
      "**Los parsers de instrumento** escriben metadatos y curvas 2D en contenedores JSONB indexados, así que añadir una técnica nueva nunca exige migrar el esquema.",
      "**La observabilidad de los agentes** deja registrada cada interacción con la IA"
    ]
  },
  {
    "key": "ml",
    "title": "Gemelo digital y aprendizaje automático",
    "subtitle": "Del difractograma en crudo a una recomendación de síntesis",
    "points": [
      "**Los patrones de difracción de polvo en crudo** se tratan con arPLS para aislar la deriva de la línea base sin aplastar el halo amorfo real. Un modelo de ruido de Poisson a 3 sigma extrae un vector de 29 descriptores.",
      "**Clasificadores supervisados** (Random Forest y LightGBM) entrenados sobre 1.877 difractogramas etiquetados a mano predicen si una matriz de reacción da una fase cristalina pura, una fase incipiente o un sólido amorfo.",
      "**Un registro de modelos en PostgreSQL controla las versiones** (binarios, hiperparámetros, hashes de commit y métricas de validación cruzada).",
      "**Un bucle de aprendizaje activo** localiza las fronteras de síntesis donde el modelo duda y propone los siguientes experimentos."
    ]
  },
  {
    "key": "rag",
    "title": "RAG híbrido aumentado con grafo",
    "subtitle": "Un copiloto que cita tres fuentes de verdad",
    "points": [
      "**Un corpus vectorizado sobre pgvector** indexa 956 artículos revisados por pares y patentes.",
      "**El troceado contextual** evita perder el sentido químico entre procedimientos de síntesis, estequiometrías y secciones de caracterización.",
      "**Un grafo de conocimiento** relaciona las síntesis realizadas, su caracterización y las citas de la literatura.",
      "**Recuperación local primero**, con control de acceso por rol, que mantiene gobernados los registros propios y permite un despliegue enteramente local."
    ]
  }
]

export const PILLARS_INTRO = "La plataforma está construida en tres capas: la primera mete los datos y los mantiene fiables; la segunda aprende de ellos; la tercera pone lo que el campo ya sabe junto a lo que el laboratorio ha medido."

export const SCREENS = [
  {
    "id": "00",
    "slug": "",
    "short": "Overview",
    "title": "Overview",
    "crisp": "Business understanding"
  },
  {
    "id": "01",
    "slug": "science",
    "short": "The Science",
    "title": "Los MOF y el día a día del laboratorio",
    "crisp": "Data requirements"
  },
  {
    "id": "02",
    "slug": "data-collection",
    "short": "Data Collection",
    "title": "El flujo de ingesta",
    "crisp": "Data collection"
  },
  {
    "id": "03",
    "slug": "data-preparation",
    "short": "Data Preparation",
    "title": "ETL & PXRD Signal Processing",
    "crisp": "Data preparation"
  },
  {
    "id": "04",
    "slug": "data-understanding",
    "short": "Data Understanding",
    "title": "Exploratory data analysis",
    "crisp": "Data Understanding"
  },
  {
    "id": "05",
    "slug": "modeling",
    "short": "Modeling",
    "title": "Training & Evaluation",
    "crisp": "Modeling · Evaluation"
  },
  {
    "id": "06",
    "slug": "the-model",
    "short": "The Model",
    "title": "Simulator, Registry & Active Learning",
    "crisp": "Deployment · Feedback"
  },
  {
    "id": "07",
    "slug": "rag",
    "short": "RAG Assistant",
    "title": "Scientific Co-pilot",
    "crisp": "Decision support"
  },
  {
    "id": "08",
    "slug": "database",
    "short": "The Database",
    "title": "ALCheMy Database",
    "crisp": "Data governance"
  },
  {
    "id": "09",
    "slug": "about",
    "short": "About",
    "title": "Biografía, CV y contacto",
    "crisp": "About the author"
  }
]

export const SITE = {
  "name": "ALCheMy",
  "tagline": "Laboratorio Aumentado para Química y Materiales",
  "repo": "https://github.com/RvbbenSN/ALCheMy",
  "github": "https://github.com/RvbbenSN",
  "linkedin": "https://www.linkedin.com/in/rubén-serrano-nieto",
  "orcid": "https://orcid.org/0000-0002-7785-0615",
  "email": "rubbenserrano@gmail.com",
  "cv": "/ruben-serrano-nieto-resume.pdf"
}

export const STACK = [
  [
    "Python",
    "SQL",
    "Jupyter",
    "PostgreSQL",
    "pgAdmin",
    "n8n",
    "Docker"
  ],
  [
    "Pandas",
    "NumPy",
    "SciPy",
    "Matplotlib",
    "Seaborn",
    "Scikit-Learn",
    "Streamlit",
    "React"
  ],
  [
    "VS Code",
    "Antigravity",
    "Claude Code",
    "Gemini",
    "Ollama",
    "Cloudflare",
    "Slack"
  ]
]

export const WORKFLOW_SECTIONS = [
  {
    "n": 1,
    "title": "Entrada — tres vías de ingesta",
    "adds": "technique, sample_code, identidad del investigador, el fichero binario"
  },
  {
    "n": 2,
    "title": "Etiquetas, sample_code y lista blanca",
    "adds": "Campos normalizados, barrera de autorización"
  },
  {
    "n": 3,
    "title": "Quality gate",
    "adds": "file_ext, carga en base64, el file_hash MD5 real"
  },
  {
    "n": 4,
    "title": "Enrutado por técnica",
    "adds": "Nada: solo decide el camino que sigue"
  },
  {
    "n": 5,
    "title": "Parsers deterministas (7 técnicas)",
    "adds": "La carga completa de data_json, nivel de autonomía L4"
  },
  {
    "n": 6,
    "title": "Extracción por IA — informes PDF (ICP / AE)",
    "adds": "Composición elemental, confianza, persona en el bucle"
  },
  {
    "n": 7,
    "title": "Extracción por IA — microscopía",
    "adds": "Solo morfología cualitativa, nunca un tamaño de partícula inventado"
  },
  {
    "n": 8,
    "title": "DB write & response",
    "adds": "The row itself, plus the reply to the caller"
  },
  {
    "n": 9,
    "title": "Governance — fallbacks, audit & errors",
    "adds": "audit_log with typed verdict, cause and result"
  }
]
