"""
ALCheMy - PXRD signal processing and descriptor extraction

WHAT THIS SOLVES
----------------
A diffractogram arrives as a curve of a few thousand points whose length, angular
range, step size and count level all differ from one measurement to the next. You
cannot sort, filter, correlate or model that. This module turns any such curve
into one fixed row of numbers a chemist can read directly - how many reflections,
how wide, how crystalline, how big the unit cell - so a PXRD measurement becomes
something the database can reason about.

It is the single implementation of the pipeline specified in
methodology/ROADMAP_PXRD_CRISTALINIDAD_Y_ML.md. Both the didactic notebook
(notebooks/05) and the bulk batch script import from here, so there is exactly
one place where the maths lives and no risk of the two drifting apart.

THE FOUR STAGES
---------------
0. resample_to_grid     - put every scan on one common angular grid
1. decompose_profile    - split the profile into instrumental background,
                          amorphous halo and crystalline peaks (the load-bearing
                          step: the halo is SIGNAL and must survive)
2. detect_peaks_poisson - find reflections using a threshold derived from photon
                          counting statistics rather than a magic number
3. extract_descriptors  - assemble the canonical descriptor vector

WHY THE BACKGROUND IS SPLIT IN TWO
----------------------------------
What gets loosely called "background" is two physically different things stacked
on top of each other:

  (a) instrumental background - air scatter, sample holder, detector noise.
      Monotonic, featureless. It says nothing about the material: remove it.
  (b) amorphous halo - diffuse scattering from the disordered phase. Broad, but
      it has a SHAPE and a centre. It is literally the measurement of "there is
      this much non-crystalline material here": keep it and quantify it.

A single aggressive baseline pass removes both, destroying the very information
about crystallisation yield the project needs. So (a) and (b) are separated by
two different tools, each used for what it is actually built to do:

  (a) is found with one rigid arPLS pass. arPLS is a FLOOR finder, and the
      instrumental background genuinely is the floor of the pattern.
  (b) is found by WIDTH, with a 3 deg running median. A second, softer arPLS
      pass does not work here and fails silently: applied to a curve whose floor
      is already zero it returns zero, so the amorphous area comes out as 0 and
      every single sample is reported as 100% crystalline. What actually
      distinguishes a halo (5-15 deg wide) from a Bragg peak (<0.35 deg) is
      width, so the filter has to be width-selective.

The profile is normalised by area BEFORE the baseline is fitted, because lambda
sets stiffness relative to the magnitude of the numbers being fitted: on raw
counts the same lambda behaves like a rigid baseline on a 200-count scan and a
flexible one on a 20,000-count scan, and the descriptors stop being comparable.

REUSE
-----
    from pxrd_descriptors import (
        GRID_2THETA, resample_to_grid, decompose_profile,
        detect_peaks_poisson, extract_descriptors, PIPELINE_VERSION,
    )

Every function is pure numpy/scipy and takes plain arrays, so it works the same
inside a notebook cell, inside a batch script, or behind an n8n Code node.
"""

import numpy as np
from scipy.signal import find_peaks, peak_widths
from scipy.ndimage import median_filter, gaussian_filter1d
from scipy.sparse import diags, csc_matrix
from scipy.sparse.linalg import spsolve

# Version tag written into pxrd_descriptors.pipeline_version. Bump it whenever a
# formula below changes, otherwise rows computed months apart silently stop being
# comparable and nothing in the database records why.
PIPELINE_VERSION = 'v3.0'

# ---------------------------------------------------------------------------
# Low-angle cutoff: where the instrument stops measuring the sample.
#
# Below ~4.5 deg 2-theta the detector sees the tail of the direct/air-scattered
# beam, not diffraction from the specimen. This is not a modelling opinion, it
# was measured on this laboratory's own data:
#
#   * Median profile of 200 random as-synthesized scans, normalised to their own
#     20-45 deg level: 3.80x at 3.0 deg, 1.55x at 4.0 deg, 1.20x at 4.4 deg,
#     flat from there on. A monotonic decay present in the MEDIAN of 200
#     chemically different materials cannot be a reflection.
#   * All 11 precursor references (metal salts and free ligands, none of which
#     has a MOF-sized cell) show the same tail: 3.7x to 15.5x at 3.0-3.5 deg,
#     back to ~1x by 4.5-5.0 deg.
#   * The blank holder and the instrument standard were themselves recorded
#     starting at 5.0066 deg, so nothing below 5 deg can ever be validated
#     against a reference. Processing a region no reference covers is guesswork.
#
# 5.0 deg is therefore the first angle that is simultaneously (a) past the beam
# tail with margin and (b) covered by the blank and the standard.
#
# Consequence to be aware of: Bragg caps the largest measurable spacing at
# d = lambda / (2 sin(2.5 deg)) = 17.66 A. Cells larger than that are not
# "absent", they are outside the instrument's window - see D_MAX_OBSERVABLE_A.
# ---------------------------------------------------------------------------
LOW_ANGLE_CUTOFF_DEG = 5.0
HIGH_ANGLE_CUTOFF_DEG = 50.0

