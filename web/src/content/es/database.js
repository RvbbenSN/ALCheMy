/* GENERADO por scripts/generar_contenido_es.mjs. No editar a mano:
   se sobrescribe. Para corregir una frase, cambiarla en scripts/textos_es.json
   y volver a ejecutar el script. Lo que no este traducido sale en ingles. */

export const DB_BOUNDARY = {
  "title": "What the AI agent is allowed to touch",
  "body": "The RAG assistant **never writes SQL**. Every one of its tools is a call to a stored function with typed parameters, so what it can ask is fixed by the schema rather than by how carefully a prompt was worded. `agent_verify_owner()` decides whether the answer carries exact values or coarse ones: it receives a token, hands on a **boolean**, and stores neither.",
  "bracketTitle": "What those functions can read"
}

export const DB_HERO = {
  "lead": "Five years of chemistry lived in one spreadsheet, a folder of instrument files, and a stack of handwritten notebooks. This is what it became: a single governed schema where every column has a documented meaning and every automated action leaves a trace."
}

export const DB_VIEWS = {
  "title": "The views everything reads through",
  "lead": "Nothing queries a raw table if a view exists for it. A view decides a join once, instead of having it re-invented in every script, and it can be documented, versioned and pointed at."
}

export const DB_WHY = {
  "title": "Why a database, and not a very good spreadsheet",
  "cards": [
    {
      "icon": "meaning",
      "head": "Columns that know what they mean",
      "body": "A header reading `T` could be temperature, time or a code. **Every column carries a native `COMMENT`** with its units and allowed values, and pgAdmin, this site and the AI agent read the same one."
    },
    {
      "icon": "rules",
      "head": "Rules that cannot be forgotten",
      "body": "A measurement cannot exist without its synthesis (foreign key). A model cannot be registered as irreproducible without a written reason (`CHECK`). **The database enforces this**, not the scripts that write to it."
    },
    {
      "icon": "lanes",
      "head": "Two writers at once",
      "body": "A notebook ingests the master Excel file; a workflow ingests instrument files. The notebook loads by `UPSERT` and never `DELETE`, so it **cannot erase what the workflow wrote overnight**."
    },
    {
      "icon": "memory",
      "head": "A memory of what happened",
      "body": "Every automated action lands in `audit_log` with a typed verdict and cause; every agent exchange in `agent_chat_log`. Both are **written by code, never by an LLM**, so the system being recorded cannot edit its own record."
    },
    {
      "icon": "dictionary",
      "head": "Documentation that is itself data",
      "body": "The schema documents itself in a **table**: `data_dictionary` holds one row per column, so the site and the agent read it instead of carrying a copy. Coverage is checkable, and the target is 100 % because a gap makes **\"undocumented column\" and \"column that does not exist\" indistinguishable**."
    }
  ]
}
