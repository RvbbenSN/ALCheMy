# 🧪 ALCheMy

> **A governed data platform for a working materials-chemistry laboratory (MOFs / POPs).**
> From five years of handwritten lab notebooks, one master spreadsheet and ~6,000 raw
> instrument files, to a single source of truth in PostgreSQL — with traceability,
> auditing and human validation intact.

---

## The problem

A materials-synthesis laboratory generates data that **looks nothing like a company's**:

- Every instrument writes its own **proprietary format**: PANalytical XML, Bruker ZIP
  containers, UTF-16 text from a thermobalance, CSV with a decimal comma.
- The knowledge of *what worked* lives in **handwritten notebooks** and in the
  researcher's head.
- The data is **expensive and unrepeatable**: nobody re-runs a measurement because a
  file was lost.
- And in research, **a datum without provenance is worth nothing**: if you cannot get
  back to the original instrument file, you cannot defend the result.

ALCheMy turns that scattered archive into a queryable database without losing a byte
of traceability on the way.

---

## How it is organised

Two halves, and one rule: **if it is in `_lab/`, it is not published.**

```
ALCheMy/
│
├── _lab/                  PRIVATE — all working material
│   ├── notebooks/           the raw .ipynb (they contain real codes and ligands)
│   ├── methodology/         diary, roadmaps, reviews, thesis
│   ├── design_system/       the site's design: style guide, icons, assets
│   ├── handoff/             material sent out for review, already sanitised
│   ├── scratch/             drafts
│   └── backups/             database dumps
│
├── data/                  PRIVATE — the data lake. Not inside _lab/ because
│                          docker-compose mounts it as ./data in three
│                          containers; moving it means touching the stack.
│
├── src/                   parsers, ingestion, RAG, model registry
├── scripts/               tooling and generators
│   └── sql/               init_db.sql · schema.sql (generated) · migrations/
├── app/                   the two Streamlit laboratory tools
├── web/                   the web application (React + Vite)
├── docs/                  public documentation
├── n8n_workflows/         exported workflows
├── docker/                the two Dockerfiles and the runner configuration
└── docker-compose.yml     the stack's entry point
```

### What must not move

`docker-compose.yml` mounts four host paths into the containers. Moving any of them
without updating the compose file leaves the stack unable to start:

| Path | Where it lands |
|---|---|
| `./data` | `/home/node/data` in n8n and the runners |
| `./src` | `/home/node/src` in n8n |
| `./n8n_workflows` | `/home/node/workflows` in n8n |
| `./scripts/sql/init_db.sql` | PostgreSQL's bootstrap |

### Two checkers, before touching anything and before publishing

```bash
python scripts/verificar_proyecto.py      # does the project still stand?
python scripts/comprobar_privacidad.py    # is it safe to publish?
```

The first inspects what Docker mounts, validates the compose file, queries the
database, compiles every Python file and builds the site. Run it **before and after**
moving things: what matters is not that everything is green, but that it is the *same*
green.

The second refuses to call the tree publishable while any file that would be published
contains a real email address, a sample code, an unpublished ligand name or a private
IP. On its first run it found four genuine leaks.

---

## What works today

> This block describes **only what is implemented and verified**. What is planned is
> further down and clearly separated.

| Component | Status |
|---|---|
| Docker Compose stack (n8n + PostgreSQL/pgvector + pgAdmin + runner sidecar) | ✅ running |
| Governed relational schema with native SQL comments | ✅ `scripts/sql/init_db.sql` |
| Deterministic parsers for the instrument formats | ✅ `src/parse_*.py` |
| Ingestion workflow with several entry points, duplicate control and governance | ✅ `n8n_workflows/` |
| Real Python (pandas/numpy) executed from n8n through an external task runner | ✅ verified end to end |
| Append-only audit log with typed verdicts | ✅ `audit_log` |
| AI extraction branch with human-in-the-loop below a confidence threshold | ✅ PDFs and microscopy |
| 29 crystallographic descriptors derived from every diffractogram | ✅ notebook 05 |
| Crystallinity model, registered with its full lineage | ✅ macro F1 0.517 against a 0.260 baseline |
| Literature corpus: 958 documents, 87,765 passages, vectorised | ✅ pgvector |
| Knowledge graph in PostgreSQL | ✅ 4,583 nodes, 8,060 edges |
| Nine-screen web application | ✅ `web/` |

