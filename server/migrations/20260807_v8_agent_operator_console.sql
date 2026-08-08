CREATE TABLE IF NOT EXISTS v8_agent_operator_recovery_events (
  recovery_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  execution_run_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('branch_task', 'work_graph', 'execution_run')),
  target_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('retry_failed_branch', 'recover_expired_lease', 'cancel_graph', 'expire_stale_review')),
  actor_user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  before_json TEXT NOT NULL,
  after_json TEXT NOT NULL,
  idempotency_key TEXT,
  input_digest TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE v8_agent_operator_recovery_events ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE v8_agent_operator_recovery_events ADD COLUMN IF NOT EXISTS input_digest TEXT;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'v8_agent_operator_recovery_events'::regclass AND conname = 'v8_agent_operator_recovery_events_target_type_check') THEN
    ALTER TABLE v8_agent_operator_recovery_events ADD CONSTRAINT v8_agent_operator_recovery_events_target_type_check
      CHECK (target_type IN ('branch_task', 'work_graph', 'execution_run'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'v8_agent_operator_recovery_events'::regclass AND conname = 'v8_agent_operator_recovery_events_action_check') THEN
    ALTER TABLE v8_agent_operator_recovery_events ADD CONSTRAINT v8_agent_operator_recovery_events_action_check
      CHECK (action IN ('retry_failed_branch', 'recover_expired_lease', 'cancel_graph', 'expire_stale_review'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_operator_recovery_idempotency
  ON v8_agent_operator_recovery_events(organization_id, execution_run_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_operator_recovery_run
  ON v8_agent_operator_recovery_events(organization_id, execution_run_id, created_at);

CREATE TABLE IF NOT EXISTS v8_agent_canonical_projection_outbox (
  outbox_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  execution_run_id TEXT NOT NULL,
  alias_type TEXT NOT NULL CHECK (alias_type IN ('work_graph')),
  external_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','claimed','applied','failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  claim_owner TEXT,
  claimed_at TEXT,
  applied_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, execution_run_id, alias_type, external_id, reason)
);

CREATE INDEX IF NOT EXISTS idx_agent_projection_outbox_pending
  ON v8_agent_canonical_projection_outbox(status, created_at);
