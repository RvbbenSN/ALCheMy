"""
ALCheMy - PXRD labelling app

WHAT IT IS FOR
--------------
Stage E2 of methodology/ROADMAP_PXRD_CRISTALINIDAD_Y_ML.md: producing the human
ground truth that supervised learning needs. There are ~1,870 diffractograms and
zero labels, and no amount of feature engineering compensates for that.

The whole design is built around one requirement: labelling several hundred
patterns in a sitting without the tool getting in the way. That means one click
per pattern and automatic advance - no dropdown, no save button, no confirmation.

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
scripts/ddl_pxrd_labels_v2.sql for the full reasoning. Short version: the
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
load_dotenv(os.path.join(REPO_ROOT, '.env'))

LABEL_TYPE = 'crystallinity_class'

# The categories. Order matters: it is the on-screen order and the keyboard order.
# Each is (value stored in the DB, button caption, help text).
CATEGORIES = [
    ('AMORFO',      'AMORFO',      'Sin reflexiones. Solo halo ancho o ruido.'),
    ('INCIPIENTE',  'INCIPIENTE',  'Reflexiones debiles asomando sobre un halo dominante.'),
    ('CRISTALINO',  'CRISTALINO',  'Reflexiones claras y definidas.'),
    ('MEZCLA',      'MEZCLA',      'Mas de una fase cristalina reconocible.'),
    ('SIN_MUESTRA', 'SIN MUESTRA', 'Portamuestras vacio o senal no atribuible a la muestra.'),
]
CATEGORY_COLORS = {
    'AMORFO': '#e8a33d', 'INCIPIENTE': '#b06a3c', 'CRISTALINO': '#1f7a8c',
    'MEZCLA': '#7b5ea7', 'SIN_MUESTRA': '#8a8a8a',
}

st.set_page_config(page_title='ALCheMy - Etiquetado PXRD', page_icon='🔬', layout='wide',
                    initial_sidebar_state='collapsed')

# Bigger touch targets for the classification buttons - this app is meant to
# also be usable from a phone on the home WiFi (see src/README.md), where the
# default Streamlit button height is too small to tap comfortably.
st.markdown("""
<style>
div[data-testid="stButton"] > button {
    min-height: 3em;
    font-size: 1.05em;
}
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
        dbname=os.getenv('POSTGRES_DB', 'alchemy_db'),
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


@st.cache_data(ttl=300, show_spinner='Cargando la cola de difractogramas...')
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
    """All existing labels, keyed by file_hash. Refreshed cheaply every minute."""
    rows = _run("""
        SELECT file_hash, label_value, confidence, notes
        FROM pxrd_labels WHERE label_type = %s;
    """, (LABEL_TYPE,))
    return {r['file_hash']: dict(r) for r in rows}


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


