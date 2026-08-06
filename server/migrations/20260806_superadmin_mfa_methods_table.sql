-- Storage for the Super Admin MFA panel (`GET /api/superadmin/users/:id/mfa`).
--
-- WHY THIS EXISTS: `user_mfa_methods` is read by SuperAdminController and
-- rendered by src/views/superadmin/security/MFAView.tsx, but the only DDL for
-- it lives in `015_enterprise_customers_module.sql`, which is numbered < 500
-- and is therefore excluded from every run by `isSqliteOnlyMigration()`. It is
-- not in `PROMOTED_LEGACY_PRODUCERS` either. The table consequently exists in
-- no environment, so the panel's read fails and the operator sees an error
-- toast instead of a factor list.
--
-- THIS IS NOT A NEW MODEL. The column contract is copied verbatim from 015 so
-- that promoting 015 later, or reconciling the two models, stays a pure
-- rename/merge rather than a data migration:
--   * `is_enabled` / `is_primary` stay INTEGER, because the reading and
--     writing SQL compares them to 1. Changing them to BOOLEAN here would
--     silently break `WHERE ... AND is_primary = 1`.
--   * `backup_codes_json` keeps its TEXT/'[]' default.
--   * DATETIME columns become TIMESTAMPTZ, which is what the runner's own
--     shim would have produced from 015 anyway.
--
-- SCOPE: this creates storage only. No feature flag is touched and no
-- behaviour changes — Super Admin MFA remains exactly as gated as it was.
--
-- RELATIONSHIP TO `user_mfa`: a separate, self-service, single-row-per-user
-- TOTP model used by `/api/mfa/*` and the settings panel. The two are NOT
-- merged here; see CONSULTIFY_SUPERADMIN_MFA_REPORT.md for the full matrix
-- and the recommendation.

CREATE TABLE IF NOT EXISTS user_mfa_methods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method_type TEXT NOT NULL,
  secret TEXT,
  phone_number TEXT,
  backup_codes_json TEXT DEFAULT '[]',
  is_enabled INTEGER DEFAULT 0,
  is_primary INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Mirrors the two indexes 015 declares, and the exact lookup the controller
-- performs (`WHERE user_id = ? AND method_type = ? AND is_primary = 1`).
CREATE INDEX IF NOT EXISTS idx_user_mfa_user ON user_mfa_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_user_mfa_enabled ON user_mfa_methods(user_id, is_enabled);
CREATE INDEX IF NOT EXISTS idx_user_mfa_methods_primary_lookup
  ON user_mfa_methods(user_id, method_type, is_primary);

COMMENT ON TABLE user_mfa_methods IS
  'Super Admin MFA panel: per-user, per-method enrolment records. Distinct from user_mfa, which is the self-service single-factor model behind /api/mfa/*.';
