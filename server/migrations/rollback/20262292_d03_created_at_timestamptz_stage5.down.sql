-- Rollback for D-03 stage 5/11. Restore TEXT and the exact default families
-- measured on the pre-deployment-29 dump.
DO $d03_stage5_down$
DECLARE
  tbl text;
  column_type text;
  tables constant text[] := ARRAY[
    'report_distributions',
    'report_section_history',
    'research_evidence_graph',
    'research_report_artifacts',
    'research_session_events',
    'research_sessions',
    'role_permission_assignments',
    'rollout_stages',
    'schedule_executions',
    'scim_conflict_log',
    'scim_group_mappings',
    'scim_sync_logs',
    'scim_tokens',
    'security_roles',
    'settings_audit_log',
    'settings_templates',
    'sms_delivery_log',
    'sms_verification_codes',
    'system_health_alerts',
    'tax_rates',
    'teresa_handoff_results',
    'teresa_proposals',
    'usage_pricing_tiers',
    'user_points_ledger',
    'v10_connector_auth_challenges'
  ];
  no_default_tables constant text[] := ARRAY[
    'rollout_stages',
    'schedule_executions',
    'security_roles',
    'teresa_handoff_results',
    'teresa_proposals',
    'v10_connector_auth_challenges'
  ];
  now_default_tables constant text[] := ARRAY[
    'role_permission_assignments',
    'scim_conflict_log',
    'scim_group_mappings',
    'scim_sync_logs',
    'scim_tokens',
    'settings_audit_log',
    'settings_templates',
    'system_health_alerts'
  ];
  formatted_utc_default_tables constant text[] := ARRAY[
    'sms_delivery_log',
    'sms_verification_codes',
    'tax_rates'
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
      RAISE EXCEPTION 'D03_STAGE5_DOWN_COLUMN_MISSING table=% column=created_at', tbl;
    ELSIF column_type = 'text' THEN
      CONTINUE;
    ELSIF column_type <> 'timestamp with time zone' THEN
      RAISE EXCEPTION 'D03_STAGE5_DOWN_TYPE_UNSUPPORTED table=% type=%', tbl, column_type;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN created_at DROP DEFAULT', tbl);
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN created_at TYPE text USING created_at::text',
      tbl
    );

    IF tbl = ANY (no_default_tables) THEN
      CONTINUE;
    ELSIF tbl = 'report_distributions' THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN created_at SET DEFAULT (now())::text',
        tbl
      );
    ELSIF tbl = ANY (now_default_tables) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN created_at SET DEFAULT now()',
        tbl
      );
    ELSIF tbl = ANY (formatted_utc_default_tables) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN created_at SET DEFAULT to_char((now() AT TIME ZONE ''UTC''::text), ''YYYY-MM-DD HH24:MI:SS''::text)',
        tbl
      );
    ELSIF tbl = 'usage_pricing_tiers' THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN created_at SET DEFAULT ''2026-03-03 18:30:11.358808+00''::timestamptz',
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
$d03_stage5_down$;
