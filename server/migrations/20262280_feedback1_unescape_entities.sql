-- FEEDBACK-1 / DEC-575 — repair sanitizer entities already persisted in data.
--
-- Allowed decode set: &amp; &quot; &#39; &#x27; &#x60; &#96;.
-- Deliberately never decodes &lt; or &gt; to markup delimiters.
-- [ODMROZENIE 05_INITIATIVES DEC-575]
-- [ODMROZENIE 06_EXECUTION DEC-575]
-- [ODMROZENIE 07_MY_WORK_AGENT DEC-575]
-- [ODMROZENIE 13_CHAT DEC-575]

CREATE TABLE IF NOT EXISTS z_feedback_20262280_runs (
  run_id text PRIMARY KEY,
  decision_id text NOT NULL,
  migration_name text NOT NULL,
  source_base text NOT NULL,
  database_name text NOT NULL,
  state text NOT NULL CHECK (state IN ('STARTED', 'APPLIED', 'ROLLED_BACK')),
  columns_before bigint NOT NULL DEFAULT 0,
  row_column_pairs_before bigint NOT NULL DEFAULT 0,
  occurrences_before bigint NOT NULL DEFAULT 0,
  raw_angle_delimiters_before bigint NOT NULL DEFAULT 0,
  backup_count bigint NOT NULL DEFAULT 0,
  changed_count bigint NOT NULL DEFAULT 0,
  columns_after bigint NOT NULL DEFAULT 0,
  row_column_pairs_after bigint NOT NULL DEFAULT 0,
  occurrences_after bigint NOT NULL DEFAULT 0,
  raw_angle_delimiters_after bigint NOT NULL DEFAULT 0,
  inventory_digest text,
  manifest_columns bigint NOT NULL DEFAULT 0,
  expected_manifest_digest text,
  manifest_drift text,
  backup_digest text,
  applied_at timestamptz,
  rolled_back_at timestamptz
);

CREATE TABLE IF NOT EXISTS z_feedback_20262280_inventory (
  run_id text NOT NULL REFERENCES z_feedback_20262280_runs(run_id),
  table_schema text NOT NULL,
  table_name text NOT NULL,
  column_name text NOT NULL,
  data_type text NOT NULL,
  pk_columns text[] NOT NULL,
  storage_mode text NOT NULL CHECK (storage_mode IN ('per_value', 'native_json')),
  backup_table text NOT NULL,
  affected_rows bigint NOT NULL,
  occurrences_before bigint NOT NULL,
  PRIMARY KEY (run_id, table_schema, table_name, column_name)
);

CREATE TEMP TABLE feedback_20262280_preflight (
  table_schema text NOT NULL,
  table_name text NOT NULL,
  column_name text NOT NULL,
  data_type text NOT NULL,
  pk_columns text[] NOT NULL,
  storage_mode text NOT NULL,
  backup_table text NOT NULL,
  affected_rows bigint NOT NULL,
  occurrences_before bigint NOT NULL,
  row_count_before bigint NOT NULL,
  blocker text
) ON COMMIT DROP;

CREATE TEMP TABLE feedback_20262280_applied (
  backup_table text NOT NULL,
  column_name text NOT NULL,
  pk_json jsonb NOT NULL,
  old_value text NOT NULL,
  new_value text NOT NULL,
  PRIMARY KEY (backup_table, column_name, pk_json)
) ON COMMIT DROP;

