# `src/` — script library

This folder is deliberately documented like a small teaching library: every
script solves one specific problem the project ran into, and most of them
are reusable on their own (from a terminal, from a notebook, or from an n8n
Code node) rather than being private helpers of a bigger program.

**Rule:** whenever a new script is added here, add an entry to this file
describing what it does, why it exists, and how it can be reused. See
`CLAUDE.md` for the working agreement this enforces.

---

## Characterization ingestion (raw instrument files → PostgreSQL)

### `characterization_parser.py`
Dispatcher that maps a `(technique, file extension)` pair to the right
per-format parser and re-exports all of them under one import, for backwards
compatibility with the notebooks and `ingest_datalake_to_postgres.py`. The
actual parsing logic lives one file per technique (see below) so a fix to
one instrument's parser can never break another's.

### `parse_pxrd_xrdml.py`, `parse_vtxrd_brml.py`, `parse_tga_txt.py`, `parse_ftir_csv.py`, `parse_adsorption_xls.py`, `parse_uvvis_asc.py`, `parse_microscopy_image.py`
One deterministic parser per instrument format (PANalytical `.xrdml`, Bruker
`.brml` VT-XRD, TA `.txt` TGA, FTIR `.csv`, Micromeritics BET `.xls`, UV-Vis
`.asc`, Hitachi SEM `.jpg`+`.txt`). Each returns the exact same dict shape —
`{sample_code, technique, measurement_tag, operator_name, instrument_name,
file_name, raw_file_path, data_json}`, with `data_json` always split into
`header_metadata` and `raw_data` — so PostgreSQL's JSONB column and any AI
agent can query every technique uniformly regardless of the instrument that
produced it. Problem solved: without a shared contract, "one row per
technique" would mean nine incompatible schemas. Reuse: import the one
function you need directly, or go through `characterization_parser.py`'s
dispatcher. Each file starts with `import io; open = io.open` — a workaround
for n8n's Python sandbox permanently blocking the bare `open` builtin.

### `characterization_parser_n8n.js`
The same parsing contract as above, rewritten in JavaScript for an n8n Code
node, reading the uploaded binary via base64/regex scanning instead of a
file handle. Exists because n8n's native Code node type is JavaScript.
**Status to confirm with the project owner**: `sync_parsers_to_n8n.py` (see
below) now pushes the *Python* parsers straight into n8n Python Code nodes,
which may make this JS copy redundant — but it was still being edited in
this repository's most recent uncommitted changes, so it has not been
removed without checking first which Code node the live workflow actually
runs today.

### `ingest_datalake_to_postgres.py`
Mass backfill: walks `data/raw_datalake_historico/<TECHNIQUE>/`, routes every
file through the same deterministic parsers n8n uses, and inserts directly
into `characterization_measurements` — bypassing the n8n webhook entirely.
Problem solved: ingesting ~5,700 historical files one webhook call at a time
would be slow and fragile; this script is resumable (skips any `file_hash`
already in the table, commits row-by-row so a crash mid-run loses at most
one file) and reports which files it deliberately does not parse (ICP/EA
PDFs, UV-Vis `.csv` re-exports, SEM `.txt` sidecars). Reuse: `--technique`,
`--limit`, `--dry-run` flags make it safe to test against one folder before
running it against everything.

### `sync_parsers_to_n8n.py`
Regenerates each n8n Code node's Python body from the matching `src/parse_*.py`
module and pushes it through the n8n REST API. Problem solved: keeping a
hand-copied second version of every parser inside n8n is exactly how they
drifted apart before (the n8n copy of the microscopy parser silently missed
a fallback that the `src/` version already had). `src/` is the single source
of truth; this script is what keeps n8n honest to it. Reuse: re-run any time
a `parse_*.py` module changes and the live workflow needs to pick it up.

### `verify_webhook_pipeline.py`
End-to-end black-box test of the live n8n ingestion webhook: fires every
technique's happy path and every automatable fallback, checks the HTTP
response and the typed verdict/cause/result, and for happy paths confirms
the row actually landed in `characterization_measurements` with the right
metadata. Problem solved: the pipeline has several independent failure
surfaces (Python sandbox, multipart binaries, the technique router, FK
constraints) and testing them by hand let regressions slip through. Reuse:
`--only <TECHNIQUE>`, `--happy`, `--fallbacks`, `--keep-rows` flags.

