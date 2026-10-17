"""
ALCheMy - PXRD labelling app

IF YOU ARE AN AI PICKING THIS UP LATER, READ THIS FIRST
---------------------------------------------------------
This file went through many rounds of real-user iteration on a phone
(2026-08-26) and the current shape works well - the owner (a materials
chemist, not a programmer) explicitly asked for it to be preserved. Change it
freely when asked, but understand *why* it looks like this before you do,
because most of the layout looks over-engineered until you know the
constraint it solves:

  - It is used BOTH at a desk and, just as often, one-handed on a phone
    while looking at real diffractograms. Every layout decision below
    optimises for "no scrolling on a phone, one thing to tap per judgement."
  - Streamlit reruns the ENTIRE script on every interaction. Anything that
    looks like unnecessary caching, pre-fetching, or a scoped CSS rule
    instead of a global one is there because the naive version was tried
    first and broke on a phone (see the section-by-section comments below
    and src/README.md's "Labelling app" entry for the specific failures:
    captions overlapping after a global spacing rule, the title clipping
    under Streamlit's own header, st.iframe silently failing to scroll
    because of iframe sandboxing, columns refusing to stay in one row on
    narrow screens).
  - The four separate `label_type` rows per pattern (crystallinity_class /
    incipient_subtype / oxide_flag / multiphase_suspected) are a deliberate
    choice, not leftover complexity - see "FOUR INDEPENDENT JUDGEMENTS"
    below for why they were split apart mid-labelling.
  - The on-screen text is English; the values actually written to the
    database are not, and must not be renamed without a migration - see
    the CATEGORIES/INCIPIENT_SUBTYPES comments and src/README.md.
  - ~1,880 patterns exist, the owner labels several hundred per sitting, and
    over 1,300 were already labelled through this exact UI as of this
    writing. Any change that would silently alter how already-saved labels
    are interpreted (renaming a label_value, changing what a pill maps to)
    is a correctness risk, not just a UI tweak - double-check against
    src/README.md and scripts/sql/migrations/2026-08-25_pxrd_labels_v2.sql before doing it.

WHAT IT IS FOR
--------------
Stage E2 of methodology/ROADMAP_PXRD_CRISTALINIDAD_Y_ML.md: producing the human
ground truth that supervised learning needs. There are ~1,870 diffractograms and
zero labels, and no amount of feature engineering compensates for that.

The whole design is built around one requirement: labelling several hundred
patterns in a sitting without the tool getting in the way. Crystallinity is
mandatory per pattern; the incipient subtype, oxide flag and multi-phase flag
are optional refinements. One "Accept and next" click saves everything
chosen for the current pattern and advances - no dropdown, no per-field save.

FOUR INDEPENDENT JUDGEMENTS, NOT ONE CATEGORY
----------------------------------------------
Early labelling revealed that "how crystalline is it", "is there an oxide
phase" and "might this be a mixture of phases" are three different questions
that do not vary together - an oxide can show up in an amorphous OR a
crystalline pattern, and a suspected second phase can appear at any
crystallinity level. Cramming them into one categorical value produced
exactly the ambiguity you would expect. So `pxrd_labels` carries one row per
question, keyed on `(file_hash, label_type)`:

  - crystallinity_class   (mandatory)  AMORFO | INCIPIENTE | CRISTALINO | SIN_MUESTRA
  - incipient_subtype     (optional, only meaningful when crystallinity_class
                            is INCIPIENTE) three sub-regimes of "how incipient"
  - oxide_flag            (optional, defaults to NO)  SI | NO
  - multiphase_suspected  (optional, defaults to NO)  SI | NO

MEZCLA was retired as a crystallinity_class value: a genuinely obvious
two-resolved-phases pattern is still CRISTALINO by degree of order, with
multiphase_suspected = SI carrying the "more than one phase" information -
that is what actually varies independently, not the crystallinity itself.
Older rows still holding MEZCLA are left as-is and picked up by the
"review" filters in the sidebar; the app deliberately cannot auto-select a
retired value, so opening one of them forces a fresh, valid choice.

The incipient subtype stays a label rather than being merged into
crystallinity_class on purpose: it is a genuinely continuous property (peak
width and intensity relative to the halo), and src/pxrd_descriptors.py
already computes that numerically (fwhm, crystalline_fraction, snr_global).
Splitting INCIPIENTE into three hard categories would only fragment an
already-scarce class for training; the subtype is captured here as breadcrumb
context for later analysis, not as the primary ML target.

HOW IT STAYS FAST
-----------------
Streamlit re-runs the entire script on every interaction, so anything expensive
must be cached or it happens again on every single click:

  - the connection is a cached resource, opened once per session
  - the work queue (~1,870 rows) is fetched once and cached
  - each curve is cached after first load, so going Back is instant
  - the next pattern is pre-fetched while you look at the current one

Only the row being labelled is ever read in full. The curves live in a JSONB
column of a few thousand points each; loading all of them up front would take
minutes and gigabytes, which is why the app never does that.

HOW LABELS SURVIVE
------------------
Labels are written keyed on `file_hash`, not on `measurement_id` - see
scripts/sql/migrations/2026-08-25_pxrd_labels_v2.sql for the full reasoning. Short version: the
measurements table gets wiped and re-ingested from time to time, which
regenerates every measurement_id. Labels keyed on those ids would be destroyed.
The file hash does not change, so labels survive.

Every click writes to PostgreSQL immediately (UPSERT). Nothing is buffered in
memory, so closing the browser, a crash or a power cut costs at most the pattern
currently on screen.

RUN IT
------
    streamlit run app/pxrd_labeler.py

Requires the same .env as the rest of the project.
"""

import os
import json
import sys

import numpy as np
import pandas as pd
import psycopg2
import psycopg2.extras
import streamlit as st
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from dotenv import load_dotenv

# --------------------------------------------------------------------------
# Paths and configuration
# --------------------------------------------------------------------------
APP_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(APP_DIR)
sys.path.insert(0, os.path.join(REPO_ROOT, 'src'))

# Load .env: check local worktree first, then fall back to the main project repository
for env_path in [
    os.path.join(REPO_ROOT, '.env'),
    os.path.join(os.path.dirname(REPO_ROOT), 'ALCheMy', '.env'),
    r'C:\Users\rubbe\Documents\ALCheMy\.env',
]:
    if os.path.isfile(env_path):
        load_dotenv(env_path)
        break