# ---------------------------------------------------------------------------
# Canonical angular grid.
# 5 to 50 degrees covers everything structurally relevant in MOFs that this
# diffractometer can actually see, without dragging in either the direct-beam
# tail or the noisy high-angle end. A 0.02 degree step is finer than the
# narrowest peak the instrument resolves, so nothing is lost by resampling.
# ---------------------------------------------------------------------------
GRID_2THETA = np.arange(LOW_ANGLE_CUTOFF_DEG, HIGH_ANGLE_CUTOFF_DEG, 0.02)
STEP_2THETA = 0.02

# Cu K-alpha1 wavelength in angstroms, needed for the Bragg conversion.
WAVELENGTH_CU_KA1 = 1.540598

# Largest interplanar spacing the 5 deg cutoff still lets through. Any sample
# whose d_max_angstrom lands within ~0.2 A of this value is saturated: its real
# largest spacing may be bigger and simply unmeasurable here.
D_MAX_OBSERVABLE_A = WAVELENGTH_CU_KA1 / (2.0 * np.sin(np.radians(LOW_ANGLE_CUTOFF_DEG / 2.0)))

# ---------------------------------------------------------------------------
# Low-angle window used by the "large cell" descriptors.
#
# 15 deg, not 10. These are phosphonate MOFs (P-MOFs): dense, weakly porous,
# but with large unit cells because the linkers are built on large cores, and
# with low-symmetry, large asymmetric units. Their most characteristic and most
# intense reflections routinely fall between 10 and 15 deg, so a 10 deg window
# cuts the diagnostic region in half. 15 deg 2-theta corresponds to d = 5.90 A.
# ---------------------------------------------------------------------------
LOW_ANGLE_WINDOW_DEG = 15.0

# Default baseline stiffness. This is NOT a guess and NOT copied from a paper:
# it is the value selected by the calibration in notebooks/05 (roadmap stage E1),
# run against the real blank, a real amorphous sample and a real crystalline one
# from this laboratory. The sweep showed that below ~1e4 the baseline is flexible
# enough to swallow the amorphous halo (which inflated one sample's crystallinity
# from 0.24 to 0.82 - a completely fabricated number), while above ~1e7 it is so
# stiff that it leaves 50% more background behind on the empty holder. 1e6 sits
# in the middle of the plateau where the halo is fully preserved and the blank
# residual is still within 5% of its floor.
DEFAULT_LAMBDA_RIGID = 1e6
DEFAULT_K_SIGMA = 3.0

# Width of the running-median window used to separate the broad amorphous halo
# from the narrow Bragg peaks, in degrees 2-theta. It must be comfortably wider
# than the widest reflection (~0.35 deg) and comfortably narrower than the
# halo (~5-15 deg); 3 degrees sits in the middle of that gap.
BROAD_WIDTH_DEG = 3.0

# Percentile of the running-median curve taken as the "no halo here" level.
# 5% is low enough to land outside any real halo (halos span 5-15 deg inside a
# 45 deg window) and high enough not to chase a single unlucky minimum.
BROAD_PEDESTAL_PCT = 5.0

# Integrated signal-to-noise below which crystalline_fraction stops meaning
# anything: there is not enough diffracted intensity for the split between halo
# and peaks to be a measurement rather than a coin flip. Anchored on the empty
# holder, which scores 0.1 against 3-5 for a normal sample.
MIN_SIGNAL_SNR_AREA = 1.0

# ---------------------------------------------------------------------------
# Blank-referenced amorphous content (v3.0)
# ---------------------------------------------------------------------------
# The v2.0 route estimated the halo with a running median over the arPLS-corrected
# profile, separating "broad" from "narrow" by width. Measured against 149 patterns
# that the lab owner had labelled by eye, that route is wrong at BOTH ends:
#
#   * On patterns he labelled CRISTALINO it reported ~50% amorphous. Between the
#     reflections the corrected signal is flat at 0.00-0.08% of the peak maximum -
#     there is no halo there. The reflections plus their flanks cover 41-46% of the
#     axis, so a 3 degree window centred on a cluster contains a majority of raised
#     points and the median settles on the flanks instead of the valleys. 71% of the
#     reported halo area came from underneath the peaks.
#   * On patterns he labelled AMORFO the surviving halo measured 0.76 sigma - below
#     the counting noise. arPLS had already removed it: it is a *baseline* estimator,
#     and a 5-15 degree hump is smooth enough for it to swallow.
#
# The decisive evidence is the empty holder. Its arPLS baseline is flat to 0.0 sigma,
# while real samples curve by 3.8-23 sigma. The instrument contributes no curvature,
# so every bit of it belongs to the sample - and arPLS was discarding it as background.
#
# Hence the v3.0 definition, which is the lab owner's:
#
#       amorphous = (what arPLS removes) - (the empty instrument)
#
# arPLS removes instrument + diffuse sample scattering; the blank IS the instrument;
# the difference is what the sample scatters diffusely. This deliberately does not care
# whether that diffuse intensity comes from amorphous material, from thermal or defect
# scattering, from Fe fluorescing under Cu radiation or from the holder - all of it is
# "not crystalline", which is what the descriptor claims to measure.
#
# Validated against 1,881 hand-labelled patterns: CRISTALINO 0.012, INCIPIENTE 0.043,
# AMORFO 0.287, and the blank against itself 0.031. Within the incipient subtypes the
# ordering is also right: HALO_DOMINANTE 0.215 > PICOS_ANCHOS 0.153 >
# CRISTALITO_PEQUENO 0.084.
BLANK_SCALE_FROM_DEG = 45.0     # window used to put the blank on the sample's scale
MIN_AMORPHOUS_RELIABLE = 0.0    # values below this are clipped, never negative

