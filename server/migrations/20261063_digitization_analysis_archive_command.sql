-- ECO-W12: replace destructive digitization-analysis deletion with a
-- tenant-scoped, versioned, auditable archive command.

ALTER TABLE digitization_analyses
  ADD COLUMN IF NOT EXISTS archive_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by TEXT,
  ADD CONSTRAINT digitization_analyses_archive_version_positive CHECK (archive_version >= 1);

CREATE TABLE IF NOT EXISTS finance_digitization_analysis_archive_receipts (
  receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  analysis_id TEXT NOT NULL REFERENCES digitization_analyses(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL,
  request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  expected_version INTEGER NOT NULL CHECK (expected_version >= 1),
  archived_version INTEGER NOT NULL CHECK (archived_version > expected_version),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 500),
  response_json JSONB NOT NULL,
  archived_by TEXT NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, analysis_id, idempotency_key)
);

CREATE OR REPLACE FUNCTION finance_digitization_analysis_archive_receipt_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'digitization analysis archive receipts are append-only'
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_digitization_analysis_archive_receipt_immutable
  ON finance_digitization_analysis_archive_receipts;
CREATE TRIGGER trg_finance_digitization_analysis_archive_receipt_immutable
  BEFORE UPDATE OR DELETE ON finance_digitization_analysis_archive_receipts
  FOR EACH ROW EXECUTE FUNCTION finance_digitization_analysis_archive_receipt_immutable();

CREATE INDEX IF NOT EXISTS idx_digitization_analyses_active_org
  ON digitization_analyses (organization_id, updated_at DESC)
  WHERE archived_at IS NULL;
