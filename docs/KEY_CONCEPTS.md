# Key concepts

Three ideas that come up repeatedly, each explained on its own, in plain
language, with the reasoning behind it.

Every figure here is the one the model registry currently holds. An earlier
Spanish version of this document quoted the previous model's numbers and was
still doing so after a new one had been deployed — which is the same failure the
deployment slot exists to prevent, in a document instead of in code.

---

## 1. Where the percentage comes from: a classifier does not return a label

When the simulator says **57 % crystalline**, that number is not a fourth thing
alongside the three classes. It is one of them.

A classifier does not return "crystalline". It returns **three numbers that sum
to 1**, one per class:

```
amorphous    0.12
incipient    0.31
crystalline  0.57   ← the largest
```

The label is, literally, *the name of the biggest number*.

### Why the three numbers matter more than the label

| Prediction | Label | What it actually says |
|---|---|---|
| 0.05 / 0.10 / **0.85** | crystalline | The model is confident |
| 0.30 / 0.33 / **0.37** | crystalline | The model is guessing |

Both rows produce the same label. The second is a coin toss.

**And that is where active learning lives.** The syntheses worth running
tomorrow are the second kind, where two bars are close together: those are the
ones that carry the most information once measured. With only the label they
would be indistinguishable from the confident ones.

> **Two different percentages appear on this site and they are not the same
> thing.** The simulator's is a model probability. The 11.0 % / 79.8 % / 95.7 %
> in the data-understanding table is a **count**: of all the combinatorial
> syntheses actually performed, 11 % came out crystalline. No model is involved
> there — it is counting.

---

## 2. A frozen grid versus a live model

The simulator serves predictions from the real model **with no server and
without downloading the model**. It does it by freezing: the answer is computed
in advance for every combination the user can select, and the page looks the
result up in that table.

### What that buys

- **Real predictions with no backend.** Nothing to keep running, nothing that can
  fall over.
- **Nobody can probe the model.** With no endpoint to query, there is no way to
  send it thousands of requests and reconstruct the chemistry it learned. That
  alone settles the intellectual-property concern.

### What it costs

- **The grid quantises.** The user picks between precomputed steps, not an
  arbitrary temperature. At fine resolution across five controls the grid would
  run to tens of millions of cells, so the steps are deliberately coarse.

### What the grid does *not* replace

And this is the important part: **the live model is not for the website, it is
for the laboratory.**

| | Frozen grid | Live model |
|---|---|---|
| An arbitrary temperature | No, only the steps | Yes |
| New chemistry — a metal or linker not in the record | Not in the grid | Yes |
| 24 conditions for the next plate | A list could be precomputed | Yes, using what was measured **this week** |
| Record the prediction and compare it with the real outcome | No | Yes — that is the active-learning loop |

The website is **a demonstration of the system**, not the system. The real
product is asking for conditions, synthesising them, and letting the outcome
train the next version. That depends on data that does not exist yet, so by
definition it cannot be frozen.

### The third option, and why it was dropped

The model could be exported to ONNX and **run inside the browser**: real model,
continuous inputs, no server. It was dropped because it means **serving the model
file**, which anyone could then download. That contradicts the project's rule
that serialised models do not leave the server.

### One honesty decision inside the grid

The axes **do not leave the observed range**. Temperature offers the nine values
the laboratory actually used, reaction time the three that exist — 24, 48 and
72 hours — and the ligand-to-metal ratio its eight. This was wrong at first: the
axes were written by hand and offered 25 °C, one hour and a ratio of 0.4, none of
which appear anywhere in the record, while the text beside them claimed the
controls stopped at what had really been explored. They are now read from the
dataset the deployed model was trained on.

And each metal starts from **its own median synthesis**: everything not exposed —
the linker, the solvents, the volumes — is fixed at the median of the real
syntheses made with that metal, not at a global average. So every cell of the
grid is a plausible recipe rather than an impossible blend.

---

## 3. An honest reading of the model's performance

Worth writing down precisely, because it is easy to retain the aggregate figure
and lose the qualification that goes with it.

### The figures

All from the plate-grouped cross-validation. None are training figures.

| | Macro F1 | MCC | Balanced accuracy |
|---|---|---|---|
| Trivial classifier | 0.260 | 0.00 | 0.33 |
| **Full model** | **0.517** | **0.305** | **0.515** |
| **Actionable model** | **0.393** | **0.095** | **0.399** |

Recall by class: **75 %** incipient, **52 %** amorphous, **25 %** crystalline.
Training set: 1,516 syntheses across 68 plates, of which 167 crystalline.

### Reading

**The full model roughly doubles the trivial baseline** and reaches a Matthews
correlation of 0.31 — a real association of moderate size. Two features of this
result deserve stating plainly rather than leaving to inference.

**1. Recall on the crystalline class is 0.25.** Since the purpose of the tool is
to shortlist promising conditions, this is the figure that governs its practical
value, and it is a real limitation. It is also the expected consequence of a
class with 167 examples against 967 incipient ones, and of that class being the
most heterogeneous: there are many ways for a framework to crystallise and only
one way for it not to.

> The confusion matrix published alongside reads 0.53 for the same class, because
> it is **one held-out split rather than the five-fold average**. A lucky set of
> plates flatters the smallest class, which is precisely why the cross-validated
> number is the one on record.

**2. The actionable model sits close to the limit the data allows.** Restricted
to process variables — the one that answers *given this chemistry, which
conditions favour crystallisation* — macro F1 falls to 0.393 and MCC to 0.095.
Above chance, and not yet a basis for recommending conditions. Since that is the
question the laboratory actually asks, it is the more important of the two
results.

### The limit is in the experimental record, not the model

Across five years the record contains **15 distinct target temperatures and 11
reaction times**, and the subset the model trained on is poorer still: **nine
temperatures and three reaction times**. They were also varied confounded with
chemistry — each campaign swept one factor within one metal-linker system. A
supervised model cannot estimate the effect of a variable held nearly constant,
nor separate an effect from a factor it always co-occurred with.

That is a property of the data. No choice of algorithm or hyperparameter recovers
information the experiments did not generate.

> **A realistic expectation for hyperparameter tuning:** an improvement of 0.02
> to 0.05 in macro F1. Worth doing for methodological completeness; not a route
> to a materially better model.

### What would improve it, in order of expected return

1. **One designed sweep** of temperature, time and modulator at fine resolution
   **within a single metal-linker system**. It attacks the confounding directly
   and costs one or two high-throughput plates — by a wide margin the most
   efficient intervention available.
2. **More crystalline examples.** With 167 in the training set, the minority
   class is the binding constraint on every metric above.
3. **Complete the solvent breakdown** for the records that lack it. That block
   currently scores as noise under permutation importance, and its true
   contribution cannot be assessed until the medium is recorded completely.
4. **Revisit the target** once more data exists. A continuous crystallinity index
   may carry more than three classes — though the three classes remain the
   judgement the bench actually recorded.

### On the value of this result

The merit of this stage does not rest on the size of the score, but on the score
being defensible: validated with plates as groups, computed after seven data
defects were corrected, and reported alongside the baseline that gives it
meaning.

An earlier version of this analysis reported a higher figure that was later shown
to reflect the synthesis method rather than the chemistry. Establishing that the
present limitation is one of experimental design turns a negative result into a
specific, actionable experiment.

> Feeding the model more data improves the result, but **the nature of the data
> matters more than its volume**: repeating the same region of condition space
> will add little; a designed sweep, a great deal.
