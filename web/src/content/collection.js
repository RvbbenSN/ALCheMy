/* --------------------------------------------------------------------------
   collection.js — Texto de la pantalla 02, Data Collection.

   Estaba escrito dentro del JSX, mezclado con las etiquetas del diseno, que es
   justo lo que hace que editar una frase de contenido de miedo. Aqui el texto
   esta separado: se cambia lo que hay entre comillas y no se puede tocar nada
   de la maquetacion sin querer.

   Los campos largos se pintan con `<Rich>`, asi que **lo que va entre dos
   asteriscos sale en negrita**.
   -------------------------------------------------------------------------- */

export const COLLECTION_HERO = {
  lead:
    'Three ways in, one row out — and a gate at every step that can reject a file before it costs anything to process.',
}

export const COLLECTION_PROBLEM = {
  body1:
    'At the end of the previous screen the laboratory has thousands of instrument files spread across network folders, written by nine different machines in nine different formats. None of them knows which synthesis it belongs to, and nothing stops the same file being saved twice under two names.',
  body2:
    'What is needed is unglamorous and specific: **a way to drop a file somewhere and have it end up in a database, correctly attributed, without anyone retyping anything.**',
  guaranteesTitle: 'What the workflow guarantees',
  guarantees: [
    ['Attribution.', 'Every measurement is linked to the synthesis it came from, by sample code, and to the person who submitted it.'],
    ['No duplicates.', 'A cryptographic fingerprint of the file contents rejects a second copy before it is parsed.'],
    ['Uniform shape.', 'Nine formats become one row shape, so a query can span techniques without knowing anything about instruments.'],
    ['A record of every decision.', 'Accepted or rejected, with the reason, in an audit table written by code and never by a language model.'],
  ],
}

export const COLLECTION_HOW =
  'A file arrives by one of three routes. Its metadata is normalised and the sender checked against a whitelist. Its fingerprint is taken and compared against what is already stored. It is then routed by technique to one of three extraction strategies — a deterministic parser for the seven formats that are well understood, an AI agent for the reports that only exist as PDFs, and a vision agent that adds a description to microscopy images without ever inventing a measurement. Whatever happens, the outcome is written to the audit log.'

export const COLLECTION_CANVAS_INTRO =
  'The flow as it exists in n8n — **79 nodes**, **114 connections**, nine framed areas — read straight from the exported workflow, not redrawn by hand. Pick a stop and the map flies to it, with the card below saying what that area adds to the row and why. The last stop pulls back to the whole flow.'

export const COLLECTION_ROW_INTRO =
  'Every path through this workflow has to arrive at the database write carrying exactly these fields. Think of the item as a snowball rolling through the pipeline, picking up more of this shape at each stage. If a field is still missing when it arrives, the insert either hard-fails on a constraint or silently stores a null — and it is worth knowing which section was supposed to set it.'

export const ROW_SHAPE = [
  ['sample_code', 'Foreign key into synthesis_experiments'],
  ['technique', 'PXRD / VT-XRD / TGA / FTIR / ADSORPTION / UV_VIS / SEM / ICP_OES / EA'],
  ['researcher_email, researcher_name, operator_name', 'Accountability, checked against a whitelist'],
  ['measurement_tag, instrument_name', 'Provenance of the measurement'],
  ['file_name, raw_file_path', 'Where the original bytes live'],
  ['file_hash', 'Real MD5 of the actual file bytes'],
  ['data_json', '{ header_metadata, raw_data } — the parser contract'],
]

export const COLLECTION_PENDING = {
  schema:
    'Schema explorer pending: an entity diagram of the governed tables, with each column’s description read from the data_dictionary table itself — documented at 100% coverage.',
  audit:
    'Live table pending: timestamp, agent, action, verdict and cause for every automated decision. Sample codes and emails pseudonymized before display.',
}
