"""
ALCheMy RAG - Contextual Chunking Batch Exporter (Fase C-bis)

Writes one JSON "batch file" per document into data/rag_context_batches/pending/,
so an agentic coding assistant (Gemini in Antigravity, or any other tool that
can read a folder and write files back) can process the whole corpus
sequentially, one document per turn, without ever touching the database or
the embeddings directly.

Why one file per DOCUMENT, not per chunk
------------------------------------------
Contextual retrieval only works if the model sees the WHOLE document while
writing each chunk's context sentence - a chunk shown in isolation has
nothing to be "situated" against. Batching by document also cuts ~87,765
chunk-level requests down to ~950 document-level ones.

Why PUBLIC only
------------------------------------------
This batch's content is meant to be read by an external LLM (Gemini, via
Antigravity). Per CLAUDE.md, INTERNAL/RESTRICTED material must never reach an
external service unmasked. This script hard-filters to
rag_documents.sensitivity = 'PUBLIC' - it is not a suggestion, it is a WHERE
clause, so an INTERNAL lab notebook physically cannot end up in a batch file.

Why the full document text comes from the archived source file, not from
re-concatenating chunks
------------------------------------------
Chunks overlap by ~20% by design (see rag_ingest_chunks.py), so pasting them
back together would repeat text and could confuse the model about where one
chunk ends and the next begins. The clean, non-overlapping original text is
already sitting on disk (this is exactly what
rag_export_metadata_sidecars.py and the Zotero archival step were for) -
this script reads THAT.

What never happens here
------------------------------------------
This script only ever SELECTs from rag_documents/rag_chunks and WRITEs to a
local folder. It has no INSERT/UPDATE statement anywhere, and rag_chunks -
text, embedding, everything - is never modified. The sentences Gemini writes
land in rag_chunk_context (a separate sidecar table) only via
rag_import_context_batches.py, and only after verification.

Usage
-----
    python src/rag_export_context_batches.py                # export everything pending
    python src/rag_export_context_batches.py --limit 5       # a small pilot batch first
    python src/rag_export_context_batches.py --doc 42        # one specific document
"""

import argparse
import json
import os
import sys
from pathlib import Path

import psycopg2
import psycopg2.extras

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_ROOT = REPO_ROOT / "data" / "rag_corpus"
BATCH_ROOT = REPO_ROOT / "data" / "rag_context_batches"
PENDING_DIR = BATCH_ROOT / "pending"
CONTAINER_PREFIX = "/home/node/data/rag_corpus/"

INSTRUCTIONS = (
    "You are given the full text of one scientific document and a list of "
    "text fragments (\"chunks\") that were mechanically extracted from it, "
    "each with a numeric chunk_id. Read the full document first for context.\n\n"
    "For EVERY chunk in the list, write ONE short sentence (max ~25 words) that "
    "situates that specific chunk within the document: what section it is "
    "likely part of, and how it relates to the paper's overall subject. "
    "Do not summarise or repeat the chunk's own content - only add context "
    "that is NOT already obvious from reading the chunk in isolation.\n\n"
    "You MUST process every chunk in the list, in the given order, with no "
    "omissions, no additions, and no changes to any chunk_id. "
    "Respond with ONLY a JSON array, one object per chunk, in this exact "
    "shape, and nothing else (no markdown fences, no commentary):\n"
    '[{"chunk_id": 123, "context_sentence": "..."}, ...]\n\n'
    "Before answering, count: your output array MUST have exactly the same "
    "number of elements as the input chunks array, with exactly the same "
    "set of chunk_id values."
)


def connect():
    try:
        from dotenv import load_dotenv
        load_dotenv(REPO_ROOT / ".env")
    except Exception:                                       # noqa: BLE001
        _load_env_manually(REPO_ROOT / ".env")
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=os.getenv("POSTGRES_PORT", "5432"),
        dbname=os.environ["POSTGRES_DB"],
        user=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"],
    )


def _load_env_manually(path):
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def host_path(file_path):
    if file_path.startswith(CONTAINER_PREFIX):
        return DATA_ROOT / file_path[len(CONTAINER_PREFIX):]
    return None


