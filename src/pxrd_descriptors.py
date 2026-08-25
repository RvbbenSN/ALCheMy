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
about crystallisation yield the project needs. So two arPLS passes are run with
different stiffness: a rigid one (large lambda) that can only follow (a), and a
flexible one that follows (a)+(b) but is still too stiff to climb a sharp Bragg
peak. Subtracting one from the other separates the three layers cleanly.

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
PIPELINE_VERSION = 'v1.0'

# ---------------------------------------------------------------------------
# Canonical angular grid.
# 3 to 50 degrees covers everything structurally relevant in MOFs without
# dragging in the noisy high-angle tail. A 0.02 degree step is finer than the
# narrowest peak the instrument resolves, so nothing is lost by resampling.
# ---------------------------------------------------------------------------
GRID_2THETA = np.arange(3.0, 50.0, 0.02)
STEP_2THETA = 0.02

# Cu K-alpha1 wavelength in angstroms, needed for the Bragg conversion.
WAVELENGTH_CU_KA1 = 1.540598

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

    # The halo can never be higher than the signal it is part of, nor negative.
    return np.clip(broad, 0.0, net)


def decompose_profile(y_raw, x,
                      lam_rigid=DEFAULT_LAMBDA_RIGID,
                      broad_width_deg=BROAD_WIDTH_DEG):
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

    amorphous = broad_component(net, step=step, width_deg=broad_width_deg)
    crystalline = np.maximum(net - amorphous, 0.0)

    return {
        'normalized': normalized,
        'instrumental': instrumental,
        'amorphous': amorphous,
        'crystalline': crystalline,
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


def extract_descriptors(x, y_raw, sample_code='SAMPLE',
                        lam_rigid=DEFAULT_LAMBDA_RIGID,
                        broad_width_deg=BROAD_WIDTH_DEG,
                        k_sigma=DEFAULT_K_SIGMA,
                        return_curves=False):
    """
    Computes the full descriptor vector for one already-resampled profile.

    x and y_raw must already be on a common grid and restricted to the angular
    range actually measured (use resample_to_grid first).
    """
    x = np.asarray(x, dtype=float)
    y_raw = np.asarray(y_raw, dtype=float)

    layers = decompose_profile(y_raw, x, lam_rigid=lam_rigid,
                               broad_width_deg=broad_width_deg)
    normalized = layers['normalized']
    instrumental = layers['instrumental']
    amorphous = layers['amorphous']
    crystalline = layers['crystalline']
    net = layers['net']

    noise = poisson_noise_level(y_raw, x)
    peaks, fwhm_deg = detect_peaks_poisson(x, crystalline, noise, k_sigma=k_sigma)
    peaks_k5, _fwhm_k5 = detect_peaks_poisson(x, crystalline, noise, k_sigma=5.0)

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
        n_below_10 = int(np.sum(x[peaks] < 10.0))
    else:
        two_theta_first = d_max = fwhm_median = fwhm_min = scherrer_nm = float('nan')
        n_below_10 = 0

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

    below_10 = x < 10.0
    frac_below_10 = float(integrate(normalized[below_10], x[below_10])) if below_10.any() else 0.0

    background_level = float(np.median(instrumental))
    peak_to_background = float(np.max(crystalline) / (background_level + 1e-12))

    # ---- global descriptors ----------------------------------------------
    # Shannon entropy of the net pattern treated as a probability distribution.
    # It measures HOW SPREAD OUT the diffracted intensity is across the angular
    # range, and needs no peak detection at all, which is why it still returns a
    # meaningful number on a completely amorphous sample.
    #
    # Note the direction, which is the opposite of the textbook intuition: a
    # purely amorphous sample concentrates all its net intensity into one halo
    # and therefore scores LOW, while a well-crystallised sample spreads it over
    # many reflections across the whole range and scores HIGH. Measured over 60
    # real patterns from this corpus, entropy correlates +0.70 with the
    # crystalline fraction. (Computing it on the full normalised pattern instead
    # of the net one destroys this: the flat instrumental background dominates,
    # every sample saturates near the maximum log2(N), and the correlation
    # collapses to +0.04.)
    net_prob = normalize_by_area(net, x) * float(x[1] - x[0])
    p = net_prob[net_prob > 0]
    spectral_entropy = float(-np.sum(p * np.log2(p))) if p.size else float('nan')

    # A real signal-to-noise ratio: how far the net signal rises above the
    # Poisson noise, both measured in the same normalised units. (Dividing the
    # maximum raw count by its own square root would merely return
    # sqrt(maximum) again - a copy of raw_counts_max under another name,
    # carrying no independent information about the pattern.)
    snr_global = float(np.max(net) / (noise + 1e-12))

    descriptors = {
        'sample_code': sample_code,
        'pipeline_version': PIPELINE_VERSION,
        'baseline_method': 'arpls',
        'baseline_lambda': float(lam_rigid),
        'broad_width_deg': float(broad_width_deg),
        'peak_sigma_k': float(k_sigma),

        'n_peaks_k3': int(peaks.size),
        'n_peaks_k5': int(peaks_k5.size),
        'n_peaks_below_10deg': n_below_10,
        'two_theta_first_peak': two_theta_first,
        'd_max_angstrom': d_max,
        'fwhm_median_deg': fwhm_median,
        'fwhm_min_deg': fwhm_min,
        'scherrer_size_nm': scherrer_nm,

        'crystalline_fraction': crystalline_fraction,
        'crystalline_area': area_crystalline,
        'amorphous_area': area_amorphous,
        'amorphous_hump_center': hump_center,
        'amorphous_hump_fwhm': hump_fwhm,
        'frac_intensity_below_10deg': frac_below_10,
        'peak_to_background_ratio': peak_to_background,

        'spectral_entropy': spectral_entropy,
        'snr_global': snr_global,
        'raw_counts_max': float(np.max(y_raw)),
    }

    if return_curves:
        descriptors['_curves'] = {
            'x': x, 'y_raw': y_raw, 'normalized': normalized,
            'instrumental': instrumental, 'amorphous': amorphous,
            'crystalline': crystalline, 'net': net,
            'peaks': peaks, 'fwhm_deg': fwhm_deg, 'noise_level': noise,
        }

    return descriptors


DESCRIPTOR_COLUMNS = [
    'pipeline_version', 'baseline_method', 'baseline_lambda',
    'broad_width_deg', 'peak_sigma_k',
    'n_peaks_k3', 'n_peaks_k5', 'n_peaks_below_10deg', 'two_theta_first_peak',
    'd_max_angstrom', 'fwhm_median_deg', 'fwhm_min_deg', 'scherrer_size_nm',
    'crystalline_fraction', 'crystalline_area', 'amorphous_area',
    'amorphous_hump_center', 'amorphous_hump_fwhm', 'frac_intensity_below_10deg',
    'peak_to_background_ratio', 'spectral_entropy', 'snr_global', 'raw_counts_max',
]
