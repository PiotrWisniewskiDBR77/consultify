-- Forward-only Wave8 Agent schedule/runtime hardening.
-- The original 20260425 migration is immutable because deployed databases may
-- already have recorded its checksum.

ALTER TABLE wave8_agent_schedules ADD COLUMN IF NOT EXISTS goal TEXT NOT NULL DEFAULT '';
ALTER TABLE wave8_agent_schedules ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE wave8_agent_schedules ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE wave8_agent_schedules ADD COLUMN IF NOT EXISTS lease_owner TEXT;
ALTER TABLE wave8_agent_schedules ADD COLUMN IF NOT EXISTS lease_expires_at TEXT;
ALTER TABLE wave8_agent_schedules ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE wave8_agent_schedules ADD COLUMN IF NOT EXISTS mandate_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE wave8_agent_schedules ADD COLUMN IF NOT EXISTS mandate_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE wave8_agent_schedules ADD COLUMN IF NOT EXISTS timeout_seconds INTEGER NOT NULL DEFAULT 900;
ALTER TABLE wave8_agent_schedules ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3;
ALTER TABLE wave8_agent_schedules ADD COLUMN IF NOT EXISTS retry_at TEXT;
ALTER TABLE wave8_agent_schedules ADD COLUMN IF NOT EXISTS blocked_reason TEXT;
ALTER TABLE wave8_agent_schedules ADD COLUMN IF NOT EXISTS last_run_at TEXT;
ALTER TABLE wave8_agent_schedules ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE wave8_agent_schedules ADD COLUMN IF NOT EXISTS cancelled_at TEXT;
ALTER TABLE wave8_agent_schedules ADD COLUMN IF NOT EXISTS cancelled_by TEXT;

ALTER TABLE wave8_agent_schedules
  ALTER COLUMN scheduler_mode SET DEFAULT 'durable_cron_worker';

CREATE TABLE IF NOT EXISTS wave8_agent_tool_governance_events (
  event_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  tool_id TEXT,
  tool_name TEXT NOT NULL,
  project_id TEXT,
  run_id TEXT,
  decision TEXT NOT NULL,
  reason TEXT NOT NULL,
  policy_ref TEXT,
  input_digest TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT wave8_agent_tool_governance_events_decision_check
    CHECK (decision IN ('allowed', 'denied'))
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'wave8_agent_tool_governance_events'::regclass
       AND conname = 'wave8_agent_tool_governance_events_decision_check'
  ) THEN
    ALTER TABLE wave8_agent_tool_governance_events
      ADD CONSTRAINT wave8_agent_tool_governance_events_decision_check
      CHECK (decision IN ('allowed', 'denied'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_wave8_tool_governance_run
  ON wave8_agent_tool_governance_events(organization_id, run_id, tool_name, created_at);

CREATE INDEX IF NOT EXISTS idx_wave8_agent_schedules_due
  ON wave8_agent_schedules(status, retry_at, next_run_at, lease_expires_at);
