import {
  ETL_DEFECTS,
  ETL_EXCLUSION,
  ETL_IMPUTATION,
  ETL_STOICHIOMETRY,
  ETL_TANNIC,
  ETL_THERMAL,
  ETL_ZERO_VS_NULL,
} from '../content/screens.js'
import { Badge, Card, Placeholder, ScrollTable, SectionTitle, Term } from '../components/ui.jsx'
import NotebookList from '../components/NotebookList.jsx'

const FORMATS = [
  ['.xrdml', 'PANalytical PXRD', 'Only counts are stored; the 2θ axis is reconstructed by linspace from start and end angles.'],
  ['.brml', 'Bruker VT-XRD', 'A ZIP container. More than two RawData*.xml entries means a temperature series, not a single scan.'],
  ['.txt', 'TA SDT Q600 TGA', 'UTF-16 with a latin1 fallback, seven signals.'],
  ['.csv', 'FTIR', 'Comma or semicolon separated, tolerant of decimal commas.'],
  ['.xls', 'Micromeritics BET', 'Adsorption isotherm and surface area.'],
  ['.asc / .csv', 'UV-Vis', 'Kubelka-Munk and Tauc vectors derived at parse time.'],
  ['.jpg + .txt', 'Hitachi SEM', 'Image plus companion sidecar; the AI description is added later, never fabricated.'],
]

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

