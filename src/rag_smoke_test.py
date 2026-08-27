"""
ALCheMy RAG - end-to-end smoke test.

Answers one question: does the retrieval stack actually work?

It exercises the whole chain without touching n8n and without touching real
data: Ollama -> embeddings -> pgvector -> HNSW index -> lexical index -> the
rag_hybrid_search() function with Reciprocal Rank Fusion.

Everything it writes lives under a single throwaway document and is deleted at
the end, whatever happens.

    python src/rag_smoke_test.py
"""

import json
import os
import sys
from pathlib import Path

import psycopg2
import requests

REPO_ROOT = Path(__file__).resolve().parent.parent
OLLAMA = os.getenv("OLLAMA_URL", "http://localhost:11434")
MODEL = "bge-m3:latest"
EXPECTED_DIM = 1024
TEST_HASH = "00000000000000000000000000000000"

# Deliberately built so the two halves of the search disagree:
#  - chunk 3 is the only one that says "RS1884" but never says "porosity";
#  - chunk 1 talks about surface area without using the word "porosidad".
# A vector-only search misses the sample code; a keyword-only search misses the
# synonym. That is the whole argument for hybrid search, made concrete.
CHUNKS = [
    "La superficie especifica determinada por el metodo BET alcanza 1240 m2/g, "
    "con un volumen de microporo de 0.48 cm3/g medido por adsorcion de nitrogeno a 77 K.",

    "El difractograma de rayos X en polvo muestra reflexiones intensas a bajo angulo, "
    "indicativas de una estructura cristalina de alta ordenacion a largo alcance.",

    "La muestra RS1884 se sintetizo por via solvotermal a 120 grados durante 24 horas "
    "empleando acido formico como modulador de la cristalizacion.",

    "El analisis termogravimetrico revela una perdida de masa del 12 por ciento "
    "por debajo de 150 grados, atribuible a moleculas de disolvente ocluidas en los canales.",

    "El espectro infrarrojo presenta bandas de tension P-O entre 1000 y 1150 cm-1, "
    "confirmando la coordinacion del grupo fosfonato al centro metalico.",

    "La estabilidad quimica se evaluo sumergiendo el material en agua durante 72 horas, "
    "sin perdida apreciable de cristalinidad segun el difractograma posterior.",
]

QUERIES = [
    ("porosidad del material",
     "sinonimo puro: la palabra 'porosidad' NO aparece en ningun trozo. "
     "Solo la busqueda semantica puede resolverlo."),
    ("RS1884",
     "codigo exacto: para los vectores RS1883 y RS1884 son casi identicos. "
     "Solo la busqueda lexica lo distingue con seguridad."),
    ("estabilidad en agua del material poroso",
     "mezcla de ambas: aqui es donde el RRF suma consenso."),
]


def paso(nombre, ok, detalle=""):
    print("  [{}] {}{}".format("OK  " if ok else "FALLO", nombre,
                               "  -> " + detalle if detalle else ""))
    return ok


def embed(texts):
    """One call per text. Ollama's /api/embeddings takes a single prompt."""
    vectors = []
    for text in texts:
        response = requests.post("{}/api/embeddings".format(OLLAMA),
                                 json={"model": MODEL, "prompt": text}, timeout=120)
        response.raise_for_status()
        vectors.append(response.json()["embedding"])
    return vectors


def as_vector(values):
    """pgvector accepts the literal form '[0.1,0.2,...]'."""
    return "[" + ",".join(repr(float(v)) for v in values) + "]"


