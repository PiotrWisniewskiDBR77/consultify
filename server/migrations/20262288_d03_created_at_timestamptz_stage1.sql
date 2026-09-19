-- D-03 stage 1/11: converge 25 legacy public.created_at columns from TEXT to
-- TIMESTAMPTZ. The table list is intentionally bounded so every stage can be
-- rehearsed UP/DOWN/UP on a current staging copy before it is accepted.
--
-- Fail closed: no value is replaced with NULL. Any unparseable value aborts
-- the whole DO statement and reports its table, count, and one sample.
DO $d03_stage1$
DECLARE
  tbl text;
  column_type text;
  column_default text;
  normalized_default text;
  invalid_count bigint;
  invalid_sample text;
  tables constant text[] := ARRAY[
    'admin_approval_requests',
    'admin_approval_workflows',
    'admin_role_assignments',
    'ai_deep_thinking_confirms',
    'ai_model_permissions',
    'ai_operator_communications',
    'ai_operator_interventions',
    'ai_operator_plans',
    'ai_operator_profiles',
    'ai_spending_alerts',
    'ai_style_learning_patterns',
    'ai_user_style_profiles',
    'assessment_definitions',
    'backup_configurations',
    'benefit_profile_points',
    'benefits_register',
    'budget_alerts',
    'budget_line_items',
    'budget_transactions',
    'case_core',
    'case_plan_versions',
    'case_workspace_action_proposal_decisions',
    'case_workspace_action_proposals',
    'case_workspace_artifact_links',
    'case_workspace_capabilities'
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
      RAISE EXCEPTION 'D03_STAGE1_COLUMN_MISSING table=% column=created_at', tbl;
    ELSIF column_type = 'timestamp with time zone' THEN
      CONTINUE;
    ELSIF column_type <> 'text' THEN
      RAISE EXCEPTION 'D03_STAGE1_TYPE_UNSUPPORTED table=% type=%', tbl, column_type;
    END IF;

    normalized_default := lower(regexp_replace(COALESCE(column_default, ''), '\s', '', 'g'));
    IF column_default IS NOT NULL
       AND normalized_default NOT IN ('now()', 'current_timestamp', '(now())::text') THEN
      RAISE EXCEPTION 'D03_STAGE1_DEFAULT_UNSUPPORTED table=% default=%', tbl, column_default;
    END IF;

    EXECUTE format(
      'SELECT count(*)::bigint, min(created_at) FROM public.%I WHERE created_at IS NOT NULL AND NOT pg_input_is_valid(created_at, ''timestamp with time zone'')',
      tbl
    ) INTO invalid_count, invalid_sample;

    IF invalid_count > 0 THEN
      RAISE EXCEPTION 'D03_STAGE1_INVALID_CREATED_AT table=% count=% sample=%',
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
$d03_stage1$;
