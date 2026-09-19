-- Rollback for D-03 stage 2/11. Restore the legacy TEXT type and each table's
-- original default expression measured on the pre-deployment-29 dump.
DO $d03_stage2_down$
DECLARE
  tbl text;
  column_type text;
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
  formatted_utc_default_tables constant text[] := ARRAY[
    'billing_webhook_events',
    'content_analytics',
    'content_favorites',
    'content_permissions',
    'content_reviews',
    'content_tag_mappings',
    'credit_notes'
  ];
  now_default_tables constant text[] := ARRAY[
    'ai_chat_run_events',
    'ai_chat_runs',
    'compliance_audits',
    'compliance_frameworks'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    SELECT c.data_type
      INTO column_type
      FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name = tbl
       AND c.column_name = 'created_at';

    IF column_type IS NULL THEN
      RAISE EXCEPTION 'D03_STAGE2_DOWN_COLUMN_MISSING table=% column=created_at', tbl;
    ELSIF column_type = 'text' THEN
      CONTINUE;
    ELSIF column_type <> 'timestamp with time zone' THEN
      RAISE EXCEPTION 'D03_STAGE2_DOWN_TYPE_UNSUPPORTED table=% type=%', tbl, column_type;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN created_at DROP DEFAULT', tbl);
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN created_at TYPE text USING created_at::text',
      tbl
    );

    IF tbl = 'compliance_settings' THEN
      CONTINUE;
    ELSIF tbl = ANY (formatted_utc_default_tables) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN created_at SET DEFAULT to_char((now() AT TIME ZONE ''UTC''::text), ''YYYY-MM-DD HH24:MI:SS''::text)',
        tbl
      );
    ELSIF tbl = 'calendar_events' THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN created_at SET DEFAULT (now())::text',
        tbl
      );
    ELSIF tbl = ANY (now_default_tables) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN created_at SET DEFAULT now()',
        tbl
      );
    ELSE
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP',
        tbl
      );
    END IF;
  END LOOP;
END
$d03_stage2_down$;
