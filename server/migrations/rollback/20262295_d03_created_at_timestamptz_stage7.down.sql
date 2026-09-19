-- Rollback for D-03 stage 7/11. Restore TEXT and the exact default families
-- measured on the pre-deployment-29 dump.
-- [ODMROZENIE WSPOLNE DEC-650]
DO $d03_stage7_down$
DECLARE
  tbl text;
  column_type text;
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
  no_default_tables constant text[] := ARRAY[
    'v8_calendar_items',
    'v8_calendar_items_extended_itemtype',
    'v8_calendar_sources',
    'v8_collaborative_decisions',
    'v8_cross_module_activity'
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
      RAISE EXCEPTION 'D03_STAGE7_DOWN_COLUMN_MISSING table=% column=created_at', tbl;
    ELSIF column_type = 'text' THEN
      CONTINUE;
    ELSIF column_type <> 'timestamp with time zone' THEN
      RAISE EXCEPTION 'D03_STAGE7_DOWN_TYPE_UNSUPPORTED table=% type=%', tbl, column_type;
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
$d03_stage7_down$;