# Trapezoidal integrator, named once so NumPy 1.x and 2.x both work.
_trapz = getattr(np, 'trapezoid', getattr(np, 'trapz', None))


def integrate(y, x):
    """Area under a curve by the trapezoidal rule. Used for every area here."""
    return float(_trapz(y, x))


# ===========================================================================
# STAGE 0 - Angular homogenisation
# ===========================================================================

def resample_to_grid(x_raw, y_raw, grid=GRID_2THETA):
    """
    Interpolates a scan onto the canonical grid.

    Returns (grid, y_on_grid, valid_mask). Points of the grid that fall outside
    the angular range actually measured are marked invalid rather than being
    extrapolated: inventing counts at angles the instrument never visited would
    put fabricated data into the descriptors. Every later integral is taken over
    the valid region only.
    """
    x_raw = np.asarray(x_raw, dtype=float)
    y_raw = np.asarray(y_raw, dtype=float)

    order = np.argsort(x_raw)
    x_raw, y_raw = x_raw[order], y_raw[order]

    valid = (grid >= x_raw.min()) & (grid <= x_raw.max())
    y_grid = np.interp(grid, x_raw, y_raw)
    return grid, y_grid, valid


def normalize_by_area(y, x):
    """
    Divides the curve by its own integrated area, so the result integrates to 1.

    This is what makes a 5-minute screening scan and a 2-hour scan of the same
    material comparable: the shape survives, the acquisition time cancels out.
    Normalising by the maximum instead would be hostage to a single spuriously
    intense reflection from preferred orientation, and on a fully amorphous
    sample it would normalise against a random noise spike.
    """
    area = integrate(y, x)
    return y / (area + 1e-12)


# ===========================================================================
# STAGE 1 - Baseline estimation and three-layer decomposition
# ===========================================================================

def arpls_baseline(y, lam=DEFAULT_LAMBDA_RIGID, ratio=1e-3, max_iter=50):
    """
    arPLS baseline (Baek et al., Analyst 140 (2015) 250-257).

    Fits a smooth curve underneath the data by minimising

        F(z) = sum_i w_i (y_i - z_i)^2  +  lam * sum_i (z_{i-1} - 2 z_i + z_{i+1})^2

    The first term pulls the baseline towards the data; the second penalises
    curvature, so lam controls stiffness: the larger it is, the less the baseline
    is allowed to bend, and the less of the real signal it can absorb.

    What makes it "asymmetrically reweighted" is that after each iteration the
    weights w are recomputed from the residuals: points sitting ABOVE the current
    baseline (peaks) get their weight driven towards zero, so the baseline stops
    chasing them, while points below (noise) keep full weight. That asymmetry is
    what lets it find the floor of a spectrum instead of its average.
    """
    y = np.asarray(y, dtype=float)
    n = len(y)
    ones = np.ones(n)

    # Second-difference operator: D @ z is the discrete curvature of z.
    D = diags([ones, -2 * ones, ones], [0, 1, 2], shape=(n - 2, n))
    H = lam * (D.T @ D)

    w = np.ones(n)
    z = y.copy()

    for _ in range(max_iter):
        W = diags(w, 0)
        z = spsolve(csc_matrix(W + H), w * y)
        d = y - z

        d_negative = d[d < 0]
        if d_negative.size == 0:
            break

        mean_neg = float(np.mean(d_negative))
        std_neg = float(np.std(d_negative)) or 1e-6

        # Logistic reweighting. Clipped because exp() of a large positive number
        # overflows, and an overflow here would silently produce NaN weights.
        exponent = np.clip(2.0 * (d - (2.0 * std_neg - mean_neg)) / std_neg, -30.0, 30.0)
        w_new = 1.0 / (1.0 + np.exp(exponent))

        if np.linalg.norm(w_new - w) / (np.linalg.norm(w) + 1e-12) < ratio:
            w = w_new
            break
        w = w_new

    return z


