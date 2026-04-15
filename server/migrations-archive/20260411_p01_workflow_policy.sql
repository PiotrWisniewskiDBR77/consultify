-- P01 Integration: Per-workflow policy gates
-- Adds workflow-level pause/block with reason and policy type

ALTER TABLE integrations
  ADD COLUMN IF NOT EXISTS workflow_policy TEXT NOT NULL DEFAULT 'active'
    CHECK (workflow_policy IN ('active', 'paused', 'blocked', 'safety_gate'));

ALTER TABLE integrations
  ADD COLUMN IF NOT EXISTS workflow_policy_reason TEXT;

ALTER TABLE integrations
  ADD COLUMN IF NOT EXISTS workflow_policy_set_by TEXT;

ALTER TABLE integrations
  ADD COLUMN IF NOT EXISTS workflow_policy_set_at TIMESTAMPTZ;
