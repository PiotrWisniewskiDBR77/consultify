-- MW-11: durable execution lease and fencing.
-- Additive and replay-safe for existing plans. A legacy `executing` row with
-- no lease is intentionally reclaimable by the first post-migration worker.
ALTER TABLE ai_agent_plans
  ADD COLUMN IF NOT EXISTS execution_owner_token TEXT;

ALTER TABLE ai_agent_plans
  ADD COLUMN IF NOT EXISTS execution_fencing_token BIGINT NOT NULL DEFAULT 0;

ALTER TABLE ai_agent_plans
  ADD COLUMN IF NOT EXISTS execution_lease_expires_at TIMESTAMP;

ALTER TABLE ai_agent_plans
  ADD COLUMN IF NOT EXISTS execution_heartbeat_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_ai_agent_plans_execution_lease
  ON ai_agent_plans(status, execution_lease_expires_at)
  WHERE status = 'executing';
