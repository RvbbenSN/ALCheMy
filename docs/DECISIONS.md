# Decision log

Every project has a tidy story it tells afterwards. This is the other one: the
decisions that were actually taken, what was given up for each, and the ones
that turned out to be wrong.

It is kept because the decisions are the work. The code that came out of them is
the easy part to read; *why* the code does that and not the obvious alternative
is the part that disappears if nobody writes it down.

---

## 1. One database, not a folder of spreadsheets

**Decision.** Five years of handwritten laboratory notebooks, one master Excel
file and roughly 6,000 raw instrument files go into a single governed PostgreSQL
schema.

**Why.** A spreadsheet cannot say what a column means, cannot refuse an
impossible row, and cannot be written by two processes at once. All three
mattered here: a header reading `T` is ambiguous, a measurement without its
synthesis is meaningless, and two independent lanes write to this database — a
notebook that ingests the Excel file, and an automated workflow that ingests
instrument files.

**The price.** Everything has to be modelled before it can be stored, which is
slow, and the schema has to be migrated rather than edited.

---

## 2. The parser contract

**Decision.** Every instrument parser — nine formats, from XML diffractograms to
Bruker ZIP containers to microscope JPEGs — returns the **same dictionary shape**,
with `data_json` always split into `header_metadata` and `raw_data`.

**Why.** Without a shared contract, "one row per technique" means nine
incompatible schemas, and no query can span techniques. With it, the JSONB column
and a GIN index let an AI agent ask the same question of any technique without
knowing anything about the instrument that produced it.

**The price.** The contract is load-bearing: changing it means changing every
parser at once. The specification is therefore written down first and the
parsers follow it, not the other way round.

---

## 3. The load is an UPSERT, never a replace

**Decision.** The synthesis notebook loads with `ON CONFLICT (sample_code) DO
UPDATE` and never issues a `DELETE`.

**Why.** This is a governance decision disguised as a convenience one. The same
table is written by the notebook and by the automated ingestion workflow. A
delete-and-reinsert would silently destroy every row the workflow had written
since the last run — and it would look like it worked.

---

## 4. Only combinatorial syntheses train the model

**Decision.** The model is trained on high-throughput screening runs alone,
discarding standard solvothermal and microwave syntheses.

**Why.** The record holds three ways of making a material, and an earlier version
of the analysis mixed them. Microwave synthesis had produced **zero amorphous
samples** — so a model could detect "this was a microwave run" and answer
CRYSTALLINE with 96 % accuracy, learning nothing about chemistry. The cause is
selection bias, not physics: combinatorial screening is exploratory and full of
failures, while the other two are used once you already know the recipe works.
The variable *synthesis type* largely encodes *did you already know this would
work*.

**The price, stated rather than hidden.** 90 of 330 crystalline cases are lost —
27 % — and the minority class becomes scarcer still. The reported macro F1 falls
from 0.62 to 0.52.

**Why it was worth it.** The drop *is* the result. Quantifying how much of the
earlier score came from recognising the method rather than the chemistry is the
most useful output of that stage.

---

## 5. The reported number is the lower, honest one

**Decision.** The headline figure is **macro F1 0.517**, cross-validated with
plates as groups, against a trivial baseline of 0.260.

**Why grouped by plate.** High-throughput synthesis runs in plates of 24 wells:
one block, one oven, one thermal programme. Samples in a plate share a reactor, a
day, a solvent bottle and an operator. A random split lets the model score well
by recognising the plate instead of the chemistry — so every plate stays entirely
inside one fold.

**What that costs.** A random split would report a higher number for a model that
had learned less.

---

## 6. The limit is the experimental record, not the algorithm

**Finding, not a decision.** Across five years the record contains 15 distinct
target temperatures and 11 reaction times; the subset the model trained on has
**nine temperatures and three reaction times**. They were also varied in a manner
confounded with chemistry — each campaign swept one factor within one
metal-linker system.

**Consequence.** A supervised model cannot estimate the effect of a variable that
was held nearly constant, nor separate an effect from a factor it always
co-occurred with. Hyperparameter tuning on this dataset is worth perhaps 0.02–0.05
in macro F1. It is not a route to a materially better model.

**What would be.** One designed sweep of temperature, time and modulator at fine
resolution *within a single metal-linker system* — one or two plates. That is the
useful output: a negative result converted into a specific experiment.

---

## 7. Excluded variables are recorded, with their reason

**Decision.** The model registry stores not only which columns went in, but which
were left out and why, under a `CHECK` constraint that refuses to mark a model
irreproducible without a written reason.

