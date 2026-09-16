-- TEMPLATE-1b / 20262272 rollback.
-- Restores every source, artifact and origin link from the immutable before-image.

BEGIN;

DO $rollback$
DECLARE
  spec RECORD;
  saved RECORD;
  columns_sql TEXT;
  select_sql TEXT;
  update_sql TEXT;
  index_preexisting BOOLEAN;
BEGIN
  IF to_regclass('public.template_1_20262272_backup') IS NULL THEN
    RAISE NOTICE 'TEMPLATE-1b rollback no-op: backup table is absent';
    RETURN;
  END IF;

  SELECT COALESCE((_backup->>'resultsKpiIndexPreexisting')::boolean,FALSE)
    INTO index_preexisting
    FROM template_1_20262272_backup
   WHERE entity_type='migration_state' AND entity_key='initialized';

  IF NOT COALESCE(index_preexisting,FALSE) THEN
    DROP INDEX IF EXISTS idx_report_builder_templates_one_active_results_kpi_default;
  END IF;

  DELETE FROM v8_artifact_origin_links l
   WHERE l.origin_runtime='presentation_template'
     AND l.origin_record_id='pt-drd-presentation-v2'
     AND NOT EXISTS (
       SELECT 1 FROM template_1_20262272_backup b
        WHERE b.entity_type='origin_link' AND b.entity_key=l.link_id
     );

  DELETE FROM v8_output_artifacts a
   WHERE a.created_by='migration:20262272_template_library_cleanup_96'
     AND NOT EXISTS (
       SELECT 1 FROM template_1_20262272_backup b
        WHERE b.entity_type='output_artifact' AND b.entity_key=a.artifact_id
     );

  DELETE FROM presentation_templates p
   WHERE p.id='pt-drd-presentation-v2'
     AND NOT EXISTS (
       SELECT 1 FROM template_1_20262272_backup b
        WHERE b.entity_type='presentation_template' AND b.entity_key=p.id
     );

  FOR spec IN
    SELECT * FROM (VALUES
      ('document_studio_template','document_studio_templates','template_id'),
      ('report_builder_template','report_builder_templates','id'),
      ('presentation_template','presentation_templates','id'),
      ('sheet_template','tp_base_templates','id'),
      ('output_artifact','v8_output_artifacts','artifact_id'),
      ('origin_link','v8_artifact_origin_links','link_id')
    ) AS definitions(entity_type,table_name,primary_key)
  LOOP
    SELECT
      string_agg(format('%I',a.attname),', ' ORDER BY a.attnum),
      string_agg(format('r.%I',a.attname),', ' ORDER BY a.attnum),
      string_agg(format('%I = EXCLUDED.%I',a.attname,a.attname),', ' ORDER BY a.attnum)
        FILTER (WHERE a.attname <> spec.primary_key)
      INTO columns_sql,select_sql,update_sql
      FROM pg_attribute a
     WHERE a.attrelid=format('public.%I',spec.table_name)::regclass
       AND a.attnum > 0 AND NOT a.attisdropped
       AND a.attgenerated='' AND a.attidentity='';

    FOR saved IN
      SELECT _backup FROM template_1_20262272_backup
       WHERE entity_type=spec.entity_type ORDER BY entity_key
    LOOP
      EXECUTE format(
        'INSERT INTO %I (%s) SELECT %s FROM jsonb_populate_record(NULL::%I,$1) r '
        || 'ON CONFLICT (%I) DO UPDATE SET %s',
        spec.table_name,columns_sql,select_sql,spec.table_name,spec.primary_key,update_sql
      ) USING saved._backup;
    END LOOP;
  END LOOP;

  DROP TABLE template_1_20262272_backup;
END $rollback$;

COMMIT;
