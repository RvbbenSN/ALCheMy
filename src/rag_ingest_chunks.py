"""
ALCheMy RAG - text chunking and vectorisation.

Takes the documents already catalogued in rag_documents, splits their text into
overlapping chunks, embeds each chunk with the local Ollama model and writes
them into rag_chunks.

This is the same job the n8n workflow does, in Python. Both write the exact
same table with the same column names (id/text/metadata/embedding, imposed by
LangChain's PGVector store), so the two lanes are interchangeable - just like
the synthesis and characterisation lanes already are elsewhere in the project.
Having it here means the retrieval layer can be filled and queried without
waiting on n8n credentials.

    python src/rag_ingest_chunks.py                # only what has no chunks yet
    python src/rag_ingest_chunks.py --force        # re-chunk everything
    python src/rag_ingest_chunks.py --doc 4        # a single document

Documents flagged needs_ocr are always skipped: they have no text, so they
would produce zero chunks without any error.
"""

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

import psycopg2
import psycopg2.extras
import requests

REPO_ROOT = Path(__file__).resolve().parent.parent
OLLAMA = os.getenv("OLLAMA_URL", "http://localhost:11434")
MODEL = "bge-m3:latest"

# 1200 characters with 250 of overlap (~20%). Dense technical prose needs more
# overlap than ordinary text: a sentence split across two chunks would other-
# wise be lost to both. Roughly a long paragraph per chunk.
CHUNK_SIZE = 1200
CHUNK_OVERLAP = 250

# Tried in order, coarsest first: never cut mid-word if a paragraph break will do.
SEPARATORS = ["\n\n", "\n", ". ", "; ", ", ", " "]


