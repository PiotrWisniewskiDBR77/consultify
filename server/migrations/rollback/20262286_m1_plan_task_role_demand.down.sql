-- D-114 rollback for 20262286_m1_plan_task_role_demand.sql.
-- Conservative DOWN: remove roleDemand only when it still equals the demand
-- computed by the UP migration from current task estimates. If a window was
-- edited after UP, leave it untouched rather than deleting user data.

WITH all_windows AS (
  SELECT
    s.organization_id,
    s.aggregate_id,
    s.payload_json,
    w.ordinality - 1 AS window_index,
    w.value AS window_json,
    w.value->>'initiativeId' AS initiative_id,
    COALESCE(w.value->>'earliest', w.value->>'target', w.value->>'latest') AS window_start,
    COALESCE(w.value->>'latest', w.value->>'target', w.value->>'earliest') AS window_end,
    w.value->'roleDemand' AS current_role_demand
  FROM ie_aggregate_state s
  CROSS JOIN LATERAL jsonb_array_elements(s.payload_json->'windows') WITH ORDINALITY AS w(value, ordinality)
  WHERE s.aggregate_type = 'plan_scenario'
), task_roles AS (
  SELECT
    aw.organization_id,
    aw.aggregate_id,
    aw.window_index,
    COALESCE(NULLIF(TRIM(u.job_title), ''), NULLIF(TRIM(u.title), ''), 'Bez stanowiska') AS role_label,
    SUM(COALESCE(t.estimated_hours, 0)) AS estimated_hours,
    GREATEST(
      1,
      ROUND(
        EXTRACT(EPOCH FROM (
          COALESCE(NULLIF(aw.window_end, '')::timestamp, NULLIF(aw.window_start, '')::timestamp, CURRENT_TIMESTAMP)
          - COALESCE(NULLIF(aw.window_start, '')::timestamp, NULLIF(aw.window_end, '')::timestamp, CURRENT_TIMESTAMP)
        )) / 604800.0
      )::int
    ) AS window_weeks
  FROM all_windows aw
  JOIN tasks t
    ON t.organization_id = aw.organization_id
   AND t.initiative_id = aw.initiative_id
  LEFT JOIN users u
    ON u.organization_id = t.organization_id
   AND u.id = t.assignee_id
  WHERE t.assignee_id IS NOT NULL
    AND t.estimated_hours IS NOT NULL
    AND t.due_date IS NOT NULL
    AND LOWER(COALESCE(t.status, '')) NOT IN ('done','completed','validated','cancelled')
  GROUP BY aw.organization_id, aw.aggregate_id, aw.window_index, role_label, aw.window_start, aw.window_end
), role_demand AS (
  SELECT
    organization_id,
    aggregate_id,
    window_index,
    jsonb_agg(
      jsonb_build_object(
        'roleId', COALESCE(NULLIF(regexp_replace(lower(translate(role_label, 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ', 'acelnoszzACELNOSZZ')), '[^a-z0-9]+', '-', 'g'), ''), 'bez-stanowiska'),
        'roleLabel', role_label,
        'fte', ROUND((estimated_hours / (40.0 * window_weeks))::numeric, 3)
      ) ORDER BY role_label
    ) AS demand_json
  FROM task_roles
  GROUP BY organization_id, aggregate_id, window_index
), patched_windows AS (
  SELECT
    aw.organization_id,
    aw.aggregate_id,
    jsonb_agg(
      CASE
        WHEN aw.current_role_demand = rd.demand_json
          THEN aw.window_json - 'roleDemand'
        ELSE aw.window_json
      END
      ORDER BY aw.window_index
    ) AS windows_json
  FROM all_windows aw
  LEFT JOIN role_demand rd
    ON rd.organization_id = aw.organization_id
   AND rd.aggregate_id = aw.aggregate_id
   AND rd.window_index = aw.window_index
  GROUP BY aw.organization_id, aw.aggregate_id
), updated AS (
  UPDATE ie_aggregate_state s
     SET payload_json = jsonb_set(s.payload_json, '{windows}', p.windows_json, false),
         updated_at = CURRENT_TIMESTAMP
    FROM patched_windows p
   WHERE s.organization_id = p.organization_id
     AND s.aggregate_type = 'plan_scenario'
     AND s.aggregate_id = p.aggregate_id
     AND s.payload_json->'windows' IS DISTINCT FROM p.windows_json
  RETURNING s.organization_id, s.aggregate_id
)
SELECT COUNT(*) AS plan_scenarios_role_demand_rolled_back FROM updated;
