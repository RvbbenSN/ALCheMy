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
stand. `--batch-root DIR` points the whole pending/done/imported/rejected
cycle at a different tree (default `data/rag_context_batches`) — used to
import `rag_export_context_repairs.py`'s output from
`data/rag_context_batches/repairs/` without mixing it into the normal
first-pass flow.

### `rag_export_context_repairs.py`
A second failure mode showed up on 2026-08-26 that the diversity check above
does not catch: for a minority of chunks per document, the model filled in
a rigid template ("This X chunk (part N) evaluates `<garbled fragment>`
regarding `<title>`") instead of a real sentence — each one is technically
*distinct* (different part number, different fragment), so it passes the
uniqueness check while carrying almost no real information. This script
finds every `rag_chunk_context` row matching that signature (a regex, `--pattern`
to override it), groups the affected `chunk_id`s by document, and exports
one JSON batch per affected document into
`data/rag_context_batches/repairs/pending/` — same shape as
`rag_export_context_batches.py`'s output (full document text + instructions),
except `"chunks"` only lists the specific chunk_ids that need redoing, not
the whole document. Problem solved: redoing whole documents to fix a
scattered minority of bad chunks would throw away thousands of good
sentences (2026-08-26 incident: 502/783 documents had *some* broken chunks,
but only 1 document had more than half of its chunks affected — median was
under 10%). Import the results the normal way, just pointed at the repair
tree: `python src/rag_import_context_batches.py --batch-root data/rag_context_batches/repairs --apply`
— the existing `ON CONFLICT (chunk_id) DO UPDATE` silently overwrites only
those rows. Reuse: `--limit N` for a pilot, `--doc ID` for one document,
`--pattern` to hunt a different bad-sentence signature if a new failure mode
shows up later.

`--mode recycled` handles a second, older failure: 37 documents were found
with the *original* recycled-sentence problem (a handful of duplicated
sentences across most of a document's chunks) that predates the diversity
check in `rag_import_context_batches.py` — their `created_at` is all before
that check was merged, so nothing ever rejected them. There is no reliable
way to tell which duplicate was "the real one" for an affected chunk, so
this mode re-exports the document's **entire** chunk list (not a subset)
via `--diversity-threshold` (default 0.5, same threshold the import-side
check uses). `--mode template` (the default) stays scoped to individual
chunk_ids since that failure only ever hits a minority of a document's
chunks.

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
(restrict to PUBLIC-sensitivity documents only). Searches `embedding` only
— see `rag_query_compare.py` to also search `embedding_v2`.

### `rag_reembed_context.py`
The final step of contextual retrieval (Anthropic's technique, see
`methodology/ROADMAP_RAG_Y_GRAFO.md`): computes `rag_chunks.embedding_v2 =
embed(context_sentence + "\n\n" + text)` for every chunk that has a
sentence in `rag_chunk_context`, using the same local Ollama `bge-m3`
model, batching, and retry/backoff shape as `rag_ingest_chunks.py`. Problem
solved: the technique only works if the context sentence is baked into
what gets embedded — keeping it as a separate, un-vectorised column (safer,
but pointless for search) throws away the entire retrieval-quality gain the
roadmap cites (+35% fewer failures from contextual embeddings alone). This
writes into a **second** column instead of overwriting `embedding`,
specifically because the context sentences come from an external LLM whose
failure modes (see `rag_export_context_repairs.py`) can't realistically be
hand-checked across ~88k chunks — `embedding` stays untouched no matter
what, so nothing about today's working retrieval can regress from running
this. Reuse: resumable by default (`WHERE embedding_v2 IS NULL`), `--force`
to recompute, `--limit N` for a pilot, `--doc ID` for one document.

### `rag_query_compare.py`
A/B tool: embeds one question and runs a plain cosine-similarity search
against `embedding` and `embedding_v2` separately, printing both result
sets side by side plus which chunk_ids only show up in one of them.
Deliberately skips the BM25/RRF fusion `rag_hybrid_search()` does — the
question this answers is narrowly "did adding context change what the
vector search finds", not "what's the best retrieval pipeline". Problem
solved: gives the project owner a way to judge, on real questions, whether
`embedding_v2` is actually better before switching anything over — no
manual review of the underlying context sentences required, just look at
whether the passages that come back are more relevant. Reuse: `-n` (result
count per column).

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
a real amorphous sample and a real crystalline one.

**Pipeline v2.0 — three changes that move the numbers.** First, the grid starts
at **5°, not 3°**: below ~4.5° the detector records the tail of the direct and
air-scattered beam, which the width filter was reading as a huge amorphous halo.
Measured on 149 re-processed patterns, the crystalline fraction rose in **100%**
of them (median +0.26, up to +0.64) and `amorphous_hump_center` moved from a
suspicious ~3.9° to a physically sensible 13–24°. Second, the narrow component is
**gated at k·σ** — counting noise is narrow, so the width filter cannot tell it
from a reflection and hands it all to the crystalline side; without the gate the
empty sample holder came out 89% crystalline. Third, the halo has its **arPLS
pedestal** removed, because arPLS returns the floor of the data rather than its
mean and leaves a positive offset that the running median faithfully reports as a
halo that does not exist.

Two new columns exist to make silent failures visible rather than invisible:
`d_max_saturated` (the first reflection sits on the cutoff, so `d_max_angstrom` is
a lower bound and not a measurement) and `crystallinity_reliable` (driven by
`signal_snr_area`: 0.07 on the empty holder, 3–5 on a normal sample).  Reuse: import the
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
path, and four judgements arranged next to the plot: a mandatory crystallinity
class (AMORFO / INCIPIENTE / CRISTALINO / SIN_MUESTRA), an optional incipient
sub-type, and two optional flags (oxide present, multi-phase suspected). One
"Aceptar y siguiente" click saves everything marked and advances — no dropdown,
no per-field save. A Back button re-opens the previous pattern with its choices
restored, and accepting again overwrites it.

These are four *independent* questions, not one category — see the module
docstring for why (an oxide or a second phase can show up at any crystallinity
level, so cramming them into one value was producing exactly the ambiguity you'd
expect). Each is its own `label_type` row in `pxrd_labels`, keyed on
`(file_hash, label_type)`, which is why they can be added without touching or
re-doing any `crystallinity_class` label already saved. MEZCLA was retired as a
crystallinity value for the same reason — a clearly two-phase pattern is still
CRISTALINO by degree of order, with `multiphase_suspected = SI` carrying the
"more than one phase" information; older rows still holding MEZCLA surface
through the sidebar's "MEZCLA (antigua)" review filter so they can be revisited
with the new, correct axes.

The sidebar also has a "Repasar lo ya etiquetado" section: filter by an
existing crystallinity value, or search the saved comments (e.g. `oxid`), to
retrofit the oxide/mixture flags onto patterns labelled before those axes
existed, without hunting through ~1,870 rows by hand.

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

Two details worth knowing. Every widget — the crystallinity pills, the subtype
pills, the indicators pills, the comment box — is keyed by the pattern's file
hash rather than a fixed key: Streamlit forbids assigning to `session_state`
for an already-instantiated widget, so resetting a fixed-key widget on advance
raises an exception that silently strands the app on the same pattern.
Per-hash keys also give each pattern's principal pill a clean `default=None`
(nothing pre-selected) unless a real label already exists for it — which is
what makes a retired MEZCLA value force a fresh choice on review, since it can
never match the current option list. And the optional "show automatic analysis"
overlay is **off by default** on purpose — seeing the pipeline's estimated
crystallinity while labelling makes the labels dependent on the algorithm they
are supposed to validate.

The controls use `st.pills` rather than `st.radio`/`st.checkbox` specifically
for phone use: a pills group lays its options out horizontally and only wraps
if it must, so a 4-option judgement costs one short row instead of four full
rows. Combined with collapsing the file path and the running tally into
`st.expander`s, dropping the redundant sample-code heading (the plot title
already shows it), and moving "Aceptar" to an icon-only button shared with
Anterior/Saltar in one row, the whole plot-plus-judgement screen fits without
scrolling on a phone — that was the point of this pass. "Dudosa" moved from
its own checkbox into the indicators pills; it's a soft flag to revisit later,
not a blocker, and in practice most uncertainty already shows up as a choice
of INCIPIENTE rather than a separate doubt marker. A small `<script>` inserted
via `st.html(..., unsafe_allow_javascript=True)` re-anchors the scroll position
to just above the plot on every rerun, since a phone browser otherwise jumps to
whatever just changed - this needed `st.html`, not the deprecated
`st.components.v1.html`/`st.iframe`, because those sandbox the script inside
its own iframe, where `window.parent.document` access can be silently blocked
by the browser and the whole trick becomes a silent no-op. `st.html` runs the
script directly in the main document instead.

Two more mobile-driven details: the running tally lives in an `st.popover`
next to the metal/linker line rather than its own section, and the "saved"
confirmation is an `st.toast` (auto-dismissing, no layout space) instead of an
`st.success` banner that used to push the whole screen down after every click.
Streamlit's own top header is a fixed overlay, not part of the normal document
flow, so shrinking `block-container`'s top padding without also shrinking the
header let the title render partly underneath it — both are sized together.

The UI text is English; only the display captions changed. The `label_value`
codes actually written to `pxrd_labels` (`AMORFO`, `INCIPIENTE`, `CRISTALINO`,
`SIN_MUESTRA`, the incipient-subtype codes, `confidence = alta|dudosa`) stay
exactly as they were, since ~1,150 rows already use them and renaming them
would be a data migration, not a display change. The title, progress line and
metal/linker/tally/file row are grouped in one `st.container(key="header_block")`
with a gap rule scoped to `.st-key-header_block` — narrower than the earlier
attempt at a blanket `stVerticalBlock` gap override, which caused captions to
overlap the element above them because some Streamlit elements already carry
their own offset tuned to the *default* spacing.

Reuse: `--server.port` to run several instances; the sidebar filters by metal and
linker so the corpus can be labelled in themed batches; every click is an
autocommitted UPSERT, so closing the browser mid-session loses nothing.

### `scripts/ddl_pxrd_labels_v2.sql`
Rebuilds `pxrd_labels` with the hash-keyed design described above, plus the
`v_pxrd_labels_full` view (labels joined to their synthesis conditions, with a
`needs_relink` flag) and `data_dictionary` rows for every column. Idempotent
apart from the initial `DROP TABLE`, which was safe because the old table was
empty. Ends with the re-linking query to run after any re-ingestion.

---

## Operations (keeping the database alive)

### `scripts/backup_database.py`
Backs the whole PostgreSQL database up to `backups/` with `pg_dump`, verifies the
result, and rotates old copies.

The problem it solves: the database lives entirely inside the Docker named volume
`postgres_data`, and that volume is the only copy. A `docker compose down -v`, a
Docker reinstall or a corrupted volume takes every row with it. Most of the content
could be rebuilt by re-running the ingestion over `data/raw_datalake/`, but two
things could not — the human labels in `pxrd_labels` (expert judgement, derivable
from no file) and any reconciliation done by hand in pgAdmin. `pg_dump` does not
copy files off the disk; it regenerates the SQL needed to rebuild the database from
nothing, taken against one consistent snapshot while the database keeps serving
other clients, which is why the output survives a move to another machine, another
PostgreSQL version or a cloud instance.

Three details worth knowing. **It verifies.** After copying the dump out of the
container it pushes it back in and runs `pg_restore --list` on it: a truncated or
corrupt archive fails at backup time rather than on the day it is needed. **It
records what went in.** A `.manifest.json` beside each dump holds the row counts of
the six tables that matter, so a restore can be checked against a number instead of
a hope. **Rotation is by count, not by age** (`--keep`, default 7): "delete anything
older than 7 days" would quietly leave zero backups after a month away, whereas
"keep the last 7" always leaves something.

**Size is why the default is a "light" dump.** A full dump is ~941 MB, and 1,931 MB of
the 2,100 MB database is `rag_chunks`. Broken down by column on the live table: `text`
81 MB and `metadata` 44 MB against `embedding` 343 MB and `embedding_v2` 343 MB. Only
the vectors are skipped, because only they are cheap to rebuild — an Ollama run over
text that already exists. That gives **82 MB per copy instead of 941 MB**; seven copies
cost ~575 MB rather than ~6.6 GB. `--full` includes the vectors, for use before a
migration that touches the RAG schema.

**The chunk text is kept on purpose, and that is the subtle part.** pg_dump cannot
exclude individual columns, so the script snapshots `id, document_id, text, metadata,
created_at` into `rag_chunks_text_backup` immediately before dumping and drops it in a
`finally` block, so a crashed run never leaves 125 MB of duplicated text in the live
database. Because that table exists at dump time, one pg_dump call picks it up — one
file, no sidecar. The reason to bother: `rag_chunk_context` keys one LLM-written context
sentence per chunk on `chunk_id`. Re-chunking from the source documents after a restore
would renumber every row and leave all 87,765 sentences attached to the wrong text —
**no error, just quietly worse retrieval**, invalidating the `embedding_v2`
contextual-retrieval work. Preserving the ids means a restore re-embeds and never
re-chunks.

Restoring a light dump therefore has mandatory follow-up steps, all printed by
`--restore-help`: reinsert the chunks from the snapshot, `setval` the id sequence,
re-create the `rag_chunk_context` foreign key (pg_restore fails to add it because
`rag_chunks` arrives empty — an expected error, not a corrupt dump), then re-embed.
Verified end to end against a scratch database: 87,765 chunks and 87,765 context
sentences restored, with text and sentences MD5-identical to the originals matched by
id. The manifest records the mode, the excluded tables and the chunk row count, and the
script prints the running disk total after each run.

This script is meant to be run at the checkpoints described under "Database safety" in
the root `CLAUDE.md` — before a migration or mass delete, after a bulk ingestion or a
labelling run — and deliberately **not** on a schedule.

Reuse: `--list` shows what exists with its row counts; `--restore-help` prints the
restore commands (including the single-table form, e.g. recovering only
`pxrd_labels`) without running them, because a restore overwrites live tables and is
a decision rather than a script step; `--env-file` points at a different `.env` so a
second instance can be dumped with the same script. Requires the `alchemy_postgres`
container to be running — `pg_dump` lives inside it, not on the Windows host.

Privacy: a dump contains raw synthesis parameters and ligand names. `backups/` is
gitignored; do not move a dump out of it and never upload one to an external service.


### Pipeline v3.0 - amorphous content measured against the empty instrument

`crystalline_fraction` (v2.0) separated halo from peaks by **width**, with a 3 degree
running median. Checked against the 1,881 patterns the lab owner had classified by eye,
that estimate is wrong at both ends:

- On patterns labelled `CRISTALINO` it reported ~50% amorphous. Between the reflections
  the corrected signal is flat at 0.00-0.08% of the peak maximum, so there is no halo
  there. Peaks plus flanks cover 41-46% of the axis, so a 3 degree window centred on a
  cluster holds a majority of raised points and the median climbs onto the flanks: 71%
  of the reported halo area came from underneath the peaks.
- On patterns labelled `AMORFO` the surviving halo measured 0.76 sigma - **below the
  counting noise**. arPLS had already absorbed it: a 5-15 degree hump is smooth enough
  for a baseline estimator to treat as baseline.

The empty holder settles it. Its arPLS baseline is straight to 0.0 sigma while real
samples curve by 3.8-23 sigma, so the instrument contributes no curvature and all of it
belongs to the sample - which arPLS was discarding as background.

**v3.0 therefore defines** `amorphous = (what arPLS removes) - (the empty instrument)`,
exposed as `amorphous_fraction_blank` / `crystalline_fraction_blank`. Validated against
the hand labels: CRISTALINO 0.012, INCIPIENTE 0.073, AMORFO 0.247, and the blank against
itself 0.031 - a **21x** separation against 3.5x for the width-based estimate. The
ordering also holds across the incipient subtypes, which the algorithm has never seen.

**The scaling is the only delicate part.** Time-per-step is absent from every `.xrdml`
header checked, so the blank and a sample are not directly comparable in raw counts. The
factor is taken from the median ratio **above 45 degrees**, where a sample's own diffuse
scattering has largely died away. The window is not critical - 40 to 47 degrees give the
same ordering - and it fails conservatively: a sample still scattering at 45 degrees
scales the blank up too far, so more is subtracted and the amorphous content comes out
**under-estimated**, never invented.

**What the number cannot see.** The subtraction assumes the specimen sat in the same
holder as the blank. The lab's silicon standard (NIST 640, confirmed by its 28.44 /
47.30 / 56.12 degree reflections) comes out at 0.322 despite being as crystalline as a
specimen gets, because loose powder needs a support the empty holder does not have, and
95% of its diffuse excess sits below 28 degrees where silicon has no reflections at all.
So the descriptor measures **how much of this pattern is not Bragg scattering**, not how
much amorphous material is in the vial: it also counts thermal and defect diffuse
scattering, air scatter, and Fe fluorescing under Cu radiation. Within one corpus mounted
the same way it compares samples honestly; outside that condition it does not.

Reuse: `load_instrument_blank(connection)` accepts either a SQLAlchemy connection or a
plain psycopg2 one and returns the blank on the standard grid;
`amorphous_from_blank(x, y_grid, blank_grid)` returns the diffuse curve, the fraction and
the scale factor, and is callable on its own for plotting. Pass `blank_grid=` to
`extract_descriptors` or the v3.0 columns come back `None` rather than silently falling
back to the superseded estimate. Schema delta in `scripts/ddl_pxrd_descriptors_v3.sql`
(additive; the v2.0 columns are kept, with their COMMENT amended to say they are
superseded and why).
