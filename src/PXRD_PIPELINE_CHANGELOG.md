# PXRD descriptor pipeline — version history

One row of `pxrd_descriptors` only means something together with its
`pipeline_version`. The same column name has held different quantities across versions,
so **rows from different versions must never be mixed in one analysis**. Each migration
therefore ends with a `DELETE` of the superseded rows: the table always holds exactly one
version, and this file says which.

- **Implementation**: `src/pxrd_descriptors.py` (`PIPELINE_VERSION`).
- **Migrations**: `scripts/ddl_pxrd_descriptors*.sql`, one per version, each carrying its
  own reasoning in the header comment.
- **Argument and evidence**: `notebooks/05_PXRD_Signal_Processing_and_Crystallinity_Descriptors.ipynb`.
- **Batch job**: `scripts/compute_pxrd_descriptors.py`.

To check what is in the database right now:

```sql
SELECT pipeline_version, COUNT(*), MIN(computed_at), MAX(computed_at)
  FROM pxrd_descriptors GROUP BY 1;
```

---

## v3.3 — the peak threshold is corrected for multiple comparisons

*`scripts/sql/migrations/2026-08-28_pxrd_descriptors_v33.sql` · notebook §8.2*

**What was wrong.** A reflection was accepted when its prominence cleared 3σ of the
scan's own counting noise. Three sigma is the 99.73 % level **for one test**, and finding
peaks is not one test but a search over the whole pattern: with ~2250 points and a 0.2°
minimum separation there are ~225 independent chances for noise to make a bump.

Measured by Monte Carlo — the smooth part of a real scan (baseline + halo, no reflection
by construction) redrawn with Poisson noise:

| k | false peaks per scan |
|---|---|
| 3 | **4,6** |
| 4 | 0,1 |
| 5 | 0,0 |

On SMP-0006, a pattern labelled AMORFO by hand, the detector reported 8 peaks, ~5 of them
noise. Worse than the count: `two_theta_first_peak`, `d_max_angstrom`, the widths and
`scherrer_size_nm` were all read off that set — an interplanar spacing computed from a
noise spike and stored with the same face as a real one.

**The fix.** Fix the expected number of **false peaks per scan** (0,05) instead of fixing
k, and derive k from the length of the scan:

```
k = √2 · Φ⁻¹(1 − α / (2·n_eff)),   n_eff = n_points / min_distance_pts
```

The √2 is there because a prominence is a *difference* between two noisy quantities. On
this laboratory's scans that gives **k = 5,07–5,22**, exactly where the Monte Carlo
independently puts the false count at zero.

Fixing the error *rate* rather than k is what makes measurements comparable: a longer
scan gets more chances to fail, so it must clear a higher bar to carry the same risk.

**Effect** on 1.852 hand-labelled patterns, median peaks per class:

| Class | v3.2 (k = 3) | v3.3 (calibrated) |
|---|---|---|
| AMORFO | 2,0 | **0,0** |
| INCIPIENTE | 15,0 | 8,0 |
| CRISTALINO | 22,0 | **19,0** |

Share credited with ≥ 3 reflections: AMORFO 0,47 → **0,11**; CRISTALINO 0,99 → 0,98.
The correction removes noise, not signal.

**Schema.** `n_peaks_k5` → `n_peaks`, now the primary count and the set every peak-derived
descriptor is read from. `n_peaks_k3` stays as the term of comparison — the *gap* between
the two is itself informative.

---

## v3.2 — the amorphous fraction is referenced to what the sample scattered

*`scripts/sql/migrations/2026-08-28_pxrd_descriptors_v32.sql` · notebook §7.3, §10.0*

**What was wrong.** The diffuse area was divided by the **total** integrated area of the
scan, which includes the instrumental background. So `crystalline_fraction_blank`, being
one minus that, counted the instrument's own background as crystalline material — and the
value depended on how much background happened to sit under the pattern, which varies
with exposure and mount.

Found by the anatomy figure: its phase panel showed 9 % crystalline area for SMP-0005 while
the column read 0,757. Neither was miscalculated; they were measuring different things.

**The fix.**

```
amorphous_fraction_blank = ∫A / [ ∫A + ∫(I − B) ]
                            diffuse    Bragg
```

**Effect**, median by class:

| Class | v3.1 | v3.2 |
|---|---|---|
| AMORFO | 0,236 | 0,930 |
| INCIPIENTE | 0,154 | 0,347 |
| CRISTALINO | 0,001 | 0,011 |

The apparent loss of separation (344× → 84×) was a mirage of the inflated denominator.
The real gain is in the incipient subtypes, which stop overlapping: HALO_DOMINANTE
0,273 → 0,910, PICOS_ANCHOS 0,245 → 0,748, CRISTALITO_PEQUENO 0,242 → 0,608.

---

## v3.1 — the blank contributes its baseline, not its raw counts

