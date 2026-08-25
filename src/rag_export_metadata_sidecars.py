"""
ALCheMy RAG - Metadata Sidecar Exporter

Every document copied by rag_catalog_corpus.py already lives on disk under
data/rag_corpus/{public,internal,zotero}/ - so uninstalling Zotero, or losing
the Zotero library entirely, does not delete the text ALCheMy actually
indexes. What is NOT on disk anywhere is the bibliographic identity of that
file: Zotero never writes a metadata file next to the PDF or the cache text
it extracts - it only keeps that record inside zotero.sqlite. ALCheMy solved
that at ingestion time by writing it into rag_documents.csl_json instead, but
that means the ONLY copy of "who wrote this, what journal, what DOI" lives in
Postgres. If the file and the database ever separate, the file becomes an
anonymous blob of text again.

This script closes that gap: for every row in rag_documents whose physical
file still exists under data/rag_corpus/, it writes a sidecar
"<file_name>.meta.json" right next to it, containing the same CSL-JSON record
plus the reconciled fields (title/authors/year/journal/doi/doc_type/
sensitivity/metadata_source/file_hash). File and identity then travel
together as an ordinary pair of files - readable without n8n, without
Zotero, and without a database connection.

Usage
-----
    python src/rag_export_metadata_sidecars.py            # dry run: report only
    python src/rag_export_metadata_sidecars.py --apply     # write the .meta.json files
    python src/rag_export_metadata_sidecars.py --apply --overwrite
        Rewrite sidecars that already exist (default: skip them, since the
        DB is not expected to change a record after Crossref/Zotero enrichment).
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

# rag_documents.file_path is the CONTAINER path n8n sees (bind-mounted at
# /home/node/data/...). On the host the same file sits under REPO_ROOT/data/.
CONTAINER_PREFIX = "/home/node/data/rag_corpus/"


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
    """Map the container path stored in the DB back to a real path on disk."""
    if file_path.startswith(CONTAINER_PREFIX):
        return DATA_ROOT / file_path[len(CONTAINER_PREFIX):]
    return None


def sidecar_payload(row):
    return {
        "document_id": row["document_id"],
        "file_name": row["file_name"],
        "file_hash": row["file_hash"],
        "doi": row["doi"],
        "title": row["title"],
        "authors": row["authors"],
        "year": row["year"],
        "journal": row["journal"],
        "doc_type": row["doc_type"],
        "sensitivity": row["sensitivity"],
        "metadata_source": row["metadata_source"],
        "n_pages": row["n_pages"],
        "n_images": row["n_images"],
        "n_chars": row["n_chars"],
        "csl_json": row["csl_json"],
    }


QUERY = """
SELECT document_id, file_name, file_path, file_hash, doi, title, authors,
       year, journal, doc_type, sensitivity, metadata_source, n_pages,
       n_images, n_chars, csl_json
FROM rag_documents
ORDER BY document_id;
"""


def main():
    parser = argparse.ArgumentParser(description="Export a metadata sidecar "
                                      "next to every archived RAG document")
    parser.add_argument("--apply", action="store_true",
                        help="write the .meta.json files (default is a dry run)")
    parser.add_argument("--overwrite", action="store_true",
                        help="rewrite sidecars that already exist")
    args = parser.parse_args()

    connection = connect()
    cursor = connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(QUERY)
    rows = cursor.fetchall()
    cursor.close()
    connection.close()

    written, skipped_existing, missing_file, missing_path = 0, 0, 0, 0

    for row in rows:
        target = host_path(row["file_path"] or "")
        if target is None:
            missing_path += 1
            continue
        if not target.is_file():
            missing_file += 1
            print("  !! archivo no encontrado en disco: {}".format(target))
            continue

        sidecar = target.with_suffix(target.suffix + ".meta.json")
        if sidecar.exists() and not args.overwrite:
            skipped_existing += 1
            continue

        if args.apply:
            sidecar.write_text(
                json.dumps(sidecar_payload(row), ensure_ascii=False, indent=2,
                           default=str),
                encoding="utf-8",
            )
        written += 1

    print("Documentos en rag_documents        : {}".format(len(rows)))
    print("Sidecars {}escritos              : {}".format(
        "" if args.apply else "que se ESCRIBIRIAN ", written))
    print("Ya existian (omitidos)             : {}".format(skipped_existing))
    print("Fichero fisico no encontrado       : {}".format(missing_file))
    print("file_path con formato inesperado   : {}".format(missing_path))
    if not args.apply:
        print("\nDRY RUN - no se ha escrito nada. Repite con --apply.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