# The label_type values written to pxrd_labels. See the module docstring
# for why these are separate rows instead of one category.
LABEL_TYPE_MAIN          = 'crystallinity_class'
LABEL_TYPE_SUBTYPE       = 'incipient_subtype'
LABEL_TYPE_OXIDE         = 'oxide_flag'
LABEL_TYPE_MEZCLA        = 'multiphase_suspected'
# Task T8: blind relabeling and adjudication label types
LABEL_TYPE_BLIND_MAIN    = 'crystallinity_class_blind'
LABEL_TYPE_BLIND_SUBTYPE = 'incipient_subtype_blind'
LABEL_TYPE_PRE_BLIND     = 'crystallinity_class_pre_blind'
# The blind pass must never overwrite the original oxide / multiphase judgements:
# they are human labels too, as irreplaceable as the class. Blind flags get their
# own label_type, exactly like the blind class.
LABEL_TYPE_BLIND_OXIDE   = 'oxide_flag_blind'
LABEL_TYPE_BLIND_MEZCLA  = 'multiphase_suspected_blind'


def same_class(a, b):
    """MEZCLA is retired and cannot be chosen in the blind pass; training already
    counts it as CRISTALINO. Comparing it literally would turn all 16 legacy MEZCLA
    patterns into forced discrepancies."""
    norm = lambda v: 'CRISTALINO' if v == 'MEZCLA' else v
    return norm(a) == norm(b)

MODE_NORMAL       = 'Normal'
MODE_BLIND        = 'Blind relabeling (150)'
MODE_ADJUDICATION = 'Adjudication (discrepancies)'


# Mandatory: degree of crystalline order. (DB code, on-screen caption, help
# text). The DB code (first element) is never translated - ~1,150 rows
# already use these Spanish codes, and the DB values are not what the user
# asked to change; only the on-screen caption and help text are English now.
CATEGORIES = [
    ('AMORFO',      'Amorphous',    'No reflections. Only a broad halo or noise.'),
    ('INCIPIENTE',  'Incipient',    'Weak reflections peeking over a dominant halo.'),
    ('CRISTALINO',  'Crystalline',  'Clear, well-defined reflections.'),
    ('SIN_MUESTRA', 'No sample',    'Empty sample holder or signal not attributable to the sample.'),
]

# Optional, only meaningful when the pattern above is INCIPIENTE. Same rule:
# the DB code (first element) stays as-is, only caption/help are English.
INCIPIENT_SUBTYPES = [
    ('HALO_DOMINANTE',     'Faint halo',
     'Timid, very broad peaks showing over a dominant amorphous halo.'),
    ('PICOS_ANCHOS',       'Broad peaks',
     'Peaks already broad but clearly present; the halo no longer dominates.'),
    ('CRISTALITO_PEQUENO', 'Small crystallite',
     'Peaks not very broad but low intensity relative to the halo; very small crystallites.'),
]

st.set_page_config(page_title='ALCheMy - PXRD Labeling', page_icon='🔬', layout='wide',
                    initial_sidebar_state='collapsed')

# Bigger touch targets for buttons, and a general tightening of vertical
# whitespace - the whole point of this pass is to fit plot + every judgement
# on one phone screen with no scrolling. See src/README.md.
#
# NOTE: a first version also forced margin-bottom on every stElementContainer
# and gap on every stVerticalBlock. That's too broad a hammer - some
# Streamlit elements (captions especially) already carry their own negative
# offsets tuned for the *default* spacing, so stacking two independent
# shrinks on top of each other made captions overlap the element above them.
# Scoped only to the block-container top padding (Streamlit reserves a lot
# of empty space there by default) and the expander header, which are safe
# because nothing else depends on their exact size.
st.markdown("""
<style>
div[data-testid="stButton"] > button {
    min-height: 2.6em;
    font-size: 1.0em;
}
/* Streamlit's own top header (sidebar-toggle + kebab menu) is a fixed
   overlay - shrinking block-container's padding-top below its height made
   the title render partly underneath it. Shrink the header itself instead
   of just the padding, then match the padding to the new height. */
header[data-testid="stHeader"] { height: 2.2rem; }
div.block-container {
    padding-top: 2.6rem !important;
    padding-bottom: 1rem !important;
}
[data-testid="stExpander"] summary { padding: 0.35rem 0.6rem !important; min-height: 0 !important; }
/* Scoped to the header container's own key (st.container(key="header_block"))
   instead of a blanket stVerticalBlock rule - narrow enough that it can't
   repeat the earlier overlap bug, since nothing outside this one container
   is affected. */
.st-key-header_block div[data-testid="stVerticalBlock"] { gap: 0.15rem !important; }
</style>
""", unsafe_allow_html=True)


# ==========================================================================
# Database access
# ==========================================================================

@st.cache_resource
def get_connection():
    """
    One connection per Streamlit session, reused across re-runs.

    cache_resource (not cache_data) because a connection is a live object that
    must not be copied or serialised. autocommit is on so every label is durable
    the instant the button is pressed.
    """
    conn = psycopg2.connect(
        host=os.getenv('POSTGRES_HOST', 'localhost'),
        port=int(os.getenv('POSTGRES_PORT', 5432)),
        dbname=os.getenv('ALCHEMY_DB_NAME', os.getenv('POSTGRES_DB', 'alchemy_db')),
        user=os.getenv('POSTGRES_USER'),
        password=os.getenv('POSTGRES_PASSWORD'),
    )
    conn.autocommit = True
    return conn


def _run(sql, params=None, fetch='all'):
    """
    Executes a statement, reconnecting once if the connection went stale.

    Docker Desktop drops the port forwarding when the host sleeps (it has
    happened twice on this project). Without this retry the app would die
    mid-session and take the current pattern's label with it.
    """
    for attempt in (1, 2):
        try:
            conn = get_connection()
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute(sql, params)
                if fetch == 'all':
                    return cur.fetchall()
                if fetch == 'one':
                    return cur.fetchone()
                return None
        except (psycopg2.OperationalError, psycopg2.InterfaceError):
            if attempt == 2:
                raise
            get_connection.clear()      # drop the dead connection, reopen next loop
    return None


@st.cache_data(ttl=60)
def load_blind_set():
    """Loads the 150-sample blind set from JSON."""
    paths = [
        r'C:\Users\rubbe\Documents\ALCheMy\_lab\methodology\revisions\datos_revision_2026-10-17\blind_set.json',
        os.path.join(REPO_ROOT, '_lab', 'methodology', 'revisions', 'datos_revision_2026-10-17', 'blind_set.json'),
    ]
    for p in paths:
        if os.path.isfile(p):
            with open(p, 'r', encoding='utf-8') as f:
                return json.load(f)
    return None


