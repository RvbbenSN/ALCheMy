"""
ALCheMy RAG - Contextual Embedding (Fase C-bis, paso final)

Computes rag_chunks.embedding_v2 = embed(context_sentence + "\\n\\n" + text)
for every chunk that already has a sentence in rag_chunk_context, using the
same local Ollama model and batching approach as rag_ingest_chunks.py.

Why a second column instead of overwriting embedding
------------------------------------------------------
This is Anthropic's "contextual retrieval" technique (methodology/
ROADMAP_RAG_Y_GRAFO.md): the context sentence has to be baked INTO the text
that gets embedded, not stored alongside an unrelated vector - a sentence
kept as pure metadata never touches the search ranking at all, so it would
buy none of the +35% fewer retrieval failures the technique promises.

But the context sentences were written by an external LLM (Gemini) with a
known history of producing bad output that passed automatic checks (the
"(part N)" filler-template and recycled-sentence incidents, both fixed but
not something the project owner can manually re-verify across 87,765
chunks). So this script writes into embedding_v2, a column that starts
NULL and never overwrites the original `embedding`. Compare the two with
rag_query_compare.py on real questions before deciding anything - if
embedding_v2 turns out worse, the fix is `UPDATE rag_chunks SET
embedding_v2 = NULL` and nothing about the working system ever changed.

Usage
-----
    python src/rag_reembed_context.py                # only chunks with no embedding_v2 yet
    python src/rag_reembed_context.py --force         # recompute even if already set
    python src/rag_reembed_context.py --limit 500     # a small pilot batch first
    python src/rag_reembed_context.py --doc 42        # one specific document
"""

import argparse
import os
import sys
import time
from pathlib import Path

import psycopg2
import psycopg2.extras
import requests

REPO_ROOT = Path(__file__).resolve().parent.parent
OLLAMA = os.getenv("OLLAMA_URL", "http://localhost:11434")
MODEL = "bge-m3:latest"

BATCH = 16
RETRIES = 4


def load_env():
    path = REPO_ROOT / ".env"
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def embed_batch(texts):
    """Same retry/backoff shape as rag_ingest_chunks.py: a transient Ollama
    hiccup during a long run must not lose everything done so far."""
    last_error = None
    for attempt in range(RETRIES):
        try:
            response = requests.post("{}/api/embed".format(OLLAMA),
                                     json={"model": MODEL, "input": texts},
                                     timeout=600)
            response.raise_for_status()
            vectors = response.json()["embeddings"]
            if len(vectors) != len(texts):
                raise ValueError("Ollama devolvio {} vectores para {} textos"
                                 .format(len(vectors), len(texts)))
            return vectors
        except Exception as error:                      # noqa: BLE001
            last_error = error
            time.sleep(2 ** attempt)
    raise RuntimeError("Ollama fallo tras {} intentos: {}".format(RETRIES, last_error))


def as_vector(values):
    return "[" + ",".join(repr(float(v)) for v in values) + "]"


def main():
    parser = argparse.ArgumentParser(description="Compute rag_chunks.embedding_v2 from context sentences")
    parser.add_argument("--force", action="store_true",
                        help="recompute even for chunks that already have embedding_v2")
    parser.add_argument("--limit", type=int, default=None,
                        help="process at most N chunks (for a pilot run)")
    parser.add_argument("--doc", type=int, default=None,
                        help="only chunks belonging to this document_id")
    args = parser.parse_args()

    load_env()
    connection = psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=os.getenv("POSTGRES_PORT", "5432"),
        dbname=os.environ["POSTGRES_DB"],
        user=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"])
    cursor = connection.cursor(cursor_factory=psycopg2.extras.DictCursor)

    where = ["cc.context_sentence IS NOT NULL"]
    params = []
    if not args.force:
        where.append("c.embedding_v2 IS NULL")
    if args.doc is not None:
        where.append("c.document_id = %s")
        params.append(args.doc)

    query = """
        SELECT c.id, c.text, cc.context_sentence
        FROM rag_chunks c
        JOIN rag_chunk_context cc ON cc.chunk_id = c.id
        WHERE {}
        ORDER BY c.id
    """.format(" AND ".join(where))
    if args.limit is not None:
        query += " LIMIT {}".format(int(args.limit))

    cursor.execute(query, params)
    rows = cursor.fetchall()

    if not rows:
        print("No hay chunks pendientes de embedding_v2. Usa --force para recalcular todos.")
        cursor.close()
        connection.close()
        return 0

    print("Chunks a vectorizar: {}".format(len(rows)))
    hecho = fallido = 0
    inicio = time.time()

    for offset in range(0, len(rows), BATCH):
        lote = rows[offset:offset + BATCH]
        textos = [r["context_sentence"] + "\n\n" + r["text"] for r in lote]
        try:
            vectores = embed_batch(textos)
        except Exception as error:                      # noqa: BLE001
            print("  !! lote {}-{} fallo: {}".format(offset, offset + len(lote), str(error)[:100]))
            fallido += len(lote)
            continue

        for row, vector in zip(lote, vectores):
            cursor.execute(
                "UPDATE rag_chunks SET embedding_v2 = %s::vector WHERE id = %s;",
                (as_vector(vector), row["id"]))
        connection.commit()
        hecho += len(lote)

        transcurrido = time.time() - inicio
        ritmo = hecho / transcurrido if transcurrido else 0
        eta = (len(rows) - hecho) / ritmo / 60 if ritmo else 0
        print("  [{}/{}]  {:.1f} chunks/s  ETA {:.1f} min".format(
            hecho, len(rows), ritmo, eta))

    print("\nChunks vectorizados : {}".format(hecho))
    print("Chunks fallidos      : {}  (se reintentan al volver a ejecutar)".format(fallido))
    print("Tiempo               : {:.2f} min".format((time.time() - inicio) / 60))
    cursor.close()
    connection.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
