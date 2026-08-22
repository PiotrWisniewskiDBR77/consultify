-- ECO-W02: tenant-scoped, optimistic and auditable digitization-analysis updates.

ALTER TABLE digitization_analyses
  ADD COLUMN IF NOT EXISTS command_version INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT digitization_analyses_command_version_positive CHECK (command_version >= 1);

CREATE TABLE IF NOT EXISTS finance_digitization_analysis_update_receipts (
  receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  analysis_id TEXT NOT NULL REFERENCES digitization_analyses(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL,
  request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  expected_version INTEGER NOT NULL CHECK (expected_version >= 1),
  resulting_version INTEGER NOT NULL CHECK (resulting_version > expected_version),
  response_json JSONB NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, analysis_id, idempotency_key)
);

CREATE OR REPLACE FUNCTION finance_digitization_analysis_update_receipt_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'digitization analysis update receipts are append-only'
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_digitization_analysis_update_receipt_immutable
  ON finance_digitization_analysis_update_receipts;
CREATE TRIGGER trg_finance_digitization_analysis_update_receipt_immutable
  BEFORE UPDATE OR DELETE ON finance_digitization_analysis_update_receipts
  FOR EACH ROW EXECUTE FUNCTION finance_digitization_analysis_update_receipt_immutable();
