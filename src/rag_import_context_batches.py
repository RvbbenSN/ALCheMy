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
    5. the sentences are actually distinct from each other. A model that got
       lazy will still produce a well-formed file (right count, right IDs)
       but paste the same 3-10 generic sentences across every chunk instead
       of writing one per chunk - rule 5 is the only thing that catches that,
       since rules 1-4 are purely structural and pass either way.

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

    sentences = [item["context_sentence"].strip() for item in results]
    unique_ratio = len(set(sentences)) / len(sentences)
    if len(sentences) > 5 and unique_ratio < 0.5:
        return False, (
            "solo {} frases distintas para {} chunks ({:.0f}% de diversidad) - "
            "el modelo parece haber reciclado un puñado de frases genericas en vez "
            "de escribir una especifica por chunk".format(
                len(set(sentences)), len(sentences), unique_ratio * 100)
        )

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


STATUS_QUERY = """
SELECT
    (SELECT count(*) FROM rag_documents WHERE sensitivity = 'PUBLIC' AND needs_ocr = FALSE) AS total_docs,
    (SELECT count(DISTINCT d.document_id)
       FROM rag_documents d JOIN rag_chunks c ON c.document_id = d.document_id
       JOIN rag_chunk_context cc ON cc.chunk_id = c.id
      WHERE d.sensitivity = 'PUBLIC') AS docs_with_at_least_one_sentence,
    (SELECT count(*) FROM rag_chunks c JOIN rag_documents d ON d.document_id = c.document_id
      WHERE d.sensitivity = 'PUBLIC' AND d.needs_ocr = FALSE) AS total_chunks_eligible,
    (SELECT count(*) FROM rag_chunk_context) AS chunks_with_sentence;
"""


def print_status():
    """Progress against the WHOLE corpus (DB), plus what's sitting in each
    folder right now - the two numbers answer different questions: the DB
    numbers say "how much of the corpus is done", the folder numbers say
    "is there anything left over from an interrupted Antigravity session
    that still needs draining"."""
    for name in ("pending", "done", "imported", "rejected"):
        (BATCH_ROOT / name).mkdir(parents=True, exist_ok=True)

    connection = connect()
    cursor = connection.cursor()
    cursor.execute(STATUS_QUERY)
    total_docs, docs_done, total_chunks, chunks_done = cursor.fetchone()
    cursor.close()
    connection.close()

    pending_n = len(list((BATCH_ROOT / "pending").glob("*.json")))
    done_n = len(list((BATCH_ROOT / "done").glob("*.json")))
    imported_n = len(list((BATCH_ROOT / "imported").glob("*.json")))
    rejected_n = len(list((BATCH_ROOT / "rejected").glob("*.json")))

    print("=== Progreso global (toda la base de datos) ===")
    print("Documentos PUBLIC con al menos 1 frase : {} / {}".format(docs_done, total_docs))
    print("Chunks con frase de contexto            : {} / {}".format(chunks_done, total_chunks))
    if total_chunks:
        print("Porcentaje del corpus                   : {:.1f}%".format(
            100.0 * chunks_done / total_chunks))
    print()
    print("=== Carpeta data/rag_context_batches/ ahora mismo ===")
    print("pending/  (esperando a Antigravity)     : {}".format(pending_n))
    print("done/     (esperando a --apply)         : {}".format(done_n))
    print("imported/ (ya en la base de datos)      : {}".format(imported_n))
    print("rejected/ (fallaron la verificacion)    : {}".format(rejected_n))
    if pending_n:
        print("\n-> Hay {} lote(s) sin terminar en pending/: retoma esa carpeta en "
              "Antigravity antes de exportar un lote nuevo.".format(pending_n))
    elif done_n:
        print("\n-> Hay {} lote(s) en done/ sin importar: ejecuta --apply.".format(done_n))
    else:
        print("\n-> Nada a medias. Puedes exportar el siguiente lote cuando quieras.")
    return 0


def main():
    parser = argparse.ArgumentParser(description="Verify and import context batches")
    parser.add_argument("--apply", action="store_true",
                        help="write to rag_chunk_context and archive files (default: dry run)")
    parser.add_argument("--model-name", default="gemini-3.7",
                        help="value stored in rag_chunk_context.source_model")
    parser.add_argument("--status", action="store_true",
                        help="print overall progress (DB + folders) and exit, without importing anything")
    args = parser.parse_args()

    if args.status:
        return print_status()

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
