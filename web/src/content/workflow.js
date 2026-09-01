/* --------------------------------------------------------------------------
   workflow.js — Las 9 areas del flujo de ingesta de n8n.

   La descripcion de cada area y sus nodos sale de la transcripcion que hizo
   Ruben de las sticky notes del propio lienzo. El texto de esas notas NO se
   dibuja sobre el canvas: va en el pop-up de cada area, que era el encargo.

   `kind` decide el icono y el color del nodo. No son emojis genericos: cada
   tipo dice que clase de trabajo hace ese nodo, que es la informacion que de
   verdad ayuda a leer un flujo.
   -------------------------------------------------------------------------- */

export const AREAS = [
  {
    n: 1,
    title: 'Entry',
    subtitle: 'Three ingestion lanes',
    objective:
      'Accept a file plus basic metadata from whichever source triggered the run, and normalise it into one common shape before anything downstream has to care which lane it came from.',
    adds: [
      'technique, sample_code, researcher_email, researcher_name, operator_name, measurement_tag — raw, as submitted',
      'file_name and raw_file_path (folder-watcher lane only; the others fill these in once the file is written to disk)',
      'The binary itself, always ending up under $binary.data_file',
    ],
    note:
      'The raw webhook node renames the upload to data_file0 — n8n adds a numeric suffix to multipart uploads. Normalize Webhook Body copies it back so nothing downstream needs to know.',
    nodes: [
      { name: 'Manual trigger', kind: 'trigger' },
      { name: 'Local Folder Watcher', kind: 'trigger' },
      { name: 'Lab Upload Portal (form)', kind: 'trigger' },
      { name: 'Webhook POST /ingest', kind: 'trigger' },
      { name: 'Extract Technique from Path', kind: 'transform' },
      { name: 'Sanitize Input', kind: 'transform' },
      { name: 'Normalize Webhook Body', kind: 'transform' },
    ],
  },
  {
    n: 2,
    title: 'Tags, sample code & whitelist',
    subtitle: 'Normalise, then authorise',
    objective:
      'Make every field look the same regardless of origin lane, reject anything without a sample code — it is the database lookup key — and gate on researcher authorisation.',
    adds: [
      'technique normalised (UV-Vis → UV_VIS, ICP-OES → ICP_OES)',
      'sample_code regex-extracted from the filename when not submitted explicitly',
      'researcher_email lowercased and trimmed',
      'instrument_name gets a technique-based guess, overwritten later by the real parsed value',
    ],
    note:
      'Auto-enrolment adds a new email as active, but deliberately does not re-activate one an administrator revoked by hand.',
    nodes: [
      { name: 'Homogenize Tags — All Entries', kind: 'transform' },
      { name: 'Homogenize Tags — Instrument Lookup', kind: 'transform' },
      { name: 'If — Has Sample Code?', kind: 'gate' },
      { name: 'Auto-Enroll Whitelist', kind: 'db' },
      { name: 'Merge — Restore After Whitelist', kind: 'transform' },
      { name: 'If — Is Email Active?', kind: 'gate' },
    ],
  },
  {
    n: 3,
    title: 'Quality gate',
    subtitle: 'Reject before spending compute',
    objective:
      'Reject oversized or duplicate files before any parsing happens, and get the real bytes into a form the Python sandbox can actually read.',
    adds: [
      'file_ext, is_archive',
      'data_file_base64 — the native Python runner cannot read $binary when binaries are stored in filesystem mode',
      'file_hash — the real MD5 of the decoded bytes',
    ],
    note:
      'That last line was a genuine bug: the hash was being computed over the binary metadata marker rather than the file contents, so every file looked unique and deduplication silently did nothing.',
    nodes: [
      { name: 'Check File Size', kind: 'gate' },
      { name: 'Detect File Extension', kind: 'transform' },
      { name: 'Convert Binary to Base64', kind: 'transform' },
      { name: 'If — Has Metadata File?', kind: 'gate' },
      { name: 'Calculate MD5 File Hash', kind: 'hash' },
      { name: 'Check Duplicates', kind: 'db' },
      { name: 'If — Is New Measurement?', kind: 'gate' },
    ],
  },
  {
    n: 4,
    title: 'Routing by technique',
    subtitle: 'Three extraction strategies',
    objective:
      'Decide which of the three extraction strategies applies: a deterministic parser, AI over a PDF, or rejection as unrecognised.',
    adds: ['Nothing new — this area only reads the technique field set back in area 2.'],
    nodes: [
      { name: 'Technique Router', kind: 'router' },
      { name: 'Deterministic Parser Router', kind: 'router' },
      { name: 'If — Valid PDF Extension?', kind: 'gate' },
    ],
  },
  {
    n: 5,
    title: 'Deterministic parsers',
    subtitle: 'Seven techniques, zero AI · autonomy L4',
    objective:
      'For every technique with a well-understood file format, extract every real instrument-recorded value with no AI involvement whatsoever — the cheapest, fastest and most trustworthy path.',
    adds: [
      'The real parsed values overwrite the earlier guesses: sample_code, technique, measurement_tag, operator_name, instrument_name, file paths',
      'The full data_json payload: header_metadata plus raw_data',
    ],
    note:
      'One standalone Python module per technique and extension, each verified against real data-lake files inside the actual runner container.',
    nodes: [
      { name: 'Parse PXRD (.xrdml)', kind: 'parser' },
      { name: 'Parse VT-XRD (.brml)', kind: 'parser' },
      { name: 'Parse TGA (.txt)', kind: 'parser' },
      { name: 'Parse FTIR (.csv)', kind: 'parser' },
      { name: 'Parse Adsorption (.xls)', kind: 'parser' },
      { name: 'Parse UV-Vis (.asc)', kind: 'parser' },
      { name: 'Parse Microscopy (.jpg)', kind: 'parser' },
    ],
  },
  {
    n: 6,
    title: 'AI extraction — PDF reports',
    subtitle: 'ICP-OES and elemental analysis',
    objective:
      'Extract elemental composition tables from reports that only exist as PDFs, with a human-in-the-loop safety net for when the model is not confident.',
    adds: [
      'elemental_ratios for ICP; chns_averages and triplicate_runs for EA',
      'confidence and reasoning',
      'Restored afterwards: the agent output does not carry researcher identity, file paths or the hash — they are pulled back from before the agent ran',
    ],
    note:
      'Below 85% confidence the run pauses and emails a human rather than guessing. An unanswered question is better than a confident wrong number in a governed table.',
    nodes: [
      { name: 'AI Agent — PDF Parser', kind: 'ai' },
      { name: 'Restore Fields — PDF Agent', kind: 'transform' },
      { name: 'Confidence Evaluator', kind: 'gate' },
      { name: 'Send message and wait', kind: 'human' },
      { name: 'If — Email Answer yes?', kind: 'gate' },
    ],
  },
  {
    n: 7,
    title: 'AI extraction — microscopy',
    subtitle: 'SEM / FESEM / TEM',
    objective:
      'The deterministic parser already pulled every real instrument value from the companion sidecar. The AI step only adds a qualitative morphology description and a literal transcription of any scale-bar caption.',
    adds: ['data_json.raw_data.ai_vision_analysis, merged into the deterministic payload — never replacing it'],
    note:
      'Deliberately never a fabricated numeric particle size. The vision agent describes what the image looks like; it does not measure.',
    nodes: [
      { name: 'Convert B64 to Binary', kind: 'transform' },
      { name: 'AI Agent — Image Analizer', kind: 'ai' },
      { name: 'Merge AI Analysis', kind: 'transform' },
    ],
  },
  {
    n: 8,
    title: 'Database write & response',
    subtitle: 'Where a missing field becomes a hard failure',
    objective:
      'Insert the finished row and tell the caller what happened. This is the point where a field that is still missing stops being a gap and becomes a constraint violation.',
    adds: ['The row itself, plus the reply to whoever triggered the run'],
    nodes: [
      { name: 'DB Update', kind: 'db' },
      { name: 'If — Came from Webhook?', kind: 'gate' },
      { name: 'Send Success (HTTP 200)', kind: 'reply' },
      { name: 'Send an Email', kind: 'reply' },
    ],
  },
  {
    n: 9,
    title: 'Governance',
    subtitle: 'Fallbacks, audit trail & error response',
    objective:
      'Every rejection from any point in the pipeline lands here. It always writes the audit log with a typed verdict, cause and result, and then answers according to origin.',
    adds: ['audit_log row — written deterministically, never by an LLM'],
    note:
      'This used to be a separate sub-workflow called eleven times. Consolidated into two shared nodes, because a webhook response cannot be sent from outside the workflow that owns the trigger — and because sharing nodes beats duplicating them.',
    nodes: [
      { name: 'Set Error Payload', kind: 'error' },
      { name: 'Write audit_log', kind: 'db' },
      { name: 'Respond HTTP 400', kind: 'error' },
      { name: 'Send Error Email', kind: 'reply' },
    ],
  },
]

/* El item que recorre el flujo va acumulando forma. Este es el destino. */
export const TARGET_ROW = [
  'sample_code',
  'technique',
  'researcher_email',
  'researcher_name',
  'operator_name',
  'measurement_tag',
  'instrument_name',
  'file_name',
  'raw_file_path',
  'file_hash',
  'data_json',
]