# --------------------------------------------------------------------------- #
def split_text(text, size=CHUNK_SIZE, overlap=CHUNK_OVERLAP):
    """Recursive character splitter.

    Walks a window of `size` characters and backs up to the last natural
    boundary inside it, so chunks end at a paragraph or a sentence rather than
    in the middle of a word.
    """
    # PostgreSQL refuses NUL (0x00) inside a TEXT value, and PDF extractors
    # do emit them from broken font tables - three documents died on this.
    # The other C0 control characters go too: they carry no meaning here.
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if not text:
        return []

    chunks = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        if end < len(text):
            for separator in SEPARATORS:
                cut = text.rfind(separator, start + size // 2, end)
                if cut != -1:
                    end = cut + len(separator)
                    break
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return chunks


# Ollama's newer /api/embed accepts a list and is ~1.5x faster on 1200-char
# chunks than one call per chunk (603 ms vs 896 ms measured). Over a corpus of
# ~38.000 chunks that is three hours saved, so it is worth the extra code.
BATCH = 16
RETRIES = 4


def embed_batch(texts):
    """Embed a list of texts in one call, retrying on transient failures.

    A six-hour run will meet the occasional timeout; dying on the first one
    would waste the whole night. Failures back off and retry, and only a
    persistent one is allowed to propagate.
    """
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


def embed(text):
    return embed_batch([text])[0]


def as_vector(values):
    return "[" + ",".join(repr(float(v)) for v in values) + "]"


def host_path(container_path):
    """rag_documents stores the path as n8n sees it inside the container.
    Map it back to this machine so Python can open the file."""
    marker = "/data/rag_corpus/"
    if marker in container_path:
        return REPO_ROOT / "data" / "rag_corpus" / container_path.split(marker, 1)[1]
    return Path(container_path)


def read_text(path):
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        import fitz
        doc = fitz.open(str(path))
        text = "".join(page.get_text() for page in doc)
        doc.close()
        return text
    if suffix == ".docx":
        from docx import Document
        doc = Document(str(path))
        parts = [p.text for p in doc.paragraphs]
        for table in doc.tables:
            for row in table.rows:
                parts.append(" | ".join(cell.text for cell in row.cells))
        return "\n".join(parts)
    return path.read_text(encoding="utf-8", errors="replace")


def load_env():
    path = REPO_ROOT / ".env"
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


# --------------------------------------------------------------------------- #
def main():
    parser = argparse.ArgumentParser(description="ALCheMy RAG chunker")
    parser.add_argument("--force", action="store_true",
                        help="re-chunk documents that already have chunks")
    parser.add_argument("--doc", type=int, help="only this document_id")
    args = parser.parse_args()

    load_env()
    connection = psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=os.getenv("POSTGRES_PORT", "5432"),
        dbname=os.environ["POSTGRES_DB"],
        user=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"])
    cursor = connection.cursor(cursor_factory=psycopg2.extras.DictCursor)

    where = ["needs_ocr = FALSE"]
    params = []
    if not args.force:
        where.append("n_chunks = 0")
    if args.doc:
        where.append("document_id = %s")
        params.append(args.doc)

    cursor.execute("""
        SELECT document_id, file_name, file_path, title, authors, year, journal,
               doi, sensitivity, doc_type, file_hash
        FROM   rag_documents
        WHERE  {}
        ORDER  BY document_id;""".format(" AND ".join(where)), params)
    documents = cursor.fetchall()

    if not documents:
        print("No hay documentos pendientes. Usa --force para re-trocear.")
        return 0

    print("Documentos a procesar: {}".format(len(documents)))
    total_chunks = 0
    hechos = fallidos = 0
    inicio = time.time()

    for document in documents:
        path = host_path(document["file_path"])
        if not path.is_file():
            print("  !! {:<40s} fichero no encontrado: {}".format(
                document["file_name"][:40], path))
            continue

        text = read_text(path)
        chunks = split_text(text)
        if not chunks:
            print("  !! {:<40s} sin texto".format(document["file_name"][:40]))
            continue

        print("  {:<40s} {:>6d} caracteres -> {:>4d} trozos".format(
            document["file_name"][:40], len(text), len(chunks)), end="", flush=True)

        # Re-chunking replaces cleanly: delete then insert, inside one
        # transaction, so a failure halfway cannot leave half a document.
        cursor.execute("DELETE FROM rag_chunks WHERE document_id = %s;",
                       (document["document_id"],))

        # Every chunk carries the citation with it. When the agent retrieves a
        # passage it must be able to say where it came from without a second
        # query - and the sensitivity label has to travel too, so the prompt
        # can refuse to quote INTERNAL material verbatim.
        base_metadata = {
            # file_hash must be here: the n8n ingestion lane skips already
            # indexed files with
            #   SELECT DISTINCT metadata->>'file_hash' FROM rag_chunks
            # so a chunk written without it is invisible to that check and the
            # document would be indexed a second time.
            "file_hash": document["file_hash"],
            "document_id": document["document_id"],
            "file_name": document["file_name"],
            "title": document["title"],
            "authors": document["authors"],
            "year": document["year"],
            "journal": document["journal"],
            "doi": document["doi"],
            "sensitivity": document["sensitivity"],
            "doc_type": document["doc_type"],
        }

        try:
            for offset in range(0, len(chunks), BATCH):
                lote = chunks[offset:offset + BATCH]
                for index, (chunk, vector) in enumerate(zip(lote, embed_batch(lote)),
                                                        start=offset):
                    metadata = dict(base_metadata, chunk_index=index,
                                    n_chunks=len(chunks))
                    cursor.execute("""
                        INSERT INTO rag_chunks (document_id, text, metadata, embedding)
                        VALUES (%s, %s, %s, %s::vector);""",
                                   (document["document_id"], chunk,
                                    json.dumps(metadata), as_vector(vector)))
        except Exception as error:                      # noqa: BLE001
            # One unreadable document must not end the night. Roll back just
            # this document; n_chunks stays 0, so a later run retries it.
            connection.rollback()
            print("  FALLO: {}".format(str(error)[:90]))
            fallidos += 1
            continue

        cursor.execute("UPDATE rag_documents SET n_chunks = %s WHERE document_id = %s;",
                       (len(chunks), document["document_id"]))
        connection.commit()
        total_chunks += len(chunks)
        hechos += 1
        transcurrido = time.time() - inicio
        ritmo = total_chunks / transcurrido if transcurrido else 0
        restantes = len(documents) - hechos - fallidos
        eta = (restantes * (total_chunks / hechos) / ritmo / 3600) if ritmo and hechos else 0
        print("  OK  [{}/{}]  {:.1f} trozos/s  ETA {:.1f} h".format(
            hechos, len(documents), ritmo, eta))

    cursor.execute("SELECT count(*) FROM rag_chunks;")
    print("\nDocumentos completados : {}".format(hechos))
    print("Documentos fallidos    : {}  (se reintentan al volver a ejecutar)".format(fallidos))
    print("Trozos en esta pasada  : {}".format(total_chunks))
    print("Total en rag_chunks    : {}".format(cursor.fetchone()[0]))
    print("Tiempo                 : {:.2f} h".format((time.time() - inicio) / 3600))
    cursor.close()
    connection.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
