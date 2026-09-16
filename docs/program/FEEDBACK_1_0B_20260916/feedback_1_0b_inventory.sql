\set ON_ERROR_STOP on

-- FEEDBACK-1 / position 0b — READ-ONLY inventory for a future approved repair.
--
-- This file does not mutate application data. Its only DDL is session-local
-- pg_temp state, which disappears when psql disconnects. Run it against the
-- explicitly selected database before authoring or approving a migration.
--
-- Scope approved by W137: &amp;, &quot;, &#39;, &#x27;, &#x60;, and &#96;.
-- It never searches for or decodes &lt; or &gt;.

-- Session-local DDL is prepared before the read-only inventory transaction.
-- No persistent schema object or application row is created here.
CREATE TEMP TABLE feedback_1_0b_inventory (
  table_schema text NOT NULL,
  table_name text NOT NULL,
  column_name text NOT NULL,
  data_type text NOT NULL,
  pk_columns text[] NOT NULL DEFAULT '{}',
  affected_rows bigint NOT NULL,
  amp_occurrences bigint NOT NULL,
  quot_occurrences bigint NOT NULL,
  apos39_occurrences bigint NOT NULL,
  aposx27_occurrences bigint NOT NULL,
  backtick60_occurrences bigint NOT NULL,
  backtick96_occurrences bigint NOT NULL,
  json_parseable_rows bigint NOT NULL,
  json_unparseable_rows bigint NOT NULL,
  json_key_rows bigint NOT NULL,
  proposed_storage_mode text NOT NULL,
  blocker text
);

CREATE OR REPLACE FUNCTION pg_temp.feedback_1_0b_is_jsonb(value text)
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

CREATE OR REPLACE FUNCTION pg_temp.feedback_1_0b_json_keys_have_target(value jsonb)
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
      IF item.key LIKE ANY (ARRAY['%&amp;%', '%&quot;%', '%&#39;%', '%&#x27;%', '%&#x60;%', '%&#96;%'])
         OR pg_temp.feedback_1_0b_json_keys_have_target(item.val) THEN
        RETURN true;
      END IF;
    END LOOP;
  ELSIF jsonb_typeof(value) = 'array' THEN
    FOR child IN SELECT val FROM jsonb_array_elements(value) AS e(val) LOOP
      IF pg_temp.feedback_1_0b_json_keys_have_target(child) THEN
        RETURN true;
      END IF;
    END LOOP;
  END IF;
  RETURN false;
END;
$function$;

BEGIN READ ONLY;

DO $block$
DECLARE
  column_record record;
  pk_columns text[];
  statement text;
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

    statement := format($sql$
      INSERT INTO feedback_1_0b_inventory (
        table_schema, table_name, column_name, data_type, pk_columns,
        affected_rows, amp_occurrences, quot_occurrences, apos39_occurrences,
        aposx27_occurrences, backtick60_occurrences, backtick96_occurrences,
        json_parseable_rows, json_unparseable_rows, json_key_rows,
        proposed_storage_mode, blocker
      )
      SELECT
        %L, %L, %L, %L, %L::text[],
        count(*)::bigint,
        coalesce(sum((length(value) - length(replace(value, '&amp;', ''))) / length('&amp;')), 0)::bigint,
        coalesce(sum((length(value) - length(replace(value, '&quot;', ''))) / length('&quot;')), 0)::bigint,
        coalesce(sum((length(value) - length(replace(value, '&#39;', ''))) / length('&#39;')), 0)::bigint,
        coalesce(sum((length(value) - length(replace(value, '&#x27;', ''))) / length('&#x27;')), 0)::bigint,
        coalesce(sum((length(value) - length(replace(value, '&#x60;', ''))) / length('&#x60;')), 0)::bigint,
        coalesce(sum((length(value) - length(replace(value, '&#96;', ''))) / length('&#96;')), 0)::bigint,
        count(*) FILTER (WHERE %L IN ('json', 'jsonb') OR pg_temp.feedback_1_0b_is_jsonb(value))::bigint,
        count(*) FILTER (WHERE %L NOT IN ('json', 'jsonb') AND NOT pg_temp.feedback_1_0b_is_jsonb(value))::bigint,
        count(*) FILTER (
          WHERE (%L IN ('json', 'jsonb') OR pg_temp.feedback_1_0b_is_jsonb(value))
            AND pg_temp.feedback_1_0b_json_keys_have_target(value::jsonb)
        )::bigint,
        CASE WHEN %L IN ('json', 'jsonb') THEN 'native_json' ELSE 'per_value' END,
        CASE
          WHEN cardinality(%L::text[]) = 0 THEN 'STOP: table has no primary key'
          WHEN %L = ANY(%L::text[]) THEN 'STOP: affected column participates in the primary key'
          WHEN %L <> 'NEVER' OR %L = 'YES' THEN 'STOP: affected column is generated or identity'
          WHEN count(*) FILTER (
                 WHERE (%L IN ('json', 'jsonb') OR pg_temp.feedback_1_0b_is_jsonb(value))
                   AND pg_temp.feedback_1_0b_json_keys_have_target(value::jsonb)
               ) > 0 THEN 'STOP: target entity occurs in a JSON object key'
          ELSE NULL
        END
      FROM (
        SELECT %I::text AS value
          FROM %I.%I
         WHERE %I::text LIKE ANY (ARRAY['%%&amp;%%', '%%&quot;%%', '%%&#39;%%', '%%&#x27;%%', '%%&#x60;%%', '%%&#96;%%'])
      ) affected
      HAVING count(*) > 0
    $sql$,
      column_record.table_schema,
      column_record.table_name,
      column_record.column_name,
      column_record.data_type,
      pk_columns,
      column_record.data_type,
      column_record.data_type,
      column_record.data_type,
      column_record.data_type,
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
END;
$block$;

-- Detailed manifest. Save this result as immutable evidence before approval.
SELECT *
  FROM feedback_1_0b_inventory
 ORDER BY affected_rows DESC, table_name, column_name;

-- One-row dynamic manifest. Count drift is evidence, not a blocker; blockers
-- remain explicit per column and stop approval.
SELECT
  count(*)::int AS observed_columns,
  md5(coalesce(string_agg(
    table_schema || '.' || table_name || '.' || column_name || ':' || data_type || ':' || proposed_storage_mode,
    '|' ORDER BY table_schema, table_name, column_name
  ), 'EMPTY')) AS manifest_digest,
  coalesce(sum(affected_rows), 0)::bigint AS affected_row_column_pairs,
  coalesce(sum(amp_occurrences + quot_occurrences + apos39_occurrences + aposx27_occurrences + backtick60_occurrences + backtick96_occurrences), 0)::bigint AS target_occurrences,
  count(*) FILTER (WHERE blocker IS NOT NULL)::int AS blocked_columns,
  count(*) FILTER (WHERE proposed_storage_mode = 'per_value')::int AS per_value_columns,
  count(*) FILTER (WHERE proposed_storage_mode = 'native_json')::int AS native_json_columns,
  CASE
    WHEN count(*) FILTER (WHERE blocker IS NOT NULL) > 0 THEN 'STOP: resolve per-column blockers'
    ELSE 'INVENTORY_READY_FOR_CTO_REVIEW'
  END AS verdict
FROM feedback_1_0b_inventory;

ROLLBACK;
