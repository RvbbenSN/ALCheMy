"""
ALCheMy RAG - Targeted Context-Sentence Repair Exporter (Fase C-bis)

Finds chunk_context rows that already look wrong - by default, the broken
template signature discovered on 2026-08-26 ("This X chunk (part N)
evaluates <garbled word> regarding <title>", where a nonsensical or
truncated fragment stands in for real content) - and exports ONLY those
chunk_ids for reprocessing, instead of redoing whole documents that are
otherwise fine.

Why targeted repair instead of redoing whole documents
------------------------------------------------------
The 2026-08-26 incident affected 502 of 783 imported documents, but within
each affected document only a small fraction of chunks were actually bad
(median ~10%, only one document over 50%). Re-exporting whole documents
would throw away thousands of good sentences to fix a few hundred bad ones.
This script asks Gemini to regenerate only the flagged chunk_ids, still
giving it the full document text for context (contextual retrieval needs
that), and the same rag_import_context_batches.py --apply step overwrites
just those rows via the existing ON CONFLICT (chunk_id) upsert - nothing
else in rag_chunk_context is touched, and rag_chunks.text/embedding are
never touched by any script in this pipeline.

Output goes to data/rag_context_batches/repairs/pending/, a separate tree
from the normal pending/done/imported/rejected/ used for first-time
processing, so repair work never gets mixed up with new-document waves.
Import it the same way, just pointing --batch-root at that tree:
    python src/rag_import_context_batches.py --batch-root data/rag_context_batches/repairs --apply

Usage
-----
    python src/rag_export_context_repairs.py                 # export every affected document
    python src/rag_export_context_repairs.py --limit 20       # a small pilot batch first
    python src/rag_export_context_repairs.py --doc 291        # one specific document
    python src/rag_export_context_repairs.py --pattern '...'  # override the broken-sentence regex
"""

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

import psycopg2
import psycopg2.extras

# Reuse the DB connection, PDF/txt text extraction and host-path resolution
# from the sibling script instead of duplicating them - they are exactly the
# same operations, just for a different set of chunks.
from rag_export_context_batches import (
    REPO_ROOT, connect, extract_text, host_path, slugify,
)

BATCH_ROOT = REPO_ROOT / "data" / "rag_context_batches"
REPAIRS_PENDING_DIR = BATCH_ROOT / "repairs" / "pending"

# The failure signature from the 2026-08-26 incident: a filler template that
# passes structural AND diversity checks (each sentence differs by its part
# number and garbled word) while carrying near-zero real information.
DEFAULT_BROKEN_PATTERN = r"\(part \d+\)"

REPAIR_INSTRUCTIONS = (
    "This is a REPAIR batch, not a first pass. Every chunk listed here "
    "previously got a broken context sentence - a template like \"This "
    "Introduction chunk (part 23) evaluates PSCs regarding <title>\", where "
    "a nonsensical, truncated, or randomly-grabbed word/acronym stood in "
    "for real content, instead of a sentence actually grounded in what that "
    "chunk says. You are given the full document text again so you can read "
    "it properly this time.\n\n"
    "For EVERY chunk in the list, write ONE short sentence (max ~25 words) "
    "that situates that specific chunk within the document, based on what "
    "the chunk's own text actually contains - never a generic template, "
    "never a recycled phrase, and never a raw/broken text fragment standing "
    "in for a real word. If two chunks are genuinely similar (e.g. both "
    "from a references list or a data table), say what is actually "
    "different about each one (the specific reference range, author, "
    "figure number, or value it covers) - do not fall back to a "
    "'(part N)' counter to fake a difference.\n\n"
    "You MUST process every chunk in the list, in the given order, with no "
    "omissions, no additions, and no changes to any chunk_id. "
    "Respond with ONLY a JSON array, one object per chunk, in this exact "
    "shape, and nothing else (no markdown fences, no commentary):\n"
    '[{"chunk_id": 123, "context_sentence": "..."}, ...]\n\n'
    "Before answering, count: your output array MUST have exactly the same "
    "number of elements as the input chunks array, with exactly the same "
    "set of chunk_id values."
)