@st.cache_data(ttl=300, show_spinner='Loading the diffractogram queue...')
def load_queue():
    """
    The work queue: one row per diffractogram, WITHOUT the curve.

    Deliberately excludes data_json. ~1,870 rows of metadata is a fraction of a
    megabyte and loads in well under a second; the same rows with their curves
    would be hundreds of megabytes.
    """
    rows = _run("""
        SELECT m.measurement_id::text AS measurement_id,
               m.file_hash,
               m.sample_code,
               m.file_name,
               m.raw_file_path,
               m.measurement_tag,
               COALESCE(s.metal_center, '?')  AS metal_center,
               COALESCE(s.linker, '?')        AS linker,
               s.temp_target_c,
               s.time_hours,
               s.synthesis_date
        FROM characterization_measurements m
        LEFT JOIN synthesis_experiments s ON s.sample_code = m.sample_code
        WHERE m.technique = 'PXRD'
          AND m.file_hash IS NOT NULL
          AND jsonb_array_length(m.data_json->'raw_data'->'x') > 100
        ORDER BY m.sample_code, m.file_name;
    """)
    return pd.DataFrame([dict(r) for r in rows])


@st.cache_data(ttl=60)
def load_labels():
    """
    All existing labels for all label_types, nested by file_hash then
    label_type: labels[file_hash]['crystallinity_class'] -> row dict, etc.

    A pattern only counts as "labelled" (for progress and the pending filter)
    once it has a crystallinity_class row - the other three are optional
    refinements, never the thing that marks a pattern done.
    """
    rows = _run("""
        SELECT file_hash, label_type, label_value, confidence, notes, labeled_by, labeled_at
        FROM pxrd_labels;
    """)
    labels = {}
    for r in rows:
        labels.setdefault(r['file_hash'], {})[r['label_type']] = dict(r)
    return labels



@st.cache_data(max_entries=64, show_spinner=False)
def load_curve(measurement_id):
    """
    Loads one diffractogram.

    Cached by measurement_id, so stepping Back to review a pattern is instant
    rather than another database round-trip. 64 entries is roughly the last few
    minutes of work at labelling speed.
    """
    row = _run("""
        SELECT data_json->'raw_data'->>'x' AS x,
               data_json->'raw_data'->>'y' AS y
        FROM characterization_measurements
        WHERE measurement_id = %s;
    """, (measurement_id,), fetch='one')
    if row is None or row['x'] is None:
        return None, None
    return (np.asarray(json.loads(row['x']), dtype=float),
            np.asarray(json.loads(row['y']), dtype=float))


def save_label(record, label_type, value, confidence, notes, labeled_by):
    """
    Writes one (file_hash, label_type) row. UPSERT, so re-labelling on review
    overwrites cleanly instead of failing on the primary key.

    labeled_at is preserved on update (when it was first judged) while
    updated_at moves - so a revision is visible without losing the original.
    """
    _run("""
        INSERT INTO pxrd_labels (
            file_hash, label_type, sample_code, file_name, measurement_id,
            label_value, confidence, notes, labeled_by
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (file_hash, label_type) DO UPDATE SET
            label_value    = EXCLUDED.label_value,
            confidence     = EXCLUDED.confidence,
            notes          = EXCLUDED.notes,
            measurement_id = EXCLUDED.measurement_id,
            labeled_by     = EXCLUDED.labeled_by,
            updated_at     = now();
    """, (
        record['file_hash'], label_type, record['sample_code'], record['file_name'],
        record['measurement_id'], value, confidence, (notes or None).strip() if notes else None,
        labeled_by,
    ), fetch=None)


# ==========================================================================
# Plotting
# ==========================================================================

def plot_pattern(x, y, sample_code, show_analysis):
    """
    Draws the diffractogram.

    Linear scale by default because that is how a chemist reads a pattern. The
    optional analysis overlay marks the peaks the deterministic pipeline finds -
    useful as a second opinion, off by default for the reason stated in the UI.
    """
    fig, ax = plt.subplots(figsize=(13, 4.6))
    ax.plot(x, y, color='#263238', lw=1.0)
    ax.fill_between(x, y.min(), y, color='#263238', alpha=0.06)

    if show_analysis:
        try:
            from pxrd_descriptors import (resample_to_grid, decompose_profile,
                                          detect_peaks_poisson, poisson_noise_level,
                                          integrate)
            grid, y_grid, valid = resample_to_grid(x, y)
            gx, gy = grid[valid], y_grid[valid]
            layers = decompose_profile(gy, gx)
            noise = poisson_noise_level(gy, gx)
            # Sin k_sigma explicita, el detector deriva el umbral de la longitud del
            # barrido (pipeline v3.3): fija la tasa de falsos positivos en 0,05 por
            # barrido en vez de fijar k. Con el antiguo k=3 fijo esta superposicion
            # marcaba varios picos de ruido en cada patron amorfo, justo donde mas
            # confunden a quien etiqueta.
            from pxrd_descriptors import peak_k_sigma
            k_cal = peak_k_sigma(gx.size, max(1, int(round(0.20 / (gx[1] - gx[0])))))
            peaks, _fw = detect_peaks_poisson(gx, layers['crystalline'], noise)
            a_c = integrate(layers['crystalline'], gx)
            a_a = integrate(layers['amorphous'], gx)
            xc = a_c / (a_c + a_a) if (a_c + a_a) > 0 else float('nan')
            if peaks.size:
                ax.plot(gx[peaks], np.interp(gx[peaks], x, y), 'v',
                        color='#c0392b', ms=7, label=f'{peaks.size} picos ({k_cal:.1f}σ)')
            ax.text(0.995, 0.94, f'Xc estimada = {xc:.2f}', transform=ax.transAxes,
                    ha='right', va='top', fontsize=11, color='#c0392b',
                    bbox=dict(boxstyle='round,pad=0.4', fc='white', ec='#c0392b'))
            if peaks.size:
                ax.legend(loc='upper left', fontsize=9, frameon=False)
        except Exception as exc:                      # never let the overlay break labelling
            ax.text(0.5, 0.95, f'(analysis unavailable: {exc})', transform=ax.transAxes,
                    ha='center', va='top', fontsize=8, color='#999')

    ax.set_xlabel('Angulo 2θ (grados)')
    ax.set_ylabel('Intensidad (cuentas)')
    ax.set_title(sample_code, fontweight='bold', fontsize=13)
    ax.grid(alpha=0.25)
    ax.spines[['top', 'right']].set_visible(False)
    ax.margins(x=0.01)
    fig.tight_layout()
    return fig


