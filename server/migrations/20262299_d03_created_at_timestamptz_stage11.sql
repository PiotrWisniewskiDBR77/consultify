-- D-03 stage 11/11: converge 21 legacy public.created_at columns from TEXT to
-- TIMESTAMPTZ. Invalid values abort the complete stage and are never nulled.
-- [ODMROZENIE WSPOLNE DEC-650]
DO $d03_stage11$
DECLARE
  tbl text;
  column_type text;
  column_default text;
  normalized_default text;
  invalid_count bigint;
  invalid_sample text;
  tables constant text[] := ARRAY[
    'wave5_mutation_proposals',
    'wave6_context_ledger',
    'wave6_context_snapshots',
    'wave6_memory_candidates',
    'wave6_memory_stewardship_decisions',
    'wave7_connector_runs',
    'wave7_connectors',
    'wave8_agent_definitions',
    'wave8_agent_notifications',
    'wave8_agent_runs',
    'wave8_agent_schedules',
    'wave8_agent_tool_governance_events',
    'wave9_acceptance_decisions',
    'wave9_evidence_registry',
    'wave9_incidents',
    'wave9_outcomes',
    'webhook_deliveries',
    'work_canvas_drafts',
    'work_canvas_ideas',
    'work_canvas_proposals',
    'z139_backup_919_work_canvas_drafts'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    SELECT c.data_type, c.column_default
      INTO column_type, column_default
      FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name = tbl
       AND c.column_name = 'created_at';

    IF column_type IS NULL THEN
      RAISE EXCEPTION 'D03_STAGE11_COLUMN_MISSING table=% column=created_at', tbl;
    ELSIF column_type = 'timestamp with time zone' THEN
      CONTINUE;
    ELSIF column_type <> 'text' THEN
      RAISE EXCEPTION 'D03_STAGE11_TYPE_UNSUPPORTED table=% type=%', tbl, column_type;
    END IF;

    normalized_default := lower(regexp_replace(COALESCE(column_default, ''), '\s', '', 'g'));
    IF column_default IS NOT NULL
       AND normalized_default NOT IN ('now()', 'current_timestamp') THEN
      RAISE EXCEPTION 'D03_STAGE11_DEFAULT_UNSUPPORTED table=% default=%', tbl, column_default;
    END IF;

    EXECUTE format(
      'SELECT count(*)::bigint, min(created_at) FROM public.%I WHERE created_at IS NOT NULL AND NOT pg_input_is_valid(created_at, ''timestamp with time zone'')',
      tbl
    ) INTO invalid_count, invalid_sample;
    IF invalid_count > 0 THEN
      RAISE EXCEPTION 'D03_STAGE11_INVALID_CREATED_AT table=% count=% sample=%',
        tbl, invalid_count, invalid_sample;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN created_at DROP DEFAULT', tbl);
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN created_at TYPE timestamptz USING created_at::timestamptz',
      tbl
    );
    IF column_default IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP',
        tbl
      );
    END IF;
  END LOOP;
END
$d03_stage11$;
