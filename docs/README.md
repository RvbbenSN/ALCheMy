# `docs/` — the public documentation

Everything in this folder can be read by anyone. It carries no laboratory data,
no unpublished ligand names and no real synthesis conditions.

The working material — the full diary, the roadmaps, the design system, the raw
notebooks — is deliberately **not** here. It lives in `_lab/`, which is ignored by
git. The rule is one line: *if it is in `_lab/`, it is not published.*

## What is here

| Document | What it is |
|---|---|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | What the system is made of and why each piece is where it is. Start here. |
| [`DECISIONS.md`](./DECISIONS.md) | The decisions that were actually taken, what each cost, and the three that were wrong. |
| [`PROJECT_LOG.md`](./PROJECT_LOG.md) | A condensed timeline, phase by phase. |
| [`KEY_CONCEPTS.md`](./KEY_CONCEPTS.md) | Three ideas that come up repeatedly: what a classifier's percentage means, a frozen prediction grid versus a live model, and an unvarnished reading of how good the model is. |
| [`DEPLOY.md`](./DEPLOY.md) | How to publish the site and the repository. |

## The notebooks

The seven notebooks are the reasoning trail of the project, and they are
published — as **static, read-only HTML** under `web/public/notebooks/`, linked
from the screen each one belongs to. Two versions of each: the full notebook with
its code, outputs and figures, and a reading version with the narrative alone, in
English and Spanish.

The `.ipynb` files themselves are not in this repository. A notebook stores what
every cell printed, and those outputs contain real sample codes and unpublished
ligand names — which is exactly why the publishing pipeline exists. It
pseudonymises sample identifiers and ligand names, strips local paths and emails,
and **never re-executes anything**: several notebooks write to PostgreSQL, so
re-running them to produce a clean copy would risk duplicating rows.

What it cannot sanitise is the figures. A chart title is pixels, and no regular
expression reaches it — so those are redacted by hand, and the pipeline says so
rather than implying the problem is solved.

## Two checkers

```bash
python scripts/verificar_proyecto.py      # does the project still stand?
python scripts/comprobar_privacidad.py    # is it safe to publish?
```

The first inspects what Docker mounts, validates the compose file, queries the
database, compiles every Python file and builds the site. It is meant to be run
**before and after** moving anything: what matters is not that everything is
green, but that it is the *same* green.

The second refuses to call the tree publishable while any file that would be
published contains a real email address, a sample code, an unpublished ligand
name or a private IP. Its exceptions — the sanitisers and parsers, which have to
name what they recognise — are listed in plain sight so each one can be argued
with.
