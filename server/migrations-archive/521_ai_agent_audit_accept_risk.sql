-- Agent Audit Layer: explicit risk acceptance (audit trail)

ALTER TABLE ai_agent_audit_runs ADD COLUMN IF NOT EXISTS accepted_at DATETIME;
ALTER TABLE ai_agent_audit_runs ADD COLUMN IF NOT EXISTS accepted_by_user_id TEXT;
ALTER TABLE ai_agent_audit_runs ADD COLUMN IF NOT EXISTS accepted_note TEXT;

CREATE INDEX IF NOT EXISTS idx_agent_audit_runs_accepted
  ON ai_agent_audit_runs (organization_id, accepted_at);

