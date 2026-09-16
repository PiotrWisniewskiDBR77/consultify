\set ON_ERROR_STOP on

-- FEEDBACK-1 / position 0b — READ-ONLY inventory for a future approved repair.
--
-- This file does not mutate application data. Its only DDL is session-local
-- pg_temp state, which disappears when psql disconnects. Run it against the
-- explicitly selected database before authoring or approving a migration.
--
-- Scope is intentionally narrow: &quot;, &#39;, &#x27;, and &#x60;.
-- It does not search for or decode &amp;, &lt;, or &gt;.

-- Session-local DDL is prepared before the read-only inventory transaction.
-- No persistent schema object or application row is created here.
CREATE TEMP TABLE feedback_1_0b_inventory (
  table_schema text NOT NULL,
  table_name text NOT NULL,
  column_name text NOT NULL,
  data_type text NOT NULL,
  pk_columns text[] NOT NULL DEFAULT '{}',
  affected_rows bigint NOT NULL,
  quot_occurrences bigint NOT NULL,
  apos39_occurrences bigint NOT NULL,
  aposx27_occurrences bigint NOT NULL,
  backtick_occurrences bigint NOT NULL,
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
      IF item.key LIKE ANY (ARRAY['%&quot;%', '%&#39;%', '%&#x27;%', '%&#x60;%'])
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
    SELECT c.table_schema, c.table_name, c.column_name, c.data_type
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
        affected_rows, quot_occurrences, apos39_occurrences,
        aposx27_occurrences, backtick_occurrences,
        json_parseable_rows, json_unparseable_rows, json_key_rows,
        proposed_storage_mode, blocker
      )
      SELECT
        %L, %L, %L, %L, %L::text[],
        count(*)::bigint,
        coalesce(sum((length(value) - length(replace(value, '&quot;', ''))) / length('&quot;')), 0)::bigint,
        coalesce(sum((length(value) - length(replace(value, '&#39;', ''))) / length('&#39;')), 0)::bigint,
        coalesce(sum((length(value) - length(replace(value, '&#x27;', ''))) / length('&#x27;')), 0)::bigint,
        coalesce(sum((length(value) - length(replace(value, '&#x60;', ''))) / length('&#x60;')), 0)::bigint,
        count(*) FILTER (WHERE %L IN ('json', 'jsonb') OR pg_temp.feedback_1_0b_is_jsonb(value))::bigint,
        count(*) FILTER (WHERE %L NOT IN ('json', 'jsonb') AND NOT pg_temp.feedback_1_0b_is_jsonb(value))::bigint,
        count(*) FILTER (
          WHERE (%L IN ('json', 'jsonb') OR pg_temp.feedback_1_0b_is_jsonb(value))
            AND pg_temp.feedback_1_0b_json_keys_have_target(value::jsonb)
        )::bigint,
        CASE
          WHEN %L IN ('json', 'jsonb') THEN 'native_json'
          WHEN %L ~* '(^|_)(json|snapshot|payload|overrides)($|_)'
               AND bool_and(pg_temp.feedback_1_0b_is_jsonb(value)) THEN 'json_text'
          ELSE 'plain_text'
        END,
        CASE
          WHEN cardinality(%L::text[]) = 0 THEN 'STOP: table has no primary key'
          WHEN count(*) FILTER (
                 WHERE (%L IN ('json', 'jsonb') OR pg_temp.feedback_1_0b_is_jsonb(value))
                   AND pg_temp.feedback_1_0b_json_keys_have_target(value::jsonb)
               ) > 0 THEN 'STOP: target entity occurs in a JSON object key'
          WHEN %L ~* '(^|_)(json|snapshot|payload|overrides)($|_)'
               AND count(*) FILTER (WHERE NOT pg_temp.feedback_1_0b_is_jsonb(value)) > 0
            THEN 'STOP: JSON-shaped text column contains an unparseable affected value'
          ELSE NULL
        END
      FROM (
        SELECT %I::text AS value
          FROM %I.%I
         WHERE %I::text LIKE ANY (ARRAY['%%&quot;%%', '%%&#39;%%', '%%&#x27;%%', '%%&#x60;%%'])
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
      column_record.column_name,
      pk_columns,
      column_record.data_type,
      column_record.column_name,
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

-- One-row gate. expected_columns=87 is evidence from the 2026-09-16 staging
-- diagnosis, not a value to force. Any drift is a STOP and must be explained.
SELECT
  count(*)::int AS observed_columns,
  87 AS expected_columns,
  sum(affected_rows)::bigint AS affected_row_column_pairs,
  sum(quot_occurrences + apos39_occurrences + aposx27_occurrences + backtick_occurrences)::bigint AS target_occurrences,
  count(*) FILTER (WHERE blocker IS NOT NULL)::int AS blocked_columns,
  count(*) FILTER (WHERE proposed_storage_mode = 'plain_text')::int AS plain_text_columns,
  count(*) FILTER (WHERE proposed_storage_mode = 'json_text')::int AS json_text_columns,
  count(*) FILTER (WHERE proposed_storage_mode = 'native_json')::int AS native_json_columns,
  CASE
    WHEN count(*) <> 87 THEN 'STOP: inventory drift from the measured 87 columns'
    WHEN count(*) FILTER (WHERE blocker IS NOT NULL) > 0 THEN 'STOP: resolve per-column blockers'
    ELSE 'INVENTORY_READY_FOR_CTO_REVIEW'
  END AS verdict
FROM feedback_1_0b_inventory;

ROLLBACK;
