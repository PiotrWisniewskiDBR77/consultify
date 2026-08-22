-- FIN-MVP-CUTOVER-001 / ECO-W42: canonical, versioned organization Finance
-- settings with durable idempotency and an atomic legacy read projection.
CREATE TABLE IF NOT EXISTS finance_settings_states (
  organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  settings_json JSONB NOT NULL,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_settings_command_receipts (
  receipt_id UUID PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  parent_version INTEGER NOT NULL CHECK (parent_version >= 0),
  resulting_version INTEGER NOT NULL CHECK (resulting_version >= 1),
  response_json JSONB NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_finance_settings_receipts_org_created
  ON finance_settings_command_receipts (organization_id, created_at DESC);

CREATE OR REPLACE FUNCTION reject_finance_settings_receipt_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'finance settings command receipts are append-only'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_settings_command_receipts_append_only
  ON finance_settings_command_receipts;
CREATE TRIGGER trg_finance_settings_command_receipts_append_only
BEFORE UPDATE OR DELETE ON finance_settings_command_receipts
FOR EACH ROW EXECUTE FUNCTION reject_finance_settings_receipt_mutation();
