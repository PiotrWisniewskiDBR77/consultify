-- EXE-MVP-ACTIONS-001 wave 2: durable, replayable governed budget deletion.

ALTER TABLE budget_entries
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'budget_entries_version_positive'
       AND conrelid = 'budget_entries'::regclass
  ) THEN
    ALTER TABLE budget_entries
      ADD CONSTRAINT budget_entries_version_positive CHECK (version > 0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS execution_budget_delete_receipts (
  receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  action_id TEXT NOT NULL REFERENCES execution_action_registry(action_id),
  entry_id TEXT NOT NULL,
  -- Caller claim, deliberately not an FK: NOT_FOUND receipts must remain
  -- persistable for nonexistent or cross-tenant opaque identifiers.
  initiative_id TEXT NOT NULL,
  expected_version INTEGER NOT NULL CHECK (expected_version > 0),
  idempotency_key TEXT NOT NULL,
  request_digest TEXT NOT NULL CHECK (request_digest ~ '^[0-9a-f]{64}$'),
  actor_id TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('SUCCEEDED','DENIED','NOT_FOUND','CONFLICT')),
  reason_code TEXT,
  result_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, action_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_execution_budget_delete_receipts_target
  ON execution_budget_delete_receipts (organization_id, entry_id, created_at DESC);

CREATE OR REPLACE FUNCTION execution_budget_delete_receipts_deny_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'execution_budget_delete_receipts is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_execution_budget_delete_receipts_immutable
  ON execution_budget_delete_receipts;
CREATE TRIGGER trg_execution_budget_delete_receipts_immutable
BEFORE UPDATE OR DELETE ON execution_budget_delete_receipts
FOR EACH ROW EXECUTE FUNCTION execution_budget_delete_receipts_deny_mutation();
