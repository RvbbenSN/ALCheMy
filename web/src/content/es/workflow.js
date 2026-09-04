/* GENERADO por scripts/generar_contenido_es.mjs. No editar a mano:
   se sobrescribe. Para corregir una frase, cambiarla en scripts/textos_es.json
   y volver a ejecutar el script. Lo que no este traducido sale en ingles. */

export const AREAS = [
  {
    "n": 1,
    "title": "Entry",
    "subtitle": "Tres vías de ingesta",
    "objective": "Aceptar un fichero más sus metadatos básicos venga de donde venga la ejecución, y normalizarlo a una forma común antes de que nada aguas abajo tenga que preocuparse de por qué vía entró.",
    "adds": [
      "technique, sample_code, researcher_email, researcher_name, operator_name, measurement_tag — en crudo, tal como se enviaron",
      "file_name y raw_file_path (solo en la vía del vigilante de carpeta; las otras los rellenan cuando el fichero se escribe en disco)",
      "El propio binario, que siempre acaba bajo $binary.data_file"
    ],
    "note": "El nodo Webhook en crudo renombra la subida a data_file0: n8n añade un sufijo numérico a las subidas multipart. Normalize Webhook Body lo copia de vuelta para que nada aguas abajo tenga que saberlo.",
    "nodes": [
      {
        "name": "Manual trigger",
        "kind": "trigger"
      },
      {
        "name": "Local Folder Watcher",
        "kind": "trigger"
      },
      {
        "name": "Lab Upload Portal (form)",
        "kind": "trigger"
      },
      {
        "name": "Webhook POST /ingest",
        "kind": "trigger"
      },
      {
        "name": "Extract Technique from Path",
        "kind": "transform"
      },
      {
        "name": "Sanitize Input",
        "kind": "transform"
      },
      {
        "name": "Normalize Webhook Body",
        "kind": "transform"
      }
    ]
  },
  {
    "n": 2,
    "title": "Etiquetas, código de muestra y lista blanca",
    "subtitle": "Normalizar, luego autorizar",
    "objective": "Hacer que todos los campos tengan el mismo aspecto venga de la vía que venga, rechazar cualquier cosa sin código de muestra (es la clave de búsqueda en la base) y filtrar por la autorización del investigador.",
    "adds": [
      "technique normalizada (UV-Vis → UV_VIS, ICP-OES → ICP_OES)",
      "sample_code extraído del nombre de fichero por expresión regular cuando no se envía explícitamente",
      "researcher_email en minúsculas y sin espacios sobrantes",
      "instrument_name recibe una estimación según la técnica, que luego sobrescribe el valor real parseado"
    ],
    "note": "El auto-registro da de alta un correo nuevo como activo, pero a propósito no reactiva uno que un administrador revocó a mano.",
    "nodes": [
      {
        "name": "Homogenize Tags — All Entries",
        "kind": "transform"
      },
      {
        "name": "Homogenize Tags — Instrument Lookup",
        "kind": "transform"
      },
      {
        "name": "If — Has Sample Code?",
        "kind": "gate"
      },
      {
        "name": "Auto-Enroll Whitelist",
        "kind": "db"
      },
      {
        "name": "Merge — Restore After Whitelist",
        "kind": "transform"
      },
      {
        "name": "If — Is Email Active?",
        "kind": "gate"
      }
    ]
  },
  {
    "n": 3,
    "title": "Quality gate",
    "subtitle": "Rechazar antes de gastar cómputo",
    "objective": "Rechazar los ficheros demasiado grandes o duplicados antes de parsear nada, y dejar los bytes reales en una forma que el sandbox de Python pueda leer de verdad.",
    "adds": [
      "file_ext, is_archive",
      "data_file_base64 — el runner nativo de Python no puede leer $binary cuando los binarios se guardan en modo sistema de ficheros",
      "file_hash — el MD5 real de los bytes decodificados"
    ],
    "note": "Esa última línea fue un fallo de verdad: el hash se calculaba sobre el marcador de metadatos del binario y no sobre el contenido del fichero, así que todos los ficheros parecían únicos y la deduplicación no hacía nada, en silencio.",
    "nodes": [
      {
        "name": "Check File Size",
        "kind": "gate"
      },
      {
        "name": "Detect File Extension",
        "kind": "transform"
      },
      {
        "name": "Convert Binary to Base64",
        "kind": "transform"
      },
      {
        "name": "If — Has Metadata File?",
        "kind": "gate"
      },
      {
        "name": "Calculate MD5 File Hash",
        "kind": "hash"
      },
      {
        "name": "Check Duplicates",
        "kind": "db"
      },
      {
        "name": "If — Is New Measurement?",
        "kind": "gate"
      }
    ]
  },
  {
    "n": 4,
    "title": "Enrutado por técnica",
    "subtitle": "Tres estrategias de extracción",
    "objective": "Decidir cuál de las tres estrategias de extracción corresponde: un parser determinista, IA sobre un PDF, o rechazo por técnica no reconocida.",
    "adds": [
      "Nada nuevo: esta área solo lee el campo technique que fijó el área 2."
    ],
    "tableIntro": "Todos los parsers, tanto en Python como en JavaScript, devuelven la misma forma de diccionario, y `data_json` siempre contiene `header_metadata` y `raw_data`. Se guarda como **JSONB** con un índice GIN, así que un agente puede consultar cualquier técnica de manera uniforme.",
    "table": {
      "head": [
        "Format",
        "Instrument",
        "Comments"
      ],
      "rows": [
        [
          "`.xrdml`",
          "PANalytical PXRD",
          "Only counts are stored; the 2θ axis is reconstructed by linspace from start and end angles."
        ],
        [
          "`.brml`",
          "Bruker VT-XRD",
          "A ZIP container. More than two RawData*.xml entries means a temperature series, not a single scan."
        ],
        [
          "`.txt`",
          "TA SDT Q600 TGA",
          "UTF-16 with a latin1 fallback, seven signals."
        ],
        [
          "`.csv`",
          "FTIR",
          "Comma or semicolon separated, tolerant of decimal commas."
        ],
        [
          "`.xls`",
          "Micromeritics BET",
          "Adsorption isotherm and surface area."
        ],
        [
          "`.asc` / `.csv`",
          "UV-Vis",
          "Kubelka-Munk and Tauc vectors derived at parse time."
        ],
        [
          "`.jpg` + `.txt`",
          "Hitachi SEM",
          "Image plus companion sidecar; the AI description is added later, never fabricated."
        ]
      ]
    },
    "nodes": [
      {
        "name": "Technique Router",
        "kind": "router"
      },
      {
        "name": "Deterministic Parser Router",
        "kind": "router"
      },
      {
        "name": "If — Valid PDF Extension?",
        "kind": "gate"
      }
    ]
  },
  {
    "n": 5,
    "title": "Deterministic parsers",
    "subtitle": "Siete técnicas, cero IA · autonomía L4",
    "objective": "Para cada técnica con un formato de fichero bien conocido, extraer todos los valores reales registrados por el instrumento sin intervención ninguna de IA: el camino más barato, más rápido y más fiable.",
    "adds": [
      "Los valores reales parseados sobrescriben las estimaciones previas: sample_code, technique, measurement_tag, operator_name, instrument_name, rutas de fichero",
      "La carga completa de data_json: header_metadata más raw_data"
    ],
    "note": "Un módulo de Python independiente por técnica y extensión, cada uno verificado contra ficheros reales del data lake dentro del contenedor del runner.",
    "nodes": [
      {
        "name": "Parse PXRD (.xrdml)",
        "kind": "parser"
      },
      {
        "name": "Parse VT-XRD (.brml)",
        "kind": "parser"
      },
      {
        "name": "Parse TGA (.txt)",
        "kind": "parser"
      },
      {
        "name": "Parse FTIR (.csv)",
        "kind": "parser"
      },
      {
        "name": "Parse Adsorption (.xls)",
        "kind": "parser"
      },
      {
        "name": "Parse UV-Vis (.asc)",
        "kind": "parser"
      },
      {
        "name": "Parse Microscopy (.jpg)",
        "kind": "parser"
      }
    ]
  },
  {
    "n": 6,
    "title": "Extracción por IA — informes PDF",
    "subtitle": "ICP-OES y análisis elemental",
    "objective": "Extraer tablas de composición elemental de informes que solo existen como PDF, con una red de seguridad con persona en el bucle para cuando el modelo no tiene confianza.",
    "adds": [
      "elemental_ratios para ICP; chns_averages y triplicate_runs para AE",
      "confianza y razonamiento",
      "Restaurados después: la salida del agente no lleva la identidad del investigador, las rutas de fichero ni el hash, así que se recuperan de antes de que corriera el agente"
    ],
    "note": "Por debajo del 85 % de confianza la ejecución se detiene y escribe a una persona en vez de adivinar. Una pregunta sin responder es mejor que un número equivocado con aplomo en una tabla gobernada.",
    "nodes": [
      {
        "name": "AI Agent — PDF Parser",
        "kind": "ai"
      },
      {
        "name": "Restore Fields — PDF Agent",
        "kind": "transform"
      },
      {
        "name": "Confidence Evaluator",
        "kind": "gate"
      },
      {
        "name": "Send message and wait",
        "kind": "human"
      },
      {
        "name": "If — Email Answer yes?",
        "kind": "gate"
      }
    ]
  },
  {
    "n": 7,
    "title": "Extracción por IA — microscopía",
    "subtitle": "SEM / FESEM / TEM",
    "objective": "El parser determinista ya sacó todos los valores reales del instrumento del fichero acompañante. El paso de IA solo añade una descripción cualitativa de la morfología y la transcripción literal de la leyenda de la barra de escala, si la hay.",
    "adds": [
      "data_json.raw_data.ai_vision_analysis, fundido con la carga determinista, nunca en su lugar"
    ],
    "note": "Nunca un tamaño de partícula numérico inventado, y es deliberado. El agente de visión describe qué aspecto tiene la imagen; no mide.",
    "nodes": [
      {
        "name": "Convert B64 to Binary",
        "kind": "transform"
      },
      {
        "name": "AI Agent — Image Analizer",
        "kind": "ai"
      },
      {
        "name": "Merge AI Analysis",
        "kind": "transform"
      }
    ]
  },
  {
    "n": 8,
    "title": "Escritura en la base y respuesta",
    "subtitle": "Donde un campo ausente pasa a ser un fallo en seco",
    "objective": "Insertar la fila terminada y decirle a quien llamó qué ha pasado. Es el punto donde un campo que sigue faltando deja de ser un hueco y pasa a ser una violación de restricción.",
    "adds": [
      "La propia fila, más la respuesta a quien disparó la ejecución"
    ],
    "nodes": [
      {
        "name": "DB Update",
        "kind": "db"
      },
      {
        "name": "If — Came from Webhook?",
        "kind": "gate"
      },
      {
        "name": "Send Success (HTTP 200)",
        "kind": "reply"
      },
      {
        "name": "Send an Email",
        "kind": "reply"
      }
    ]
  },
  {
    "n": 9,
    "title": "Governance",
    "subtitle": "Fallbacks, traza de auditoría y respuesta de error",
    "objective": "Todo rechazo desde cualquier punto del pipeline aterriza aquí. Siempre escribe en el log de auditoría con veredicto, causa y resultado tipados, y luego responde según el origen.",
    "adds": [
      "Fila en audit_log — escrita de forma determinista, nunca por un LLM"
    ],
    "note": "Esto era antes un subflujo aparte al que se llamaba once veces. Se consolidó en dos nodos compartidos, porque una respuesta de webhook no se puede enviar desde fuera del flujo que posee el disparador, y porque compartir nodos es mejor que duplicarlos.",
    "nodes": [
      {
        "name": "Set Error Payload",
        "kind": "error"
      },
      {
        "name": "Write audit_log",
        "kind": "db"
      },
      {
        "name": "Respond HTTP 400",
        "kind": "error"
      },
      {
        "name": "Send Error Email",
        "kind": "reply"
      }
    ]
  }
]

export const TARGET_ROW = [
  "sample_code",
  "technique",
  "researcher_email",
  "researcher_name",
  "operator_name",
  "measurement_tag",
  "instrument_name",
  "file_name",
  "raw_file_path",
  "file_hash",
  "data_json"
]
