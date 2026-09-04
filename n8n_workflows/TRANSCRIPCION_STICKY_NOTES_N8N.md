# ========================================================
# WORKFLOW MAESTRO: ALCheMy_master_v2.json
# ========================================================

### 📌 Sticky Note 1 (Posición X: -336, Y: 1216)

## 🎯 Goal: what a row in `characterization_measurements` must look like

Every path through this workflow has to arrive at **DB Update** with an item whose `$json` carries exactly these fields:

- `sample_code` (FK into `synthesis_experiments`)
- `technique` (PXRD / VT-XRD / TGA / FTIR / ADSORPTION / UV_VIS / SEM / FESEM / TEM / ICP_OES / EA)
- `researcher_email`, `researcher_name`, `operator_name`
- `measurement_tag`
- `instrument_name`
- `file_name`, `raw_file_path`
- `file_hash` (real MD5 of the actual file bytes)
- `data_json` = `{ header_metadata: {...}, raw_data: {...} }`

Each section below **owns** a subset of these fields - think of the item as a snowball rolling through the pipeline, picking up more of this shape at each stage. If a field is still missing when it reaches DB Update, the insert either hard-fails (NOT NULL / FK constraint) or silently stores a null - worth knowing which section was supposed to set it.

---

### 📌 Sticky Note 2 (Posición X: -336, Y: 1664)

### 1 · ENTRY
3 ingestion lanes

---

### 📌 Sticky Note 3 (Posición X: -336, Y: 2432)

## 🚪 1. Entry — 3 ingestion lanes

**Objective:** accept a file + basic metadata from whichever source triggered the run, and normalize it into one common shape before anything downstream has to care which lane it came from.

**Fields added to the metadata river:**
- `technique`, `sample_code`, `researcher_email`, `researcher_name`, `operator_name`, `measurement_tag` (raw, as submitted)
- `file_name`, `raw_file_path` (Folder Watcher lane only - other lanes fill these in later, once the real file is written to disk)
- The binary file itself, always ending up under `$binary.data_file` (the raw Webhook lane nests it as `data_file0` and under `$json.body.*` - normalized back to the common shape here so nothing downstream needs to know)

**Nodes:** `Click` → `Local Folder Watcher - Data Lake` → `Extract Technique from Path` | `Lab Upload Portal` → `Sanitize Input` | `Webhook` → `Normalize Webhook Body` — all three converge into `Homogenize Tags - All Entries`.

---

### 📌 Sticky Note 4 (Posición X: 320, Y: 1664)

### 2 · TAGS & WHITELIST
Normalize fields + auth gate

---

### 📌 Sticky Note 5 (Posición X: 320, Y: 2256)

## 🏷️ 2. Tags, sample_code & whitelist

**Objective:** make every field look the same regardless of origin lane, reject anything without a `sample_code` (it's the DB's primary lookup key), and gate on researcher authorization.

**Fields added/normalized:**
- `technique` normalized (`UV-Vis` → `UV_VIS`, `ICP-OES` → `ICP_OES`, etc.)
- `sample_code` regex-extracted from the filename if not explicitly submitted
- `researcher_email` lowercased/trimmed
- `instrument_name` gets a technique-based *default guess* here - overwritten with the real value once the actual parser runs

**Nodes:** `Homogenize Tags - All Entries` → `Homogenize Tags - Instrument Lookup` → `If - Has Sample Code?` → `Auto-Enroll Whitelist` (self-enrolls a new email as active; does **not** re-activate one an admin manually revoked) → `Merge - Restore After Whitelist` → `If - Is Email Active?`.

---

### 📌 Sticky Note 6 (Posición X: 336, Y: 1760)

## Normalize Webhook Body
data_file0 = data_file renamed by n8n's raw Webhook node (adds a numeric suffix to multipart uploads); Normalize Webhook Body copies it back to data_file for the rest of the flow.

---

### 📌 Sticky Note 7 (Posición X: 1680, Y: 1440)

### 3 · QUALITY GATE
Size / ext / binary / hash / dup

---

### 📌 Sticky Note 8 (Posición X: 1680, Y: 2016)

## ⚖️ 3. Quality gate

**Objective:** reject oversized or duplicate files before spending any compute on parsing, and get the real file bytes into a form the Python sandbox can actually read.

**Fields added:**
- `file_ext`, `is_archive`
- `data_file_base64` (and `instrument_metadata_file_base64` when a companion file was uploaded) — n8n's native Python runner cannot read `$binary` directly when binaries are stored in filesystem mode, so `Move Binary Data` converts to base64 JSON *before* any Python code touches it
- `file_hash` — the real MD5 of the base64-decoded bytes (not a hash of the binary metadata marker, which was a real bug earlier)

