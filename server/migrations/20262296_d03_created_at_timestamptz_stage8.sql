-- D-03 stage 8/11: converge 25 legacy public.created_at columns from TEXT to
-- TIMESTAMPTZ. Invalid values abort the complete stage and are never nulled.
-- [ODMROZENIE WSPOLNE DEC-650]
DO $d03_stage8$
DECLARE
  tbl text;
  column_type text;
  column_default text;
  normalized_default text;
  invalid_count bigint;
  invalid_sample text;
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
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    SELECT c.data_type, c.column_default
      INTO column_type, column_default
      FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name = tbl
       AND c.column_name = 'created_at';

    IF column_type IS NULL THEN
      RAISE EXCEPTION 'D03_STAGE8_COLUMN_MISSING table=% column=created_at', tbl;
    ELSIF column_type = 'timestamp with time zone' THEN
      CONTINUE;
    ELSIF column_type <> 'text' THEN
      RAISE EXCEPTION 'D03_STAGE8_TYPE_UNSUPPORTED table=% type=%', tbl, column_type;
    END IF;

    normalized_default := lower(regexp_replace(COALESCE(column_default, ''), '\s', '', 'g'));
    IF column_default IS NOT NULL
       AND normalized_default NOT IN ('now()', 'current_timestamp') THEN
      RAISE EXCEPTION 'D03_STAGE8_DEFAULT_UNSUPPORTED table=% default=%', tbl, column_default;
    END IF;

    EXECUTE format(
      'SELECT count(*)::bigint, min(created_at) FROM public.%I WHERE created_at IS NOT NULL AND NOT pg_input_is_valid(created_at, ''timestamp with time zone'')',
      tbl
    ) INTO invalid_count, invalid_sample;
    IF invalid_count > 0 THEN
      RAISE EXCEPTION 'D03_STAGE8_INVALID_CREATED_AT table=% count=% sample=%',
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
$d03_stage8$;
