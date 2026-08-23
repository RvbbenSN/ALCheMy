-- =============================================================================
--  ALCheMy - Busqueda de empleo asistida : capa de registro
-- =============================================================================
--  QUE ES ESTE FICHERO
--  -------------------
--  init_db.sql solo se ejecuta la PRIMERA vez que se crea el volumen postgres_data.
--  Como la base de datos ya existe, este DDL se aplica A MANO:
--
--      docker exec -i alchemy_postgres psql -U alchemy_user -d alchemy_db \
--          < scripts/ddl_job_search.sql
--
--  (o pegandolo en pgAdmin). Es idempotente: se puede lanzar varias veces.
--
--  QUE HACE EL FLUJO QUE ESCRIBE AQUI (workflow n8n "Busqueda de Empleo Asistida")
--  ---------------------------------------------------------------------------
--  1. Un Email Trigger (IMAP) lee las alertas de empleo que ya llegan al correo
--     (LinkedIn, InfoJobs, Indeed...). NO se conecta a LinkedIn ni ningun portal:
--     leer el correo propio no infringe ningun termino de servicio de terceros.
--  2. Un agente IA extrae las ofertas de cada correo (un digest puede traer varias).
--  3. Un segundo agente compara cada oferta con el perfil de Ruben y le pone una
--     nota de encaje (fit_score).
--  4. Si el encaje es alto, un tercer agente redacta un borrador de CV adaptado
--     y una carta de presentacion.
--  5. TODO se guarda aqui, en estado PENDIENTE_REVISION, y se envia un correo de
--     aviso. El sistema NUNCA aplica por Ruben ni toca LinkedIn de forma
--     automatizada: el envio final es siempre una accion humana. Mismo patron
--     HITL que el resto de ALCheMy (ver audit_log en init_db.sql).
--
--  ANTI-DUPLICADOS EN DOS NIVELES
--  El Email Trigger (IMAP) marca cada correo como leido tras procesarlo, asi
--  que el MISMO correo no se vuelve a procesar (equivalente al hash MD5 de
--  characterization_measurements, pero a nivel de correo). Un correo puede
--  traer VARIAS ofertas, así que el filtro por fila usa job_url, no el correo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. job_leads : un registro por OFERTA detectada
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS job_leads (
    lead_id           BIGSERIAL   PRIMARY KEY,

    -- De donde vino la oferta
    source_email_id   TEXT,                        -- Message-ID del correo de origen, anti-duplicado
    source_portal     TEXT,                        -- LinkedIn | InfoJobs | Indeed | Glassdoor | Otro

    -- La oferta en si
    job_title         TEXT        NOT NULL,
    company_name      TEXT,
    location_text     TEXT,
    job_url           TEXT,
    job_description   TEXT,                        -- texto crudo extraido del correo

    -- Evaluacion del agente
    fit_score         INTEGER     CHECK (fit_score BETWEEN 0 AND 100),
    fit_reasoning     TEXT,                         -- por que el agente dio esa nota
    recommendation    TEXT        CHECK (recommendation IN ('SI', 'QUIZA', 'NO')),

    -- Borradores generados (solo si recommendation != 'NO')
    cv_draft          TEXT,
    cover_letter_draft TEXT,

    -- Estado de revision humana. Escrito SIEMPRE por Ruben o por codigo
    -- deterministico, nunca por el LLM directamente (mismo principio que
    -- audit_log en el resto del proyecto).
    status            TEXT        NOT NULL DEFAULT 'PENDIENTE_REVISION'
                      CHECK (status IN (
                          'PENDIENTE_REVISION',   -- agente lo dejo listo, esperando a Ruben
                          'DESCARTADA',            -- fit_score bajo, no se genero borrador
                          'APLICADA',              -- Ruben la envio manualmente
                          'RECHAZADA_POR_RUBEN'    -- Ruben la revisó y decidió no aplicar
                      )),
    reviewed_at       TIMESTAMPTZ,

    created_at        TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE  job_leads                IS 'Una fila por oferta de empleo detectada en las alertas de correo. El envio final es siempre manual.';
COMMENT ON COLUMN job_leads.source_email_id IS 'Message-ID del correo de origen (un correo puede contener varias ofertas).';
COMMENT ON COLUMN job_leads.fit_score       IS 'Nota 0-100 del agente evaluador, comparando la oferta con el perfil de Ruben.';
COMMENT ON COLUMN job_leads.status          IS 'PENDIENTE_REVISION es el unico estado que escribe el flujo automatico. Los demas los cambia Ruben.';

-- Anti-duplicado a nivel de OFERTA (un correo puede traer varias): mismo job_url
-- no se vuelve a insertar. NULL se permite sin restriccion (ofertas sin URL util).
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_leads_job_url
    ON job_leads (job_url) WHERE job_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_job_leads_status
    ON job_leads (status);

CREATE INDEX IF NOT EXISTS idx_job_leads_created_at
    ON job_leads (created_at DESC);
