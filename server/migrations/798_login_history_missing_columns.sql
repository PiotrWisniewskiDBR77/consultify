-- =============================================================================
-- Migration: 798_login_history_missing_columns.sql
-- Class: RED "migracja-braku" (rejestr _REJESTR_DOKONCZENIA.md linia 74)
-- Description: server/src/services/behaviorIntelligenceService.ts and
-- server/src/services/transactionReadinessService.ts read `login_at`
-- (instead of `created_at`) and `success` (a boolean, instead of the text
-- `status` column) from `login_history`; neither exists on parity, so those
-- queries 42703 today. server/src/routes/superadmin.routes.ts (failed-logins
-- widget) also selects `lh.email` directly off `login_history` with no join
-- to `users`. Purely additive, idempotent; login_at/success backfilled from
-- the existing created_at/status so historical rows remain visible to the
-- new columns too. `email` is intentionally left NULL for existing rows
-- (denormalized cache column — backfilling it correctly requires a join to
-- `users`, which is a runtime/read-code concern, out of this migration's
-- scope).
-- =============================================================================

ALTER TABLE login_history ADD COLUMN IF NOT EXISTS login_at TIMESTAMPTZ;
ALTER TABLE login_history ADD COLUMN IF NOT EXISTS success BOOLEAN;
ALTER TABLE login_history ADD COLUMN IF NOT EXISTS email TEXT;

UPDATE login_history
SET login_at = COALESCE(login_at, created_at),
    success = COALESCE(success, (status = 'success'))
WHERE login_at IS NULL OR success IS NULL;

CREATE INDEX IF NOT EXISTS idx_login_history_login_at ON login_history(login_at);
