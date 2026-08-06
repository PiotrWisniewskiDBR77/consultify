-- Two-factor authentication storage for the user-facing MFA routes.
--
-- WHY THIS DID NOT EXIST: server/src/routes/mfa.routes.ts and
-- server/src/routes/settings.routes.ts read and write `user_mfa` in 13 places,
-- but no migration in the corpus ever created it. The only MFA DDL is
-- 015_enterprise_customers_module.sql, which creates a differently shaped
-- `user_mfa_methods`, and that file is numbered < 500 so
-- `isSqliteOnlyMigration()` excludes it from every run. The result was that
-- neither table existed in the canonical schema or on demo, and — because
-- `DbPromise.run()` resolves instead of throwing by default — enrolment still
-- answered 200. Users were told two-factor authentication was enabled while
-- nothing was stored.
--
-- SCOPE: this creates the table the user-facing routes actually use. The
-- separate `user_mfa_methods` model referenced by SuperAdminController is a
-- different, multi-method shape and is deliberately NOT unified here; it is
-- also still written with SQLite string literals (method_type = "totp"), which
-- Postgres parses as an identifier, so it needs its own repair.
--
-- Column set derived from the live queries, not invented:
--   INSERT  user_id, secret, enabled, method, created_at
--   UPDATE  enabled, secret, backup_codes, backup_codes_count,
--           last_verified_at, updated_at
--   SELECT  secret, enabled, backup_codes, backup_codes_count
--
-- `user_id` is the primary key: every query is `WHERE user_id = ?` and the
-- enrolment flow assumes at most one row per user.

CREATE TABLE IF NOT EXISTS user_mfa (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  secret TEXT,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  method TEXT NOT NULL DEFAULT 'totp',
  backup_codes TEXT,
  backup_codes_count INTEGER NOT NULL DEFAULT 0,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_mfa_enabled ON user_mfa(enabled);

COMMENT ON TABLE user_mfa IS
  'Per-user TOTP enrolment for /api/mfa/* and the settings MFA panel. One row per user.';
COMMENT ON COLUMN user_mfa.backup_codes IS
  'JSON array of hashed single-use recovery codes; never stored in plaintext.';
