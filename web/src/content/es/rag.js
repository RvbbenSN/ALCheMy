/* GENERADO por scripts/generar_contenido_es.mjs. No editar a mano:
   se sobrescribe. Para corregir una frase, cambiarla en scripts/textos_es.json
   y volver a ejecutar el script. Lo que no este traducido sale en ingles. */

export const RAG_AREAS = [
  {
    "n": 1,
    "title": "Corpus",
    "subtitle": "Two folders, two clearances",
    "objective": "Read every PDF in the corpus and stamp it with a sensitivity label before anything else happens to it.",
    "adds": [
      "`sensitivity` - PUBLIC or INTERNAL, decided by the folder the file was sitting in",
      "`doc_type` - PAPER, SUPPORTING_INFORMATION or LAB_NOTEBOOK",
      "`file_name` and `file_path`, so any passage can be traced back to its source"
    ],
    "note": "The label comes from the folder, not from a field somebody fills in. A structural rule cannot be forgotten on a busy day - and this one decides what the assistant may repeat to a stranger.",
    "nodes": [
      {
        "name": "Run Ingestion",
        "kind": "trigger"
      },
      {
        "name": "Read PUBLIC Corpus",
        "kind": "file"
      },
      {
        "name": "Read INTERNAL Corpus",
        "kind": "file"
      },
      {
        "name": "Label PUBLIC",
        "kind": "transform"
      },
      {
        "name": "Label INTERNAL",
        "kind": "transform"
      }
    ]
  },
  {
    "n": 2,
    "title": "Dedup",
    "subtitle": "The MD5 gate",
    "objective": "Compare the checksum of every file against what is already indexed, and let through only what is new.",
    "adds": [
      "The binary MD5 of each file",
      "A Merge in *keep non-matches* mode: what is already registered simply does not continue"
    ],
    "note": "This is what makes the ingestion idempotent. Re-running it over the whole corpus costs a few seconds of hashing instead of re-embedding 87,765 passages - and, more importantly, it cannot silently double the corpus and fill retrieval with near-identical neighbours.",
    "nodes": [
      {
        "name": "Compute File MD5",
        "kind": "code"
      },
      {
        "name": "Already Indexed Hashes",
        "kind": "db"
      },
      {
        "name": "Discard Already Indexed",
        "kind": "merge"
      }
    ]
  },
  {
    "n": 3,
    "title": "Vectorise",
    "subtitle": "Split, embed, store",
    "objective": "Turn each document into passages a model can retrieve, and write them to pgvector beside their catalogue entry.",
    "adds": [
      "Passages of **1,200 characters with 250 of overlap** - 87,765 of them",
      "One 1,024-dimension vector each, from `bge-m3` running locally in Ollama",
      "A row in `rag_documents` per source file, one in `rag_chunks` per passage"
    ],
    "note": "The embeddings node is shared with the query side on purpose. If indexing and searching used different models, the store would return plausible nonsense and never raise an error. Sharing one node makes that mismatch structurally impossible.",
    "nodes": [
      {
        "name": "Split Text (Chunking)",
        "kind": "transform"
      },
      {
        "name": "Document Loader",
        "kind": "file"
      },
      {
        "name": "Embeddings bge-m3 (Local Ollama)",
        "kind": "embed"
      },
      {
        "name": "Insert into pgvector",
        "kind": "vector"
      },
      {
        "name": "Register in rag_documents",
        "kind": "db"
      }
    ]
  },
  {
    "n": 4,
    "title": "Gate",
    "subtitle": "Who is asking",
    "objective": "Identify the caller and settle what they are allowed to see, before a single token reaches a language model.",
    "adds": [
      "A caller identity and session id, carried into every downstream tool call",
      "A verdict against `authorized_researchers`",
      "A logged, answered refusal for anyone who does not clear it"
    ],
    "note": "A denied request is written to the log and gets a reply. Silent failure is the enemy here: an assistant that simply stops looks identical to one that is broken.",
    "nodes": [
      {
        "name": "Chat: Ask the Lab",
        "kind": "trigger"
      },
      {
        "name": "Identify Caller",
        "kind": "transform"
      },
      {
        "name": "Authorise Caller",
        "kind": "db"
      },
      {
        "name": "Is Caller Allowed?",
        "kind": "gate"
      },
      {
        "name": "Log Denied Access",
        "kind": "db"
      },
      {
        "name": "Denied Reply",
        "kind": "transform"
      }
    ]
  },
  {
    "n": 5,
    "title": "Agent",
    "subtitle": "Gemini, with a local understudy",
    "objective": "Answer the question using the tools, and keep answering when the cloud model is not there.",
    "adds": [
      "A windowed conversation memory, shared by both agents",
      "A complete second Agent node wired to **Qwen3 14B** in local Ollama, hanging off the error output of the first",
      "A row in `agent_chat_log` for every exchange, written before the reply goes back"
    ],
    "note": "The Agent node refuses two language models at once - \"Only 1 ai_languageModel sub-nodes are/is allowed to be connected\" - and the documented fallback switch does not exist in this installation. So the fallback is built at workflow level instead, and it was verified by forcing a real Gemini failure rather than by assuming.",
    "nodes": [
      {
        "name": "Chat Model (Gemini)",
        "kind": "model"
      },
      {
        "name": "Conversation Memory",
        "kind": "memory"
      },
      {
        "name": "Agent - Lab Assistant",
        "kind": "ai"
      },
      {
        "name": "Qwen Chat Model (local)",
        "kind": "model"
      },
      {
        "name": "Agent - Qwen fallback",
        "kind": "ai"
      },
      {
        "name": "Log Exchange",
        "kind": "db"
      },
      {
        "name": "Reply",
        "kind": "transform"
      }
    ]
  },
  {
    "n": 6,
    "title": "Tools",
    "subtitle": "Nine powers, one switched off",
    "objective": "Give the assistant everything it needs to answer, and nothing it needs to invent.",
    "adds": [
      "Six tools that read the laboratory: syntheses, characterisation, one full sample, statistics, the bibliography and the schema dictionary",
      "One semantic search across the 87,765 passages",
      "Two that walk the knowledge graph: resolve the node, then explore up to three hops"
    ],
    "note": "Every one is a call to a stored SQL function with typed parameters - the assistant never writes SQL. What it can ask is bounded by the database rather than by how well the prompt is worded. The Cohere reranker is wired and deliberately disabled: it is the one component that would send passage text to a third party.",
    "nodes": [
      {
        "name": "search_synthesis",
        "kind": "tool"
      },
      {
        "name": "get_characterisation",
        "kind": "tool"
      },
      {
        "name": "sample_summary",
        "kind": "tool"
      },
      {
        "name": "statistics",
        "kind": "tool"
      },
      {
        "name": "search_library",
        "kind": "tool"
      },
      {
        "name": "read_data_dictionary",
        "kind": "tool"
      },
      {
        "name": "search_documentation",
        "kind": "vector"
      },
      {
        "name": "find_graph_node",
        "kind": "tool"
      },
      {
        "name": "explore_graph",
        "kind": "tool"
      }
    ]
  }
]

