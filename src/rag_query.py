"""
ALCheMy RAG - ask the corpus a question from the command line.

Runs the same hybrid search the n8n agent uses (rag_hybrid_search: vector +
lexical, fused with Reciprocal Rank Fusion) and prints the passages with their
citation. There is no language model here on purpose: this shows the RETRIEVAL,
which is the part that decides whether an answer can be right at all. If the
right passage is not in this list, no model can produce a correct answer from it.

    python src/rag_query.py "polimerizacion de epsilon-caprolactona"
    python src/rag_query.py "estabilidad en agua" -n 5
    python src/rag_query.py "sintesis solvotermal" --publico
"""

import argparse
import os
import sys
import textwrap
from pathlib import Path

import psycopg2
import psycopg2.extras
import requests

REPO_ROOT = Path(__file__).resolve().parent.parent
OLLAMA = os.getenv("OLLAMA_URL", "http://localhost:11434")
MODEL = "bge-m3:latest"


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
    """Build the reference from what travels inside the chunk itself."""
    autores = (metadata.get("authors") or "").split(",")
    primero = autores[0].strip() if autores and autores[0].strip() else None
    etal = " et al." if len(autores) > 1 else ""
    partes = []
    if primero:
        partes.append(primero + etal)
    if metadata.get("year"):
        partes.append("({})".format(metadata["year"]))
    if metadata.get("journal"):
        partes.append(metadata["journal"])
    if metadata.get("doi"):
        partes.append("DOI: " + metadata["doi"])
    return " ".join(partes) or metadata.get("file_name", "?")


def main():
    parser = argparse.ArgumentParser(description="Preguntar al corpus del RAG")
    parser.add_argument("pregunta")
    parser.add_argument("-n", type=int, default=4, help="numero de pasajes (por defecto 4)")
    parser.add_argument("--publico", action="store_true",
                        help="solo pasajes PUBLIC (lo que se podria enviar a un LLM externo)")
    args = parser.parse_args()

    load_env()
    connection = psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=os.getenv("POSTGRES_PORT", "5432"),
        dbname=os.environ["POSTGRES_DB"],
        user=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"])
    cursor = connection.cursor(cursor_factory=psycopg2.extras.DictCursor)

    # Over-fetch when filtering, so the filter does not empty the result set.
    cursor.execute("SELECT * FROM rag_hybrid_search(%s, %s::vector, %s, 60);",
                   (args.pregunta, embed(args.pregunta),
                    args.n * 3 if args.publico else args.n))
    filas = cursor.fetchall()

    if args.publico:
        filas = [f for f in filas
                 if (f["metadata"] or {}).get("sensitivity") == "PUBLIC"][:args.n]

    print("\nPregunta: {}".format(args.pregunta))
    print("=" * 78)
    if not filas:
        print("Sin resultados. Comprueba que rag_chunks tiene contenido:")
        print("  SELECT count(*) FROM rag_chunks;")
        return 1

    for posicion, fila in enumerate(filas, 1):
        metadata = fila["metadata"] or {}
        marca = "" if metadata.get("sensitivity") == "PUBLIC" else "  [INTERNO]"
        print("\n{}. RRF {:.5f}{}".format(posicion, fila["rrf_score"], marca))
        print("   Fuente: {}".format(cita(metadata)))
        if metadata.get("title"):
            print("   {}".format(metadata["title"][:74]))
        print("   trozo {} de {}".format(
            metadata.get("chunk_index", "?"), metadata.get("n_chunks", "?")))
        for linea in textwrap.wrap(" ".join(fila["text"].split())[:520], 74):
            print("      " + linea)

    print("\n" + "=" * 78)
    cursor.close()
    connection.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
