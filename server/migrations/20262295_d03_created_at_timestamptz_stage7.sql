-- D-03 stage 7/11: converge 25 legacy public.created_at columns from TEXT to
-- TIMESTAMPTZ. Invalid values abort the complete stage and are never nulled.
-- [ODMROZENIE WSPOLNE DEC-650]
DO $d03_stage7$
DECLARE
  tbl text;
  column_type text;
  column_default text;
  normalized_default text;
  invalid_count bigint;
  invalid_sample text;
  tables constant text[] := ARRAY[
    'v8_artifact_runs',
    'v8_business_object_sync_states',
    'v8_calendar_items',
    'v8_calendar_items_extended_itemtype',
    'v8_calendar_sources',
    'v8_canary_configs',
    'v8_chat_action_proposals',
    'v8_chat_execution_handoffs',
    'v8_cloud_linked_source_refreshes',
    'v8_collaboration_rooms',
    'v8_collaborative_decisions',
    'v8_concurrency_strategies',
    'v8_conflict_records',
    'v8_conflict_resolutions',
    'v8_connection_credentials',
    'v8_connector_auth_states',
    'v8_connector_fleet_health',
    'v8_connector_packages',
    'v8_consumer_tool_policies',
    'v8_context_snapshots',
    'v8_coordinated_publishes',
    'v8_cross_initiative_dependencies',
    'v8_cross_module_activity',
    'v8_dead_letter_records',
    'v8_decision_chains'
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
      RAISE EXCEPTION 'D03_STAGE7_COLUMN_MISSING table=% column=created_at', tbl;
    ELSIF column_type = 'timestamp with time zone' THEN
      CONTINUE;
    ELSIF column_type <> 'text' THEN
      RAISE EXCEPTION 'D03_STAGE7_TYPE_UNSUPPORTED table=% type=%', tbl, column_type;
    END IF;

    normalized_default := lower(regexp_replace(COALESCE(column_default, ''), '\s', '', 'g'));
    IF column_default IS NOT NULL
       AND normalized_default NOT IN ('now()', 'current_timestamp') THEN
      RAISE EXCEPTION 'D03_STAGE7_DEFAULT_UNSUPPORTED table=% default=%', tbl, column_default;
    END IF;

    EXECUTE format(
      'SELECT count(*)::bigint, min(created_at) FROM public.%I WHERE created_at IS NOT NULL AND NOT pg_input_is_valid(created_at, ''timestamp with time zone'')',
      tbl
    ) INTO invalid_count, invalid_sample;
    IF invalid_count > 0 THEN
      RAISE EXCEPTION 'D03_STAGE7_INVALID_CREATED_AT table=% count=% sample=%',
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
$d03_stage7$;