def broad_component(net, step=STEP_2THETA, width_deg=BROAD_WIDTH_DEG):
    """
    Extracts the broad (amorphous) part of a background-free profile.

    WHY NOT A SECOND arPLS PASS
    ---------------------------
    The obvious idea - run arPLS again with a softer lambda and call the result
    the halo - does not work, and the failure is silent rather than loud. arPLS
    is a *baseline* estimator: by construction it finds the floor underneath the
    data. Run it on a profile whose floor is already zero and it returns
    approximately zero, so the amorphous area comes out empty and every single
    sample is reported as 100% crystalline. That is a plausible-looking number
    for a completely wrong reason, which is the worst kind.

    WHAT SEPARATES BROAD FROM NARROW IS WIDTH
    -----------------------------------------
    A Bragg reflection is narrow (FWHM below ~0.35 degrees); an amorphous halo is
    broad (FWHM ~5-15 degrees). So the separation is done with a filter selective
    in width, not in height: a running median over a window several times wider
    than any peak. Anything narrower than half the window - every Bragg peak - is
    stepped over and vanishes; anything much wider - the halo - passes through
    untouched. A light Gaussian smoothing afterwards removes the staircase the
    median filter leaves behind.

    This is the practical equivalent of the roadmap's "fit broad Gaussians to the
    humps sitting under the crystalline peaks", but without a per-sample
    non-linear fit that could fail to converge on any of 1,800 patterns.
    """
    window_pts = int(round(width_deg / step))
    if window_pts % 2 == 0:
        window_pts += 1                      # median_filter wants an odd window
    window_pts = max(3, window_pts)

    broad = median_filter(net, size=window_pts, mode='nearest')
    broad = gaussian_filter1d(broad, sigma=window_pts / 6.0, mode='nearest')

    # Only the physical floor is enforced. Clipping the halo pointwise to `net`
    # (broad <= net at every point) looks reasonable but is wrong: the halo is a
    # smooth underlying component, and counting noise makes the OBSERVED net dip
    # below it constantly. Clipping there drags the estimate down onto the lower
    # envelope of the noise, which understates the halo and hands the difference
    # to the crystalline component. Measured on the empty holder, that single
    # clip pushed the reported crystallinity from 0.81 up to 0.89.
    return np.clip(broad, 0.0, None)


def decompose_profile(y_raw, x,
                      lam_rigid=DEFAULT_LAMBDA_RIGID,
                      broad_width_deg=BROAD_WIDTH_DEG,
                      k_sigma=DEFAULT_K_SIGMA):
    """
    Splits a raw profile into its three physical layers.

    Returns a dict with, all in AREA-NORMALISED units:
        normalized   - the input curve divided by its own area
        instrumental - the rigid baseline: air, holder, detector. Discardable.
        amorphous    - the broad halo from the disordered phase. SIGNAL.
        crystalline  - the sharp Bragg reflections. SIGNAL.
        net          - amorphous + crystalline (everything above the instrument)

    THE ORDER MATTERS: NORMALISE FIRST, THEN FIT THE BASELINE
    ---------------------------------------------------------
    lambda sets how stiff the baseline is *relative to the size of the numbers it
    is fitting*. Applied to raw counts, the same lambda is a very stiff baseline
    on a 200-count screening scan and a very soft one on a 20,000-count scan, so
    two measurements of the same material would be processed differently for no
    physical reason and their descriptors would not be comparable. Normalising to
    unit area first puts every scan on the same footing, and only then does a
    single calibrated lambda mean the same thing for all of them.

    Then:
        instrumental = arPLS(normalized, large lambda)  -> too stiff to climb the
                                                           halo: traces the
                                                           instrument alone
        net          = normalized - instrumental        -> halo + peaks
        amorphous    = broad_component(net)             -> width-selective filter
        crystalline  = net - amorphous

    This is what makes crystalline_fraction honest. Measuring peak height from
    zero would count the halo sitting underneath each peak a second time, as if
    it were crystalline, and inflate the crystallinity of exactly the marginal
    samples the project cares most about.
    """
    y_raw = np.asarray(y_raw, dtype=float)
    x = np.asarray(x, dtype=float)
    step = float(x[1] - x[0])

    normalized = normalize_by_area(y_raw, x)
    instrumental = arpls_baseline(normalized, lam=lam_rigid)
    net = np.maximum(normalized - instrumental, 0.0)

    broad = broad_component(net, step=step, width_deg=broad_width_deg)

    # ---- two different noise corrections, because the two components are
    # ---- estimated in two different ways ---------------------------------
    sigma = poisson_noise_level(y_raw, x)

    # (a) The halo sits on a PEDESTAL that is pure artefact. arPLS returns the
    #     FLOOR of the data, not its mean, so even in a completely featureless
    #     stretch `net` keeps a positive offset of roughly one to two sigma, and
    #     the running median faithfully reports that offset as "halo". The
    #     pedestal is estimated from the profile itself as the level the broad
    #     component falls back to where there is no halo (a low percentile).
    #     Self-calibrating, so it needs no assumption about the noise model.
    pedestal = float(np.percentile(broad, BROAD_PEDESTAL_PCT))
    amorphous = np.maximum(broad - pedestal, 0.0)

    # (b) The crystalline component is a POINTWISE difference, so at every point
    #     it competes with single-point counting noise. Noise is, by definition,
    #     narrow: the width filter cannot tell it from a Bragg peak and dumps all
    #     of it into `crystalline`. Requiring k*sigma is the same criterion used
    #     to accept a peak, applied to the area instead of to a maximum.
    #     Without it the empty holder is reported as 89% crystalline, because
    #     89% of its (nonexistent) signal is narrow - it is noise.
    crystalline = np.maximum(net - broad - k_sigma * sigma, 0.0)

    return {
        'normalized': normalized,
        'instrumental': instrumental,
        'amorphous': amorphous,
        'crystalline': crystalline,
        'broad_raw': broad,
        'pedestal': pedestal,
        'sigma': sigma,
        'net': net,
    }


