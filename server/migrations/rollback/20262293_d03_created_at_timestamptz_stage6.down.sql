-- Rollback for D-03 stage 6/11. Restore TEXT and the exact default families
-- measured on the pre-deployment-29 dump.
DO $d03_stage6_down$
DECLARE
  tbl text;
  column_type text;
  tables constant text[] := ARRAY[
    'v10_connector_sessions',
    'v10_connector_token_vault',
    'v10_onboarding_events',
    'v10_onboarding_sessions',
    'v8_action_proposals',
    'v8_activity_feed',
    'v8_admin_surface_ownership',
    'v8_agent_branch_tasks',
    'v8_agent_canonical_projection_outbox',
    'v8_agent_operator_recovery_events',
    'v8_agent_quality_eval_cases',
    'v8_agent_quality_eval_runs',
    'v8_agent_resource_policies',
    'v8_agent_resource_reservations',
    'v8_agent_run_aliases',
    'v8_agent_run_identities',
    'v8_agent_run_reconciliation_events',
    'v8_agent_template_governance_events',
    'v8_agent_work_graphs',
    'v8_ai_proposal_visibility',
    'v8_ai_suggestions',
    'v8_anna_lp_configs',
    'v8_artifact_access_grants',
    'v8_artifact_origin_links',
    'v8_artifact_run_audit_log'
  ];
  no_default_tables constant text[] := ARRAY[
    'v10_connector_sessions',
    'v10_connector_token_vault',
    'v8_activity_feed',
    'v8_ai_suggestions'
  ];
  now_default_tables constant text[] := ARRAY[
    'v8_action_proposals',
    'v8_admin_surface_ownership',
    'v8_ai_proposal_visibility',
    'v8_anna_lp_configs',
    'v8_artifact_access_grants',
    'v8_artifact_origin_links',
    'v8_artifact_run_audit_log'
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
      RAISE EXCEPTION 'D03_STAGE6_DOWN_COLUMN_MISSING table=% column=created_at', tbl;
    ELSIF column_type = 'text' THEN
      CONTINUE;
    ELSIF column_type <> 'timestamp with time zone' THEN
      RAISE EXCEPTION 'D03_STAGE6_DOWN_TYPE_UNSUPPORTED table=% type=%', tbl, column_type;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN created_at DROP DEFAULT', tbl);
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN created_at TYPE text USING created_at::text',
      tbl
    );

    IF tbl = ANY (no_default_tables) THEN
      CONTINUE;
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
$d03_stage6_down$;
