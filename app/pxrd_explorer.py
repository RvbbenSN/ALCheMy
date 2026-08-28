"""
ALCheMy - PXRD descriptor explorer (READ-ONLY)

THIS APP NEVER WRITES TO THE DATABASE
-------------------------------------
That is the whole premise, and it is enforced in three independent places rather
than left to good intentions:

  1. The connection opens the session as `TRANSACTION READ ONLY`, so PostgreSQL
     itself rejects any INSERT / UPDATE / DELETE / DDL with an error. This is the
     one that actually has teeth - it holds even if someone adds a careless
     statement later.
  2. `_read()` refuses to send anything that does not begin with SELECT or WITH.
  3. There is no write path in the file at all: no INSERT, no UPDATE, no UPSERT.

Why it matters here more than in most apps: the point of this tool is to move the
pipeline's parameters around and see what happens. If a value computed with
lambda = 1e4 could reach `pxrd_descriptors`, the table would hold rows whose
`pipeline_version` says v3.3 while their numbers came from somewhere else - the
exact silent contamination that src/PXRD_PIPELINE_CHANGELOG.md exists to prevent.
So the sandbox is sealed shut. What you see here is never saved anywhere.

WHAT IT IS FOR
--------------
`src/pxrd_descriptors.py` turns a diffractogram into 29 numbers through a chain of
operations - arPLS baseline, width-selective separation, blank subtraction, peak
detection - each with parameters that were chosen and justified in notebook 05.
The notebook argues those choices on a handful of examples. This app is the other
half: it lets you move each parameter and watch what it does, on any pattern you
pick, filtered by the hand labels.

Two questions it is built to answer, in order of how much they matter:

  * "What does this operation actually do to THIS pattern?" - the single-pattern
    view, with the layers drawn and the descriptor vector recomputing live next to
    the values the defaults would give.
  * "Is it consistent across MANY patterns?" - the batch view, which applies the
    current settings to every pattern in the current filter and reports the median
    descriptor per hand-assigned class, against the same figure under the defaults.
    Looking at patterns one at a time answers this very slowly; this answers it in
    one click.

The second one is where the real value is. A parameter change that makes one
diffractogram look nicer and destroys the separation between AMORFO and CRISTALINO
across 400 of them is a bad change, and only the batch view will tell you.

WHY IT IS SEPARATE FROM THE LABELLER
------------------------------------
`app/pxrd_labeler.py` is tuned for one-handed phone use and several hundred
judgements per sitting: no scrolling, one tap per decision. This is a desk tool
full of sliders. Merging them would ruin both. They do share the infrastructure
that was worth sharing - cached connection with stale-socket retry, cached curve
loading, the label filter, and the visual palette.

RUN IT
------
    streamlit run app/pxrd_explorer.py

Requires the stack up (`docker compose up -d`) and `.env` at the repository root.
"""
import json
import os
import sys

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import psycopg2
import psycopg2.extras
import streamlit as st
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE_DIR, 'src'))
load_dotenv(os.path.join(BASE_DIR, '.env'))

from pxrd_descriptors import (                                          # noqa: E402
    PIPELINE_VERSION, DESCRIPTOR_COLUMNS,
    DEFAULT_LAMBDA_RIGID, BROAD_WIDTH_DEG, BROAD_PEDESTAL_PCT,
    BLANK_SCALE_FROM_DEG, LOW_ANGLE_WINDOW_DEG,
    resample_to_grid, decompose_profile, detect_peaks_poisson,
    extract_descriptors, amorphous_from_blank, peak_k_sigma,
    load_instrument_blank, integrate,
)

# Same palette as the labelling app, so the two feel like one toolkit.
C_RAW = '#263238'
C_BASE = '#e07b39'
C_AMOR = '#e8a33d'
C_CRYS = '#1f7a8c'
C_PEAK = '#c0392b'
C_INST = '#b0bec5'
C_REF = '#9e9e9e'          # the defaults, drawn underneath as the term of comparison

XLAB = r'$2\theta$ (degrees, Cu K$\alpha_1$)'

CLASSES = ['AMORFO', 'INCIPIENTE', 'CRISTALINO', 'MEZCLA', 'SIN_MUESTRA']
SUBTYPES = ['HALO_DOMINANTE', 'PICOS_ANCHOS', 'CRISTALITO_PEQUENO']

# The descriptors worth watching in the batch view. Not all 29: these are the ones
# whose whole job is to separate the classes, so they are the ones a parameter
# change can help or ruin.
BATCH_DESCRIPTORS = [
    'amorphous_fraction_blank', 'crystalline_fraction', 'n_peaks',
    'fwhm_median_deg', 'spectral_entropy', 'peak_to_background_ratio',
    'scherrer_size_nm', 'd_max_angstrom', 'snr_global',
]

