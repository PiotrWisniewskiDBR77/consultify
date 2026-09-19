-- D-03 stage 2/11: converge 25 legacy public.created_at columns from TEXT to
-- TIMESTAMPTZ. Any unparseable value aborts the complete stage; no value is
-- replaced with NULL.
DO $d03_stage2$
DECLARE
  tbl text;
  column_type text;
  column_default text;
  normalized_default text;
  invalid_count bigint;
  invalid_sample text;
  tables constant text[] := ARRAY[
    'ai_chat_run_events',
    'ai_chat_runs',
    'ai_run_events',
    'ai_run_ledger',
    'billing_webhook_events',
    'calendar_events',
    'case_workspace_capability_idempotency_keys',
    'case_workspace_feature_flag_definitions',
    'case_workspace_node_run_attempts',
    'case_workspace_node_runs',
    'case_workspace_run_bindings',
    'case_workspace_runs',
    'case_workspace_value_measurements',
    'case_workspace_waits',
    'change_champions',
    'compliance_audits',
    'compliance_frameworks',
    'compliance_settings',
    'content_analytics',
    'content_comments',
    'content_favorites',
    'content_permissions',
    'content_reviews',
    'content_tag_mappings',
    'credit_notes'
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
      RAISE EXCEPTION 'D03_STAGE2_COLUMN_MISSING table=% column=created_at', tbl;
    ELSIF column_type = 'timestamp with time zone' THEN
      CONTINUE;
    ELSIF column_type <> 'text' THEN
      RAISE EXCEPTION 'D03_STAGE2_TYPE_UNSUPPORTED table=% type=%', tbl, column_type;
    END IF;

    normalized_default := lower(regexp_replace(COALESCE(column_default, ''), '\s', '', 'g'));
    IF column_default IS NOT NULL
       AND normalized_default NOT IN (
         'now()',
         'current_timestamp',
         '(now())::text',
         'to_char((now()attimezone''utc''::text),''yyyy-mm-ddhh24:mi:ss''::text)'
       ) THEN
      RAISE EXCEPTION 'D03_STAGE2_DEFAULT_UNSUPPORTED table=% default=%', tbl, column_default;
    END IF;

    EXECUTE format(
      'SELECT count(*)::bigint, min(created_at) FROM public.%I WHERE created_at IS NOT NULL AND NOT pg_input_is_valid(created_at, ''timestamp with time zone'')',
      tbl
    ) INTO invalid_count, invalid_sample;

    IF invalid_count > 0 THEN
      RAISE EXCEPTION 'D03_STAGE2_INVALID_CREATED_AT table=% count=% sample=%',
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
$d03_stage2$;
