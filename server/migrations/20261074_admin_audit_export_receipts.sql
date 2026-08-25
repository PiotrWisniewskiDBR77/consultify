-- Admin komplet 55, Fala 4 — audit-log export receipts.
-- Additive and idempotent; modeled after artifact_export_receipts.
CREATE TABLE IF NOT EXISTS admin_audit_export_receipts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  export_kind TEXT NOT NULL,
  filters_json TEXT,
  row_count INTEGER,
  output_format TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_export_receipts_org ON admin_audit_export_receipts (organization_id, created_at);
