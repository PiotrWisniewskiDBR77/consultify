-- D-03 stage 9/11: converge 25 legacy public.created_at columns from TEXT to
-- TIMESTAMPTZ. Invalid values abort the complete stage and are never nulled.
-- [ODMROZENIE WSPOLNE DEC-650]
DO $d03_stage9$
DECLARE
  tbl text;
  column_type text;
  column_default text;
  normalized_default text;
  invalid_count bigint;
  invalid_sample text;
  tables constant text[] := ARRAY[
    'v8_output_ai_governance',
    'v8_output_artifacts',
    'v8_output_exports',
    'v8_platform_seam_registry',
    'v8_promotion_gates',
    'v8_prompt_presets',
    'v8_provenance_ledger',
    'v8_provider_depth_profiles',
    'v8_provider_health',
    'v8_publish_records',
    'v8_radar_triage_signals',
    'v8_rebaseline_proposals',
    'v8_recurring_output_programs',
    'v8_refresh_timing_policies',
    'v8_release_bundles',
    'v8_replay_requests',
    'v8_resource_type_mappings',
    'v8_retrieval_requests',
    'v8_retrieval_traces',
    'v8_retry_policies',
    'v8_review_gates',
    'v8_roi_realization_entries',
    'v8_schema_drift_events',
    'v8_session_insights',
    'v8_shadow_comparisons'
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
      RAISE EXCEPTION 'D03_STAGE9_COLUMN_MISSING table=% column=created_at', tbl;
    ELSIF column_type = 'timestamp with time zone' THEN
      CONTINUE;
    ELSIF column_type <> 'text' THEN
      RAISE EXCEPTION 'D03_STAGE9_TYPE_UNSUPPORTED table=% type=%', tbl, column_type;
    END IF;

    normalized_default := lower(regexp_replace(COALESCE(column_default, ''), '\s', '', 'g'));
    IF column_default IS NOT NULL
       AND normalized_default NOT IN ('now()', 'current_timestamp') THEN
      RAISE EXCEPTION 'D03_STAGE9_DEFAULT_UNSUPPORTED table=% default=%', tbl, column_default;
    END IF;

    EXECUTE format(
      'SELECT count(*)::bigint, min(created_at) FROM public.%I WHERE created_at IS NOT NULL AND NOT pg_input_is_valid(created_at, ''timestamp with time zone'')',
      tbl
    ) INTO invalid_count, invalid_sample;
    IF invalid_count > 0 THEN
      RAISE EXCEPTION 'D03_STAGE9_INVALID_CREATED_AT table=% count=% sample=%',
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
$d03_stage9$;