# ===========================================================================
# STAGE 2 - Peak detection from counting statistics
# ===========================================================================

def poisson_noise_level(y_raw, x):
    """
    Noise level of a scan expressed in AREA-NORMALISED units.

    X-ray detection is photon counting, so the noise obeys Poisson statistics:
    the variance of a count equals its mean, hence sigma = sqrt(counts). The
    typical noise of the scan is therefore median(sqrt(raw counts)). Because the
    profile is later handled after dividing by its total area, the noise has to
    be divided by that same area to stay in step with it.
    """
    y_raw = np.asarray(y_raw, dtype=float)
    area = integrate(y_raw, x)
    return float(np.median(np.sqrt(np.maximum(y_raw, 1.0)))) / (area + 1e-12)


def detect_peaks_poisson(x, y_peaks, noise_level, k_sigma=DEFAULT_K_SIGMA,
                         min_distance_deg=0.20, max_fwhm_deg=1.2,
                         edge_margin_deg=0.10):
    """
    Finds Bragg reflections with a threshold tied to the noise of the actual
    measurement instead of a magic number.

    A scan with 10,000 counts has a noise floor of 100 counts; a 5-minute scan
    with 100 counts has a noise floor of 10. A single fixed threshold would
    either drown the weak scan's real reflections or promote the strong scan's
    noise into peaks. Requiring the prominence of a peak to clear
    k * (noise level) makes the criterion calibrate itself to each measurement:
    k = 3 is the 99.73% significance level (sensitive, catches incipient
    crystallinity), k = 5 is 99.9999% (only confident reflections).

    Returns (peak_indices, fwhm_degrees), already filtered so that anything
    broader than max_fwhm_deg - part of the amorphous halo rather than a Bragg
    reflection - is excluded, and so that nothing sitting on the very first or
    last points of the scan is reported: a half-visible edge feature has no
    measurable width and would otherwise yield a spurious d-spacing.
    """
    x = np.asarray(x, dtype=float)
    y_peaks = np.asarray(y_peaks, dtype=float)
    step = float(x[1] - x[0])
    min_distance_pts = max(1, int(round(min_distance_deg / step)))

    threshold = max(0.015 * float(np.max(y_peaks)), k_sigma * float(noise_level))

    indices, _props = find_peaks(y_peaks, prominence=threshold, distance=min_distance_pts)
    if indices.size == 0:
        return indices, np.array([])

    widths_pts, _h, _l, _r = peak_widths(y_peaks, indices, rel_height=0.5)
    fwhm_deg = widths_pts * step

    keep = (
        (fwhm_deg <= max_fwhm_deg)
        & (x[indices] > x[0] + edge_margin_deg)
        & (x[indices] < x[-1] - edge_margin_deg)
    )
    return indices[keep], fwhm_deg[keep]


# ===========================================================================
# STAGE 3 - The canonical descriptor vector
# ===========================================================================

def _hump_fwhm(x, hump):
    """Width of the amorphous hump at half its maximum, in degrees 2-theta."""
    peak = float(np.max(hump)) if hump.size else 0.0
    if peak <= 0:
        return float('nan')
    above = np.where(hump >= peak / 2.0)[0]
    if above.size < 2:
        return float('nan')
    return float(x[above[-1]] - x[above[0]])


BLANK_FILE_NAME = 'DRX-26376(10)-Blanco.xrdml'


