-- =============================================================================
--  ALCheMy - RAG Fase A : capa documental
-- =============================================================================
--  QUE ES ESTE FICHERO
--  -------------------
--  init_db.sql solo se ejecuta la PRIMERA vez que se crea el volumen postgres_data.
--  Como la base de datos ya existe y tiene datos, este DDL se aplica A MANO:
--
--      docker exec -i alchemy_postgres psql -U alchemy_user -d alchemy_db \
--          < scripts/ddl_rag_phase_a.sql
--
--  (o pegandolo en pgAdmin). Es idempotente: se puede lanzar varias veces.
--
--  DECISION IRREVERSIBLE GRABADA AQUI
--  ----------------------------------
--  VECTOR(1024) = dimension del modelo bge-m3 servido por Ollama.
--  Un embedding es una lista de numeros de longitud FIJA que representa el
--  "significado" de un texto. Cada modelo produce una longitud distinta:
--      nomic-embed-text ......  768
--      bge-m3 ................ 1024   <-- el nuestro
--      text-embedding-3-small  1536
--  Si algun dia se cambia de modelo, hay que DROP + CREATE + re-indexar todo.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- -----------------------------------------------------------------------------
-- 1. rag_documents : un registro por FICHERO fuente (el paper, el protocolo...)
-- -----------------------------------------------------------------------------
--    No guarda vectores. Es la "ficha bibliografica": sirve para citar la fuente
--    en la respuesta del agente y para no re-indexar dos veces el mismo PDF
--    (por eso el hash MD5 es UNIQUE, misma tecnica anti-duplicados que usamos
--    ya en characterization_measurements).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rag_documents (
    document_id   BIGSERIAL   PRIMARY KEY,
    file_name     TEXT        NOT NULL,
    file_path     TEXT        NOT NULL,
    file_hash     CHAR(32)    UNIQUE,          -- MD5 del binario = puerta anti-duplicado
    doc_type      TEXT,                        -- PAPER | PROTOCOL | LAB_NOTEBOOK | THESIS | SOP
    title         TEXT,
    authors       TEXT,
    year          INTEGER,
    doi           TEXT,
    -- Marca de confidencialidad. INTERNAL = no puede salir a un LLM externo sin
    -- pasar antes por el paso de pseudonimizacion de ligandos (ver CLAUDE.md).
    sensitivity   TEXT        NOT NULL DEFAULT 'INTERNAL'
                  CHECK (sensitivity IN ('PUBLIC', 'INTERNAL', 'RESTRICTED')),
    n_chunks      INTEGER     DEFAULT 0,
    indexed_at    TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE  rag_documents            IS 'Un registro por fichero fuente indexado en el RAG. No contiene vectores.';
COMMENT ON COLUMN rag_documents.file_hash  IS 'MD5 del binario. UNIQUE: impide indexar dos veces el mismo fichero.';
COMMENT ON COLUMN rag_documents.sensitivity IS 'PUBLIC=paper publicado; INTERNAL=material del laboratorio; RESTRICTED=no sale nunca de la maquina.';

-- -----------------------------------------------------------------------------
-- 2. rag_chunks : un registro por TROZO de texto + su vector
-- -----------------------------------------------------------------------------
--    ATENCION a los nombres de columna: el nodo "Postgres PGVector Store" de n8n
--    usa por debajo LangChain, que espera exactamente estos cuatro nombres:
--        id / text / metadata / embedding
--    Si se renombran, hay que ajustar options.columnNames en el nodo.
--    Las columnas extra (document_id, text_tsv, created_at) no le molestan.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rag_chunks (
    id          BIGSERIAL   PRIMARY KEY,
    document_id BIGINT      REFERENCES rag_documents(document_id) ON DELETE CASCADE,
    text        TEXT        NOT NULL,
    metadata    JSONB       NOT NULL DEFAULT '{}'::jsonb,
    embedding   VECTOR(1024),                  -- <-- bge-m3. NO tocar sin re-indexar.

    -- Columna generada: Postgres la recalcula sola cada vez que cambia "text".
    -- Es la representacion LEXICA del trozo (que palabras exactas contiene),
    -- complementaria al vector (que SIGNIFICA el trozo).
    -- Configuracion 'simple' a proposito: NO aplica stemming. Con 'spanish',
    -- Postgres recortaria terminos quimicos y nombres de ligandos hasta hacerlos
    -- irreconocibles. Aqui interesa la coincidencia literal.
    text_tsv    TSVECTOR    GENERATED ALWAYS AS (to_tsvector('simple', coalesce(text, ''))) STORED,

    created_at  TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE  rag_chunks           IS 'Trozos de texto vectorizados. Columnas id/text/metadata/embedding impuestas por LangChain.';
COMMENT ON COLUMN rag_chunks.embedding IS 'Vector bge-m3 de 1024 dimensiones generado por Ollama en local.';
COMMENT ON COLUMN rag_chunks.text_tsv  IS 'Indice lexico (BM25/tsquery) para la mitad no-semantica de la busqueda hibrida.';

-- -----------------------------------------------------------------------------
-- 3. Indices
-- -----------------------------------------------------------------------------
-- HNSW = el indice de vecinos aproximados recomendado por pgvector.
-- vector_cosine_ops porque LangChain compara por distancia coseno.
-- Sin este indice la busqueda funciona igual, pero recorriendo la tabla entera.
CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding_hnsw
    ON rag_chunks USING hnsw (embedding vector_cosine_ops);

-- GIN sobre el tsvector = el indice clasico de busqueda de texto completo.
CREATE INDEX IF NOT EXISTS idx_rag_chunks_tsv
    ON rag_chunks USING gin (text_tsv);

-- GIN sobre el JSONB para poder filtrar por metadatos (tecnica, tipo de doc...).
CREATE INDEX IF NOT EXISTS idx_rag_chunks_metadata
    ON rag_chunks USING gin (metadata);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_document_id
    ON rag_chunks (document_id);

-- -----------------------------------------------------------------------------
-- 4. Busqueda hibrida con Reciprocal Rank Fusion (RRF)
-- -----------------------------------------------------------------------------
--  EL PROBLEMA
--  Buscar solo por vector falla con codigos y formulas: "RS1883" y "RS1884" son
--  casi el mismo vector, pero son muestras distintas.
--  Buscar solo por palabras falla con sinonimos: preguntar por "porosidad" no
--  encuentra un parrafo que hable de "area superficial BET".
--
--  LA SOLUCION
--  Lanzar las dos busquedas por separado, quedarse con el PUESTO (rank) que cada
--  trozo ocupa en cada lista, y sumar 1/(k + puesto). Un trozo que sale 3o en
--  ambas listas gana a uno que sale 1o en una y no aparece en la otra.
--  No se mezclan las puntuaciones (son escalas incomparables), solo los puestos.
--  k=60 es el valor estandar del paper original de RRF.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rag_hybrid_search(
    query_text      TEXT,
    query_embedding VECTOR(1024),
    match_count     INTEGER DEFAULT 8,
    rrf_k           INTEGER DEFAULT 60
)
RETURNS TABLE (
    chunk_id   BIGINT,
    text       TEXT,
    metadata   JSONB,
    file_name  TEXT,
    rrf_score  DOUBLE PRECISION
)
LANGUAGE sql STABLE
AS $$
WITH semantica AS (
    SELECT c.id,
           ROW_NUMBER() OVER (ORDER BY c.embedding <=> query_embedding) AS puesto
    FROM   rag_chunks c
    WHERE  c.embedding IS NOT NULL
    ORDER  BY c.embedding <=> query_embedding
    LIMIT  match_count * 5
),
lexica AS (
    SELECT c.id,
           ROW_NUMBER() OVER (
               ORDER BY ts_rank_cd(c.text_tsv, plainto_tsquery('simple', query_text)) DESC
           ) AS puesto
    FROM   rag_chunks c
    WHERE  c.text_tsv @@ plainto_tsquery('simple', query_text)
    LIMIT  match_count * 5
)
SELECT c.id,
       c.text,
       c.metadata,
       d.file_name,
       COALESCE(1.0 / (rrf_k + s.puesto), 0.0)
     + COALESCE(1.0 / (rrf_k + l.puesto), 0.0) AS rrf_score
FROM        rag_chunks    c
LEFT  JOIN  semantica     s ON s.id = c.id
LEFT  JOIN  lexica        l ON l.id = c.id
LEFT  JOIN  rag_documents d ON d.document_id = c.document_id
WHERE  s.id IS NOT NULL OR l.id IS NOT NULL
ORDER  BY rrf_score DESC
LIMIT  match_count;
$$;

COMMENT ON FUNCTION rag_hybrid_search IS
  'Busqueda hibrida vector+lexica fusionada por Reciprocal Rank Fusion (k=60).';

-- -----------------------------------------------------------------------------
-- 5. Vista de solo lectura para la herramienta SQL del agente
-- -----------------------------------------------------------------------------
--  El agente NUNCA debe poder escribir. Esta vista aplana el JSONB de las
--  medidas para que una consulta generada por el LLM sea simple y dificil de
--  romper. La regla dura del roadmap sigue en pie: los datos estructurados
--  NO se vectorizan; se consultan con SQL.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_agente_muestras AS
SELECT  s.sample_code,
        s.synthesis_date,
        s.researcher_name,
        s.metal_center,
        s.linker,
        COUNT(DISTINCT m.technique)                       AS n_tecnicas,
        ARRAY_AGG(DISTINCT m.technique)
            FILTER (WHERE m.technique IS NOT NULL)        AS tecnicas
FROM        synthesis_experiments        s
LEFT  JOIN  characterization_measurements m ON m.sample_code = s.sample_code
GROUP BY    s.sample_code, s.synthesis_date, s.researcher_name,
            s.metal_center, s.linker;

COMMENT ON VIEW v_agente_muestras IS
  'Vista de solo lectura para el agente RAG. n_tecnicas es la etiqueta debil de interes experimental.';