export default function DataPreparation() {
  return (
    <div className="flex flex-col gap-16">
      <section>
        <Badge tone="accent">03 · Data Preparation</Badge>
        <h1 className="mt-4 text-3xl uppercase md:text-5xl" style={{ fontFamily: 'var(--font-display)', letterSpacing: '2px' }}>
          ETL &amp; PXRD Signal Processing
        </h1>
        <p className="mt-6 max-w-3xl text-lg" style={{ color: 'var(--text-secondary)' }}>
          The longest stage of any real project and the one nobody teaches. It is also where the work came
          back to, after an expert review found seven defects that no statistical alarm had ever raised.
        </p>
      </section>

      {/* --- 1. Del Excel a la tabla --- */}
      <section>
        <SectionTitle eyebrow="Notebook 01">From spreadsheet to governed table</SectionTitle>
        <p className="mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          Five years of handwritten synthesis conditions lived in one multi-tab Excel file with arbitrary
          headers. Turning it into a governed table takes six transformations, and every one of them is a
          decision rather than a formatting step.
        </p>

        <div className="flex flex-col gap-4">
          <Card>
            <h3 className="text-base">1 · Header normalisation</h3>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              A master mapping dictionary translates arbitrary spreadsheet headers into a strict SQL
              schema. Kept as an explicit dictionary rather than automatic slug-casing, so that renaming a
              column in the spreadsheet produces a visible failure instead of a silently new column.
            </p>
          </Card>

          <Card>
            <h3 className="text-base">2 · Stoichiometric feature engineering</h3>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {ETL_STOICHIOMETRY.intro}
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--accent-secondary-text)' }}>
                  {ETL_STOICHIOMETRY.typeA.title}
                </div>
                <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {ETL_STOICHIOMETRY.typeA.body}
                </p>
                <Formula>{ETL_STOICHIOMETRY.typeA.formula}</Formula>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--accent-secondary-text)' }}>
                  {ETL_STOICHIOMETRY.typeB.title}
                </div>
                <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {ETL_STOICHIOMETRY.typeB.body}
                </p>
                <Formula>{ETL_STOICHIOMETRY.typeB.formula}</Formula>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-base">3 · {ETL_THERMAL.title}</h3>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {ETL_THERMAL.body}
            </p>
            {ETL_THERMAL.formulas.map((f) => (
              <Formula key={f}>{f}</Formula>
            ))}
          </Card>

          <Card>
            <h3 className="text-base">4 · An MD5 business natural key</h3>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              A checksum over six business fields — sample code, date, researcher, unit, metal centre and
              linker — gives every synthesis an identity derived from what it <em>is</em>, not from the row
              it happened to occupy. Two spreadsheets describing the same experiment collapse to the same
              key. See <Term k="MD5" />.
            </p>
          </Card>

          <Card accent>
            <h3 className="text-base">5 · The load is an UPSERT, never a replace</h3>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              This is a governance decision, not a convenience. The same table is written by two
              independent lanes: this notebook, and the automated ingestion workflow. A delete-and-reinsert
              would silently destroy every row the workflow had written since the last run. Conflicting on
              the sample code and updating in place means the two lanes can coexist without either being
              able to erase the other.
            </p>
          </Card>
        </div>
      </section>

      {/* --- 2. Contrato del parser --- */}
      <section>
        <SectionTitle eyebrow="Notebook 02">One contract, nine formats</SectionTitle>
        <p className="mb-6 max-w-3xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          Every parser — Python and JavaScript alike — returns the same dictionary shape, and{' '}
          <code>data_json</code> always holds <code>header_metadata</code> and <code>raw_data</code>. Stored
          as <Term k="JSONB" /> with a GIN index, so an agent can query any technique uniformly and adding
          a tenth format needs no schema migration.
        </p>
        <ScrollTable
          head={['Format', 'Instrument', 'What makes it awkward']}
          rows={FORMATS.map(([a, b, c]) => [<code key={a}>{a}</code>, b, c])}
        />
      </section>

      {/* --- 3. Los siete defectos --- */}
      <section>
        <SectionTitle eyebrow="What the expert review found">Seven defects, zero statistical alarms</SectionTitle>
        <p className="mb-6 max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          Version 2 of the analysis was accepted with a macro F1 of 0.62. Reading its tables{' '}
          <em>chemically</em> — asking whether the numbers were physically possible rather than whether
          they were statistically odd — found seven problems. None of them had triggered any alarm.
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
                    {d.n}
                  </span>
                  <div>
                    <h3 className="text-base">{d.defect}</h3>
                    <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>How it surfaced. </strong>
                      {d.found}
                    </p>
                    <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <strong style={{ color: 'var(--status-pure)' }}>Fix. </strong>
                      {d.fix}
                    </p>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ol>

        <Card className="mt-6">
          <h3 className="text-lg">{ETL_ZERO_VS_NULL.title}</h3>
          <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {ETL_ZERO_VS_NULL.body}
          </p>
          <Pullquote>{ETL_ZERO_VS_NULL.pullquote}</Pullquote>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            The check that proves defects 4 and 5 are genuinely fixed: the composition of the medium now
            sums to 1.000. Before the correction the mean was 0.789 — and version 2 had no such check,
            which is precisely why the fault survived.
          </p>
        </Card>
      </section>

      {/* --- 4. Exclusion como etiqueta --- */}
      <section>
        <SectionTitle eyebrow="Curation">{ETL_EXCLUSION.title}</SectionTitle>
        <Card accent>
          <p style={{ color: 'var(--text-secondary)' }}>{ETL_EXCLUSION.body}</p>
          <p className="mt-4" style={{ color: 'var(--text-secondary)' }}>
            {ETL_EXCLUSION.decision}
          </p>
          <Pullquote>{ETL_EXCLUSION.pullquote}</Pullquote>
        </Card>
      </section>

      {/* --- 5. Acido tanico --- */}
      <section>
        <SectionTitle eyebrow="A decision that could have been cheating">{ETL_TANNIC.title}</SectionTitle>
        <Card>
          <p style={{ color: 'var(--text-secondary)' }}>{ETL_TANNIC.body}</p>
          <p className="mt-4 text-sm" style={{ color: 'var(--status-pure)' }}>
            {ETL_TANNIC.measure}
          </p>
        </Card>
        <Pullquote tone="incipient">⚠️ {ETL_TANNIC.caution}</Pullquote>
      </section>

      {/* --- 6. Imputacion --- */}
      <section>
        <SectionTitle eyebrow="Filling the gaps">{ETL_IMPUTATION.title}</SectionTitle>
        <Card>
          <p style={{ color: 'var(--text-secondary)' }}>{ETL_IMPUTATION.body}</p>
          <Pullquote tone="amorphous">{ETL_IMPUTATION.leak}</Pullquote>
          <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
            The alternative — explicitly flagging which values were missing, letting the model learn from
            the fact of absence — was tested rather than assumed:
          </p>
          <ScrollTable head={ETL_IMPUTATION.tableHead} rows={ETL_IMPUTATION.tableRows} />
          <p className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {ETL_IMPUTATION.conclusion}
          </p>
        </Card>
      </section>

      {/* --- 7. Senal PXRD --- */}
      <section>
        <SectionTitle eyebrow="Notebook 05 · the centrepiece">From raw signal to 29 numbers</SectionTitle>
        <Placeholder source="src/pxrd_descriptors.py, notebooks/05">
          Interactive chart pending: raw curve, <Term k="arPLS" /> baseline with a stiffness slider from
          1e4 to 1e8, the narrow component after Savitzky-Golay smoothing, and peaks accepted at 3σ against
          those rejected — with the 29-descriptor vector recomputing live beside it.
        </Placeholder>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card>
            <h3 className="text-base">Didactic modals to attach here</h3>
            <ul className="mt-3 flex list-none flex-col gap-2 p-0 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <li>What the amorphous halo actually is, and how we nearly measured it wrong.</li>
              <li>Three sigma is the level for one comparison, not for scanning a whole sweep.</li>
              <li>The denominator of a fraction decides what it means.</li>
              <li>Every descriptor has a floor, and knowing it is part of the measurement.</li>
              <li>The log₂(N) ceiling of spectral entropy.</li>
            </ul>
          </Card>
          <Card>
            <h3 className="text-base">Required figure</h3>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              &ldquo;Anatomy of the PXRD descriptor vector&rdquo; — one annotated diffractogram showing
              where each of the 29 numbers comes from. The single most explanatory image in the project.
            </p>
          </Card>
        </div>
      </section>

      {/* --- 8. Herramientas --- */}
      <section>
        <SectionTitle eyebrow="The tools that produced the ground truth">Labeler &amp; Explorer</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              A Streamlit labeling app produced 4,964 expert judgements over 1,877 diffractograms — four
              independent verdicts per pattern: crystallinity class, incipient subtype, oxide flag and
              suspected multiphase.
            </p>
            <p className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Labels are keyed by <code>file_hash</code>, not by measurement id, so they survive a full
              regeneration of the measurement tables. That is the only data in the whole platform no
              pipeline could ever reproduce.
            </p>
          </Card>
          <Placeholder source="app/pxrd_labeler.py, app/pxrd_explorer.py">
            Screen recording pending. These tools write to the production database, so they are shown as a
            short video rather than served live — with sample codes and ligand names pseudonymized and
            synthesis conditions hidden.
          </Placeholder>
        </div>
      </section>

      {/* --- 9. Notebooks --- */}
      <section>
        <SectionTitle eyebrow="The code itself">Read the notebooks</SectionTitle>
        <p className="mb-6 max-w-3xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          Every notebook is published as a static, read-only page. Sample identifiers and unpublished
          ligand names are replaced by pseudonyms and local paths removed; metal centres are shown
          unchanged, since they carry no trade secret. None of the code was re-executed to produce these
          pages — several of these notebooks write to the production database, and re-running them to make
          a clean copy could duplicate or cascade-delete rows.
        </p>
        <NotebookList only="03" />
        <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
          The full set of seven notebooks is linked from the screen each one belongs to.
        </p>
      </section>

      <section>
        <SectionTitle eyebrow="Takeaway">What this stage cost, and bought</SectionTitle>
        <Card accent>
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            Seven defects, none of which any metric had complained about. The unit error alone had made
            the most-used modulator in the entire record invisible to the model, and cross-validation
            never noticed, because the column was still a number that ordered the rows plausibly.
          </p>
          <p className="mt-4 text-lg" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            Every one was found by reading the values chemically rather than statistically. That is the
            argument for a domain expert staying in the loop through data preparation — not as a reviewer
            at the end, but as the person who can tell that 54 grams of formic acid does not fit in a
            2.5 millilitre reactor.
          </p>
        </Card>
      </section>
    </div>
  )
}
