-- SET-MVP-EXPORT-001: immutable, tenant-bound receipt for the exact bytes
-- returned by a GDPR export download.
ALTER TABLE data_export_requests DROP CONSTRAINT IF EXISTS data_export_requests_status_check;
ALTER TABLE data_export_requests ADD CONSTRAINT data_export_requests_status_check
  CHECK (status IN ('pending', 'processing', 'ready', 'completed', 'failed', 'expired'));

CREATE TABLE IF NOT EXISTS user_data_export_receipts (
  request_id TEXT PRIMARY KEY REFERENCES data_export_requests(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artifact_json TEXT NOT NULL,
  artifact_sha256 TEXT NOT NULL CHECK (artifact_sha256 ~ '^[0-9a-f]{64}$'),
  artifact_bytes BIGINT NOT NULL CHECK (artifact_bytes > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_data_export_receipts_owner
  ON user_data_export_receipts (organization_id, user_id, created_at DESC);

CREATE OR REPLACE FUNCTION reject_user_data_export_receipt_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'user data export receipts are immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_user_data_export_receipts_immutable
  ON user_data_export_receipts;
CREATE TRIGGER trg_user_data_export_receipts_immutable
BEFORE UPDATE ON user_data_export_receipts
FOR EACH ROW EXECUTE FUNCTION reject_user_data_export_receipt_mutation();
