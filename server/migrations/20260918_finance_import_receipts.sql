-- FIN-MVP-IMPORT-001: immutable, tenant-scoped import idempotency receipt.
CREATE TABLE IF NOT EXISTS finance_import_receipts (
  receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  artifact_id TEXT NOT NULL REFERENCES finance_artifacts(artifact_id),
  business_version_id TEXT NOT NULL REFERENCES finance_business_versions(business_version_id),
  working_revision_id TEXT NOT NULL REFERENCES finance_working_revisions(working_revision_id),
  batch_idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  result_payload JSONB NOT NULL,
  applied_by TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, artifact_id, batch_idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_finance_import_receipts_org_time
  ON finance_import_receipts(organization_id, applied_at DESC);

CREATE OR REPLACE FUNCTION protect_finance_import_receipt()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'finance_import_receipts are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_import_receipts_immutable ON finance_import_receipts;
CREATE TRIGGER trg_finance_import_receipts_immutable
  BEFORE UPDATE OR DELETE ON finance_import_receipts
  FOR EACH ROW EXECUTE FUNCTION protect_finance_import_receipt();