def extract_text(path):
    """Archived documents are a mix of .pdf (original files kept as-is) and
    .txt (Zotero's extracted-text cache). Reading a PDF's bytes as UTF-8 text
    - the bug this function fixes - does not error, it silently produces
    millions of characters of decoded-binary garbage, because PDF streams are
    compressed binary, not text. Route by extension instead."""
    if path.suffix.lower() == ".pdf":
        import fitz  # PyMuPDF - same extractor rag_catalog_corpus.py uses
        document = fitz.open(str(path))
        try:
            return "".join(page.get_text() for page in document)
        finally:
            document.close()
    return path.read_text(encoding="utf-8", errors="replace")


# Documents that still have at least one chunk with no row in rag_chunk_context.
# PUBLIC only - the hard privacy gate described in the module docstring.
PENDING_QUERY = """
SELECT DISTINCT d.document_id, d.file_name, d.file_path, d.title, d.authors,
       d.year, d.journal, d.doi
FROM rag_documents d
JOIN rag_chunks c ON c.document_id = d.document_id
LEFT JOIN rag_chunk_context cc ON cc.chunk_id = c.id
WHERE d.sensitivity = 'PUBLIC'
  AND d.needs_ocr = FALSE
  AND cc.chunk_id IS NULL
ORDER BY d.document_id;
"""

CHUNKS_QUERY = """
SELECT id, text FROM rag_chunks WHERE document_id = %s ORDER BY id;
"""


def slugify(name):
    return "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in name)[:60]


def main():
    parser = argparse.ArgumentParser(description="Export per-document context batches")
    parser.add_argument("--limit", type=int, default=None,
                        help="export at most N documents (for a pilot run)")
    parser.add_argument("--doc", type=int, default=None,
                        help="export only this one document_id")
    args = parser.parse_args()

    PENDING_DIR.mkdir(parents=True, exist_ok=True)
    (BATCH_ROOT / "done").mkdir(parents=True, exist_ok=True)
    (BATCH_ROOT / "imported").mkdir(parents=True, exist_ok=True)

    connection = connect()
    cursor = connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(PENDING_QUERY)
    documents = cursor.fetchall()
    if args.doc is not None:
        documents = [d for d in documents if d["document_id"] == args.doc]
    if args.limit is not None:
        documents = documents[:args.limit]

    written, skipped_no_text = 0, 0

    for doc in documents:
        source = host_path(doc["file_path"] or "")
        if source is None or not source.is_file():
            print("  !! sin archivo fisico, saltado: {} (doc {})".format(
                doc["file_name"], doc["document_id"]))
            skipped_no_text += 1
            continue

        try:
            full_text = extract_text(source)
        except Exception as error:                          # noqa: BLE001
            print("  !! no se pudo leer {}: {}".format(source, error))
            skipped_no_text += 1
            continue

        cursor.execute(CHUNKS_QUERY, (doc["document_id"],))
        chunks = [{"chunk_id": row["id"], "text": row["text"]} for row in cursor.fetchall()]
        if not chunks:
            continue

        batch = {
            "document_id": doc["document_id"],
            "citation": "{} ({}). {}. {}".format(
                doc["authors"] or "?", doc["year"] or "s.f.",
                doc["title"] or doc["file_name"], doc["journal"] or ""),
            "doi": doc["doi"],
            "instructions": INSTRUCTIONS,
            "full_document_text": full_text,
            "chunks": chunks,
        }

        target = PENDING_DIR / "{:05d}_{}.json".format(
            doc["document_id"], slugify(doc["file_name"]))
        with open(target, "w", encoding="utf-8") as handle:
            json.dump(batch, handle, ensure_ascii=False, indent=2)
        written += 1

    cursor.close()
    connection.close()

    print("\nDocumentos exportados a {}: {}".format(PENDING_DIR, written))
    print("Saltados (sin texto legible): {}".format(skipped_no_text))
    print("Documentos totales aun pendientes en la BD: {}".format(len(documents)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
