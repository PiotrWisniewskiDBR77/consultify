BEGIN;

ALTER TABLE finance_prediction_scenarios
  ADD COLUMN IF NOT EXISTS authoring_revision BIGINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_by TEXT;

ALTER TABLE finance_prediction_driver_overrides
  ADD COLUMN IF NOT EXISTS canonical_line_id TEXT REFERENCES financial_statement_lines(id);

CREATE TABLE IF NOT EXISTS finance_prediction_authoring_receipts (
  receipt_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  business_version_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  result_revision BIGINT NOT NULL,
  result_snapshot JSONB NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_finance_prediction_authoring_receipt_version
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),
  CONSTRAINT uq_finance_prediction_authoring_receipt_key
    UNIQUE (organization_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_finance_prediction_authoring_receipt_version
  ON finance_prediction_authoring_receipts (organization_id, business_version_id, created_at DESC);

CREATE OR REPLACE FUNCTION finance_prediction_authoring_receipt_immutable() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'finance_prediction_authoring_receipts are append-only'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_finance_prediction_authoring_receipt_immutable
  BEFORE UPDATE OR DELETE ON finance_prediction_authoring_receipts
  FOR EACH ROW EXECUTE FUNCTION finance_prediction_authoring_receipt_immutable();

COMMIT;