st.set_page_config(page_title='ALCheMy - PXRD Explorer', page_icon='🎛️',
                   layout='wide', initial_sidebar_state='expanded')

st.markdown("""
<style>
header[data-testid="stHeader"] { height: 2.2rem; }
div.block-container { padding-top: 2.6rem !important; padding-bottom: 1rem !important; }
[data-testid="stExpander"] summary { padding: 0.35rem 0.6rem !important; min-height: 0 !important; }
[data-testid="stMetricValue"] { font-size: 1.35rem; }
</style>
""", unsafe_allow_html=True)


# ==========================================================================
# Database access - read only, and made so by the database, not by politeness
# ==========================================================================

@st.cache_resource
def get_connection():
    """
    One connection per Streamlit session, opened READ ONLY.

    `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY` makes PostgreSQL reject
    every write on this connection. It is set on the server side on purpose: a
    Python-side flag can be forgotten or overridden by a later edit, a server-side
    session characteristic cannot.
    """
    conn = psycopg2.connect(
        host=os.getenv('POSTGRES_HOST', 'localhost'),
        port=int(os.getenv('POSTGRES_PORT', 5432)),
        dbname=os.getenv('POSTGRES_DB', 'alchemy_db'),
        user=os.getenv('POSTGRES_USER'),
        password=os.getenv('POSTGRES_PASSWORD'),
    )
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;')
    return conn


def _read(sql, params=None, fetch='all'):
    """
    Runs a SELECT, reconnecting once if the socket went stale.

    The guard is a second lock on top of the read-only session: it fails loudly at
    the app, before the statement ever leaves, so a mistake shows up as an obvious
    error rather than as a database permission message buried in a stack trace.

    The retry exists because Docker Desktop drops its port forwarding when the host
    sleeps; without it the app dies mid-session.
    """
    head = sql.lstrip().lstrip('(').upper()
    if not (head.startswith('SELECT') or head.startswith('WITH')):
        raise RuntimeError('pxrd_explorer is read-only: refusing to run %r' % sql[:60])
    for attempt in (1, 2):
        try:
            conn = get_connection()
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute(sql, params)
                return cur.fetchall() if fetch == 'all' else cur.fetchone()
        except (psycopg2.OperationalError, psycopg2.InterfaceError):
            if attempt == 2:
                raise
            get_connection.clear()
    return None


@st.cache_data(ttl=300, show_spinner='Cargando el catálogo de difractogramas...')
def load_catalogue():
    """
    One row per diffractogram with its hand labels attached, WITHOUT the curve.

    The labels are joined here rather than fetched separately so the sidebar filter
    is a pandas operation on a table already in memory - no round trip per click.
    Excluding data_json is what keeps this under a second: the same rows with their
    curves would be hundreds of megabytes.
    """
    rows = _read("""
        SELECT m.measurement_id::text                      AS measurement_id,
               m.sample_code,
               m.file_name,
               m.technique,
               m.measurement_tag,
               COALESCE(s.metal_center, '?')               AS metal_center,
               COALESCE(s.linker, '?')                     AS linker,
               lc.label_value                              AS crystallinity_class,
               ls.label_value                              AS incipient_subtype,
               lo.label_value                              AS oxide_flag,
               d.pipeline_version,
               COALESCE(dup.n_class_labels, 0)              AS n_class_labels_in_sample
          FROM characterization_measurements m
          LEFT JOIN synthesis_experiments s ON s.sample_code = m.sample_code
          LEFT JOIN pxrd_labels lc ON lc.measurement_id = m.measurement_id
                                  AND lc.label_type = 'crystallinity_class'
          LEFT JOIN pxrd_labels ls ON ls.measurement_id = m.measurement_id
                                  AND ls.label_type = 'incipient_subtype'
          LEFT JOIN pxrd_labels lo ON lo.measurement_id = m.measurement_id
                                  AND lo.label_type = 'oxide_flag'
          LEFT JOIN pxrd_descriptors d ON d.measurement_id = m.measurement_id
          LEFT JOIN (
              -- Cuantas mediciones (measurement_id distintos) de la MISMA muestra
              -- tienen su propia etiqueta de crystallinity_class. >1 significa que
              -- sample_code tiene varias mediciones PXRD etiquetadas por separado
              -- -- util para la revision de "que medicion nos quedamos" antes de ML,
              -- ver methodology/DIARIO_DE_PROYECTO.md Sesion 34.
              SELECT cm.sample_code, count(*) AS n_class_labels
                FROM pxrd_labels pl
                JOIN characterization_measurements cm ON cm.measurement_id = pl.measurement_id
               WHERE pl.label_type = 'crystallinity_class' AND pl.label_value <> 'SIN_MUESTRA'
               GROUP BY cm.sample_code
          ) dup ON dup.sample_code = m.sample_code
         WHERE m.technique IN ('PXRD', 'VT-XRD')
           AND jsonb_array_length(m.data_json->'raw_data'->'x') > 100
         ORDER BY m.sample_code, m.file_name;
    """)
    return pd.DataFrame([dict(r) for r in rows])


