-- Migration 919 — Z139 (data-integrity) FULL-SCOPE reconciliation.
-- Heals rows that already suffered the sanitizer double/triple-escape
-- corruption (`&` -> `&amp;` -> `&amp;amp;` -> ...) across ALL modules that
-- write text through the global input-sanitization middleware — not just
-- Notebook/WorkCanvas (the ~26 records from the original Z139 finding).
--
-- ⚠️ NIE APLIKOWANA AUTOMATYCZNIE. This file does NOT match the
-- runTablePlatformMigrations pattern (`^(7\d{2}|\d{8})_.*\.sql$`), so it will
-- NOT run at server boot. DRY-RUN the diagnostic block (STEP 0) first, review
-- the counts, THEN apply STEP 1+2 manually against TROLLEY (staging=demo) —
-- see skill consultify-promocja-demo. Nadzorca sesji głównej only.
--
-- ── ROOT CAUSE (fixed at the source) ────────────────────────────────────
-- server/src/middleware/inputSanitization.middleware.ts (app.use'd globally
-- in server/src/index.ts, EVERY request) HTML-escapes every request-body/
-- query/param string on every write, via sanitizeString/sanitizeObject in
-- server/src/utils/security.utils.ts. Before this migration's companion code
-- fix (commit dd4c6f42a9 on this branch), re-saving a field whose current
-- value ALREADY contained escaped entities (e.g. an edit form round-tripping
-- a title/description back without decoding it first) compounded the
-- escaping without bound on every save. sanitizeString is now idempotent
-- (decodes existing entities, then escapes exactly once) — new writes never
-- compound again. This migration only backfills rows that were ALREADY
-- corrupted before that fix landed.
--
-- ── HEALING MODES ────────────────────────────────────────────────────────
--   'plain'  — fully decode to plain text. Used for Notebook/WorkCanvas
--              rich-text/title columns whose route handlers already
--              decode-before-store (server/src/routes/my-work/notebook.
--              routes.ts, server/src/routes/work-canvas.routes.ts) — the DB
--              should hold plain text for these, matching a fresh save.
--   'json'   — same as 'plain' but the column holds a JSON-serialized
--              document (TipTap doc / blocks array). Decoding is applied to
--              every STRING LEAF of the *parsed* JSON (never to the raw
--              serialized text — replacing `&quot;` -> `"` directly in raw
--              JSON text would inject an unescaped quote and corrupt the
--              JSON). Mirrors server/src/utils/htmlEntities.ts
--              deepDecodeHtmlEntities.
--   'single' — decode fully, then re-escape exactly once. Used for every
--              other module's title/description-type fields, which the
--              global middleware still HTML-escapes on every write (by
--              design — no per-route plain-text override exists for these).
--              This matches exactly what a fresh save produces today with
--              the idempotent sanitizeString (security.utils.ts).
--
-- ── SAFETY ───────────────────────────────────────────────────────────────
--   - Every affected table gets a full-row BACKUP table
--     (z139_backup_919_<table>) created BEFORE any UPDATE, containing only
--     the rows this migration is about to touch (not the whole table).
--   - Only rows matching the double(+)-escape signature are touched — plain
--     text, never-escaped values, and correctly single-escaped values are
--     left alone (see z139_is_double_escaped below).
--   - Defensive: every table/column is existence-checked against
--     information_schema before being touched (known schema-drift risk
--     between environments — see finding_staging_schema_drift). Missing
--     tables/columns are skipped with a RAISE NOTICE, not an error.
--   - Wrapped in a single transaction (STEP 1) — either all tables heal or
--     none do.
--   - Does NOT change the sanitizer/escaping behavior itself — that is the
--     separate code fix in server/src/utils/security.utils.ts. This
--     migration ONLY backfills existing rows to the state a fresh save
--     already produces after that fix.
--
-- ⛔ VERIFY table/column names against the LIVE TROLLEY schema before
-- running (e.g. `\d initiatives`, `\d reports`) — some tables (esp.
-- `reports`) are known to have drifted between migration eras.

