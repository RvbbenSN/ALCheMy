import { useBundle } from '../i18n/LocaleContext.jsx'
import * as UI_EN from '../content/ui.js'
import * as UI_ES from '../content/es/ui.js'
import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Activity,
  Atom,
  Beaker,
  Database,
  Download,
  Droplets,
  FlaskConical,
  Flame,
  Gem,
  GitBranch,
  IdCard,
  Layers,
  Link2,
  Microscope,
  Ruler,
  ShieldCheck,
  Wand2,
  Waves,
} from 'lucide-react'
import * as SCREENS_EN from '../content/screens.js'
import * as SCREENS_ES from '../content/es/screens.js'
import * as PREP_EN from '../content/prep.js'
import * as PREP_ES from '../content/es/prep.js'
import { Badge, Card, Placeholder, ScrollTable, SectionTitle, Term, Rich } from '../components/ui.jsx'
import NotebookList from '../components/NotebookList.jsx'
import NotebookFigure from '../components/NotebookFigure.jsx'
import PxrdChart from '../components/PxrdChart.jsx'
import ScreenRecording from '../components/ScreenRecording.jsx'


/* Un simbolo por grupo de variables de sintesis. */
const GROUP_ICON = {
  id: IdCard,
  design: Beaker,
  solvent: Droplets,
  thermal: Flame,
  modulator: FlaskConical,
}

function Formula({ children }) {
  return (
    <div
      className="mono my-3 overflow-x-auto rounded-[var(--radius-badge)] p-3 text-sm"
      style={{ background: 'var(--surface-elevated)', border: '2px solid var(--surface-border)', color: 'var(--text-primary)' }}
    >
      {children}
    </div>
  )
}

function Pullquote({ children, tone = 'accent' }) {
  return (
    <blockquote
      className="p-5 text-lg"
      style={{
        borderLeft: `4px solid var(--${tone === 'accent' ? 'accent-primary' : `status-${tone}`})`,
        background: 'var(--surface-elevated)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-heading)',
        margin: '1.5rem 0',
      }}
    >
      {children}
    </blockquote>
  )
}

/* Lista de campos como fichas monoespaciadas, en vez de otro parrafo. */
function FieldChips({ fields }) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {fields.map((f) => (
        <code
          key={f}
          className="rounded-[var(--radius-badge)] px-2 py-0.5 text-xs"
          style={{ border: '1.5px solid var(--surface-border)', color: 'var(--text-secondary)' }}
        >
          <Rich>{f}</Rich>
        </code>
      ))}
    </div>
  )
}

/* Tabla de dos columnas: nombre de variable y que significa. Mas legible que
   una lista de vinetas cuando lo que se compara son definiciones. */
function FeatureList({ items, accent }) {
  return (
    <ul className="flex list-none flex-col gap-2.5 p-0">
      {items.map(([name, what]) => (
        <li key={name} style={{ borderLeft: `2px solid ${accent}`, paddingLeft: '0.75rem' }}>
          <code className="text-xs" style={{ color: 'var(--text-primary)' }}><Rich>{name}</Rich></code>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}><Rich>{what}</Rich></p>
        </li>
      ))}
    </ul>
  )
}

/* Simbolos de la tabla de descriptores y de sus tres lecturas. */
const DESC_ICON = { ruler: Ruler, layers: Layers, activity: Activity, shield: ShieldCheck }
const READ_ICON = { waves: Waves, gem: Gem, gitbranch: GitBranch }
const TAKE_ICON = { flask: FlaskConical, waves: Waves, link: Link2 }
const READ_TONE = {
  amorphous: 'var(--status-amorphous)',
  incipient: 'var(--status-incipient)',
  pure: 'var(--status-pure)',
}

/* El selector de via. Se pinta dos veces —arriba y al final de la pagina— por
   una razon concreta: leyendo una de las dos mitades es facil olvidar que la
   otra existe, y al llegar al final no habia forma de cambiar sin volver a
   subir a mano. El de abajo devuelve la vista al principio al pulsar. */
