-- D-03 stage 4/11: converge 25 legacy public.created_at columns from TEXT to
-- TIMESTAMPTZ. Invalid values abort the complete stage and are never nulled.
DO $d03_stage4$
DECLARE
  tbl text;
  column_type text;
  column_default text;
  normalized_default text;
  invalid_count bigint;
  invalid_sample text;
  tables constant text[] := ARRAY[
    'knowledge_graph_relations',
    'meeting_agenda_items',
    'meeting_attachments',
    'meeting_decisions',
    'meeting_follow_ups',
    'meeting_note_materializations',
    'meeting_participants',
    'meetings',
    'my_work_decision_snoozes',
    'notification_activity_log',
    'notification_comments',
    'notification_dedup',
    'organization_llm_settings',
    'organization_memory',
    'partner_program_ledger',
    'permission_definitions',
    'plan_baselines',
    'post_implementation_reviews',
    'pricing_plan_features',
    'process_definitions',
    'process_versions',
    'processing_records',
    'project_insights',
    'project_notification_settings',
    'report_builder_comments'
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
      RAISE EXCEPTION 'D03_STAGE4_COLUMN_MISSING table=% column=created_at', tbl;
    ELSIF column_type = 'timestamp with time zone' THEN
      CONTINUE;
    ELSIF column_type <> 'text' THEN
      RAISE EXCEPTION 'D03_STAGE4_TYPE_UNSUPPORTED table=% type=%', tbl, column_type;
    END IF;

    normalized_default := lower(regexp_replace(COALESCE(column_default, ''), '\s', '', 'g'));
    IF column_default IS NOT NULL
       AND normalized_default NOT IN (
         'now()',
         'current_timestamp',
         '(now())::text',
         'to_char((now()attimezone''utc''::text),''yyyy-mm-ddhh24:mi:ss''::text)',
         '''2026-03-0318:29:59.729241+00''::timestampwithtimezone',
         '''2026-03-0318:29:55.584098+00''::timestampwithtimezone'
       ) THEN
      RAISE EXCEPTION 'D03_STAGE4_DEFAULT_UNSUPPORTED table=% default=%', tbl, column_default;
    END IF;

    EXECUTE format(
      'SELECT count(*)::bigint, min(created_at) FROM public.%I WHERE created_at IS NOT NULL AND NOT pg_input_is_valid(created_at, ''timestamp with time zone'')',
      tbl
    ) INTO invalid_count, invalid_sample;
    IF invalid_count > 0 THEN
      RAISE EXCEPTION 'D03_STAGE4_INVALID_CREATED_AT table=% count=% sample=%',
        tbl, invalid_count, invalid_sample;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN created_at DROP DEFAULT', tbl);
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN created_at TYPE timestamptz USING created_at::timestamptz',
      tbl
    );
    IF tbl = ANY (ARRAY['notification_activity_log', 'notification_comments']) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN created_at SET DEFAULT ''2026-03-03 18:29:59.729241+00''::timestamptz',
        tbl
      );
    ELSIF tbl = 'report_builder_comments' THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN created_at SET DEFAULT ''2026-03-03 18:29:55.584098+00''::timestamptz',
        tbl
      );
    ELSIF column_default IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP',
        tbl
      );
    END IF;
  END LOOP;
END
$d03_stage4$;
