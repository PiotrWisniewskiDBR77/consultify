-- Explicit rollback for FEEDBACK-1 / DEC-575 migration 20262280.
-- Restores only values still equal to the migration's new_value. Any later
-- user edit is a conflict and aborts the entire rollback.

BEGIN;

DO $rollback$
DECLARE
  spec record;
  pk_expression text;
  assignment_expression text;
  conflict_count bigint;
  restored_count bigint;
  expected_count bigint := 0;
  total_restored bigint := 0;
BEGIN
  IF to_regclass('public.z_feedback_20262280_runs') IS NULL THEN
    RAISE NOTICE '20262280 rollback: run manifest absent; strict no-op';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM z_feedback_20262280_runs
     WHERE run_id = '20262280' AND state = 'ROLLED_BACK'
  ) THEN
    RAISE NOTICE '20262280 rollback: already rolled back; strict no-op';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM z_feedback_20262280_runs
     WHERE run_id = '20262280' AND state = 'APPLIED'
  ) THEN
    RAISE EXCEPTION '20262280 rollback requires an APPLIED manifest';
  END IF;

  -- Conflict preflight across every table/column before the first restore.
  FOR spec IN
    SELECT * FROM z_feedback_20262280_inventory
     WHERE run_id = '20262280'
     ORDER BY table_name, column_name
  LOOP
    IF to_regclass(format('public.%I', spec.backup_table)) IS NULL THEN
      RAISE EXCEPTION '20262280 rollback backup missing: %', spec.backup_table;
    END IF;

    SELECT 'jsonb_build_object(' || string_agg(
      quote_literal(pk) || ', to_jsonb(t.' || quote_ident(pk) || ')', ', ' ORDER BY ordinality
    ) || ')'
      INTO pk_expression
      FROM unnest(spec.pk_columns) WITH ORDINALITY AS p(pk, ordinality);

    EXECUTE format(
      'SELECT count(*) FROM %I b LEFT JOIN %I.%I t ON %s = b.pk_json '
      || 'WHERE b.run_id = %L AND b.column_name = %L '
      || 'AND (t.%I IS NULL OR t.%I::text IS DISTINCT FROM b.new_value)',
      spec.backup_table, spec.table_schema, spec.table_name, pk_expression,
      '20262280', spec.column_name, spec.column_name, spec.column_name
    ) INTO conflict_count;

    IF conflict_count > 0 THEN
      RAISE EXCEPTION '20262280 rollback conflict in %.%.%: % rows changed or missing after apply',
        spec.table_schema, spec.table_name, spec.column_name, conflict_count;
    END IF;
  END LOOP;

  FOR spec IN
    SELECT * FROM z_feedback_20262280_inventory
     WHERE run_id = '20262280'
     ORDER BY table_name, column_name
  LOOP
    SELECT 'jsonb_build_object(' || string_agg(
      quote_literal(pk) || ', to_jsonb(t.' || quote_ident(pk) || ')', ', ' ORDER BY ordinality
    ) || ')'
      INTO pk_expression
      FROM unnest(spec.pk_columns) WITH ORDINALITY AS p(pk, ordinality);

    assignment_expression := CASE spec.data_type
      WHEN 'jsonb' THEN 'b.old_value::jsonb'
      WHEN 'json' THEN 'b.old_value::json'
      ELSE 'b.old_value'
    END;

    EXECUTE format(
      'SELECT count(*) FROM %I WHERE run_id = %L AND column_name = %L',
      spec.backup_table, '20262280', spec.column_name
    ) INTO expected_count;

    EXECUTE format(
      'UPDATE %I.%I t SET %I = %s FROM %I b '
      || 'WHERE b.run_id = %L AND b.column_name = %L AND %s = b.pk_json '
      || 'AND t.%I::text = b.new_value',
      spec.table_schema, spec.table_name, spec.column_name, assignment_expression,
      spec.backup_table, '20262280', spec.column_name, pk_expression, spec.column_name
    );
    GET DIAGNOSTICS restored_count = ROW_COUNT;

    IF restored_count <> expected_count THEN
      RAISE EXCEPTION '20262280 rollback restore mismatch for %.%.%: expected %, restored %',
        spec.table_schema, spec.table_name, spec.column_name, expected_count, restored_count;
    END IF;

    EXECUTE format(
      'SELECT count(*) FROM %I b JOIN %I.%I t ON %s = b.pk_json '
      || 'WHERE b.run_id = %L AND b.column_name = %L '
      || 'AND (t.%I::text IS DISTINCT FROM b.old_value OR md5(t.%I::text) <> b.old_hash)',
      spec.backup_table, spec.table_schema, spec.table_name, pk_expression,
      '20262280', spec.column_name, spec.column_name, spec.column_name
    ) INTO conflict_count;
    IF conflict_count > 0 THEN
      RAISE EXCEPTION '20262280 rollback readback/hash mismatch in %.%.%: % rows',
        spec.table_schema, spec.table_name, spec.column_name, conflict_count;
    END IF;
    total_restored := total_restored + restored_count;
  END LOOP;

  IF total_restored <> (
    SELECT backup_count FROM z_feedback_20262280_runs WHERE run_id = '20262280'
  ) THEN
    RAISE EXCEPTION '20262280 rollback global restore mismatch';
  END IF;

  UPDATE z_feedback_20262280_runs
     SET state = 'ROLLED_BACK', rolled_back_at = clock_timestamp()
   WHERE run_id = '20262280' AND state = 'APPLIED';

  RAISE NOTICE '20262280 rollback restored % row-column pairs', total_restored;
END;
$rollback$;

COMMIT;
