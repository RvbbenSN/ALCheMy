/* GENERADO por scripts/generar_contenido_es.mjs. No editar a mano:
   se sobrescribe. Para corregir una frase, cambiarla en scripts/textos_es.json
   y volver a ejecutar el script. Lo que no este traducido sale en ingles. */

export const RAG_AREAS = [
  {
    "n": 1,
    "title": "Corpus",
    "subtitle": "Dos carpetas, dos niveles de acceso",
    "objective": "Leer cada PDF del corpus y sellarlo con una etiqueta de sensibilidad antes de que le pase nada más.",
    "adds": [
      "`sensitivity` - PUBLIC o INTERNAL, según la carpeta en la que estuviera el fichero",
      "`doc_type` - PAPER, SUPPORTING_INFORMATION o LAB_NOTEBOOK",
      "`file_name` y `file_path`, para poder rastrear cualquier pasaje hasta su fuente"
    ],
    "note": "La etiqueta viene de la carpeta, no de un campo que alguien rellena. Una regla estructural no se puede olvidar en un día ajetreado, y esta decide qué puede repetirle el asistente a un desconocido.",
    "nodes": [
      {
        "name": "Run Ingestion",
        "kind": "trigger"
      },
      {
        "name": "Read PUBLIC Corpus",
        "kind": "file"
      },
      {
        "name": "Read INTERNAL Corpus",
        "kind": "file"
      },
      {
        "name": "Label PUBLIC",
        "kind": "transform"
      },
      {
        "name": "Label INTERNAL",
        "kind": "transform"
      }
    ]
  },
  {
    "n": 2,
    "title": "Dedup",
    "subtitle": "La barrera del MD5",
    "objective": "Comparar la suma de comprobación de cada fichero con lo que ya está indexado, y dejar pasar solo lo nuevo.",
    "adds": [
      "El MD5 binario de cada fichero",
      "Un Merge en modo *quedarse con lo que no casa*: lo ya registrado sencillamente no continúa"
    ],
    "note": "Esto es lo que hace idempotente la ingesta. Volver a lanzarla sobre el corpus entero cuesta unos segundos de hashing en vez de reembeber 87.765 pasajes y, más importante, no puede duplicar el corpus en silencio y llenar la recuperación de vecinos casi idénticos.",
    "nodes": [
      {
        "name": "Compute File MD5",
        "kind": "code"
      },
      {
        "name": "Already Indexed Hashes",
        "kind": "db"
      },
      {
        "name": "Discard Already Indexed",
        "kind": "merge"
      }
    ]
  },
  {
    "n": 3,
    "title": "Vectorise",
    "subtitle": "Trocear, embeber, guardar",
    "objective": "Convertir cada documento en pasajes que un modelo pueda recuperar, y escribirlos en pgvector junto a su entrada de catálogo.",
    "adds": [
      "Pasajes de **1.200 caracteres con 250 de solape**: 87.765 en total",
      "Un vector de 1.024 dimensiones cada uno, de `bge-m3` corriendo en local con Ollama",
      "Una fila en `rag_documents` por fichero fuente, y una en `rag_chunks` por pasaje"
    ],
    "note": "El nodo de embeddings se comparte con el lado de la consulta a propósito. Si indexar y buscar usaran modelos distintos, el almacén devolvería tonterías verosímiles sin dar nunca un error. Compartir un solo nodo hace ese desajuste estructuralmente imposible.",
    "nodes": [
      {
        "name": "Split Text (Chunking)",
        "kind": "transform"
      },
      {
        "name": "Document Loader",
        "kind": "file"
      },
      {
        "name": "Embeddings bge-m3 (Local Ollama)",
        "kind": "embed"
      },
      {
        "name": "Insert into pgvector",
        "kind": "vector"
      },
      {
        "name": "Register in rag_documents",
        "kind": "db"
      }
    ]
  },
  {
    "n": 4,
    "title": "Gate",
    "subtitle": "Quién pregunta",
    "objective": "Identificar a quien llama y resolver qué puede ver, antes de que un solo token llegue a un modelo de lenguaje.",
    "adds": [
      "Una identidad de quien llama y un id de sesión, que viajan a todas las llamadas de herramienta aguas abajo",
      "Un veredicto contra `authorized_researchers`",
      "Un rechazo registrado y respondido para quien no lo supere"
    ],
    "note": "Una petición denegada se escribe en el log y recibe respuesta. El fallo silencioso es el enemigo aquí: un asistente que simplemente se para es indistinguible de uno roto.",
    "nodes": [
      {
        "name": "Chat: Ask the Lab",
        "kind": "trigger"
      },
      {
        "name": "Identify Caller",
        "kind": "transform"
      },
      {
        "name": "Authorise Caller",
        "kind": "db"
      },
      {
        "name": "Is Caller Allowed?",
        "kind": "gate"
      },
      {
        "name": "Log Denied Access",
        "kind": "db"
      },
      {
        "name": "Denied Reply",
        "kind": "transform"
      }
    ]
  },
  {
    "n": 5,
    "title": "Agent",
    "subtitle": "Gemini, con un suplente local",
    "objective": "Responder a la pregunta usando las herramientas, y seguir respondiendo cuando el modelo en la nube no está.",
    "adds": [
      "Una memoria de conversación por ventana, compartida por los dos agentes",
      "Un segundo nodo Agent completo conectado a **Qwen3 14B** en Ollama local, colgando de la salida de error del primero",
      "Una fila en `agent_chat_log` por cada intercambio, escrita antes de devolver la respuesta"
    ],
    "note": "El nodo Agent se niega a aceptar dos modelos de lenguaje a la vez (\"Only 1 ai_languageModel sub-nodes are/is allowed to be connected\") y el conmutador de fallback documentado no existe en esta instalación. Así que el fallback se construye a nivel de flujo, y se verificó forzando un fallo real de Gemini en vez de darlo por hecho.",
    "nodes": [
      {
        "name": "Chat Model (Gemini)",
        "kind": "model"
      },
      {
        "name": "Conversation Memory",
        "kind": "memory"
      },
      {
        "name": "Agent - Lab Assistant",
        "kind": "ai"
      },
      {
        "name": "Qwen Chat Model (local)",
        "kind": "model"
      },
      {
        "name": "Agent - Qwen fallback",
        "kind": "ai"
      },
      {
        "name": "Log Exchange",
        "kind": "db"
      },
      {
        "name": "Reply",
        "kind": "transform"
      }
    ]
  },
  {
    "n": 6,
    "title": "Tools",
    "subtitle": "Nueve poderes, uno apagado",
    "objective": "Darle al asistente todo lo que necesita para responder, y nada que necesite inventarse.",
    "adds": [
      "Seis herramientas que leen el laboratorio: síntesis, caracterización, una muestra completa, estadísticas, la bibliografía y el diccionario del esquema",
      "Una búsqueda semántica sobre los 87.765 pasajes",
      "Dos que recorren el grafo de conocimiento: resolver el nodo, y luego explorar hasta tres saltos"
    ],
    "note": "Cada una es una llamada a una función SQL almacenada con parámetros tipados: el asistente nunca escribe SQL. Lo que puede preguntar lo acota la base de datos y no lo bien redactado que esté el prompt. El reordenador de Cohere está conectado y desactivado a propósito: es el único componente que enviaría texto de los pasajes a un tercero.",
    "nodes": [
      {
        "name": "search_synthesis",
        "kind": "tool"
      },
      {
        "name": "get_characterisation",
        "kind": "tool"
      },
      {
        "name": "sample_summary",
        "kind": "tool"
      },
      {
        "name": "statistics",
        "kind": "tool"
      },
      {
        "name": "search_library",
        "kind": "tool"
      },
      {
        "name": "read_data_dictionary",
        "kind": "tool"
      },
      {
        "name": "search_documentation",
        "kind": "vector"
      },
      {
        "name": "find_graph_node",
        "kind": "tool"
      },
      {
        "name": "explore_graph",
        "kind": "tool"
      }
    ]
  }
]

