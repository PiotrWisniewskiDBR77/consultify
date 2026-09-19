-- Rollback for D-03 stage 9/11. Restore TEXT and the exact default families
-- measured on the pre-deployment-29 dump.
-- [ODMROZENIE WSPOLNE DEC-650]
DO $d03_stage9_down$
DECLARE
  tbl text;
  column_type text;
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
  no_default_tables constant text[] := ARRAY[
    'v8_output_exports',
    'v8_session_insights'
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
      RAISE EXCEPTION 'D03_STAGE9_DOWN_COLUMN_MISSING table=% column=created_at', tbl;
    ELSIF column_type = 'text' THEN
      CONTINUE;
    ELSIF column_type <> 'timestamp with time zone' THEN
      RAISE EXCEPTION 'D03_STAGE9_DOWN_TYPE_UNSUPPORTED table=% type=%', tbl, column_type;
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
$d03_stage9_down$;
