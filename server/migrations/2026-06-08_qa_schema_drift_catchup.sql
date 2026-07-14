-- =====================================================================
-- QA-2026-06-08 — Schema-drift catch-up (Postgres, idempotent, universal)
-- =====================================================================
-- STATUS: APPLIED + VERIFIED on STAGING (2026-06-09 ~02:55Z) and on
-- PRODUCTION (2026-06-09 ~03:33Z) via pg client. All statements succeeded;
-- columns/tables verified in information_schema; prod /api/health 200 after.
--
-- Why universal: the two envs had DIFFERENT gaps —
--   staging: ai_policies / ai_user_style_profiles / sso_configurations MISSING
--            (created from scratch); is_on_target/user_status columns missing.
--   prod:    ai_policies / sso_configurations EXIST but ai_policies was missing
--            its 7 policy columns; ai_user_style_profiles missing; user_status
--            + ai_usage_logs.error_message missing; is_on_target already present.
-- So this script does BOTH `CREATE TABLE IF NOT EXISTS` (fresh DB) AND
-- `ALTER ... ADD COLUMN IF NOT EXISTS` (existing table) — safe either way.
--
-- Root cause of the silent drift: the "Table Platform migrations" runner
-- reports migrations as applied without the objects existing (boot log:
-- "245 already up to date") because SQLite-isms like
-- `created_at TEXT DEFAULT CURRENT_TIMESTAMP` FAIL on Postgres and the failure
-- is swallowed. Corrected here to `DEFAULT (now()::text)`.
--
-- ALL CHANGES ARE ADDITIVE / REVERSIBLE — no DROP, no data mutation.
-- =====================================================================

BEGIN;

-- ---- Column adds --------------------------------------------------------
ALTER TABLE users           ADD COLUMN IF NOT EXISTS user_status   TEXT DEFAULT 'ACTIVE';
-- FRESH-DB GUARD (2026-07-14): on a fresh replay this file sorts BEFORE
-- 565_kpi_time_series_roi_attribution_finance.sql, which creates
-- initiative_kpis. Skip the column add when the table does not exist yet;
-- 565 re-adds `is_on_target` idempotently, so the final schema is identical.
-- On DBs where the table already existed (staging/prod) behaviour is unchanged.
DO $$ BEGIN
  IF to_regclass('public.initiative_kpis') IS NOT NULL THEN
    ALTER TABLE initiative_kpis ADD COLUMN IF NOT EXISTS is_on_target INTEGER DEFAULT 0;
  END IF;
END $$;
ALTER TABLE ai_usage_logs   ADD COLUMN IF NOT EXISTS error_message TEXT;

-- ---- ai_policies: create if absent, then ensure all expected columns ----
CREATE TABLE IF NOT EXISTS ai_policies (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  name TEXT,                         -- NULLABLE: aiPolicyEngine INSERT omits name
  policy_type TEXT,
  config TEXT DEFAULT '{}',
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
ALTER TABLE ai_policies ADD COLUMN IF NOT EXISTS internet_enabled        INTEGER DEFAULT 1;
ALTER TABLE ai_policies ADD COLUMN IF NOT EXISTS policy_level            TEXT DEFAULT 'ADVISORY';
ALTER TABLE ai_policies ADD COLUMN IF NOT EXISTS audit_required          INTEGER DEFAULT 1;
ALTER TABLE ai_policies ADD COLUMN IF NOT EXISTS active_roles            TEXT DEFAULT '["ADVISOR","PMO_MANAGER","EXECUTOR","EDUCATOR"]';
ALTER TABLE ai_policies ADD COLUMN IF NOT EXISTS max_policy_level        TEXT DEFAULT 'ASSISTED';
ALTER TABLE ai_policies ADD COLUMN IF NOT EXISTS default_ai_role         TEXT DEFAULT 'ADVISOR';
ALTER TABLE ai_policies ADD COLUMN IF NOT EXISTS proactive_notifications INTEGER DEFAULT 1;
-- existing prod table had name NOT NULL but the engine inserts without it:
ALTER TABLE ai_policies ALTER COLUMN name DROP NOT NULL;

-- ---- ai_user_style_profiles --------------------------------------------
CREATE TABLE IF NOT EXISTS ai_user_style_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  organization_id TEXT,
  preferred_depth TEXT DEFAULT 'balanced',
  preferred_format TEXT DEFAULT 'structured',
  technical_level TEXT DEFAULT 'intermediate',
  response_length TEXT DEFAULT 'medium',
  detected_expertise_areas TEXT DEFAULT '[]',
  common_question_types TEXT DEFAULT '[]',
  peak_activity_hours TEXT DEFAULT '[]',
  preferred_focus_modes TEXT DEFAULT '[]',
  context_preferences TEXT DEFAULT '{}',
  total_interactions INTEGER DEFAULT 0,
  positive_feedback_count INTEGER DEFAULT 0,
  negative_feedback_count INTEGER DEFAULT 0,
  last_profile_update TEXT,
  confidence_score REAL DEFAULT 0.5,
  auto_adapt_enabled INTEGER DEFAULT 1,
  manual_overrides TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (now()::text),   -- was SQLite-ism: TEXT DEFAULT CURRENT_TIMESTAMP
  updated_at TEXT DEFAULT (now()::text),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);

-- ---- sso_configurations -------------------------------------------------
CREATE TABLE IF NOT EXISTS sso_configurations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL UNIQUE,
  provider_type TEXT NOT NULL CHECK(provider_type IN ('saml','oidc','google','microsoft','okta','azure_ad')),
  provider_name TEXT,
  idp_entity_id TEXT, idp_sso_url TEXT, idp_slo_url TEXT, idp_certificate TEXT,
  client_id TEXT, client_secret_encrypted TEXT, authorization_url TEXT, token_url TEXT, userinfo_url TEXT,
  sp_entity_id TEXT, sp_acs_url TEXT, sp_slo_url TEXT,
  attribute_mapping TEXT DEFAULT '{"email":"email","firstName":"given_name","lastName":"family_name"}',
  enforce_sso BOOLEAN DEFAULT FALSE,
  allow_password_login BOOLEAN DEFAULT TRUE,
  auto_provision_users BOOLEAN DEFAULT TRUE,
  default_role TEXT DEFAULT 'USER',
  is_active BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP,
  metadata_url TEXT, raw_metadata TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

COMMIT;

-- ---- Rollback (only if ever needed; all changes are additive) -----------
-- ALTER TABLE ai_policies ALTER COLUMN name SET NOT NULL;  -- (only if no NULLs)
-- ALTER TABLE ai_policies DROP COLUMN IF EXISTS internet_enabled, ... (the 7 cols);
-- ALTER TABLE users DROP COLUMN IF EXISTS user_status;
-- ALTER TABLE ai_usage_logs DROP COLUMN IF EXISTS error_message;
-- ALTER TABLE initiative_kpis DROP COLUMN IF EXISTS is_on_target;
-- DROP TABLE IF EXISTS ai_user_style_profiles;  -- (was newly created)
-- Pre-change schema snapshot: docs/qa/runs/2026-06-08/PROD-schema-snapshot-pre-migration.txt

-- ---- Post-apply verification (expect no error) -------------------------
--   SELECT user_status FROM users LIMIT 1;
--   SELECT internet_enabled FROM ai_policies LIMIT 1;
--   SELECT error_message FROM ai_usage_logs LIMIT 1;
--   SELECT 1 FROM ai_user_style_profiles LIMIT 1;