BROKEN_CHUNKS_QUERY = """
SELECT c.document_id, c.id AS chunk_id, c.text
FROM rag_chunk_context cc
JOIN rag_chunks c ON c.id = cc.chunk_id
WHERE cc.context_sentence ~ %s
ORDER BY c.document_id, c.id;
"""

DOCS_QUERY = """
SELECT document_id, file_name, file_path, title, authors, year, journal, doi
FROM rag_documents
WHERE document_id = ANY(%s);
"""


def main():
    parser = argparse.ArgumentParser(
        description="Export targeted repair batches for chunks with a broken context sentence")
    parser.add_argument("--pattern", default=DEFAULT_BROKEN_PATTERN,
                        help="POSIX regex (matched with ~) identifying a broken "
                             "context_sentence (default: the '(part N)' filler-template "
                             "signature from the 2026-08-26 incident)")
    parser.add_argument("--limit", type=int, default=None,
                        help="export at most N affected documents (for a pilot run)")
    parser.add_argument("--doc", type=int, default=None,
                        help="export only this one document_id")
    args = parser.parse_args()

    REPAIRS_PENDING_DIR.mkdir(parents=True, exist_ok=True)
    (BATCH_ROOT / "repairs" / "done").mkdir(parents=True, exist_ok=True)
    (BATCH_ROOT / "repairs" / "imported").mkdir(parents=True, exist_ok=True)

    connection = connect()
    cursor = connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(BROKEN_CHUNKS_QUERY, (args.pattern,))
    broken_rows = cursor.fetchall()

    broken_by_doc = defaultdict(list)
    for row in broken_rows:
        broken_by_doc[row["document_id"]].append(row)

    doc_ids = sorted(broken_by_doc)
    if args.doc is not None:
        doc_ids = [d for d in doc_ids if d == args.doc]
    if args.limit is not None:
        doc_ids = doc_ids[:args.limit]

    if not doc_ids:
        print("No se encontraron chunks con el patron {!r} - nada que reparar.".format(args.pattern))
        cursor.close()
        connection.close()
        return 0

    cursor.execute(DOCS_QUERY, (doc_ids,))
    docs_by_id = {row["document_id"]: row for row in cursor.fetchall()}

    written, skipped_no_text, total_broken_chunks = 0, 0, 0

    for doc_id in doc_ids:
        doc = docs_by_id.get(doc_id)
        if doc is None:
            print("  !! documento {} ya no existe en rag_documents, saltado".format(doc_id))
            continue

        source = host_path(doc["file_path"] or "")
        if source is None or not source.is_file():
            print("  !! sin archivo fisico, saltado: {} (doc {})".format(
                doc["file_name"], doc_id))
            skipped_no_text += 1
            continue

        try:
            full_text = extract_text(source)
        except Exception as error:                          # noqa: BLE001
            print("  !! no se pudo leer {}: {}".format(source, error))
            skipped_no_text += 1
            continue

        chunks = [{"chunk_id": row["chunk_id"], "text": row["text"]}
                  for row in broken_by_doc[doc_id]]

        batch = {
            "document_id": doc_id,
            "citation": "{} ({}). {}. {}".format(
                doc["authors"] or "?", doc["year"] or "s.f.",
                doc["title"] or doc["file_name"], doc["journal"] or ""),
            "doi": doc["doi"],
            "repair_of_pattern": args.pattern,
            "instructions": REPAIR_INSTRUCTIONS,
            "full_document_text": full_text,
            "chunks": chunks,
        }

        target = REPAIRS_PENDING_DIR / "{:05d}_{}.json".format(doc_id, slugify(doc["file_name"]))
        with open(target, "w", encoding="utf-8") as handle:
            json.dump(batch, handle, ensure_ascii=False, indent=2)
        written += 1
        total_broken_chunks += len(chunks)

    cursor.close()
    connection.close()

    print("\nDocumentos exportados a {}: {}".format(REPAIRS_PENDING_DIR, written))
    print("Chunks a reparar en este lote: {}".format(total_broken_chunks))
    print("Saltados (sin texto legible): {}".format(skipped_no_text))
    print("Documentos afectados totales en la BD (patron {!r}): {}".format(
        args.pattern, len(broken_by_doc)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