# ==========================================================================
# Navigation helpers
# ==========================================================================

def _subtype_changed(mkey, skey):
    """A subtype only exists for INCIPIENTE, so choosing one sets the main class.
    Before 2026-10-18 the save step silently dropped a subtype chosen next to
    AMORFO/CRISTALINO; now the screen shows the class that will be stored."""
    if st.session_state.get(skey) is not None:
        st.session_state[mkey] = 'INCIPIENTE'


def _main_changed(mkey, skey):
    if st.session_state.get(mkey) != 'INCIPIENTE':
        st.session_state[skey] = None


def clamp(i, n):
    return max(0, min(i, n - 1))


# Navigation only ever touches `idx`.
#
# It must NOT reset the comment box or the "doubtful" checkbox by assigning to
# their session_state keys: Streamlit forbids writing to a key that is bound to
# an already-instantiated widget, and doing so raises
# "st.session_state.comment cannot be modified after the widget ... is
# instantiated", which aborts the re-run and silently leaves the app stuck on the
# same pattern. Instead each pattern gets its OWN widget, keyed by its file hash
# (see `comment_key`), so moving to the next pattern creates a fresh, empty
# widget and moving back restores exactly what was typed there.

def advance(n):
    st.session_state.idx = clamp(st.session_state.idx + 1, n)


def go_back(n):
    st.session_state.idx = clamp(st.session_state.idx - 1, n)


def comment_key(record, mode_prefix=''):
    p = f"{mode_prefix}_" if mode_prefix else ""
    return f"comment_{p}{record['file_hash']}"


def main_key(record, mode_prefix=''):
    p = f"{mode_prefix}_" if mode_prefix else ""
    return f"main_{p}{record['file_hash']}"


def subtype_key(record, mode_prefix=''):
    p = f"{mode_prefix}_" if mode_prefix else ""
    return f"subtype_{p}{record['file_hash']}"


def indicators_key(record, mode_prefix=''):
    p = f"{mode_prefix}_" if mode_prefix else ""
    return f"indicators_{p}{record['file_hash']}"



# ==========================================================================
# Application
# ==========================================================================

