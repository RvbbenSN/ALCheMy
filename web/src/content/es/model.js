/* GENERADO por scripts/generar_contenido_es.mjs. No editar a mano:
   se sobrescribe. Para corregir una frase, cambiarla en scripts/textos_es.json
   y volver a ejecutar el script. Lo que no este traducido sale en ingles. */

export const MODEL_HERO = {
  "lead": "Play with the synthesis conditions and watch the prediction move — then see what keeps this from being a loose pickle file on somebody’s laptop."
}

export const MODEL_LOOP = {
  "title": "A compass, not an oracle",
  "metaphor": "Think of the synthesis space as a map in the dark. The experiments already run light up a few patches of it. A predictive model is not a machine that tells you the answer — it is **a compass**: it points at the direction where walking would light up the most new ground.",
  "method": "And the direction it points is not \"where crystals are most likely\". An experiment run where the model is already confident confirms what it knew. The useful place is **where it hesitates**, because either outcome there corrects it. That is what the map below measures: the entropy of the predicted distribution, cell by cell.",
  "readingPoints": [
    "**Most of the plane has never been visited.** Even for Ca, the metal with the most history behind it, the syntheses pile up in a handful of cells.",
    "**The model hesitates almost everywhere**, including where the laboratory has looked.",
    "**Because conditions were swept while the chemistry changed alongside them**, so the record cannot separate the two."
  ],
  "consequence": "The map and the model diagnostics point at the same experiment from opposite ends: the next plate worth running is **one that varies conditions finely while holding the metal and linker fixed**."
}

export const MODEL_REGISTRY = {
  "title": "A model is not a file",
  "lead": "The usual way to keep a trained model is a `.pkl` in a folder, and it fails in a specific way: six months later the file is still there and **nothing around it is**. Which rows trained it, which columns, which version of the code, what it actually scored.",
  "ruling": "So the model lives in the database as **five related tables**, and the binary is the least important of them. The other four hold the recipe, and with a complete recipe the binary can be rebuilt.",
  "tables": [
    {
      "name": "ml_datasets",
      "head": "What it was trained on",
      "body": "The literal SQL that selected the rows, plus its SHA-256. Two models sharing a query but differing in row count were **not** trained on the same thing, and the hash makes that difference detectable."
    },
    {
      "name": "ml_models",
      "head": "The recipe",
      "body": "Algorithm, hyperparameters, random seed, library versions, and the exact git commit. Also the status — active, superseded, archived or **invalid** — and a `CHECK` that refuses to mark a model irreproducible without writing why."
    },
    {
      "name": "ml_model_features",
      "head": "Which columns went in, and which did not",
      "body": "Every input column with its position in the contract, and every **excluded** one with the reason it was excluded. `reactor_volume_ml` is recorded as zero-variance, `fill_fraction` as perfectly collinear with it."
    },
    {
      "name": "ml_model_metrics",
      "head": "What it scored",
      "body": "Metrics in long format — one row per metric, per class, per split — so adding a new metric never means altering the schema."
    },
    {
      "name": "ml_model_artifacts",
      "head": "The binary, and its fingerprint",
      "body": "The serialised pipeline with a SHA-256 checked on every load. It sits in its own table so a light backup can skip it: it is the only part that a complete recipe can regenerate."
    }
  ],
  "slot": "One more thing decides which model the simulator is actually running: a **deployment slot**. The simulator does not name a model; it asks the database which one occupies the `primary` slot. When a model name was written into this file by hand instead, retraining to correct a unit error of a factor of a thousand left **the site serving the superseded model with nothing raising an error**: an obsolete model returns predictions as readily as a current one."
}
