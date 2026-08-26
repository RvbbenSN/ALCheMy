"""
ALCheMy RAG - Zotero library reader.

Reads a Zotero library (zotero.sqlite + storage/) and returns one record per
item whose PDF attachment actually exists on disk. Metadata comes from the
reference manager, i.e. curated by a human, so it outranks anything guessed
from the PDF itself - see rag_source_rank() in scripts/init_db.sql.

Why this lane exists alongside the drop-a-file-in-a-folder lane
---------------------------------------------------------------
Heuristics are convenient but fragile: publishers write whatever they like into
PDF metadata (Elsevier stores only the corresponding author). A reference
manager already holds the record properly structured. Both lanes feed the same
table; the provenance ranking decides who wins when they disagree.

The database is opened READ-ONLY and, because Zotero holds a lock while
running, it is copied to a temporary file first. The user's library is never
written to.
"""

import html
import os
import re
import shutil
import sqlite3
import tempfile

# Zotero item types worth indexing. Attachments, notes and annotations are
# skipped: they are not documents in their own right.
INDEXABLE_TYPES = (
    "journalArticle", "conferencePaper", "bookSection", "book",
    "thesis", "report", "preprint", "manuscript",
)

# Zotero field names -> our column names.
FIELD_MAP = {
    "title": "title",
    "DOI": "doi",
    "date": "date",
    "publicationTitle": "journal",
    "bookTitle": "journal",
    "proceedingsTitle": "journal",
    "publisher": "journal",
    "abstractNote": "abstract",
    "url": "url",
    "volume": "volume",
    "pages": "pages",
    "issue": "issue",
    "ISSN": "issn",
}


def _open_readonly(zotero_dir):
    """Copy zotero.sqlite to a temp file and open it. Zotero keeps an exclusive
    lock while the app is running, so reading the original can fail outright."""
    source = os.path.join(zotero_dir, "zotero.sqlite")
    if not os.path.isfile(source):
        raise FileNotFoundError("No zotero.sqlite under {}".format(zotero_dir))
    handle, temp_path = tempfile.mkstemp(suffix=".sqlite", prefix="zotero_ro_")
    os.close(handle)
    shutil.copy2(source, temp_path)
    return sqlite3.connect(temp_path), temp_path


# Zotero preserves the publisher's rich text inside titles, so a title can
# arrive as "TiO <sub>2</sub> -Containing Carbon" or wrapped in a <span style=...>.
# That markup would end up quoted verbatim in the agent's citations.
TAG_RE = re.compile(r"<[^>]+>")


def _clean(value):
    if not value:
        return None
    text = html.unescape(TAG_RE.sub("", str(value)))
    return re.sub(r"\s+", " ", text).strip() or None


def _year_from_date(raw):
    """Zotero stores dates as free text ('2023-04-11 2023-04-11', 'Spring 2019')."""
    if not raw:
        return None
    for token in str(raw).replace("-", " ").replace("/", " ").split():
        if len(token) == 4 and token.isdigit():
            year = int(token)
            if 1900 <= year <= 2100:
                return year
    return None


def _collection_paths(connection):
    """Map itemID -> the full paths of every collection it sits in.

    Zotero nests collections, and the useful filter is the top-level tree
    ("FITNESS", "CBCT ..."), so each path is returned as "Parent / Child".
    """
    collections = {row[0]: (row[1], row[2]) for row in connection.execute(
        "SELECT collectionID, collectionName, parentCollectionID FROM collections")}

    def full_path(collection_id):
        parts = []
        while collection_id and collection_id in collections:
            name, parent = collections[collection_id]
            parts.append(name)
            collection_id = parent
        return " / ".join(reversed(parts))

    paths = {}
    for item_id, collection_id in connection.execute(
            "SELECT itemID, collectionID FROM collectionItems"):
        paths.setdefault(item_id, []).append(full_path(collection_id))
    return paths


def keep_item(paths, excluded):
    """An item survives if it is unfiled, or sits in at least one collection
    outside the excluded trees. Filing a chemistry paper in a dental folder by
    mistake should not lose it, so one good home is enough."""
    if not paths:
        return True                      # unfiled: keep, judged by content later
    for path in paths:
        top = path.split(" / ")[0].strip()
        if top not in excluded:
            return True
    return False