def save_label(record, value, confidence, notes, labeled_by):
    """
    Writes one label. UPSERT, so re-labelling a pattern on review overwrites
    cleanly instead of failing on the primary key.

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
        record['file_hash'], LABEL_TYPE, record['sample_code'], record['file_name'],
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
            peaks, _fw = detect_peaks_poisson(gx, layers['crystalline'], noise)
            a_c = integrate(layers['crystalline'], gx)
            a_a = integrate(layers['amorphous'], gx)
            xc = a_c / (a_c + a_a) if (a_c + a_a) > 0 else float('nan')
            if peaks.size:
                ax.plot(gx[peaks], np.interp(gx[peaks], x, y), 'v',
                        color='#c0392b', ms=7, label=f'{peaks.size} picos (3σ)')
            ax.text(0.995, 0.94, f'Xc estimada = {xc:.2f}', transform=ax.transAxes,
                    ha='right', va='top', fontsize=11, color='#c0392b',
                    bbox=dict(boxstyle='round,pad=0.4', fc='white', ec='#c0392b'))
            if peaks.size:
                ax.legend(loc='upper left', fontsize=9, frameon=False)
        except Exception as exc:                      # never let the overlay break labelling
            ax.text(0.5, 0.95, f'(analisis no disponible: {exc})', transform=ax.transAxes,
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


def comment_key(record):
    return f"comment_{record['file_hash']}"


def doubtful_key(record):
    return f"doubtful_{record['file_hash']}"


# ==========================================================================
# Application
# ==========================================================================

def main():
    st.title('🔬 Etiquetado de difractogramas PXRD')

    # ---- session state ---------------------------------------------------
    # Only `idx` and `just_saved` live in session_state. The comment box and the
    # "doubtful" checkbox are per-pattern widgets keyed by file hash, so their
    # state is managed by Streamlit and never assigned to directly.
    st.session_state.setdefault('idx', 0)
    st.session_state.setdefault('just_saved', None)

    try:
        queue = load_queue()
    except Exception as exc:
        st.error(f'No se puede conectar a la base de datos: {exc}')
        st.info('Comprueba que el contenedor esta arriba:  `docker ps`  y si hace falta '
                '`docker restart alchemy_postgres`.')
        st.stop()

    if queue.empty:
        st.warning('No hay difractogramas PXRD en la base de datos.')
        st.stop()

    labels = load_labels()

    # ---- sidebar ---------------------------------------------------------
    with st.sidebar:
        st.header('Sesion')
        labeled_by = st.text_input('Quien etiqueta', value=os.getenv('ALCHEMY_LABELER', 'Rubén S.N.'))

        st.divider()
        st.header('Que mostrar')
        only_pending = st.checkbox('Solo sin etiquetar', value=True,
                                   help='Al desactivarlo puedes repasar lo ya etiquetado.')
        metals = ['(todos)'] + sorted(queue['metal_center'].dropna().unique().tolist())
        linkers = ['(todos)'] + sorted(queue['linker'].dropna().unique().tolist())
        metal_filter = st.selectbox('Metal', metals)
        linker_filter = st.selectbox('Linker', linkers)

        st.divider()
        show_analysis = st.checkbox('Mostrar analisis automatico', value=False)
        st.caption('⚠️ Si ves la Xc calculada mientras etiquetas, tus etiquetas dejan de ser '
                   'independientes del algoritmo y ya no sirven para validarlo. Uselo solo '
                   'para casos dudosos.')

    # ---- build the working subset ---------------------------------------
    view = queue
    if metal_filter != '(todos)':
        view = view[view['metal_center'] == metal_filter]
    if linker_filter != '(todos)':
        view = view[view['linker'] == linker_filter]
    if only_pending:
        view = view[~view['file_hash'].isin(labels.keys())]
    view = view.reset_index(drop=True)

    # ---- global progress -------------------------------------------------
    total, done = len(queue), len(labels)
    c1, c2, c3, c4 = st.columns(4)
    c1.metric('Etiquetados', f'{done:,}')
    c2.metric('Totales', f'{total:,}')
    c3.metric('Progreso', f'{100*done/total:.1f} %')
    c4.metric('En esta vista', f'{len(view):,}')
    st.progress(done / total if total else 0.0)

    if st.session_state.just_saved:
        value, code = st.session_state.just_saved
        st.success(f'Guardado: **{code} → {value}**', icon='✅')
        st.session_state.just_saved = None

    if view.empty:
        st.balloons()
        st.success('No queda nada pendiente con estos filtros. '
                   'Desactiva "Solo sin etiquetar" para repasar.')
        st.stop()

    st.session_state.idx = clamp(st.session_state.idx, len(view))
    record = view.iloc[st.session_state.idx].to_dict()
    existing = labels.get(record['file_hash'])

    st.divider()

    # ---- main layout: plot on the left, controls on the right ------------
    # The classification buttons sit next to the diffractogram (not below it)
    # so labelling never needs a scroll - that was the whole point of the
    # one-click auto-advance design.
    plot_col, control_col = st.columns([3, 1])

    with plot_col:
        st.subheader(record['sample_code'])
        st.markdown(
            f"**Metal:** `{record['metal_center']}`  |  **Linker:** `{record['linker']}`"
        )
        extra = []
        if pd.notna(record.get('temp_target_c')):
            extra.append(f"{record['temp_target_c']:.0f} °C")
        if pd.notna(record.get('time_hours')):
            extra.append(f"{record['time_hours']:.0f} h")
        if pd.notna(record.get('synthesis_date')):
            extra.append(str(record['synthesis_date']))
        if extra:
            st.caption(' · '.join(extra))
        st.caption(f"**Fichero:** `{record['file_name']}`")
        st.caption(f"**Ruta:** `{record['raw_file_path']}`")
        st.caption(f"**Posicion:** {st.session_state.idx + 1} de {len(view)}")

        if existing:
            st.info(f"Ya etiquetado como **{existing['label_value']}** "
                    f"({existing['confidence']}). Volver a pulsar lo sobrescribe."
                    + (f"  \nNota: _{existing['notes']}_" if existing['notes'] else ''))

        # ---- the diffractogram --------------------------------------------
        try:
            x, y = load_curve(record['measurement_id'])
        except Exception as exc:
            st.error(f'No se pudo cargar la curva: {exc}')
            x = y = None

        if x is None or len(x) == 0:
            st.warning('Esta medida no tiene curva utilizable. Puedes marcarla como SIN MUESTRA '
                       'o saltarla.')
        else:
            fig = plot_pattern(x, y, record['sample_code'], show_analysis)
            st.pyplot(fig, width='stretch')
            plt.close(fig)      # matplotlib figures leak across re-runs if not closed

    with control_col:
        # ---- the classification buttons, stacked so they stay beside the plot
        st.markdown('#### Clasificacion')
        for value, caption, help_text in CATEGORIES:
            if st.button(caption, width='stretch', type='primary',
                         help=help_text, key=f'btn_{value}'):
                ckey, dkey = comment_key(record), doubtful_key(record)
                save_label(record, value,
                           'dudosa' if st.session_state.get(dkey) else 'alta',
                           st.session_state.get(ckey, ''), labeled_by)
                load_labels.clear()
                st.session_state.just_saved = (value, record['sample_code'])
                # With "only pending" on, the labelled row drops out of the view,
                # so the same index already points at the next pattern. Otherwise
                # move forward explicitly.
                if not only_pending:
                    advance(len(view))
                st.rerun()

        st.divider()

        # ---- comment + doubt -----------------------------------------------
        # Keyed by file hash: each pattern owns its widgets, so they start empty
        # and stepping back restores what was typed. See the note above `advance`.
        ckey, dkey = comment_key(record), doubtful_key(record)
        st.text_input('Comentario (opcional)', key=ckey,
                      value=(existing or {}).get('notes') or '',
                      placeholder='p. ej. posible fase de oxido...')
        st.checkbox('Dudosa', key=dkey,
                    value=bool(existing and existing.get('confidence') == 'dudosa'),
                    help='Se guarda como confidence = dudosa y podras excluirla del entrenamiento.')

        st.divider()

        # ---- navigation ------------------------------------------------------
        if st.button('← Anterior', width='stretch',
                     disabled=st.session_state.idx == 0, key='btn_prev'):
            go_back(len(view))
            st.rerun()
        if st.button('Saltar →', width='stretch', key='btn_skip'):
            advance(len(view))
            st.rerun()
        st.caption('Al clasificar se guarda y se pasa sola a la siguiente. '
                   '"Anterior" sirve para revisar; volver a clasificar sobrescribe.')

    # ---- pre-fetch the next curve so the next click feels instant --------
    if st.session_state.idx + 1 < len(view):
        try:
            load_curve(view.iloc[st.session_state.idx + 1]['measurement_id'])
        except Exception:
            pass

    # ---- running tally ---------------------------------------------------
    if labels:
        st.divider()
        tally = pd.Series([v['label_value'] for v in labels.values()]).value_counts()
        st.markdown('#### Reparto de lo etiquetado hasta ahora')
        tcols = st.columns(len(CATEGORIES))
        for col, (value, caption, _h) in zip(tcols, CATEGORIES):
            col.metric(caption, int(tally.get(value, 0)))


if __name__ == '__main__':
    main()