**Nodes:** `Check File Size` → `Detect File Extension` → `Convert Binary to Base64 (data_file)` → `If - Has Metadata File Binary?` → `Convert Binary to Base64 (metadata_file)` → `Calculate MD5 File Hash` → `Check Duplicates` → `Merge - Restore After Duplicate Check` → `If - Is New Measurement?`.

---

### 📌 Sticky Note 9 (Posición X: 1696, Y: 1568)

## Detect File Extension
- Create a folder in the DataLake if not exits
- Extract file name and extension (for router)
- Mark .rar and .zip file

---

### 📌 Sticky Note 10 (Posición X: 2064, Y: 1568)

## Convert Binary to Base64
- Following parsers only read B64 in JSON

---

### 📌 Sticky Note 11 (Posición X: 2560, Y: 1456)

## For SEM/FESEM .txt companinions
- Save .txt along with .jpg/.png SEM images + execution ID to avoid overwrites where 2 upoloads take place.
- Stash saves the path of the file

---

### 📌 Sticky Note 12 (Posición X: 4096, Y: 1424)

### 4 · ROUTING
By technique

---

### 📌 Sticky Note 13 (Posición X: 4096, Y: 1872)

## 🔀 4. Routing by technique

**Objective:** decide which of the three extraction strategies applies to this item — deterministic parser, AI-over-PDF, or reject as unrecognized.

**Fields added:** none new — this section only *reads* the `technique` field set back in Section 2.

**Nodes:** `Technique Router` → `Deterministic Parser Router` / `If - Valid PDF Extension?`.

---

### 📌 Sticky Note 14 (Posición X: 5344, Y: 672)

## 🔬 7. AI extraction — Microscopy (SEM / FESEM / TEM)

**Objective:** the deterministic parser already pulled every real instrument value from the companion `.txt` sidecar (when one exists); the AI step only adds a qualitative morphology description and a literal transcription of any on-image scale-bar caption — deliberately never a fabricated numeric particle size.

**Fields added:** `data_json.raw_data.ai_vision_analysis`, merged into the deterministic payload (never replacing it).

**Nodes:** `Parse Microscopy (.jpg)` → `AI Agent - Image Analizer` → `Merge AI Analysis - Microscopy`.

---

### 📌 Sticky Note 15 (Posición X: 5376, Y: -912)

### 5 · DETERMINISTIC PARSERS
7 techniques

---

### 📌 Sticky Note 16 (Posición X: 5456, Y: -1280)

## 🧪 5. Deterministic parsers (7 techniques)

**Objective:** for every technique with a well-understood file format, extract every real instrument-recorded value with zero AI involvement — the cheapest, fastest, most trustworthy path (autonomy level L4).

**Fields added:** `sample_code` / `technique` / `measurement_tag` / `operator_name` / `instrument_name` / `file_name` / `raw_file_path` (all overwritten with the real parsed values), plus the full `data_json.header_metadata` + `data_json.raw_data` payload.

**Nodes:** `Parse PXRD (.xrdml)`, `Parse VT-XRD (.brml)`, `Parse TGA (.txt)`, `Parse FTIR (.csv)`, `Parse Adsorption (.xls)`, `Parse UV-Vis (.asc)`, `Parse Microscopy (.jpg/.bmp)` — one standalone Python module per technique+extension (`src/parse_<technique>_<ext>.py`), each verified against real data-lake files inside the actual runner container.

---

### 📌 Sticky Note 17 (Posición X: 5888, Y: 432)

### 7 · AI — MICROSCOPY

---

### 📌 Sticky Note 18 (Posición X: 5888, Y: 1360)

### 6 · AI — PDF (ICP / EA)

---

### 📌 Sticky Note 19 (Posición X: 5888, Y: 2048)

## 🤖 6. AI extraction — PDF reports (ICP / EA)

**Objective:** extract elemental composition tables from ICP-OES/EA lab reports that only exist as PDFs, with a human-in-the-loop safety net when the model isn't confident.

**Fields added:** `data_json.header_metadata` / `raw_data` (`elemental_ratios` for ICP, `chns_averages` + `triplicate_runs` for EA), plus `confidence` and `reasoning`.

**Then restored:** the agent's own structured output doesn't carry `researcher_email` / `researcher_name` / `raw_file_path` / `instrument_name` / `file_hash` / `measurement_tag` — `Restore Fields - PDF Agent` pulls them back from before the agent ran.

**Nodes:** `AI Agent - PDF Parser` → `Restore Fields - PDF Agent` → `Confidence Evaluator` → (if confidence < 85%) `Send message and wait for response` → `If - Email Answer yes?`.

---

### 📌 Sticky Note 20 (Posición X: 5904, Y: 480)

## Parse Microscopy
- Keeps the image and parse metadata contained in sidecar .txt

---

### 📌 Sticky Note 21 (Posición X: 6096, Y: 608)

