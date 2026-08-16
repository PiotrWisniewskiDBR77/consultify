ALTER TABLE initiatives
  ADD COLUMN IF NOT EXISTS profile_version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS initiative_profile_update_receipts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  initiative_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  resulting_version INTEGER NOT NULL,
  response_json JSONB NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, initiative_id, idempotency_key)
);

CREATE OR REPLACE FUNCTION prevent_initiative_profile_receipt_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'initiative_profile_update_receipts are immutable' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_initiative_profile_receipts_immutable
  ON initiative_profile_update_receipts;
CREATE TRIGGER trg_initiative_profile_receipts_immutable
  BEFORE UPDATE OR DELETE ON initiative_profile_update_receipts
  FOR EACH ROW EXECUTE FUNCTION prevent_initiative_profile_receipt_mutation();

CREATE INDEX IF NOT EXISTS idx_initiative_profile_receipts_lookup
  ON initiative_profile_update_receipts (organization_id, initiative_id, created_at DESC);