export const RAG_CONTEXTUAL = {
  "title": "Contextual retrieval, and an honest result",
  "problem": "Chunking destroys context. Cut a paper into 1,200-character passages and a sentence like *\"the yield rose to 68 % under these conditions\"* loses which compound, which conditions, which paper. Retrieval then returns something locally relevant and globally meaningless.",
  "technique": "The fix, published by **Anthropic as contextual retrieval**, is to have an LLM write one short sentence situating each passage inside its own document, prepend it, and embed *that*. It is built here end to end: `rag_chunk_context` holds **87,765 context sentences**, one per passage, and `rag_chunks.embedding_v2` holds the re-embedding of passage-plus-context.",
  "result": "**The gain was modest.** Compared live against the original embeddings on real questions, similarities came out 0.005-0.01 higher and only one or two of every four retrieved passages changed. Nothing like the improvement the technique reports.",
  "why": "The explanation is the corpus, not the method. The published measurements come from material whose fragments lean heavily on their surroundings. A chemistry paper is written in paragraphs that already name their own compound and their own conditions, so there was less missing context to restore. **The technique is sound; this corpus had little room for it to help.**",
  "decision": "So `embedding_v2` is built, populated, and deliberately **not promoted** to the default search. Switching it on is one line. What is missing is the measurement that would justify it: the same comparison over enough questions to tell a real gain from noise.",
  "caveat": "One concrete thing stands between it and production: **`embedding_v2` has no HNSW index.** The original column has one; its contextual twin does not, so a query against it would scan all 87,765 vectors. The work is done and the plumbing is not."
}

