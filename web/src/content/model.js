/* --------------------------------------------------------------------------
   model.js - Texto de la pantalla 06, The Model.

   Las cifras del registro NO viven aqui: salen de src/data/model_scorecard.json,
   que genera scripts/build_model_scorecard.py contra ml_models. Aqui solo prosa.
   Los campos largos se pintan con `<Rich>`: **negrita** y `codigo`.
   -------------------------------------------------------------------------- */

export const MODEL_HERO = {
  lead:
    'Play with the synthesis conditions and watch the prediction move — then see what keeps this from being a loose pickle file on somebody\u2019s laptop.',
}

/* Como se guarda un modelo. Cinco tablas, y cada una responde a una pregunta
   que aparece cuando alguien intenta reproducir un resultado meses despues. */
export const MODEL_REGISTRY = {
  title: 'A model is not a file',
  lead:
    'The usual way to keep a trained model is a `.pkl` in a folder, and it fails in a specific way: six months later the file is still there and **nothing around it is**. Which rows trained it, which columns, which version of the code, what it actually scored. The binary survives and the meaning does not.',
  ruling:
    'So the model lives in the database as **five related tables**, and the binary is the least important of them. Everything else is the recipe — and a complete recipe means the binary is the one part you could throw away and rebuild.',
  tables: [
    {
      name: 'ml_datasets',
      head: 'What it was trained on',
      body: 'The literal SQL that selected the rows, plus its SHA-256. Two models sharing a query but differing in row count were **not** trained on the same thing, and the hash is what makes that detectable instead of assumed.',
    },
    {
      name: 'ml_models',
      head: 'The recipe',
      body: 'Algorithm, hyperparameters, random seed, library versions, and the exact git commit. Also the status — active, superseded, archived or **invalid** — and a `CHECK` that refuses to mark a model irreproducible without writing why.',
    },
    {
      name: 'ml_model_features',
      head: 'Which columns went in, and which did not',
      body: 'Every input column with its position in the contract, and every **excluded** one with the reason it was excluded. Recording the exclusions is what turns a decision into an auditable decision rather than a thing somebody once did.',
    },
    {
      name: 'ml_model_metrics',
      head: 'What it scored',
      body: 'Metrics in long format — one row per metric, per class, per split — so adding a new metric never means altering the schema.',
    },
    {
      name: 'ml_model_artifacts',
      head: 'The binary, and its fingerprint',
      body: 'The serialised pipeline with a SHA-256 checked on every load. It sits in its own table so a light backup can skip it: it is the only part that a complete recipe can regenerate.',
    },
  ],
  slot:
    'One more thing decides what the page above is actually running: a **deployment slot**. The simulator does not name a model — it asks the database which one occupies the `primary` slot. That is not decoration. This file once had `crystallinity_v3_hts_full` written into it by hand, the v4 was trained to correct a unit error of a factor of a thousand, and **the site went on serving v3 predictions without anything raising an error**. An obsolete model does not fail; it answers.',
}

/* El bucle. La metafora del mapa la puso Ruben; el mapa lo dibuja el modelo. */
export const MODEL_LOOP = {
  title: 'A compass, not an oracle',
  metaphor:
    'Think of the synthesis space as a map in the dark. The experiments already run light up a few patches of it. A predictive model is not a machine that tells you the answer — it is **a compass**: it points at the direction where walking would light up the most new ground.',
  method:
    'And the direction it points is not "where crystals are most likely". An experiment run where the model is already confident confirms what it knew. The useful place is **where it hesitates**, because either outcome there corrects it. That is what the map below measures: the entropy of the predicted distribution, cell by cell.',
  /* Las cifras de cobertura NO se escriben aqui: la pantalla las lee de
     knowledge_map.json, que las cuenta. La primera version de este parrafo
     decia "54 de 63 casillas", que salia de contar ternas
     (temperatura, modulador, veredicto) en vez de casillas. Son 18. */
  reading:
    'And the map is genuinely dark. Even for the most-studied metal in the record, most of this plane has never been visited — the syntheses pile up in a handful of cells and leave the rest untouched. Worse, the model hesitates almost everywhere, including where the laboratory *has* looked: the conditions were swept while the chemistry changed alongside them, so the record cannot separate the two.',
  consequence:
    'Which is exactly the conclusion of the previous screen, arrived at from the other end. The next experiment worth running is not another plate of the same shape — it is **one plate that varies conditions finely while holding the chemistry fixed**. The compass and the diagnosis agree, and that agreement is the useful output of this whole stage.',
}
