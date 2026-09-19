-- Rollback for D-03 stage 8/11. Restore TEXT and the exact default families
-- measured on the pre-deployment-29 dump.
-- [ODMROZENIE WSPOLNE DEC-650]
DO $d03_stage8_down$
DECLARE
  tbl text;
  column_type text;
  tables constant text[] := ARRAY[
    'v8_degraded_conditions',
    'v8_demo_trial_configs',
    'v8_deviation_records',
    'v8_execution_runs',
    'v8_executive_review_packs',
    'v8_finance_document_ingestions',
    'v8_finance_document_ingestions__w18',
    'v8_finance_lane_runs',
    'v8_finance_mutation_audit',
    'v8_finance_version_snapshots',
    'v8_governance_sensitive_fields',
    'v8_initiative_decompositions',
    'v8_initiative_economics_linkages',
    'v8_initiative_entrypoints',
    'v8_initiative_materializations',
    'v8_kpi_definitions',
    'v8_kpi_finance_reconciliations',
    'v8_kpi_next_actions',
    'v8_kpi_signals',
    'v8_landing_page_sections',
    'v8_memory_promotion_requests',
    'v8_mindmap_ai_proposals',
    'v8_mindmap_nodes',
    'v8_notification_records',
    'v8_notification_triggers'
  ];
  no_default_tables constant text[] := ARRAY[
    'v8_finance_document_ingestions',
    'v8_finance_document_ingestions__w18',
    'v8_finance_lane_runs',
    'v8_finance_mutation_audit',
    'v8_finance_version_snapshots'
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
      RAISE EXCEPTION 'D03_STAGE8_DOWN_COLUMN_MISSING table=% column=created_at', tbl;
    ELSIF column_type = 'text' THEN
      CONTINUE;
    ELSIF column_type <> 'timestamp with time zone' THEN
      RAISE EXCEPTION 'D03_STAGE8_DOWN_TYPE_UNSUPPORTED table=% type=%', tbl, column_type;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN created_at DROP DEFAULT', tbl);
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN created_at TYPE text USING created_at::text',
      tbl
    );

    IF tbl = ANY (no_default_tables) THEN
      CONTINUE;
    END IF;
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN created_at SET DEFAULT now()',
      tbl
    );
  END LOOP;
END
$d03_stage8_down$;
