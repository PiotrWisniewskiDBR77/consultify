-- =============================================================================
-- Migration: 792_admin_sessions_extended_columns.sql
-- Class: RED "migracja-braku" (rejestr _REJESTR_DOKONCZENIA.md linia 74)
-- Description: `admin_sessions` on parity has only the minimal initdb-stub
-- shape (id, admin_user_id, session_token, expires_at, created_at). The live
-- application code (server/src/services/adminSessionService.ts,
-- server/src/routes/superadmin.routes.ts) always tries the "extended" schema
-- first — user_id, is_active, mfa_verified, ip_address, user_agent,
-- session_type, requested_capability, justification, break_glass_reason,
-- approved_by, created_by — and only falls back to the minimal shape in a
-- catch block. Without these columns every call silently degrades to the
-- fallback (no MFA/JIT/break-glass tracking, no ip/user-agent, no active
-- filtering), which is exactly the "cicho pada" symptom in the rejestr entry.
-- Purely additive, idempotent.
-- =============================================================================

ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1;
ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS mfa_verified INTEGER DEFAULT 0;
ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS session_type TEXT DEFAULT 'standard';
ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS requested_capability TEXT;
ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS justification TEXT;
ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS break_glass_reason TEXT;
ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS created_by TEXT;

-- Backfill user_id from the legacy admin_user_id for existing rows so the
-- "extended" query path (which filters/joins on user_id) sees historical
-- sessions too, not just newly created ones.
UPDATE admin_sessions
SET user_id = admin_user_id
WHERE user_id IS NULL AND admin_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_sessions_user_id ON admin_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_is_active ON admin_sessions(is_active);