export const RAG_CONTEXTUAL = {
  "title": "Recuperación contextual, y un resultado honesto",
  "problem": "Trocear destruye el contexto. Corta un artículo en pasajes de 1.200 caracteres y una frase como *\"el rendimiento subió al 68 % en estas condiciones\"* pierde de qué compuesto, qué condiciones y qué artículo habla. La recuperación devuelve entonces algo relevante en local y sin sentido en global.",
  "technique": "La solución, publicada por **Anthropic como recuperación contextual**, es que un LLM escriba una frase corta que sitúe cada pasaje dentro de su propio documento, anteponerla y embeber *eso*. Está construida aquí de principio a fin: `rag_chunk_context` guarda **87.765 frases de contexto**, una por pasaje, y `rag_chunks.embedding_v2` guarda el reembebido de pasaje más contexto.",
  "result": "**La ganancia fue modesta.** Comparada en vivo contra los embeddings originales sobre preguntas reales, las similitudes salieron entre 0,005 y 0,01 más altas y solo cambiaron uno o dos de cada cuatro pasajes recuperados. Nada que ver con la mejora que reporta la técnica.",
  "why": "La explicación es el corpus, no el método. Las medidas publicadas vienen de material cuyos fragmentos se apoyan mucho en lo que tienen alrededor. Un artículo de química está escrito en párrafos que ya nombran su propio compuesto y sus propias condiciones, así que había menos contexto que restaurar. **La técnica es buena; este corpus tenía poco margen para que ayudara.**",
  "decision": "Así que `embedding_v2` está construido, poblado y deliberadamente **sin promover** a búsqueda por defecto. Activarlo es una línea. Lo que falta es la medida que lo justificaría: la misma comparación sobre suficientes preguntas como para distinguir una ganancia real del ruido.",
  "caveat": "Hay una cosa concreta entre él y producción: **`embedding_v2` no tiene índice HNSW.** La columna original sí lo tiene; su gemela contextual no, así que una consulta contra ella recorrería los 87.765 vectores. El trabajo está hecho y la fontanería no."
}