@st.cache_data(max_entries=256, show_spinner=False)
def load_curve(measurement_id):
    """One diffractogram, already resampled onto the canonical grid and trimmed to
    the range actually measured. Cached, so stepping back and forth is instant."""
    row = _read("""
        SELECT data_json->'raw_data'->>'x' AS x,
               data_json->'raw_data'->>'y' AS y
          FROM characterization_measurements
         WHERE measurement_id = %s;
    """, (measurement_id,), fetch='one')
    if row is None or row['x'] is None:
        return None, None
    x_raw = np.asarray(json.loads(row['x']), dtype=float)
    y_raw = np.asarray(json.loads(row['y']), dtype=float)
    if x_raw.size < 2:
        return None, None
    grid, y_grid, valid = resample_to_grid(x_raw, y_raw)
    if valid.sum() < 200:
        return None, None
    return grid[valid], y_grid[valid]


@st.cache_resource(show_spinner=False)
def load_blank():
    """The empty-instrument scan, on the full canonical grid. One per session."""
    try:
        return load_instrument_blank(get_connection())
    except Exception:
        return None


def blank_for(x):
    """
    The blank cut to the same stretch as this curve.

    The two arrays have to line up point for point, and a scan that starts at 6
    degrees or stops at 35 covers only part of the canonical grid. Matching by
    value rather than by index is what makes a short scan work at all.
    """
    blank = load_blank()
    if blank is None:
        return None
    from pxrd_descriptors import GRID_2THETA
    if blank.size != GRID_2THETA.size:
        return None
    mask = np.isin(np.round(GRID_2THETA, 4), np.round(x, 4))
    return blank[mask] if mask.sum() == x.size else None


# ==========================================================================
# The computation, cached on (measurement, parameters)
# ==========================================================================

DEFAULTS = {
    'lam_rigid': DEFAULT_LAMBDA_RIGID,
    'broad_width_deg': BROAD_WIDTH_DEG,
    'pedestal_pct': BROAD_PEDESTAL_PCT,
    'k_sigma': 3.0,
    'peak_k_override': None,
    'blank_scale_from_deg': BLANK_SCALE_FROM_DEG,
    'smooth_blank': True,
    'use_blank': True,
}


@st.cache_data(max_entries=512, show_spinner=False)
def compute(measurement_id, params_key, want_curves):
    """
    The descriptor vector for one measurement under one set of parameters.

    Cached on (measurement, parameters) because arPLS is a sparse solve run to
    convergence - roughly 50 iterations over a few thousand points. Recomputing it
    on every Streamlit re-run (which is every widget interaction) would make the app
    crawl. With the cache, going back to a setting you already tried is instant.

    `params_key` is a tuple rather than a dict because st.cache_data hashes its
    arguments and a dict is not hashable.
    """
    p = dict(params_key)
    x, y = load_curve(measurement_id)
    if x is None:
        return None
    blank = blank_for(x) if p['use_blank'] else None
    d = extract_descriptors(
        x, y,
        lam_rigid=p['lam_rigid'],
        broad_width_deg=p['broad_width_deg'],
        k_sigma=p['k_sigma'],
        pedestal_pct=p['pedestal_pct'],
        peak_k_override=p['peak_k_override'],
        blank_scale_from_deg=p['blank_scale_from_deg'],
        smooth_blank=p['smooth_blank'],
        blank_grid=blank,
        return_curves=want_curves,
    )
    return d


def as_key(params):
    return tuple(sorted(params.items()))