export const RAG_HERO = {
  "lead": "A laboratory assistant grounded in 958 indexed documents and 87,765 passages, wired to the same database the rest of this site describes - and built so that it cannot repeat an unpublished ligand name to a stranger.",
  "sub": "The chat is not opened on this site."
}

export const RAG_NUMBERS = [
  {
    "n": "958",
    "label": "Documents indexed",
    "why": "955 papers, 2 digitised lab notebooks, 1 supporting information"
  },
  {
    "n": "87,765",
    "label": "Passages",
    "why": "1,200 characters each with 250 of overlap; 1,021 on average"
  },
  {
    "n": "1,024",
    "label": "Dimensions per vector",
    "why": "`bge-m3`, run locally, so no passage ever leaves the machine"
  },
  {
    "n": "6,506",
    "label": "Nodes in the knowledge graph",
    "why": "3,251 measurements, 3,213 samples, 23 metals, 10 modulators, 9 ligands"
  }
]

export const RAG_POWERS = {
  "title": "What the assistant can actually do",
  "lead": "Nine tools, each one a stored SQL function with typed parameters. **The assistant never writes SQL**, so the boundary of what it can ask is enforced by the database rather than by the wording of a prompt.",
  "tools": [
    [
      "`search_synthesis`",
      "Find syntheses by metal, linker, temperature window or date range. Every filter optional."
    ],
    [
      "`sample_summary`",
      "The complete record of one sample: solvents, thermal ramp, modulators, masses."
    ],
    [
      "`get_characterisation`",
      "Which measurements a sample has, on which instrument and by whom - never the curves themselves."
    ],
    [
      "`statistics`",
      "Counts grouped by one of seven allowed dimensions. Not free aggregation: an explicit list."
    ],
    [
      "`search_library`",
      "Which documents exist and how to cite them - authors, year, journal, DOI."
    ],
    [
      "`search_documentation`",
      "Semantic search across the 87,765 passages. For concepts and methods, never for numeric facts."
    ],
    [
      "`read_data_dictionary`",
      "The schema, as data. It reads what a column means instead of inferring it from the name."
    ],
    [
      "`find_graph_node`",
      "Resolve free text - a code, a ligand, a metal - to an exact graph node id."
    ],
    [
      "`explore_graph`",
      "Walk up to three hops: what two samples have in common, what shares a ligand with this one."
    ]
  ],
  "boundary": "The split between the last two is deliberate. An assistant that guesses node ids invents relationships; forcing it to resolve the id first means a wrong guess **fails loudly instead of returning a confident answer about a sample that does not exist**."
}

export const RAG_RETRIEVAL = {
  "title": "Three retrievers, not one",
  "lead": "A vector search alone fails in a predictable way: ask it for a sample code and it returns passages *about* similar things that do not contain the code. Each layer below exists because the previous one missed something specific.",
  "layers": [
    {
      "name": "Dense - semantic similarity",
      "state": "live",
      "body": "Cosine distance over the 1,024-dimension `bge-m3` vectors, with an **HNSW index** so a search does not read all 87,765 rows. This is what finds a concept described in words the question never used."
    },
    {
      "name": "Sparse - full text",
      "state": "live",
      "body": "A generated `tsvector` column with a GIN index over the same passages. This is what finds the literal string of a sample code - precisely what the dense search is worst at, because an identifier carries no semantics to be similar to."
    },
    {
      "name": "Fusion - RRF",
      "state": "live",
      "body": "The `rag_hybrid_search()` function merges both rankings with **Reciprocal Rank Fusion**: a passage that does well in both lists outranks one that dominates a single list. Verified with a question whose top hit scored twice the rest - the signature of a passage that won on both sides at once."
    },
    {
      "name": "Reranking - Cohere",
      "state": "off",
      "body": "Wired into the vector store node and **switched off on purpose**. The only reranker n8n offers is an external service, and using it would mean sending the text of retrieved passages - internal notebooks included - to a third party. Left in place and visibly disabled, because the decision is part of the design."
    }
  ]
}
