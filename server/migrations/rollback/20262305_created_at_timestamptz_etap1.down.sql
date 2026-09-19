-- Explicit rollback for D-03 / QD16 ETAP 1 (DEC-660) migration 20262305.
--
-- Reverts EXACTLY what 20262305 changed on the 24 etap-1 tables: the column type
-- (timestamptz -> text) and the default expression. Nothing else is touched — no
-- other table, no other column, no data deletion (the D-133 lesson: a down that
-- drops a foreign object silently destroys another migration's work).
--
-- Byte fidelity is the whole point, and it is shape-specific (measured in KROK 0
-- over every row of the 21 non-empty etap-1 tables, 5875 rows):
--   * KANON  `2026-04-25 17:59:50.953169+00` (16 tables, 5256 rows) is reproduced
--     by `created_at::text` — but only with TimeZone = UTC, hence SET LOCAL below.
--     diff = 0; the ISO-Z form differs on all 5256 rows.
--   * ISO-Z  `2026-07-05T12:14:57.993Z` (5 tables, 619 rows) is reproduced by
--     to_char(... AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'). diff = 0;
--     `created_at::text` differs on all 619 rows.
--   One shared form would corrupt 619 or 5256 stored text values, so the shape is
--   a column of the list below, not a global choice.
--   (evidence/d03-createdat-etap1-20260919/KROK0.md §7, tabele-etap1.txt)
--
-- The three tables that hold 0 rows on the measured copy (decision_escalation_
-- templates, meeting_decisions, tax_rates) get the shape their writers produce
-- (decisionEscalationChainService.ts:621 `new Date().toISOString()` -> ISO-Z;
-- tax_rates has no created_at reader or writer at all -> KANON, the canonical
-- text). The choice is unobservable while the tables are empty; the NOTICE prints
-- the row count so an operator sees immediately if that stopped being true.
--
-- Fail-closed: after the conversion back to text every value must still parse as
-- timestamptz (a rollback that produced unparseable text would be worse than no
-- rollback), and the column type is read back per table.
--
-- Kept out of the forward chain by KNOWN_EXCLUDED_MIGRATIONS_SUBDIRS
-- (migrate.postgres.ts:157). Rollback order is reverse-chronological.

BEGIN;

-- KANON text (`...+00`) is only reproduced byte-exactly under TimeZone = UTC.
SET LOCAL TIME ZONE 'UTC';

DO $etap1_down$
DECLARE
  v_rec       record;
  v_typ       text;
  v_rows      bigint;
  v_bad       bigint;
  v_using     text;
  v_reverted  integer := 0;
  v_already   integer := 0;
  v_absent    integer := 0;
  v_listed    integer := 0;
BEGIN
  FOR v_rec IN
    SELECT * FROM (VALUES
      -- (table, stored text shape, default expression BEFORE 20262305; NULL = none)
      ('wave6_context_ledger',               'KANON', 'CURRENT_TIMESTAMP'),
      ('wave6_context_snapshots',            'KANON', 'CURRENT_TIMESTAMP'),
      ('wave5_artifact_versions',            'KANON', 'CURRENT_TIMESTAMP'),
      ('research_session_events',            'KANON', 'CURRENT_TIMESTAMP'),
      ('research_sessions',                  'KANON', 'CURRENT_TIMESTAMP'),
      ('research_evidence_graph',            'KANON', 'CURRENT_TIMESTAMP'),
      ('research_report_artifacts',          'KANON', 'CURRENT_TIMESTAMP'),
      ('wave7_connectors',                   'KANON', 'CURRENT_TIMESTAMP'),
      ('wave6_memory_candidates',            'KANON', 'CURRENT_TIMESTAMP'),
      ('wave6_memory_stewardship_decisions', 'KANON', 'CURRENT_TIMESTAMP'),
      ('wave8_agent_notifications',          'KANON', 'CURRENT_TIMESTAMP'),
      ('wave8_agent_runs',                   'KANON', 'CURRENT_TIMESTAMP'),
      ('wave9_evidence_registry',            'KANON', 'CURRENT_TIMESTAMP'),
      ('ai_deep_thinking_confirms',          'KANON', 'CURRENT_TIMESTAMP'),
      ('usage_pricing_tiers',                'KANON', '''2026-03-03 18:30:11.358808+00''::timestamp with time zone'),
      ('v8_promotion_gates',                 'KANON', 'now()'),
      ('notification_dedup',                 'ISOZ',  NULL),
      ('meeting_participants',               'ISOZ',  NULL),
      ('work_canvas_proposals',              'ISOZ',  NULL),
      ('document_share_links',               'ISOZ',  NULL),
      ('deck_comments',                      'ISOZ',  NULL),
      ('decision_escalation_templates',      'ISOZ',  'to_char((now() AT TIME ZONE ''UTC''::text), ''YYYY-MM-DD HH24:MI:SS''::text)'),
      ('meeting_decisions',                  'ISOZ',  '(now())::text'),
      ('tax_rates',                          'KANON', 'to_char((now() AT TIME ZONE ''UTC''::text), ''YYYY-MM-DD HH24:MI:SS''::text)')
    ) AS t(tabela, ksztalt, default_przed)
  LOOP
    v_listed := v_listed + 1;

    IF to_regclass('public.' || v_rec.tabela) IS NULL THEN
      v_absent := v_absent + 1;
      RAISE NOTICE 'D03-20262305-down: % — absent, skipped', v_rec.tabela;
      CONTINUE;
    END IF;

    SELECT c.data_type INTO v_typ
      FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name   = v_rec.tabela
       AND c.column_name  = 'created_at';

    IF v_typ IS NULL THEN
      RAISE EXCEPTION 'D03-20262305-down: %.created_at does not exist', v_rec.tabela;
    END IF;

    IF v_typ = 'text' THEN
      v_already := v_already + 1;
      CONTINUE;
    END IF;

    IF v_typ <> 'timestamp with time zone' THEN
      RAISE EXCEPTION
        'D03-20262305-down: %.created_at is %, expected timestamp with time zone or text',
        v_rec.tabela, v_typ;
    END IF;

    EXECUTE format('SELECT count(*) FROM %I', v_rec.tabela) INTO v_rows;

    IF v_rec.ksztalt = 'ISOZ' THEN
      v_using := 'to_char(created_at AT TIME ZONE ''UTC'', ''YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'')';
    ELSIF v_rec.ksztalt = 'KANON' THEN
      v_using := 'created_at::text';
    ELSE
      RAISE EXCEPTION 'D03-20262305-down: % — unknown shape %', v_rec.tabela, v_rec.ksztalt;
    END IF;

    EXECUTE format('ALTER TABLE %I ALTER COLUMN created_at DROP DEFAULT', v_rec.tabela);

    EXECUTE format('ALTER TABLE %I ALTER COLUMN created_at TYPE text USING %s',
                   v_rec.tabela, v_using);

    IF v_rec.default_przed IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I ALTER COLUMN created_at SET DEFAULT %s',
                     v_rec.tabela, v_rec.default_przed);
    END IF;

    SELECT c.data_type INTO v_typ
      FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name   = v_rec.tabela
       AND c.column_name  = 'created_at';

    IF v_typ <> 'text' THEN
      RAISE EXCEPTION
        'D03-20262305-down readback: %.created_at is % after the ALTER, expected text',
        v_rec.tabela, v_typ;
    END IF;

    EXECUTE format(
      'SELECT count(*) FROM %I WHERE created_at IS NOT NULL '
      'AND NOT pg_input_is_valid(created_at, ''timestamptz'')',
      v_rec.tabela) INTO v_bad;

    IF v_bad > 0 THEN
      RAISE EXCEPTION
        'D03-20262305-down: %.created_at — % row(s) are not parseable text after the rollback',
        v_rec.tabela, v_bad;
    END IF;

    v_reverted := v_reverted + 1;
    RAISE NOTICE
      'D03-20262305-down: % — % row(s), shape %, timestamptz -> text',
      v_rec.tabela, v_rows, v_rec.ksztalt;
  END LOOP;

  IF v_listed <> 24 THEN
    RAISE EXCEPTION 'D03-20262305-down: etap-1 list holds % tables, expected 24', v_listed;
  END IF;

  RAISE NOTICE
    'D03-20262305-down: done — reverted=%, already text=%, absent=% (of 24)',
    v_reverted, v_already, v_absent;
END
$etap1_down$;

COMMIT;
