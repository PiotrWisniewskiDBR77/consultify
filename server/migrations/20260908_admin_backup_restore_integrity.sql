-- ADM-MVP-BACKUP-001: encrypted backup integrity and append-only access audit.
ALTER TABLE backup_manifests
  ADD COLUMN IF NOT EXISTS checksum_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS encrypted BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS backup_access_audit (
  id TEXT PRIMARY KEY,
  backup_id TEXT,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  outcome TEXT NOT NULL,
  target_database TEXT,
  organization_id TEXT,
  details_json TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_access_audit_backup_created
  ON backup_access_audit (backup_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_access_audit_actor_created
  ON backup_access_audit (actor_id, created_at DESC);

CREATE OR REPLACE FUNCTION prevent_backup_access_audit_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'backup_access_audit is append-only';
END;
$$;

DROP TRIGGER IF EXISTS backup_access_audit_no_update ON backup_access_audit;
CREATE TRIGGER backup_access_audit_no_update
BEFORE UPDATE OR DELETE ON backup_access_audit
FOR EACH ROW EXECUTE FUNCTION prevent_backup_access_audit_mutation();
