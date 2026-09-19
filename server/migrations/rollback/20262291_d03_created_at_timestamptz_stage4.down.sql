-- Rollback for D-03 stage 4/11. Restore TEXT and the exact default families
-- measured on the pre-deployment-29 dump.
DO $d03_stage4_down$
DECLARE
  tbl text;
  column_type text;
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
  no_default_tables constant text[] := ARRAY[
    'knowledge_graph_relations',
    'meeting_attachments',
    'meeting_note_materializations',
    'meeting_participants',
    'notification_dedup',
    'post_implementation_reviews'
  ];
  now_default_tables constant text[] := ARRAY[
    'meeting_follow_ups',
    'meetings',
    'organization_memory',
    'partner_program_ledger',
    'permission_definitions',
    'processing_records'
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
      RAISE EXCEPTION 'D03_STAGE4_DOWN_COLUMN_MISSING table=% column=created_at', tbl;
    ELSIF column_type = 'text' THEN
      CONTINUE;
    ELSIF column_type <> 'timestamp with time zone' THEN
      RAISE EXCEPTION 'D03_STAGE4_DOWN_TYPE_UNSUPPORTED table=% type=%', tbl, column_type;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN created_at DROP DEFAULT', tbl);
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN created_at TYPE text USING created_at::text',
      tbl
    );

    IF tbl = ANY (no_default_tables) THEN
      CONTINUE;
    ELSIF tbl = ANY (ARRAY['meeting_agenda_items', 'meeting_decisions']) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN created_at SET DEFAULT (now())::text',
        tbl
      );
    ELSIF tbl = ANY (now_default_tables) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN created_at SET DEFAULT now()',
        tbl
      );
    ELSIF tbl = 'pricing_plan_features' THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN created_at SET DEFAULT to_char((now() AT TIME ZONE ''UTC''::text), ''YYYY-MM-DD HH24:MI:SS''::text)',
        tbl
      );
    ELSIF tbl = ANY (ARRAY['notification_activity_log', 'notification_comments']) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN created_at SET DEFAULT ''2026-03-03 18:29:59.729241+00''::timestamptz',
        tbl
      );
    ELSIF tbl = 'report_builder_comments' THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN created_at SET DEFAULT ''2026-03-03 18:29:55.584098+00''::timestamptz',
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
$d03_stage4_down$;
