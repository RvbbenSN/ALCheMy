"""
ALCheMy RAG - A/B compare embedding vs embedding_v2 on a real question.

Embeds the question once and runs two plain cosine-similarity searches
against rag_chunks: one on `embedding` (the original, chunk-only vector,
what rag_query.py uses today) and one on `embedding_v2` (chunk + context
sentence, see src/rag_reembed_context.py). Printed side by side so the
project owner can judge, on real questions, whether the contextual version
actually finds better passages - without touching either column or
committing to switching retrieval over.

This is deliberately vector-only (no BM25/RRF fusion like
rag_hybrid_search): the question being answered here is narrowly "did the
context sentence change what the vector search finds", not "what's the
best possible retrieval pipeline".

    python src/rag_query_compare.py "estabilidad en agua de MOFs de Zr"
    python src/rag_query_compare.py "epsilon-caprolactona" -n 5
"""

import argparse
import os
import sys
import textwrap
from pathlib import Path

import psycopg2
import psycopg2.extras
import requests

# Corpus text carries ligatures/typography (e.g. "ﬁ") that the default
# Windows console codepage (cp1252) cannot print - without this, a perfectly
# fine comparison crashes on the printing step, not the search itself.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

REPO_ROOT = Path(__file__).resolve().parent.parent
OLLAMA = os.getenv("OLLAMA_URL", "http://localhost:11434")
MODEL = "bge-m3:latest"

SEARCH = """
SELECT id, text, metadata, 1 - ({col} <=> %s::vector) AS similarity
FROM rag_chunks
WHERE {col} IS NOT NULL
ORDER BY {col} <=> %s::vector
LIMIT %s;
"""


def load_env():
    path = REPO_ROOT / ".env"
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def embed(text):
    response = requests.post("{}/api/embeddings".format(OLLAMA),
                             json={"model": MODEL, "prompt": text}, timeout=180)
    response.raise_for_status()
    return "[" + ",".join(repr(float(v)) for v in response.json()["embedding"]) + "]"


def cita(metadata):
    autores = (metadata.get("authors") or "").split(",")
    primero = autores[0].strip() if autores and autores[0].strip() else None
    etal = " et al." if len(autores) > 1 else ""
    partes = []
    if primero:
        partes.append(primero + etal)
    if metadata.get("year"):
        partes.append("({})".format(metadata["year"]))
    if metadata.get("doi"):
        partes.append("DOI: " + metadata["doi"])
    return " ".join(partes) or metadata.get("file_name", "?")


def print_block(titulo, filas):
    print("\n--- {} ---".format(titulo))
    if not filas:
        print("  (sin resultados - probablemente embedding_v2 aun no se ha calculado)")
        return
    for posicion, fila in enumerate(filas, 1):
        metadata = fila["metadata"] or {}
        print("\n  {}. similitud {:.4f}   {}".format(posicion, fila["similarity"], cita(metadata)))
        for linea in textwrap.wrap(" ".join(fila["text"].split())[:320], 74):
            print("     " + linea)


def main():
    parser = argparse.ArgumentParser(description="Comparar embedding vs embedding_v2 para una pregunta")
    parser.add_argument("pregunta")
    parser.add_argument("-n", type=int, default=4, help="numero de pasajes por columna (por defecto 4)")
    args = parser.parse_args()

    load_env()
    connection = psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=os.getenv("POSTGRES_PORT", "5432"),
        dbname=os.environ["POSTGRES_DB"],
        user=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"])
    cursor = connection.cursor(cursor_factory=psycopg2.extras.DictCursor)

    vector = embed(args.pregunta)

    cursor.execute(SEARCH.format(col="embedding"), (vector, vector, args.n))
    original = cursor.fetchall()

    cursor.execute(SEARCH.format(col="embedding_v2"), (vector, vector, args.n))
    contextual = cursor.fetchall()

    print("\nPregunta: {}".format(args.pregunta))
    print("=" * 78)
    print_block("SIN contexto (embedding, lo que usa rag_query.py hoy)", original)
    print("\n" + "=" * 78)
    print_block("CON contexto (embedding_v2)", contextual)
    print("\n" + "=" * 78)

    ids_original = {f["id"] for f in original}
    ids_contextual = {f["id"] for f in contextual}
    solo_contextual = ids_contextual - ids_original
    solo_original = ids_original - ids_contextual
    print("\nChunks que aparecen SOLO con contexto: {}".format(len(solo_contextual)))
    print("Chunks que aparecen SOLO sin contexto : {}".format(len(solo_original)))
    print("Chunks en ambos                       : {}".format(len(ids_original & ids_contextual)))

    cursor.close()
    connection.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
