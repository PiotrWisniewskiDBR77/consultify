-- =====================================================================
-- QA-2026-06-08 — Schema-drift catch-up (Postgres, idempotent)
-- =====================================================================
-- Context: QA run 2026-06-08 found that staging AND production Postgres
-- are missing columns/tables that the code expects, causing live
-- `[DB:Promise] ... does not exist` errors. The canonical migrations for
-- ALL of these ALREADY EXIST in server/migrations (referenced below) — the
-- environments simply never applied them.
--
-- PREFERRED FIX: run the normal migration runner on staging, verify, then
-- (after a DB backup) on production. This file is a SAFE, idempotent
-- catch-up for just the observed gaps, to run manually if a full migration
-- pass is not feasible immediately.
--
-- DO NOT run on production without a backup first.
-- Run order: STAGING -> verify logs clean -> backup PROD -> PROD.
-- =====================================================================

BEGIN;

-- ---- Column adds (low risk) -----------------------------------------

-- staging: SELECT user_status FROM users  (canonical: 021_trial_entry_status.sql)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS user_status TEXT DEFAULT 'ACTIVE';

-- staging: SELECT ... is_on_target FROM initiative_kpis  (canonical: initiative_kpis CREATEs)
ALTER TABLE initiative_kpis
  ADD COLUMN IF NOT EXISTS is_on_target INTEGER DEFAULT 0;

-- prod: SELECT internet_enabled FROM ai_policies  (canonical: 298_fix_missing_columns.sql)
-- NOTE: migration 298 used DEFAULT 0, but aiPolicyEngine treats a missing/NULL value as
-- "enabled". DEFAULT 1 here preserves current effective behaviour (no silent internet
-- cut-off for existing orgs). Adjust to 0 if internet-off-by-default is intended.
ALTER TABLE ai_policies
  ADD COLUMN IF NOT EXISTS internet_enabled INTEGER DEFAULT 1;

-- prod: INSERT INTO ai_usage_logs (... error_message ...)  (canonical: 208_ai_usage_logs.sql)
ALTER TABLE ai_usage_logs
  ADD COLUMN IF NOT EXISTS error_message TEXT;

COMMIT;

-- ---- Missing tables -------------------------------------------------
-- These need their full canonical definitions. Rather than re-deriving the
-- schema here (risk of drift vs. code's SELECT *), apply the existing
-- migrations directly on the target DB:
--
--   prod:    server/migrations/285_user_style_profiles.sql   (ai_user_style_profiles)
--   staging: server/migrations/032_sso_configuration.sql.sql (sso_configurations)
--
-- Both use CREATE TABLE IF NOT EXISTS and are safe to re-run. Verify their
-- syntax is Postgres-compatible before applying (some legacy migrations were
-- authored for SQLite); port TEXT/INTEGER/BOOLEAN and AUTOINCREMENT as needed.

-- ---- Post-apply verification ---------------------------------------
-- Expect zero rows / no error from each:
--   SELECT user_status FROM users LIMIT 1;
--   SELECT is_on_target FROM initiative_kpis LIMIT 1;
--   SELECT internet_enabled FROM ai_policies LIMIT 1;
--   SELECT error_message FROM ai_usage_logs LIMIT 1;
--   SELECT 1 FROM ai_user_style_profiles LIMIT 1;
--   SELECT 1 FROM sso_configurations LIMIT 1;
-- Then watch `railway logs` for "does not exist" — should disappear.
