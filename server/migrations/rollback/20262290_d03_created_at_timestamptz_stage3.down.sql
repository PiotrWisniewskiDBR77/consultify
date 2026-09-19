-- Rollback for D-03 stage 3/11. Restore TEXT and the exact default families
-- measured on the pre-deployment-29 dump.
DO $d03_stage3_down$
DECLARE
  tbl text;
  column_type text;
  tables constant text[] := ARRAY[
    'custom_roles',
    'cutover_runbooks',
    'cutover_steps',
    'decision_consulted_opinions',
    'decision_delegations',
    'decision_escalation_chain',
    'decision_escalation_log',
    'decision_escalation_templates',
    'deck_comments',
    'developer_settings',
    'document_approvals',
    'document_audience_profiles',
    'document_brand_voice_profiles',
    'document_comments',
    'document_content_blocks',
    'document_share_links',
    'document_source_packs',
    'dsar_requests',
    'email_signatures',
    'feedback_status_history',
    'initiative_budgets',
    'initiative_status_history',
    'interview_messages',
    'invoice_templates',
    'journey_events'
  ];
  no_default_tables constant text[] := ARRAY[
    'deck_comments',
    'document_approvals',
    'document_audience_profiles',
    'document_brand_voice_profiles',
    'document_comments',
    'document_content_blocks',
    'document_share_links',
    'document_source_packs'
  ];
  formatted_utc_default_tables constant text[] := ARRAY[
    'decision_consulted_opinions',
    'decision_delegations',
    'decision_escalation_chain',
    'decision_escalation_log',
    'decision_escalation_templates',
    'invoice_templates'
  ];
  now_default_tables constant text[] := ARRAY[
    'custom_roles',
    'developer_settings',
    'dsar_requests',
    'email_signatures'
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
      RAISE EXCEPTION 'D03_STAGE3_DOWN_COLUMN_MISSING table=% column=created_at', tbl;
    ELSIF column_type = 'text' THEN
      CONTINUE;
    ELSIF column_type <> 'timestamp with time zone' THEN
      RAISE EXCEPTION 'D03_STAGE3_DOWN_TYPE_UNSUPPORTED table=% type=%', tbl, column_type;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN created_at DROP DEFAULT', tbl);
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN created_at TYPE text USING created_at::text',
      tbl
    );

    IF tbl = ANY (no_default_tables) THEN
      CONTINUE;
    ELSIF tbl = ANY (formatted_utc_default_tables) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN created_at SET DEFAULT to_char((now() AT TIME ZONE ''UTC''::text), ''YYYY-MM-DD HH24:MI:SS''::text)',
        tbl
      );
    ELSIF tbl = ANY (now_default_tables) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN created_at SET DEFAULT now()',
        tbl
      );
    ELSIF tbl = 'initiative_status_history' THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN created_at SET DEFAULT ''2026-03-03 18:29:59.386513+00''::timestamptz',
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
$d03_stage3_down$;