export const RAG_HERO = {
  "lead": "Un asistente de laboratorio apoyado en 958 documentos indexados y 87.765 pasajes, conectado a la misma base de datos que describe el resto de esta web, y construido para que no pueda repetirle a un desconocido el nombre de un ligando sin publicar.",
  "sub": "El chat no está abierto en esta web."
}

export const RAG_NUMBERS = [
  {
    "n": "958",
    "label": "Documents indexed",
    "why": "955 artículos, 2 cuadernos de laboratorio digitalizados, 1 información de apoyo"
  },
  {
    "n": "87,765",
    "label": "Passages",
    "why": "1.200 caracteres cada uno con 250 de solape; 1.021 de media"
  },
  {
    "n": "1,024",
    "label": "Dimensiones por vector",
    "why": "`bge-m3`, ejecutado en local, así que ningún pasaje sale nunca de la máquina"
  },
  {
    "n": "6,506",
    "label": "Nodos en el grafo de conocimiento",
    "why": "3.251 medidas, 3.213 muestras, 23 metales, 10 moduladores, 9 ligandos"
  }
]

export const RAG_POWERS = {
  "title": "Qué puede hacer el asistente en realidad",
  "lead": "Nueve herramientas, cada una una función SQL almacenada con parámetros tipados. **El asistente nunca escribe SQL**, así que el límite de lo que puede preguntar lo impone la base de datos y no la redacción de un prompt.",
  "tools": [
    [
      "`search_synthesis`",
      "Busca síntesis por metal, conector, ventana de temperatura o rango de fechas. Todos los filtros son opcionales."
    ],
    [
      "`sample_summary`",
      "El registro completo de una muestra: disolventes, rampa térmica, moduladores, masas."
    ],
    [
      "`get_characterisation`",
      "Qué medidas tiene una muestra, en qué instrumento y por quién; nunca las curvas en sí."
    ],
    [
      "`statistics`",
      "Recuentos agrupados por una de siete dimensiones permitidas. No es agregación libre: es una lista explícita."
    ],
    [
      "`search_library`",
      "Qué documentos existen y cómo citarlos: autores, año, revista, DOI."
    ],
    [
      "`search_documentation`",
      "Búsqueda semántica sobre los 87.765 pasajes. Para conceptos y métodos, nunca para datos numéricos."
    ],
    [
      "`read_data_dictionary`",
      "El esquema, como datos. Lee lo que significa una columna en vez de deducirlo del nombre."
    ],
    [
      "`find_graph_node`",
      "Resuelve texto libre (un código, un ligando, un metal) a un id exacto de nodo del grafo."
    ],
    [
      "`explore_graph`",
      "Recorre hasta tres saltos: qué tienen en común dos muestras, qué comparte ligando con esta."
    ]
  ],
  "boundary": "La separación entre las dos últimas es deliberada. Un asistente que adivina ids de nodo se inventa relaciones; obligarle a resolver el id primero hace que una suposición equivocada **falle a la vista en vez de devolver una respuesta con aplomo sobre una muestra que no existe**."
}

export const RAG_RETRIEVAL = {
  "title": "Tres recuperadores, no uno",
  "lead": "Una búsqueda vectorial sola falla de forma predecible: pídele un código de muestra y devuelve pasajes *sobre* cosas parecidas que no contienen el código. Cada capa de abajo existe porque la anterior se dejaba algo concreto.",
  "layers": [
    {
      "name": "Dense - semantic similarity",
      "state": "live",
      "body": "Distancia coseno sobre los vectores de 1.024 dimensiones de `bge-m3`, con un **índice HNSW** para que una búsqueda no lea las 87.765 filas. Esto es lo que encuentra un concepto descrito con palabras que la pregunta no usó."
    },
    {
      "name": "Sparse - full text",
      "state": "live",
      "body": "Una columna `tsvector` generada, con índice GIN sobre los mismos pasajes. Esto es lo que encuentra la cadena literal de un código de muestra, justo en lo que peor está la búsqueda densa, porque un identificador no lleva semántica a la que parecerse."
    },
    {
      "name": "Fusion - RRF",
      "state": "live",
      "body": "La función `rag_hybrid_search()` fusiona ambos rankings con **Reciprocal Rank Fusion**: un pasaje que va bien en las dos listas supera a uno que domina una sola. Verificado con una pregunta cuyo primer resultado puntuó el doble que el resto, la firma de un pasaje que ganó por los dos lados a la vez."
    },
    {
      "name": "Reranking - Cohere",
      "state": "off",
      "body": "Conectado al nodo del almacén vectorial y **apagado a propósito**. El único reordenador que ofrece n8n es un servicio externo, y usarlo significaría enviar el texto de los pasajes recuperados, cuadernos internos incluidos, a un tercero. Se deja puesto y visiblemente desactivado, porque la decisión forma parte del diseño."
    }
  ]
}

export const RAG_WORKFLOW_INTRO = "Dos flujos comparten un lienzo: la banda de arriba indexa documentos y se lanza a mano cada vez que crece el corpus; la banda de abajo responde a una pregunta y se lanza en cada mensaje. Elige una etapa para volar hasta ella, o toma la última parada para verlo todo junto de una vez."
