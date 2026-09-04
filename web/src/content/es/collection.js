/* GENERADO por scripts/generar_contenido_es.mjs. No editar a mano:
   se sobrescribe. Para corregir una frase, cambiarla en scripts/textos_es.json
   y volver a ejecutar el script. Lo que no este traducido sale en ingles. */

export const COLLECTION_CANVAS_INTRO = "The flow as it is — **79 nodes**, **114 connections**, nine areas. Pick a stop and the map flies to it, with the card below the map saying what that area adds to the row and why."

export const COLLECTION_HERO = {
  "lead": "How do you process thousands of raw instrument files without ingesting chaos? Explore the automated pipeline that fingerprints, validates, and routes measurements in real time."
}

export const COLLECTION_PROBLEM = {
  "body1": "Thousands of instrument files across nine formats, none linked to its synthesis. Processing **6,073 raw files** by hand would mean endless manual retyping and inevitable human error.",
  "body2": "Instead, the workflow takes over. Incoming files are authenticated, fingerprinted against duplicates, and routed by technique: deterministic parsers handle tabular data, while specialized AI agents extract unstructured PDF reports and microscopy images, **logging every step to an audit trail**.",
  "builtWith": "Built in **n8n**, a workflow automation tool: every box on the canvas below is a real node in a running instance.",
  "guaranteesTitle": "What the workflow guarantees",
  "guarantees": [
    {
      "icon": "link",
      "lead": "Attribution",
      "body": "Every measurement is linked to the synthesis it came from, by sample code, and to the person who submitted it."
    },
    {
      "icon": "fingerprint",
      "lead": "No duplicates",
      "body": "A cryptographic fingerprint of the file contents rejects a second copy before it is parsed."
    },
    {
      "icon": "shapes",
      "lead": "Uniform shape",
      "body": "Nine formats become one row shape, so a query can span techniques without knowing anything about instruments."
    },
    {
      "icon": "scroll",
      "lead": "A record of every decision",
      "body": "Accepted or rejected, with the reason, in an audit table written by code and never by a language model."
    }
  ]
}

export const COLLECTION_ROW_INTRO = "Every path through this workflow has to arrive at the database write carrying exactly these fields. Think of the item as a snowball rolling through the pipeline, picking up more of this shape at each stage. If a field is still missing when it arrives, the insert either hard-fails on a constraint."

export const COLLECTION_TREE = {
  "title": "An example of a ingested file",
  "lead": "A real `.xrdml` after going through the workflow.",
  "point": "The experimental context. It stores the instrumental parameters automatically parsed from the file header such as radiation wavelength, optical setup, and acquisition timestamps. It guarantees reproducibility without manual logging.",
  "contract": "The curve. It holds the measurement signal as normalized (X, Y) coordinate arrays along with their physical units (e.g. 2theta vs. Intensity). Every technique shares this exact structure, making all curves instantly plottable."
}

export const ROW_SHAPE = [
  [
    "sample_code",
    "Foreign key into synthesis_experiments"
  ],
  [
    "technique",
    "PXRD / VT-XRD / TGA / FTIR / ADSORPTION / UV_VIS / SEM / ICP_OES / EA"
  ],
  [
    "researcher_email, researcher_name, operator_name",
    "Accountability, checked against a whitelist"
  ],
  [
    "measurement_tag, instrument_name",
    "Provenance of the measurement"
  ],
  [
    "file_name, raw_file_path",
    "Where the original bytes live"
  ],
  [
    "file_hash",
    "Real MD5 of the actual file bytes"
  ],
  [
    "data_json",
    "{ header_metadata, raw_data } — the parser contract"
  ]
]
