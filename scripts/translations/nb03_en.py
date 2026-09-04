# -*- coding: utf-8 -*-
"""Traduccion al ingles de las celdas markdown del notebook 03.

Mapa {indice_de_celda: texto_markdown_en_ingles}. Los indices son los de
`nb["cells"]` en el .ipynb original (no cambian aunque el saneador toque el
texto). Solo se traducen celdas markdown; las de codigo y sus salidas se
sanean pero se sirven sin traducir, porque codigo Python/SQL no se traduce.

Generado a mano (revisado uno por uno contra el original) para
scripts/build_bilingual_full_notebooks.py.
"""

CELLS = {
    0: """# 🧪 ALCheMy — Interactive n8n Webhook Tester

This notebook has two goals:

1. **Test every case the ingestion pipeline handles**: one "happy path" per each of the 9 deterministic/microscopy techniques plus the 2 AI-driven (PDF) techniques, and every fallback (unauthorised email, oversized file, duplicate, missing sample_code, unrecognised technique, invalid extension, human L2 rejection, approval timeout, AI agent failure).
2. **Define the skeleton of a Python client** (`ALCheMyIngestionClient`) for the ingestion webhook — the basis of what a real public API would look like: today it talks HTTP directly to n8n, but the contract (`submit(file_path, technique, sample_code, ...)`) is the same one a future FastAPI (or other backend) wrapper would expose.

## ⚠️ Before running this

- `docker compose up -d` must be running (n8n, runners, PostgreSQL).
- The **ALCheMy** workflow must be **active** in n8n, and the `Webhook` node **enabled** — if you followed this session, it's already set (it was disabled by default before). If you ever disable it from the editor, this notebook will stop getting a response in `mode="prod"`.
- Reload (F5) your n8n tab before running this, so you don't carry a stale, out-of-sync version of the workflow.
- Install any missing dependencies: `pip install requests psycopg2-binary python-dotenv`.
""",
    2: """## 🧩 Ingestion client / API skeleton

`ALCheMyIngestionClient` wraps the multipart POST to the n8n webhook. It is deliberately
thin: a single public method (`submit`), with no business logic of its own (that lives in
the workflow). If a dedicated API is ever put in front of n8n (e.g. FastAPI for real
authentication, rate limiting, or upfront validation), the `submit(...)` contract is the
one that would be kept — only the internal transport would change.
""",
    5: """---
## ✅ Part 1 — Happy path by technique

One case for each of the 11 supported technique+route combinations: 6 "classic"
deterministic parsers, 3 microscopy parsers (SEM/FESEM/TEM, with the FESEM case
demonstrating the new optional instrument-metadata field), and 2 via the AI agent
over PDF (ICP-OES, EA).

Each cell expects HTTP 200 and `status: success`. If a real file gets renamed in the
data lake, adjust the path.
""",
    6: "### PXRD (.xrdml)",
    8: "### VT-XRD (.brml)",
    10: "### TGA (.txt)",
    12: "### FTIR (.csv)",
    14: "### Adsorption / BET (.xls)",
    16: "### UV-Vis (.asc)",
    18: """### SEM (.jpg + .txt Hitachi)

Upload the micrograph **and** its companion `.txt`. Between the three microscopy
cases, all three real metadata formats present in the data lake get covered:

| Case  | Sidecar format | Where the magnification comes from |
|-------|-----------------|--------------------------------------|
| SEM   | Hitachi INI (`[SemImageFile]`, `Key=Value`) | from the sidecar |
| FESEM | JEOL (`$CM_MAG`, `$$SM_WD`...) | from the sidecar |
| TEM   | no sidecar | from the file name (`_MAG_X3000_`) |
""",
    20: """### FESEM (.bmp, WITH attached metadata)

This is the case that demonstrates the new field: we upload the JEOL image (`.bmp`) **and**
its companion `.txt` together via `instrument_metadata_file`. The deterministic parser must
extract the real instrument (`JEOL 7900F`), magnification, voltage, and the operator's
cursor annotations.
""",
    22: """### TEM (.jpg, no sidecar — magnification in the file name)

TEM never comes with a `.txt`; the magnification is read from the file name itself
(`..._MAG_X3000_001.jpg`), not from a sidecar.
""",
    24: """### ICP-OES (.pdf, via AI agent)

This branch goes through the AI agent (Gemini) and the confidence evaluator. If the
declared confidence is >= 85% it inserts directly; if lower, it fires the L2 approval
email (see Part 2, human-rejection / timeout cases).
""",
    26: "### EA / CHNS (.pdf, via AI agent)",
    28: """---
## 🧯 Part 2 — Fallback cases

Every fallback writes to `audit_log` with a typed `verdict/cause/result`
(`workflows/error_payloads_matrix.csv`). The first 7 cases can be fully automated from
this notebook; the last 3 (human rejection, approval timeout, AI agent failure) depend
on a human interaction or a real timer and are documented rather than blindly executed —
faking them inside a notebook would give a false sense of coverage.
""",
    29: """### 1. Unauthorised email (whitelist)

`Auto-Enroll Whitelist` auto-registers any new email as active (demo self-enrolment) —
but it does **not** reactivate an email an admin has explicitly deactivated
(`ON CONFLICT ... DO UPDATE SET last_seen = ...` never touches `active`). So to test this
fallback, an email first has to be blocked by hand.
""",
    32: """### 2. Oversized file (> 10 MB)

We generate a synthetic filler file rather than relying on a real one over 10 MB
already existing in the data lake.
""",
    34: """### 3. Duplicate measurement

Resubmits the same PXRD file from the happy path (**run the PXRD cell from Part 1
first**, otherwise this case has nothing to be a duplicate of).
""",
    36: """### 4. Missing sample_code

No `sample_code` is sent, and the file name contains no recognisable pattern
(`RS\\d+`, `IEF-\\d+`, `RSMix\\d+`, `LP\\d+`).
""",
    38: "### 5. Unrecognised technique",
    40: """### 6. Invalid extension for a deterministic technique

`technique="PXRD"` is declared but an FTIR `.csv` is uploaded — the deterministic
router (technique+extension) has no rule that accepts this combination.
""",
    42: """### 7. Invalid extension for an AI-driven technique (PDF)

`technique="ICP-OES"` is declared but an `.xrdml` is uploaded instead of a `.pdf`.
""",
    44: """### 8. Human rejection at L2 approval (manual)

This can't be automated from here: it has to be triggered and then **Decline** clicked
in the approval email that arrives at `rubbenserrano@gmail.com` (or whoever is
configured as `researcher_email`).

1. Run the cell below to trigger an AI extraction.
2. If the agent's confidence comes back below 85%, an approval email arrives with
   **Approve** / **Disapprove** buttons.
3. Click **Disapprove**. The flow should log the cause `REJECTED_BY_RESEARCHER` in
   `audit_log` and not insert the measurement.
4. If the confidence comes back above 85%, there's no approval to reject — try again
   with another PDF, or temporarily lower `CONFIDENCE_THRESHOLD` in the
   `Confidence Evaluator` node just for this test.
""",
    46: """### 9. Approval timeout (manual, time-dependent)

Same trigger as the previous case, but this time **don't reply to the email**. After
5 minutes (`resumeAmount: 5` on the `Send message and wait for response` node), the
flow should automatically continue down the error branch, with cause
`APPROVAL_TIMEOUT_OR_ERROR`. We don't block a cell waiting for it — check `audit_log`
after the 5 minutes:

```sql
SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 5;
```
""",
    48: """### 10. AI agent failure (manual / with environment tampering)

To reliably force this fallback, the call to the model has to be deliberately broken,
for example:

1. In `.env`, set `GEMINI_API_KEY` to an invalid value (save the real one first).
2. `docker compose restart n8n`.
3. Run the cell below (any PDF or image works).
4. It should return HTTP 400 with cause `AI_AGENT_EXTRACTION_FAILED`, logged in
   `audit_log`.
5. Restore the real `GEMINI_API_KEY` and restart n8n again.

This isn't run automatically here because tampering with `.env` and restarting
containers from a notebook is more invasive than is sensible to automate unsupervised.
""",
    50: """---
## 🔎 Final check against `audit_log`

A quick query to review everything this notebook just produced, at a glance.
""",
    52: """---
## 🤖 Automated verification (all at once)

The cells above are for inspecting **one** specific case at a leisurely pace. To check
that **the whole** pipeline is still healthy, there's a script that fires all 9 happy
paths and the 7 automatable fallbacks at once, and additionally verifies that the row
landed in `characterization_measurements` with the metadata the parser was supposed to
extract (not just that HTTP returned 200):

```bash
python src/verify_webhook_pipeline.py                # everything
python src/verify_webhook_pipeline.py --happy        # happy paths only
python src/verify_webhook_pipeline.py --fallbacks    # fallbacks only
python src/verify_webhook_pipeline.py --only PXRD    # a single case
python src/verify_webhook_pipeline.py --table characterization_measurements  # force the canonical table
```

The cell below already passes `MEASUREMENTS_TABLE` (defined in the notebook's first
cell) to the script automatically — change that variable above to test against the
canonical table instead of the test one.

This exists because the pipeline has many independent failure surfaces (n8n's Python
sandbox, multipart binary handling, the technique+extension router, Postgres FKs), and
testing them one at a time by hand is exactly how the regressions crept in: a fix for
one technique would break or mask another without anyone noticing.
""",
    54: """---
## ⚠️ Limits of n8n's Python sandbox (learned the hard way)

Python **Code** nodes don't run in a normal Python, but in a sandbox that blocks things
without a clear warning. All of this is verified empirically against the real runner,
not assumed:

| What | Symptom | How to live with it |
|------|---------|----------------------|
| Plain `open` is forbidden | `name 'open' is not defined` | `import io; open = io.open` at the top of the node |
| `open(...)` in **text mode** (`'r'`) is broken | `'NoneType' object is not callable` | read in binary (`'rb'`) and `.decode(...)` by hand |
| `getattr` and `type` are forbidden | `name 'getattr' is not defined` | avoid them; use `try/except` and `str(e)` |
| Binaries arrive as a marker, not as data | `base64.b64decode` produces garbage | convert first with a `Move Binary Data` node (`keepAsBase64`) |

And one detail of the **Webhook node**, not the sandbox: it numbers *every* uploaded
file under the same prefix (`data_file0`, `data_file1`...), ignoring the form field's
name. That's why the metadata `.txt` arrives as `data_file1` and has to be renamed in
`Normalize Webhook Body`.

Maintenance note: the parsers live **twice** (in `src/parse_*.py` and pasted inside the
Code nodes). Keeping them in sync by hand is how the microscopy copy in n8n once fell
months behind, missing JEOL support. To sync:

```bash
python src/sync_parsers_to_n8n.py --dry-run   # see what has drifted
python src/sync_parsers_to_n8n.py             # push src/ -> n8n
```
""",
    55: """---
## 🧪 The AI branch (ICP / EA): what was verified, and why it stays HITL

This branch once managed to **insert fabricated chemistry** into the database, so it's
worth writing down what happened and how it was caught.

### The failure

For report `24AQ0245` (ICP of Fe, Ni and P) the agent returned this, with a
self-assigned **95% confidence**:

| Field | What the real PDF says | What the AI returned |
|-------|--------------------------|------------------------|
| Analyst | Lab Technician A | `John Doe` |
| Date | 17/06/2024 | `2023-10-26` |
| Elements | Fe, Ni, P | Ni, Fe, **Co, Mg, Ca** (no P) |
| Ni | 10.8 ± 0.5 | 25.12 |

None of that was in the document: it made all of it up from the file name and the
prompt.

### The cause

The PDF **never actually reached the model**. The agent node's `passthroughBinaryPdfs`
option only forwards a binary it recognises as a PDF, and the file was tagged
`application/octet-stream` (what a client sends when it doesn't know the extension).
With no document to read, the model answered with the only thing it had: the prompt.
`Normalize Webhook Body` now fixes the `mimeType` from the file's real extension.

### The important lesson

**The 85% threshold protected against nothing.** The AI itself declares its own
confidence, so when it hallucinates, the confidence hallucinates too: it gave 95% on
data it had invented. A safeguard fed by the very system it's meant to distrust is not
a safeguard. The only thing that caught the problem was comparing the output against
the real PDF.

### Current state

Extraction now works correctly: for that same report it now returns `Lab Technician A`,
`CENTRAL RESEARCH LABORATORIES`, and `Ni 10.8 ± 0.5` / `P 21.4 ± 1.1`, matching the
document exactly.

Even so, **autonomous insertion (L4) stays deliberately disabled**: both outputs of
`If - Needs Human Approval?` go to the approval email, so no PDF enters the database
without a person seeing it. Re-enabling it requires verifying the extraction against
several real reports (only one has been checked so far; the second was left unchecked
because the free Gemini quota ran out) and reconnecting the `If` node's FALSE output to
`DB Update`.

### A modelling limitation worth keeping in mind

A single PDF can carry **several samples** (the ICP one carries `RS1107` and `RS1419`),
but the row that gets inserted is filed under the single `sample_code` that came with
the request. It will need to be decided whether such reports get split into one row
per sample.
""",
    56: """---
## ⛔ Why 5 cases can't be verified right now

`SEM`, `FESEM`, `TEM`, `ICP-OES` and `EA` go through a Gemini agent, and the account is
out of credit:

```
HTTP 429 - "Your prepayment credits are depleted.
            Please go to AI Studio to manage your project and billing."
```

This **doesn't fix itself by waiting**. It's worth telling apart the three different
429s that have shown up, because they look alike but don't mean the same thing:

| Message | What it is | Does it clear on its own? |
|---------|------------|------------------------------|
| `The service is receiving too many requests from you` | per-minute rate limit | yes, within seconds |
| `You exceeded your current quota` | plan limit | depends on the plan |
| `Your prepayment credits are depleted` | **credit exhausted** | **no — needs a top-up** |

What was verified on those 5 cases before the credit ran out:

- **SEM / FESEM / TEM**: all three passed end to end (a database row with the correct
  Hitachi, JEOL and file-name metadata), across three consecutive runs. Their
  deterministic part is proven; what can't be run right now is the image's qualitative
  description.
- **ICP-OES**: verified against the real PDF once, with an exact match.
- **EA**: the only one that **was never actually checked** with the `mimeType` fix
  already in place. It's the first one to look at once credit is topped up.

### Once credit is topped up

```bash
python src/verify_webhook_pipeline.py          # all 18 cases, no excuses
```

And if the reports come back faithful to the document across several tests, the
**FALSE** output of `If - Needs Human Approval?` can be reconnected to `DB Update` to
restore autonomous insertion (L4). Until then, it stays disconnected on purpose.
""",
}
