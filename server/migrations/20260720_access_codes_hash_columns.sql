-- 20260720_access_codes_hash_columns.sql
-- Schema-drift fix (Fala 4): accessCodeService.ts (the /api/access-codes/generate
-- backend behind the Admin "generate access code" UI) was written against the
-- hardened hash-based access_codes model defined in the never-executed
-- 018_access_codes_engine.sql.sql / 019_access_codes_hardening.sql.sql
-- migrations (`.sql.sql` files are skipped by every runner). The live table only
-- has the legacy simple model (role / current_uses / is_active), so every
-- generateCode() INSERT failed with "column code_hash does not exist".
--
-- This migration is ADDITIVE and IDEMPOTENT: it adds the hash-model columns as
-- nullable so accessCodeService works, WITHOUT touching the legacy columns that
-- SuperAdminController / adminP32 / access-control.routes still rely on. The two
-- code families coexist (see _REDESIGN_SCHEMA_DRIFT_FALA4.md for the deeper
-- reconciliation left as a decision).
--
-- Runner: matches /^\d{8}_.*\.sql$/ in DatabaseInitializer.runTablePlatformMigrations,
-- tracked idempotently in tp_migration_history, runs in its own transaction.

ALTER TABLE access_codes ADD COLUMN IF NOT EXISTS code_hash TEXT;
ALTER TABLE access_codes ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE access_codes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';
ALTER TABLE access_codes ADD COLUMN IF NOT EXISTS uses_count INTEGER DEFAULT 0;
ALTER TABLE access_codes ADD COLUMN IF NOT EXISTS target_email TEXT;
ALTER TABLE access_codes ADD COLUMN IF NOT EXISTS metadata_json TEXT;
ALTER TABLE access_codes ADD COLUMN IF NOT EXISTS created_by_user_id TEXT;
ALTER TABLE access_codes ADD COLUMN IF NOT EXISTS created_by_consultant_id TEXT;
ALTER TABLE access_codes ADD COLUMN IF NOT EXISTS used_at TIMESTAMP;
ALTER TABLE access_codes ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP;
ALTER TABLE access_codes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Hash-model codes track creator via created_by_user_id / created_by_consultant_id.
-- Consultant-created codes have no user id, so the legacy NOT-NULL created_by
-- (FK -> users) cannot be satisfied. Relax it; legacy callers still populate it.
ALTER TABLE access_codes ALTER COLUMN created_by DROP NOT NULL;

-- Hash lookups (validatePublic/get) are O(1) on this partial unique index.
-- Partial (WHERE code_hash IS NOT NULL) so legacy rows with NULL hash coexist.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_access_codes_hash
  ON access_codes(code_hash) WHERE code_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_access_codes_status_exp
  ON access_codes(status, expires_at);
