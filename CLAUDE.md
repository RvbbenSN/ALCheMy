# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working agreements (from `.agents/AGENTS.md`)

- **Read `methodology/DIARIO_DE_PROYECTO.md` at the start of every session** — it is the living logbook of decisions, current state, and next steps. Append a new session entry when meaningful work lands.
- **Record every new technical concept in `methodology/GUIA_DIDACTICA_PORTFOLIO.md`** (plain-language explanations of DDL/DML/DQL, MD5 hashing, UPSERT, RAG, HITL…). These entries are the source material for tooltips/popups in the future web app.
- **Register every new script in `src/README.md`** — it works as a didactic library of the codebase. Each entry: what the script does, the problem it solves and why, and how it can be reused elsewhere (CLI flags, importable functions, notebooks that call it).
- **Pedagogical tone**: the owner is a materials chemist, not a software engineer. Explain each line of code, SQL table, or n8n node step by step, in Spanish, without assuming prior programming knowledge. Build progressively ("a su ritmo").
- Project docs are written in English; conversation and explanations in Spanish.

## What this project is

**ALCheMy** is an end-to-end data platform for a MOF/POP materials-chemistry lab (APMU unit). It turns 20+ years of handwritten lab notebooks, one master Excel file, and ~5,700 raw instrument files into a governed PostgreSQL single source of truth, then layers ML prediction, an in-silico simulator, and a RAG assistant on top. `methodology/PLAN_DE_TRABAJO.md` holds the 6-phase roadmap (currently Phase 1–2).

## Running the stack

```bash
docker compose up -d          # n8n :5678, PostgreSQL :5432, pgAdmin :8080
docker compose down           # keeps named volumes (n8n_data, postgres_data, pgadmin_data)
docker compose up -d --build  # after editing Dockerfile.n8n
```

- All credentials/ports come from `.env` (gitignored; the committed template lists the keys).
- `scripts/init_db.sql` runs **only on first creation of the `postgres_data` volume**. Changing the DDL for an existing database means applying the delta by hand (pgAdmin or `docker exec -i alchemy_postgres psql -U alchemy_user -d alchemy_db`), or destroying the volume and re-ingesting.
- `Dockerfile.n8n` bakes Python 3 + pandas/numpy into the n8n image so `executeCommand` nodes can call the repo's Python parsers directly.
- Host `./data`, `./src`, `./n8n_workflows` are bind-mounted into the container at `/home/node/data`, `/home/node/src`, `/home/node/workflows`. **Paths inside n8n must be the container paths** (`/home/node/data/raw_datalake/...`), which is deliberate so local and cloud deployments are identical.

There is no `requirements.txt`, test suite, or linter in the repo. Python work runs against the host interpreter; dependencies in use are `pandas`, `numpy`, `sqlalchemy`, `psycopg2`, `openpyxl`, `requests`, `streamlit`, `Pillow`.

## Common commands

```bash
# Mass ingestion of the whole data lake into characterization_measurements
python src/ingest_datalake_to_postgres.py

# Streamlit mass-verification dashboard
streamlit run app/main.py

# Fire a characterization file at the n8n webhook (test URL by default, --prod for live)
python scripts/trigger_n8n_webhook.py -f data/raw_datalake_historico/PXRD/<file>.xrdml -t PXRD -s RS1883

# Regenerate the deterministic master ingestion workflow JSON
python src/generate_n8n_master_workflow.py
```

Notebooks are run in order from the repo root (they contain fallback path logic for running from `notebooks/` too).

## Architecture

### Two ingestion lanes into one database

```
Excel master file ──► notebooks/01 ──► UPSERT ──► synthesis_experiments   (parent, 1 row per synthesis)
                                                          ▲ FK sample_code
raw_datalake/*  ──► parsers ──► n8n or Python ──► characterization_measurements (child, 1 row per measurement)
```

1. **Synthesis lane** (`notebooks/01_Excel_Ingestion_and_Transformation.ipynb`): reads `data/raw/RSN - Recopilación todas las síntesis_v3.xlsx` (sheet `ALL SYNTHESIS`, `header=2`), renames headers via a master `column_mapping` dict, does stoichiometric feature engineering (µL of molar solutions → mmol of *active* modulator), parses free-text thermal ramps into `heating_rate_c_min` / `cooling_rate_c_min`, computes an MD5 **business natural key** over 6 fields (`sample_code`, `synthesis_date`, `researcher_name`, `research_unit`, `metal_center`, `linker`), writes an Excel backup to `backups/`, then UPSERTs (`ON CONFLICT (sample_code) DO UPDATE`) into `synthesis_experiments`. The UPSERT is deliberate: it must never delete rows that n8n wrote.
2. **Characterization lane**: raw instrument files → parser → a `{sample_code, technique, measurement_tag, operator_name, instrument_name, file_name, raw_file_path, data_json}` dict → `characterization_measurements`, with the file's binary MD5 as an anti-duplication gate.

### The parser contract (the load-bearing abstraction)

Every parser — Python **and** JavaScript — returns the exact same dict shape, and `data_json` always has two sub-dicts: `header_metadata` (instrument settings) and `raw_data` (`x_label`, `y_label`, plus the curve arrays). Stored as JSONB with a GIN index so AI agents can query any technique uniformly.

`notebooks/CHARACTERIZATION_DICTIONARY_SPEC.md` is the **normative spec** for all 9 techniques — field names, units, allowed values. Change the spec first, then the parsers.