## Convert B64 to Binary
- IA Agents need an image to analyze it (binary not B64)

---

### 📌 Sticky Note 22 (Posición X: 6192, Y: 1104)

## Convert B64 to Binary (after Fallback)
- Reconstructs the image after 1st Agent because just JSON file passthrough

---

### 📌 Sticky Note 23 (Posición X: 9920, Y: 384)

### 8 · DB WRITE & RESPONSE

---

### 📌 Sticky Note 24 (Posición X: 9920, Y: 1376)

### 9 · GOVERNANCE
Fallbacks & audit

---

### 📌 Sticky Note 25 (Posición X: 10672, Y: 1392)

## 🧯 9. Governance — fallbacks, audit & error response

**Objective:** every rejection from any point in the pipeline lands here. Always writes `audit_log` (deterministic, never written by an LLM) with typed `verdict` / `cause` / `result`, then responds according to origin — HTTP 400 if it came from the webhook, email otherwise.

**Fields read:** `verdict` / `cause` / `result` (set by whichever `Set Error - *` node raised the rejection), plus `headers` / `formMode` — read from `Homogenize Tags - All Entries` specifically, since `DB Update`'s `RETURNING` clause would otherwise have already stripped them off the item by the time this section runs.

**Design note:** this used to be a separate sub-workflow called 11 times via `Execute Workflow`. Consolidated into 2 shared nodes here because `Respond to Webhook` cannot work outside the workflow that owns the real trigger, and because sharing nodes via fan-in beats duplicating them (project diary, Session 6).

---

### 📌 Sticky Note 26 (Posición X: 10912, Y: 384)

## 💾 8. DB write & response

**Objective:** insert the finished row and tell the caller what happened.

**Fields required to already be present:** everything listed on the Goal card — this is the point where a field that's still missing becomes a hard failure (NOT NULL / FK constraint) instead of a silent gap.

**Nodes:** `DB Update` → `If` → `Send Success` (webhook origin) / `Send an Email` (non-webhook origin).

---

# ========================================================
# WORKFLOW RAG: ALCheMy-RAG.json
# ========================================================

### 📌 Sticky Note 1 (Posición X: -1536, Y: 256)

### The folder decides the label
Two reading branches instead of one: what you drop in `public/` gets tagged `PUBLIC`, what you drop in `internal/` gets tagged `INTERNAL`.
That way confidentiality never depends on anyone remembering: it depends on where the file was dropped.

---

### 📌 Sticky Note 2 (Posición X: -1424, Y: -304)

## FLOW 1 - INDEXING (manual, run each time you add documents)
**Before the first run:**
1. `docker compose up -d ollama` and `docker exec -it alchemy_ollama ollama pull bge-m3`
2. `docker exec -i alchemy_postgres psql -U alchemy_user -d alchemy_db < scripts/sql/init_db.sql`
3. Assign the Postgres credential to the 4 nodes that need it.

Drop PDFs into `data/rag_corpus/public/` or `data/rag_corpus/internal/`.

---

### 📌 Sticky Note 3 (Posición X: -1424, Y: 704)

## FLOW 2 - QUERY (the agent)
Not a classic single-retriever RAG: an **agent with a tool catalogue**, and the model picks which one to use.
Hard rule: **structured data is NEVER vectorised**. For numbers, SQL.

Every caller is identified (Identify Caller -> Authorise Caller) and every exchange is logged in agent_chat_log, attributed to that person.

---

### 📌 Sticky Note 4 (Posición X: -992, Y: 432)

### Anti-duplication (MD5 + Merge)
MD5 is the file's fingerprint: same content = same hash, even if you rename it.
Below, the DB is asked for the list of hashes **already indexed**, and the Merge in *Keep Non-Matches* mode lets through **only the ones not on that list**.
Without this, every run would duplicate the whole corpus.

---

### 📌 Sticky Note 5 (Posición X: -496, Y: 512)

### A single embeddings node
Feeds both indexing **and** querying.
Deliberate: if the index model and the query model ever diverge, the RAG returns garbage **with no error at all**.

And it all happens locally: the text never leaves this machine.

---

### 📌 Sticky Note 6 (Posición X: -400, Y: 1696)

### Reranker: the missing improvement, disabled on purpose
Hybrid search **retrieves** well but **ranks** so-so. A reranker re-reads the 8 candidates against the question and reorders them: +10-25% precision.

It is **disabled** because the only one available in n8n is Cohere, an external service: turning it on sends your chunk text off-machine. Only enable it for PUBLIC-only corpora.

---

### 📌 Sticky Note 7 (Posición X: -128, Y: 640)

### Chunking
`chunkSize 1200 / overlap 250` (~20%).
The high overlap is deliberate: in dense technical text, a sentence split across two chunks is lost forever without overlap.

---