def layer_curves(x, y, params):
    """
    The intermediate curves the figure draws: instrumental background, diffuse
    halo and Bragg peaks, under the given parameters.

    Recomputed here rather than pulled out of `compute` because the figure wants
    them on the plotting grid with the blank already subtracted, which is a
    different shape from what the descriptor dict carries.
    """
    layers = decompose_profile(y, x,
                               lam_rigid=params['lam_rigid'],
                               broad_width_deg=params['broad_width_deg'],
                               k_sigma=params['k_sigma'],
                               pedestal_pct=params['pedestal_pct'])
    normalized = layers['normalized']
    baseline = layers['instrumental']
    blank = blank_for(x) if params['use_blank'] else None
    if blank is not None:
        diffuse, _frac, _scale = amorphous_from_blank(
            x, normalized, blank, baseline=baseline,
            lam_rigid=params['lam_rigid'],
            scale_from_deg=params['blank_scale_from_deg'],
            smooth_blank=params['smooth_blank'])
    else:
        diffuse = None
    if diffuse is None:
        diffuse = layers['amorphous']
    instrument = np.maximum(baseline - diffuse, 0.0)
    return layers, normalized, baseline, diffuse, instrument


# ==========================================================================
# Figures
# ==========================================================================

def plot_pattern(x, y, params, d, show_reference, d_ref):
    """Panel 1: the pattern with its phase layers and the accepted reflections."""
    layers, normalized, baseline, diffuse, instrument = layer_curves(x, y, params)
    peaks = d['_curves']['peaks'] if '_curves' in d else np.array([], dtype=int)

    fig, ax = plt.subplots(figsize=(13.5, 4.8))
    ax.axvspan(x[0], min(LOW_ANGLE_WINDOW_DEG, x[-1]), color='#90a4ae', alpha=0.13, zorder=0)
    if x[-1] > params['blank_scale_from_deg']:
        ax.axvspan(params['blank_scale_from_deg'], x[-1], color='#5c6bc0', alpha=0.09, zorder=0)

    ax.fill_between(x, 0, instrument, color=C_INST, alpha=0.75, zorder=1,
                    label='Instrument')
    ax.fill_between(x, instrument, baseline, where=baseline > instrument,
                    color=C_AMOR, alpha=0.60, zorder=1, label='Diffuse (halo)')
    ax.plot(x, normalized, lw=0.75, color=C_RAW, zorder=3, label='Measured')
    ax.plot(x, baseline, lw=1.5, color=C_BASE, zorder=4, label='arPLS baseline')

    if show_reference and d_ref is not None:
        _l, _n, base_ref, _dif, _ins = layer_curves(x, y, DEFAULTS)
        ax.plot(x, base_ref, lw=1.2, color=C_REF, ls='--', zorder=2,
                label='Baseline, defaults')

    if peaks is not None and len(peaks):
        ax.plot(x[peaks], normalized[peaks], 'v', ms=6, color=C_PEAK, zorder=5,
                label='%d reflections (k=%.2f$\\sigma$)' % (len(peaks), d['peak_sigma_k']))

    ax.set_xlim(x[0], x[-1])
    ax.set_ylim(0, float(np.max(normalized)) * 1.10)
    ax.set_xlabel(XLAB)
    ax.set_ylabel('Normalised intensity (a.u.)')
    ax.legend(fontsize=8, ncol=6, loc='lower left', bbox_to_anchor=(0, 1.005), frameon=False)
    fig.tight_layout()
    return fig


def plot_threshold(x, y, params, d):
    """
    Panel 2: the narrow component against the thresholds.

    This is the panel that shows WHY a reflection was or was not accepted, which
    the pattern view cannot: on an amorphous sample the 3-sigma line runs through
    the middle of the counting noise while the calibrated one sits above it.
    """
    layers = decompose_profile(y, x,
                               lam_rigid=params['lam_rigid'],
                               broad_width_deg=params['broad_width_deg'],
                               k_sigma=params['k_sigma'],
                               pedestal_pct=params['pedestal_pct'])
    narrow = np.maximum(layers['net'] - layers['broad_raw'], 0.0)
    noise = layers['sigma']
    step = float(x[1] - x[0])
    k_auto = peak_k_sigma(x.size, max(1, int(round(0.20 / step))))
    k_used = d['peak_sigma_k']

    fig, ax = plt.subplots(figsize=(13.5, 3.0))
    ax.plot(x, narrow, lw=0.75, color=C_RAW)
    ax.axhline(3 * noise, color=C_CRYS, ls='--', lw=1.3, label=r'3$\sigma$ (single test)')
    ax.axhline(k_auto * noise, color='#7e57c2', ls='-.', lw=1.3,
               label='%.2f$\\sigma$ (calibrated)' % k_auto)
    if abs(k_used - k_auto) > 1e-6:
        ax.axhline(k_used * noise, color=C_PEAK, ls=':', lw=1.6,
                   label='%.2f$\\sigma$ (in use)' % k_used)
    peaks, _fw = detect_peaks_poisson(x, narrow, noise, k_sigma=k_used)
    if peaks.size:
        ax.plot(x[peaks], narrow[peaks], 'v', ms=6, color=C_PEAK)
    ax.set_xlim(x[0], x[-1])
    ax.set_ylim(0, max(float(np.percentile(narrow, 99.9)) * 1.4, k_used * noise * 2.5))
    ax.set_xlabel(XLAB)
    ax.set_ylabel('Narrow (a.u.)')
    ax.legend(fontsize=8, ncol=3, loc='upper right', frameon=False)
    fig.tight_layout()
    return fig


