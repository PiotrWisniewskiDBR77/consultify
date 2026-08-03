-- =============================================================================
-- Migration: 797_user_sessions_missing_columns.sql
-- Class: RED "migracja-braku" (rejestr _REJESTR_DOKONCZENIA.md linia 74)
-- Description: `user_sessions` on parity has the "device/expiry" shape only
-- (id, user_id, device_info, ip_address, user_agent, location, created_at,
-- last_active_at, expires_at, is_current, is_active, last_activity_at,
-- sso_session_id, sso_provider_config_id, token_jti). Several live call
-- sites need columns beyond that shape and 42703 today:
--   - server/src/services/securityService.ts (createSession/revokeSession):
--     organization_id, session_token_hash, refresh_token_hash, browser, os,
--     device_type, auth_method, geo_country, geo_city, revoked_at,
--     revoked_by, revoke_reason
--   - server/src/routes/integrations/sso.routes.ts: organization_id,
--     session_token_hash, auth_method, sso_provider
--   - server/src/routes/integrations/scim.routes.ts: revoked_at,
--     revoke_reason
--   - server/src/routes/superadmin.routes.ts (extended-schema soft-revoke
--     branch): terminated_at, termination_reason; the sessions-list query
--     also does `ORDER BY COALESCE(s.last_activity, s.last_active_at, ...)`
--     directly in SQL — `last_activity` (no `_at` suffix, distinct from the
--     existing `last_activity_at`) must exist or that ORDER BY itself 42703s.
-- Purely additive, idempotent.
-- =============================================================================

ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS session_token_hash TEXT;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS refresh_token_hash TEXT;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS browser TEXT;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS os TEXT;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS device_type TEXT;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS auth_method TEXT;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS sso_provider TEXT;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS geo_country TEXT;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS geo_city TEXT;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS revoked_by TEXT;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS revoke_reason TEXT;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS terminated_at TIMESTAMPTZ;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS termination_reason TEXT;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ;

-- Strict-schema repair (2026-08): this migration's own header documents the
-- assumed "parity" shape as already having `last_activity_at` (distinct from
-- `last_activity` added above) — true on demo/staging where
-- 20260719_baseline_gap.sql had already run, but not guaranteed on a
-- genuinely fresh DB driven by the strict path alone (that column is only
-- added by the same giant, later-running baseline_gap file). Guard it here
-- too so the UPDATE below never 42703s regardless of run order.
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

UPDATE user_sessions
SET last_activity = COALESCE(last_activity, last_activity_at, last_active_at, created_at)
WHERE last_activity IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_sessions_organization_id ON user_sessions(organization_id);