### `generate_n8n_master_workflow.py`
Regenerates the deterministic master ingestion workflow as raw n8n JSON
(`workflows/01_master_characterization_ingestion.json`) from a Python node
list, instead of hand-editing it in the n8n UI. Reuse: run after adding a
new technique/node so the JSON export in git stays in sync with intent —
note it currently writes into the course-exercise `workflows/` folder, not
`n8n_workflows/` (a known rough edge, see `CLAUDE.md`).

---

## RAG corpus (bibliography ingestion, chunking, retrieval)

### `rag_zotero.py`
Read-only reader for a local Zotero library: copies `zotero.sqlite` to a
temp file before opening it (Zotero locks the original while running),
resolves each item's collection path, and yields bibliographic records with
both possible text sources — the PDF if still on disk, or Zotero's own
`.zotero-ft-cache` extracted-text cache if the PDF was never synced down
(Zotero's free tier is 300 MB and fills up fast). Problem solved: makes the
curated Zotero library usable as an ingestion source without ever writing
to it or depending on the desktop app being open. Reuse:
`read_library(zotero_dir, ...)` and `summarise(zotero_dir)` are the two
entry points; both are demonstrated with real output in
`notebooks/04_RAG_Corpus_Ingestion_from_Zotero.ipynb`.

### `rag_catalog_corpus.py`
The card catalogue: extracts bibliographic metadata (DOI, title, authors,
year) from every PDF/DOCX dropped in `data/rag_corpus/{public,internal}/`
and/or from a Zotero library, and writes it into `rag_documents`. Does not
create embeddings — that is `rag_ingest_chunks.py`'s job. Problem solved:
(1) a binary MD5 is a perfect fingerprint of the *bytes* but a terrible one
of the *paper* — publishers stamp a per-download watermark on every page —
so a 3-level anti-duplication ladder (binary MD5 → DOI → normalised header
text MD5, implemented in SQL as `rag_find_existing_document()`) is used
instead; (2) different sources disagree on metadata quality (a bare PDF
often keeps only the corresponding author), so every record carries a
`metadata_source` and a weaker source can never overwrite a stronger one
(`rag_source_rank()`: MANUAL > REFERENCE_MANAGER > CROSSREF >
PDF_HEURISTIC) — this is what stopped a single-author PDF read from
silently erasing a 9-author Crossref record. With `--zotero DIR
--copy-into zotero --apply`, it also **physically copies** each source PDF
or cache-derived `.txt` into `data/rag_corpus/zotero/`, so the archived text
survives independently of the Zotero installation. Reuse: `--apply` writes,
omitting it is always a dry run; `--crossref` enriches PUBLIC documents'
DOIs against the public Crossref API (never sends INTERNAL material).

### `rag_export_metadata_sidecars.py`
For every row in `rag_documents` whose physical file still exists under
`data/rag_corpus/`, writes a `<file_name>.meta.json` sidecar right next to
it (title, authors, year, journal, DOI, doc_type, sensitivity,
metadata_source, and the full CSL-JSON record). Problem solved: Zotero never
writes a metadata file next to the PDF or the cache text it extracts — the
only record of "who wrote this, what journal, what DOI" lived inside
`zotero.sqlite`, and after cataloguing, inside Postgres. If the file and the
database were ever to separate, the archived text would become an anonymous
blob again. This script makes file and identity travel together as an
ordinary pair of files, readable without n8n, without Zotero, and without a
database connection. Reuse: `--apply` writes, `--overwrite` regenerates
sidecars that already exist (default: leave them alone).

### `rag_export_context_batches.py`
Exports one JSON "batch" file per document into
`data/rag_context_batches/pending/`, containing the document's full original
text plus every one of its chunks, for an external agentic assistant (Gemini
in Antigravity) to read and answer sequentially. Problem solved: contextual
retrieval (see `rag_ingest_chunks.py`) needs one context sentence per chunk,
generated with the *whole document* as context, but that generation step was
never implemented and shouldn't be — it needs an LLM budget this project
doesn't want to spend through the same paid API that already hit its quota.
Batching by document (not by chunk) also turns 87,765 chunk-level requests
into ~950 document-level ones. Hard-filters to
`rag_documents.sensitivity = 'PUBLIC'` — INTERNAL/RESTRICTED material must
never reach an external LLM unmasked, so it is excluded by the query itself,
not by a instruction the model could ignore. Reuse: `--limit N` for a small
pilot batch, `--doc ID` for one specific document.

### `rag_import_context_batches.py`
Reads the JSON files written back into `data/rag_context_batches/done/`,
verifies each one is complete (same chunk count, same exact set of
`chunk_id`s, no empty sentences, and the sentences are actually distinct from
each other) before writing anything, and only then inserts into the
`rag_chunk_context` sidecar table — never into `rag_chunks` itself. Problem
solved: an LLM asked to process ~90 items in one request can silently skip or
merge some of them, or — a failure mode observed in practice — get lazy and
paste the same handful of generic sentences across dozens of chunks instead
of writing one specific sentence per chunk. Both look identical to a
purely-structural check (right count, right IDs), so the verifier also
rejects a file where fewer than half the sentences are unique among more
than 5 results. Either failure makes the whole file loud (rejected, moved to
`rejected/`, nothing written) instead of quietly leaving gaps or garbage.
Reuse: dry run by default, `--apply` to actually write and archive processed
files into `imported/`; `--status` prints overall progress (how much of the
whole corpus is done) plus what is currently sitting in each folder, so an
interrupted Antigravity session never leaves you guessing where things
stand.

### `rag_ingest_chunks.py`
Batch chunking + embedding: splits every un-chunked `rag_documents` row
(`needs_ocr = FALSE`) with a recursive character splitter (1200 chars,
~20% overlap) and embeds each chunk in batches of 16 against a local Ollama
`bge-m3` model (1024-dim), writing into `rag_chunks`
(`text` + `embedding` + `metadata` JSONB). Problem solved: (1) resumability —
only processes `WHERE n_chunks = 0` unless `--force`, wraps each document in
its own transaction so a failure on one document never loses progress on
the rest; (2) some PDF text extractors emit NUL bytes from broken font
tables, which PostgreSQL's `TEXT` type rejects outright — stripped before
chunking; (3) embedding calls retry with exponential backoff instead of
aborting the whole run on one transient failure. Reuse: `--doc N` re-embeds
one document, `--force` re-chunks everything regardless of `n_chunks`.

### `rag_query.py`
CLI for `rag_hybrid_search()` (vector + full-text, combined with Reciprocal
Rank Fusion): prints ranked passages with an assembled citation built from
each chunk's metadata. Deliberately has **no LLM attached** — problem
solved: separates "is retrieval finding the right passages" from "is the
model writing a good answer", which is otherwise impossible to tell apart
when both live in the same chat. Reuse: `-n` (result count), `--publico`
(restrict to PUBLIC-sensitivity documents only).

### `rag_smoke_test.py`
Self-cleaning end-to-end health check: inserts one synthetic test document
plus six hand-written chemistry sentences designed so three test queries
each exercise a different half of hybrid search (pure-synonym match, exact
code match, mixed), runs `rag_hybrid_search()` for each, then deletes the
test document and its chunks in a `finally` block regardless of outcome.
Problem solved: gives a fast, repeatable yes/no on whether the retrieval
pipeline works at all, without needing to reason about the real 87k-chunk
corpus or leaving test data behind to confuse later queries. Reuse: run any
time the embedding model, the hybrid-search SQL function, or the pgvector
index changes, before trusting the real corpus.

---

## PXRD descriptors (diffractograms → interpretable numbers)

### `pxrd_descriptors.py`
The single implementation of the PXRD signal-processing pipeline specified in
`methodology/ROADMAP_PXRD_CRISTALINIDAD_Y_ML.md`. Turns a curve of a few
thousand points into one fixed row of numbers a chemist can read — how many
reflections, how wide, how crystalline, how large the unit cell. Problem
solved: a curve cannot be sorted, filtered, correlated or modelled, so
"give me the syntheses with a large unit cell and low crystallinity" was not
a question the database could answer at all.

Four stages: `resample_to_grid` (one common 3–50° grid at 0.02°, with
out-of-range points discarded rather than extrapolated), `decompose_profile`
(splits the profile into instrumental background / amorphous halo / Bragg
peaks), `detect_peaks_poisson` (peak threshold derived from photon-counting
statistics instead of a magic number), and `extract_descriptors` (assembles
the vector).

Two design decisions carry most of the weight. **The profile is normalised
by area before the baseline is fitted**, because arPLS's λ sets stiffness
relative to the size of the numbers being fitted — applied to raw counts the
same λ behaves differently on a 200-count scan and a 20,000-count one, and
descriptors stop being comparable. **The amorphous halo is separated from the
peaks by width (a running median), not by a second arPLS pass**, because arPLS
is a baseline estimator: run on a profile whose floor is already zero it
returns zero, silently reporting every sample as 100% crystalline.

`DEFAULT_LAMBDA_RIGID = 1e6` is not copied from a paper — it is the value
selected by the calibration in `notebooks/05` against this lab's real blank,
a real amorphous sample and a real crystalline one. Reuse: import the
functions directly; they are pure numpy/scipy over plain arrays, so they work
identically in a notebook, a batch script, or an n8n Code node. Bump
`PIPELINE_VERSION` whenever a formula changes, since that string is written
into every `pxrd_descriptors` row and is what makes rows comparable.

### `ingest_pxrd_reference_library.py`
Ingests `data/reference_libraries/PXRD/` into `characterization_measurements`,
tagging each file through `measurement_tag` as `reference_blank`,
`reference_standard`, `reference_precursor` or `reference_simulated`. Problem
solved: `ingest_datalake_to_postgres.py` only walks the historical data lake,
so the empty holder, the instrument standard, the precursors and the patterns
simulated from our own SCXRD structures stayed on disk. Those files are not
samples, they are the *rulers*: the λ calibration is only defensible against a
real blank and a real standard, and the novelty triage needs the simulated
SCXRD patterns. Leaving them out would force every notebook to reach back into
raw folders, which is exactly what the project is trying to stop doing.

A reference belongs to no synthesis, so its parent row in
`synthesis_experiments` is created with `synthesis_type = 'REFERENCE'` and the
literal `'NOT_APPLICABLE'` in the NOT NULL chemistry columns — deliberately not
dummy chemistry, because a plausible-looking metal centre on a blank holder
would be a lie stored in the single source of truth. Reuse: `--dry-run` to
preview; re-running is safe, files already present (matched by binary MD5) are
skipped.

---

## Labelling app (human ground truth for PXRD)

### `app/pxrd_labeler.py`
Streamlit app for stage E2 of the PXRD roadmap: turning ~1,870 unlabelled
diffractograms into the human ground truth supervised learning needs. Run it with
`streamlit run app/pxrd_labeler.py`.

Shows one pattern at a time with its sample code, metal, linker, file name and
path, and five one-click categories (AMORFO / INCIPIENTE / CRISTALINO / MEZCLA /
SIN MUESTRA). Clicking saves and advances immediately — no dropdown, no save
button — because the whole point is labelling several hundred patterns in a
sitting. A Back button re-opens the previous pattern with its label and comment
restored, and re-clicking a category overwrites it.

Problem solved beyond the obvious: **the labels have to survive.** They are
written to `pxrd_labels` keyed on `file_hash`, not on `measurement_id`, because
`characterization_measurements` gets wiped and re-ingested periodically, which
regenerates every id (it happened on 2026-08-25 and took 300 descriptor rows with
it). A hash does not change, so labels outlive any rebuild; `measurement_id` is
kept only as a convenience link with `ON DELETE SET NULL`, re-attachable by the
query at the bottom of `scripts/ddl_pxrd_labels_v2.sql`.

Speed is the other design constraint. Streamlit re-runs the whole script on every
interaction, so the connection is a cached resource, the ~1,870-row work queue is
fetched once without its curves, and each curve is cached after first load with
the next one pre-fetched — measured at 0.63 s per label with no degradation over
25 consecutive labels. Loading all curves up front would take minutes and
hundreds of megabytes, which is why the app never does it.

Two details worth knowing. The comment box and the "doubtful" checkbox are keyed
by the pattern's file hash rather than a fixed key: Streamlit forbids assigning
to `session_state` for an already-instantiated widget, so resetting a fixed-key
box on advance raises an exception that silently strands the app on the same
pattern. And the optional "show automatic analysis" overlay is **off by default**
on purpose — seeing the pipeline's estimated crystallinity while labelling makes
the labels dependent on the algorithm they are supposed to validate.

Reuse: `--server.port` to run several instances; the sidebar filters by metal and
linker so the corpus can be labelled in themed batches; every click is an
autocommitted UPSERT, so closing the browser mid-session loses nothing.

### `scripts/ddl_pxrd_labels_v2.sql`
Rebuilds `pxrd_labels` with the hash-keyed design described above, plus the
`v_pxrd_labels_full` view (labels joined to their synthesis conditions, with a
`needs_relink` flag) and `data_dictionary` rows for every column. Idempotent
apart from the initial `DROP TABLE`, which was safe because the old table was
empty. Ends with the re-linking query to run after any re-ingestion.