# ==========================================================================
# Sidebar
# ==========================================================================

catalogue = load_catalogue()

st.sidebar.title('🎛️ PXRD Explorer')
st.sidebar.caption('Read-only sandbox · pipeline %s' % PIPELINE_VERSION)

# ---- ML review shortcut ---------------------------------------------------
# Filtro puntual para las 3 revisiones que preceden al primer dataset de ML
# (methodology/DIARIO_DE_PROYECTO.md Sesion 34). Por defecto en "(ninguno)":
# no cambia nada del comportamiento habitual de la app hasta que se elige uno.
REVIEW_GROUPS = {
    '(ninguno)': None,
    'Muestras con más de una etiqueta': lambda df: df['n_class_labels_in_sample'] > 1,
    'MEZCLA (revisar si se funden con AMORFO)': lambda df: df['crystallinity_class'] == 'MEZCLA',
    'AMORFO marcado como óxido': lambda df: (df['crystallinity_class'] == 'AMORFO')
                                            & (df['oxide_flag'] == 'SI'),
}
st.sidebar.subheader('0 · Revisión puntual para ML')
review_choice = st.sidebar.selectbox(
    'Grupo a revisar', list(REVIEW_GROUPS.keys()), index=0,
    help='Atajo temporal para las revisiones pendientes antes de construir el '
         'dataset de entrenamiento. No afecta a nada más de la app; se combina '
         'con el filtro de abajo.')

# ---- filter --------------------------------------------------------------
st.sidebar.subheader('1 · Qué patrones')
label_filter = st.sidebar.multiselect(
    'Clase etiquetada a mano', CLASSES + ['(sin etiqueta)'], default=[],
    help='Vacío = todos. Es el filtro que permite recorrer casos comparables seguidos.')
subtype_filter = st.sidebar.multiselect('Subtipo de incipiente', SUBTYPES, default=[])
text_filter = st.sidebar.text_input('Buscar por código o fichero', '').strip()

view = catalogue
review_mask_fn = REVIEW_GROUPS[review_choice]
if review_mask_fn is not None:
    view = view[review_mask_fn(view)]
    st.sidebar.caption('Revisión activa: **%s** · %d difractogramas' % (review_choice, len(view)))
if label_filter:
    wanted = [c for c in label_filter if c != '(sin etiqueta)']
    mask = view['crystallinity_class'].isin(wanted)
    if '(sin etiqueta)' in label_filter:
        mask = mask | view['crystallinity_class'].isna()
    view = view[mask]
if subtype_filter:
    view = view[view['incipient_subtype'].isin(subtype_filter)]
if text_filter:
    low = text_filter.lower()
    view = view[view['sample_code'].str.lower().str.contains(low, na=False) |
                view['file_name'].str.lower().str.contains(low, na=False)]
view = view.reset_index(drop=True)

st.sidebar.caption('%d de %d difractogramas' % (len(view), len(catalogue)))
if view.empty:
    st.warning('Ningún difractograma pasa el filtro. Afloja las condiciones en la barra lateral.')
    st.stop()

# ---- navigation ----------------------------------------------------------
if 'idx' not in st.session_state:
    st.session_state.idx = 0
st.session_state.idx = min(st.session_state.idx, len(view) - 1)

nav_prev, nav_next = st.sidebar.columns(2)
if nav_prev.button('◀ Anterior', width='stretch'):
    st.session_state.idx = max(0, st.session_state.idx - 1)
if nav_next.button('Siguiente ▶', width='stretch'):
    st.session_state.idx = min(len(view) - 1, st.session_state.idx + 1)

options = ['%s · %s' % (r.sample_code, r.file_name) for r in view.itertuples()]
picked = st.sidebar.selectbox('Difractograma', options, index=st.session_state.idx)
st.session_state.idx = options.index(picked)
row = view.iloc[st.session_state.idx]

# ---- parameters ----------------------------------------------------------
st.sidebar.subheader('2 · Qué operaciones')
st.sidebar.caption('Los valores por defecto son los de %s. Nada de esto se guarda.'
                   % PIPELINE_VERSION)

if st.sidebar.button('↺ Volver a los valores por defecto', width='stretch'):
    for k in list(st.session_state.keys()):
        if k.startswith('p_'):
            del st.session_state[k]
    st.rerun()

