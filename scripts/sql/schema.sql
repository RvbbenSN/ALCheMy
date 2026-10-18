--
--  ALCheMy - esquema de la base de datos
--  ======================================
--
--  GENERADO, NO ESCRITO A MANO.  2026-10-18
--
--  Este fichero es la fotografia del esquema tal y como esta hoy en la base
--  viva. Se produce con:
--
--      python scripts/build_schema_sql.py
--
--  Si quiere saber COMO es la base ahora, lea esto. Si quiere saber COMO SE
--  LLEGO hasta aqui, lea scripts/sql/migrations/, que guarda cada migracion
--  fechada y en orden. Y si va a crear la base desde cero, el que se ejecuta
--  es scripts/sql/init_db.sql, que es el que Docker monta.
--
--  No lo edite: el siguiente volcado se lo lleva por delante. Para cambiar el
--  esquema se escribe una migracion nueva, se aplica, y se regenera esto.
--
--  Saneado: los correos, los nombres de ligando sin publicar y los codigos de
--  muestra se sustituyen antes de escribir, porque este fichero se publica y
--  el volcado crudo los lleva dentro (en DEFAULT de columnas, en comentarios y
--  en mensajes de error de las funciones).
--

--
-- PostgreSQL database dump
--


-- Dumped from database version 16.14 (Debian 16.14-1.pgdg12+1)
-- Dumped by pg_dump version 16.14 (Debian 16.14-1.pgdg12+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


--
-- Name: agent_audit(text, text, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agent_audit(p_actor text, p_session text, p_action text, p_detail text, p_rows integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
    INSERT INTO audit_log (agent, action, recipients, verdict, cause, result,
                           actor_email, session_id)
    VALUES ('ALCheMy-RAG-Agent', p_action, p_rows, 'ALLOWED', p_detail,
            format('%s rows returned', COALESCE(p_rows, 0)),
            lower(nullif(trim(coalesce(p_actor,'')),'')), p_session);
END;
$$;


--
-- Name: agent_authorise(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agent_authorise(p_email text, p_session text DEFAULT NULL::text) RETURNS TABLE(allowed boolean, researcher_name text, role text, reason text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_row  authorized_researchers%ROWTYPE;
    v_mail TEXT := lower(trim(COALESCE(p_email, '')));
BEGIN
    SELECT * INTO v_row FROM authorized_researchers a
     WHERE lower(a.email) = v_mail;

    IF v_mail = '' THEN
        allowed := FALSE; researcher_name := NULL; role := NULL;
        reason := 'No identity supplied';
    ELSIF NOT FOUND THEN
        allowed := FALSE; researcher_name := NULL; role := NULL;
        reason := format('%s is not on the researcher whitelist', v_mail);
    ELSIF NOT COALESCE(v_row.active, FALSE) THEN
        allowed := FALSE; researcher_name := v_row.researcher_name; role := v_row.role;
        reason := format('%s is on the whitelist but deactivated', v_mail);
    ELSE
        allowed := TRUE; researcher_name := v_row.researcher_name; role := v_row.role;
        reason := 'Authorised';
        UPDATE authorized_researchers a SET last_seen = now()
         WHERE lower(a.email) = v_mail;
    END IF;

    INSERT INTO audit_log (agent, action, verdict, cause, result, actor_email, session_id)
    VALUES ('ALCheMy-RAG-Agent', 'AUTHORISE',
            CASE WHEN allowed THEN 'ALLOWED' ELSE 'DENIED' END,
            reason, COALESCE(researcher_name, 'unknown'), v_mail, p_session);

    RETURN NEXT;
END;
$$;


--
-- Name: FUNCTION agent_authorise(p_email text, p_session text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.agent_authorise(p_email text, p_session text) IS 'Checks an email against authorized_researchers and records the attempt. Accountability, not authentication: the email is a claim made by the caller.';


--
-- Name: agent_explore_graph(text, text, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agent_explore_graph(p_actor text DEFAULT NULL::text, p_session text DEFAULT NULL::text, p_node_id text DEFAULT NULL::text, p_hops integer DEFAULT 2, p_limit integer DEFAULT 30) RETURNS TABLE(hop integer, node_id text, node_type text, label text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_hops INTEGER := LEAST(GREATEST(COALESCE(p_hops, 2), 1), 3);
        v_limit INTEGER := agent_row_limit(p_limit); v_rows INTEGER;
BEGIN
    IF p_node_id IS NULL OR NOT EXISTS (SELECT 1 FROM kg_nodes WHERE kg_nodes.node_id = p_node_id) THEN
        RAISE EXCEPTION 'Unknown node_id: %. Call find_graph_node first to get a valid one (e.g. SAMPLE:SMP-0001).', p_node_id;
    END IF;

    -- Sin LIMIT aqui, un nodo con mucha "fanout" (p.ej. METAL:Ca, con 538
    -- muestras) puede devolver miles de filas: exactamente el problema que el
    -- resto del catalogo evita con agent_row_limit. Los mas cercanos (hop mas
    -- bajo) van primero, asi que el corte pierde lo mas lejano, no lo mas
    -- relevante.
    RETURN QUERY SELECT * FROM kg_neighbors(p_node_id, v_hops) LIMIT v_limit;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    PERFORM agent_audit(p_actor, p_session, 'explore_graph',
        format('node_id=%s hops=%s limit=%s', p_node_id, v_hops, v_limit), v_rows);
END;
$$;


--
-- Name: FUNCTION agent_explore_graph(p_actor text, p_session text, p_node_id text, p_hops integer, p_limit integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.agent_explore_graph(p_actor text, p_session text, p_node_id text, p_hops integer, p_limit integer) IS 'Recorrido del grafo de conocimiento en hasta 3 saltos desde un node_id ya conocido. p_hops se acota a [1,3], p_limit a [1,200] (por defecto 30) porque un nodo muy conectado (un metal comun) puede tener cientos de vecinos.';


--
-- Name: agent_find_graph_node(text, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agent_find_graph_node(p_actor text DEFAULT NULL::text, p_session text DEFAULT NULL::text, p_query text DEFAULT NULL::text, p_limit integer DEFAULT 20) RETURNS TABLE(node_id text, node_type text, label text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_limit INTEGER := agent_row_limit(p_limit); v_rows INTEGER;
BEGIN
    IF p_query IS NULL OR trim(p_query) = '' THEN
        RAISE EXCEPTION 'query is required (a sample code, ligand, metal or modulator name to search for)';
    END IF;

    RETURN QUERY
    SELECT n.node_id, n.node_type, n.label
    FROM   kg_nodes n
    WHERE  n.label ILIKE '%' || p_query || '%'
    ORDER  BY n.node_type, n.label
    LIMIT  v_limit;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    PERFORM agent_audit(p_actor, p_session, 'find_graph_node', format('query=%s', p_query), v_rows);
END;
$$;


--
-- Name: FUNCTION agent_find_graph_node(p_actor text, p_session text, p_query text, p_limit integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.agent_find_graph_node(p_actor text, p_session text, p_query text, p_limit integer) IS 'Primer paso obligatorio antes de explore_graph: busca el node_id exacto (p.ej. SAMPLE:SMP-0001) a partir de un texto libre.';


--
-- Name: agent_get_characterisation(text, text, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agent_get_characterisation(p_actor text DEFAULT NULL::text, p_session text DEFAULT NULL::text, p_sample_code text DEFAULT NULL::text, p_technique text DEFAULT NULL::text, p_limit integer DEFAULT 20) RETURNS TABLE(sample_code character varying, technique character varying, measurement_tag character varying, instrument_name character varying, operator_name character varying, file_name character varying, measured_at timestamp with time zone, data_fields text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_limit INTEGER := agent_row_limit(p_limit); v_rows INTEGER;
BEGIN
    RETURN QUERY
    SELECT m.sample_code, m.technique, m.measurement_tag, m.instrument_name,
           m.operator_name, m.file_name, m.created_at,
           (SELECT string_agg(k, ', ' ORDER BY k)
              FROM jsonb_object_keys(COALESCE(m.data_json->'header_metadata','{}'::jsonb)) AS k)
    FROM   characterization_measurements m
    WHERE  m.sample_code = p_sample_code
      AND  (p_technique IS NULL OR m.technique ILIKE p_technique)
    ORDER  BY m.technique, m.created_at DESC
    LIMIT  v_limit;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    PERFORM agent_audit(p_actor, p_session, 'get_characterisation',
        format('sample_code=%s technique=%s', p_sample_code, p_technique), v_rows);
END;
$$;


--
-- Name: agent_get_characterisation(text, text, text, text, integer, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agent_get_characterisation(p_actor text DEFAULT NULL::text, p_session text DEFAULT NULL::text, p_sample_code text DEFAULT NULL::text, p_technique text DEFAULT NULL::text, p_limit integer DEFAULT 20, p_is_owner boolean DEFAULT false) RETURNS TABLE(sample_code character varying, technique character varying, measurement_tag character varying, instrument_name character varying, operator_name character varying, file_name character varying, measured_at timestamp with time zone, data_fields text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_limit INTEGER := agent_row_limit(p_limit); v_rows INTEGER;
BEGIN
    RETURN QUERY
    SELECT m.sample_code, m.technique, m.measurement_tag, m.instrument_name,
           CASE WHEN p_is_owner THEN m.operator_name ELSE NULL END,
           m.file_name, m.created_at,
           (SELECT string_agg(k, ', ' ORDER BY k)
              FROM jsonb_object_keys(COALESCE(m.data_json->'header_metadata','{}'::jsonb)) AS k)
    FROM   characterization_measurements m
    WHERE  m.sample_code = p_sample_code
      AND  (p_technique IS NULL OR m.technique ILIKE p_technique)
    ORDER  BY m.technique, m.created_at DESC
    LIMIT  v_limit;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    PERFORM agent_audit(p_actor, p_session, 'get_characterisation',
        format('sample_code=%s technique=%s is_owner=%s', p_sample_code, p_technique, p_is_owner), v_rows);
END;
$$;


--
-- Name: agent_log_exchange(text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agent_log_exchange(p_session text, p_actor text, p_question text, p_answer text, p_verdict text DEFAULT 'ALLOWED'::text, p_cause text DEFAULT NULL::text) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_id BIGINT;
BEGIN
    INSERT INTO agent_chat_log (session_id, actor_email, question, answer, verdict, cause)
    VALUES (p_session, lower(nullif(trim(coalesce(p_actor,'')),'')),
            p_question, p_answer, COALESCE(p_verdict,'ALLOWED'), p_cause)
    RETURNING chat_id INTO v_id;
    RETURN v_id;
END;
$$;


--
-- Name: FUNCTION agent_log_exchange(p_session text, p_actor text, p_question text, p_answer text, p_verdict text, p_cause text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.agent_log_exchange(p_session text, p_actor text, p_question text, p_answer text, p_verdict text, p_cause text) IS 'Writes one question/answer pair into agent_chat_log.';


--
-- Name: agent_row_limit(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agent_row_limit(p_limit integer) RETURNS integer
    LANGUAGE sql IMMUTABLE
    AS $$
    SELECT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 200);
$$;


--
-- Name: agent_sample_summary(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agent_sample_summary(p_actor text DEFAULT NULL::text, p_session text DEFAULT NULL::text, p_sample_code text DEFAULT NULL::text) RETURNS TABLE(field text, value text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_rows INTEGER;
BEGIN
    RETURN QUERY
    SELECT j.key, j.value #>> '{}'
    FROM   synthesis_experiments s, jsonb_each(to_jsonb(s)) AS j
    WHERE  s.sample_code = p_sample_code
      AND  j.value <> 'null'::jsonb
      AND  j.key NOT IN ('file_hash_md5', 'created_at', 'updated_at')
    ORDER  BY j.key;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    PERFORM agent_audit(p_actor, p_session, 'sample_summary',
        format('sample_code=%s', p_sample_code), v_rows);
END;
$$;


--
-- Name: agent_sample_summary(text, text, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agent_sample_summary(p_actor text DEFAULT NULL::text, p_session text DEFAULT NULL::text, p_sample_code text DEFAULT NULL::text, p_is_owner boolean DEFAULT false) RETURNS TABLE(field text, value text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_rows INTEGER;
    -- Exact recipe/process numbers: masses, concentrations, mmol, volumes,
    -- ratios, temperatures, times. Never shown unless p_is_owner.
    v_restricted TEXT[] := ARRAY[
        'metal_conc_m','lm_ratio','metal_mass_mg','linker_mass_mg',
        'secondary_linker_mg','reactor_volume_ml','h2o_pure_ml','h2o_total_ml',
        'meoh_ml','etoh_ml','proh_1_ml','dmf_ml','def_ml','total_volume_ml',
        'temp_initial_c','heating_time_hours','heating_rate_c_min',
        'temp_target_c','time_hours','cooling_time_hours','cooling_rate_c_min',
        'temp_final_c','hcl_active_mmol','hf_active_mmol','koh_active_mmol',
        'formic_acid_mmol','acetic_acid_mmol','propionic_acid_mmol','tfa_mmol',
        'cf3so3h_mmol','triethylamine_mmol','meo3s_mmol','researcher_name'
    ];
BEGIN
    RETURN QUERY
    SELECT j.key, j.value #>> '{}'
    FROM   synthesis_experiments s, jsonb_each(to_jsonb(s)) AS j
    WHERE  s.sample_code = p_sample_code
      AND  j.value <> 'null'::jsonb
      AND  j.key NOT IN ('file_hash_md5', 'created_at', 'updated_at')
      AND  (p_is_owner OR NOT (j.key = ANY(v_restricted)))
    ORDER  BY j.key;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    PERFORM agent_audit(p_actor, p_session, 'sample_summary',
        format('sample_code=%s is_owner=%s', p_sample_code, p_is_owner), v_rows);
END;
$$;


--
-- Name: agent_search_library(text, text, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agent_search_library(p_actor text DEFAULT NULL::text, p_session text DEFAULT NULL::text, p_text text DEFAULT NULL::text, p_year integer DEFAULT NULL::integer, p_limit integer DEFAULT 20) RETURNS TABLE(document_id bigint, citation text, doi text, n_chunks integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_limit INTEGER := agent_row_limit(p_limit); v_rows INTEGER;
BEGIN
    RETURN QUERY
    SELECT b.document_id, b.cita, b.doi, b.n_chunks
    FROM   v_rag_library b
    WHERE  (p_text IS NULL
            OR b.title ILIKE '%' || p_text || '%'
            OR b.authors ILIKE '%' || p_text || '%'
            OR b.journal ILIKE '%' || p_text || '%')
      AND  (p_year IS NULL OR b.year = p_year)
      AND  b.sensitivity = 'PUBLIC'
    ORDER  BY b.year DESC NULLS LAST
    LIMIT  v_limit;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    PERFORM agent_audit(p_actor, p_session, 'search_library',
        format('text=%s year=%s', p_text, p_year), v_rows);
END;
$$;


--
-- Name: agent_search_synthesis(text, text, text, text, numeric, numeric, date, date, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agent_search_synthesis(p_actor text DEFAULT NULL::text, p_session text DEFAULT NULL::text, p_metal text DEFAULT NULL::text, p_linker text DEFAULT NULL::text, p_temp_min numeric DEFAULT NULL::numeric, p_temp_max numeric DEFAULT NULL::numeric, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_limit integer DEFAULT 20) RETURNS TABLE(sample_code character varying, synthesis_date date, metal_center character varying, linker character varying, temp_target_c numeric, time_hours numeric, lm_ratio numeric, n_techniques bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_limit INTEGER := agent_row_limit(p_limit); v_rows INTEGER;
BEGIN
    RETURN QUERY
    SELECT s.sample_code, s.synthesis_date, s.metal_center, s.linker,
           s.temp_target_c, s.time_hours, s.lm_ratio,
           (SELECT count(DISTINCT m.technique) FROM characterization_measurements m
             WHERE m.sample_code = s.sample_code)
    FROM   synthesis_experiments s
    WHERE  (p_metal    IS NULL OR s.metal_center ILIKE p_metal)
      AND  (p_linker   IS NULL OR s.linker ILIKE '%' || p_linker || '%')
      AND  (p_temp_min IS NULL OR s.temp_target_c >= p_temp_min)
      AND  (p_temp_max IS NULL OR s.temp_target_c <= p_temp_max)
      AND  (p_from     IS NULL OR s.synthesis_date >= p_from)
      AND  (p_to       IS NULL OR s.synthesis_date <= p_to)
    ORDER  BY s.synthesis_date DESC NULLS LAST, s.sample_code
    LIMIT  v_limit;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    PERFORM agent_audit(p_actor, p_session, 'search_synthesis',
        format('metal=%s linker=%s temp=[%s,%s] date=[%s,%s] limit=%s',
               p_metal, p_linker, p_temp_min, p_temp_max, p_from, p_to, v_limit), v_rows);
END;
$$;


--
-- Name: agent_search_synthesis(text, text, text, text, numeric, numeric, date, date, integer, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agent_search_synthesis(p_actor text DEFAULT NULL::text, p_session text DEFAULT NULL::text, p_metal text DEFAULT NULL::text, p_linker text DEFAULT NULL::text, p_temp_min numeric DEFAULT NULL::numeric, p_temp_max numeric DEFAULT NULL::numeric, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_limit integer DEFAULT 20, p_is_owner boolean DEFAULT false) RETURNS TABLE(sample_code character varying, synthesis_date date, metal_center character varying, linker character varying, temp_target_c numeric, time_hours numeric, lm_ratio numeric, n_techniques bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_limit INTEGER := agent_row_limit(p_limit); v_rows INTEGER;
BEGIN
    RETURN QUERY
    SELECT s.sample_code, s.synthesis_date, s.metal_center, s.linker,
           CASE WHEN p_is_owner THEN s.temp_target_c ELSE NULL END,
           CASE WHEN p_is_owner THEN s.time_hours ELSE NULL END,
           CASE WHEN p_is_owner THEN s.lm_ratio ELSE NULL END,
           (SELECT count(DISTINCT m.technique) FROM characterization_measurements m
             WHERE m.sample_code = s.sample_code)
    FROM   synthesis_experiments s
    WHERE  (p_metal    IS NULL OR s.metal_center ILIKE p_metal)
      AND  (p_linker   IS NULL OR s.linker ILIKE '%' || p_linker || '%')
      AND  (p_temp_min IS NULL OR s.temp_target_c >= p_temp_min)
      AND  (p_temp_max IS NULL OR s.temp_target_c <= p_temp_max)
      AND  (p_from     IS NULL OR s.synthesis_date >= p_from)
      AND  (p_to       IS NULL OR s.synthesis_date <= p_to)
    ORDER  BY s.synthesis_date DESC NULLS LAST, s.sample_code
    LIMIT  v_limit;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    PERFORM agent_audit(p_actor, p_session, 'search_synthesis',
        format('metal=%s linker=%s temp=[%s,%s] date=[%s,%s] limit=%s is_owner=%s',
               p_metal, p_linker, p_temp_min, p_temp_max, p_from, p_to, v_limit, p_is_owner), v_rows);
END;
$$;


--
-- Name: agent_statistics(text, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agent_statistics(p_actor text DEFAULT NULL::text, p_session text DEFAULT NULL::text, p_dimension text DEFAULT NULL::text, p_limit integer DEFAULT 20) RETURNS TABLE(category text, n_samples bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_limit INTEGER := agent_row_limit(p_limit); v_rows INTEGER;
BEGIN
    IF p_dimension NOT IN ('metal_center','linker','researcher_name',
                           'synthesis_type','research_unit','year','technique') THEN
        RAISE EXCEPTION 'Dimension not allowed: %. Valid: metal_center, linker, researcher_name, synthesis_type, research_unit, year, technique', p_dimension;
    END IF;

    RETURN QUERY
    SELECT t.category, t.n FROM (
        SELECT s.metal_center::TEXT AS category, count(*) AS n, 'metal_center' AS dim
          FROM synthesis_experiments s GROUP BY 1
        UNION ALL SELECT s.linker::TEXT, count(*), 'linker'
          FROM synthesis_experiments s GROUP BY 1
        UNION ALL SELECT s.researcher_name::TEXT, count(*), 'researcher_name'
          FROM synthesis_experiments s GROUP BY 1
        UNION ALL SELECT s.synthesis_type::TEXT, count(*), 'synthesis_type'
          FROM synthesis_experiments s GROUP BY 1
        UNION ALL SELECT s.research_unit::TEXT, count(*), 'research_unit'
          FROM synthesis_experiments s GROUP BY 1
        UNION ALL SELECT to_char(s.synthesis_date,'YYYY'), count(*), 'year'
          FROM synthesis_experiments s GROUP BY 1
        UNION ALL SELECT m.technique::TEXT, count(*), 'technique'
          FROM characterization_measurements m GROUP BY 1
    ) t
    WHERE t.dim = p_dimension
    ORDER BY t.n DESC
    LIMIT v_limit;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    PERFORM agent_audit(p_actor, p_session, 'statistics',
        format('dimension=%s', p_dimension), v_rows);
END;
$$;


--
-- Name: agent_verify_owner(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agent_verify_owner(p_token text) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM agent_owner_secret
        WHERE token_hash = md5(COALESCE(p_token, ''))
    ) AND COALESCE(p_token, '') <> '';
$$;


--
-- Name: FUNCTION agent_verify_owner(p_token text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.agent_verify_owner(p_token text) IS 'Returns true only if p_token matches the stored owner secret. Called once in n8n''s Authorise Caller node; the boolean result (never the token) is what flows to agent_sample_summary/agent_get_characterisation/agent_search_synthesis to decide between exact and redacted output.';


--
-- Name: kg_neighbors(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.kg_neighbors(p_node_id text, p_max_hops integer DEFAULT 2) RETURNS TABLE(hop integer, node_id text, node_type text, label text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE frontier(node_id, hop) AS (
        SELECT p_node_id, 0
        UNION ALL
        SELECT CASE WHEN e.from_node = f.node_id THEN e.to_node ELSE e.from_node END,
               f.hop + 1
        FROM   frontier f
        JOIN   kg_edges e ON e.from_node = f.node_id OR e.to_node = f.node_id
        WHERE  f.hop < p_max_hops
    ),
    closest AS (
        SELECT frontier.node_id, MIN(frontier.hop) AS hop
        FROM   frontier
        WHERE  frontier.node_id <> p_node_id
        GROUP  BY frontier.node_id
    )
    SELECT c.hop, n.node_id, n.node_type, n.label
    FROM   closest c
    JOIN   kg_nodes n ON n.node_id = c.node_id
    ORDER  BY c.hop, n.node_type, n.label;
END;
$$;


--
-- Name: FUNCTION kg_neighbors(p_node_id text, p_max_hops integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.kg_neighbors(p_node_id text, p_max_hops integer) IS 'CTE recursiva: todo lo alcanzable desde un nodo en hasta p_max_hops saltos, sin distinguir direccion de la arista. Uso directo desde pgAdmin: SELECT * FROM kg_neighbors(''SAMPLE:SMP-0001'', 2);';


--
-- Name: rag_find_existing_document(character, text, character); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rag_find_existing_document(p_file_hash character DEFAULT NULL::bpchar, p_doi text DEFAULT NULL::text, p_text_hash character DEFAULT NULL::bpchar) RETURNS TABLE(document_id bigint, file_name text, motivo text)
    LANGUAGE sql STABLE
    AS $$
    SELECT t.document_id, t.file_name, t.motivo
    FROM (
        SELECT d.document_id, d.file_name,
               'nivel 1: MD5 binario identico'::TEXT AS motivo, 1 AS nivel
        FROM   rag_documents d
        WHERE  p_file_hash IS NOT NULL AND d.file_hash = p_file_hash
        UNION ALL
        SELECT d.document_id, d.file_name,
               'nivel 2: mismo DOI (' || d.doi || ')', 2
        FROM   rag_documents d
        WHERE  p_doi IS NOT NULL AND lower(d.doi) = lower(p_doi)
        UNION ALL
        SELECT d.document_id, d.file_name,
               'nivel 3: mismo texto de cabecera', 3
        FROM   rag_documents d
        WHERE  p_text_hash IS NOT NULL AND d.text_hash = p_text_hash
    ) t
    ORDER BY t.nivel
    LIMIT 1;
$$;


--
-- Name: FUNCTION rag_find_existing_document(p_file_hash character, p_doi text, p_text_hash character); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.rag_find_existing_document(p_file_hash character, p_doi text, p_text_hash character) IS 'Three-level anti-duplication ladder (binary MD5 -> DOI -> header text hash). Returns the already indexed document and why it matched, or no row if it is new.';


--
-- Name: rag_hybrid_search(text, public.vector, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rag_hybrid_search(query_text text, query_embedding public.vector, match_count integer DEFAULT 8, rrf_k integer DEFAULT 60) RETURNS TABLE(chunk_id bigint, text text, metadata jsonb, file_name text, rrf_score double precision)
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


--
-- Name: FUNCTION rag_hybrid_search(query_text text, query_embedding public.vector, match_count integer, rrf_k integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.rag_hybrid_search(query_text text, query_embedding public.vector, match_count integer, rrf_k integer) IS 'Busqueda hibrida vector+lexica fusionada por Reciprocal Rank Fusion (k=60).';


--
-- Name: rag_source_rank(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rag_source_rank(source text) RETURNS integer
    LANGUAGE sql IMMUTABLE
    AS $$
    SELECT CASE source
        WHEN 'MANUAL'            THEN 4   -- corrected by hand: untouchable
        WHEN 'REFERENCE_MANAGER' THEN 3   -- Zotero/Mendeley: curated by a person
        WHEN 'CROSSREF'          THEN 2   -- the publisher's official record
        WHEN 'PDF_HEURISTIC'     THEN 1   -- guessed from the file: the weakest
        ELSE 0
    END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: agent_chat_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_chat_log (
    chat_id bigint NOT NULL,
    session_id text,
    actor_email text,
    question text,
    answer text,
    verdict text DEFAULT 'ALLOWED'::text NOT NULL,
    cause text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT agent_chat_log_verdict_check CHECK ((verdict = ANY (ARRAY['ALLOWED'::text, 'DENIED'::text, 'ERROR'::text])))
);


--
-- Name: TABLE agent_chat_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.agent_chat_log IS 'Transcript of every exchange with the RAG agent: who asked, what they asked, what was answered. Complements audit_log, which logs tool calls rather than dialogue.';


--
-- Name: COLUMN agent_chat_log.actor_email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agent_chat_log.actor_email IS 'Claimed identity of the caller, validated against authorized_researchers. A typed email is accountability, not authentication.';


--
-- Name: COLUMN agent_chat_log.verdict; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agent_chat_log.verdict IS 'ALLOWED = answered; DENIED = caller not on the whitelist; ERROR = the run failed.';


--
-- Name: agent_chat_log_chat_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.agent_chat_log_chat_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: agent_chat_log_chat_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.agent_chat_log_chat_id_seq OWNED BY public.agent_chat_log.chat_id;


--
-- Name: agent_owner_secret; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_owner_secret (
    token_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE agent_owner_secret; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.agent_owner_secret IS 'Holds the md5 hash of the single owner access token for the ALCheMy-RAG chat agent. Never the plaintext token. Verified by agent_verify_owner(); downstream agent_* functions only receive the resulting boolean (p_is_owner), never the token.';


--
-- Name: ai_agent_calls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_agent_calls (
    call_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    execution_id text,
    agent_node text NOT NULL,
    sample_code text,
    technique text,
    model_provider text NOT NULL,
    model_name text NOT NULL,
    is_fallback boolean DEFAULT false NOT NULL,
    success boolean NOT NULL,
    error_message text,
    latency_ms integer,
    confidence numeric
);


--
-- Name: TABLE ai_agent_calls; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ai_agent_calls IS 'One row per AI agent invocation (Gemini or local Ollama fallback), for cost/usage auditing - never trims to only successful calls.';


--
-- Name: ai_agent_calls_call_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ai_agent_calls_call_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ai_agent_calls_call_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ai_agent_calls_call_id_seq OWNED BY public.ai_agent_calls.call_id;


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    log_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    agent character varying(100) DEFAULT 'alchemy_ingestion_pipeline'::character varying NOT NULL,
    action character varying(100) NOT NULL,
    recipients integer DEFAULT 0,
    verdict character varying(50) DEFAULT 'ALLOW'::character varying NOT NULL,
    cause text,
    result character varying(100) DEFAULT 'EXECUTED'::character varying,
    actor_email text,
    session_id text
);


--
-- Name: TABLE audit_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audit_log IS 'Audit log table tracking all system actions, approvals, rejections, and execution metrics';


--
-- Name: COLUMN audit_log.actor_email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_log.actor_email IS 'Email of the person on whose behalf the agent acted. Supplied by the workflow after whitelist validation, never by the language model.';


--
-- Name: COLUMN audit_log.session_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_log.session_id IS 'Chat session the action belongs to, so a whole conversation can be reconstructed.';


--
-- Name: authorized_researchers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.authorized_researchers (
    email character varying(255) NOT NULL,
    researcher_name character varying(100) DEFAULT 'Guest Researcher'::character varying,
    role character varying(50) DEFAULT 'guest_demo'::character varying,
    active boolean DEFAULT true,
    last_seen timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE authorized_researchers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.authorized_researchers IS 'Whitelist table storing authorized researchers and dynamic self-enrolled demo users';


--
-- Name: characterization_measurements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.characterization_measurements (
    measurement_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    sample_code character varying(50) NOT NULL,
    researcher_name character varying(100) DEFAULT 'Rubén S.N.'::character varying,
    researcher_email character varying(255) DEFAULT 'researcher@example.org'::character varying,
    technique character varying(30) NOT NULL,
    operator_name character varying(100) DEFAULT 'Technician'::character varying,
    measurement_tag character varying(100) DEFAULT 'as_synthesized'::character varying,
    instrument_name character varying(100) DEFAULT 'N/A'::character varying,
    file_name character varying(255) NOT NULL,
    raw_file_path text NOT NULL,
    data_json jsonb NOT NULL,
    file_hash character varying(32),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE characterization_measurements; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.characterization_measurements IS 'Child table storing raw characterization data and header metadata in standardized JSONB format';


--
-- Name: COLUMN characterization_measurements.sample_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.characterization_measurements.sample_code IS 'Foreign key referencing synthesis_experiments.sample_code';


--
-- Name: COLUMN characterization_measurements.technique; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.characterization_measurements.technique IS 'Characterization technique code (PXRD, TGA, FTIR, UV-Vis, BET_N2, EA, ICP, SEM, SC-XRD, VTXRD)';


--
-- Name: COLUMN characterization_measurements.measurement_tag; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.characterization_measurements.measurement_tag IS 'Descriptive measurement condition (as_synthesized, activated_150C, water_stability_24h)';


--
-- Name: COLUMN characterization_measurements.raw_file_path; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.characterization_measurements.raw_file_path IS 'Path to raw unparsed file in the Data Lake';


--
-- Name: COLUMN characterization_measurements.data_json; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.characterization_measurements.data_json IS 'JSONB payload containing header_metadata dict and raw_data (x_label, y_label, x arrays, y arrays)';


--
-- Name: characterization_measurements_test; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.characterization_measurements_test (
    measurement_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    sample_code character varying(50) NOT NULL,
    researcher_name character varying(100) DEFAULT 'Rubén S.N.'::character varying,
    researcher_email character varying(255) DEFAULT 'researcher@example.org'::character varying,
    technique character varying(30) NOT NULL,
    operator_name character varying(100) DEFAULT 'Technician'::character varying,
    measurement_tag character varying(100) DEFAULT 'as_synthesized'::character varying,
    instrument_name character varying(100) DEFAULT 'N/A'::character varying,
    file_name character varying(255) NOT NULL,
    raw_file_path text NOT NULL,
    data_json jsonb NOT NULL,
    file_hash character varying(32),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE characterization_measurements_test; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.characterization_measurements_test IS 'Test copy of characterization_measurements, used to exercise the ingestion pipeline without touching real data. Not part of the production flow.';


--
-- Name: COLUMN characterization_measurements_test.sample_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.characterization_measurements_test.sample_code IS 'Foreign key referencing synthesis_experiments.sample_code';


--
-- Name: COLUMN characterization_measurements_test.technique; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.characterization_measurements_test.technique IS 'Characterization technique code (PXRD, TGA, FTIR, UV-Vis, BET_N2, EA, ICP, SEM, SC-XRD, VTXRD)';


--
-- Name: COLUMN characterization_measurements_test.measurement_tag; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.characterization_measurements_test.measurement_tag IS 'Descriptive measurement condition (as_synthesized, activated_150C, water_stability_24h)';


--
-- Name: COLUMN characterization_measurements_test.raw_file_path; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.characterization_measurements_test.raw_file_path IS 'Path to raw unparsed file in the Data Lake';


--
-- Name: COLUMN characterization_measurements_test.data_json; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.characterization_measurements_test.data_json IS 'JSONB payload containing header_metadata dict and raw_data (x_label, y_label, x arrays, y arrays)';


--
-- Name: data_dictionary; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_dictionary (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    column_name character varying(100) NOT NULL,
    full_name character varying(150) NOT NULL,
    section_name character varying(100) NOT NULL,
    unit character varying(50),
    data_type character varying(50) NOT NULL,
    valid_categories text,
    description text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    table_name character varying(100) DEFAULT 'synthesis_experiments'::character varying NOT NULL
);


--
-- Name: TABLE data_dictionary; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.data_dictionary IS 'The schema documentation as queryable rows: one per column of every table and view. It exists so the web application and the AI agents read the dictionary FROM the database instead of carrying it hard-coded. Coverage must be 100 %: an incomplete dictionary cannot distinguish an undocumented column from a column that does not exist.';


--
-- Name: COLUMN data_dictionary.table_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_dictionary.table_name IS 'Tabla a la que pertenece la columna documentada. Por defecto synthesis_experiments.';


--
-- Name: element_properties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.element_properties (
    symbol character varying(3) NOT NULL,
    atomic_number integer NOT NULL,
    atomic_mass_u double precision,
    period integer,
    group_number integer,
    block character varying(2),
    is_transition_metal boolean,
    is_lanthanide boolean,
    electronegativity_pauling double precision,
    electronegativity_allen double precision,
    ionization_energy_1_ev double precision,
    electron_affinity_ev double precision,
    absolute_hardness_ev double precision,
    absolute_electroneg_ev double precision,
    covalent_radius_pm double precision,
    atomic_radius_pm double precision,
    polarizability_a3 double precision,
    oxophilicity_kepp double precision,
    data_source character varying(50) NOT NULL,
    loaded_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE element_properties; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.element_properties IS 'One row per element used as a metal_center in synthesis_experiments. Properties that belong to the element itself (electronegativity, hardness) rather than to a specific ion (see ion_properties). Populated by src/build_element_properties.py.';


--
-- Name: COLUMN element_properties.electronegativity_pauling; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.element_properties.electronegativity_pauling IS 'Pauling scale. Kept alongside the Allen scale because they order transition metals differently (see property_sources).';


--
-- Name: COLUMN element_properties.electronegativity_allen; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.element_properties.electronegativity_allen IS 'Allen (spectroscopic) scale. Allen, JACS 1989.';


--
-- Name: COLUMN element_properties.absolute_hardness_ev; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.element_properties.absolute_hardness_ev IS 'Pearson absolute hardness, eta = (IE1 - EA)/2. Base of HSAB reasoning.';


--
-- Name: COLUMN element_properties.absolute_electroneg_ev; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.element_properties.absolute_electroneg_ev IS 'Mulliken/Pearson absolute electronegativity, chi = (IE1 + EA)/2.';


--
-- Name: COLUMN element_properties.oxophilicity_kepp; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.element_properties.oxophilicity_kepp IS 'Kepp (2016) oxophilicity scale, DOI 10.1021/acs.inorgchem.6b01702. Paywalled -- NULL until entered by hand from Table 2 of the paper. See methodology/PENDIENTE_ML_INPUTS_HUMANOS.md.';


--
-- Name: COLUMN element_properties.data_source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.element_properties.data_source IS 'Which tool/table produced this row, e.g. mendeleev+pymatgen or manual_kepp_2016.';


--
-- Name: ion_properties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ion_properties (
    symbol character varying(3) NOT NULL,
    oxidation_state integer NOT NULL,
    coordination_number integer NOT NULL,
    spin_state character varying(10) DEFAULT ''::character varying NOT NULL,
    shannon_radius_pm double precision,
    crystal_radius_pm double precision,
    charge_over_radius double precision,
    data_source character varying(50) NOT NULL
);


--
-- Name: TABLE ion_properties; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ion_properties IS 'Radius and charge density per (element, oxidation state, coordination number). Coordination number is pinned to 6 everywhere in this project (see roadmap SS3.4: the true CN is unknown before synthesis, and Shannon CN=6 radii are both the most tabulated and the ones that preserve relative ordering between metals).';


--
-- Name: COLUMN ion_properties.oxidation_state; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ion_properties.oxidation_state IS 'Charge of the metal AS USED IN THE PRECURSOR SALT (e.g. Fe3+ from FeCl3), not the charge in the final MOF -- that is not known before synthesis. See metal_source_oxidation_state for how this is derived per synthesis, and roadmap SS3.3 for why that is the right modelling choice.';


--
-- Name: COLUMN ion_properties.shannon_radius_pm; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ion_properties.shannon_radius_pm IS 'Effective ionic radius, Shannon (1976), Acta Cryst A32, 751. Ionic (not crystal) radius, CN=6 unless unavailable.';


--
-- Name: COLUMN ion_properties.charge_over_radius; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ion_properties.charge_over_radius IS 'oxidation_state / shannon_radius_pm: a cheap, interpretable proxy for charge density / Lewis acidity.';


--
-- Name: job_leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_leads (
    lead_id bigint NOT NULL,
    source_email_id text,
    source_portal text,
    job_title text NOT NULL,
    company_name text,
    location_text text,
    job_url text,
    job_description text,
    fit_score integer,
    fit_reasoning text,
    recommendation text,
    cv_draft text,
    cover_letter_draft text,
    status text DEFAULT 'PENDIENTE_REVISION'::text NOT NULL,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT job_leads_fit_score_check CHECK (((fit_score >= 0) AND (fit_score <= 100))),
    CONSTRAINT job_leads_recommendation_check CHECK ((recommendation = ANY (ARRAY['SI'::text, 'QUIZA'::text, 'NO'::text]))),
    CONSTRAINT job_leads_status_check CHECK ((status = ANY (ARRAY['PENDIENTE_REVISION'::text, 'DESCARTADA'::text, 'APLICADA'::text, 'RECHAZADA_POR_RUBEN'::text])))
);


--
-- Name: TABLE job_leads; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.job_leads IS 'Una fila por oferta de empleo detectada en las alertas de correo. El envio final es siempre manual.';


--
-- Name: COLUMN job_leads.source_email_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.job_leads.source_email_id IS 'Message-ID del correo de origen (un correo puede contener varias ofertas).';


--
-- Name: COLUMN job_leads.fit_score; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.job_leads.fit_score IS 'Nota 0-100 del agente evaluador, comparando la oferta con el perfil de Ruben.';


--
-- Name: COLUMN job_leads.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.job_leads.status IS 'PENDIENTE_REVISION es el unico estado que escribe el flujo automatico. Los demas los cambia Ruben.';


--
-- Name: job_leads_lead_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.job_leads_lead_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: job_leads_lead_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.job_leads_lead_id_seq OWNED BY public.job_leads.lead_id;


--
-- Name: kg_edges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kg_edges (
    edge_id bigint NOT NULL,
    from_node text NOT NULL,
    to_node text NOT NULL,
    edge_type text NOT NULL,
    confidence numeric(4,3) DEFAULT 1.000 NOT NULL,
    source text DEFAULT 'DETERMINISTIC'::text NOT NULL,
    review_status text DEFAULT 'CONFIRMED'::text NOT NULL,
    properties jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT kg_edges_confidence_check CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric))),
    CONSTRAINT kg_edges_review_status_check CHECK ((review_status = ANY (ARRAY['CONFIRMED'::text, 'PENDING_REVIEW'::text, 'REJECTED'::text]))),
    CONSTRAINT kg_edges_source_check CHECK ((source = ANY (ARRAY['DETERMINISTIC'::text, 'LLM_INFERRED'::text])))
);


--
-- Name: TABLE kg_edges; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.kg_edges IS 'One row per relation between two nodes: SAMPLE-USES_LIGAND->LIGAND, SAMPLE-HAS_MEASUREMENT->MEASUREMENT, and in future PAPER-SUPPORTS->DESCRIPTOR.';


--
-- Name: COLUMN kg_edges.confidence; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.kg_edges.confidence IS '1.0 para aristas deterministas (siempre). Para aristas LLM_INFERRED (Fase 3), la confianza que dio el modelo al proponer la relacion.';


--
-- Name: COLUMN kg_edges.source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.kg_edges.source IS 'DETERMINISTIC = construida por build_knowledge_graph.py desde una columna real, sin ambiguedad posible. LLM_INFERRED = un modelo la propuso comparando texto libre, requiere revision.';


--
-- Name: COLUMN kg_edges.review_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.kg_edges.review_status IS 'Las aristas DETERMINISTIC nacen CONFIRMED. Las LLM_INFERRED nacen PENDING_REVIEW y no deben tratarse como hecho hasta que un humano las confirme (mismo patron HITL que la rama ICP/EA de n8n).';


--
-- Name: kg_edges_edge_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.kg_edges_edge_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: kg_edges_edge_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.kg_edges_edge_id_seq OWNED BY public.kg_edges.edge_id;


--
-- Name: kg_nodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kg_nodes (
    node_id text NOT NULL,
    node_type text NOT NULL,
    label text NOT NULL,
    source_table text,
    source_id text,
    properties jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT kg_nodes_node_type_check CHECK ((node_type = ANY (ARRAY['SAMPLE'::text, 'LIGAND'::text, 'METAL'::text, 'MODULATOR'::text, 'MEASUREMENT'::text, 'DESCRIPTOR'::text, 'PAPER'::text, 'ML_MODEL'::text, 'ML_PREDICTION'::text])))
);


--
-- Name: TABLE kg_nodes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.kg_nodes IS 'One row per "thing that exists" in the knowledge graph: sample, ligand, metal, modulator, measurement, descriptor/KPI, paper, ML model or ML prediction.';


--
-- Name: COLUMN kg_nodes.node_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.kg_nodes.node_id IS 'Clave legible con prefijo de tipo, p.ej. SAMPLE:SMP-0001, LIGAND:H2BDC, PAPER:123. No es un UUID a proposito: se puede escribir a mano al explorar el grafo.';


--
-- Name: COLUMN kg_nodes.source_table; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.kg_nodes.source_table IS 'Tabla de origen si el nodo viene de una fila real (p.ej. synthesis_experiments); NULL para nodos que solo existen como concepto (un ligando, un modulador).';


--
-- Name: COLUMN kg_nodes.properties; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.kg_nodes.properties IS 'Metadatos extra especificos del tipo de nodo (p.ej. n_files en un MEASUREMENT), para no tener que anadir columnas por cada tipo nuevo.';


--
-- Name: linker_properties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.linker_properties (
    linker_code character varying(50) NOT NULL,
    iupac_name text,
    common_name text,
    smiles text,
    inchikey character varying(27),
    scaffold character varying(30) NOT NULL,
    protection_state character varying(20) NOT NULL,
    denticity integer,
    n_donor_atoms integer,
    n_acidic_protons integer,
    donor_group character varying(20),
    molecular_weight double precision,
    n_aromatic_rings integer,
    max_donor_distance_a double precision,
    tpsa double precision,
    clogp double precision,
    n_rotatable_bonds double precision,
    computed_with character varying(50),
    notes text
);


--
-- Name: TABLE linker_properties; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.linker_properties IS 'One row per linker code used in synthesis_experiments.linker. scaffold + protection_state are the two independent axes hidden inside the 6 linker names (roadmap SS1.3/SS4.2): LIG-x/LIG-x are the same molecule as acid/ester, same for LIG-x/LIG-x. Populated by src/build_linker_properties.py from hand-verified SMILES -- see methodology/PENDIENTE_ML_INPUTS_HUMANOS.md for the one identification (LIG-x) that needs Ruben''s confirmation.';


--
-- Name: COLUMN linker_properties.max_donor_distance_a; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linker_properties.max_donor_distance_a IS 'Farthest distance between donor atoms in a UFF/MMFF-optimised 3D conformer. Proxy for linker "length", which drives pore size / accessible topology -- probably the single most informative linker descriptor (roadmap SS4.4).';


--
-- Name: metal_source_oxidation_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metal_source_oxidation_state (
    metal_source character varying(100) NOT NULL,
    symbol character varying(3),
    oxidation_state integer,
    basis character varying(30) NOT NULL,
    matches_metal_center boolean,
    notes text
);


--
-- Name: TABLE metal_source_oxidation_state; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.metal_source_oxidation_state IS 'Maps every distinct synthesis_experiments.metal_source string to the metal and oxidation state implied by its chemical formula. Deterministic where the formula is unambiguous (roadmap SS3.3, option 1); a handful of rows are flagged matches_metal_center=FALSE where metal_source disagrees with metal_center -- these are real data-entry questions, listed in methodology/PENDIENTE_ML_INPUTS_HUMANOS.md, not modelling choices.';


--
-- Name: COLUMN metal_source_oxidation_state.matches_metal_center; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.metal_source_oxidation_state.matches_metal_center IS 'FALSE means the salt formula implies a different element than synthesis_experiments.metal_center for at least one row using this metal_source (e.g. metal_center=Mg but metal_source=Ni(NO3)2.6H2O). v_ml_features trusts metal_center for the join, but this flag exists so the mismatch is never silently invisible.';


--
-- Name: ml_datasets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ml_datasets (
    dataset_id integer NOT NULL,
    dataset_slug character varying(80) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    source_query text NOT NULL,
    query_sha256 character(64) NOT NULL,
    feature_source character varying(80),
    n_rows integer NOT NULL,
    n_features integer,
    n_groups integer,
    target_column character varying(60),
    class_distribution jsonb,
    filters_human text,
    known_caveats text,
    CONSTRAINT ml_datasets_rows_positive CHECK ((n_rows > 0))
);


--
-- Name: TABLE ml_datasets; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ml_datasets IS 'Snapshot of the data used for training. Stores the literal query and its hash so that a change in the underlying data is detectable: two models sharing a query but differing in n_rows or class_distribution were NOT trained on the same thing.';


--
-- Name: COLUMN ml_datasets.n_groups; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ml_datasets.n_groups IS 'Numero de grupos de validacion (placas HTS). Es el tamano de muestra EFECTIVO: 1.516 filas en 68 placas se parecen mas a 68 observaciones que a 1.516.';


--
-- Name: COLUMN ml_datasets.known_caveats; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ml_datasets.known_caveats IS 'Lo que hay que saber antes de reutilizar este conjunto: sesgos conocidos, columnas dudosas, huecos declarados.';


--
-- Name: ml_datasets_dataset_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ml_datasets_dataset_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ml_datasets_dataset_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ml_datasets_dataset_id_seq OWNED BY public.ml_datasets.dataset_id;


--
-- Name: ml_model_artifacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ml_model_artifacts (
    model_id integer NOT NULL,
    artifact_format character varying(20) NOT NULL,
    artifact_bytes bytea NOT NULL,
    artifact_size_bytes bigint NOT NULL,
    artifact_sha256 character(64) NOT NULL,
    serialized_object text,
    load_instructions text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ml_model_artifacts_tamano CHECK ((artifact_size_bytes > 0))
);


--
-- Name: TABLE ml_model_artifacts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ml_model_artifacts IS 'The serialised binary, in its own table so a light dump can skip it without losing the registry entry (same pattern as the vectors in rag_chunks). It is the REGENERABLE part, provided the recipe in ml_models is complete.';


--
-- Name: COLUMN ml_model_artifacts.artifact_sha256; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ml_model_artifacts.artifact_sha256 IS 'Huella del binario. Permite detectar corrupcion y comprobar que el fichero que alguien tiene en disco es de verdad este modelo.';


--
-- Name: COLUMN ml_model_artifacts.load_instructions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ml_model_artifacts.load_instructions IS 'Como cargarlo, escrito literalmente. Un binario sin instrucciones de carga es un problema futuro garantizado.';


--
-- Name: ml_model_features; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ml_model_features (
    model_id integer NOT NULL,
    feature_name character varying(80) NOT NULL,
    feature_role character varying(20) NOT NULL,
    feature_block character varying(40),
    importance double precision,
    exclusion_reason text,
    feature_position integer,
    CONSTRAINT ml_model_features_role_valido CHECK (((feature_role)::text = ANY ((ARRAY['input'::character varying, 'group'::character varying, 'target'::character varying, 'excluded'::character varying])::text[])))
);


--
-- Name: TABLE ml_model_features; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ml_model_features IS 'Which columns entered each model, and in what role. Recording the EXCLUDED ones with their reason is what turns a decision into an auditable decision.';


--
-- Name: COLUMN ml_model_features.feature_position; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ml_model_features.feature_position IS 'Posicion (0-based) de la columna en el DataFrame con el que se entreno el pipeline. Solo tiene sentido para feature_role = ''input''; NULL en las demas. Para construir X hay que hacer ORDER BY feature_position: sin el, el orden de las filas no esta garantizado y el modelo puede predecir con las columnas cruzadas sin dar error.';


--
-- Name: ml_model_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ml_model_metrics (
    model_id integer NOT NULL,
    metric_name character varying(40) NOT NULL,
    split character varying(20) NOT NULL,
    metric_value double precision NOT NULL,
    metric_std double precision,
    n_folds integer,
    class_name character varying(40) DEFAULT ''::character varying NOT NULL
);


--
-- Name: TABLE ml_model_metrics; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ml_model_metrics IS 'Metricas en formato largo. Anadir una metrica nueva no requiere cambiar el esquema.';


--
-- Name: COLUMN ml_model_metrics.metric_std; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ml_model_metrics.metric_std IS 'Desviacion tipica entre pliegues. Un 0,52 con desviacion 0,05 y un 0,52 con desviacion 0,15 no son el mismo resultado, y sin esta columna parecen identicos.';


--
-- Name: ml_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ml_models (
    model_id integer NOT NULL,
    model_slug character varying(80) NOT NULL,
    display_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    task_type character varying(40) NOT NULL,
    target_column character varying(60),
    target_classes text[],
    question text,
    dataset_id integer,
    algorithm character varying(80) NOT NULL,
    library character varying(40) NOT NULL,
    hyperparameters jsonb,
    preprocessing jsonb,
    validation_scheme jsonb,
    random_seed integer,
    source_notebook text,
    git_commit character varying(50),
    python_version character varying(20),
    library_versions jsonb,
    platform text,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    superseded_by integer,
    is_reproducible boolean DEFAULT true NOT NULL,
    not_reproducible_reason text,
    notes text,
    deployment_slot character varying(30),
    is_deployed boolean GENERATED ALWAYS AS ((deployment_slot IS NOT NULL)) STORED,
    CONSTRAINT ml_models_motivo_obligatorio CHECK ((is_reproducible OR (not_reproducible_reason IS NOT NULL))),
    CONSTRAINT ml_models_slot_solo_activo CHECK (((deployment_slot IS NULL) OR ((status)::text = 'active'::text))),
    CONSTRAINT ml_models_slot_valido CHECK (((deployment_slot IS NULL) OR ((deployment_slot)::text = ANY ((ARRAY['primary'::character varying, 'actionable'::character varying])::text[])))),
    CONSTRAINT ml_models_status_valido CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'superseded'::character varying, 'archived'::character varying, 'invalid'::character varying])::text[])))
);


--
-- Name: TABLE ml_models; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ml_models IS 'One record per trained model. Holds the complete RECIPE (data, code, parameters, seed, versions); the binary lives apart in ml_model_artifacts because it is the only part that can be regenerated when the recipe is complete.';


--
-- Name: COLUMN ml_models.random_seed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ml_models.random_seed IS 'Semilla. Sin ella, volver a ejecutar el mismo codigo sobre los mismos datos da un modelo DISTINTO en cualquier metodo con aleatoriedad (bosques, boosting, particiones).';


--
-- Name: COLUMN ml_models.git_commit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ml_models.git_commit IS 'Commit del repositorio en el momento de entrenar. Sin esto no se sabe que codigo produjo el modelo, por muchos hiperparametros que se guarden.';


--
-- Name: COLUMN ml_models.library_versions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ml_models.library_versions IS 'Versiones de las librerias. scikit-learn cambia valores por defecto entre versiones: el mismo codigo en otra version puede dar otro modelo sin avisar.';


--
-- Name: COLUMN ml_models.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ml_models.status IS 'active = vigente | superseded = sustituido por otro mejor | archived = se conserva por historia | invalid = sus resultados NO deben usarse.';


--
-- Name: COLUMN ml_models.is_reproducible; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ml_models.is_reproducible IS 'FALSE cuando el modelo NO puede reconstruirse hoy, tipicamente porque los datos de entrenamiento cambiaron. Caso real: crystallinity_v2_mixed, invalidado por una correccion de unidades posterior.';


--
-- Name: COLUMN ml_models.deployment_slot; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ml_models.deployment_slot IS 'Papel con el que este modelo se esta sirviendo: primary (el modelo completo, el que alimenta el simulador) o actionable (solo variables fijables antes de sintetizar). NULL = registrado pero no servido. Es el puntero de despliegue: cambiar de modelo en produccion es un UPDATE de esta columna mas volver a generar los artefactos de la web.';


--
-- Name: COLUMN ml_models.is_deployed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ml_models.is_deployed IS 'Calculada: TRUE si el modelo ocupa una ranura de despliegue. No se escribe a mano, para que no pueda discrepar de deployment_slot.';


--
-- Name: ml_models_model_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ml_models_model_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ml_models_model_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ml_models_model_id_seq OWNED BY public.ml_models.model_id;


--
-- Name: property_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property_sources (
    property_name character varying(60) NOT NULL,
    source_citation text NOT NULL,
    source_doi text,
    scale_notes text
);


--
-- Name: TABLE property_sources; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.property_sources IS 'Citation + DOI for every property in element_properties/ion_properties/linker_properties. Exists because e.g. "electronegativity" alone is ambiguous (Pauling vs Allen give different orderings for transition metals) -- see roadmap SS3.1.';


--
-- Name: pxrd_descriptors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pxrd_descriptors (
    measurement_id uuid NOT NULL,
    sample_code character varying(50) NOT NULL,
    pipeline_version character varying(20) NOT NULL,
    baseline_method character varying(30) NOT NULL,
    baseline_lambda double precision,
    broad_width_deg double precision,
    peak_sigma_k double precision,
    n_peaks_k3 integer,
    n_peaks integer,
    n_peaks_below_15deg integer,
    two_theta_first_peak double precision,
    d_max_angstrom double precision,
    fwhm_median_deg double precision,
    fwhm_min_deg double precision,
    scherrer_size_nm double precision,
    crystalline_fraction double precision,
    crystalline_area double precision,
    amorphous_area double precision,
    amorphous_hump_center double precision,
    amorphous_hump_fwhm double precision,
    frac_intensity_below_15deg double precision,
    peak_to_background_ratio double precision,
    spectral_entropy double precision,
    snr_global double precision,
    raw_counts_max double precision,
    nmf_weights jsonb,
    computed_at timestamp with time zone DEFAULT now(),
    d_max_saturated boolean,
    signal_snr_area double precision,
    crystallinity_reliable boolean,
    amorphous_fraction_blank double precision,
    crystalline_fraction_blank double precision,
    blank_scale_factor double precision
);


--
-- Name: TABLE pxrd_descriptors; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.pxrd_descriptors IS 'Canonical crystallographic descriptor vector derived deterministically from each PXRD diffractogram. One row per measurement. Specified in methodology/ROADMAP_PXRD_CRISTALINIDAD_Y_ML.md, Etapa 3.';


--
-- Name: COLUMN pxrd_descriptors.measurement_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_descriptors.measurement_id IS 'FK to characterization_measurements. The raw curve is never duplicated here; it stays in that table''s data_json.';


--
-- Name: COLUMN pxrd_descriptors.sample_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_descriptors.sample_code IS 'Denormalised copy of the sample code, so descriptors can be grouped by sample without a join.';


--
-- Name: COLUMN pxrd_descriptors.pipeline_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_descriptors.pipeline_version IS 'Version of src/pxrd_descriptors.py that produced the row. v1.0 processed from 3 deg and measured the direct-beam tail as an amorphous halo; v2.0 cuts at 5 deg, gates the narrow component at k*sigma and removes the halo pedestal. Rows from different versions are NOT comparable - always filter on this column before aggregating.';


--
-- Name: COLUMN pxrd_descriptors.baseline_method; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_descriptors.baseline_method IS 'Baseline estimator used, e.g. arpls. Recorded so a future change of method is auditable.';


--
-- Name: COLUMN pxrd_descriptors.baseline_lambda; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_descriptors.baseline_lambda IS 'Smoothing parameter of the RIGID baseline pass, which removes only the instrumental background. Calibrated to 1e6 against the real blank and standard; too low swallows the amorphous halo, too high leaves background behind.';


--
-- Name: COLUMN pxrd_descriptors.broad_width_deg; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_descriptors.broad_width_deg IS 'Width in degrees 2-theta of the running-median window that separates the broad amorphous halo from the narrow Bragg peaks. Wider than any reflection, narrower than any halo.';


--
-- Name: COLUMN pxrd_descriptors.peak_sigma_k; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_descriptors.peak_sigma_k IS 'The k actually applied to this measurement, derived from its length by peak_k_sigma(). Recorded rather than assumed, because it varies between scans by design: holding the false-peak RATE constant is what makes scans of different length comparable.';


--
-- Name: COLUMN pxrd_descriptors.n_peaks_k3; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_descriptors.n_peaks_k3 IS 'Same detector at a fixed 3 sigma - the level appropriate to a SINGLE test, not to a search over a whole pattern. Kept because the gap against n_peaks is informative: many peaks here and none there means counting noise, agreement between the two means genuine crystallinity. On its own it overcounts badly - 47% of hand-labelled AMORFO patterns get 3 or more reflections, against 11% under n_peaks. Not to be used as a peak count.';


--
-- Name: COLUMN pxrd_descriptors.n_peaks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_descriptors.n_peaks IS 'Number of Bragg reflections accepted at the multiple-comparison-corrected threshold: prominence above k * (Poisson noise of this scan), with k derived from the scan length so that at most 0.05 false reflections are expected per measurement (k = 5.07-5.22 on this instrument). THE primary peak count, and the set from which two_theta_first_peak, d_max_angstrom, fwhm_* and scherrer_size_nm are read. Median by hand-assigned class: AMORFO 0, INCIPIENTE 8, CRISTALINO 19.';


--
-- Name: COLUMN pxrd_descriptors.n_peaks_below_15deg; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_descriptors.n_peaks_below_15deg IS 'Reflections below 15 deg 2-theta (d > 5.90 A). Large-cell indicator. 15 deg and not 10 because in phosphonate MOFs the most characteristic and intense reflections routinely fall between 10 and 15 deg. A high value suggests a POTENTIALLY porous framework: in this family a large cell comes from large linker cores and large low-symmetry asymmetric units, and does not by itself imply accessible porosity - only gas adsorption settles that.';


--
-- Name: COLUMN pxrd_descriptors.two_theta_first_peak; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_descriptors.two_theta_first_peak IS 'Angular position of the lowest-angle detected reflection, in degrees 2-theta.';


--
-- Name: COLUMN pxrd_descriptors.d_max_angstrom; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_descriptors.d_max_angstrom IS 'Largest interplanar spacing observed, from Bragg on the first reflection. Capped at 17.66 A by the 5 deg cutoff - see d_max_saturated.';


--
-- Name: COLUMN pxrd_descriptors.fwhm_median_deg; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_descriptors.fwhm_median_deg IS 'Median full width at half maximum across detected peaks, in degrees. Narrow peaks = better crystalline quality.';


--
-- Name: COLUMN pxrd_descriptors.fwhm_min_deg; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_descriptors.fwhm_min_deg IS 'Narrowest peak found, in degrees. Less sensitive than the median to poorly resolved shoulders.';


--
-- Name: COLUMN pxrd_descriptors.scherrer_size_nm; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_descriptors.scherrer_size_nm IS 'Apparent coherent domain size from the Scherrer equation, in nm. SEMIQUANTITATIVE ONLY: no instrumental broadening correction is applied, so values are systematically underestimated. Valid for comparing samples measured on the same instrument, never as an absolute crystallite size.';


--
-- Name: COLUMN pxrd_descriptors.crystalline_fraction; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_descriptors.crystalline_fraction IS 'v2.0 crystallinity, from a width-selective running median. SUPERSEDED by crystalline_fraction_blank: this estimate is inflated on crystalline patterns (peak flanks raise the running median) and meaningless on amorphous ones (arPLS had already removed the halo). Retained because it still ranks patterns in the right order and the earlier rows were computed with it.';


--
-- Name: COLUMN pxrd_descriptors.crystalline_area; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_descriptors.crystalline_area IS 'Integrated area of the narrow (Bragg) component, after the amorphous envelope has been subtracted.';


--
-- Name: COLUMN pxrd_descriptors.amorphous_area; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_descriptors.amorphous_area IS 'Integrated area of the broad amorphous component. This is the number that preserves the disordered-phase information a plain background subtraction would destroy.';


--
-- Name: COLUMN pxrd_descriptors.amorphous_hump_center; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_descriptors.amorphous_hump_center IS 'Intensity-weighted centroid of the BROAD component only, in degrees 2-theta. Describes the nature of the amorphous phase. Computed by proper integration, not a raw sum.';


--
-- Name: COLUMN pxrd_descriptors.amorphous_hump_fwhm; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_descriptors.amorphous_hump_fwhm IS 'Approximate width of the amorphous hump, in degrees 2-theta, measured at half its maximum.';


--
-- Name: COLUMN pxrd_descriptors.frac_intensity_below_15deg; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_descriptors.frac_intensity_below_15deg IS 'Fraction of the area-normalised pattern lying below 15 deg 2-theta. Needs no peak detection, so it stays meaningful on a fully amorphous sample where n_peaks_below_15deg is zero.';


--
-- Name: COLUMN pxrd_descriptors.peak_to_background_ratio; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_descriptors.peak_to_background_ratio IS 'Ratio of the tallest net peak to the local background level. Contrast metric, very sensitive to incipient crystallinity.';


--
-- Name: COLUMN pxrd_descriptors.spectral_entropy; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_descriptors.spectral_entropy IS 'Shannon entropy of the net pattern as a probability distribution: how spread out the diffracted intensity is. Over 169 reliable patterns it correlates -0.73 with crystalline_fraction: crystalline samples concentrate intensity into few reflections (low entropy), amorphous ones spread it over a broad halo (high entropy). Must be computed on the NET signal; on the full pattern the flat background dominates and the correlation collapses to +0.04.';


--
-- Name: COLUMN pxrd_descriptors.snr_global; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_descriptors.snr_global IS 'Signal-to-noise ratio of the pattern: net signal amplitude divided by the Poisson noise level of the raw counts. Quality control of the measurement, not a property of the material.';


--
-- Name: COLUMN pxrd_descriptors.raw_counts_max; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_descriptors.raw_counts_max IS 'Maximum raw count of the original scan, before any normalisation. Records acquisition intensity, which the normalised descriptors deliberately discard.';


--
-- Name: COLUMN pxrd_descriptors.nmf_weights; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_descriptors.nmf_weights IS 'Per-phase abundance weights from the unsupervised NMF decomposition over the whole corpus (roadmap stage E3). NULL until that stage runs.';


--
-- Name: COLUMN pxrd_descriptors.computed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_descriptors.computed_at IS 'When this descriptor row was computed.';


--
-- Name: COLUMN pxrd_descriptors.d_max_saturated; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_descriptors.d_max_saturated IS 'TRUE when the first reflection sits on the 5 deg cutoff, so d_max_angstrom is a LOWER BOUND, not a measurement: the real largest spacing may be bigger and outside this diffractometer''s window. Filter these out before using d_max_angstrom as a feature, or the model learns an instrument limit.';


--
-- Name: COLUMN pxrd_descriptors.signal_snr_area; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_descriptors.signal_snr_area IS 'Integrated diffracted signal divided by integrated Poisson counting noise. Says whether the pattern contains a measurement at all. Empirical anchors: the empty holder scores 0.07, a normal sample 3-5. Drives crystallinity_reliable.';


--
-- Name: COLUMN pxrd_descriptors.crystallinity_reliable; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_descriptors.crystallinity_reliable IS 'TRUE when signal_snr_area >= 1.0. When FALSE there is too little diffracted intensity for the halo/peak split to be a measurement, and crystalline_fraction must not be used - it is still stored so the decision stays auditable. In this corpus the unreliable rows have ~4x fewer counts (median raw_counts_max 1066 vs 4087): they are near-empty HTS wells, not a processing failure.';


--
-- Name: COLUMN pxrd_descriptors.amorphous_fraction_blank; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_descriptors.amorphous_fraction_blank IS 'Of everything this specimen scattered, the fraction that was diffuse rather than Bragg: integral(A) / [integral(A) + integral(I - B)], where A is the arPLS baseline minus the scaled empty-instrument baseline. The denominator deliberately excludes the instrumental background, so the value does not depend on exposure or mount. Counts ALL non-Bragg intensity from the sample: amorphous material, thermal and defect diffuse scattering, Fe fluorescing under Cu radiation, and the sample support. Comparative within a corpus mounted the same way; never an absolute percentage of amorphous material. Median by hand-assigned class: CRISTALINO 0.011, INCIPIENTE 0.347, AMORFO 0.930.';


--
-- Name: COLUMN pxrd_descriptors.crystalline_fraction_blank; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_descriptors.crystalline_fraction_blank IS 'One minus amorphous_fraction_blank. Since v3.2 this is genuinely the crystalline fraction of what the sample scattered - under v3.1 it also counted the instrumental background as crystalline.';


--
-- Name: COLUMN pxrd_descriptors.blank_scale_factor; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_descriptors.blank_scale_factor IS 'Multiplier applied to the empty-instrument scan to put it on this measurement''s counting scale, taken from the median ratio above 45 degrees 2-theta. Needed because time-per-step is not recorded in the .xrdml headers, so raw counts are not directly comparable between the blank and a sample.';


--
-- Name: pxrd_labels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pxrd_labels (
    file_hash character varying(32) NOT NULL,
    label_type character varying(40) NOT NULL,
    sample_code character varying(50) NOT NULL,
    file_name character varying(255),
    measurement_id uuid,
    label_value character varying(40) NOT NULL,
    confidence character varying(20) DEFAULT 'alta'::character varying NOT NULL,
    notes text,
    labeled_by character varying(100) NOT NULL,
    labeled_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE pxrd_labels; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.pxrd_labels IS 'Human ground-truth labels for PXRD diffractograms. Keyed on file_hash rather than measurement_id so that labels survive a re-ingestion of characterization_measurements. The most expensive data in the project: it cannot be recomputed.';


--
-- Name: COLUMN pxrd_labels.file_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_labels.file_hash IS 'MD5 of the raw instrument file. The stable identity of the measurement: unchanged across re-ingestions, which is why the label is keyed on it.';


--
-- Name: COLUMN pxrd_labels.label_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_labels.label_type IS 'Which question the label answers, e.g. crystallinity_class. Part of the key, so one measurement can carry one label of each type.';


--
-- Name: COLUMN pxrd_labels.sample_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_labels.sample_code IS 'Sample the diffractogram belongs to. Denormalised so an orphaned label stays readable.';


--
-- Name: COLUMN pxrd_labels.file_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_labels.file_name IS 'Original file name, for human identification.';


--
-- Name: COLUMN pxrd_labels.measurement_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_labels.measurement_id IS 'Convenience FK to characterization_measurements. SET NULL if the measurement is deleted; re-attach by matching file_hash.';


--
-- Name: COLUMN pxrd_labels.label_value; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_labels.label_value IS 'The judgement: AMORFO | INCIPIENTE | CRISTALINO | MEZCLA | SIN_MUESTRA.';


--
-- Name: COLUMN pxrd_labels.confidence; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_labels.confidence IS 'How sure the labeller was: alta or dudosa. Doubtful labels can be excluded from training without being lost.';


--
-- Name: COLUMN pxrd_labels.notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_labels.notes IS 'Free-text remark from the labeller.';


--
-- Name: COLUMN pxrd_labels.labeled_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_labels.labeled_by IS 'Who assigned the label.';


--
-- Name: COLUMN pxrd_labels.labeled_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_labels.labeled_at IS 'When the label was first assigned.';


--
-- Name: COLUMN pxrd_labels.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pxrd_labels.updated_at IS 'When the label was last changed (a label revised on review keeps its original labeled_at).';


--
-- Name: rag_chunk_context; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rag_chunk_context (
    chunk_id bigint NOT NULL,
    context_sentence text NOT NULL,
    source_model text DEFAULT 'gemini'::text NOT NULL,
    batch_file text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE rag_chunk_context; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.rag_chunk_context IS 'Sidecar for contextual-retrieval sentences generated externally (Gemini/Antigravity). Never written to by anything that also writes rag_chunks.embedding.';


--
-- Name: rag_chunks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rag_chunks (
    id bigint NOT NULL,
    document_id bigint,
    text text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    embedding public.vector(1024),
    text_tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, COALESCE(text, ''::text))) STORED,
    created_at timestamp with time zone DEFAULT now(),
    embedding_v2 public.vector(1024)
);


--
-- Name: TABLE rag_chunks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.rag_chunks IS 'Trozos de texto vectorizados. Columnas id/text/metadata/embedding impuestas por LangChain.';


--
-- Name: COLUMN rag_chunks.embedding; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.rag_chunks.embedding IS 'Vector bge-m3 de 1024 dimensiones generado por Ollama en local.';


--
-- Name: COLUMN rag_chunks.text_tsv; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.rag_chunks.text_tsv IS 'Indice lexico para la mitad no-semantica de la busqueda hibrida.';


--
-- Name: COLUMN rag_chunks.embedding_v2; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.rag_chunks.embedding_v2 IS 'Optional second embedding of (context_sentence + chunk text), computed by src/rag_reembed_context.py once rag_chunk_context has a sentence for the chunk. NULL until that script runs. Kept separate from embedding (the original chunk-only vector) so the two can be A/B compared on real queries before deciding whether to switch retrieval over to it - never overwrites the original.';


--
-- Name: rag_chunks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rag_chunks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rag_chunks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rag_chunks_id_seq OWNED BY public.rag_chunks.id;


--
-- Name: rag_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rag_documents (
    document_id bigint NOT NULL,
    file_name text NOT NULL,
    file_path text NOT NULL,
    file_hash character(32),
    doc_type text,
    title text,
    authors text,
    year integer,
    doi text,
    sensitivity text DEFAULT 'INTERNAL'::text NOT NULL,
    n_chunks integer DEFAULT 0,
    indexed_at timestamp with time zone DEFAULT now(),
    text_hash character(32),
    journal text,
    n_pages integer,
    n_images integer,
    file_ext text,
    csl_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    parent_document_id bigint,
    n_chars integer,
    needs_ocr boolean DEFAULT false NOT NULL,
    metadata_source text DEFAULT 'PDF_HEURISTIC'::text NOT NULL,
    CONSTRAINT rag_documents_metadata_source_check CHECK ((metadata_source = ANY (ARRAY['PDF_HEURISTIC'::text, 'CROSSREF'::text, 'REFERENCE_MANAGER'::text, 'MANUAL'::text]))),
    CONSTRAINT rag_documents_sensitivity_check CHECK ((sensitivity = ANY (ARRAY['PUBLIC'::text, 'INTERNAL'::text, 'RESTRICTED'::text])))
);


--
-- Name: TABLE rag_documents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.rag_documents IS 'Un registro por fichero fuente indexado en el RAG. No contiene vectores.';


--
-- Name: COLUMN rag_documents.file_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.rag_documents.file_hash IS 'MD5 del binario. UNIQUE: impide indexar dos veces el mismo fichero.';


--
-- Name: COLUMN rag_documents.sensitivity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.rag_documents.sensitivity IS 'PUBLIC=paper publicado; INTERNAL=material del laboratorio; RESTRICTED=no sale nunca de la maquina.';


--
-- Name: COLUMN rag_documents.text_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.rag_documents.text_hash IS 'MD5 del titulo + los primeros 3000 caracteres normalizados. Escalon 3 anti-duplicados: sirve para documentos SIN DOI (page proofs, tesis, cuadernos).';


--
-- Name: COLUMN rag_documents.journal; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.rag_documents.journal IS 'Revista o editorial. Se guarda en columna propia porque forma parte de la cita que el agente debe dar.';


--
-- Name: COLUMN rag_documents.n_pages; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.rag_documents.n_pages IS 'Numero de paginas del documento fuente.';


--
-- Name: COLUMN rag_documents.n_images; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.rag_documents.n_images IS 'Numero de imagenes embebidas. Las imagenes NO se almacenan: sus pies de figura ya viajan como texto. Este contador deja la puerta abierta a describirlas con un VLM mas adelante.';


--
-- Name: COLUMN rag_documents.file_ext; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.rag_documents.file_ext IS 'Extension normalizada en minusculas: pdf, docx, txt, md.';


--
-- Name: COLUMN rag_documents.csl_json; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.rag_documents.csl_json IS 'Metadatos bibliograficos completos en formato CSL-JSON, el estandar que exportan Zotero y Mendeley. Lo que no se filtra ni se ordena vive aqui: volumen, paginas, ISSN, abstract, autores con afiliacion.';


--
-- Name: COLUMN rag_documents.parent_document_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.rag_documents.parent_document_id IS 'Auto-referencia. Un Supporting Information apunta al paper del que cuelga, de modo que sus trozos se citen con la referencia del articulo padre y no con el nombre del fichero.';


--
-- Name: COLUMN rag_documents.n_chars; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.rag_documents.n_chars IS 'Caracteres de texto extraibles del documento. Cero = PDF de imagenes.';


--
-- Name: COLUMN rag_documents.needs_ocr; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.rag_documents.needs_ocr IS 'TRUE si el documento no tiene texto suficiente para vectorizar. La ingesta debe saltarselo: indexarlo generaria cero trozos sin dar error.';


--
-- Name: COLUMN rag_documents.metadata_source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.rag_documents.metadata_source IS 'De donde salieron titulo/autores/anio/revista. Jerarquia: PDF_HEURISTIC < CROSSREF < REFERENCE_MANAGER < MANUAL. Una fuente inferior nunca sobrescribe a una superior.';


--
-- Name: rag_documents_document_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rag_documents_document_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rag_documents_document_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rag_documents_document_id_seq OWNED BY public.rag_documents.document_id;


--
-- Name: synthesis_experiments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.synthesis_experiments (
    sample_code character varying(50) NOT NULL,
    synthesis_date date DEFAULT CURRENT_DATE,
    synthesis_type character varying(50) DEFAULT 'ST'::character varying,
    researcher_name character varying(100) DEFAULT 'Rubén S.N.'::character varying,
    research_unit character varying(100) DEFAULT 'APMU'::character varying,
    hts_number character varying(20) DEFAULT 'N/A'::character varying,
    well_position character varying(20) DEFAULT 'N/A'::character varying,
    metal_center character varying(20) NOT NULL,
    metal_source character varying(100) NOT NULL,
    linker character varying(100) NOT NULL,
    metal_conc_m numeric(10,4),
    lm_ratio numeric(10,4),
    metal_mass_mg numeric(12,4),
    linker_mass_mg numeric(12,4),
    secondary_linker_mg numeric(10,4) DEFAULT 0,
    reactor_volume_ml numeric(10,4),
    h2o_pure_ml numeric(12,4) DEFAULT 0,
    h2o_total_ml numeric(12,4) DEFAULT 0,
    meoh_ml numeric(12,4) DEFAULT 0,
    etoh_ml numeric(12,4) DEFAULT 0,
    proh_1_ml numeric(12,4) DEFAULT 0,
    dmf_ml numeric(12,4) DEFAULT 0,
    def_ml numeric(12,4) DEFAULT 0,
    total_volume_ml numeric(12,4) NOT NULL,
    temp_initial_c numeric(6,2) DEFAULT 25.0,
    heating_time_hours numeric(6,2) DEFAULT 0.0,
    heating_rate_c_min numeric(10,4) DEFAULT 0.0,
    temp_target_c numeric(6,2) NOT NULL,
    time_hours numeric(6,2) NOT NULL,
    cooling_time_hours numeric(6,2) DEFAULT 0.0,
    cooling_rate_c_min numeric(10,4) DEFAULT 0.0,
    temp_final_c numeric(6,2) DEFAULT 25.0,
    hcl_active_mmol numeric(14,4) DEFAULT 0,
    hf_active_mmol numeric(14,4) DEFAULT 0,
    koh_active_mmol numeric(14,4) DEFAULT 0,
    formic_acid_mmol numeric(14,4) DEFAULT 0,
    acetic_acid_mmol numeric(14,4) DEFAULT 0,
    propionic_acid_mmol numeric(14,4) DEFAULT 0,
    tfa_mmol numeric(14,4) DEFAULT 0,
    cf3so3h_mmol numeric(14,4) DEFAULT 0,
    triethylamine_mmol numeric(14,4) DEFAULT 0,
    meo3s_mmol numeric(14,4) DEFAULT 0,
    file_hash_md5 character varying(64),
    measurement_status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    acoh_gl_ml numeric(12,4),
    h2po4_ml numeric(12,4),
    nh4oh_ml numeric(12,4),
    cooling_mode character varying(20),
    ramp_profile_known boolean
);


--
-- Name: TABLE synthesis_experiments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.synthesis_experiments IS 'Parent table of the project: one row per synthesis attempted, keyed on sample_code. Gathers the theoretical design, the solvents, the thermal ramp and the modulators from five years of laboratory notebooks. Written by UPSERT from notebook 01, never by DELETE, so it cannot erase rows created by the n8n workflow.';


--
-- Name: COLUMN synthesis_experiments.sample_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.synthesis_experiments.sample_code IS 'Unique sample identifier for the synthesis batch';


--
-- Name: COLUMN synthesis_experiments.synthesis_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.synthesis_experiments.synthesis_type IS 'Methodology used (HTS, ST, MW, DT)';


--
-- Name: COLUMN synthesis_experiments.researcher_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.synthesis_experiments.researcher_name IS 'Lead researcher responsible for experiment (ISO 17025 compliance)';


--
-- Name: COLUMN synthesis_experiments.research_unit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.synthesis_experiments.research_unit IS 'Research department group (APMU: Advanced Porous Materials Unit)';


--
-- Name: COLUMN synthesis_experiments.hts_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.synthesis_experiments.hts_number IS 'HTS attempt identifier (N/A for ST, DT, MW)';


--
-- Name: COLUMN synthesis_experiments.well_position; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.synthesis_experiments.well_position IS '24-well plate position (N/A for ST, DT, MW)';


--
-- Name: COLUMN synthesis_experiments.metal_center; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.synthesis_experiments.metal_center IS 'Primary metallic node element (Ni, Zr, Bi, Cu, Fe, Zn, Co, Ca, Mo, La)';


--
-- Name: COLUMN synthesis_experiments.metal_source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.synthesis_experiments.metal_source IS 'Chemical precursor salt (e.g. Ni(NO3)2·6H2O)';


--
-- Name: COLUMN synthesis_experiments.linker; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.synthesis_experiments.linker IS 'Official primary organic ligand (LIG-x, LIG-x, LIG-x, LIG-x, Tannic acid, BTBSH3, PPV)';


--
-- Name: COLUMN synthesis_experiments.lm_ratio; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.synthesis_experiments.lm_ratio IS 'Theoretical Ligand to Metal molar ratio (L/M)';


--
-- Name: COLUMN synthesis_experiments.reactor_volume_ml; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.synthesis_experiments.reactor_volume_ml IS 'Volume of reactor in milliliters';


--
-- Name: COLUMN synthesis_experiments.h2o_pure_ml; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.synthesis_experiments.h2o_pure_ml IS 'Pure deionized water volume added as solvent (mL)';


--
-- Name: COLUMN synthesis_experiments.h2o_total_ml; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.synthesis_experiments.h2o_total_ml IS 'Total homogenized water volume (Pure + aqueous solutions)';


--
-- Name: COLUMN synthesis_experiments.total_volume_ml; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.synthesis_experiments.total_volume_ml IS 'Total reaction liquid volume (V_total)';


--
-- Name: COLUMN synthesis_experiments.heating_rate_c_min; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.synthesis_experiments.heating_rate_c_min IS 'Heating rate in °C/min = (T - Ti) / heating time. NULL when the heating time was not written (never imputed in the database).';


--
-- Name: COLUMN synthesis_experiments.temp_target_c; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.synthesis_experiments.temp_target_c IS 'Maximum reaction temperature setpoint (°C)';


--
-- Name: COLUMN synthesis_experiments.time_hours; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.synthesis_experiments.time_hours IS 'Isothermal reaction duration (hours)';


--
-- Name: COLUMN synthesis_experiments.cooling_rate_c_min; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.synthesis_experiments.cooling_rate_c_min IS 'Cooling rate in °C/min = (T - Tf) / cooling time. NULL when the cooling time was not written; see cooling_mode for how it cooled.';


--
-- Name: COLUMN synthesis_experiments.hcl_active_mmol; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.synthesis_experiments.hcl_active_mmol IS 'Total active HCl modulator in millimoles';


--
-- Name: COLUMN synthesis_experiments.file_hash_md5; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.synthesis_experiments.file_hash_md5 IS 'MD5 checksum for anti-duplication data quality gate';


--
-- Name: COLUMN synthesis_experiments.measurement_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.synthesis_experiments.measurement_status IS 'Measurement audit state: active or superseded';


--
-- Name: COLUMN synthesis_experiments.acoh_gl_ml; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.synthesis_experiments.acoh_gl_ml IS 'Acido acetico glacial anadido, en mL. Cuenta DOS veces en v_ml_features y a proposito: es disolvente (lo es) y a la vez modulador carboxilico (x 17,4855 mmol/mL, su molaridad como liquido puro). Dejarlo fuera de cualquiera de los dos sitios describe mal el medio.';


--
-- Name: COLUMN synthesis_experiments.h2po4_ml; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.synthesis_experiments.h2po4_ml IS 'Acido fosforico anadido, en mL. En algunas sintesis constituye el volumen entero de reaccion, asi que sin esta columna sus fracciones de disolvente sumaban cero.';


--
-- Name: COLUMN synthesis_experiments.nh4oh_ml; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.synthesis_experiments.nh4oh_ml IS 'Hidroxido de amonio anadido, en mL. Del bloque Q:AB del Excel maestro, es decir en mililitros, no en microlitros.';


--
-- Name: COLUMN synthesis_experiments.cooling_mode; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.synthesis_experiments.cooling_mode IS 'Cooling regime parsed from the ramp text: programmed (explicit time), fan_asap (microwave fan, 10 min), free_oven_off (ends in r.t. with no time: oven switched off, natural cooling), NULL (no cooling stage written).';


--
-- Name: COLUMN synthesis_experiments.ramp_profile_known; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.synthesis_experiments.ramp_profile_known IS 'TRUE only when both the heating and the cooling durations were written in the notebook. FALSE means at least one rate is NULL because it was never recorded.';


--
-- Name: v_agente_muestras; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_agente_muestras AS
 SELECT s.sample_code,
    s.synthesis_date,
    s.researcher_name,
    s.metal_center,
    s.linker,
    count(DISTINCT m.technique) AS n_tecnicas,
    array_agg(DISTINCT m.technique) FILTER (WHERE (m.technique IS NOT NULL)) AS tecnicas
   FROM (public.synthesis_experiments s
     LEFT JOIN public.characterization_measurements m ON (((m.sample_code)::text = (s.sample_code)::text)))
  GROUP BY s.sample_code, s.synthesis_date, s.researcher_name, s.metal_center, s.linker;


--
-- Name: VIEW v_agente_muestras; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_agente_muestras IS 'Read-only view for the RAG agent. n_tecnicas is the weak label of experimental interest. Duplicate of v_agent_samples, kept only until callers are migrated.';


--
-- Name: v_agent_samples; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_agent_samples AS
 SELECT sample_code,
    synthesis_date,
    researcher_name,
    metal_center,
    linker,
    n_tecnicas,
    tecnicas
   FROM public.v_agente_muestras;


--
-- Name: VIEW v_agent_samples; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_agent_samples IS 'One row per synthesised sample with its metal, linker, date and how many characterisation techniques it has.';


--
-- Name: v_ml_deployed; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_ml_deployed AS
 SELECT m.deployment_slot,
    m.model_slug,
    m.display_name,
    m.status,
    m.algorithm,
    m.git_commit,
    m.source_notebook,
    d.dataset_slug,
    d.n_rows,
    d.n_groups,
    (a.model_id IS NOT NULL) AS has_artifact,
    a.artifact_sha256
   FROM ((public.ml_models m
     LEFT JOIN public.ml_datasets d ON ((d.dataset_id = m.dataset_id)))
     LEFT JOIN public.ml_model_artifacts a ON ((a.model_id = m.model_id)))
  WHERE (m.deployment_slot IS NOT NULL)
  ORDER BY m.deployment_slot;


--
-- Name: VIEW v_ml_deployed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_ml_deployed IS 'The models being served right now, and in which role. One row per deployment slot; if it is empty, nothing is deployed.';


--
-- Name: v_ml_features; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_ml_features AS
 WITH base AS (
         SELECT s.sample_code,
            s.synthesis_date,
            s.synthesis_type,
            s.researcher_name,
            s.research_unit,
            s.hts_number,
            s.well_position,
            s.metal_center,
            s.metal_source,
            s.linker,
            s.metal_conc_m,
            s.lm_ratio,
            s.metal_mass_mg,
            s.linker_mass_mg,
            s.secondary_linker_mg,
            s.reactor_volume_ml,
            s.h2o_pure_ml,
            s.h2o_total_ml,
            s.meoh_ml,
            s.etoh_ml,
            s.proh_1_ml,
            s.dmf_ml,
            s.def_ml,
            s.total_volume_ml,
            s.temp_initial_c,
            s.heating_time_hours,
            s.heating_rate_c_min,
            s.temp_target_c,
            s.time_hours,
            s.cooling_time_hours,
            s.cooling_rate_c_min,
            s.temp_final_c,
            s.hcl_active_mmol,
            s.hf_active_mmol,
            s.koh_active_mmol,
            s.formic_acid_mmol,
            s.acetic_acid_mmol,
            s.propionic_acid_mmol,
            s.tfa_mmol,
            s.cf3so3h_mmol,
            s.triethylamine_mmol,
            s.meo3s_mmol,
            s.file_hash_md5,
            s.measurement_status,
            s.created_at,
            s.updated_at,
            s.acoh_gl_ml,
            s.h2po4_ml,
            s.nh4oh_ml,
            regexp_replace(btrim(replace((s.metal_source)::text, chr(160), ' '::text)), '\s+'::text, ' '::text, 'g'::text) AS metal_source_norm,
            (COALESCE(s.acoh_gl_ml, (0)::numeric) * 17.4855) AS acoh_mmol,
            (((COALESCE(s.formic_acid_mmol, (0)::numeric) + COALESCE(s.acetic_acid_mmol, (0)::numeric)) + COALESCE(s.propionic_acid_mmol, (0)::numeric)) + (COALESCE(s.acoh_gl_ml, (0)::numeric) * 17.4855)) AS m_carbox,
            (((COALESCE(s.hcl_active_mmol, (0)::numeric) + COALESCE(s.tfa_mmol, (0)::numeric)) + COALESCE(s.cf3so3h_mmol, (0)::numeric)) + COALESCE(s.meo3s_mmol, (0)::numeric)) AS m_strong,
            COALESCE(s.hf_active_mmol, (0)::numeric) AS m_hf,
            (COALESCE(s.koh_active_mmol, (0)::numeric) + COALESCE(s.triethylamine_mmol, (0)::numeric)) AS m_base,
            ((COALESCE(s.hf_active_mmol, (0)::numeric) + COALESCE(s.tfa_mmol, (0)::numeric)) + COALESCE(s.cf3so3h_mmol, (0)::numeric)) AS m_fluor,
            ((((((((((COALESCE(s.formic_acid_mmol, (0)::numeric) * (100)::numeric) * 46.03) / (1.220 * 98.0)) + (((COALESCE(s.acetic_acid_mmol, (0)::numeric) * (100)::numeric) * 60.05) / (1.050 * 99.8))) + (((COALESCE(s.propionic_acid_mmol, (0)::numeric) * (100)::numeric) * 74.08) / (0.990 * 99.5))) + (((COALESCE(s.tfa_mmol, (0)::numeric) * (100)::numeric) * 114.02) / (1.490 * 99.0))) + (((COALESCE(s.cf3so3h_mmol, (0)::numeric) * (100)::numeric) * 150.08) / (1.700 * 99.0))) + (((COALESCE(s.triethylamine_mmol, (0)::numeric) * (100)::numeric) * 101.19) / (0.726 * 99.5))) + (((COALESCE(s.meo3s_mmol, (0)::numeric) * (100)::numeric) * 96.11) / (1.480 * 99.5))) / 1000.0) AS mod_volume_ml,
            ((((((((COALESCE(s.h2o_total_ml, (0)::numeric) + COALESCE(s.meoh_ml, (0)::numeric)) + COALESCE(s.etoh_ml, (0)::numeric)) + COALESCE(s.proh_1_ml, (0)::numeric)) + COALESCE(s.dmf_ml, (0)::numeric)) + COALESCE(s.def_ml, (0)::numeric)) + COALESCE(s.acoh_gl_ml, (0)::numeric)) + COALESCE(s.h2po4_ml, (0)::numeric)) + COALESCE(s.nh4oh_ml, (0)::numeric)) AS solv_sum_ml
           FROM public.synthesis_experiments s
        ), vol AS (
         SELECT b.sample_code,
            b.synthesis_date,
            b.synthesis_type,
            b.researcher_name,
            b.research_unit,
            b.hts_number,
            b.well_position,
            b.metal_center,
            b.metal_source,
            b.linker,
            b.metal_conc_m,
            b.lm_ratio,
            b.metal_mass_mg,
            b.linker_mass_mg,
            b.secondary_linker_mg,
            b.reactor_volume_ml,
            b.h2o_pure_ml,
            b.h2o_total_ml,
            b.meoh_ml,
            b.etoh_ml,
            b.proh_1_ml,
            b.dmf_ml,
            b.def_ml,
            b.total_volume_ml,
            b.temp_initial_c,
            b.heating_time_hours,
            b.heating_rate_c_min,
            b.temp_target_c,
            b.time_hours,
            b.cooling_time_hours,
            b.cooling_rate_c_min,
            b.temp_final_c,
            b.hcl_active_mmol,
            b.hf_active_mmol,
            b.koh_active_mmol,
            b.formic_acid_mmol,
            b.acetic_acid_mmol,
            b.propionic_acid_mmol,
            b.tfa_mmol,
            b.cf3so3h_mmol,
            b.triethylamine_mmol,
            b.meo3s_mmol,
            b.file_hash_md5,
            b.measurement_status,
            b.created_at,
            b.updated_at,
            b.acoh_gl_ml,
            b.h2po4_ml,
            b.nh4oh_ml,
            b.metal_source_norm,
            b.acoh_mmol,
            b.m_carbox,
            b.m_strong,
            b.m_hf,
            b.m_base,
            b.m_fluor,
            b.mod_volume_ml,
            b.solv_sum_ml,
            (1.0 - ((b.solv_sum_ml + b.mod_volume_ml) / NULLIF(b.total_volume_ml, (0)::numeric))) AS residual_frac
           FROM base b
        )
 SELECT v.sample_code,
    v.hts_number,
    v.synthesis_date,
    v.metal_center,
    v.linker,
    v.metal_source,
    v.synthesis_type,
    ep.electronegativity_pauling,
    ep.electronegativity_allen,
    ep.absolute_hardness_ev,
    ep.oxophilicity_kepp,
    ep.polarizability_a3,
    mso.oxidation_state,
    ip.shannon_radius_pm,
    ip.charge_over_radius,
    lp.scaffold,
    lp.protection_state,
    lp.denticity,
    lp.n_acidic_protons,
    lp.max_donor_distance_a,
    lp.n_rotatable_bonds,
    v.metal_conc_m,
    v.lm_ratio,
    v.temp_target_c,
    v.time_hours,
    v.heating_rate_c_min,
    v.cooling_rate_c_min,
    v.total_volume_ml,
    v.reactor_volume_ml,
    (v.total_volume_ml / NULLIF(v.reactor_volume_ml, (0)::numeric)) AS fill_fraction,
        CASE
            WHEN (abs(v.residual_frac) > 0.05) THEN NULL::numeric
            ELSE (v.h2o_total_ml / NULLIF(v.total_volume_ml, (0)::numeric))
        END AS frac_h2o,
        CASE
            WHEN (abs(v.residual_frac) > 0.05) THEN NULL::numeric
            ELSE (v.meoh_ml / NULLIF(v.total_volume_ml, (0)::numeric))
        END AS frac_meoh,
        CASE
            WHEN (abs(v.residual_frac) > 0.05) THEN NULL::numeric
            ELSE (v.etoh_ml / NULLIF(v.total_volume_ml, (0)::numeric))
        END AS frac_etoh,
        CASE
            WHEN (abs(v.residual_frac) > 0.05) THEN NULL::numeric
            ELSE (v.proh_1_ml / NULLIF(v.total_volume_ml, (0)::numeric))
        END AS frac_proh,
        CASE
            WHEN (abs(v.residual_frac) > 0.05) THEN NULL::numeric
            ELSE (v.dmf_ml / NULLIF(v.total_volume_ml, (0)::numeric))
        END AS frac_dmf,
        CASE
            WHEN (abs(v.residual_frac) > 0.05) THEN NULL::numeric
            ELSE (v.def_ml / NULLIF(v.total_volume_ml, (0)::numeric))
        END AS frac_def,
        CASE
            WHEN (abs(v.residual_frac) > 0.05) THEN NULL::numeric
            ELSE (COALESCE(v.acoh_gl_ml, (0)::numeric) / NULLIF(v.total_volume_ml, (0)::numeric))
        END AS frac_acoh,
        CASE
            WHEN (abs(v.residual_frac) > 0.05) THEN NULL::numeric
            ELSE (COALESCE(v.h2po4_ml, (0)::numeric) / NULLIF(v.total_volume_ml, (0)::numeric))
        END AS frac_h2po4,
        CASE
            WHEN (abs(v.residual_frac) > 0.05) THEN NULL::numeric
            ELSE (COALESCE(v.nh4oh_ml, (0)::numeric) / NULLIF(v.total_volume_ml, (0)::numeric))
        END AS frac_nh4oh,
        CASE
            WHEN (abs(v.residual_frac) > 0.05) THEN NULL::numeric
            ELSE (v.mod_volume_ml / NULLIF(v.total_volume_ml, (0)::numeric))
        END AS frac_modulator,
    (abs(v.residual_frac) <= 0.05) AS solvent_breakdown_complete,
    v.m_carbox AS mod_carboxylic_mmol,
    v.m_strong AS mod_strong_acid_mmol,
    v.m_hf AS mod_hf_mmol,
    v.m_base AS mod_base_mmol,
    v.m_fluor AS mod_fluorinated_mmol,
    (((v.m_carbox + v.m_strong) + v.m_hf) + v.m_base) AS mod_total_mmol,
    ((((3.75 * COALESCE(v.formic_acid_mmol, (0)::numeric)) + (4.76 * (COALESCE(v.acetic_acid_mmol, (0)::numeric) + v.acoh_mmol))) + (4.87 * COALESCE(v.propionic_acid_mmol, (0)::numeric))) / NULLIF(v.m_carbox, (0)::numeric)) AS mod_carbox_mean_pka,
    (((('-0.54'::numeric * COALESCE(v.formic_acid_mmol, (0)::numeric)) + ('-0.17'::numeric * (COALESCE(v.acetic_acid_mmol, (0)::numeric) + v.acoh_mmol))) + (0.33 * COALESCE(v.propionic_acid_mmol, (0)::numeric))) / NULLIF(v.m_carbox, (0)::numeric)) AS mod_carbox_mean_logp
   FROM ((((vol v
     LEFT JOIN public.linker_properties lp ON (((lp.linker_code)::text = (v.linker)::text)))
     LEFT JOIN public.metal_source_oxidation_state mso ON ((regexp_replace(btrim(replace((mso.metal_source)::text, chr(160), ' '::text)), '\s+'::text, ' '::text, 'g'::text) = v.metal_source_norm)))
     LEFT JOIN public.element_properties ep ON (((ep.symbol)::text = (v.metal_center)::text)))
     LEFT JOIN public.ion_properties ip ON ((((ip.symbol)::text = (mso.symbol)::text) AND (ip.oxidation_state = mso.oxidation_state) AND (ip.coordination_number = 6))))
  WHERE (((v.synthesis_type)::text <> ALL ((ARRAY['REFERENCE'::character varying, 'PENDING_RECORD'::character varying])::text[])) AND ((v.metal_center)::text <> '-'::text));


--
-- Name: VIEW v_ml_features; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_ml_features IS 'Feature table for machine learning (v3, 2026-09-02). Against v2: corrected volume units — the dilute stock solutions in the spreadsheet (HCl 0.6M, HCl 3M, HF 3M) are recorded in mL and not uL, and their water now enters the balance — plus three recovered solvent columns (glacial AcOH, H2PO4, NH4OH). Glacial acetic acid counts both as a solvent and as a carboxylic modulator.';


--
-- Name: COLUMN v_ml_features.frac_acoh; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.v_ml_features.frac_acoh IS 'Fraccion del volumen total que es acido acetico glacial. Suma 1 junto a las otras nueve fracciones cuando solvent_breakdown_complete es TRUE.';


--
-- Name: COLUMN v_ml_features.frac_h2po4; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.v_ml_features.frac_h2po4 IS 'Fraccion del volumen total que es acido fosforico. Puede valer 1: hay sintesis cuyo medio es integramente H3PO4.';


--
-- Name: COLUMN v_ml_features.frac_nh4oh; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.v_ml_features.frac_nh4oh IS 'Fraccion del volumen total que es hidroxido de amonio.';


--
-- Name: v_ml_model_input_contract; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_ml_model_input_contract AS
 SELECT m.model_slug,
    m.status,
    m.algorithm,
    f.feature_position,
    f.feature_name,
    f.feature_block,
    f.importance
   FROM (public.ml_models m
     JOIN public.ml_model_features f ON ((f.model_id = m.model_id)))
  WHERE ((f.feature_role)::text = 'input'::text)
  ORDER BY m.model_slug, f.feature_position;


--
-- Name: VIEW v_ml_model_input_contract; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_ml_model_input_contract IS 'The input columns of every model, in the exact order they must be supplied. This is what any service loading a model from the registry must read; do not hard-code the list.';


--
-- Name: COLUMN v_ml_model_input_contract.model_slug; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.v_ml_model_input_contract.model_slug IS 'Identificador estable del modelo, el mismo de ml_models.model_slug.';


--
-- Name: COLUMN v_ml_model_input_contract.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.v_ml_model_input_contract.status IS 'Estado del modelo: active, superseded o invalid. Servir uno que no este active deberia ser una decision explicita, no un descuido.';


--
-- Name: COLUMN v_ml_model_input_contract.algorithm; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.v_ml_model_input_contract.algorithm IS 'Clase del estimador final del pipeline, p. ej. RandomForestClassifier.';


--
-- Name: COLUMN v_ml_model_input_contract.feature_position; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.v_ml_model_input_contract.feature_position IS 'Posicion 0-based de la columna. ORDER BY por esta columna es obligatorio: sin el, el orden de las filas no esta garantizado y el modelo puede predecir con las columnas cruzadas sin dar error.';


--
-- Name: COLUMN v_ml_model_input_contract.feature_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.v_ml_model_input_contract.feature_name IS 'Nombre de la columna tal y como debe aparecer en el DataFrame de entrada.';


--
-- Name: COLUMN v_ml_model_input_contract.feature_block; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.v_ml_model_input_contract.feature_block IS 'Bloque quimico al que pertenece: metal chemistry, linker chemistry, process o stoichiometry & medium. Sirve para agrupar la interpretacion.';


--
-- Name: COLUMN v_ml_model_input_contract.importance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.v_ml_model_input_contract.importance IS 'Caida del F1 macro al barajar esa columna (permutation importance). Un valor NEGATIVO significa que barajarla mejora el modelo: es ruido, no señal.';


--
-- Name: v_ml_model_registry; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_ml_model_registry AS
SELECT
    NULL::integer AS model_id,
    NULL::character varying(80) AS model_slug,
    NULL::text AS display_name,
    NULL::character varying(20) AS status,
    NULL::boolean AS is_reproducible,
    NULL::character varying(80) AS algorithm,
    NULL::character varying(40) AS library,
    NULL::date AS created_on,
    NULL::character varying(80) AS dataset_slug,
    NULL::integer AS n_rows,
    NULL::integer AS n_groups,
    NULL::double precision AS f1_macro_cv,
    NULL::double precision AS mcc_cv,
    NULL::boolean AS has_artifact,
    NULL::text AS artifact_size,
    NULL::character varying(50) AS git_commit,
    NULL::text AS source_notebook,
    NULL::text AS notes;


--
-- Name: VIEW v_ml_model_registry; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_ml_model_registry IS 'The model registry in readable form, without the binaries: which models exist, on what data, with what result, and whether they are still reproducible.';


--
-- Name: v_pxrd_labels_full; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_pxrd_labels_full AS
 SELECT l.file_hash,
    l.sample_code,
    l.file_name,
    l.label_value,
    l.confidence,
    l.notes,
    l.labeled_by,
    l.labeled_at,
    l.updated_at,
    s.metal_center,
    s.linker,
    s.temp_target_c,
    s.time_hours,
    (l.measurement_id IS NULL) AS needs_relink
   FROM (public.pxrd_labels l
     LEFT JOIN public.synthesis_experiments s ON (((s.sample_code)::text = (l.sample_code)::text)))
  WHERE ((l.label_type)::text = 'crystallinity_class'::text);


--
-- Name: VIEW v_pxrd_labels_full; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_pxrd_labels_full IS 'Crystallinity labels joined to the synthesis conditions they belong to. needs_relink flags labels orphaned by a re-ingestion.';


--
-- Name: v_rag_biblioteca; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_rag_biblioteca AS
 SELECT d.document_id,
    d.file_name,
    d.doc_type,
    d.sensitivity,
    d.title,
    d.authors,
    d.year,
    d.journal,
    d.doi,
    d.n_chunks,
    d.n_pages,
    d.n_images,
    d.parent_document_id,
    p.title AS parent_title,
    p.doi AS parent_doi,
    COALESCE(NULLIF(TRIM(BOTH FROM concat_ws(' '::text, NULLIF(d.authors, ''::text),
        CASE
            WHEN (d.year IS NOT NULL) THEN (('('::text || d.year) || ').'::text)
            ELSE NULL::text
        END, NULLIF(d.title, ''::text), NULLIF(d.journal, ''::text),
        CASE
            WHEN (d.doi IS NOT NULL) THEN ('DOI: '::text || d.doi)
            ELSE NULL::text
        END)), ''::text), d.file_name) AS cita
   FROM (public.rag_documents d
     LEFT JOIN public.rag_documents p ON ((p.document_id = d.parent_document_id)));


--
-- Name: VIEW v_rag_biblioteca; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_rag_biblioteca IS 'Corpus catalogue with the citation already assembled. Read-only tool for the agent so it never invents a reference. Duplicate of v_rag_library, kept only until callers are migrated.';


--
-- Name: v_rag_library; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_rag_library AS
 SELECT document_id,
    file_name,
    doc_type,
    sensitivity,
    title,
    authors,
    year,
    journal,
    doi,
    n_chunks,
    n_pages,
    n_images,
    parent_document_id,
    parent_title,
    parent_doi,
    cita
   FROM public.v_rag_biblioteca;


--
-- Name: VIEW v_rag_library; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_rag_library IS 'Corpus catalogue with the citation already assembled. Read-only tool for the agent so it never invents a reference.';


--
-- Name: agent_chat_log chat_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_chat_log ALTER COLUMN chat_id SET DEFAULT nextval('public.agent_chat_log_chat_id_seq'::regclass);


--
-- Name: ai_agent_calls call_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_agent_calls ALTER COLUMN call_id SET DEFAULT nextval('public.ai_agent_calls_call_id_seq'::regclass);


--
-- Name: job_leads lead_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_leads ALTER COLUMN lead_id SET DEFAULT nextval('public.job_leads_lead_id_seq'::regclass);


--
-- Name: kg_edges edge_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kg_edges ALTER COLUMN edge_id SET DEFAULT nextval('public.kg_edges_edge_id_seq'::regclass);


--
-- Name: ml_datasets dataset_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ml_datasets ALTER COLUMN dataset_id SET DEFAULT nextval('public.ml_datasets_dataset_id_seq'::regclass);


--
-- Name: ml_models model_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ml_models ALTER COLUMN model_id SET DEFAULT nextval('public.ml_models_model_id_seq'::regclass);


--
-- Name: rag_chunks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_chunks ALTER COLUMN id SET DEFAULT nextval('public.rag_chunks_id_seq'::regclass);


--
-- Name: rag_documents document_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_documents ALTER COLUMN document_id SET DEFAULT nextval('public.rag_documents_document_id_seq'::regclass);


--
-- Name: agent_chat_log agent_chat_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_chat_log
    ADD CONSTRAINT agent_chat_log_pkey PRIMARY KEY (chat_id);


--
-- Name: agent_owner_secret agent_owner_secret_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_owner_secret
    ADD CONSTRAINT agent_owner_secret_pkey PRIMARY KEY (token_hash);


--
-- Name: ai_agent_calls ai_agent_calls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_agent_calls
    ADD CONSTRAINT ai_agent_calls_pkey PRIMARY KEY (call_id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (log_id);


--
-- Name: authorized_researchers authorized_researchers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.authorized_researchers
    ADD CONSTRAINT authorized_researchers_pkey PRIMARY KEY (email);


--
-- Name: characterization_measurements characterization_measurements_new_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characterization_measurements
    ADD CONSTRAINT characterization_measurements_new_pkey PRIMARY KEY (measurement_id);


--
-- Name: characterization_measurements_test characterization_measurements_test_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characterization_measurements_test
    ADD CONSTRAINT characterization_measurements_test_pkey PRIMARY KEY (measurement_id);


--
-- Name: data_dictionary data_dictionary_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_dictionary
    ADD CONSTRAINT data_dictionary_pkey PRIMARY KEY (id);


--
-- Name: element_properties element_properties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.element_properties
    ADD CONSTRAINT element_properties_pkey PRIMARY KEY (symbol);


--
-- Name: ion_properties ion_properties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ion_properties
    ADD CONSTRAINT ion_properties_pkey PRIMARY KEY (symbol, oxidation_state, coordination_number, spin_state);


--
-- Name: job_leads job_leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_leads
    ADD CONSTRAINT job_leads_pkey PRIMARY KEY (lead_id);


--
-- Name: kg_edges kg_edges_from_node_to_node_edge_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kg_edges
    ADD CONSTRAINT kg_edges_from_node_to_node_edge_type_key UNIQUE (from_node, to_node, edge_type);


--
-- Name: kg_edges kg_edges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kg_edges
    ADD CONSTRAINT kg_edges_pkey PRIMARY KEY (edge_id);


--
-- Name: kg_nodes kg_nodes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kg_nodes
    ADD CONSTRAINT kg_nodes_pkey PRIMARY KEY (node_id);


--
-- Name: linker_properties linker_properties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linker_properties
    ADD CONSTRAINT linker_properties_pkey PRIMARY KEY (linker_code);


--
-- Name: metal_source_oxidation_state metal_source_oxidation_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metal_source_oxidation_state
    ADD CONSTRAINT metal_source_oxidation_state_pkey PRIMARY KEY (metal_source);


--
-- Name: ml_datasets ml_datasets_dataset_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ml_datasets
    ADD CONSTRAINT ml_datasets_dataset_slug_key UNIQUE (dataset_slug);


--
-- Name: ml_datasets ml_datasets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ml_datasets
    ADD CONSTRAINT ml_datasets_pkey PRIMARY KEY (dataset_id);


--
-- Name: ml_model_artifacts ml_model_artifacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ml_model_artifacts
    ADD CONSTRAINT ml_model_artifacts_pkey PRIMARY KEY (model_id);


--
-- Name: ml_model_features ml_model_features_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ml_model_features
    ADD CONSTRAINT ml_model_features_pkey PRIMARY KEY (model_id, feature_name);


--
-- Name: ml_model_metrics ml_model_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ml_model_metrics
    ADD CONSTRAINT ml_model_metrics_pkey PRIMARY KEY (model_id, metric_name, split, class_name);


--
-- Name: ml_models ml_models_model_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ml_models
    ADD CONSTRAINT ml_models_model_slug_key UNIQUE (model_slug);


--
-- Name: ml_models ml_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ml_models
    ADD CONSTRAINT ml_models_pkey PRIMARY KEY (model_id);


--
-- Name: property_sources property_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_sources
    ADD CONSTRAINT property_sources_pkey PRIMARY KEY (property_name);


--
-- Name: pxrd_descriptors pxrd_descriptors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pxrd_descriptors
    ADD CONSTRAINT pxrd_descriptors_pkey PRIMARY KEY (measurement_id);


--
-- Name: pxrd_labels pxrd_labels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pxrd_labels
    ADD CONSTRAINT pxrd_labels_pkey PRIMARY KEY (file_hash, label_type);


--
-- Name: rag_chunk_context rag_chunk_context_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_chunk_context
    ADD CONSTRAINT rag_chunk_context_pkey PRIMARY KEY (chunk_id);


--
-- Name: rag_chunks rag_chunks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_chunks
    ADD CONSTRAINT rag_chunks_pkey PRIMARY KEY (id);


--
-- Name: rag_documents rag_documents_file_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_documents
    ADD CONSTRAINT rag_documents_file_hash_key UNIQUE (file_hash);


--
-- Name: rag_documents rag_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_documents
    ADD CONSTRAINT rag_documents_pkey PRIMARY KEY (document_id);


--
-- Name: synthesis_experiments synthesis_experiments_file_hash_md5_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.synthesis_experiments
    ADD CONSTRAINT synthesis_experiments_file_hash_md5_key UNIQUE (file_hash_md5);


--
-- Name: synthesis_experiments synthesis_experiments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.synthesis_experiments
    ADD CONSTRAINT synthesis_experiments_pkey PRIMARY KEY (sample_code);


--
-- Name: characterization_measurements_test_data_json_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX characterization_measurements_test_data_json_idx ON public.characterization_measurements_test USING gin (data_json);


--
-- Name: characterization_measurements_test_file_hash_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX characterization_measurements_test_file_hash_idx ON public.characterization_measurements_test USING btree (file_hash);


--
-- Name: characterization_measurements_test_measurement_tag_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX characterization_measurements_test_measurement_tag_idx ON public.characterization_measurements_test USING btree (measurement_tag);


--
-- Name: characterization_measurements_test_researcher_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX characterization_measurements_test_researcher_email_idx ON public.characterization_measurements_test USING btree (researcher_email);


--
-- Name: characterization_measurements_test_researcher_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX characterization_measurements_test_researcher_name_idx ON public.characterization_measurements_test USING btree (researcher_name);


--
-- Name: characterization_measurements_test_sample_code_technique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX characterization_measurements_test_sample_code_technique_idx ON public.characterization_measurements_test USING btree (sample_code, technique);


--
-- Name: data_dictionary_table_column_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX data_dictionary_table_column_key ON public.data_dictionary USING btree (table_name, column_name);


--
-- Name: idx_agent_chat_log_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_chat_log_actor ON public.agent_chat_log USING btree (actor_email);


--
-- Name: idx_agent_chat_log_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_chat_log_session ON public.agent_chat_log USING btree (session_id);


--
-- Name: idx_ai_agent_calls_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_agent_calls_created ON public.ai_agent_calls USING btree (created_at);


--
-- Name: idx_ai_agent_calls_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_agent_calls_provider ON public.ai_agent_calls USING btree (model_provider, is_fallback);


--
-- Name: idx_audit_log_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_actor ON public.audit_log USING btree (actor_email);


--
-- Name: idx_audit_log_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_session ON public.audit_log USING btree (session_id);


--
-- Name: idx_char_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_char_email ON public.characterization_measurements USING btree (researcher_email);


--
-- Name: idx_char_file_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_char_file_hash ON public.characterization_measurements USING btree (file_hash);


--
-- Name: idx_char_jsonb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_char_jsonb ON public.characterization_measurements USING gin (data_json);


--
-- Name: idx_char_researcher; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_char_researcher ON public.characterization_measurements USING btree (researcher_name);


--
-- Name: idx_char_sample_tech; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_char_sample_tech ON public.characterization_measurements USING btree (sample_code, technique);


--
-- Name: idx_char_tag; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_char_tag ON public.characterization_measurements USING btree (measurement_tag);


--
-- Name: idx_job_leads_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_leads_created_at ON public.job_leads USING btree (created_at DESC);


--
-- Name: idx_job_leads_job_url; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_job_leads_job_url ON public.job_leads USING btree (job_url) WHERE (job_url IS NOT NULL);


--
-- Name: idx_job_leads_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_leads_status ON public.job_leads USING btree (status);


--
-- Name: idx_kg_edges_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kg_edges_from ON public.kg_edges USING btree (from_node);


--
-- Name: idx_kg_edges_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kg_edges_to ON public.kg_edges USING btree (to_node);


--
-- Name: idx_kg_edges_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kg_edges_type ON public.kg_edges USING btree (edge_type);


--
-- Name: idx_kg_nodes_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kg_nodes_type ON public.kg_nodes USING btree (node_type);


--
-- Name: idx_pxrd_desc_dmax; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pxrd_desc_dmax ON public.pxrd_descriptors USING btree (d_max_angstrom);


--
-- Name: idx_pxrd_desc_sample; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pxrd_desc_sample ON public.pxrd_descriptors USING btree (sample_code);


--
-- Name: idx_pxrd_desc_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pxrd_desc_version ON public.pxrd_descriptors USING btree (pipeline_version);


--
-- Name: idx_pxrd_desc_xc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pxrd_desc_xc ON public.pxrd_descriptors USING btree (crystalline_fraction);


--
-- Name: idx_pxrd_labels_meas; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pxrd_labels_meas ON public.pxrd_labels USING btree (measurement_id);


--
-- Name: idx_pxrd_labels_sample; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pxrd_labels_sample ON public.pxrd_labels USING btree (sample_code);


--
-- Name: idx_pxrd_labels_value; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pxrd_labels_value ON public.pxrd_labels USING btree (label_type, label_value);


--
-- Name: idx_rag_chunks_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rag_chunks_document_id ON public.rag_chunks USING btree (document_id);


--
-- Name: idx_rag_chunks_embedding_hnsw; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rag_chunks_embedding_hnsw ON public.rag_chunks USING hnsw (embedding public.vector_cosine_ops);


--
-- Name: idx_rag_chunks_metadata; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rag_chunks_metadata ON public.rag_chunks USING gin (metadata);


--
-- Name: idx_rag_chunks_tsv; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rag_chunks_tsv ON public.rag_chunks USING gin (text_tsv);


--
-- Name: idx_rag_documents_csl; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rag_documents_csl ON public.rag_documents USING gin (csl_json);


--
-- Name: idx_rag_documents_doi; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_rag_documents_doi ON public.rag_documents USING btree (lower(doi)) WHERE (doi IS NOT NULL);


--
-- Name: idx_rag_documents_needs_ocr; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rag_documents_needs_ocr ON public.rag_documents USING btree (needs_ocr) WHERE needs_ocr;


--
-- Name: idx_rag_documents_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rag_documents_parent ON public.rag_documents USING btree (parent_document_id);


--
-- Name: idx_rag_documents_text_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_rag_documents_text_hash ON public.rag_documents USING btree (text_hash) WHERE (text_hash IS NOT NULL);


--
-- Name: ml_models_slot_unico; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ml_models_slot_unico ON public.ml_models USING btree (deployment_slot) WHERE (deployment_slot IS NOT NULL);


--
-- Name: ux_ml_model_features_position; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_ml_model_features_position ON public.ml_model_features USING btree (model_id, feature_position) WHERE (feature_position IS NOT NULL);


--
-- Name: v_ml_model_registry _RETURN; Type: RULE; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW public.v_ml_model_registry AS
 SELECT m.model_id,
    m.model_slug,
    m.display_name,
    m.status,
    m.is_reproducible,
    m.algorithm,
    m.library,
    (m.created_at)::date AS created_on,
    d.dataset_slug,
    d.n_rows,
    d.n_groups,
    max(mt.metric_value) FILTER (WHERE (((mt.metric_name)::text = 'f1_macro'::text) AND ((mt.split)::text = 'cv'::text))) AS f1_macro_cv,
    max(mt.metric_value) FILTER (WHERE (((mt.metric_name)::text = 'matthews_corrcoef'::text) AND ((mt.split)::text = 'cv'::text))) AS mcc_cv,
    (a.model_id IS NOT NULL) AS has_artifact,
    pg_size_pretty(a.artifact_size_bytes) AS artifact_size,
    m.git_commit,
    m.source_notebook,
    m.notes
   FROM (((public.ml_models m
     LEFT JOIN public.ml_datasets d ON ((d.dataset_id = m.dataset_id)))
     LEFT JOIN public.ml_model_metrics mt ON ((mt.model_id = m.model_id)))
     LEFT JOIN public.ml_model_artifacts a ON ((a.model_id = m.model_id)))
  GROUP BY m.model_id, d.dataset_slug, d.n_rows, d.n_groups, a.model_id, a.artifact_size_bytes
  ORDER BY m.created_at DESC;


--
-- Name: characterization_measurements characterization_measurements_new_sample_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characterization_measurements
    ADD CONSTRAINT characterization_measurements_new_sample_code_fkey FOREIGN KEY (sample_code) REFERENCES public.synthesis_experiments(sample_code) ON DELETE CASCADE;


--
-- Name: ion_properties ion_properties_symbol_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ion_properties
    ADD CONSTRAINT ion_properties_symbol_fkey FOREIGN KEY (symbol) REFERENCES public.element_properties(symbol);


--
-- Name: kg_edges kg_edges_from_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kg_edges
    ADD CONSTRAINT kg_edges_from_node_fkey FOREIGN KEY (from_node) REFERENCES public.kg_nodes(node_id) ON DELETE CASCADE;


--
-- Name: kg_edges kg_edges_to_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kg_edges
    ADD CONSTRAINT kg_edges_to_node_fkey FOREIGN KEY (to_node) REFERENCES public.kg_nodes(node_id) ON DELETE CASCADE;


--
-- Name: ml_model_artifacts ml_model_artifacts_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ml_model_artifacts
    ADD CONSTRAINT ml_model_artifacts_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.ml_models(model_id) ON DELETE CASCADE;


--
-- Name: ml_model_features ml_model_features_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ml_model_features
    ADD CONSTRAINT ml_model_features_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.ml_models(model_id) ON DELETE CASCADE;


--
-- Name: ml_model_metrics ml_model_metrics_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ml_model_metrics
    ADD CONSTRAINT ml_model_metrics_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.ml_models(model_id) ON DELETE CASCADE;


--
-- Name: ml_models ml_models_dataset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ml_models
    ADD CONSTRAINT ml_models_dataset_id_fkey FOREIGN KEY (dataset_id) REFERENCES public.ml_datasets(dataset_id);


--
-- Name: ml_models ml_models_superseded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ml_models
    ADD CONSTRAINT ml_models_superseded_by_fkey FOREIGN KEY (superseded_by) REFERENCES public.ml_models(model_id);


--
-- Name: pxrd_descriptors pxrd_descriptors_measurement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pxrd_descriptors
    ADD CONSTRAINT pxrd_descriptors_measurement_id_fkey FOREIGN KEY (measurement_id) REFERENCES public.characterization_measurements(measurement_id) ON DELETE CASCADE;


--
-- Name: pxrd_labels pxrd_labels_measurement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pxrd_labels
    ADD CONSTRAINT pxrd_labels_measurement_id_fkey FOREIGN KEY (measurement_id) REFERENCES public.characterization_measurements(measurement_id) ON DELETE SET NULL;


--
-- Name: rag_chunk_context rag_chunk_context_chunk_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_chunk_context
    ADD CONSTRAINT rag_chunk_context_chunk_id_fkey FOREIGN KEY (chunk_id) REFERENCES public.rag_chunks(id) ON DELETE CASCADE;


--
-- Name: rag_chunks rag_chunks_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_chunks
    ADD CONSTRAINT rag_chunks_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.rag_documents(document_id) ON DELETE CASCADE;


--
-- Name: rag_documents rag_documents_parent_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_documents
    ADD CONSTRAINT rag_documents_parent_document_id_fkey FOREIGN KEY (parent_document_id) REFERENCES public.rag_documents(document_id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--


