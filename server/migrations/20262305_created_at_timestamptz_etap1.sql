-- D-03 / QD16 ETAP 1 — `created_at` text -> timestamptz on 24 tables (DEC-660).
--
-- Debt (DLUG-PO-MVP.md:13, P3/L, taken over from Codex-2 B12): "`created_at` of
-- type `text` … lexicographic comparisons lie". Measured on a copy of
-- staging-auto-20260919T0330.dump (PostgreSQL 18.6, 1903 base tables):
--   * `created_at` of type text: 272 tables (evidence/d03-createdat-etap1-20260919/
--     krok0-baza-wyniki.txt).
--   * etap-1 filter from the order ("tables without FK and without triggers"):
--     119 rejected by FK, 2 by a non-internal trigger -> pool 152.
--   * of the 152, 37 appear in one of the 54 files that run TEXT operations on
--     `created_at` in SQL (substr/length/date/datetime/strftime/||/LIKE/::text)
--     -> safe pool 115.
--   * etap 1 takes 24 of those 115 (order: 20-30 per etap), covering every one of
--     the six measured `column_default` variants so the pattern is proven before
--     etap 2+: CURRENT_TIMESTAMP (14), no default (5), to_char(...) (2),
--     (now())::text (1), now() (1), 'literal'::timestamptz (1).
--
-- Values that do not conform: 0.
--   The order demands an explicit report ("0 or a list"). Measured per table over
--   the whole 152 pool with pg_input_is_valid(created_at,'timestamptz'): 0 tables
--   and 0 rows non-conforming, and the instrument was MUTATED to prove it rejects
--   garbage (safe_tstz('to-nie-data') -> NULL, safe_tstz('1726000000') -> NULL,
--   pg_input_is_valid('to-nie-data','timestamptz') -> false). This migration
--   re-measures per table and FAILS CLOSED listing up to 10 offending values
--   instead of letting `::timestamptz` guess.
--
-- Not in etap 1 (measured reasons, not preferences):
--   * billing_webhook_events — BillingWebhookService.formatWebhookTimestamp
--     (:436-439) writes and compares TZ-LESS literals
--     (`toISOString().replace('T',' ').slice(0,19)`) in both INSERT and
--     `created_at >= ?` (:452); on a timestamptz column those literals would be
--     interpreted in the session TimeZone. It is the only such formatter in
--     server/src (measured: `replace('T', ' ')` + `slice(0, 19)` -> 3 hits, the
--     other two are display strings). 0 rows, so nothing is postponed by leaving
--     it out; it belongs to an etap that also decides the formatter.
--   * plan_baselines — 3 rows in TWO shapes (KANON with 6-digit fraction and
--     ISO-Z WITHOUT fraction: '2026-09-08T00:00:00Z'), so no single `USING` in the
--     rollback reproduces the bytes. Rolled into a later etap with an explicit
--     decision rather than shipping a data-mutating rollback.
--
-- Idempotent on purpose: MIGRATION_PATTERN = /^(7\d{2}|\d{8})_.*\.sql$/
-- (server/src/services/tablePlatform/migrationIdentity.ts:56) also matches
-- eight-digit files, so this file is picked up by BOTH migrate.postgres.ts and the
-- Table Platform chain applied at boot (DatabaseInitializer.ts:3179-3200,
-- "PostgreSQL only"). Measured on PREFLIGHT-32: tp_chain_no_pending 154 -> 155
-- when 20262304 landed. Every step below is therefore guarded on
-- data_type = 'text' and the second pass is a measured no-op.
--
-- Missing tables are skipped, not fatal: the same 24 tables are created at boot by
-- service DDL as `created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP` (e.g.
-- wave6ContextLearningService.ts:202, wave8AgentRuntimeService.ts:487,
-- researchSessionService.ts:241), so on a database where the table does not exist
-- yet the ALTER has nothing to convert. Reported as `absent=` in the NOTICE.
--
-- SQLite: not affected — the Table Platform chain is PostgreSQL-only and
-- migrate.postgres.ts is the PG track (same posture as 20262304).
-- GO: KOLEJKI-DO-KONCA-20260918.md:105 (QD16) + KANAL.md [D] Wpis 220/223;
--     pool 20262304-20262319; server/** -> etap 2 CTO (nothing applied by me
--     outside a dump copy).

DO $etap1$
DECLARE
  v_rec        record;
  v_typ        text;
  v_bad        bigint;
  v_rows       bigint;
  v_sample     text;
  v_converted  integer := 0;
  v_already    integer := 0;
  v_absent     integer := 0;
  v_listed     integer := 0;
BEGIN
  FOR v_rec IN
    SELECT * FROM (VALUES
      -- (table, default expression AFTER the conversion; NULL = no default)
      ('wave6_context_ledger',               'CURRENT_TIMESTAMP'),
      ('wave6_context_snapshots',            'CURRENT_TIMESTAMP'),
      ('wave5_artifact_versions',            'CURRENT_TIMESTAMP'),
      ('research_session_events',            'CURRENT_TIMESTAMP'),
      ('research_sessions',                  'CURRENT_TIMESTAMP'),
      ('research_evidence_graph',            'CURRENT_TIMESTAMP'),
      ('research_report_artifacts',          'CURRENT_TIMESTAMP'),
      ('wave7_connectors',                   'CURRENT_TIMESTAMP'),
      ('wave6_memory_candidates',            'CURRENT_TIMESTAMP'),
      ('wave6_memory_stewardship_decisions', 'CURRENT_TIMESTAMP'),
      ('wave8_agent_notifications',          'CURRENT_TIMESTAMP'),
      ('wave8_agent_runs',                   'CURRENT_TIMESTAMP'),
      ('wave9_evidence_registry',            'CURRENT_TIMESTAMP'),
      ('ai_deep_thinking_confirms',          'CURRENT_TIMESTAMP'),
      ('usage_pricing_tiers',                '''2026-03-03 18:30:11.358808+00''::timestamp with time zone'),
      ('v8_promotion_gates',                 'now()'),
      ('notification_dedup',                 NULL),
      ('meeting_participants',               NULL),
      ('work_canvas_proposals',              NULL),
      ('document_share_links',               NULL),
      ('deck_comments',                      NULL),
      ('decision_escalation_templates',      'now()'),
      ('meeting_decisions',                  'now()'),
      ('tax_rates',                          'now()')
    ) AS t(tabela, default_po)
  LOOP
    v_listed := v_listed + 1;

    IF to_regclass('public.' || v_rec.tabela) IS NULL THEN
      v_absent := v_absent + 1;
      RAISE NOTICE 'D03-20262305: % — absent, skipped', v_rec.tabela;
      CONTINUE;
    END IF;

    SELECT c.data_type INTO v_typ
      FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name   = v_rec.tabela
       AND c.column_name  = 'created_at';

    IF v_typ IS NULL THEN
      RAISE EXCEPTION 'D03-20262305: %.created_at does not exist', v_rec.tabela;
    END IF;

    IF v_typ <> 'text' THEN
      -- second pass (Table Platform chain) or an already-converted database
      IF v_typ <> 'timestamp with time zone' THEN
        RAISE EXCEPTION
          'D03-20262305: %.created_at is %, expected text or timestamp with time zone',
          v_rec.tabela, v_typ;
      END IF;
      v_already := v_already + 1;
      CONTINUE;
    END IF;

    EXECUTE format(
      'SELECT count(*) FROM %I WHERE created_at IS NOT NULL '
      'AND NOT pg_input_is_valid(created_at, ''timestamptz'')',
      v_rec.tabela) INTO v_bad;

    IF v_bad > 0 THEN
      EXECUTE format(
        'SELECT string_agg(v, '' | '') FROM ('
        '  SELECT created_at AS v FROM %I'
        '   WHERE created_at IS NOT NULL'
        '     AND NOT pg_input_is_valid(created_at, ''timestamptz'')'
        '   LIMIT 10) s',
        v_rec.tabela) INTO v_sample;
      RAISE EXCEPTION
        'D03-20262305: %.created_at — % value(s) are not timestamptz: %',
        v_rec.tabela, v_bad, v_sample;
    END IF;

    EXECUTE format('SELECT count(*) FROM %I', v_rec.tabela) INTO v_rows;

    -- The measured defaults are text-producing on five of the six variants
    -- ((now())::text, to_char(...)) and would not survive ALTER TYPE; dropping and
    -- re-setting every default keeps the conversion uniform and the post-state
    -- explicit. CURRENT_TIMESTAMP / now() / the timestamptz literal are restored
    -- verbatim by the rollback file.
    EXECUTE format('ALTER TABLE %I ALTER COLUMN created_at DROP DEFAULT', v_rec.tabela);

    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN created_at TYPE timestamptz USING created_at::timestamptz',
      v_rec.tabela);

    IF v_rec.default_po IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE %I ALTER COLUMN created_at SET DEFAULT %s',
        v_rec.tabela, v_rec.default_po);
    END IF;

    SELECT c.data_type INTO v_typ
      FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name   = v_rec.tabela
       AND c.column_name  = 'created_at';

    IF v_typ <> 'timestamp with time zone' THEN
      RAISE EXCEPTION
        'D03-20262305 readback: %.created_at is % after the ALTER, expected timestamp with time zone',
        v_rec.tabela, v_typ;
    END IF;

    v_converted := v_converted + 1;
    RAISE NOTICE
      'D03-20262305: % — % row(s), non-conforming 0, text -> timestamptz',
      v_rec.tabela, v_rows;
  END LOOP;

  IF v_listed <> 24 THEN
    RAISE EXCEPTION 'D03-20262305: etap-1 list holds % tables, expected 24', v_listed;
  END IF;

  RAISE NOTICE
    'D03-20262305: etap 1 done — converted=%, already timestamptz=%, absent=% (of 24)',
    v_converted, v_already, v_absent;
END
$etap1$;