with st.sidebar.expander('Línea base — arPLS', expanded=True):
    lam_exp = st.slider('log₁₀ λ (rigidez)', 3.0, 9.0, float(np.log10(DEFAULT_LAMBDA_RIGID)),
                        0.25, key='p_lam',
                        help='Bajo = la línea base se dobla y se traga el halo. '
                             'Alto = demasiado rígida y deja fondo detrás. '
                             'Por defecto 1e6, elegido en el barrido del cuaderno §6.')
    lam_rigid = 10.0 ** lam_exp

with st.sidebar.expander('Separación por anchura', expanded=False):
    broad_width = st.slider('Ventana de la mediana móvil (°)', 0.5, 8.0,
                            float(BROAD_WIDTH_DEG), 0.25, key='p_broad',
                            help='Debe ser mucho más ancha que la reflexión más ancha '
                                 '(~0,35°) y mucho más estrecha que el halo (5-15°).')
    pedestal = st.slider('Percentil del pedestal', 0.0, 25.0,
                         float(BROAD_PEDESTAL_PCT), 0.5, key='p_ped',
                         help='Nivel al que vuelve la componente ancha donde no hay halo. '
                              'arPLS devuelve el SUELO, así que queda un pedestal que es '
                              'artefacto y hay que restar.')
    k_sigma = st.slider('k del gate de la componente cristalina (σ)', 0.0, 8.0, 3.0, 0.5,
                        key='p_ksig',
                        help='Contraste por punto: aquí 3σ sí es el nivel correcto, '
                             'porque es un solo contraste por punto.')

with st.sidebar.expander('Blanco del aparato', expanded=False):
    use_blank = st.checkbox('Restar el blanco', value=True, key='p_useblank',
                            help='Desactivado, la fracción amorfa cae al método por '
                                 'anchura, que sobrestima bajo racimos de picos.')
    smooth_blank = st.checkbox('Suavizar el blanco antes de restar', value=True,
                               key='p_smooth',
                               help='El blanco tiene ~80 cuentas, un 11 % de ruido '
                                    'relativo. Sin suavizar, ese ruido entra entero '
                                    'en la curva difusa (v3.1).')
    scale_from = st.slider('Ventana de escalado (° desde)', 30.0, 49.0,
                           float(BLANK_SCALE_FROM_DEG), 0.5, key='p_scale',
                           help='Arriba de este ángulo se supone que la muestra ya no '
                                'dispersa difusamente y lo que queda es el aparato.')

with st.sidebar.expander('Detección de picos', expanded=True):
    k_mode = st.radio('Umbral', ['Calibrado (v3.3)', 'Manual'], index=0, key='p_kmode',
                      help='Calibrado: k se deriva de la longitud del barrido para '
                           'que se esperen 0,05 picos falsos. Manual: para ver qué '
                           'pasaba con el 3σ de antes.')
    peak_k_override = None
    if k_mode == 'Manual':
        peak_k_override = st.slider('k de picos (σ)', 1.0, 10.0, 3.0, 0.1, key='p_kpeak')

params = {
    'lam_rigid': lam_rigid,
    'broad_width_deg': broad_width,
    'pedestal_pct': pedestal,
    'k_sigma': k_sigma,
    'peak_k_override': peak_k_override,
    'blank_scale_from_deg': scale_from,
    'smooth_blank': smooth_blank,
    'use_blank': use_blank,
}
modified = {k: v for k, v in params.items() if DEFAULTS[k] != v}


# ==========================================================================
# Main - single pattern
# ==========================================================================

st.title('Explorador de descriptores PXRD')
if modified:
    st.warning('**%d parámetro(s) fuera de los valores por defecto.** Los números de '
               'abajo NO son los que hay en `pxrd_descriptors`; esta app no escribe '
               'nada. · %s'
               % (len(modified), ', '.join('`%s`' % k for k in sorted(modified))))
else:
    st.success('Parámetros en los valores por defecto de %s: lo que se ve aquí es lo '
               'mismo que hay guardado en `pxrd_descriptors`.' % PIPELINE_VERSION)

head = st.columns([2, 2, 2, 2, 3])
head[0].metric('Muestra', row['sample_code'])
head[1].metric('Etiqueta', row['crystallinity_class'] or '—')
head[2].metric('Subtipo', row['incipient_subtype'] or '—')
head[3].metric('Técnica', row['technique'])
head[4].caption('**Metal** %s · **Linker** %s\n\n`%s`'
                % (row['metal_center'], row['linker'], row['file_name']))

