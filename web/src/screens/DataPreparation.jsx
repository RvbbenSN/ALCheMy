import { Badge, Card, Placeholder, ScrollTable, SectionTitle, Term } from '../components/ui.jsx'

const FORMATS = [
  ['.xrdml', 'PANalytical PXRD', 'Only counts are stored; the 2θ axis is reconstructed by linspace from start and end angles.'],
  ['.brml', 'Bruker VT-XRD', 'A ZIP container. More than two RawData*.xml entries means a temperature series, not a single scan.'],
  ['.txt', 'TA SDT Q600 TGA', 'UTF-16 with a latin1 fallback, seven signals.'],
  ['.csv', 'FTIR', 'Comma or semicolon separated, tolerant of decimal commas.'],
  ['.xls', 'Micromeritics BET', 'Adsorption isotherm and surface area.'],
  ['.asc / .csv', 'UV-Vis', 'Kubelka-Munk and Tauc vectors derived at parse time.'],
  ['.jpg + .txt', 'Hitachi SEM', 'Image plus companion sidecar; the AI description is added later, never fabricated.'],
]

export default function DataPreparation() {
  return (
    <div className="flex flex-col gap-16">
      <section>
        <Badge tone="accent">03 · Data Preparation</Badge>
        <h1 className="mt-4 text-3xl uppercase md:text-5xl" style={{ fontFamily: 'var(--font-display)', letterSpacing: '2px' }}>
          ETL &amp; PXRD Signal Processing
        </h1>
        <p className="mt-6 max-w-3xl text-lg" style={{ color: 'var(--text-secondary)' }}>
          The unglamorous 80%: turning a spreadsheet and nine incompatible instrument formats into numbers
          that can actually be compared.
        </p>
      </section>

      <section>
        <SectionTitle eyebrow="Notebook 01">From spreadsheet to governed table</SectionTitle>
        <Placeholder source="notebooks/01_Excel_Ingestion_and_Transformation.ipynb">
          Copy pending: every transformation applied, one by one — header renaming, stoichiometric feature
          engineering (µL of molar solution converted to mmol of <em>active</em> modulator), free-text
          thermal ramps parsed into heating and cooling rates, and an MD5 business key over six fields.
          Closing argument: why the load is an UPSERT and never a delete-and-reinsert.
        </Placeholder>
      </section>

      <section>
        <SectionTitle eyebrow="Notebook 02">One contract, nine formats</SectionTitle>
        <p className="mb-6 max-w-3xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          Every parser — Python and JavaScript alike — returns the same dictionary shape, and{' '}
          <code>data_json</code> always holds <code>header_metadata</code> and <code>raw_data</code>. Stored
          as <Term k="JSONB" /> with a GIN index, so an agent can query any technique uniformly.
        </p>
        <ScrollTable
          head={['Format', 'Instrument', 'What makes it awkward']}
          rows={FORMATS.map(([a, b, c]) => [<code key={a}>{a}</code>, b, c])}
        />
      </section>

      <section>
        <SectionTitle eyebrow="Notebook 05 · the centrepiece">From raw signal to 29 numbers</SectionTitle>
        <Placeholder source="src/pxrd_descriptors.py, notebooks/05_...ipynb">
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
              &ldquo;Anatomy of the PXRD descriptor vector&rdquo; — one annotated diffractogram showing where
              each of the 29 numbers comes from. This is the single most explanatory image in the project.
            </p>
          </Card>
        </div>
      </section>

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
              regeneration of the measurement tables. That is the only data in the whole platform that no
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

      <section>
        <SectionTitle eyebrow="The code itself">Read the notebooks</SectionTitle>
        <Placeholder source="docs/notebooks/">
          Static HTML renders pending: each notebook exported read-only, with outputs audited cell by cell
          for real sample codes and ligand names. The .ipynb file itself is never served.
        </Placeholder>
      </section>
    </div>
  )
}