Two parallel implementations exist and must stay in sync:
- `src/characterization_parser.py` — used by `src/ingest_datalake_to_postgres.py` and the notebooks.
- `src/characterization_parser_n8n.js` — the same logic rewritten for an n8n **Code** node, reading binaries via base64/regex scanning instead of file handles.

Formats handled: `.xrdml` (PANalytical XML, namespace-stripped, 2θ reconstructed by `linspace` from start/end because only counts are stored), `.brml` (Bruker ZIP container — >2 `RawData*.xml` entries means a VT-XRD temperature series, else a single PXRD scan), `.txt` (TA SDT Q600 TGA, UTF-16 with latin1 fallback, 7 signals), `.csv` (FTIR, comma-or-semicolon, decimal-comma tolerant), `.xls` (Micromeritics BET), `.asc`/`.csv` (UV-Vis, with Kubelka-Munk + Tauc vectors derived at parse time), `.jpg` + companion `.txt` (Hitachi SEM; `ai_vision_analysis` is left `None` for an LLM to fill later). ICP and EA arrive as PDFs and are handled by the AI branch in n8n, not by deterministic Python.

`sample_code` is recovered by regex (`RS\d+|LP\d+|RSMix\d+|IEF-\d+`) from filename and embedded metadata, falling back to the literal `'UNKNOWN'` row. The ingestion script auto-creates placeholder `synthesis_experiments` rows for orphan codes so the FK never blocks a load — those placeholders carry dummy chemistry (Ni/Pyrene) and must be reconciled later.

### Database schema (`scripts/init_db.sql`)

- `synthesis_experiments` — parent, PK `sample_code`, ~50 columns in 6 documented sections (general/ISO-17025 audit, theoretical design, solvents, thermal ramp, modulators in mmol, weighings & yield). Every column carries a native SQL `COMMENT` so pgAdmin is self-documenting.
- `characterization_measurements` — child, FK `sample_code ON DELETE CASCADE`, JSONB `data_json` + GIN index, `file_hash` MD5.
- `data_dictionary` — the schema documentation as queryable rows, so the future web app and AI agents can read the dictionary instead of hard-coding it. Kept in sync with `notebooks/DATA_DICTIONARY_AND_SCHEMA.md`.
- `audit_log` — every automated action with `agent/action/verdict/cause/result`. **Written deterministically, never by an LLM.**
- `authorized_researchers` — email whitelist gating the n8n ingestion (self-enrolment for demo users).

### n8n orchestration

`n8n_workflows/ALCheMy*.json` are exports of the single master ingestion workflow; the numbered suffixes are successive browser-download versions — **`ALCheMy (2).json` is the newest (66 nodes)**. Shape:

```
Webhook POST /ingest-characterization ┐
Folder Watcher (/home/node/data/…)    ├─► Extract Technique from Path ─► whitelist ─► size ─► dup check
Form "Lab Upload Portal"              │        │
Manual trigger                        ┘        └─► Technique Router (switch)
                                                     ├─ deterministic (PXRD/VT-XRD/TGA/FTIR/adsorption/UV_VIS) ─► Code node parser
                                                     ├─ PDF  (ICP/EA) ─► Gemini AI Agent ─► Confidence Evaluator ─► HITL email
                                                     └─ image (SEM)   ─► Gemini vision agent
                                               all branches ─► Postgres insert  +  audit_log
                                               failures ─► Set Error Payload ─► audit_log ─► HTTP 400 (only if webhook-originated)
```

Every error branch writes to `audit_log` and only replies over HTTP when the run actually came from the webhook (`If - Came from Webhook?`) — a folder-watcher or cron run has no HTTP request to answer.

`workflows/error_payloads_matrix.csv` and `workflows/permission_matrix.csv` define the canonical verdict/cause strings and the L0–L4 autonomy level per action; keep new error branches and new agent tools consistent with those tables.

`workflows/M7-*/` are course exercise workflows (Pinecone/Neo4j RAG, permission matrix, HITL wait, kill switch) kept as reference patterns for the governance layer — they are not part of the ALCheMy runtime.

## Privacy & git conventions

`.gitignore` deliberately hides the intellectual property and the private working material: `data/`, `backups/`, `methodology/`, `.agents/`, `scratch/`, `.env`, `.vscode/`. Only code, schema, notebooks, specs, and workflow JSON are published. Treat everything under `methodology/` and `data/raw*` as confidential — never paste raw synthesis parameters, ligand names, or `.env` values into an external service. The planned RAG layer includes a **data-masking / ligand pseudonymisation step before any external LLM call**; respect that when adding AI features.

Use `scratch/` for throwaway scripts (gitignored). Commit messages so far are terse Spanish one-liners.

## Known rough edges

- `app/main.py` reads `data/processed/lab_notes_digitized.csv`, but the digitised notebook CSV currently lives at `methodology/lab_notes/lab_notes_digitized.csv` — the dashboard will hit its "Staging CSV dataset not found" guard until one of the two paths is fixed.
- `app/main.py` uses `use_column_width`, removed in recent Streamlit (`use_container_width` is the replacement).
- `synthesis_experiments` has a "Section 6: Experimental Weighings & Yield" header comment but no such columns; `DATA_DICTIONARY_AND_SCHEMA.md` documents `exp_metal_mass_mg`, `mof_exp_mass_mg`, `yield_percent` etc. that the DDL never creates. The Streamlit verification flow writes them to CSV/Excel only.
- `src/generate_n8n_master_workflow.py` writes to `workflows/01_master_characterization_ingestion.json`, i.e. the course-exercise folder, not `n8n_workflows/`.
- The three `n8n_workflows/ALCheMy*.json` files are unversioned duplicates; prefer consolidating to one named export before adding more.