x, y = load_curve(row['measurement_id'])
if x is None:
    st.error('Esta medida no tiene curva utilizable (probablemente `raw_data.x` vacío).')
    st.stop()

d = compute(row['measurement_id'], as_key(params), True)
d_ref = compute(row['measurement_id'], as_key(DEFAULTS), False)
if d is None:
    st.error('No se ha podido calcular el vector para esta medida.')
    st.stop()

show_ref = st.checkbox('Superponer la línea base con los valores por defecto',
                       value=bool(modified))
st.pyplot(plot_pattern(x, y, params, d, show_ref, d_ref), width='stretch')

with st.expander('Por qué se acepta cada pico — componente estrecha contra el umbral',
                 expanded=True):
    st.pyplot(plot_threshold(x, y, params, d), width='stretch')
    st.caption('3σ es el nivel de significación para **un** contraste. Detectar picos '
               'es una **búsqueda** sobre unas 225 oportunidades independientes por '
               'barrido, así que el umbral se corrige por comparaciones múltiples: '
               'k = √2·Φ⁻¹(1 − α/2n_eff). Ver cuaderno 05 §8.2.')

# ---- the vector ----------------------------------------------------------
st.subheader('El vector de descriptores')

def cell(v):
    if v is None or (isinstance(v, float) and not np.isfinite(v)):
        return None
    return v


def show(v):
    """
    El valor tal y como se enseña, SIEMPRE como texto.

    El vector mezcla tipos en una misma columna: `pipeline_version` es una cadena,
    `d_max_saturated` un booleano y el resto números. Streamlit convierte el
    DataFrame a Arrow para dibujarlo, y Arrow exige un tipo único por columna, así
    que con los tipos crudos la tabla entera fallaba con ArrowInvalid - sin romper
    la app, simplemente no aparecía. Formatear aquí también evita que un valor con
    quince decimales se coma el ancho de la columna.
    """
    if v is None:
        return '—'
    if isinstance(v, bool):
        return 'sí' if v else 'no'
    if isinstance(v, (int, np.integer)):
        return str(int(v))
    if isinstance(v, (float, np.floating)):
        a = abs(v)
        if a != 0 and (a < 1e-3 or a >= 1e5):
            return '%.4g' % v
        return '%.4f' % v
    return str(v)


table = []
for col in DESCRIPTOR_COLUMNS:
    now, ref = cell(d.get(col)), cell(d_ref.get(col) if d_ref else None)
    delta = None
    if isinstance(now, (int, float)) and isinstance(ref, (int, float)) \
            and not isinstance(now, bool) and not isinstance(ref, bool) \
            and abs(ref) > 1e-12:
        delta = 100.0 * (float(now) - float(ref)) / abs(float(ref))
    # `cambio` se guarda aparte y numérico: es la única columna con un tipo propio,
    # y es la que ordena y colorea la tabla.
    table.append({'descriptor': col,
                  'con estos parámetros': show(now),
                  'por defecto': show(ref),
                  'cambio %': delta,
                  '_dif': (abs(delta) if delta is not None
                           else (0.0 if show(now) == show(ref) else float('inf')))})
frame = pd.DataFrame(table)

only_changed = st.checkbox('Enseñar solo lo que ha cambiado', value=bool(modified))
# El filtro usa `_dif` y no `cambio %`: un descriptor que pasa de un número a NULL
# (al desactivar el blanco, por ejemplo) no tiene cambio porcentual pero sí ha
# cambiado, y era justo el caso que interesaba ver.
shown = frame[frame['_dif'] > 0.01] if only_changed else frame
shown = shown.drop(columns=['_dif'])
if shown.empty:
    st.info('Ningún descriptor cambia respecto a los valores por defecto.')
else:
    st.dataframe(shown, width='stretch', hide_index=True,
                 column_config={'cambio %': st.column_config.NumberColumn(
                     format='%+.1f %%', help='En blanco cuando el descriptor no es '
                                             'numérico o pasa a nulo.')})


# ==========================================================================
# Batch - is it consistent across many patterns?
# ==========================================================================

st.divider()
st.subheader('¿Son consistentes estas operaciones en muchos casos?')
st.caption('Mirar los patrones de uno en uno contesta esto muy despacio. Aquí se '
           'aplican los parámetros actuales a los difractogramas del filtro y se '
           'compara la mediana por clase etiquetada contra la que dan los valores '
           'por defecto. Nada se guarda.')

labelled = view[view['crystallinity_class'].isin(['AMORFO', 'INCIPIENTE', 'CRISTALINO'])]
if labelled.empty:
    st.info('El filtro actual no contiene patrones etiquetados, así que no hay clases '
            'que comparar. Quita el filtro o incluye alguna clase.')
