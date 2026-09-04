/* GENERADO por scripts/generar_contenido_es.mjs. No editar a mano:
   se sobrescribe. Para corregir una frase, cambiarla en scripts/textos_es.json
   y volver a ejecutar el script. Lo que no este traducido sale en ingles. */

export const COLLECTION_CANVAS_INTRO = "El flujo tal cual es: **79 nodos**, **114 conexiones**, nueve áreas. Elige una parada y el mapa vuela hasta ella, con la ficha de debajo explicando qué añade esa área a la fila y por qué."

export const COLLECTION_HERO = {
  "lead": "¿Cómo se procesan miles de ficheros de instrumento en crudo sin ingerir caos? Recorre el pipeline automatizado que toma huella, valida y enruta las medidas en tiempo real."
}

export const COLLECTION_PROBLEM = {
  "body1": "Miles de ficheros de instrumento en nueve formatos, ninguno enlazado con su síntesis. Procesar **6.073 ficheros en crudo** a mano significaría teclear sin fin y errores humanos inevitables.",
  "body2": "En su lugar, se encarga el workflow. Los ficheros que entran se autentican, se les toma huella contra duplicados y se enrutan por técnica: los parsers deterministas se ocupan de los datos tabulares, mientras agentes de IA especializados extraen informes PDF sin estructura e imágenes de microscopía, **registrando cada paso en una traza de auditoría**.",
  "builtWith": "Construido en **n8n**, una herramienta de automatización de flujos: cada caja del lienzo de abajo es un nodo real de una instancia en marcha.",
  "seeOnGithub": "Ver el workflow en GitHub",
  "guaranteesTitle": "Qué garantiza el workflow",
  "guarantees": [
    {
      "icon": "link",
      "lead": "Atribución",
      "body": "Cada medida queda enlazada con la síntesis de la que salió, por código de muestra, y con la persona que la envió."
    },
    {
      "icon": "fingerprint",
      "lead": "Sin duplicados",
      "body": "Una huella criptográfica del contenido del fichero rechaza una segunda copia antes de parsearla."
    },
    {
      "icon": "shapes",
      "lead": "Forma uniforme",
      "body": "Nueve formatos se convierten en una única forma de fila, así que una consulta puede abarcar varias técnicas sin saber nada de instrumentos."
    },
    {
      "icon": "scroll",
      "lead": "Un registro de cada decisión",
      "body": "Aceptado o rechazado, con el motivo, en una tabla de auditoría escrita por código y nunca por un modelo de lenguaje."
    }
  ]
}

export const COLLECTION_ROW_INTRO = "Todo camino por este workflow tiene que llegar a la escritura en la base llevando exactamente estos campos. Piensa en el elemento como una bola de nieve que rueda por el pipeline y va recogiendo más de esta forma en cada etapa. Si al llegar todavía falta un campo, la inserción falla en seco contra una restricción."

export const COLLECTION_SCHEMA_NOTE = {
  "before": "Todo camino por este workflow tiene que llegar a la escritura en la base llevando exactamente estos campos, y cada decisión automática que toma acaba en `audit_log` con un veredicto y una causa tipados.",
  "linkText": "La pantalla 08 despieza el esquema",
  "after": "— las tablas, qué guarda cada una, y cómo se alimentan entre sí."
}

export const COLLECTION_TREE = {
  "title": "Un ejemplo de fichero ingerido",
  "lead": "Un `.xrdml` real después de pasar por el workflow.",
  "point": "El contexto experimental. Guarda los parámetros instrumentales parseados automáticamente de la cabecera del fichero, como la longitud de onda de la radiación, la configuración óptica y las marcas de tiempo de la adquisición. Garantiza reproducibilidad sin anotar nada a mano.",
  "contract": "La curva. Guarda la señal medida como arrays de coordenadas (X, Y) normalizadas junto con sus unidades físicas (por ejemplo, 2theta frente a intensidad). Todas las técnicas comparten esta misma estructura, así que cualquier curva se puede representar al instante."
}

export const ROW_SHAPE = [
  [
    "sample_code",
    "Clave foránea hacia synthesis_experiments"
  ],
  [
    "technique",
    "PXRD / VT-XRD / TGA / FTIR / ADSORPTION / UV_VIS / SEM / ICP_OES / EA"
  ],
  [
    "researcher_email, researcher_name, operator_name",
    "Responsabilidad, comprobada contra una lista blanca"
  ],
  [
    "measurement_tag, instrument_name",
    "Procedencia de la medida"
  ],
  [
    "file_name, raw_file_path",
    "Dónde viven los bytes originales"
  ],
  [
    "file_hash",
    "MD5 real de los bytes del fichero"
  ],
  [
    "data_json",
    "{ header_metadata, raw_data } — el contrato del parser"
  ]
]