CREATE OR REPLACE FUNCTION pg_temp.feedback_20262280_has_target(value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $function$
  SELECT value LIKE ANY (ARRAY['%&amp;%', '%&quot;%', '%&#39;%', '%&#x27;%', '%&#x60;%', '%&#96;%']);
$function$;

CREATE OR REPLACE FUNCTION pg_temp.feedback_20262280_occurrences(value text)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
STRICT
AS $function$
  SELECT
    ((length(value) - length(replace(value, '&amp;', ''))) / length('&amp;'))
    + ((length(value) - length(replace(value, '&quot;', ''))) / length('&quot;'))
    + ((length(value) - length(replace(value, '&#39;', ''))) / length('&#39;'))
    + ((length(value) - length(replace(value, '&#x27;', ''))) / length('&#x27;'))
    + ((length(value) - length(replace(value, '&#x60;', ''))) / length('&#x60;'))
    + ((length(value) - length(replace(value, '&#96;', ''))) / length('&#96;'));
$function$;

CREATE OR REPLACE FUNCTION pg_temp.feedback_20262280_raw_angle_delimiters(value text)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
STRICT
AS $function$
  SELECT
    (length(value) - length(replace(value, '<', '')))
    + (length(value) - length(replace(value, '>', '')));
$function$;

CREATE OR REPLACE FUNCTION pg_temp.feedback_20262280_decode(value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $function$
DECLARE
  direct_lt_marker text := chr(1) || 'FEEDBACK20262280_DIRECT_LT' || chr(1);
  direct_gt_marker text := chr(1) || 'FEEDBACK20262280_DIRECT_GT' || chr(1);
  escaped_lt_marker text := chr(1) || 'FEEDBACK20262280_ESCAPED_LT' || chr(1);
  escaped_gt_marker text := chr(1) || 'FEEDBACK20262280_ESCAPED_GT' || chr(1);
  current_value text;
  next_value text;
  pass integer;
  stable boolean := false;
BEGIN
  -- Preserve the exact number of literal &lt;/&gt; tokens. A nested form such
  -- as &amp;lt; is still an encoded ampersand plus text, so canonicalize its
  -- ampersand to &#38; instead of exposing an additional &lt; token.
  current_value := regexp_replace(value, '&(amp;)+lt;', escaped_lt_marker, 'g');
  current_value := regexp_replace(current_value, '&(amp;)+gt;', escaped_gt_marker, 'g');
  current_value := replace(current_value, '&lt;', direct_lt_marker);
  current_value := replace(current_value, '&gt;', direct_gt_marker);

  -- Decode until stable. The hard cap prevents malformed input from creating an
  -- unbounded loop, while the final probe makes reaching the cap fail closed.
  FOR pass IN 1..64 LOOP
    next_value := replace(current_value, '&amp;', '&');
    next_value := replace(next_value, '&quot;', '"');
    next_value := replace(next_value, '&#39;', '''');
    next_value := replace(next_value, '&#x27;', '''');
    next_value := replace(next_value, '&#x60;', '`');
    next_value := replace(next_value, '&#96;', '`');
    IF next_value = current_value THEN
      stable := true;
      EXIT;
    END IF;
    current_value := next_value;
  END LOOP;
  IF NOT stable THEN
    next_value := replace(current_value, '&amp;', '&');
    next_value := replace(next_value, '&quot;', '"');
    next_value := replace(next_value, '&#39;', '''');
    next_value := replace(next_value, '&#x27;', '''');
    next_value := replace(next_value, '&#x60;', '`');
    next_value := replace(next_value, '&#96;', '`');
    IF next_value <> current_value THEN
      RAISE EXCEPTION '20262280 decode did not reach a fixed point after 64 passes';
    END IF;
  END IF;

  current_value := replace(current_value, direct_lt_marker, '&lt;');
  current_value := replace(current_value, direct_gt_marker, '&gt;');
  current_value := replace(current_value, escaped_lt_marker, '&#38;lt;');
  current_value := replace(current_value, escaped_gt_marker, '&#38;gt;');
  RETURN current_value;
END;
$function$;

CREATE OR REPLACE FUNCTION pg_temp.feedback_20262280_is_jsonb(value text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $function$
BEGIN
  PERFORM value::jsonb;
  RETURN true;
EXCEPTION WHEN others THEN
  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION pg_temp.feedback_20262280_json_keys_have_target(value jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $function$
DECLARE
  item record;
  child jsonb;
BEGIN
  IF jsonb_typeof(value) = 'object' THEN
    FOR item IN SELECT key, val FROM jsonb_each(value) AS e(key, val) LOOP
      IF pg_temp.feedback_20262280_has_target(item.key)
         OR pg_temp.feedback_20262280_json_keys_have_target(item.val) THEN
        RETURN true;
      END IF;
    END LOOP;
  ELSIF jsonb_typeof(value) = 'array' THEN
    FOR child IN SELECT val FROM jsonb_array_elements(value) AS e(val) LOOP
      IF pg_temp.feedback_20262280_json_keys_have_target(child) THEN
        RETURN true;
      END IF;
    END LOOP;
  END IF;
  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION pg_temp.feedback_20262280_json_values(value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $function$
DECLARE
  output jsonb;
BEGIN
  CASE jsonb_typeof(value)
    WHEN 'string' THEN
      RETURN to_jsonb(pg_temp.feedback_20262280_decode(value #>> '{}'));
    WHEN 'array' THEN
      SELECT coalesce(jsonb_agg(pg_temp.feedback_20262280_json_values(item)), '[]'::jsonb)
        INTO output
        FROM jsonb_array_elements(value) AS a(item);
      RETURN output;
    WHEN 'object' THEN
      SELECT coalesce(jsonb_object_agg(key, pg_temp.feedback_20262280_json_values(val)), '{}'::jsonb)
        INTO output
        FROM jsonb_each(value) AS e(key, val);
      RETURN output;
    ELSE
      RETURN value;
  END CASE;
END;
$function$;

-- Full dynamic preflight. No application row is mutated before every candidate
-- column has a stable PK, parseable JSON mode and key-safe JSON structure.
DO $preflight$
DECLARE
  column_record record;
  pk_columns text[];
  statement text;
  backup_name text;
BEGIN
  FOR column_record IN
    SELECT c.table_schema, c.table_name, c.column_name, c.data_type,
           c.is_generated, c.is_identity
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema
       AND t.table_name = c.table_name
       AND t.table_type = 'BASE TABLE'
     WHERE c.table_schema = 'public'
       AND c.data_type IN ('text', 'character varying', 'character', 'json', 'jsonb')
       AND c.table_name NOT LIKE 'z\_%' ESCAPE '\'
       AND c.table_name NOT ILIKE '%backup%'
     ORDER BY c.table_name, c.ordinal_position
  LOOP
    SELECT coalesce(array_agg(a.attname ORDER BY key_column.ordinality), '{}')
      INTO pk_columns
      FROM pg_index i
      JOIN pg_class relation ON relation.oid = i.indrelid
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      JOIN unnest(i.indkey) WITH ORDINALITY AS key_column(attnum, ordinality) ON true
      JOIN pg_attribute a ON a.attrelid = relation.oid AND a.attnum = key_column.attnum
     WHERE i.indisprimary
       AND namespace.nspname = column_record.table_schema
       AND relation.relname = column_record.table_name;

    backup_name := left('z_feedback_20262280_backup_' || column_record.table_name, 50)
      || '_' || substr(md5(column_record.table_name), 1, 10);

    statement := format($sql$
      INSERT INTO feedback_20262280_preflight (
        table_schema, table_name, column_name, data_type, pk_columns,
        storage_mode, backup_table, affected_rows, occurrences_before,
        row_count_before, blocker
      )
      SELECT
        %L, %L, %L, %L, %L::text[],
        CASE WHEN %L IN ('json', 'jsonb') THEN 'native_json' ELSE 'per_value' END,
        %L,
        count(*)::bigint,
        coalesce(sum(pg_temp.feedback_20262280_occurrences(value)), 0)::bigint,
        (SELECT count(*) FROM %I.%I)::bigint,
        CASE
          WHEN cardinality(%L::text[]) = 0 THEN 'STOP: table has no primary key'
          WHEN %L = ANY(%L::text[]) THEN 'STOP: affected column participates in the primary key'
          WHEN %L <> 'NEVER' OR %L = 'YES' THEN 'STOP: affected column is generated or identity'
          WHEN count(*) FILTER (
                 WHERE (%L IN ('json', 'jsonb') OR pg_temp.feedback_20262280_is_jsonb(value))
                   AND pg_temp.feedback_20262280_json_keys_have_target(value::jsonb)
               ) > 0 THEN 'STOP: target entity occurs in a JSON object key'
          ELSE NULL
        END
      FROM (
        SELECT %I::text AS value
          FROM %I.%I
         WHERE pg_temp.feedback_20262280_has_target(%I::text)
      ) affected
      HAVING count(*) > 0
    $sql$,
      column_record.table_schema,
      column_record.table_name,
      column_record.column_name,
      column_record.data_type,
      pk_columns,
      column_record.data_type,
      backup_name,
      column_record.table_schema,
      column_record.table_name,
      pk_columns,
      column_record.column_name,
      pk_columns,
      column_record.is_generated,
      column_record.is_identity,
      column_record.data_type,
      column_record.column_name,
      column_record.table_schema,
      column_record.table_name,
      column_record.column_name
    );
    EXECUTE statement;
  END LOOP;

  IF EXISTS (SELECT 1 FROM feedback_20262280_preflight WHERE blocker IS NOT NULL) THEN
    RAISE EXCEPTION '20262280 preflight blocked: %',
      (SELECT string_agg(format('%I.%I.%I: %s', table_schema, table_name, column_name, blocker), '; ')
         FROM feedback_20262280_preflight WHERE blocker IS NOT NULL);
  END IF;

  RAISE WARNING '20262280 dynamic manifest: % affected columns, digest %',
    (SELECT count(*) FROM feedback_20262280_preflight),
    (SELECT md5(coalesce(string_agg(
      table_schema || '.' || table_name || '.' || column_name || ':' || data_type || ':' || storage_mode,
      '|' ORDER BY table_schema, table_name, column_name
    ), 'EMPTY')) FROM feedback_20262280_preflight);
END;
$preflight$;

INSERT INTO z_feedback_20262280_runs (
  run_id, decision_id, migration_name, source_base, database_name,
  state, columns_before, row_column_pairs_before,
  occurrences_before, inventory_digest, manifest_columns,
  expected_manifest_digest, manifest_drift
)
SELECT
  '20262280', 'DEC-575', '20262280_feedback1_unescape_entities.sql',
  'de751a9af8c6b801959c56e52641971a2993f2d4', current_database(),
  'STARTED', count(*), coalesce(sum(affected_rows), 0),
  coalesce(sum(occurrences_before), 0),
  md5(coalesce(string_agg(
    table_schema || '.' || table_name || '.' || column_name || ':' || data_type || ':' || storage_mode,
    '|' ORDER BY table_schema, table_name, column_name
  ), 'EMPTY')),
  count(*),
  nullif(current_setting('consultify.feedback_20262280_expected_manifest', true), ''),
  CASE
    WHEN nullif(current_setting('consultify.feedback_20262280_expected_manifest', true), '') IS NULL THEN NULL
    WHEN nullif(current_setting('consultify.feedback_20262280_expected_manifest', true), '') =
      md5(coalesce(string_agg(
        table_schema || '.' || table_name || '.' || column_name || ':' || data_type || ':' || storage_mode,
        '|' ORDER BY table_schema, table_name, column_name
      ), 'EMPTY')) THEN NULL
    ELSE 'WARN: dynamic manifest differs from optional expected digest'
  END
FROM feedback_20262280_preflight
ON CONFLICT (run_id) DO NOTHING;

DO $manifest_drift$
BEGIN
  IF EXISTS (
    SELECT 1 FROM z_feedback_20262280_runs
     WHERE run_id = '20262280' AND manifest_drift IS NOT NULL
  ) THEN
    RAISE WARNING '20262280 manifest drift: expected digest %, observed digest %',
      (SELECT expected_manifest_digest FROM z_feedback_20262280_runs WHERE run_id = '20262280'),
      (SELECT inventory_digest FROM z_feedback_20262280_runs WHERE run_id = '20262280');
  END IF;
END;
$manifest_drift$;

DO $apply$
DECLARE
  spec record;
  pk_expression text;
  transformed_expression text;
  assignment_expression text;
  inserted_count bigint := 0;
  updated_count bigint := 0;
  total_backup bigint := 0;
  total_changed bigint := 0;
  raw_angles_before bigint := 0;
  raw_angles_after bigint := 0;
  remaining_pairs bigint := 0;
  remaining_occurrences bigint := 0;
  total_columns_after bigint := 0;
  total_pairs_after bigint := 0;
  total_occurrences_after bigint := 0;
  row_count_after bigint;
  column_record record;
  measured_pairs bigint;
  measured_occurrences bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM feedback_20262280_preflight) THEN
    UPDATE z_feedback_20262280_runs
       SET state = 'APPLIED', applied_at = coalesce(applied_at, clock_timestamp())
     WHERE run_id = '20262280' AND state = 'STARTED';
    RAISE NOTICE '20262280: no matching data; strict no-op';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM z_feedback_20262280_runs WHERE run_id = '20262280' AND state <> 'STARTED') THEN
    RAISE EXCEPTION '20262280 has prior non-STARTED run state; refusing to overwrite evidence';
  END IF;

  INSERT INTO z_feedback_20262280_inventory (
    run_id, table_schema, table_name, column_name, data_type, pk_columns,
    storage_mode, backup_table, affected_rows, occurrences_before
  )
  SELECT '20262280', table_schema, table_name, column_name, data_type, pk_columns,
         storage_mode, backup_table, affected_rows, occurrences_before
    FROM feedback_20262280_preflight;

  FOR spec IN SELECT * FROM feedback_20262280_preflight ORDER BY table_name, column_name LOOP
    SELECT 'jsonb_build_object(' || string_agg(
      quote_literal(pk) || ', to_jsonb(t.' || quote_ident(pk) || ')', ', ' ORDER BY ordinality
    ) || ')'
      INTO pk_expression
      FROM unnest(spec.pk_columns) WITH ORDINALITY AS p(pk, ordinality);

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I ('
      || 'run_id text NOT NULL, table_schema text NOT NULL, table_name text NOT NULL, '
      || 'column_name text NOT NULL, pk_columns text[] NOT NULL, pk_json jsonb NOT NULL, '
      || 'data_type text NOT NULL, old_value text NOT NULL, new_value text NOT NULL, '
      || 'old_hash text NOT NULL, new_hash text NOT NULL, copied_at timestamptz NOT NULL DEFAULT clock_timestamp(), '
      || 'PRIMARY KEY (run_id, column_name, pk_json))',
      spec.backup_table
    );

    transformed_expression := CASE spec.storage_mode
      WHEN 'native_json' THEN format('pg_temp.feedback_20262280_json_values(t.%I::jsonb)::text', spec.column_name)
      ELSE format(
        'CASE WHEN pg_temp.feedback_20262280_is_jsonb(t.%1$I::text) '
        || 'THEN pg_temp.feedback_20262280_json_values(t.%1$I::text::jsonb)::text '
        || 'ELSE pg_temp.feedback_20262280_decode(t.%1$I::text) END',
        spec.column_name
      )
    END;

    EXECUTE format(
      'INSERT INTO %I (run_id, table_schema, table_name, column_name, pk_columns, pk_json, data_type, old_value, new_value, old_hash, new_hash) '
      || 'SELECT %L, %L, %L, %L, %L::text[], %s, %L, t.%I::text, %s, md5(t.%I::text), md5(%s) '
      || 'FROM %I.%I t WHERE pg_temp.feedback_20262280_has_target(t.%I::text) '
      || 'ON CONFLICT (run_id, column_name, pk_json) DO NOTHING',
      spec.backup_table, '20262280', spec.table_schema, spec.table_name, spec.column_name,
      spec.pk_columns, pk_expression, spec.data_type, spec.column_name,
      transformed_expression, spec.column_name, transformed_expression,
      spec.table_schema, spec.table_name, spec.column_name
    );
    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    IF inserted_count <> spec.affected_rows THEN
      RAISE EXCEPTION '20262280 backup mismatch for %.%.%: expected %, copied %',
        spec.table_schema, spec.table_name, spec.column_name, spec.affected_rows, inserted_count;
    END IF;

    EXECUTE format(
      'INSERT INTO feedback_20262280_applied (backup_table, column_name, pk_json, old_value, new_value) '
      || 'SELECT %L, column_name, pk_json, old_value, new_value FROM %I '
      || 'WHERE run_id = %L AND column_name = %L',
      spec.backup_table, spec.backup_table, '20262280', spec.column_name
    );

    assignment_expression := CASE spec.data_type
      WHEN 'jsonb' THEN 'b.new_value::jsonb'
      WHEN 'json' THEN 'b.new_value::json'
      ELSE 'b.new_value'
    END;

    EXECUTE format(
      'UPDATE %I.%I t SET %I = %s FROM %I b '
      || 'WHERE b.run_id = %L AND b.column_name = %L AND %s = b.pk_json AND t.%I::text = b.old_value',
      spec.table_schema, spec.table_name, spec.column_name, assignment_expression,
      spec.backup_table, '20262280', spec.column_name, pk_expression, spec.column_name
    );
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count <> inserted_count THEN
      RAISE EXCEPTION '20262280 update mismatch for %.%.%: backup %, changed %',
        spec.table_schema, spec.table_name, spec.column_name, inserted_count, updated_count;
    END IF;

    EXECUTE format('SELECT count(*) FROM %I.%I', spec.table_schema, spec.table_name)
      INTO row_count_after;
    IF row_count_after <> spec.row_count_before THEN
      RAISE EXCEPTION '20262280 row count changed for %.%: before %, after %',
        spec.table_schema, spec.table_name, spec.row_count_before, row_count_after;
    END IF;

    EXECUTE format(
      'SELECT count(*), coalesce(sum(pg_temp.feedback_20262280_occurrences(%I::text)), 0) '
      || 'FROM %I.%I WHERE pg_temp.feedback_20262280_has_target(%I::text)',
      spec.column_name, spec.table_schema, spec.table_name, spec.column_name
    ) INTO remaining_pairs, remaining_occurrences;
    IF remaining_pairs <> 0 OR remaining_occurrences <> 0 THEN
      RAISE EXCEPTION '20262280 target entities remain in %.%.%',
        spec.table_schema, spec.table_name, spec.column_name;
    END IF;

    RAISE NOTICE '20262280 %.%.%: before rows=%, before occurrences=%, after rows=%, after occurrences=%',
      spec.table_schema, spec.table_name, spec.column_name,
      spec.affected_rows, spec.occurrences_before, remaining_pairs, remaining_occurrences;

    total_backup := total_backup + inserted_count;
    total_changed := total_changed + updated_count;
  END LOOP;

  IF total_backup <> total_changed THEN
    RAISE EXCEPTION '20262280 global backup/change mismatch: % vs %', total_backup, total_changed;
  END IF;

  -- Re-scan the full dynamic candidate set after all writes. These are measured
  -- post-apply values, not values inferred from the rows we intended to update.
  FOR column_record IN
    SELECT c.table_schema, c.table_name, c.column_name
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema
       AND t.table_name = c.table_name
       AND t.table_type = 'BASE TABLE'
     WHERE c.table_schema = 'public'
       AND c.data_type IN ('text', 'character varying', 'character', 'json', 'jsonb')
       AND c.table_name NOT LIKE 'z\_%' ESCAPE '\'
       AND c.table_name NOT ILIKE '%backup%'
  LOOP
    EXECUTE format(
      'SELECT count(*), coalesce(sum(pg_temp.feedback_20262280_occurrences(%I::text)), 0) '
      || 'FROM %I.%I WHERE pg_temp.feedback_20262280_has_target(%I::text)',
      column_record.column_name, column_record.table_schema, column_record.table_name,
      column_record.column_name
    ) INTO measured_pairs, measured_occurrences;
    IF measured_pairs > 0 THEN
      total_columns_after := total_columns_after + 1;
      total_pairs_after := total_pairs_after + measured_pairs;
      total_occurrences_after := total_occurrences_after + measured_occurrences;
    END IF;
  END LOOP;

  IF total_columns_after <> 0 OR total_pairs_after <> 0 OR total_occurrences_after <> 0 THEN
    RAISE EXCEPTION '20262280 full post-apply scan found columns %, row-column pairs %, occurrences %',
      total_columns_after, total_pairs_after, total_occurrences_after;
  END IF;

  SELECT
    coalesce(sum(pg_temp.feedback_20262280_raw_angle_delimiters(old_value)), 0),
    coalesce(sum(pg_temp.feedback_20262280_raw_angle_delimiters(new_value)), 0)
    INTO raw_angles_before, raw_angles_after
    FROM feedback_20262280_applied;
  IF raw_angles_before <> raw_angles_after THEN
    RAISE EXCEPTION '20262280 changed raw angle delimiter count: before %, after %',
      raw_angles_before, raw_angles_after;
  END IF;

  UPDATE z_feedback_20262280_runs
     SET state = 'APPLIED',
         backup_count = total_backup,
         changed_count = total_changed,
         columns_after = total_columns_after,
         row_column_pairs_after = total_pairs_after,
         occurrences_after = total_occurrences_after,
         raw_angle_delimiters_before = raw_angles_before,
         raw_angle_delimiters_after = raw_angles_after,
         backup_digest = (
           SELECT md5(coalesce(string_agg(
             backup_table || ':' || column_name || ':' || pk_json::text || ':' || old_value || ':' || new_value,
             '|' ORDER BY backup_table, column_name, pk_json::text
           ), 'EMPTY')) FROM feedback_20262280_applied
         ),
         applied_at = clock_timestamp()
   WHERE run_id = '20262280' AND state = 'STARTED';

  RAISE NOTICE '20262280 applied: % row-column pairs across % columns',
    total_changed, (SELECT count(*) FROM feedback_20262280_preflight);
END;
$apply$;
