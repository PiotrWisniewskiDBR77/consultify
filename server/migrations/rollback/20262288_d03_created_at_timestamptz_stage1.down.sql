-- Rollback for D-03 stage 1/11. Values remain lossless ISO timestamp text;
-- tables that had no default before UP keep no default after DOWN.
DO $d03_stage1_down$
DECLARE
  tbl text;
  column_type text;
  column_default text;
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
      RAISE EXCEPTION 'D03_STAGE1_DOWN_COLUMN_MISSING table=% column=created_at', tbl;
    ELSIF column_type = 'text' THEN
      CONTINUE;
    ELSIF column_type <> 'timestamp with time zone' THEN
      RAISE EXCEPTION 'D03_STAGE1_DOWN_TYPE_UNSUPPORTED table=% type=%', tbl, column_type;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN created_at DROP DEFAULT', tbl);
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN created_at TYPE text USING created_at::text',
      tbl
    );
    IF column_default IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN created_at SET DEFAULT (now())::text',
        tbl
      );
    END IF;
  END LOOP;
END
$d03_stage1_down$;
