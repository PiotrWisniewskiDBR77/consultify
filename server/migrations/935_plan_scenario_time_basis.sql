BEGIN;

ALTER TABLE ie_aggregate_state
  DROP CONSTRAINT IF EXISTS ie_plan_scenario_time_basis_required;
ALTER TABLE ie_aggregate_state
  ADD CONSTRAINT ie_plan_scenario_time_basis_required CHECK (
    aggregate_type NOT IN ('plan_scenario','plan_scenario_version') OR (
      NULLIF(BTRIM(payload_json->>'windowUnit'),'') IS NOT NULL AND
      NULLIF(BTRIM(payload_json->>'timezone'),'') IS NOT NULL AND
      jsonb_typeof(payload_json->'periods') = 'array' AND
      jsonb_array_length(payload_json->'periods') > 0
    )
  ) NOT VALID;

COMMIT;
