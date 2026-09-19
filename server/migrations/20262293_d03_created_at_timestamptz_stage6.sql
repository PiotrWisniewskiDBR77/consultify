-- D-03 stage 6/11: converge 25 legacy public.created_at columns from TEXT to
-- TIMESTAMPTZ. Invalid values abort the complete stage and are never nulled.
DO $d03_stage6$
DECLARE
  tbl text;
  column_type text;
  column_default text;
  normalized_default text;
  invalid_count bigint;
  invalid_sample text;
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
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    SELECT c.data_type, c.column_default
      INTO column_type, column_default
      FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name = tbl
       AND c.column_name = 'created_at';

    IF column_type IS NULL THEN
      RAISE EXCEPTION 'D03_STAGE6_COLUMN_MISSING table=% column=created_at', tbl;
    ELSIF column_type = 'timestamp with time zone' THEN
      CONTINUE;
    ELSIF column_type <> 'text' THEN
      RAISE EXCEPTION 'D03_STAGE6_TYPE_UNSUPPORTED table=% type=%', tbl, column_type;
    END IF;

    normalized_default := lower(regexp_replace(COALESCE(column_default, ''), '\s', '', 'g'));
    IF column_default IS NOT NULL
       AND normalized_default NOT IN ('now()', 'current_timestamp') THEN
      RAISE EXCEPTION 'D03_STAGE6_DEFAULT_UNSUPPORTED table=% default=%', tbl, column_default;
    END IF;

    EXECUTE format(
      'SELECT count(*)::bigint, min(created_at) FROM public.%I WHERE created_at IS NOT NULL AND NOT pg_input_is_valid(created_at, ''timestamp with time zone'')',
      tbl
    ) INTO invalid_count, invalid_sample;
    IF invalid_count > 0 THEN
      RAISE EXCEPTION 'D03_STAGE6_INVALID_CREATED_AT table=% count=% sample=%',
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
$d03_stage6$;