else:
    left, right = st.columns([1, 3])
    n_max = left.slider('Cuántos patrones', 20, min(400, len(labelled)),
                        min(120, len(labelled)), 10,
                        help='Cada patrón son dos resoluciones de arPLS (parámetros '
                             'actuales y por defecto). 120 tarda unos segundos.')
    descriptor = right.selectbox('Descriptor a comparar', BATCH_DESCRIPTORS, index=0)

    if st.button('Calcular sobre el lote', type='primary'):
        # Muestreo determinista: la misma selección para los mismos parámetros, para
        # que dos configuraciones se comparen sobre EXACTAMENTE los mismos patrones.
        # Con un muestreo aleatorio, parte de la diferencia vendría de la muestra.
        sample = labelled.sort_values('measurement_id').iloc[
            np.linspace(0, len(labelled) - 1, n_max).astype(int)]
        rows, bar = [], st.progress(0.0, 'Calculando...')
        for i, r in enumerate(sample.itertuples(), 1):
            try:
                cur_d = compute(r.measurement_id, as_key(params), False)
                ref_d = compute(r.measurement_id, as_key(DEFAULTS), False)
                if cur_d is None or ref_d is None:
                    continue
                rows.append({'clase': r.crystallinity_class,
                             'actual': cur_d.get(descriptor),
                             'defecto': ref_d.get(descriptor)})
            except Exception:
                continue
            bar.progress(i / len(sample), 'Calculando %d/%d...' % (i, len(sample)))
        bar.empty()

        res = pd.DataFrame(rows).dropna()
        if res.empty:
            st.warning('No se ha podido calcular el descriptor en ninguno del lote.')
        else:
            med = res.groupby('clase')[['actual', 'defecto']].median()
            med = med.reindex([c for c in ['AMORFO', 'INCIPIENTE', 'CRISTALINO']
                               if c in med.index])
            st.markdown('**Mediana de `%s` por clase** — %d patrones'
                        % (descriptor, len(res)))
            st.dataframe(med.rename(columns={'actual': 'con estos parámetros',
                                             'defecto': 'por defecto'}),
                         width='stretch')

            if {'AMORFO', 'CRISTALINO'} <= set(med.index):
                def ratio(col):
                    a, c = med.loc['AMORFO', col], med.loc['CRISTALINO', col]
                    lo, hi = sorted((abs(a), abs(c)))
                    return (hi / lo) if lo > 1e-12 else float('inf')
                r_now, r_ref = ratio('actual'), ratio('defecto')
                m1, m2, m3 = st.columns(3)
                m1.metric('Separación amorfo/cristalino, ahora', '%.1f×' % r_now)
                m2.metric('Con los valores por defecto', '%.1f×' % r_ref)
                m3.metric('Diferencia', '%+.1f×' % (r_now - r_ref),
                          delta='mejor' if r_now > r_ref else 'peor')
                st.caption('La separación entre las medianas de AMORFO y CRISTALINO es '
                           'una medida cruda pero honesta de si el descriptor sigue '
                           'distinguiendo las clases. **Un cambio que mejora un solo '
                           'difractograma y estropea esto es un cambio malo.** Ojo con '
                           'leerla sola: una separación mayor con un denominador '
                           'inflado es un espejismo, y ya pasó una vez en este proyecto '
                           '(ver v3.2 en `src/PXRD_PIPELINE_CHANGELOG.md`).')

            fig, ax = plt.subplots(figsize=(9, 3.4))
            order = [c for c in ['AMORFO', 'INCIPIENTE', 'CRISTALINO']
                     if c in res['clase'].unique()]
            # Las etiquetas se ponen con set_xticklabels y no con el argumento
            # `labels` de boxplot: ese argumento se renombro a `tick_labels` en
            # matplotlib 3.9 y la app tiene que correr con cualquiera de las dos.
            ax.boxplot([res[res['clase'] == c]['actual'].values for c in order],
                       widths=0.5, showfliers=False,
                       medianprops=dict(color=C_PEAK, lw=2))
            ax.set_xticks(range(1, len(order) + 1))
            ax.set_xticklabels(order)
            ax.set_ylabel(descriptor)
            ax.set_title('Distribución con los parámetros actuales', fontsize=10, loc='left')
            fig.tight_layout()
            st.pyplot(fig, width='stretch')

st.divider()
st.caption('Sesión de solo lectura sobre PostgreSQL (`TRANSACTION READ ONLY`). '
           'Esta app no escribe en ninguna tabla. Para recalcular y **guardar** los '
           'descriptores con los valores oficiales: `python scripts/compute_pxrd_descriptors.py`.')
