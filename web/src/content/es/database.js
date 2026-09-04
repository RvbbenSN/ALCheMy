/* GENERADO por scripts/generar_contenido_es.mjs. No editar a mano:
   se sobrescribe. Para corregir una frase, cambiarla en scripts/textos_es.json
   y volver a ejecutar el script. Lo que no este traducido sale en ingles. */

export const DB_BOUNDARY = {
  "title": "Qué puede tocar el agente de IA",
  "body": "El asistente RAG **nunca escribe SQL**. Cada una de sus herramientas es una llamada a una función almacenada con parámetros tipados, así que lo que puede preguntar lo fija el esquema y no lo cuidadosa que fuera la redacción de un prompt. `agent_verify_owner()` decide si la respuesta lleva valores exactos o aproximados: recibe un token, pasa un **booleano** y no guarda ninguno de los dos.",
  "bracketTitle": "Qué pueden leer esas funciones",
  "agentLabel": "The agent",
  "functionsIntroBefore": "Solo se llega a través de estas",
  "functionsIntroAfter": "stored functions:"
}

export const DB_FAMILIES_INTRO = "Todo arranca en el registro de laboratorio y se abre en abanico desde ahí. Elige un bloque para ver sus tablas, su tamaño y la descripción que lleva cada una dentro de PostgreSQL."

export const DB_HERO = {
  "lead": "Cinco años de química vivían en una hoja de cálculo, una carpeta de ficheros de instrumento y una pila de cuadernos manuscritos. Esto es en lo que se convirtió: un único esquema gobernado donde cada columna tiene un significado documentado y cada acción automática deja rastro."
}

export const DB_VIEWS = {
  "title": "Las vistas por las que se lee todo",
  "lead": "Nada consulta una tabla en crudo si existe una vista para ella. Una vista decide un JOIN una sola vez, en lugar de reinventarlo en cada script, y se puede documentar, versionar y señalar."
}

export const DB_WHY = {
  "title": "Por qué una base de datos, y no una hoja de cálculo muy buena",
  "cards": [
    {
      "icon": "meaning",
      "head": "Columnas que saben lo que significan",
      "body": "Una cabecera que pone `T` puede ser temperatura, tiempo o un código. **Cada columna lleva un `COMMENT` nativo** con sus unidades y sus valores permitidos, y pgAdmin, esta web y el agente de IA leen el mismo."
    },
    {
      "icon": "rules",
      "head": "Reglas que no se pueden olvidar",
      "body": "Una medida no puede existir sin su síntesis (clave foránea). Un modelo no se puede registrar como irreproducible sin un motivo escrito (`CHECK`). **Lo impone la base de datos**, no los scripts que escriben en ella."
    },
    {
      "icon": "lanes",
      "head": "Dos escritores a la vez",
      "body": "Un cuaderno ingiere el Excel maestro; un workflow ingiere los ficheros de instrumento. El cuaderno carga por `UPSERT` y nunca por `DELETE`, así que **no puede borrar lo que el workflow escribió de madrugada**."
    },
    {
      "icon": "memory",
      "head": "Una memoria de lo que pasó",
      "body": "Cada acción automática aterriza en `audit_log` con veredicto y causa tipados; cada intercambio del agente, en `agent_chat_log`. Los dos se **escriben por código, nunca por un LLM**, así que el sistema registrado no puede editar su propio registro."
    },
    {
      "icon": "dictionary",
      "head": "Documentación que es en sí misma un dato",
      "body": "El esquema se documenta a sí mismo en una **tabla**: `data_dictionary` guarda una fila por columna, así que la web y el agente la leen en vez de llevar una copia. La cobertura es comprobable, y el objetivo es el 100 % porque un hueco hace **indistinguibles \"columna sin documentar\" y \"columna que no existe\"**."
    }
  ]
}
