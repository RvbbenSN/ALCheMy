"""
ALCheMy RAG - Contextual Chunking Batch Importer (Fase C-bis)

Reads the JSON files an agentic assistant (Gemini / Antigravity) wrote into
data/rag_context_batches/done/, verifies each one is complete and untampered
BEFORE writing anything, and only then inserts into the rag_chunk_context
sidecar table. Never touches rag_chunks.

Expected shape of a "done" file: the same batch JSON rag_export_context_batches.py
wrote, with one extra top-level key "results" holding the model's answer:
    {"document_id": 42, "chunks": [{"chunk_id": 123, "text": "..."}, ...],
     "results": [{"chunk_id": 123, "context_sentence": "..."}, ...], ...}

What "verified" means here (all must hold, or the whole file is rejected -
never a partial import of one document):
    1. "results" is present and is a JSON array.
    2. len(results) == len(chunks) - the model did not add or drop entries.
    3. set(chunk_id in results) == set(chunk_id in chunks) - exactly the same
       fragments, no invented IDs, no duplicates.
    4. every context_sentence is a non-empty string.

Usage
-----
    python src/rag_import_context_batches.py                # dry run: report only
    python src/rag_import_context_batches.py --apply         # write + archive done files
"""

import argparse
import json
import os
import shutil
import sys
from pathlib import Path

import psycopg2

REPO_ROOT = Path(__file__).resolve().parent.parent
BATCH_ROOT = REPO_ROOT / "data" / "rag_context_batches"
DONE_DIR = BATCH_ROOT / "done"
IMPORTED_DIR = BATCH_ROOT / "imported"
REJECTED_DIR = BATCH_ROOT / "rejected"


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


def verify(batch, file_name):
    """Returns (ok, reason). Never raises - a malformed file is a rejection,
    not a crash."""
    expected_ids = {c["chunk_id"] for c in batch.get("chunks", [])}
    if not expected_ids:
        return False, "el batch original no tenia chunks"

    results = batch.get("results")
    if not isinstance(results, list):
        return False, "falta la clave 'results' o no es una lista"

    if len(results) != len(expected_ids):
        return False, "se esperaban {} sentencias, llegaron {}".format(
            len(expected_ids), len(results))

    got_ids = []
    for item in results:
        if not isinstance(item, dict) or "chunk_id" not in item or "context_sentence" not in item:
            return False, "un elemento de 'results' no tiene chunk_id/context_sentence"
        if not isinstance(item["context_sentence"], str) or not item["context_sentence"].strip():
            return False, "context_sentence vacia para chunk_id={}".format(item.get("chunk_id"))
        got_ids.append(item["chunk_id"])

    if len(set(got_ids)) != len(got_ids):
        return False, "hay chunk_id repetidos en 'results'"

    if set(got_ids) != expected_ids:
        missing = expected_ids - set(got_ids)
        extra = set(got_ids) - expected_ids
        return False, "IDs no coinciden. faltan={} sobran={}".format(missing, extra)

    return True, "ok"


INSERT = """
INSERT INTO rag_chunk_context (chunk_id, context_sentence, source_model, batch_file)
VALUES (%s, %s, %s, %s)
ON CONFLICT (chunk_id) DO UPDATE SET
    context_sentence = EXCLUDED.context_sentence,
    source_model = EXCLUDED.source_model,
    batch_file = EXCLUDED.batch_file,
    created_at = now();
"""


def main():
    parser = argparse.ArgumentParser(description="Verify and import context batches")
    parser.add_argument("--apply", action="store_true",
                        help="write to rag_chunk_context and archive files (default: dry run)")
    parser.add_argument("--model-name", default="gemini-3.7",
                        help="value stored in rag_chunk_context.source_model")
    args = parser.parse_args()

    if not DONE_DIR.is_dir():
        print("No existe {} - nada que importar todavia.".format(DONE_DIR))
        return 0

    if args.apply:
        IMPORTED_DIR.mkdir(parents=True, exist_ok=True)
        REJECTED_DIR.mkdir(parents=True, exist_ok=True)

    connection = connect() if args.apply else None
    cursor = connection.cursor() if connection else None

    accepted, rejected, total_sentences = 0, 0, 0

    for path in sorted(DONE_DIR.glob("*.json")):
        try:
            with open(path, encoding="utf-8") as handle:
                batch = json.load(handle)
        except Exception as error:                          # noqa: BLE001
            print("!! {} : JSON invalido ({})".format(path.name, error))
            rejected += 1
            if args.apply:
                shutil.move(str(path), str(REJECTED_DIR / path.name))
            continue

        ok, reason = verify(batch, path.name)
        status = "OK " if ok else "MAL"
        print("{} {:<50s} {}".format(status, path.name, reason))

        if not ok:
            rejected += 1
            if args.apply:
                shutil.move(str(path), str(REJECTED_DIR / path.name))
            continue

        accepted += 1
        if args.apply:
            for item in batch["results"]:
                cursor.execute(INSERT, (item["chunk_id"], item["context_sentence"],
                                        args.model_name, path.name))
                total_sentences += 1
            connection.commit()
            shutil.move(str(path), str(IMPORTED_DIR / path.name))
        else:
            total_sentences += len(batch["results"])

    if cursor:
        cursor.close()
    if connection:
        connection.close()

    print("\nDocumentos aceptados: {} | rechazados: {} | frases {}: {}".format(
        accepted, rejected, "importadas" if args.apply else "que se importarian",
        total_sentences))
    if not args.apply:
        print("DRY RUN - repite con --apply para escribir en rag_chunk_context.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
