-- DEC-AGT-AUTONOMY-001: durable dispatch identity and attempt ledger.
CREATE TABLE IF NOT EXISTS ai_agent_job_receipts (
  receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  dispatch_key TEXT NOT NULL,
  bull_job_id TEXT NOT NULL UNIQUE,
  payload_digest TEXT NOT NULL CHECK (payload_digest ~ '^[0-9a-f]{64}$'),
  status TEXT NOT NULL CHECK (status IN ('PENDING','ENQUEUED','RUNNING','SUCCEEDED','FAILED')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  lease_owner TEXT,
  lease_expires_at TIMESTAMPTZ,
  last_error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE (organization_id, dispatch_key)
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_job_receipts_recovery
  ON ai_agent_job_receipts(status, lease_expires_at, created_at);

CREATE TABLE IF NOT EXISTS ai_agent_job_attempts (
  attempt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES ai_agent_job_receipts(receipt_id),
  attempt_no INTEGER NOT NULL CHECK (attempt_no > 0),
  event_type TEXT NOT NULL CHECK (event_type IN ('CLAIMED','SUCCEEDED','FAILED','REDRIVEN')),
  worker_id TEXT NOT NULL,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(receipt_id, attempt_no, event_type)
);

CREATE OR REPLACE FUNCTION ai_agent_job_attempts_append_only_guard() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'ai_agent_job_attempts is append-only'; END $$;
DROP TRIGGER IF EXISTS trg_ai_agent_job_attempts_append_only ON ai_agent_job_attempts;
CREATE TRIGGER trg_ai_agent_job_attempts_append_only BEFORE UPDATE OR DELETE ON ai_agent_job_attempts
FOR EACH ROW EXECUTE FUNCTION ai_agent_job_attempts_append_only_guard();
