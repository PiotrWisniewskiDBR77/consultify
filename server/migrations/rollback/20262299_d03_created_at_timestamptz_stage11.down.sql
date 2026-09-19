-- Rollback for D-03 stage 11/11. Restore TEXT and the exact default families
-- measured on the pre-deployment-29 dump.
-- [ODMROZENIE WSPOLNE DEC-650]
DO $d03_stage11_down$
DECLARE
  tbl text;
  column_type text;
  tables constant text[] := ARRAY[
    'wave5_mutation_proposals',
    'wave6_context_ledger',
    'wave6_context_snapshots',
    'wave6_memory_candidates',
    'wave6_memory_stewardship_decisions',
    'wave7_connector_runs',
    'wave7_connectors',
    'wave8_agent_definitions',
    'wave8_agent_notifications',
    'wave8_agent_runs',
    'wave8_agent_schedules',
    'wave8_agent_tool_governance_events',
    'wave9_acceptance_decisions',
    'wave9_evidence_registry',
    'wave9_incidents',
    'wave9_outcomes',
    'webhook_deliveries',
    'work_canvas_drafts',
    'work_canvas_ideas',
    'work_canvas_proposals',
    'z139_backup_919_work_canvas_drafts'
  ];
  no_default_tables constant text[] := ARRAY[
    'webhook_deliveries',
    'work_canvas_drafts',
    'work_canvas_ideas',
    'work_canvas_proposals',
    'z139_backup_919_work_canvas_drafts'
  ];
  current_timestamp_default_tables constant text[] := ARRAY[
    'wave5_mutation_proposals',
    'wave6_context_ledger',
    'wave6_context_snapshots',
    'wave6_memory_candidates',
    'wave6_memory_stewardship_decisions',
    'wave7_connector_runs',
    'wave7_connectors',
    'wave8_agent_definitions',
    'wave8_agent_notifications',
    'wave8_agent_runs',
    'wave8_agent_schedules',
    'wave8_agent_tool_governance_events',
    'wave9_acceptance_decisions',
    'wave9_evidence_registry',
    'wave9_incidents',
    'wave9_outcomes'
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
      RAISE EXCEPTION 'D03_STAGE11_DOWN_COLUMN_MISSING table=% column=created_at', tbl;
    ELSIF column_type = 'text' THEN
      CONTINUE;
    ELSIF column_type <> 'timestamp with time zone' THEN
      RAISE EXCEPTION 'D03_STAGE11_DOWN_TYPE_UNSUPPORTED table=% type=%', tbl, column_type;
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
$d03_stage11_down$;