def read_library(zotero_dir, require_pdf=True, require_text=False,
                 excluded_collections=()):
    """Yield one dict per Zotero item.

    require_pdf=True (default) keeps only items whose PDF is really on disk.
    Set it to False to audit the whole library, including entries whose
    attachment was never synced down.
    """
    connection, temp_path = _open_readonly(zotero_dir)
    storage_root = os.path.join(zotero_dir, "storage")
    try:
        connection.row_factory = sqlite3.Row

        # --- items of interest, excluding anything in the trash --------------
        rows = connection.execute("""
            SELECT i.itemID, i.key, it.typeName
            FROM   items i
            JOIN   itemTypes it ON it.itemTypeID = i.itemTypeID
            LEFT   JOIN deletedItems d ON d.itemID = i.itemID
            WHERE  d.itemID IS NULL
              AND  it.typeName IN ({})
        """.format(",".join("?" * len(INDEXABLE_TYPES))), INDEXABLE_TYPES).fetchall()

        # --- all field values in one pass, then grouped in Python ------------
        # One query for the whole library beats one query per item: with ~1600
        # articles the round trips dominate everything else.
        fields = {}
        for row in connection.execute("""
            SELECT id.itemID, f.fieldName, idv.value
            FROM   itemData id
            JOIN   fields f          ON f.fieldID  = id.fieldID
            JOIN   itemDataValues idv ON idv.valueID = id.valueID
        """):
            fields.setdefault(row[0], {})[row[1]] = row[2]

        creators = {}
        for row in connection.execute("""
            SELECT ic.itemID, c.firstName, c.lastName, ic.orderIndex, ct.creatorType
            FROM   itemCreators ic
            JOIN   creators c      ON c.creatorID = ic.creatorID
            JOIN   creatorTypes ct ON ct.creatorTypeID = ic.creatorTypeID
            ORDER  BY ic.itemID, ic.orderIndex
        """):
            if row[4] == "author":
                creators.setdefault(row[0], []).append(
                    {"given": row[1] or "", "family": row[2] or ""})

        collection_paths = _collection_paths(connection)
        excluded = set(excluded_collections)

        # --- PDF attachments, resolved against the filesystem ----------------
        # Two things are looked up per attachment: the PDF, and Zotero's own
        # extracted-text cache (.zotero-ft-cache). The cache only exists if the
        # PDF was once present on this machine, and for a RAG the text is what
        # matters - so an entry whose PDF was never synced down is still usable.
        attachments = {}
        text_caches = {}
        for row in connection.execute("""
            SELECT ia.parentItemID, ai.key, ia.path
            FROM   itemAttachments ia
            JOIN   items ai ON ai.itemID = ia.itemID
            WHERE  ia.contentType = 'application/pdf'
              AND  ia.parentItemID IS NOT NULL
        """):
            parent, key, path = row
            if not path or not path.startswith("storage:"):
                continue
            full = os.path.join(storage_root, key, path.split(":", 1)[1])
            # An item can have several PDFs; the first one that exists wins.
            if parent not in attachments or not attachments[parent][1]:
                attachments[parent] = (full, os.path.isfile(full))
            cache = os.path.join(storage_root, key, ".zotero-ft-cache")
            if parent not in text_caches and os.path.isfile(cache):
                text_caches[parent] = cache

        for row in rows:
            item_id = row["itemID"]
            data = fields.get(item_id, {})
            mapped = {}
            for zotero_field, our_field in FIELD_MAP.items():
                if zotero_field in data and our_field not in mapped:
                    mapped[our_field] = data[zotero_field]

            paths = collection_paths.get(item_id, [])
            if excluded and not keep_item(paths, excluded):
                continue

            pdf_path, pdf_exists = attachments.get(item_id, (None, False))
            text_cache = text_caches.get(item_id)
            if require_pdf and not pdf_exists:
                continue
            if require_text and not text_cache and not pdf_exists:
                continue

            authors = creators.get(item_id, [])
            yield {
                "zotero_key": row["key"],
                "item_type": row["typeName"],
                "title": _clean(mapped.get("title")),
                "doi": (mapped.get("doi") or "").strip() or None,
                "journal": _clean(mapped.get("journal")),
                "year": _year_from_date(mapped.get("date")),
                "authors": ", ".join(
                    " ".join(part for part in (a["given"], a["family"]) if part)
                    for a in authors) or None,
                "n_authors": len(authors),
                "pdf_path": pdf_path,
                "pdf_exists": pdf_exists,
                "text_cache": text_cache,
                "collections": paths,
                # CSL-JSON shaped, so it lands in csl_json like a Crossref record
                "csl": {
                    "type": "article-journal",
                    "title": _clean(mapped.get("title")),
                    "DOI": mapped.get("doi"),
                    "container-title": _clean(mapped.get("journal")),
                    "author": authors,
                    "issued": {"date-parts": [[_year_from_date(mapped.get("date"))]]},
                    "volume": mapped.get("volume"),
                    "page": mapped.get("pages"),
                    "issue": mapped.get("issue"),
                    "ISSN": mapped.get("issn"),
                    "abstract": _clean(mapped.get("abstract")),
                    "URL": mapped.get("url"),
                    "source": "Zotero",
                },
            }
    finally:
        connection.close()
        try:
            os.unlink(temp_path)
        except OSError:
            pass


def summarise(zotero_dir):
    """Counts for the audit report: how much of the library is actually usable."""
    total = with_pdf = 0
    for record in read_library(zotero_dir, require_pdf=False):
        total += 1
        if record["pdf_exists"]:
            with_pdf += 1
    return {"items": total, "con_pdf": with_pdf, "sin_pdf": total - with_pdf}