**Why.** Four columns are excluded from the current model: one is undefined for
lanthanides, one is constant in this subset, one is a perfect rescaling of
another, and one became constant once the confounder was resolved by filtering.
Each of those is a decision. Recording only the survivors turns a decision into
something somebody once did.

---

## 8. A model is not a file

**Decision.** Trained models live in the database across five related tables —
dataset snapshot with the literal query and its hash, the recipe, the features
kept and excluded, the metrics in long format, and the binary — and the running
service asks the database *which model occupies the deployment slot*.

**Why the slot.** This was learned the hard way. The simulator once had a model
name written into it by hand. A new model was trained to correct a unit error of
a factor of a thousand, and **the site went on serving the old one without
anything raising an error**. An obsolete model does not fail; it answers.

---

## 9. Contextual retrieval: built, measured, not promoted

**Decision.** The published contextual-retrieval technique is implemented end to
end — 87,765 context sentences, one per passage, and a full re-embedding — and
**deliberately not switched on** as the default search.

**Why not.** Because it was measured. Compared live against the original
embeddings on real questions, similarities came out 0.005–0.01 higher and only
one or two of every four retrieved passages changed. Nothing like the improvement
the technique reports elsewhere.

**The explanation is the corpus, not the method.** The published measurements
come from material whose fragments lean heavily on their surroundings. A
chemistry paper is written in paragraphs that already name their own compound and
their own conditions — there was less missing context to restore.

**What still stands in the way.** The contextual embedding column has no index.
The work is done; the plumbing is not.

---

## 10. The reranker is wired and switched off

**Decision.** The reranking node sits in the workflow, connected, disabled.

**Why.** The only reranker available in this stack is an external service. Using
it would mean sending the text of retrieved passages — internal laboratory
notebooks included — to a third party. It is left visible rather than deleted
because the decision is part of the design.

---

## 11. The agent never writes SQL

**Decision.** Each of the assistant's nine tools is a call to a stored function
with typed parameters.

**Why.** What the agent can ask is then bounded by the schema rather than by how
carefully a prompt was worded. The two graph tools are deliberately split —
resolve the node id first, explore second — so that a wrong guess **fails loudly
instead of returning a confident answer about a sample that does not exist**.

---

## 12. Backups are event-driven, never scheduled

**Decision.** The database is checkpointed before a migration or a mass delete,
and after a bulk ingestion or a labelling session. There is no cron job, and that
is deliberate.

**Why.** A timer firing against an idle database burns disk; the moments that
matter are known in advance. And the first step of a checkpoint is not the dump —
it is reporting the row counts, because a backup of a database that a migration
has already broken is not a rescue.

**What it protects.** Most of this database is reproducible: run the pipelines
again and the descriptors, the measurements and the embeddings come back. The
human crystallinity labels do not. They are expert judgement that exists in no
file.

---

## Three that were wrong

Kept because a decision log that only records the good calls is advertising.

### The volume units

Dilute stock solutions in the master spreadsheet were assumed to be recorded in
microlitres. They were in millilitres. The error was a **factor of a thousand**,
and its most visible symptom was an 18 % gap in the solvent record that looked
like missing data and was actually arithmetic that did not close. After the fix,
the medium breakdown goes from complete in 81.7 % of combinatorial syntheses to
99.8 %, and the crystallinity model was retrained from scratch.

The lesson that generalises: the defect was found by reading the values
**chemically**, not statistically. Nobody flags 54 grams of formic acid in a
2.5 mL reactor except someone who has weighed formic acid.

### The phantom samples

The microscope names each image `<sample code><four-digit counter>(<magnification>)`
with no separator. The regex that recovers the sample code was greedy, so it
swallowed the counter and returned codes that do not exist. The ingestion, which
sensibly creates a placeholder row rather than blocking on a missing sample,
turned that into a factory: **988 invented samples**, and 1,009 micrographs
detached from the 297 real samples they belong to.

Two lessons. A greedy quantifier against an instrument's file name is a bug
waiting for the day the instrument appends something of its own. And a
fault-tolerance mechanism amplifies whatever bad data reaches it — the placeholder
rule was right; what failed was upstream.

It was caught because the synthesis count stopped matching the laboratory. A
number that contradicts what you know about the physical world is a signal.

### The stale knowledge graph

The graph builder only ever upserts, never deletes. So after the phantom samples
were removed from the database, the graph still held 998 sample nodes that no
longer existed — and the largest hub in it was `UNKNOWN`. Published figures were
inflated by a third. Found by drawing the thing rather than describing it.