def main():
    # ---- session state ---------------------------------------------------
    # Only `idx` and `just_saved` live in session_state. Every judgement
    # widget (pills, comment box) is a per-pattern widget keyed by file hash,
    # so its state is managed by Streamlit and never assigned to directly.
    st.session_state.setdefault('idx', 0)
    st.session_state.setdefault('just_saved', None)

    try:
        queue = load_queue()
    except Exception as exc:
        st.error(f'Cannot connect to the database: {exc}')
        st.info('Check that the container is up: `docker ps`, and if needed '
                '`docker restart alchemy_postgres`.')
        st.stop()

    if queue.empty:
        st.warning('No PXRD diffractograms in the database.')
        st.stop()

    labels = load_labels()

    # ---- mode selection --------------------------------------------------
    # Supports ?mode=blind or ?mode=adjudication query parameters
    qp_mode = (st.query_params.get('mode') or '').lower()
    default_mode_idx = 0
    if qp_mode in ('blind', 'ciego'):
        default_mode_idx = 1
    elif qp_mode in ('adjudication', 'adjudicacion'):
        default_mode_idx = 2

    # ---- sidebar ---------------------------------------------------------
    with st.sidebar:
        st.header('Mode')
        mode = st.radio(
            'App Mode',
            [MODE_NORMAL, MODE_BLIND, MODE_ADJUDICATION],
            index=default_mode_idx,
            help='Normal: standard labeling. Blind: 150 stratified samples without prior info. Adjudication: review discrepancies and choose final label.',
        )

        st.divider()
        st.header('Session')
        labeled_by = st.text_input('Labeled by', value=os.getenv('ALCHEMY_LABELER', 'Rubén S.N.'))

        st.divider()
        if mode == MODE_NORMAL:
            st.header('What to show')
            only_pending = st.checkbox('Only unlabelled', value=True,
                                       help='Turn off to review what is already labelled.')
            metals = ['(all)'] + sorted(queue['metal_center'].dropna().unique().tolist())
            linkers = ['(all)'] + sorted(queue['linker'].dropna().unique().tolist())
            metal_filter = st.selectbox('Metal', metals)
            linker_filter = st.selectbox('Linker', linkers)

            st.divider()
            st.header('Review labelled patterns')
            st.caption('Useful for filling in oxide/mixture on what you already classified, '
                       'or for revisiting legacy MEZCLA rows (turn off "Only unlabelled").')
            review_options = ['(all)'] + [c[1] for c in CATEGORIES] + ['MEZCLA (legacy)']
            review_category = st.selectbox('Only this main category', review_options)
            review_text = st.text_input('Search comment text', placeholder='e.g. oxide')

            st.divider()
            show_analysis = st.checkbox('Show automatic analysis', value=False)
            st.caption('⚠️ Seeing the computed Xc while labelling makes your labels dependent on '
                       'the algorithm they are meant to validate. Use only for doubtful cases.')
        elif mode == MODE_BLIND:
            st.header('Blind Mode Settings')
            st.caption('Double-blind self-agreement protocol (150 samples). Metadata, file names, '
                       'sample codes, and algorithm hints are hidden.')
            # Repair pass (2026-10-18): the app used to drop the subtype silently when
            # the main class was not INCIPIENTE, while Rubén's convention was
            # "class + subtype = incipient". This walks through ALL blind AMORFO /
            # CRISTALINO answers (not only the discrepancies, which would inflate
            # agreement), pre-filled with his own blind answer - never the original.
            repair_pass = st.checkbox(
                'Repair pass: my blind AMORFO / CRISTALINO',
                value=st.query_params.get('repair') == '1',
                help='Tap a subtype where you meant incipient; press ✅ on every pattern, even unchanged.')
            only_pending = False if repair_pass else st.checkbox(
                'Only unlabelled (blind)', value=True,
                help='Turn off to review blind labels already submitted.')
            show_analysis = False
        else:  # MODE_ADJUDICATION
            st.header('Adjudication Settings')
            st.caption('Review discrepancies between original labels and blind relabels to select '
                       'the authoritative final ground truth.')
            only_pending = st.checkbox('Only pending adjudication', value=True,
                                       help='Turn off to review already adjudicated patterns.')
            show_analysis = st.checkbox('Show automatic analysis', value=False,
                                        help='Optional deterministic descriptor overlay for difficult cases.')

    # ---- build the working subset ---------------------------------------
    if mode == MODE_NORMAL:
        labeled_hashes = {h for h, d in labels.items() if LABEL_TYPE_MAIN in d}
        main_code_by_caption = {c[1]: c[0] for c in CATEGORIES}

        view = queue
        if metal_filter != '(all)':
            view = view[view['metal_center'] == metal_filter]
        if linker_filter != '(all)':
            view = view[view['linker'] == linker_filter]
        if only_pending:
            view = view[~view['file_hash'].isin(labeled_hashes)]
        if review_category != '(all)':
            if review_category == 'MEZCLA (legacy)':
                wanted = {h for h, d in labels.items()
                         if d.get(LABEL_TYPE_MAIN, {}).get('label_value') == 'MEZCLA'}
            else:
                code = main_code_by_caption[review_category]
                wanted = {h for h, d in labels.items()
                         if d.get(LABEL_TYPE_MAIN, {}).get('label_value') == code}
            view = view[view['file_hash'].isin(wanted)]
        if review_text:
            needle = review_text.lower()
            wanted_text = {h for h, d in labels.items()
                          if needle in (d.get(LABEL_TYPE_MAIN, {}).get('notes') or '').lower()}
            view = view[view['file_hash'].isin(wanted_text)]
        view = view.reset_index(drop=True)

        if view.empty:
            st.balloons()
            st.success('Nothing pending with these filters. Turn off "Only unlabelled" to review.')
            st.stop()

    elif mode == MODE_BLIND:
        blind_payload = load_blind_set()
        if not blind_payload:
            st.error('Blind set file not found (`blind_set.json`). Run `python scripts/build_blind_relabel_set.py` first.')
            st.stop()

        blind_samples = blind_payload['samples']
        order_map = {s['file_hash']: s['presentation_order'] for s in blind_samples}
        blind_hashes = set(order_map.keys())

        blind_done_hashes = {h for h in blind_hashes if LABEL_TYPE_BLIND_MAIN in labels.get(h, {})}
        total_blind = len(blind_hashes)
        done_blind = len(blind_done_hashes)

        view = queue[queue['file_hash'].isin(blind_hashes)].copy()
        view['presentation_order'] = view['file_hash'].map(order_map)
        view = view.sort_values('presentation_order').reset_index(drop=True)

        if repair_pass:
            # Frozen at the start of the session, so a pattern switched to INCIPIENTE
            # does not vanish from the list and shift every index after it.
            if 'repair_set' not in st.session_state:
                st.session_state.repair_set = {
                    h for h in blind_done_hashes
                    if labels[h][LABEL_TYPE_BLIND_MAIN]['label_value'] in ('AMORFO', 'CRISTALINO')}
                st.session_state.repair_seen = set()
            view = view[view['file_hash'].isin(st.session_state.repair_set)].reset_index(drop=True)
            st.sidebar.caption('Reviewed in this pass: **%d / %d**'
                               % (len(st.session_state.repair_seen), len(st.session_state.repair_set)))
        elif only_pending:
            view = view[~view['file_hash'].isin(blind_done_hashes)].reset_index(drop=True)

        if view.empty:
            st.balloons()
            st.success('🎉 All 150 blind labels completed! Run `python scripts/blind_relabel_agreement.py` to evaluate agreement.')
            st.stop()

    else:  # MODE_ADJUDICATION
        blind_payload = load_blind_set()
        if not blind_payload:
            st.error('Blind set file not found (`blind_set.json`). Run `python scripts/build_blind_relabel_set.py` first.')
            st.stop()

        blind_samples = blind_payload['samples']
        orig_by_hash = {s['file_hash']: s for s in blind_samples}

        discrepancy_records = []
        for h, s in orig_by_hash.items():
            db_for_hash = labels.get(h, {})
            blind_entry = db_for_hash.get(LABEL_TYPE_BLIND_MAIN)
            if not blind_entry or not blind_entry.get('label_value'):
                continue

            blind_val = blind_entry['label_value']
            pre_entry = db_for_hash.get(LABEL_TYPE_PRE_BLIND)
            main_entry = db_for_hash.get(LABEL_TYPE_MAIN)

            if pre_entry:
                orig_val = pre_entry['label_value']
                orig_conf = pre_entry.get('confidence', 'alta')
                orig_notes = pre_entry.get('notes')
                orig_by = pre_entry.get('labeled_by')
                is_adjudicated = True
            else:
                orig_val = main_entry['label_value'] if main_entry else s['original_crystallinity_class']
                orig_conf = main_entry.get('confidence', 'alta') if main_entry else s.get('original_confidence', 'alta')
                orig_notes = main_entry.get('notes') if main_entry else s.get('original_notes')
                orig_by = main_entry.get('labeled_by') if main_entry else s.get('original_labeled_by')
                is_adjudicated = False

            if not same_class(orig_val, blind_val):
                discrepancy_records.append({
                    'file_hash': h,
                    'sample_code': s['sample_code'],
                    'presentation_order': s['presentation_order'],
                    'orig_val': orig_val,
                    'orig_conf': orig_conf,
                    'orig_notes': orig_notes,
                    'orig_by': orig_by,
                    'blind_val': blind_val,
                    'blind_conf': blind_entry.get('confidence', 'alta'),
                    'blind_notes': blind_entry.get('notes'),
                    'blind_by': blind_entry.get('labeled_by'),
                    'is_adjudicated': is_adjudicated,
                })

        total_discrepancies = len(discrepancy_records)
        adjudicated_count = sum(1 for d in discrepancy_records if d['is_adjudicated'])

        if total_discrepancies == 0:
            st.info('No discrepancies detected between original and blind labels yet. '
                    '(Complete blind labeling first in Blind mode).')
            st.stop()

        disc_hashes = {d['file_hash']: d for d in discrepancy_records}
        view = queue[queue['file_hash'].isin(disc_hashes.keys())].copy()
        view['presentation_order'] = view['file_hash'].map(lambda h: disc_hashes[h]['presentation_order'])
        view['is_adjudicated'] = view['file_hash'].map(lambda h: disc_hashes[h]['is_adjudicated'])
        view = view.sort_values('presentation_order').reset_index(drop=True)

        if only_pending:
            view = view[~view['is_adjudicated']].reset_index(drop=True)

        if view.empty:
            st.balloons()
            st.success(f'🎉 All {total_discrepancies} discrepancies have been adjudicated!')
            st.stop()

    st.session_state.idx = clamp(st.session_state.idx, len(view))
    record = view.iloc[st.session_state.idx].to_dict()
    existing = labels.get(record['file_hash'], {})
    existing_main = existing.get(LABEL_TYPE_MAIN)
    existing_blind = existing.get(LABEL_TYPE_BLIND_MAIN)
    existing_pre = existing.get(LABEL_TYPE_PRE_BLIND)

    # ---- header: title, progress, metadata - grouped and kept tight ------
    with st.container(key='header_block'):
        if mode == MODE_NORMAL:
            st.markdown('<h3 style="margin:0 0 0.15em 0; padding-top:0.15em; '
                       'line-height:1.4;">🔬 PXRD Labeling</h3>',
                        unsafe_allow_html=True)
            total, done = len(queue), len(labeled_hashes)
            pct = 100 * done / total if total else 0.0
            st.markdown(f"""
            <div style="display:flex; gap:0.9em; flex-wrap:nowrap; overflow-x:auto;
                        font-size:0.82em; color:var(--text-color, inherit);
                        padding:0.35em 0; white-space:nowrap;">
                <span><b>{done:,}</b>/{total:,} labelled</span>
                <span>·</span>
                <span><b>{pct:.1f}%</b> progress</span>
                <span>·</span>
                <span><b>{len(view):,}</b> in view</span>
            </div>
            """, unsafe_allow_html=True)
            st.progress(done / total if total else 0.0)
        elif mode == MODE_BLIND:
            st.markdown('<h3 style="margin:0 0 0.15em 0; padding-top:0.15em; '
                       'line-height:1.4;">🔬 PXRD Labeling · Blind Mode</h3>',
                        unsafe_allow_html=True)
            pct = 100 * done_blind / total_blind if total_blind else 0.0
            st.markdown(f"""
            <div style="display:flex; gap:0.9em; flex-wrap:nowrap; overflow-x:auto;
                        font-size:0.82em; color:var(--text-color, inherit);
                        padding:0.35em 0; white-space:nowrap;">
                <span><b>{done_blind:,}</b>/{total_blind:,} blind labelled</span>
                <span>·</span>
                <span><b>{pct:.1f}%</b> progress</span>
                <span>·</span>
                <span><b>{len(view):,}</b> in view</span>
            </div>
            """, unsafe_allow_html=True)
            st.progress(done_blind / total_blind if total_blind else 0.0)
        else:  # MODE_ADJUDICATION
            st.markdown('<h3 style="margin:0 0 0.15em 0; padding-top:0.15em; '
                       'line-height:1.4;">⚖️ PXRD Labeling · Adjudication Mode</h3>',
                        unsafe_allow_html=True)
            pct = 100 * adjudicated_count / total_discrepancies if total_discrepancies else 0.0
            st.markdown(f"""
            <div style="display:flex; gap:0.9em; flex-wrap:nowrap; overflow-x:auto;
                        font-size:0.82em; color:var(--text-color, inherit);
                        padding:0.35em 0; white-space:nowrap;">
                <span><b>{adjudicated_count:,}</b>/{total_discrepancies:,} adjudicated</span>
                <span>·</span>
                <span><b>{pct:.1f}%</b> progress</span>
                <span>·</span>
                <span><b>{len(view):,}</b> in view</span>
            </div>
            """, unsafe_allow_html=True)
            st.progress(adjudicated_count / total_discrepancies if total_discrepancies else 0.0)

        if st.session_state.just_saved:
            value, code_or_num = st.session_state.just_saved
            caption = dict((c[0], c[1]) for c in CATEGORIES).get(value, value)
            st.toast(f'{code_or_num} → {caption}', icon='✅')
            st.session_state.just_saved = None

        extra = []
        if pd.notna(record.get('temp_target_c')):
            extra.append(f"{record['temp_target_c']:.0f}°C")
        if pd.notna(record.get('time_hours')):
            extra.append(f"{record['time_hours']:.0f}h")
        extra_txt = (' · ' + ' · '.join(extra)) if extra else ''

        with st.container(horizontal=True, horizontal_alignment='distribute'):
            if mode == MODE_BLIND:
                st.caption(f"**Blind Pattern #{record['presentation_order']}** · "
                          f"Sample {st.session_state.idx + 1}/{len(view)}")
                with st.container(horizontal=True):
                    if blind_done_hashes:
                        with st.popover('📊', help='Blind relabeling tally'):
                            blind_seen = [labels[h][LABEL_TYPE_BLIND_MAIN]['label_value']
                                         for h in blind_done_hashes if h in labels and LABEL_TYPE_BLIND_MAIN in labels[h]]
                            tally = pd.Series(blind_seen).value_counts()
                            for val, cap, _h in CATEGORIES:
                                st.caption(f"{cap}: **{int(tally.get(val, 0))}**")
            elif mode == MODE_ADJUDICATION:
                st.caption(f"**{record['sample_code']}** · {record['metal_center']} | {record['linker']}{extra_txt} · "
                          f"Discrepancy {st.session_state.idx + 1}/{len(view)}")
                with st.container(horizontal=True):
                    with st.popover('📄', help='File name and path'):
                        st.caption(f"`{record['file_name']}`")
                        st.caption(f"`{record['raw_file_path']}`")
            else:
                st.caption(f"**{record['metal_center']}** | **{record['linker']}**{extra_txt} · "
                          f"{st.session_state.idx + 1}/{len(view)}")
                with st.container(horizontal=True):
                    if labels:
                        with st.popover('📊', help='Tally of what has been labelled so far'):
                            main_seen = [d[LABEL_TYPE_MAIN]['label_value'] for d in labels.values()
                                        if LABEL_TYPE_MAIN in d]
                            tally = pd.Series(main_seen).value_counts()
                            for val, cap, _h in CATEGORIES:
                                st.caption(f"{cap}: **{int(tally.get(val, 0))}**")
                            if tally.get('MEZCLA', 0):
                                st.caption(f"MEZCLA (legacy): **{int(tally.get('MEZCLA', 0))}**")
                    with st.popover('📄', help='File name and path'):
                        st.caption(f"`{record['file_name']}`")
                        st.caption(f"`{record['raw_file_path']}`")
                        if pd.notna(record.get('synthesis_date')):
                            st.caption(f"Synthesis: {record['synthesis_date']}")

    st.markdown('<div id="patron-anchor"></div>', unsafe_allow_html=True)

    # ---- main layout: plot on the left, the three judgement groups to its right
    plot_col, main_col, subtype_col, flags_col = st.columns([3, 1, 1, 1])

    with plot_col:
        if mode == MODE_NORMAL:
            if existing:
                parts = []
                if LABEL_TYPE_MAIN in existing:
                    e = existing[LABEL_TYPE_MAIN]
                    parts.append(f"{e['label_value']} ({e['confidence']})")
                if LABEL_TYPE_SUBTYPE in existing:
                    parts.append(existing[LABEL_TYPE_SUBTYPE]['label_value'])
                if LABEL_TYPE_OXIDE in existing and existing[LABEL_TYPE_OXIDE]['label_value'] == 'SI':
                    parts.append('oxide')
                if LABEL_TYPE_MEZCLA in existing and existing[LABEL_TYPE_MEZCLA]['label_value'] == 'SI':
                    parts.append('mixture')
                note = existing_main.get('notes') if existing_main else None
                st.caption('ℹ️ Already labelled: ' + ' · '.join(parts)
                          + (f' · note: _{note}_' if note else ''))
        elif mode == MODE_BLIND:
            if existing_blind:
                st.caption(f"ℹ️ Blind label saved: **{existing_blind['label_value']}** "
                           f"({existing_blind['confidence']})")
        else:  # MODE_ADJUDICATION
            disc_info = disc_hashes[record['file_hash']]
            adj_status = " *(Already Adjudicated)*" if disc_info['is_adjudicated'] else ""
            st.warning(
                f"**Discrepancy to adjudicate{adj_status}:**  \n"
                f"• **Original:** `{disc_info['orig_val']}` ({disc_info['orig_conf']}) "
                f"— *{disc_info['orig_by'] or 'Rubén'}*  \n"
                f"• **Blind:** `{disc_info['blind_val']}` ({disc_info['blind_conf']}) "
                f"— *{disc_info['blind_by'] or 'Rubén'}*"
            )

        # ---- the diffractogram --------------------------------------------
        try:
            x, y = load_curve(record['measurement_id'])
        except Exception as exc:
            st.error(f'Could not load the curve: {exc}')
            x = y = None

        if x is None or len(x) == 0:
            st.warning('This measurement has no usable curve. You can mark it as '
                       'No sample or skip it.')
        else:
            plot_title = f"Pattern #{record['presentation_order']}" if mode == MODE_BLIND else record['sample_code']
            plot_show_analysis = False if mode == MODE_BLIND else show_analysis
            fig = plot_pattern(x, y, plot_title, plot_show_analysis)
            st.pyplot(fig, width='stretch')
            plt.close(fig)

    # Widget keys, scoped to this pattern's file_hash and active mode
    mode_prefix = 'norm' if mode == MODE_NORMAL else ('blind' if mode == MODE_BLIND else 'adj')
    mkey, skey = main_key(record, mode_prefix), subtype_key(record, mode_prefix)
    ikey, ckey = indicators_key(record, mode_prefix), comment_key(record, mode_prefix)

    main_values = [c[0] for c in CATEGORIES]
    if mode == MODE_BLIND:
        main_default = existing_blind['label_value'] if existing_blind and existing_blind['label_value'] in main_values else None
    else:
        main_default = existing_main['label_value'] if existing_main and existing_main['label_value'] in main_values else None

    with main_col:
        st.caption('**MAIN** · required')
        main_choice = st.pills(
            'Degree of crystalline order', options=main_values,
            format_func=lambda v: dict((c[0], c[1]) for c in CATEGORIES)[v],
            default=None if mkey in st.session_state else main_default, key=mkey, label_visibility='collapsed',
            on_change=_main_changed, args=(mkey, skey),
        )

    subtype_values = [s[0] for s in INCIPIENT_SUBTYPES]
    if mode == MODE_BLIND:
        existing_sub = existing.get(LABEL_TYPE_BLIND_SUBTYPE)
    else:
        existing_sub = existing.get(LABEL_TYPE_SUBTYPE)
    subtype_default = existing_sub['label_value'] if existing_sub and existing_sub['label_value'] in subtype_values else None

    subtype_captions = {s[0]: s[1] for s in INCIPIENT_SUBTYPES}
    subtype_help = '  \n'.join(f"**{s[1]}**: {s[2]}" for s in INCIPIENT_SUBTYPES)

    with subtype_col:
        st.caption('**SUBTYPE** · if INCIPIENT')
        subtype_choice = st.pills(
            'Incipient subtype', options=subtype_values,
            format_func=lambda v: subtype_captions[v],
            default=None if skey in st.session_state else subtype_default, key=skey, label_visibility='collapsed',
            help=subtype_help, on_change=_subtype_changed, args=(mkey, skey),
        )

    with flags_col:
        st.caption('**FLAGS**')
        # In blind mode the defaults come ONLY from blind rows: pre-ticking the
        # original flags would leak the earlier judgement and break the blinding.
        if mode == MODE_BLIND:
            existing_oxide = existing.get(LABEL_TYPE_BLIND_OXIDE)
            existing_mezcla = existing.get(LABEL_TYPE_BLIND_MEZCLA)
        else:
            existing_oxide = existing.get(LABEL_TYPE_OXIDE)
            existing_mezcla = existing.get(LABEL_TYPE_MEZCLA)
        indicator_defaults = []
        if existing_oxide and existing_oxide['label_value'] == 'SI':
            indicator_defaults.append('OXIDO')
        if existing_mezcla and existing_mezcla['label_value'] == 'SI':
            indicator_defaults.append('MEZCLA')
        target_main_row = existing_blind if mode == MODE_BLIND else existing_main
        if target_main_row and target_main_row.get('confidence') == 'dudosa':
            indicator_defaults.append('DUDOSA')
        indicator_labels = {
            'OXIDO': 'Oxide', 'MEZCLA': 'Mixture',
            'DUDOSA': 'Doubtful ⚠️',
        }
        indicators = st.pills(
            'Flags', options=['OXIDO', 'MEZCLA', 'DUDOSA'],
            format_func=lambda v: indicator_labels[v], selection_mode='multi',
            default=indicator_defaults, key=ikey, label_visibility='collapsed',
            help='Oxide: an oxide phase is visible besides the main one. Mixture: '
                 'suspicion of more than one phase, even if unidentified. Doubtful: '
                 'flags this pattern to revisit later (does not block saving).',
        )

        with st.container(horizontal=True, horizontal_alignment='distribute'):
            prev_clicked = st.button('←', help='Previous',
                                     disabled=st.session_state.idx == 0, key='btn_prev')
            accept_clicked = st.button('✅', type='primary',
                                       help='Accept and next',
                                       key=f'accept_{mode_prefix}_{record["file_hash"]}')
            skip_clicked = st.button('→', help='Skip', key='btn_skip')

        comment_default = (target_main_row or {}).get('notes') or ''
        comment_placeholder = 'adjudication rationale...' if mode == MODE_ADJUDICATION else 'optional comment...'
        st.text_input('Comment', key=ckey,
                      value=comment_default,
                      placeholder=comment_placeholder, label_visibility='collapsed')

        if prev_clicked:
            go_back(len(view))
            st.rerun()
        if skip_clicked:
            advance(len(view))
            st.rerun()
        if accept_clicked:
            if st.session_state.get(mkey) is None:
                st.error('Choose a Main category before accepting.')
            else:
                value = st.session_state[mkey]
                flags = st.session_state.get(ikey) or []
                confidence = 'dudosa' if 'DUDOSA' in flags else 'alta'
                notes = st.session_state.get(ckey, '')

                if mode == MODE_NORMAL:
                    save_label(record, LABEL_TYPE_MAIN, value, confidence, notes, labeled_by)
                    if value == 'INCIPIENTE' and st.session_state.get(skey) is not None:
                        save_label(record, LABEL_TYPE_SUBTYPE, st.session_state[skey],
                                  confidence, None, labeled_by)
                    save_label(record, LABEL_TYPE_OXIDE,
                              'SI' if 'OXIDO' in flags else 'NO', confidence, None, labeled_by)
                    save_label(record, LABEL_TYPE_MEZCLA,
                              'SI' if 'MEZCLA' in flags else 'NO', confidence, None, labeled_by)
                    load_labels.clear()
                    st.session_state.just_saved = (value, record['sample_code'])

                elif mode == MODE_BLIND:
                    # Blind mode: write exclusively to label_type='crystallinity_class_blind'
                    # and incipient_subtype_blind. NEVER touch crystallinity_class!
                    save_label(record, LABEL_TYPE_BLIND_MAIN, value, confidence, notes, labeled_by)
                    if value == 'INCIPIENTE' and st.session_state.get(skey) is not None:
                        save_label(record, LABEL_TYPE_BLIND_SUBTYPE, st.session_state[skey],
                                  confidence, None, labeled_by)
                    save_label(record, LABEL_TYPE_BLIND_OXIDE,
                              'SI' if 'OXIDO' in flags else 'NO', confidence, None, labeled_by)
                    save_label(record, LABEL_TYPE_BLIND_MEZCLA,
                              'SI' if 'MEZCLA' in flags else 'NO', confidence, None, labeled_by)
                    if 'repair_seen' in st.session_state:
                        st.session_state.repair_seen.add(record['file_hash'])
                    load_labels.clear()
                    st.session_state.just_saved = (value, f"Pattern #{record['presentation_order']}")

                else:  # MODE_ADJUDICATION
                    disc_info = disc_hashes[record['file_hash']]
                    adjudicator_sig = 'Rubén (adjudicación ciega 2026-10)'

                    # 1. Preserve original label in crystallinity_class_pre_blind
                    save_label(record, LABEL_TYPE_PRE_BLIND,
                               disc_info['orig_val'], disc_info['orig_conf'],
                               disc_info['orig_notes'], disc_info['orig_by'] or 'Rubén S.N.')

                    # 2. Update crystallinity_class with adjudicator signature
                    save_label(record, LABEL_TYPE_MAIN,
                               value, confidence, notes, adjudicator_sig)

                    if value == 'INCIPIENTE' and st.session_state.get(skey) is not None:
                        save_label(record, LABEL_TYPE_SUBTYPE, st.session_state[skey],
                                  confidence, None, adjudicator_sig)
                    save_label(record, LABEL_TYPE_OXIDE,
                              'SI' if 'OXIDO' in flags else 'NO', confidence, None, adjudicator_sig)
                    save_label(record, LABEL_TYPE_MEZCLA,
                              'SI' if 'MEZCLA' in flags else 'NO', confidence, None, adjudicator_sig)

                    # 3. Insert deterministic audit record into audit_log
                    _run("""
                        INSERT INTO audit_log (
                            agent, action, verdict, cause, result
                        ) VALUES (%s, %s, %s, %s, %s);
                    """, (
                        'ALCheMy-pxrd-adjudication',
                        'ADJUDICATE_CRYSTALLINITY_LABEL',
                        'RESOLVED',
                        f"Blind discrepancy: original={disc_info['orig_val']} vs blind={disc_info['blind_val']}. Adjudicated to {value} by {adjudicator_sig}.",
                        f"sample_code={record['sample_code']} file_hash={record['file_hash']} final_label={value}"
                    ), fetch=None)

                    load_labels.clear()
                    st.session_state.just_saved = (value, record['sample_code'])

                if not only_pending:
                    advance(len(view))
                st.rerun()


    # ---- keep the scroll position pinned to the pattern, not the page ----
    # Every widget change reruns the whole script, and on a phone that made
    # the page jump to the bottom (landing on the tally expander) or to the
    # very top. This snaps back to the anchor placed just above the plot on
    # every rerun, so the diffractogram stays in the same spot regardless of
    # what triggered the rerun.
    #
    # st.iframe (and the deprecated components.html before it) sandboxes the
    # script inside its own iframe, so window.parent.document access can be
    # silently blocked by the browser's cross-origin policy - the script
    # would just no-op with no visible error, which is exactly what seemed
    # to happen here. st.html with unsafe_allow_javascript runs the script
    # directly in the main document, so plain `document` is enough.
    st.html("""
    <script>
        try {
            const el = document.getElementById('patron-anchor');
            if (el) { el.scrollIntoView({behavior: 'instant', block: 'start'}); }
        } catch (e) {}
    </script>
    """, unsafe_allow_javascript=True)

    # ---- pre-fetch the next curve so the next click feels instant --------
    if st.session_state.idx + 1 < len(view):
        try:
            load_curve(view.iloc[st.session_state.idx + 1]['measurement_id'])
        except Exception:
            pass


if __name__ == '__main__':
    main()