*`scripts/sql/migrations/2026-08-28_pxrd_descriptors_v31.sql` · notebook §7.3*

**What was wrong.** The empty-instrument scan was subtracted as measured. At ~80 counts
its own Poisson noise is ~11 %, so the subtraction injected that noise straight into the
diffuse curve. On a crystalline sample almost everything counted as "amorphous" was in
fact the scaled blank's noise.

**The fix.** Both sides of the subtraction must describe the same kind of object — a
smooth background — so `E` is the arPLS baseline **of the blank**. Roughness of the
diffuse curve fell by two orders of magnitude (÷73 to ÷966).

---

## v3.0 — the halo is measured by subtracting the empty instrument

*`scripts/sql/migrations/2026-08-27_pxrd_descriptors_v3.sql` · notebook §7*

The version that made the amorphous fraction trustworthy. Two earlier methods were tried
and both **fail silently**, which is why they stay documented in the module rather than
being deleted:

1. **A second, softer arPLS pass.** Applied to a curve whose floor is already zero it
   returns zero: every sample comes out 100 % crystalline. The decisive evidence is the
   empty holder — its arPLS baseline is flat to 0,0σ while real samples curve by 3,8–23σ,
   so the curvature arPLS removes *is* the halo.
2. **A width-selective running median** (halo 5–15° wide, Bragg peaks < 0,35°). The
   premise is right, the precondition is not checked: a median only ignores peaks while
   they are a *minority* of its window. With 40 reflections, peaks and flanks cover
   41–46 % of the axis, the median climbs onto the flanks, and 71 % of the reported halo
   area came from *underneath* the peaks — while the actual signal between peaks measured
   0,00–0,08 % of the peak maximum.

**The method that works.** `A = B − kE`: the arPLS baseline minus the empty-instrument
baseline, scaled by `k = median(B[2θ>45°]) / median(E[2θ>45°])`. Above 45° almost no
sample in this corpus has structure, so that window measures the instrument alone.
(The scan's counting time would be the principled scale factor, but it is absent from the
`.xrdml` headers.)

New columns: `amorphous_fraction_blank`, `crystalline_fraction_blank`, `blank_scale_factor`.

---

## v2.0 — width-based separation

*`scripts/sql/migrations/2026-08-26_pxrd_descriptors_v2.sql`*

First full descriptor vector. `crystalline_fraction` splits the net signal by **width**
alone: narrow is Bragg, broad is halo. Superseded by v3.0 for the reasons above, but the
column is **kept** — it is a genuine descriptor of how the intensity is distributed in
width, and it is useful as a feature even though it is not a phase fraction.

---

## v1.0 — initial schema

*`scripts/sql/migrations/2026-08-25_pxrd_descriptors_v1.sql`* — table creation, peak geometry and global
descriptors.

---

## Open issues carried forward

- **`crystallinity_reliable` rejects 100 % of AMORFO samples.** It is derived from peak
  height, so a sample with no peaks scores as unreliable — which is backwards: having no
  peaks is the *finding*, not a failure to measure. Any aggregate filtered by this flag is
  biased towards crystalline material. Notebook §13 deliberately does not filter by it.
  Needs redefining in terms of integrated signal rather than peak height.
- **NMF over the net-signal matrix** (`nmf_weights`) is still empty.
- **`amorphous_fraction_blank` has a detection floor of about 0.02.** The arPLS baseline is
  a floor finder, so at the foot of a reflection it cannot tell "a peak starts here" from
  "the background rises here" and climbs slightly up the flank. Whatever it climbs is
  counted as diffuse afterwards, which inflates the amorphous fraction.

  Measured on a synthetic pattern - real instrument background plus Gaussians of *known*
  area, so anything the baseline gains above the background is misattributed peak area:

  | peak FWHM | peak area absorbed |
  |---|---|
  | 0.10 - 1.00 deg | **0.1 - 0.3 %** |
  | 1.50 deg | 1.4 % |
  | 2.50 deg | **25 %** |

  On a synthetic pattern with **no amorphous content at all** the pipeline reports 0.006
  to 0.018 instead of 0.

  For the widths this corpus actually contains the effect is negligible: median FWHM is
  0.16-0.24 deg by class, the 90th percentile does not exceed 0.57 deg, and **no
  measurement exceeds 1 deg** (the detector discards anything wider than 1.2 deg by
  design). The regime where arPLS genuinely struggles is never reached.

  What matters is the consequence for interpretation: the measured CRISTALINO median is
  **0.011**, essentially the floor. That does not mean those samples hold 1 % amorphous
  material - it means they hold **no measurable amorphous material**. A model that treats
  0.011 as a quantity is learning the artefact. Do not read this descriptor below ~0.02.

  Observed by Ruben using `app/pxrd_explorer.py`, which is what the app is for.