def load_instrument_blank(connection, grid=None, file_name=BLANK_FILE_NAME):
    """
    Loads the empty-holder scan and puts it on the standard grid.

    This is the instrument's own signature: same diffractometer (PIXcel3D, Cu anode,
    45 kV / 40 mA), no specimen. Measured 5.0066-89.9989 degrees in 6,474 points, so it
    covers the whole 5-50 working range with room to spare.

    Kept here rather than in the notebook so the notebook, the bulk ingestion script and
    any future re-processing all reference the same scan. Returns None if the file is
    not in the database, and callers must cope with that: the blank-referenced
    descriptors then come back None rather than silently falling back to a worse method.
    """
    grid = GRID_2THETA if grid is None else np.asarray(grid, dtype=float)

    # Accepts either a SQLAlchemy connection or a plain DB-API one (psycopg2). The
    # notebooks use psycopg2 and the bulk scripts use SQLAlchemy; making the caller
    # convert would be a pointless dependency in whichever of the two lacks it.
    if hasattr(connection, 'execute') and not hasattr(connection, 'cursor'):
        from sqlalchemy import text as _text
        row = connection.execute(_text(
            "SELECT data_json->'raw_data'->>'x', data_json->'raw_data'->>'y' "
            "FROM characterization_measurements "
            "WHERE technique = 'PXRD' AND file_name = :fn LIMIT 1"),
            {'fn': file_name}).fetchone()
    else:
        cur = connection.cursor()
        cur.execute(
            "SELECT data_json->'raw_data'->>'x', data_json->'raw_data'->>'y' "
            "FROM characterization_measurements "
            "WHERE technique = 'PXRD' AND file_name = %s LIMIT 1", (file_name,))
        row = cur.fetchone()

    if row is None or row[0] is None:
        return None

    import json as _json
    xb = np.asarray(_json.loads(row[0]), dtype=float)
    yb = np.asarray(_json.loads(row[1]), dtype=float)
    if xb.size < 10:
        return None
    return np.interp(grid, xb, yb)


def amorphous_from_blank(x, y_grid, blank_grid, baseline=None,
                         lam_rigid=DEFAULT_LAMBDA_RIGID,
                         scale_from_deg=BLANK_SCALE_FROM_DEG):
    """
    Diffuse (non-crystalline) content, measured as arPLS baseline minus the empty
    instrument. See the BLANK_SCALE_FROM_DEG block above for why this replaces the
    width-selective halo of v2.0.

    WHY THE BLANK HAS TO BE RESCALED
    --------------------------------
    The blank and the sample were not counted for the same time per step, and the
    header does not record it (`time_per_step_s` is absent on every file checked),
    so their raw counts are not comparable and the blank cannot simply be subtracted.

    The scale factor is taken from the high-angle end, by default above 45 degrees.
    The assumption is that up there a sample's own diffuse scattering has largely
    died away, so whatever background remains is the instrument, and matching the two
    there fixes the scale. The assumption is not critical: sweeping the window from
    40 to 47 degrees moves the amorphous/crystalline separation only between 18x and
    28x, and never changes the ordering.

    Where the assumption does bite, it bites conservatively. A sample that still
    scatters diffusely at 45 degrees makes the blank scale up too far, so more gets
    subtracted and the amorphous content is UNDER-estimated. The failure mode is a
    number that is too small, not one invented out of nothing.

    Returns (amorphous_curve, fraction_of_total_area, scale_factor). The curve is on
    the same grid as `x`; the fraction is normalised by the sample's total area, so it
    is comparable across measurements of different length and intensity.
    """
    x = np.asarray(x, dtype=float)
    y_grid = np.asarray(y_grid, dtype=float)

    if blank_grid is None:
        return None, None, None
    blank_grid = np.asarray(blank_grid, dtype=float)
    if blank_grid.size != y_grid.size:
        return None, None, None

    total_area = float(np.trapezoid(y_grid, x))
    if not np.isfinite(total_area) or total_area <= 0:
        return None, None, None

    if baseline is None:
        baseline = arpls_baseline(y_grid, lam=lam_rigid)

    window = x >= scale_from_deg
    # A scan that stops before the window leaves nothing to scale against; fall back
    # to the last fifth of whatever range was measured rather than refusing outright.
    if window.sum() < 20:
        window = x >= (x[0] + 0.8 * (x[-1] - x[0]))
    if window.sum() < 5:
        return None, None, None

    blank_level = float(np.median(blank_grid[window]))
    if blank_level <= 0:
        return None, None, None
    scale = float(np.median(baseline[window])) / blank_level

    instrument = scale * blank_grid
    amorphous = np.maximum(baseline - instrument, MIN_AMORPHOUS_RELIABLE)
    fraction = float(np.trapezoid(amorphous, x) / total_area)

    # WHAT THIS NUMBER CANNOT SEE
    # ---------------------------
    # The subtraction assumes the specimen sat in the same holder as the blank. It did
    # not always. The lab's own silicon standard (NIST 640, confirmed by its 28.44 /
    # 47.30 / 56.12 degree reflections) comes out at 0.322 despite being as crystalline
    # as a specimen gets, because loose powder needs a support the empty holder does not
    # have, and 95% of its "amorphous" excess sits below 30 degrees where silicon has no
    # reflections at all. That is a real measurement of real diffuse scattering - from
    # the mount rather than from the material.
    #
    # So the number answers "how much of this pattern is not Bragg scattering", not
    # "how much amorphous material is in this vial". Within one corpus mounted the same
    # way it compares samples honestly, which is what it is used for here.
    return amorphous, fraction, scale