-- ═══════════════════════════════════════════════════════════════════════
-- STEP 0 — DIAGNOSTIC (read-only, safe to run anytime, no lock/mutation)
-- Run this FIRST. It reports how many rows per table/column show the
-- double(+)-escape signature. Requires the helper functions below to exist
-- (run the "Helper functions" block once, it is pure CREATE OR REPLACE).
-- ═══════════════════════════════════════════════════════════════════════

-- ── Helper functions (additive; safe to (re)create; used by STEP 0 too) ──

CREATE OR REPLACE FUNCTION z139_decode_html_entities(input TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $fn$
DECLARE
  cur TEXT := input;
  nxt TEXT;
  i INT;
BEGIN
  IF input IS NULL THEN RETURN NULL; END IF;
  FOR i IN 1..6 LOOP
    nxt := cur;
    nxt := replace(nxt, '&amp;', '&');
    nxt := replace(nxt, '&lt;', '<');
    nxt := replace(nxt, '&gt;', '>');
    nxt := replace(nxt, '&quot;', '"');
    nxt := replace(nxt, '&#x27;', '''');
    nxt := replace(nxt, '&apos;', '''');
    nxt := replace(nxt, '&#96;', '`');
    nxt := replace(nxt, '&nbsp;', ' ');
    EXIT WHEN nxt = cur;
    cur := nxt;
  END LOOP;
  RETURN cur;
END;
$fn$;

CREATE OR REPLACE FUNCTION z139_escape_html_once(input TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $fn$
DECLARE r TEXT;
BEGIN
  IF input IS NULL THEN RETURN NULL; END IF;
  -- Order matters: escape `&` FIRST, before introducing any new `&` from
  -- the other entities below (mirrors the single-pass JS regex in
  -- security.utils.ts sanitizeString).
  r := replace(input, '&', '&amp;');
  r := replace(r, '<', '&lt;');
  r := replace(r, '>', '&gt;');
  r := replace(r, '"', '&quot;');
  r := replace(r, '''', '&#x27;');
  r := replace(r, '`', '&#96;');
  RETURN r;
END;
$fn$;

CREATE OR REPLACE FUNCTION z139_normalize_single_escape(input TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $fn$
  SELECT z139_escape_html_once(z139_decode_html_entities(input));
$fn$;

-- Double(+)-escape signature: an entity marker that is ITSELF escaped, e.g.
-- the literal substring `&amp;amp;` / `&amp;lt;` / `&amp;quot;` / ... . This
-- can only occur after >= 2 escape passes — never matches plain text or a
-- correctly single-escaped value, so it is a precise, conservative filter.
CREATE OR REPLACE FUNCTION z139_is_double_escaped(input TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $fn$
  SELECT input IS NOT NULL
     AND input ~ '&amp;(amp|lt|gt|quot|apos|#x27|#96|nbsp);';
$fn$;

CREATE OR REPLACE FUNCTION z139_deep_decode_jsonb(input JSONB)
RETURNS JSONB LANGUAGE plpgsql IMMUTABLE AS $fn$
DECLARE
  result JSONB;
  k TEXT;
  v JSONB;
  arr JSONB[] := ARRAY[]::JSONB[];
  elem JSONB;
BEGIN
  IF input IS NULL THEN RETURN NULL; END IF;
  CASE jsonb_typeof(input)
    WHEN 'string' THEN
      RETURN to_jsonb(z139_decode_html_entities(input #>> '{}'));
    WHEN 'object' THEN
      result := '{}'::jsonb;
      FOR k, v IN SELECT * FROM jsonb_each(input) LOOP
        result := result || jsonb_build_object(k, z139_deep_decode_jsonb(v));
      END LOOP;
      RETURN result;
    WHEN 'array' THEN
      FOR elem IN SELECT * FROM jsonb_array_elements(input) LOOP
        arr := arr || z139_deep_decode_jsonb(elem);
      END LOOP;
      RETURN to_jsonb(arr);
    ELSE
      RETURN input;
  END CASE;
END;
$fn$;

-- JSON-safe decode for a TEXT column that holds serialized JSON. Falls back
-- to returning the input UNCHANGED if it is not valid JSON (never corrupts).
CREATE OR REPLACE FUNCTION z139_deep_decode_json_text(input TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $fn$
BEGIN
  IF input IS NULL OR input = '' THEN RETURN input; END IF;
  RETURN (z139_deep_decode_jsonb(input::jsonb))::text;
EXCEPTION WHEN OTHERS THEN
  RETURN input;
END;
$fn$;

-- Run this SELECT to see affected counts (STEP 0 — dry run):
--
-- SELECT * FROM (VALUES
--   ('notebooks',             'title'),
--   ('notebook_pages',        'title'),
--   ('notebook_pages',        'content_text'),
--   ('notebook_pages',        'content_json'),
--   ('work_canvas_drafts',    'title'),
--   ('work_canvas_drafts',    'content_md'),
--   ('work_canvas_drafts',    'content_json'),
--   ('work_canvas_drafts',    'content_json_native'),
--   ('work_canvas_drafts',    'blocks_json'),
--   ('work_canvas_versions',  'content_md'),
--   ('work_canvas_versions',  'content_json_native'),
--   ('work_canvas_versions',  'blocks_json'),
--   ('initiatives',           'name'),
--   ('initiatives',           'summary'),
--   ('initiatives',           'hypothesis'),
--   ('initiatives',           'business_value'),
--   ('initiatives',           'social_impact'),
--   ('initiatives',           'market_context'),
--   ('initiatives',           'problem_statement'),
--   ('tasks',                 'title'),
--   ('tasks',                 'description'),
--   ('tasks',                 'why'),
--   ('tasks',                 'expected_outcome'),
--   ('tasks',                 'strategic_contribution'),
--   ('decisions',              'title'),
--   ('decisions',              'description'),
--   ('decisions',              'decision_rationale'),
--   ('raid_items',             'title'),
--   ('raid_items',             'description'),
--   ('raid_items',             'mitigation_plan'),
--   ('interview_insights',     'title'),
--   ('initiative_kpis',        'name'),
--   ('initiative_kpis',        'description')
-- ) AS candidates(tbl, col)
-- CROSS JOIN LATERAL (
--   SELECT to_regclass('public.' || tbl) IS NOT NULL AS table_exists
-- ) te
-- LEFT JOIN LATERAL (
--   SELECT EXISTS (
--     SELECT 1 FROM information_schema.columns
--      WHERE table_schema = 'public' AND table_name = tbl AND column_name = col
--   ) AS column_exists
-- ) ce ON true
-- ORDER BY tbl, col;
--
-- (The COUNT-of-affected-rows per table/column is easiest run individually,
-- e.g.: SELECT count(*) FROM initiatives WHERE z139_is_double_escaped(name);
-- — kept as individual statements rather than one giant dynamic query so
-- each can be copy-pasted and eyeballed before STEP 1 touches anything.)

-- ═══════════════════════════════════════════════════════════════════════
-- STEP 1 — BACKUP + FIX (destructive; wrapped in one transaction)
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ── notebooks (title only; content lives in notebook_pages) ────────────
DO $$
BEGIN
  IF to_regclass('public.notebooks') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='notebooks' AND column_name='title') THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS z139_backup_919_notebooks AS
             SELECT * FROM notebooks WHERE z139_is_double_escaped(title) LIMIT 0';
    EXECUTE 'INSERT INTO z139_backup_919_notebooks
             SELECT * FROM notebooks WHERE z139_is_double_escaped(title)';
    EXECUTE 'UPDATE notebooks SET title = z139_decode_html_entities(title)
              WHERE z139_is_double_escaped(title)';
    RAISE NOTICE 'z139/919: notebooks.title healed (backup: z139_backup_919_notebooks)';
  ELSE
    RAISE NOTICE 'z139/919: SKIP notebooks (table/column not found)';
  END IF;
END $$;

-- ── notebook_pages (title, content_text: plain · content_json: JSON) ───
DO $$
DECLARE
  pred TEXT := NULL;  -- FRESH-DB (2026-07-14): backup predicate built only from columns that exist
  col  TEXT;
BEGIN
  IF to_regclass('public.notebook_pages') IS NOT NULL THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS z139_backup_919_notebook_pages AS
             SELECT * FROM notebook_pages WHERE false';
    FOREACH col IN ARRAY ARRAY['title','content_text','content_json'] LOOP
      IF EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='notebook_pages' AND column_name=col) THEN
        pred := COALESCE(pred || ' OR ', '') || format('z139_is_double_escaped(%I)', col);
      END IF;
    END LOOP;
    IF pred IS NOT NULL THEN
      EXECUTE 'INSERT INTO z139_backup_919_notebook_pages
               SELECT * FROM notebook_pages WHERE ' || pred;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='notebook_pages' AND column_name='title') THEN
      EXECUTE 'UPDATE notebook_pages SET title = z139_decode_html_entities(title)
                WHERE z139_is_double_escaped(title)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='notebook_pages' AND column_name='content_text') THEN
      EXECUTE 'UPDATE notebook_pages SET content_text = z139_decode_html_entities(content_text)
                WHERE z139_is_double_escaped(content_text)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='notebook_pages' AND column_name='content_json') THEN
      EXECUTE 'UPDATE notebook_pages SET content_json = z139_deep_decode_json_text(content_json)
                WHERE z139_is_double_escaped(content_json)';
    END IF;
    RAISE NOTICE 'z139/919: notebook_pages healed (backup: z139_backup_919_notebook_pages)';
  ELSE
    RAISE NOTICE 'z139/919: SKIP notebook_pages (table not found)';
  END IF;
END $$;

-- ── work_canvas_drafts (title, content_md: plain · content_json,
--    content_json_native, blocks_json: JSON) ────────────────────────────
DO $$
DECLARE
  pred TEXT := NULL;  -- FRESH-DB (2026-07-14): backup predicate built only from columns that exist
  col  TEXT;
BEGIN
  IF to_regclass('public.work_canvas_drafts') IS NOT NULL THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS z139_backup_919_work_canvas_drafts AS
             SELECT * FROM work_canvas_drafts WHERE false';
    FOREACH col IN ARRAY ARRAY['title','content_md','content_json','content_json_native','blocks_json'] LOOP
      IF EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='work_canvas_drafts' AND column_name=col) THEN
        pred := COALESCE(pred || ' OR ', '') || format('z139_is_double_escaped(%I)', col);
      END IF;
    END LOOP;
    IF pred IS NOT NULL THEN
      EXECUTE 'INSERT INTO z139_backup_919_work_canvas_drafts
               SELECT * FROM work_canvas_drafts WHERE ' || pred;
    END IF;
    EXECUTE 'UPDATE work_canvas_drafts SET title = z139_decode_html_entities(title)
              WHERE z139_is_double_escaped(title)';
    EXECUTE 'UPDATE work_canvas_drafts SET content_md = z139_decode_html_entities(content_md)
              WHERE z139_is_double_escaped(content_md)';
    EXECUTE 'UPDATE work_canvas_drafts SET content_json = z139_deep_decode_json_text(content_json)
              WHERE z139_is_double_escaped(content_json)';
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='work_canvas_drafts' AND column_name='content_json_native') THEN
      EXECUTE 'UPDATE work_canvas_drafts
                  SET content_json_native = z139_deep_decode_json_text(content_json_native)
                WHERE z139_is_double_escaped(content_json_native)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='work_canvas_drafts' AND column_name='blocks_json') THEN
      EXECUTE 'UPDATE work_canvas_drafts SET blocks_json = z139_deep_decode_json_text(blocks_json)
                WHERE z139_is_double_escaped(blocks_json)';
    END IF;
    RAISE NOTICE 'z139/919: work_canvas_drafts healed (backup: z139_backup_919_work_canvas_drafts)';
  ELSE
    RAISE NOTICE 'z139/919: SKIP work_canvas_drafts (table not found)';
  END IF;
END $$;

-- ── work_canvas_versions (history snapshots; same fields as drafts) ────
DO $$
DECLARE
  pred TEXT := NULL;  -- FRESH-DB (2026-07-14): backup predicate built only from columns that exist
  col  TEXT;
BEGIN
  IF to_regclass('public.work_canvas_versions') IS NOT NULL THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS z139_backup_919_work_canvas_versions AS
             SELECT * FROM work_canvas_versions WHERE false';
    FOREACH col IN ARRAY ARRAY['content_md','content_json_native','blocks_json'] LOOP
      IF EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='work_canvas_versions' AND column_name=col) THEN
        pred := COALESCE(pred || ' OR ', '') || format('z139_is_double_escaped(%I)', col);
      END IF;
    END LOOP;
    IF pred IS NOT NULL THEN
      EXECUTE 'INSERT INTO z139_backup_919_work_canvas_versions
               SELECT * FROM work_canvas_versions WHERE ' || pred;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='work_canvas_versions' AND column_name='content_md') THEN
      EXECUTE 'UPDATE work_canvas_versions SET content_md = z139_decode_html_entities(content_md)
                WHERE z139_is_double_escaped(content_md)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='work_canvas_versions' AND column_name='content_json_native') THEN
      EXECUTE 'UPDATE work_canvas_versions
                  SET content_json_native = z139_deep_decode_json_text(content_json_native)
                WHERE z139_is_double_escaped(content_json_native)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='work_canvas_versions' AND column_name='blocks_json') THEN
      EXECUTE 'UPDATE work_canvas_versions SET blocks_json = z139_deep_decode_json_text(blocks_json)
                WHERE z139_is_double_escaped(blocks_json)';
    END IF;
    RAISE NOTICE 'z139/919: work_canvas_versions healed (backup: z139_backup_919_work_canvas_versions)';
  ELSE
    RAISE NOTICE 'z139/919: SKIP work_canvas_versions (table not found)';
  END IF;
END $$;

-- ── Other modules — title/description-type fields (mode: 'single') ─────
-- These are still HTML-escaped on every write by the global middleware
-- (no per-route plain-text override) — heal to the single-escape form a
-- fresh save now produces, do NOT decode to plain (would diverge from
-- what the app currently (correctly) stores for these columns).

DO $$
DECLARE
  cols TEXT[][] := ARRAY[
    ARRAY['initiatives', 'name'],
    ARRAY['initiatives', 'summary'],
    ARRAY['initiatives', 'hypothesis'],
    ARRAY['initiatives', 'business_value'],
    ARRAY['initiatives', 'social_impact'],
    ARRAY['initiatives', 'market_context'],
    ARRAY['initiatives', 'problem_statement'],
    ARRAY['tasks', 'title'],
    ARRAY['tasks', 'description'],
    ARRAY['tasks', 'why'],
    ARRAY['tasks', 'expected_outcome'],
    ARRAY['tasks', 'strategic_contribution'],
    ARRAY['decisions', 'title'],
    ARRAY['decisions', 'description'],
    ARRAY['decisions', 'decision_rationale'],
    ARRAY['raid_items', 'title'],
    ARRAY['raid_items', 'description'],
    ARRAY['raid_items', 'mitigation_plan'],
    ARRAY['interview_insights', 'title'],
    ARRAY['initiative_kpis', 'name'],
    ARRAY['initiative_kpis', 'description']
  ];
  tables TEXT[] := ARRAY['initiatives', 'tasks', 'decisions', 'raid_items', 'interview_insights', 'initiative_kpis'];
  t TEXT;
  pair TEXT[];
  c TEXT;
  existing_cols TEXT[];
  cond TEXT;
  backup_name TEXT;
  total_backed_up INT;
  affected INT;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'z139/919: SKIP table % (not found)', t;
      CONTINUE;
    END IF;

    -- Resolve which of this table's target columns actually exist here
    -- (schema-drift guard) BEFORE touching anything.
    existing_cols := ARRAY[]::TEXT[];
    FOREACH pair SLICE 1 IN ARRAY cols LOOP
      IF pair[1] = t THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = t AND column_name = pair[2]) THEN
          existing_cols := existing_cols || pair[2];
        ELSE
          RAISE NOTICE 'z139/919: SKIP %.% (column not found)', t, pair[2];
        END IF;
      END IF;
    END LOOP;

    IF array_length(existing_cols, 1) IS NULL THEN
      RAISE NOTICE 'z139/919: SKIP % (no target columns present)', t;
      CONTINUE;
    END IF;

    -- Build a single OR-combined condition across ALL of this table's
    -- target columns, so the backup below captures ONE clean, fully
    -- pre-fix snapshot per affected row (not a different partial snapshot
    -- per column — a row corrupted in 3 columns must be backed up ONCE,
    -- BEFORE any of its 3 columns are touched, or the backup is useless
    -- for restore).
    cond := '';
    FOREACH c IN ARRAY existing_cols LOOP
      IF cond <> '' THEN cond := cond || ' OR '; END IF;
      cond := cond || format('z139_is_double_escaped(%I)', c);
    END LOOP;

    backup_name := 'z139_backup_919_' || t;
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I AS SELECT * FROM %I WHERE false', backup_name, t);
    EXECUTE format('INSERT INTO %I SELECT * FROM %I WHERE %s', backup_name, t, cond);
    GET DIAGNOSTICS total_backed_up = ROW_COUNT;
    RAISE NOTICE 'z139/919: % — backed up % row(s) to % (pre-fix snapshot)', t, total_backed_up, backup_name;

    -- Only NOW, after the full pre-fix snapshot is safely backed up, apply
    -- the per-column fix.
    FOREACH c IN ARRAY existing_cols LOOP
      EXECUTE format(
        'UPDATE %I SET %I = z139_normalize_single_escape(%I) WHERE z139_is_double_escaped(%I)',
        t, c, c, c
      );
      GET DIAGNOSTICS affected = ROW_COUNT;
      RAISE NOTICE 'z139/919: %.% healed, % row(s)', t, c, affected;
    END LOOP;
  END LOOP;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════
-- STEP 2 — CLEANUP (optional; run only AFTER verifying the fix in the app)
-- Keep the z139_backup_919_* tables until Piotr has spot-checked the
-- affected records in the UI. Drop helper functions once done, or leave
-- them (CREATE OR REPLACE is idempotent/harmless either way).
-- ═══════════════════════════════════════════════════════════════════════

-- DROP FUNCTION IF EXISTS z139_deep_decode_json_text(TEXT);
-- DROP FUNCTION IF EXISTS z139_deep_decode_jsonb(JSONB);
-- DROP FUNCTION IF EXISTS z139_is_double_escaped(TEXT);
-- DROP FUNCTION IF EXISTS z139_normalize_single_escape(TEXT);
-- DROP FUNCTION IF EXISTS z139_escape_html_once(TEXT);
-- DROP FUNCTION IF EXISTS z139_decode_html_entities(TEXT);
--
-- -- After confirming the backups are no longer needed:
-- -- DROP TABLE IF EXISTS z139_backup_919_notebooks;
-- -- DROP TABLE IF EXISTS z139_backup_919_notebook_pages;
-- -- DROP TABLE IF EXISTS z139_backup_919_work_canvas_drafts;
-- -- DROP TABLE IF EXISTS z139_backup_919_work_canvas_versions;
-- -- DROP TABLE IF EXISTS z139_backup_919_initiatives;
-- -- DROP TABLE IF EXISTS z139_backup_919_tasks;
-- -- DROP TABLE IF EXISTS z139_backup_919_decisions;
-- -- DROP TABLE IF EXISTS z139_backup_919_raid_items;
-- -- DROP TABLE IF EXISTS z139_backup_919_interview_insights;
-- -- DROP TABLE IF EXISTS z139_backup_919_initiative_kpis;
