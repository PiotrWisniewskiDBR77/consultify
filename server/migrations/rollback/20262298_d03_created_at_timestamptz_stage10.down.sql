-- Rollback for D-03 stage 10/11. Restore TEXT and the exact default families
-- measured on the pre-deployment-29 dump.
-- [ODMROZENIE WSPOLNE DEC-650]
DO $d03_stage10_down$
DECLARE
  tbl text;
  column_type text;
  tables constant text[] := ARRAY[
    'v8_shared_tools_registry',
    'v8_source_materialization_records',
    'v8_superadmin_domains',
    'v8_superadmin_surfaces',
    'v8_support_notes',
    'v8_support_traces',
    'v8_synced_source_refs',
    'v8_template_families',
    'v8_tool_action_governance',
    'v8_tool_catalog',
    'v8_tool_event_registry',
    'v8_tool_invocation_log',
    'v8_tool_session_governance',
    'v8_tools_v8_bridging_contracts',
    'v8_unreconciled_delta_escalations',
    'v8_working_memory_entries',
    'v8_workspace_sessions',
    'value_capture_gates',
    'value_ledger_entries',
    'virtual_worker_insights',
    'virtual_worker_messages',
    'virtual_worker_profiles',
    'virtual_workers',
    'wave5_artifact_versions',
    'wave5_artifacts'
  ];
  no_default_tables constant text[] := ARRAY[
    'v8_workspace_sessions'
  ];
  current_timestamp_default_tables constant text[] := ARRAY[
    'value_ledger_entries',
    'wave5_artifact_versions',
    'wave5_artifacts'
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
      RAISE EXCEPTION 'D03_STAGE10_DOWN_COLUMN_MISSING table=% column=created_at', tbl;
    ELSIF column_type = 'text' THEN
      CONTINUE;
    ELSIF column_type <> 'timestamp with time zone' THEN
      RAISE EXCEPTION 'D03_STAGE10_DOWN_TYPE_UNSUPPORTED table=% type=%', tbl, column_type;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN created_at DROP DEFAULT', tbl);
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN created_at TYPE text USING created_at::text',
      tbl
    );

    IF tbl = ANY (no_default_tables) THEN
      CONTINUE;
    END IF;
    IF tbl = ANY (current_timestamp_default_tables) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP',
        tbl
      );
    ELSE
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN created_at SET DEFAULT now()',
        tbl
      );
    END IF;
  END LOOP;
END
$d03_stage10_down$;