def extract_descriptors(x, y_raw, sample_code='SAMPLE',
                        lam_rigid=DEFAULT_LAMBDA_RIGID,
                        broad_width_deg=BROAD_WIDTH_DEG,
                        k_sigma=DEFAULT_K_SIGMA,
                        return_curves=False,
                        blank_grid=None):
    """
    Computes the full descriptor vector for one already-resampled profile.

    x and y_raw must already be on a common grid and restricted to the angular
    range actually measured (use resample_to_grid first).
    """
    x = np.asarray(x, dtype=float)
    y_raw = np.asarray(y_raw, dtype=float)

    layers = decompose_profile(y_raw, x, lam_rigid=lam_rigid,
                               broad_width_deg=broad_width_deg, k_sigma=k_sigma)
    normalized = layers['normalized']
    instrumental = layers['instrumental']
    amorphous = layers['amorphous']
    crystalline = layers['crystalline']
    net = layers['net']
    noise = layers['sigma']

    # Peaks are searched on the UNGATED narrow component. detect_peaks_poisson
    # applies its own k*sigma threshold, so feeding it the already-gated curve
    # would subtract the same noise floor twice and quietly lose weak
    # reflections - precisely the ones that decide a marginal sample.
    narrow = np.maximum(net - layers['broad_raw'], 0.0)
    peaks, fwhm_deg = detect_peaks_poisson(x, narrow, noise, k_sigma=k_sigma)
    peaks_k5, _fwhm_k5 = detect_peaks_poisson(x, narrow, noise, k_sigma=5.0)

    # ---- peak-derived descriptors ----------------------------------------
    if peaks.size:
        two_theta_first = float(x[peaks[0]])            # find_peaks returns ascending order
        theta_rad = np.radians(two_theta_first / 2.0)
        d_max = float(WAVELENGTH_CU_KA1 / (2.0 * np.sin(theta_rad)))
        fwhm_median = float(np.median(fwhm_deg))
        fwhm_min = float(np.min(fwhm_deg))
        # Scherrer with the conventional shape factor K = 0.9, which by
        # convention pairs with FWHM (not the integral breadth). Wavelength
        # converted from angstrom to nm so the result is in nm.
        beta_rad = np.radians(float(fwhm_deg[0]))
        scherrer_nm = float((0.9 * (WAVELENGTH_CU_KA1 * 0.1)) / (beta_rad * np.cos(theta_rad)))
        n_below_window = int(np.sum(x[peaks] < LOW_ANGLE_WINDOW_DEG))
        d_max_saturated = bool(two_theta_first <= LOW_ANGLE_CUTOFF_DEG + 0.10)
    else:
        two_theta_first = d_max = fwhm_median = fwhm_min = scherrer_nm = float('nan')
        n_below_window = 0
        d_max_saturated = False

    # ---- area / phase descriptors ----------------------------------------
    area_crystalline = integrate(crystalline, x)
    area_amorphous = integrate(amorphous, x)
    area_total = area_crystalline + area_amorphous
    crystalline_fraction = float(area_crystalline / area_total) if area_total > 0 else float('nan')

    # Proper intensity-weighted centroid of the BROAD component only.
    # Both numerator and denominator are integrals, so the step size cancels.
    # (Dividing a plain sum by an integral would scale the answer by 1/step,
    # which is 50x on this grid and yields impossible angles above 180 degrees.)
    if area_amorphous > 0:
        hump_center = float(integrate(x * amorphous, x) / area_amorphous)
    else:
        hump_center = float('nan')
    hump_fwhm = _hump_fwhm(x, amorphous)

    below_window = x < LOW_ANGLE_WINDOW_DEG
    frac_below_window = (float(integrate(normalized[below_window], x[below_window]))
                         if below_window.any() else 0.0)

    # Integrated diffracted signal expressed in units of integrated counting
    # noise. This is the number that says whether crystalline_fraction is a
    # measurement at all: the empty holder scores 0.1, a normal sample 3-5.
    angular_span = float(x[-1] - x[0])
    signal_snr_area = float(area_total / (noise * angular_span + 1e-15))
    crystallinity_reliable = bool(signal_snr_area >= MIN_SIGNAL_SNR_AREA)

    background_level = float(np.median(instrumental))
    peak_to_background = float(np.max(crystalline) / (background_level + 1e-12))

    # ---- global descriptors ----------------------------------------------
    # Shannon entropy of the net pattern treated as a probability distribution.
    # It measures HOW SPREAD OUT the diffracted intensity is across the angular
    # range, and needs no peak detection at all, which is why it still returns a
    # meaningful number on a completely amorphous sample.
    #
    # Direction, measured not assumed: a well-crystallised sample concentrates
    # its net intensity into a few narrow reflections and therefore scores LOW,
    # while an amorphous one spreads it across a broad halo and scores HIGH.
    # Over 169 reliable patterns of this corpus the correlation with the
    # crystalline fraction is -0.73.
    #
    # Under the v1.0 grid (starting at 3 deg) this correlation came out with the
    # OPPOSITE sign, +0.70. That was the direct-beam tail: it added a large,
    # narrow, low-angle spike to every pattern, which concentrated the
    # distribution most in exactly the samples the pipeline was then calling
    # amorphous. Removing the instrument restored the physical direction.
    #
    # It must be computed on the NET signal. On the full normalised pattern the
    # flat instrumental background dominates, every sample saturates near the
    # maximum log2(N), and the correlation collapses to about +0.04.
    net_prob = normalize_by_area(net, x) * float(x[1] - x[0])
    p = net_prob[net_prob > 0]
    spectral_entropy = float(-np.sum(p * np.log2(p))) if p.size else float('nan')

    # A real signal-to-noise ratio: how far the net signal rises above the
    # Poisson noise, both measured in the same normalised units. (Dividing the
    # maximum raw count by its own square root would merely return
    # sqrt(maximum) again - a copy of raw_counts_max under another name,
    # carrying no independent information about the pattern.)
    snr_global = float(np.max(net) / (noise + 1e-12))

    # v3.0: diffuse content referenced to the empty instrument. This is the number to
    # trust; `crystalline_fraction` below is kept because it still ranks patterns
    # usefully, but its two ends are artefacts (see the module header).
    amorphous_blank, amorphous_fraction_blank, blank_scale = amorphous_from_blank(
        x, layers['normalized'], blank_grid,
        baseline=layers['instrumental'], lam_rigid=lam_rigid)
    crystalline_fraction_blank = (None if amorphous_fraction_blank is None
                                  else float(1.0 - amorphous_fraction_blank))

    descriptors = {
        'sample_code': sample_code,
        'pipeline_version': PIPELINE_VERSION,
        'amorphous_fraction_blank': amorphous_fraction_blank,
        'crystalline_fraction_blank': crystalline_fraction_blank,
        'blank_scale_factor': blank_scale,
        'baseline_method': 'arpls',
        'baseline_lambda': float(lam_rigid),
        'broad_width_deg': float(broad_width_deg),
        'peak_sigma_k': float(k_sigma),

        'n_peaks_k3': int(peaks.size),
        'n_peaks_k5': int(peaks_k5.size),
        'n_peaks_below_15deg': n_below_window,
        'two_theta_first_peak': two_theta_first,
        'd_max_angstrom': d_max,
        # True when the first reflection sits on the 5 deg cutoff, i.e. the real
        # largest spacing may be bigger than d_max_angstrom and simply outside
        # this diffractometer's window. Without this flag a saturated value looks
        # like a measurement instead of a lower bound.
        'd_max_saturated': d_max_saturated,
        'fwhm_median_deg': fwhm_median,
        'fwhm_min_deg': fwhm_min,
        'scherrer_size_nm': scherrer_nm,

        'crystalline_fraction': crystalline_fraction,
        'signal_snr_area': signal_snr_area,
        'crystallinity_reliable': crystallinity_reliable,
        'crystalline_area': area_crystalline,
        'amorphous_area': area_amorphous,
        'amorphous_hump_center': hump_center,
        'amorphous_hump_fwhm': hump_fwhm,
        'frac_intensity_below_15deg': frac_below_window,
        'peak_to_background_ratio': peak_to_background,

        'spectral_entropy': spectral_entropy,
        'snr_global': snr_global,
        'raw_counts_max': float(np.max(y_raw)),
    }

    if return_curves:
        descriptors['_curves'] = {
            'x': x, 'y_raw': y_raw, 'normalized': normalized,
            'instrumental': instrumental, 'amorphous': amorphous,
            'crystalline': crystalline, 'net': net, 'narrow': narrow,
            'broad_raw': layers['broad_raw'], 'pedestal': layers['pedestal'],
            'peaks': peaks, 'fwhm_deg': fwhm_deg, 'noise_level': noise,
        }

    return descriptors


DESCRIPTOR_COLUMNS = [
    # v3.0 headline numbers: diffuse content measured against the empty instrument.
    # These are the ones to use. `crystalline_fraction` further down is retained for
    # continuity and ranking only - its two ends are artefacts of the v2.0 method.
    'amorphous_fraction_blank', 'crystalline_fraction_blank', 'blank_scale_factor',
    'pipeline_version', 'baseline_method', 'baseline_lambda',
    'broad_width_deg', 'peak_sigma_k',
    'n_peaks_k3', 'n_peaks_k5', 'n_peaks_below_15deg', 'two_theta_first_peak',
    'd_max_angstrom', 'd_max_saturated', 'fwhm_median_deg', 'fwhm_min_deg',
    'scherrer_size_nm',
    'crystalline_fraction', 'signal_snr_area', 'crystallinity_reliable',
    'crystalline_area', 'amorphous_area',
    'amorphous_hump_center', 'amorphous_hump_fwhm', 'frac_intensity_below_15deg',
    'peak_to_background_ratio', 'spectral_entropy', 'snr_global', 'raw_counts_max',
]
