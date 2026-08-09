-- Durable A02 bindings between bounded Wave8 executions and the canonical
-- transformation run. Application hooks reconcile from transformation_cases;
-- these columns preserve the ownership link across process restarts.
ALTER TABLE wave8_agent_runs ADD COLUMN IF NOT EXISTS canonical_run_id TEXT;

ALTER TABLE wave8_agent_schedules ADD COLUMN IF NOT EXISTS canonical_run_id TEXT;

ALTER TABLE ai_agent_plans ADD COLUMN IF NOT EXISTS canonical_run_id TEXT;

CREATE INDEX IF NOT EXISTS idx_wave8_agent_runs_canonical
  ON wave8_agent_runs (organization_id, canonical_run_id, created_at);

CREATE INDEX IF NOT EXISTS idx_wave8_agent_schedules_canonical
  ON wave8_agent_schedules (organization_id, canonical_run_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_agent_plans_canonical
  ON ai_agent_plans (organization_id, canonical_run_id, created_at);

CREATE INDEX IF NOT EXISTS idx_agent_run_alias_owner
  ON v8_agent_run_aliases (organization_id, canonical_run_id, alias_type);
