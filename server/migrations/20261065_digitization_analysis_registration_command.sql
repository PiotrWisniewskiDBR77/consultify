-- ECO-W01: idempotent, tenant-scoped registration for digitization analyses.

CREATE TABLE IF NOT EXISTS finance_digitization_analysis_registration_receipts (
  receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  analysis_id TEXT NOT NULL REFERENCES digitization_analyses(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL,
  request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  source_type TEXT,
  source_id TEXT,
  response_json JSONB NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, idempotency_key)
);

CREATE OR REPLACE FUNCTION finance_digitization_analysis_registration_receipt_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'digitization analysis registration receipts are append-only'
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_digitization_analysis_registration_receipt_immutable
  ON finance_digitization_analysis_registration_receipts;
CREATE TRIGGER trg_finance_digitization_analysis_registration_receipt_immutable
  BEFORE UPDATE OR DELETE ON finance_digitization_analysis_registration_receipts
  FOR EACH ROW EXECUTE FUNCTION finance_digitization_analysis_registration_receipt_immutable();

CREATE UNIQUE INDEX IF NOT EXISTS ux_finance_digitization_analysis_registration_source
  ON finance_digitization_analysis_registration_receipts
  (organization_id, source_type, source_id)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL;
