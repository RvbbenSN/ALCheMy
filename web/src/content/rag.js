/* --------------------------------------------------------------------------
   rag.js — Texto de la pantalla 07, Scientific Co-pilot.

   Mismo motivo que `collection.js` y `model.js`: el texto estaba dentro del
   JSX. Los campos largos se pintan con `<Rich>`, asi que **entre dos
   asteriscos sale negrita**.
   -------------------------------------------------------------------------- */

export const RAG_HERO = {
  lead:
    'Generative AI with governance: grounded in 956 real papers, and unable to leak a ligand name it was never allowed to send.',
}

export const RAG_CORPUS = {
  chunkingTitle: 'Contextual chunking',
  chunkingBody:
    'Splitting a paper into fixed-size blocks destroys chemical meaning: a stoichiometry ends up severed from the procedure it belongs to. Each chunk is therefore given a written context sentence that is fused into its own embedding, so a passage still knows what it is about.',
  sourcesTitle: 'Three sources of truth',
  sourcesBody:
    'The assistant cross-references the in-house historical database, the model’s own active learning predictions, and peer-reviewed literature — so a suggestion arrives with multi-source backing rather than a confident guess.',
}

export const RAG_MASKING = {
  intro:
    'Before any query leaves for an external model, unpublished ligand codes and proprietary formulas are substituted. The metal stays — it carries no trade secret. Toggle it and watch the question change.',
  before: 'Does H6ttbmp form a crystalline framework with Zr at 130 °C in DMF?',
  after: 'Does LIG_HASH_8F2 form a crystalline framework with Zr at 130 °C in DMF?',
  footnote: 'The ligand code shown here is illustrative, not a real unpublished compound.',
}

export const RAG_SUGGESTED = [
  'Which temperature window favours crystalline zirconium phosphonates?',
  'What distinguishes an amorphous halo from a broad reflection?',
  'How does formic acid act as a modulator in solvothermal synthesis?',
]

export const RAG_PENDING = {
  chat:
    'Chat interface pending backend. Restricted to the published-literature corpus only, with rate limiting and cached answers for common questions. Retrieved chunks will be listed with their cosine similarity so the answer can be checked against its sources.',
  graph:
    'Pending: a graph linking performed syntheses to their characterization and to the literature that justified them — so “what did we try, and what does the field say about it” is one traversal rather than three searches.',
}
