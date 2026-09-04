# Project log

A condensed timeline. The full working diary is not published — it runs to some
3,700 lines and contains real sample codes, unpublished ligand names and a great
deal that only matters to whoever was at the keyboard. What follows is what
happened, in order, for someone who wants to know how the thing was built rather
than how to rebuild it.

Dates are when the work landed, not when it was planned.

---

## Phase 1 — Getting the laboratory into a database

**The starting point.** Five years of handwritten notebooks, one master Excel
file with arbitrary headers, and about 6,000 raw instrument files sitting in
folders. Nothing joined to anything.

The synthesis lane came first: header normalisation through an explicit mapping
dictionary, stoichiometric feature engineering (microlitres of stock solution
into millimoles of *active* species), thermal ramps parsed out of free prose, and
an MD5 business key over six fields so the same experiment described twice
collapses to one identity.

The characterisation lane needed nine parsers for nine instrument formats. The
decision that made the rest possible was forcing them all to return the same
dictionary shape — see the decision log.

## Phase 2 — Orchestration, and the governance that came with it

The ingestion moved into an n8n workflow with three entry lanes (webhook, folder
watcher, upload form) converging on one normalised shape. Deterministic parsers
for the six techniques that have a defined format; an AI branch for the PDFs
that arrive from external services; a whitelist gate before anything is written;
and every automated action logged with a typed verdict and cause.

Along the way, the kind of failure that only production produces: a workflow that
"already worked" kept failing live because the MD5 was fingerprinting the wrong
bytes, and a vision agent that had been happily describing micrographs turned out
never to have received an actual image.

## Phase 3 — The signal: from diffractograms to numbers

The longest single stretch of the project, and the most revised. Turning 1,877
diffractograms into a fixed vector of 29 comparable numbers meant deciding, and
defending, a series of things that look like details and are not:

- **Where to cut the scan.** A 5° cut-off, argued from what a low-angle
  reflection means in real space rather than from what looks tidy.
- **What "amorphous" means numerically.** Three successive versions. The one that
  survived measures the amorphous halo against an **instrument blank** rather
  than against a fitted baseline — because the baseline fit was quietly claiming
  99.5 % of the pattern area.
- **When a peak is a peak.** A Poisson-noise threshold calibrated against the
  blank, not a fixed multiple of sigma. Under the naive threshold, nearly half of
  the visually amorphous samples were credited with three or more false peaks.
- **A spectral entropy that was not broken.** Its scale was. That took a session
  to establish and one line to fix.

Two internal tools came out of this phase: a labelling app used to produce the
ground truth by hand, and an explorer for auditing what the pipeline does to any
individual pattern.

## Phase 4 — Machine learning, and what it could honestly claim

Chemical reference tables first: metals replaced by their physical properties
rather than one-hot encoded, linkers described by molecular descriptors, every
value traceable to a citation. Then the modelling, which produced more findings
about the *data* than about the algorithms — the confounder, seven data defects
found by chemical reading, and the conclusion that the ceiling is the
experimental design.

The volume-unit error surfaced here and forced a full retrain. The decision log
covers both.

## Phase 5 — Retrieval over the literature

956 papers out of a reference manager and into pgvector, with cataloguing and
vectorising kept as two separate steps so that one can be redone without the
other. Three retrievers rather than one — dense, full-text, and their fusion —
because a vector search alone cannot find a sample code, which is exactly what
people ask for.

Then the contextual-retrieval work: implemented completely, measured honestly,
and left switched off. Also in this phase: identity-based access control, so the
same question returns coarse or exact detail depending on who is asking, and a
local model wired as a real fallback for the cloud one — verified by forcing the
cloud model to fail.

A knowledge graph was added last, in PostgreSQL rather than a separate graph
database, so that relational questions ("what do these two samples have in
common") stop being three searches.

## Phase 6 — The public face

A nine-screen web application following the CRISP-DM arc, built to be read rather
than clicked through. Two n8n workflows rendered as navigable maps from their own
exports. An in-silico simulator serving precomputed predictions from the deployed
model. And a rule applied throughout: every figure the site publishes is
generated from the live database at build time, never typed in — because a number
written by hand in a web page is a number that will be wrong after the next
migration.

## Housekeeping, September 2026

The repository was reorganised before publication: all working material into a
single ignored folder, the SQL split into a generated master schema and a dated
migration history, and two checkers added — one that says whether the project
still stands after moving things, and one that refuses to call the tree
publishable while it still contains a real email, a sample code or an unpublished
ligand name. The second one found four genuine leaks on its first run.
