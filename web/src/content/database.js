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
    'The counts on this page are read from the live database when it is built, not typed in. If the schema changes, the page changes with it.',
}

export const DB_WHY = {
  title: 'Why a database, and not a very good spreadsheet',
  points: [
    [
      'A spreadsheet has no idea what a column means',
      'A header that reads `T` could be temperature, time or a code. In the schema, **every column carries a native `COMMENT`** with its units, its allowed values and what it actually records — and pgAdmin, the web app and the AI agent all read the same one.',
    ],
    [
      'A spreadsheet cannot refuse an impossible row',
      'Foreign keys mean a measurement cannot exist without the synthesis it belongs to. `CHECK` constraints mean a model cannot be registered as irreproducible without a written reason. **The rules live where the data lives**, so nobody can forget to apply them.',
    ],
    [
      'A spreadsheet has one writer at a time',
      'Two independent lanes write here: the notebook that ingests the master Excel file, and the automated workflow that ingests instrument files. The first loads with `UPSERT` and never `DELETE`, precisely so it cannot erase what the second wrote overnight.',
    ],
    [
      'A spreadsheet does not remember what happened',
      'Every automated action lands in `audit_log` with a typed verdict and cause, every agent exchange in `agent_chat_log`, every model call in `ai_agent_calls`. **Written deterministically, never by an LLM** — a log an AI can edit is not a log.',
    ],
  ],
}

export const DB_DICTIONARY = {
  title: 'The dictionary is data, not documentation',
  body:
    'Most projects document a schema in a wiki that goes stale the week after it is written. Here the documentation is **a table**: `data_dictionary` holds one row per column of every table and view — its name, type, units, valid values and meaning.',
  why:
    'That choice buys two things a document cannot. The web app and the AI agent read the dictionary **from the database** instead of carrying a copy in their code, so they cannot disagree with it. And its coverage is checkable: `scripts/sync_data_dictionary.py --check` exits with an error if any column is undocumented.',
  rule:
    'The coverage target is 100 %, and the reason is sharper than tidiness: **an incomplete dictionary makes "undocumented column" and "column that does not exist" look identical** to whatever is reading it. An agent that cannot tell those apart will confidently answer about a field nobody ever created.',
}

export const DB_BOUNDARY = {
  title: 'What the AI agent is allowed to touch',
  body:
    'The assistant on the previous screen never writes SQL. Each of its tools is a call to a **stored function with typed parameters** — the ones prefixed `agent_` in the list below. What it can ask is therefore bounded by the schema rather than by how carefully the prompt was worded.',
  detail:
    'The functions also carry the access rule. `agent_verify_owner()` checks a token against the MD5 held in `agent_owner_secret` and hands every downstream function a **boolean**, never the token. Without it, the same query returns a coarse answer with no exact masses, temperatures or ratios.',
}

export const DB_BACKUP = {
  title: 'The part that cannot be recomputed',
  body:
    'Most of this database is reproducible: run the pipelines again and the descriptors, the measurements and the embeddings come back. **Two things do not.** The human crystallinity labels in `pxrd_labels` are expert judgement that exists in no file, and any reconciliation done by hand.',
  policy:
    'So backups are **event-driven, never scheduled**: before a migration or a mass delete, and after a bulk ingestion or a labelling session. A timer firing against an idle database burns disk; the moments that matter are known in advance. And the first step of a checkpoint is not the dump — it is reporting the row counts, because a backup of a database a migration has already broken is not a rescue.',
  size:
    'The default dump skips only the **vectors** in `rag_chunks`: measured on the live table they are 1.9 GB against a few hundred megabytes for everything else. Embeddings are a deterministic function of the text, so a restore re-embeds instead of carrying them — 82 MB per copy rather than 941 MB. The chunk text itself is always kept, because re-chunking would give every passage a new id and silently attach 87,765 context sentences to the wrong text.',
}

export const DB_HONEST = {
  title: 'What is untidy in here',
  items: [
    [
      'Two views say the same thing in two languages',
      '`v_agent_samples` and `v_agente_muestras` are the same query, as are `v_rag_library` and `v_rag_biblioteca`. They come from the project being written in English while the working notes are in Spanish. Harmless, and still duplication: one of each should go.',
    ],
    [
      'A test table lives beside the real one',
      '`characterization_measurements_test` exists so the ingestion workflow can be exercised without touching real rows. It is verified not to leak into the production table — but a table whose name ends in `_test` sitting in the same schema is a thing to keep an eye on, not to be relaxed about.',
    ],
    [
      'The schema documents itself in two languages',
      'Five of the nine views carry their `COMMENT` in Spanish and the rest in English, because the project is written in English while the working notes are not. The web shows an English gloss, but **the agent reads the raw comment** through `read_data_dictionary` — so the schema genuinely answers in two languages depending on which object you ask about. It should settle on one.',
    ],
    [
      'One table is not from this project at all',
      '`job_leads` belongs to a separate job-search workflow that happens to share the instance. It is excluded from every count on this page by an explicit, visible rule rather than by a filter buried in a query.',
    ],
  ],
}

/* Glosa en ingles para las vistas cuyo COMMENT en la base esta en espanol.
   El hecho -- que vistas hay y cuantas columnas tienen -- sigue viniendo de
   schema_map.json; esto es solo la frase que se publica. Una vista que no
   aparezca aqui muestra su COMMENT tal cual. */
export const VIEW_NOTES = {
  v_agente_muestras:
    'The Spanish-named twin of `v_agent_samples`. Same query; one of the two should go.',
  v_ml_deployed:
    'Which models are being served right now and in which slot. One row per slot — if it is empty, nothing is deployed.',
  v_ml_features:
    'The feature table for machine learning (v3). Against v2 it corrects the volume units — the dilute stock solutions were recorded in mL, not µL, and their water now enters the balance — and recovers three solvent columns. Glacial acetic acid counts as both a solvent and a carboxylic modulator.',
  v_ml_model_input_contract:
    'The input columns of every model, in the exact order they must be passed. Anything loading a model from the registry reads this instead of hard-coding the list.',
  v_ml_model_registry:
    'The model registry in readable form, without the binaries: which models exist, on what data, with what result, and whether they are still reproducible.',
  v_rag_biblioteca:
    'The Spanish-named twin of `v_rag_library`. Same query; one of the two should go.',
}
