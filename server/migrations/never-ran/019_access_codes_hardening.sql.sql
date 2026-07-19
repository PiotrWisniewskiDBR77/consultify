-- 019_access_codes_hardening.sql
-- Security hardening for Access Codes Engine
-- - Store hash instead of plaintext code for DB leak protection
-- - Add indexes for performant lookups and status+expiry filtering
-- - Add timestamps for audit trail

-- Hash column (will store SHA-256 of code)
ALTER TABLE access_codes ADD COLUMN code_hash TEXT;

-- Audit timestamps
ALTER TABLE access_codes ADD COLUMN used_at DATETIME;
ALTER TABLE access_codes ADD COLUMN revoked_at DATETIME;

-- Target email for restricted codes (e.g., consultant invites)
ALTER TABLE access_codes ADD COLUMN target_email TEXT;

-- Unique index on hash for O(1) lookup and constraint enforcement
CREATE UNIQUE INDEX IF NOT EXISTS uniq_access_codes_hash ON access_codes(code_hash);

-- Compound index for status+expiry filtering (used in batch cleanup jobs)
CREATE INDEX IF NOT EXISTS idx_access_codes_status_exp ON access_codes(status, expires_at);

-- Backfill hash for existing codes (one-time data migration)
-- This should be run manually or via a migration script since we need plaintext
-- For safety, existing codes without hash will need to be regenerated or manually hashed
-- UPDATE access_codes SET code_hash = ... WHERE code_hash IS NULL;
