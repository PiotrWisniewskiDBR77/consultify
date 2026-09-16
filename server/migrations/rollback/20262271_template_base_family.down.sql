-- TEMPLATE-1 / 20262271 rollback.
-- Restores every pre-existing source/card/link from the JSON backup captured by
-- the forward migration and removes only records created by that migration.

BEGIN;

DO $rollback$
DECLARE
  spec RECORD;
  saved RECORD;
  columns_sql TEXT;
  select_sql TEXT;
  update_sql TEXT;
BEGIN
  IF to_regclass('public.template_1_20262271_backup') IS NULL THEN
    RAISE NOTICE 'TEMPLATE-1 rollback no-op: backup table is absent';
    RETURN;
  END IF;

  -- Remove the current canonical links first so prior cross-organization or
  -- custom link payloads can be restored without a unique-key collision.
  DELETE FROM v8_artifact_origin_links
   WHERE (origin_runtime, origin_record_id) IN (
     ('document_template','doc-template-system-en-client_final_report'),
     ('presentation_template','dbr77-deck-board'),
     ('sheet_template','2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1')
   );

  DELETE FROM v8_output_artifacts a
   WHERE a.created_by = 'migration:20262271_template_base_family'
     AND NOT EXISTS (
       SELECT 1 FROM template_1_20262271_backup b
        WHERE b.entity_type = 'output_artifact'
          AND b.entity_key = a.artifact_id
     );

  DELETE FROM tp_base_templates t
   WHERE t.id = '2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1'::uuid
     AND NOT EXISTS (
       SELECT 1 FROM template_1_20262271_backup b
        WHERE b.entity_type = 'sheet_template'
          AND b.entity_key = t.id::text
     );

  FOR spec IN
    SELECT * FROM (VALUES
      ('document_studio_template', 'document_studio_templates', 'template_id'),
      ('presentation_template', 'presentation_templates', 'id'),
      ('sheet_template', 'tp_base_templates', 'id'),
      ('output_artifact', 'v8_output_artifacts', 'artifact_id'),
      ('origin_link', 'v8_artifact_origin_links', 'link_id')
    ) AS definitions(entity_type, table_name, primary_key)
  LOOP
    SELECT
      string_agg(format('%I', a.attname), ', ' ORDER BY a.attnum),
      string_agg(format('r.%I', a.attname), ', ' ORDER BY a.attnum),
      string_agg(
        format('%I = EXCLUDED.%I', a.attname, a.attname),
        ', ' ORDER BY a.attnum
      ) FILTER (WHERE a.attname <> spec.primary_key)
      INTO columns_sql, select_sql, update_sql
      FROM pg_attribute a
     WHERE a.attrelid = format('public.%I', spec.table_name)::regclass
       AND a.attnum > 0
       AND NOT a.attisdropped
       AND a.attgenerated = ''
       AND a.attidentity = '';

    FOR saved IN
      SELECT _backup
        FROM template_1_20262271_backup
       WHERE entity_type = spec.entity_type
       ORDER BY entity_key
    LOOP
      EXECUTE format(
        'INSERT INTO %I (%s) SELECT %s FROM jsonb_populate_record(NULL::%I, $1) r '
        || 'ON CONFLICT (%I) DO UPDATE SET %s',
        spec.table_name,
        columns_sql,
        select_sql,
        spec.table_name,
        spec.primary_key,
        update_sql
      ) USING saved._backup;
    END LOOP;
  END LOOP;

  DROP TABLE template_1_20262271_backup;
END $rollback$;

COMMIT;
