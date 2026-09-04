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
  /* Fusion de lo que antes eran dos secciones separadas, "the problem" y "in
     one sentence". Estaban seguidas y decian lo mismo dos veces con distinto
     nivel de detalle; ahora el problema y su solucion van en el mismo hilo, y
     el hilo arranca donde termina la pantalla anterior. */
  body1:
    'The previous screen ended with the problem stated: thousands of instrument files, nine formats, none of them knowing which synthesis it belongs to. Solving it by hand means someone opening each file, reading the sample code off the filename, and retyping it into a spreadsheet — for **6,073 files**.',
  body2:
    'So it is automated. **A file arrives by one of three routes** — a watched folder, a web form, or a webhook. Its metadata is normalised and the sender checked against a whitelist. Its fingerprint is taken and compared against everything already stored. It is then routed by technique to one of three extraction strategies: a deterministic parser for the seven formats that are well understood, an AI agent for the reports that exist only as PDFs, and a vision agent that describes microscopy images without ever inventing a measurement. Whatever happens, the outcome is written to the audit log.',
  builtWith:
    'Built in **n8n**, a workflow automation tool: every box on the canvas below is a real node in a running instance.',
  guaranteesTitle: 'What the workflow guarantees',
  guarantees: [
    {
      icon: 'link',
      lead: 'Attribution',
      body: 'Every measurement is linked to the synthesis it came from, by sample code, and to the person who submitted it.',
    },
    {
      icon: 'fingerprint',
      lead: 'No duplicates',
      body: 'A cryptographic fingerprint of the file contents rejects a second copy before it is parsed.',
    },
    {
      icon: 'shapes',
      lead: 'Uniform shape',
      body: 'Nine formats become one row shape, so a query can span techniques without knowing anything about instruments.',
    },
    {
      icon: 'scroll',
      lead: 'A record of every decision',
      body: 'Accepted or rejected, with the reason, in an audit table written by code and never by a language model.',
    },
  ],
}

export const COLLECTION_CANVAS_INTRO =
  'The flow as it exists in n8n — **79 nodes**, **114 connections**, nine framed areas — read straight from the exported workflow, not redrawn by hand. Pick a stop and the map flies to it, with the card below the map saying what that area adds to the row and why. The last stop pulls back to the whole flow.'

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

/* El arbol de una fila ya ingestada. La tabla de mas arriba dice que campos
   tiene la fila; esto ensena lo que esa tabla no puede: cuanto trae dentro. */
export const COLLECTION_TREE = {
  title: 'What one ingested file actually looks like',
  lead:
    'The table above lists the fields a row must carry. This is one of those rows, opened up — the same shape, filled in by a real `.xrdml` going through the workflow.',
  point:
    'The part worth opening is `header_metadata`. **Forty-four fields nobody typed**: anode material, both K-alpha wavelengths, every slit angle, the detector pitch, the start and end timestamps. All of it was sitting inside the instrument file, and all of it is now queryable next to the curve — which is the difference between a file on a disk and a measurement in a database.',
  contract:
    'Note that `raw_data` holds only `x`, `y` and their labels. That is the **parser contract**: every technique, from a diffractogram to a thermogram to a micrograph, produces the same two sub-objects, so a query can span all nine without knowing anything about instruments.',
}