---

## The data contract

Every parser — nine instrument formats — returns the **same dictionary shape**, with
`data_json` always split into `header_metadata` and `raw_data`. Stored as JSONB with a
GIN index, so one query can span every technique without knowing anything about the
instrument that produced it.

That contract is load-bearing: without it, "one row per technique" means nine
incompatible schemas. The specification is written first and the parsers follow it.

## Data governance

- Every column carries a native `COMMENT`, and those comments are also exposed as rows
  in a dictionary table — so the application and the AI agent read the documentation
  *from the database* rather than carrying a copy that can drift.
- Every automated action lands in `audit_log` with a typed verdict and cause. **Written
  deterministically, never by an LLM** — a log an AI can edit is not a log.
- The synthesis load is an `UPSERT` and never a `DELETE`, because two independent lanes
  write to the same table.
- Backups are **event-driven, never scheduled**: before a migration or a mass delete,
  after a bulk ingestion or a labelling session.

## Notable engineering decisions

The full log, including three that were wrong, is in
[`docs/DECISIONS.md`](docs/DECISIONS.md). In short:

- **Only combinatorial syntheses train the model**, because mixing methods let it detect
  the method instead of the chemistry — and the honest score is a full 0.10 of macro F1
  lower than the flattering one.
- **A model is not a file.** It lives across five tables, and what is running is decided
  by a deployment slot the service queries. That was learned by shipping predictions
  from a superseded model for days without a single error being raised.
- **Contextual retrieval is built and switched off**, because it was measured and the
  gain on this corpus was small. The measurement is published.
- **The agent never writes SQL.** Its nine tools are stored functions with typed
  parameters, so its reach is bounded by the schema rather than by prompt wording.

## Not built yet

- A backend serving the live model — today the site serves a precomputed prediction grid.
- The public chat interface for the assistant.
- Automated one-page datasheets per sample.

---

## Stack

PostgreSQL 16 + pgvector · n8n · Docker Compose · Python (pandas, numpy, scipy,
scikit-learn, LightGBM, XGBoost, RDKit, pymatgen, mendeleev) · React + Vite ·
Streamlit · Ollama.

## Getting started

```bash
docker compose up -d          # n8n :5678, PostgreSQL :5432, pgAdmin :8080
python src/ingest_datalake_to_postgres.py    # bulk-load the data lake
python scripts/backup_database.py            # checkpoint around bulk writes
cd web && npm install && npm run dev         # the web application
```

Credentials and ports come from `.env` (not committed).

## Privacy

`.gitignore` deliberately hides the intellectual property and the private working
material. Only code, schema, specifications and workflow exports are published.

Sample identifiers and unpublished ligand names are pseudonymised everywhere they
appear publicly — in the rendered notebooks, in the figures, in the generated schema
dump and on the site. What cannot be sanitised automatically is a chart title, because
that is pixels: those are redacted by hand, and the pipeline says so rather than
implying the problem is solved.

## Documentation

| Document | What it is |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | What the system is made of and why. Start here. |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | The decisions actually taken, what each cost, and three that were wrong. |
| [`docs/PROJECT_LOG.md`](docs/PROJECT_LOG.md) | A condensed timeline, phase by phase. |
| [`docs/KEY_CONCEPTS.md`](docs/KEY_CONCEPTS.md) | What a classifier's percentage means, frozen grid vs live model, and an honest reading of the model. |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | How to publish the site and the repository. |