function LaneSwitch({ lane, setLane, onPick }) {
  /* Pide su propio paquete: es un componente aparte del de la pantalla, asi
     que no hereda la desestructuracion de aquel. */
  const { LANES } = useBundle(PREP_EN, PREP_ES)

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {LANES.map((l) => {
        const on = lane === l.id
        const Icon = l.id === 'synthesis' ? Beaker : Waves
        return (
          <button
            key={l.id}
            type="button"
            onClick={() => {
              setLane(l.id)
              if (onPick) onPick()
            }}
            aria-pressed={on}
            className="rounded-[var(--radius-card)] p-5 text-left"
            style={{
              border: `var(--border-card) solid ${on ? 'var(--accent-primary)' : 'var(--surface-border)'}`,
              background: on ? 'var(--accent-glow)' : 'var(--surface-elevated)',
            }}
          >
            <div className="flex items-center gap-3">
              <Icon size={22} aria-hidden style={{ color: on ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
              <h2 className="text-lg leading-tight"><Rich>{l.label}</Rich></h2>
              <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                <Rich>{l.tag}</Rich>
              </span>
            </div>
            <p className="mt-1 text-xs uppercase tracking-wider" style={{ color: 'var(--accent-secondary-text)' }}>
              <Rich>{l.sub}</Rich>
            </p>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{l.blurb}</Rich>
            </p>
          </button>
        )
      })}
    </div>
  )
}

// Un icono por verbo del ETL, en el mismo orden en que aparecen en pantalla:
// entra el dato (Download), se le da forma (Wand2), aterriza en el almacen (Database).
const ETL_STEP_ICONS = { extract: Download, transform: Wand2, load: Database }

export default function DataPreparation() {
  const { UI } = useBundle(UI_EN, UI_ES)
  const { ETL_DEFECTS, ETL_EXCLUSION, ETL_IMPUTATION, ETL_STOICHIOMETRY, ETL_TANNIC, ETL_THERMAL, ETL_ZERO_VS_NULL } = useBundle(SCREENS_EN, SCREENS_ES)
  const { DESCRIPTOR_GROUPS, DESCRIPTOR_RECAP, ELEMENT_INTRO, LANES, LINKER_FEATURES, METAL_FEATURES, PREP_INTRO, PREP_TAKEAWAY, SYNTH_GROUPS, SYNTH_PREVIEW, WHY_PXRD } = useBundle(PREP_EN, PREP_ES)

  /* Si se llega con #descriptors (el enlace desde la pantalla 04), hay que
     abrir la via de caracterizacion: la seccion enlazada vive dentro de ella y
     con la via de sintesis activa el ancla sencillamente no existe en el DOM. */
  const { hash } = useLocation()
  const [lane, setLane] = useState(hash === '#descriptors' ? 'characterisation' : 'synthesis')

  return (
    <div className="flex flex-col gap-16">
      <section>
        <Badge tone="accent">03 · Data Preparation</Badge>
        <h1 className="mt-4 text-3xl uppercase md:text-5xl" style={{ fontFamily: 'var(--font-display)', letterSpacing: '2px' }}>{UI.prep.etlPxrdSignalProcessing}</h1>
        <p className="mt-6 max-w-3xl text-lg" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{PREP_INTRO.lead}</Rich>
        </p>

        <div className="mt-6 max-w-3xl">
          <h3 className="text-base">{PREP_INTRO.etlTitle}</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {PREP_INTRO.etlSteps.map((step) => {
              const Icon = ETL_STEP_ICONS[step.key]
              return (
                <div
                  key={step.key}
                  className="rounded-[var(--radius-card)] p-3"
                  style={{ border: '1px solid var(--surface-border)', background: 'var(--surface-elevated)' }}
                >
                  <div className="flex items-center gap-2">
                    <Icon size={16} aria-hidden style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                    <strong style={{ color: 'var(--text-primary)' }}>{step.label}</strong>
                  </div>
                  <p className="mt-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {step.body}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        <ul className="mt-6 flex max-w-3xl list-none flex-col gap-3 p-0">
          {PREP_INTRO.halves.map((h) => (
            <li key={h.lane} style={{ borderLeft: '3px solid var(--accent-primary)', paddingLeft: '0.9rem' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{h.title}.</strong>{' '}
              <span style={{ color: 'var(--text-secondary)' }}><Rich>{h.body}</Rich></span>
            </li>
          ))}
        </ul>

        <p className="mt-4 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{PREP_INTRO.halvesNote}</Rich>
        </p>
        <p
          className="mt-5 max-w-3xl p-3 text-sm"
          style={{ borderLeft: '4px solid var(--accent-secondary)', background: 'var(--surface-elevated)', color: 'var(--text-secondary)' }}
        >
          <Rich>{PREP_INTRO.note}</Rich>
        </p>
      </section>

      {/* ---------------------------------------------------------------
          Las dos vias. Antes estaban intercaladas en una sola columna y no
          habia forma de saber cual se estaba leyendo.
          --------------------------------------------------------------- */}
      <section id="lane-switch">
        <LaneSwitch lane={lane} setLane={setLane} />
      </section>

      {/* =============================================================
          VIA A — CONDICIONES DE SINTESIS
          ============================================================= */}
      {lane === 'synthesis' && (
        <>
          <section>
            <SectionTitle eyebrow={UI.prep.oneRowPerSynthesis.eyebrow}>{UI.prep.oneRowPerSynthesis.title}</SectionTitle>
            <p className="mb-4 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{SYNTH_PREVIEW.caption}</Rich>
            </p>
            <ScrollTable head={SYNTH_PREVIEW.head} rows={SYNTH_PREVIEW.rows} />
            <p
              className="mt-3 p-3 text-xs"
              style={{ borderLeft: '4px solid var(--status-incipient)', background: 'var(--surface-elevated)', color: 'var(--text-secondary)' }}
            >
              <Rich>{SYNTH_PREVIEW.warning}</Rich>
            </p>
          </section>

          <section>
            <SectionTitle eyebrow={UI.prep.whatEachColumnHolds.eyebrow}>{UI.prep.whatEachColumnHolds.title}</SectionTitle>
            <p className="mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
              Forty-six columns in five blocks, plus the timestamps the database keeps on its own.
            </p>
            <div className="flex flex-col gap-4">
              {SYNTH_GROUPS.map((g) => {
                const Icon = GROUP_ICON[g.icon] ?? Beaker
                return (
                  <Card key={g.title}>
                    <div className="flex items-center gap-3">
                      <Icon size={18} aria-hidden style={{ color: 'var(--accent-primary)' }} />
                      <h3 className="text-base"><Rich>{g.title}</Rich></h3>
                      <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        <Rich>{g.fields.length}</Rich>
                      </span>
                    </div>
                    <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <Rich>{g.body}</Rich>
                    </p>
                    <FieldChips fields={g.fields} />
                  </Card>
                )
              })}
            </div>
          </section>

          <section>
            <SectionTitle eyebrow={UI.prep.fromSpreadsheetToGoverned.eyebrow}>{UI.prep.fromSpreadsheetToGoverned.title}</SectionTitle>
            <p className="mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
              Five years of handwritten synthesis conditions lived in one multi-tab Excel file with
              arbitrary headers.
            </p>

            <div className="flex flex-col gap-4">
              <Card>
                <h3 className="text-base">{UI.prep.paso1HeaderNormalisation}</h3>
                <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  A master mapping dictionary translates arbitrary spreadsheet headers into a strict SQL
                  schema. Kept as an explicit dictionary rather than automatic slug-casing, so that
                  renaming a column in the spreadsheet produces a visible failure instead of a silently
                  new column.
                </p>
              </Card>

              <Card>
                <h3 className="text-base">{UI.prep.paso2StoichiometricFeatureEngineering}</h3>
                <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <Rich>{ETL_STOICHIOMETRY.intro}</Rich>
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--accent-secondary-text)' }}>
                      <Rich>{ETL_STOICHIOMETRY.typeA.title}</Rich>
                    </div>
                    <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <Rich>{ETL_STOICHIOMETRY.typeA.body}</Rich>
                    </p>
                    <Formula><Rich>{ETL_STOICHIOMETRY.typeA.formula}</Rich></Formula>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--accent-secondary-text)' }}>
                      <Rich>{ETL_STOICHIOMETRY.typeB.title}</Rich>
                    </div>
                    <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <Rich>{ETL_STOICHIOMETRY.typeB.body}</Rich>
                    </p>
                    <Formula><Rich>{ETL_STOICHIOMETRY.typeB.formula}</Rich></Formula>
                  </div>
                </div>
              </Card>

              <Card>
                <h3 className="text-base">3 · <Rich>{ETL_THERMAL.title}</Rich></h3>
                <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <Rich>{ETL_THERMAL.body}</Rich>
                </p>
                {ETL_THERMAL.formulas.map((f) => (
                  <Formula key={f}><Rich>{f}</Rich></Formula>
                ))}
              </Card>

              <Card>
                <h3 className="text-base">{UI.prep.paso4AnMd5Business}</h3>
                <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  A checksum over six business fields — sample code, date, researcher, unit, metal centre
                  and linker — gives every synthesis an identity derived from what it <em>is</em>, not from
                  the row it happened to occupy. Two spreadsheets describing the same experiment collapse
                  to the same key. See <Term k="MD5" />.
                </p>
              </Card>

              <Card accent>
                <h3 className="text-base">{UI.prep.paso5TheLoadIs}</h3>
                <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  The synthesis table is written by both this ETL notebook and the live ingestion pipeline. Using an UPSERT (on conflict: update) keyed on sample_code guarantees that batch updates never overwrite or erase newly ingested records.
                </p>
              </Card>
            </div>
          </section>

          <section>
            <SectionTitle eyebrow={UI.prep.whyTheElementIs.eyebrow}>{UI.prep.whyTheElementIs.title}</SectionTitle>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <h3 className="flex items-center gap-2 text-base">
                  <Atom size={17} aria-hidden style={{ color: 'var(--accent-primary)' }} />
                  Metal featurization
                </h3>
                <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <Rich>{ELEMENT_INTRO.problem}</Rich>
                </p>
                <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <Rich>{ELEMENT_INTRO.fix}</Rich>
                </p>
              </Card>
              <Card accent>
                <h3 className="flex items-center gap-2 text-base">
                  <Link2 size={17} aria-hidden style={{ color: 'var(--accent-tertiary)' }} />
                  Linker featurization
                </h3>
                <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <Rich>{ELEMENT_INTRO.payoff}</Rich>
                </p>
              </Card>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-base">
                  <Atom size={17} aria-hidden style={{ color: 'var(--accent-primary)' }} />
                  Eight numbers for the metal
                  <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    mendeleev · pymatgen
                  </span>
                </h3>
                <FeatureList items={METAL_FEATURES} accent="var(--accent-primary)" />
              </div>
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-base">
                  <Link2 size={17} aria-hidden style={{ color: 'var(--accent-tertiary)' }} />
                  Six for the linker
                  <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    RDKit
                  </span>
                </h3>
                <FeatureList items={LINKER_FEATURES} accent="var(--accent-tertiary)" />
              </div>
            </div>
          </section>

          <section>
            <SectionTitle eyebrow={UI.prep.examplesOfSilentData.eyebrow}>{UI.prep.examplesOfSilentData.title}</SectionTitle>
            <p className="mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
              A model can run smoothly on corrupted data without throwing errors. These examples show why revisions are neccesary.
            </p>
            <ol className="flex list-none flex-col gap-4 p-0">
              {ETL_DEFECTS.map((d) => (
                <li key={d.n}>
                  <Card accent={d.n === 1}>
                    <div className="flex items-start gap-4">
                      <span
                        className="shrink-0 text-2xl"
                        style={{ fontFamily: 'var(--font-display)', color: 'var(--status-amorphous)' }}
                      >
                        <Rich>{d.n}</Rich>
                      </span>
                      <div>
                        <h3 className="text-base"><Rich>{d.defect}</Rich></h3>
                        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                          <strong style={{ color: 'var(--text-primary)' }}>How it surfaced. </strong>
                          <Rich>{d.found}</Rich>
                        </p>
                        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                          <strong style={{ color: 'var(--status-pure)' }}>Fix. </strong>
                          <Rich>{d.fix}</Rich>
                        </p>
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ol>

            <Card className="mt-6">
              <h3 className="text-lg"><Rich>{ETL_ZERO_VS_NULL.title}</Rich></h3>
              <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <Rich>{ETL_ZERO_VS_NULL.body}</Rich>
              </p>
              <Pullquote><Rich>{ETL_ZERO_VS_NULL.pullquote}</Rich></Pullquote>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                The check that proves defects 4 and 5 are genuinely fixed: the composition of the medium
                now sums to 1.000. Before the correction the mean was 0.789 — and version 2 had no such
                check, which is precisely why the fault survived.
              </p>
            </Card>
          </section>

          <section>
            <SectionTitle eyebrow={UI.prep.ebCuration}><Rich>{ETL_EXCLUSION.title}</Rich></SectionTitle>
            <Card accent>
              <p style={{ color: 'var(--text-secondary)' }}><Rich>{ETL_EXCLUSION.body}</Rich></p>
              <p className="mt-4" style={{ color: 'var(--text-secondary)' }}>
                <Rich>{ETL_EXCLUSION.decision}</Rich>
              </p>
              <Pullquote><Rich>{ETL_EXCLUSION.pullquote}</Rich></Pullquote>
            </Card>
          </section>

          <section>
            <SectionTitle eyebrow={UI.prep.ebADecisionThatCould}><Rich>{ETL_TANNIC.title}</Rich></SectionTitle>
            <Card>
              <p style={{ color: 'var(--text-secondary)' }}><Rich>{ETL_TANNIC.body}</Rich></p>
              <p className="mt-4 text-sm" style={{ color: 'var(--status-pure)' }}>
                <Rich>{ETL_TANNIC.measure}</Rich>
              </p>
            </Card>
            <Pullquote tone="incipient">⚠️ <Rich>{ETL_TANNIC.caution}</Rich></Pullquote>
          </section>

          <section>
            <SectionTitle eyebrow={UI.prep.ebFillingTheGaps}><Rich>{ETL_IMPUTATION.title}</Rich></SectionTitle>
            <Card>
              <p style={{ color: 'var(--text-secondary)' }}><Rich>{ETL_IMPUTATION.body}</Rich></p>
              <Pullquote tone="amorphous"><Rich>{ETL_IMPUTATION.leak}</Rich></Pullquote>
              <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                The alternative — explicitly flagging which values were missing, letting the model learn
                from the fact of absence — was tested rather than assumed:
              </p>
              <ScrollTable head={ETL_IMPUTATION.tableHead} rows={ETL_IMPUTATION.tableRows} />
              <p className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <Rich>{ETL_IMPUTATION.conclusion}</Rich>
              </p>
            </Card>
          </section>
        </>
      )}

      {/* =============================================================
          VIA B — SENAL DE CARACTERIZACION
          ============================================================= */}
      {lane === 'characterisation' && (
        <>
          <section>
            <SectionTitle eyebrow={UI.prep.pxrdDiffractogramsAsCore.eyebrow}>{UI.prep.pxrdDiffractogramsAsCore.title}</SectionTitle>
            <p className="mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{WHY_PXRD.lead}</Rich>
            </p>

            <ol className="flex list-none flex-col gap-2 p-0">
              {WHY_PXRD.steps.map(([name, question, cost, first]) => (
                <li
                  key={name}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-[var(--radius-badge)] p-3"
                  style={{
                    border: `2px solid ${first ? 'var(--accent-primary)' : 'var(--surface-border)'}`,
                    background: first ? 'var(--accent-glow)' : 'transparent',
                  }}
                >
                  <span className="text-sm" style={{ fontFamily: 'var(--font-mono)', color: first ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                    <Rich>{name}</Rich>
                  </span>
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}><Rich>{question}</Rich></span>
                  <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}><Rich>{cost}</Rich></span>
                </li>
              ))}
            </ol>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <Card accent>
                <h3 className="flex items-center gap-2 text-base">
                  <Ruler size={17} aria-hidden style={{ color: 'var(--accent-primary)' }} />
                  Why it goes first
                </h3>
                <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <Rich>{WHY_PXRD.gate}</Rich>
                </p>
                <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <Rich>{WHY_PXRD.consequence}</Rich>
                </p>
              </Card>
              <Card>
                <h3 className="flex items-center gap-2 text-base">
                  <Microscope size={17} aria-hidden style={{ color: 'var(--accent-tertiary)' }} />
                  And why the model predicts it
                </h3>
                <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <Rich>{WHY_PXRD.why_model}</Rich>
                </p>
              </Card>
            </div>
          </section>

          <section>
            <SectionTitle eyebrow={UI.prep.fromRawSignalTo.eyebrow}>{UI.prep.fromRawSignalTo.title}</SectionTitle>
            <p className="mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
              A machine learning model cannot ingest thousands of raw (2theta, Intensity) points as tabular features. Here, each <strong>diffraction pattern is decomposed into its physical components </strong>—instrument background, diffuse amorphous halo, and Bragg peaks—extracting 29 quantitative descriptors that capture crystal order, peak geometry, and signal quality.
            </p>
            <PxrdChart />
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Card accent>
                <h3 className="text-base">{UI.prep.whatTheThreeLayers}</h3>
                <ul className="mt-3 flex list-none flex-col gap-3 p-0 text-sm">
                  <li style={{ borderLeft: '2px solid var(--accent-primary)', paddingLeft: '0.75rem' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Dashed baseline — instrument noise.</strong>{' '}
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Measured directly from an empty sample holder on the same diffractometer (air
                      scatter, detector drift), not fitted. Fitting a smooth curve instead — an{' '}
                      <Term k="arPLS" /> baseline — works only while the halo is narrower than the scan;
                      in a genuinely amorphous sample the fitted curve climbs onto the halo and carries
                      it away, leaving <strong>0.4% of the area as halo</strong> on the amorphous example
                      below when the sample is almost entirely halo.
                    </span>
                  </li>
                  <li style={{ borderLeft: '2px solid var(--accent-primary)', paddingLeft: '0.75rem' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Diffuse halo — amorphous fraction.</strong>{' '}
                    <span style={{ color: 'var(--text-secondary)' }}>
                      The broad hump from short-range disorder. It is true chemical signal, not
                      background — measured correctly (baseline subtracted, not fitted), it comes back at{' '}
                      <strong>18% of the total area</strong> on that same example, 94% of what the sample
                      itself scattered. It is what separates a failed synthesis from a disordered solid.
                    </span>
                  </li>
                  <li style={{ borderLeft: '2px solid var(--accent-primary)', paddingLeft: '0.75rem' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Sharp Bragg peaks — crystalline order.</strong>{' '}
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Constructive interference from periodic (hkl) crystal planes. Their position,
                      intensity and width (FWHM) are what identify the crystalline phase.
                    </span>
                  </li>
                </ul>
              </Card>
              <Card accent>
                <h3 className="text-base">{UI.prep.peakDetectionThe3}</h3>
                <ul className="mt-3 flex list-none flex-col gap-3 p-0 text-sm">
                  <li style={{ borderLeft: '2px solid var(--accent-primary)', paddingLeft: '0.75rem' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Poisson noise scale.</strong>{' '}
                    <span style={{ color: 'var(--text-secondary)' }}>
                      X-ray detection is photon counting, so noise follows Poisson statistics: its scale
                      is the square root of the counts.
                    </span>
                  </li>
                  <li style={{ borderLeft: '2px solid var(--accent-primary)', paddingLeft: '0.75rem' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>The 3σ floor.</strong>{' '}
                    <span style={{ color: 'var(--text-secondary)' }}>
                      A local maximum only counts as a genuine reflection once its height clears three
                      times the noise level above the local background.
                    </span>
                  </li>
                  <li style={{ borderLeft: '2px solid var(--accent-primary)', paddingLeft: '0.75rem' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Why not looser.</strong>{' '}
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Three sigma is the level for <em>one</em> comparison — scanning thousands of points
                      for a maximum needs a stricter level, or noise gets misread as reflections. The
                      threshold drawn here is the honest floor, not the final criterion.
                    </span>
                  </li>
                </ul>
              </Card>
            </div>
          </section>

          <section>
            <SectionTitle eyebrow={UI.prep.labelerExplorer.eyebrow}>{UI.prep.labelerExplorer.title}</SectionTitle>
            <p className="mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
              Two Streamlit tools, built for this project. The <strong>labeler</strong> produced four
              independent verdicts per pattern over 1,877 diffractograms — crystallinity class, incipient
              subtype, oxide flag and suspected multiphase. The <strong>explorer</strong> is where the
              signal-processing pipeline was tuned, curve by curve, before it was trusted on all of them.
            </p>
            <p className="mb-6 max-w-3xl text-sm" style={{ color: 'var(--text-secondary)' }}>
            </p>
            <div className="grid gap-6 lg:grid-cols-2">
              <ScreenRecording
                src="/video/pxrd_labeler.mp4"
                title="The labeler"
                duration="7:12"
                note="One pattern at a time: the four verdicts on the right, written straight into pxrd_labels."
              />
              <ScreenRecording
                src="/video/pxrd_explorer.mp4"
                title="The explorer"
                duration="2:08"
                note="Baseline, amorphous halo and Bragg peaks separated live, with every descriptor recomputed as the parameters move."
              />
            </div>
          </section>

          {/* Ancla: la pantalla 04 enlaza aqui para recordar de donde salen los
              29 numeros. Ver scrollToHash en Layout.jsx. */}
          <section id="descriptors">
            <SectionTitle eyebrow={UI.prep.whatADiffractogramBecomes.eyebrow}>{UI.prep.whatADiffractogramBecomes.title}</SectionTitle>
            <p className="mb-2 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
              <Rich>{DESCRIPTOR_RECAP.lead}</Rich>
            </p>
            <p className="mb-6 text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {DESCRIPTOR_RECAP.counts}
            </p>

            <div className="mb-6">
              <NotebookFigure
                src="nb05-17.png"
                alt="Anatomy of the PXRD descriptor vector: an annotated diffractogram showing where each of the 29 descriptors comes from"
                caption="Anatomy of the descriptor vector. Every one of the 29 numbers, shown on the scan it was measured from, grouped by traceability, peak geometry, phase composition and global statistics."
                source="notebook 05"
              />
            </div>

            <div className="flex flex-col gap-6">
              {DESCRIPTOR_GROUPS.map((g) => {
                const Icon = DESC_ICON[g.icon] ?? Ruler
                return (
                  <div key={g.title}>
                    <div className="mb-2 flex items-center gap-2.5">
                      <Icon size={17} aria-hidden style={{ color: 'var(--accent-primary)' }} />
                      <h3 className="text-base">{g.title}</h3>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{g.blurb}</span>
                      <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {g.rows.length}
                      </span>
                    </div>
                    <ScrollTable
                      head={DESCRIPTOR_RECAP.head}
                      rows={g.rows.map(([name, what, a, i, c]) => [
                        <code key={name}>{name}</code>,
                        what,
                        a,
                        i,
                        c,
                      ])}
                    />
                  </div>
                )
              })}
            </div>

            <h3 className="mb-4 mt-10 text-lg">{UI.prep.howToReadIt}</h3>
            <div className="grid gap-4 lg:grid-cols-3">
              {DESCRIPTOR_RECAP.reading.map((r) => {
                const Icon = READ_ICON[r.icon] ?? Waves
                const tone = READ_TONE[r.tone] ?? 'var(--accent-primary)'
                return (
                  <Card key={r.klass}>
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                        style={{ border: `2.5px solid ${tone}`, color: tone }}
                      >
                        <Icon size={17} aria-hidden />
                      </span>
                      <span className="text-xs uppercase tracking-wider" style={{ color: tone }}>
                        {r.klass}
                      </span>
                    </div>
                    <h4 className="mt-3 text-base leading-tight">{r.title}</h4>
                    <ul className="mt-2 flex list-none flex-col gap-1.5 p-0 text-sm">
                      {r.points.map((p, i) => (
                        <li key={i} style={{ borderLeft: `2px solid ${tone}`, paddingLeft: '0.6rem', color: 'var(--text-secondary)' }}>
                          <Rich>{p}</Rich>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )
              })}
            </div>

            <p
              className="mt-6 p-4 text-sm"
              style={{
                borderLeft: '4px solid var(--status-amorphous)',
                background: 'var(--surface-elevated)',
                color: 'var(--text-secondary)',
              }}
            >
              <strong style={{ color: 'var(--text-primary)' }}>A physical note on descriptor validity. </strong>
              <Rich>{DESCRIPTOR_RECAP.caveat}</Rich>
            </p>
          </section>
        </>
      )
      }

      {/* --- comun a las dos vias --- */}
      <section>
        <SectionTitle eyebrow={UI.prep.readTheNotebooks.eyebrow}>{UI.prep.readTheNotebooks.title}</SectionTitle>
        <p className="mb-6 max-w-3xl text-sm" style={{ color: 'var(--text-secondary)' }}>
        </p>
        <NotebookList only="03" />
        <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
          The full set of seven notebooks is linked from the screen each one belongs to.
        </p>
      </section>

      {/* Volver a ofrecer la otra mitad al llegar al final. */}
      <section>
        <SectionTitle eyebrow={UI.prep.switchLane.eyebrow}>{UI.prep.switchLane.title}</SectionTitle>
        <p className="mb-4 max-w-3xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          This screen has two halves and you have just finished one of them.
        </p>
        <LaneSwitch
          lane={lane}
          setLane={setLane}
          onPick={() => {
            const el = document.getElementById('lane-switch')
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        />
      </section>

      <section>
        <SectionTitle eyebrow={UI.prep.ebTakeaway}><Rich>{PREP_TAKEAWAY.title}</Rich></SectionTitle>
        <p className="mb-6 max-w-3xl text-lg" style={{ color: 'var(--text-secondary)' }}>
          <Rich>{PREP_TAKEAWAY.lead}</Rich>
        </p>
        <div className="grid gap-4 lg:grid-cols-3">
          {PREP_TAKEAWAY.points.map((pt) => {
            const Icon = TAKE_ICON[pt.icon] ?? FlaskConical
            return (
              <Card key={pt.title}>
                <Icon size={18} aria-hidden style={{ color: 'var(--accent-primary)' }} />
                <h3 className="mt-3 text-base leading-tight">{pt.title}</h3>
                <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <Rich>{pt.body}</Rich>
                </p>
              </Card>
            )
          })}
        </div>
        <Card accent className="mt-4">
          <p className="text-lg" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            <Rich>{PREP_TAKEAWAY.close}</Rich>
          </p>
        </Card>
      </section>
    </div >
  )
}
