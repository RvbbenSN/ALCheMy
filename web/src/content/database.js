/* --------------------------------------------------------------------------
   database.js - Texto de la pantalla 08, The Database.

   Los NUMEROS no viven aqui. Cuantas tablas, cuantas columnas, cuantas filas y
   que dice cada COMMENT salen de `src/data/schema_map.json`, que genera
   `scripts/build_schema_map.py` leyendo la base. Este fichero es solo prosa:
   si una cifra aparece escrita a mano en este archivo, es un error.

   Los campos largos se pintan con `<Rich>`: **negrita** y `codigo`.
   -------------------------------------------------------------------------- */

export const DB_HERO = {
  lead:
    'Five years of chemistry lived in one spreadsheet, a folder of instrument files, and a stack of handwritten notebooks. This is what it became: a single governed schema where every column has a documented meaning and every automated action leaves a trace.',
  sub:
    'The counts below are read from the live database when the site is built, not typed in. If the schema changes, the page changes with it.',
}

/* Cuatro razones y el diccionario, en tarjetas. `icon` lo resuelve la pantalla. */
export const DB_WHY = {
  title: 'Why a database, and not a very good spreadsheet',
  cards: [
    {
      icon: 'meaning',
      head: 'Columns that know what they mean',
      body: 'A header reading `T` could be temperature, time or a code. Here **every column carries a native `COMMENT`** with its units and allowed values — and pgAdmin, this site and the AI agent all read the same one.',
    },
    {
      icon: 'rules',
      head: 'Rules that cannot be forgotten',
      body: 'Foreign keys mean a measurement cannot exist without its synthesis. `CHECK` constraints mean a model cannot be registered as irreproducible without a written reason. **The rules live where the data lives.**',
    },
    {
      icon: 'lanes',
      head: 'Two writers at once',
      body: 'A notebook ingests the master Excel file; a workflow ingests instrument files. The first loads by `UPSERT` and never `DELETE`, precisely so it **cannot erase what the second wrote overnight**.',
    },
    {
      icon: 'memory',
      head: 'A memory of what happened',
      body: 'Every automated action lands in `audit_log` with a typed verdict and cause; every agent exchange in `agent_chat_log`. **Written deterministically, never by an LLM** — a log an AI can edit is not a log.',
    },
    {
      icon: 'dictionary',
      head: 'Documentation that is itself data',
      body: 'The schema documents itself in a **table**: `data_dictionary` holds one row per column, so the site and the agent read it from the database instead of carrying a copy. Coverage is checkable, and the target is 100 % — because **an incomplete dictionary makes "undocumented column" and "column that does not exist" look identical** to whatever is reading it.',
    },
  ],
}

export const DB_BOUNDARY = {
  title: 'What the AI agent is allowed to touch',
  body:
    'The assistant on the previous screen **never writes SQL**. Every one of its tools is a call to a stored function with typed parameters, so what it can ask is fixed by the schema rather than by how carefully a prompt was worded. `agent_verify_owner()` decides whether the answer carries exact values or a coarse one — and it receives a token, hands on a **boolean**, and stores neither.',
  bracketTitle: 'What those functions can read',
}

export const DB_VIEWS = {
  title: 'The views everything reads through',
  lead:
    'Nothing queries a raw table if a view exists for it. A view is where a join is decided once instead of being re-invented in every script — and it is the thing that can be documented, versioned and pointed at.',
}