def load_env():
    path = REPO_ROOT / ".env"
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def main():
    print("=" * 74)
    print("PRUEBA DE FUNCIONAMIENTO DEL RAG")
    print("=" * 74)

    todo_ok = True

    # ---- 1. Ollama --------------------------------------------------------
    print("\n1. Motor de embeddings (Ollama, local)")
    try:
        tags = requests.get("{}/api/tags".format(OLLAMA), timeout=10).json()
        modelos = [m["name"] for m in tags.get("models", [])]
        todo_ok &= paso("Ollama responde en {}".format(OLLAMA), True,
                        "modelos: " + ", ".join(modelos))
        todo_ok &= paso("el modelo {} esta descargado".format(MODEL), MODEL in modelos)
    except Exception as error:                              # noqa: BLE001
        return 1 if not paso("Ollama responde", False, str(error)) else 0

    # ---- 2. dimension ------------------------------------------------------
    print("\n2. Dimension del vector (debe coincidir con VECTOR(1024) de la tabla)")
    vectors = embed([CHUNKS[0]])
    dim = len(vectors[0])
    todo_ok &= paso("el modelo devuelve {} dimensiones".format(dim), dim == EXPECTED_DIM,
                    "esperadas {}".format(EXPECTED_DIM))
    if dim != EXPECTED_DIM:
        print("\n   PARA. Cambiar de modelo obliga a recrear rag_chunks entera.")
        return 1

    # ---- 3. base de datos --------------------------------------------------
    print("\n3. Base de datos")
    load_env()
    connection = psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=os.getenv("POSTGRES_PORT", "5432"),
        dbname=os.environ["POSTGRES_DB"],
        user=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"])
    cursor = connection.cursor()
    cursor.execute("SELECT extname FROM pg_extension WHERE extname = 'vector';")
    todo_ok &= paso("la extension pgvector esta instalada", cursor.fetchone() is not None)
    cursor.execute("""SELECT indexname FROM pg_indexes
                      WHERE tablename = 'rag_chunks'
                        AND indexname IN ('idx_rag_chunks_embedding_hnsw',
                                          'idx_rag_chunks_tsv');""")
    indices = {r[0] for r in cursor.fetchall()}
    todo_ok &= paso("indice vectorial HNSW", "idx_rag_chunks_embedding_hnsw" in indices)
    todo_ok &= paso("indice lexico GIN", "idx_rag_chunks_tsv" in indices)

    # ---- 4. insertar el documento de prueba --------------------------------
    print("\n4. Insertando {} trozos de prueba".format(len(CHUNKS)))
    try:
        cursor.execute("""
            INSERT INTO rag_documents (file_name, file_path, file_hash, doc_type,
                                       title, sensitivity, metadata_source)
            VALUES ('__smoke_test__', '/tmp/__smoke_test__', %s, 'TEST',
                    'Documento de prueba', 'INTERNAL', 'MANUAL')
            ON CONFLICT (file_hash) DO UPDATE SET title = EXCLUDED.title
            RETURNING document_id;""", (TEST_HASH,))
        doc_id = cursor.fetchone()[0]
        cursor.execute("DELETE FROM rag_chunks WHERE document_id = %s;", (doc_id,))

        for text, vector in zip(CHUNKS, embed(CHUNKS)):
            cursor.execute("""
                INSERT INTO rag_chunks (document_id, text, metadata, embedding)
                VALUES (%s, %s, %s, %s::vector);""",
                           (doc_id, text, json.dumps({"smoke_test": True}),
                            as_vector(vector)))
        connection.commit()
        todo_ok &= paso("trozos insertados y vectorizados", True,
                        "document_id={}".format(doc_id))

        # ---- 5. las tres busquedas -----------------------------------------
        print("\n5. Busqueda hibrida (RRF). Se muestra el trozo mejor clasificado.")
        for pregunta, porque in QUERIES:
            vector = as_vector(embed([pregunta])[0])
            cursor.execute("""
                SELECT text, rrf_score FROM rag_hybrid_search(%s, %s::vector, 3, 60);""",
                           (pregunta, vector))
            resultados = cursor.fetchall()
            print("\n   Pregunta: \"{}\"".format(pregunta))
            print("   {}".format(porque))
            if not resultados:
                todo_ok &= paso("devuelve resultados", False)
                continue
            for posicion, (texto, score) in enumerate(resultados, 1):
                print("     {}. [{:.5f}] {}".format(posicion, score, texto[:88]))
            todo_ok &= paso("devuelve resultados ordenados", True)

    finally:
        # ---- 6. limpieza ---------------------------------------------------
        print("\n6. Limpieza")
        cursor.execute("DELETE FROM rag_documents WHERE file_hash = %s;", (TEST_HASH,))
        connection.commit()
        cursor.execute("SELECT count(*) FROM rag_chunks;")
        restantes = cursor.fetchone()[0]
        paso("documento de prueba eliminado (rag_chunks quedan: {})".format(restantes), True)
        cursor.close()
        connection.close()

    print("\n" + "=" * 74)
    print("RESULTADO: " + ("TODO CORRECTO" if todo_ok else "HAY ALGO QUE FALLA"))
    print("=" * 74)
    return 0 if todo_ok else 1


if __name__ == "__main__":
    sys.exit(main())
