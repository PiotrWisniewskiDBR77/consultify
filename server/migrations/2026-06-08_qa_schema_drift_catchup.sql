-- =====================================================================
-- QA-2026-06-08 — Schema-drift catch-up (Postgres, idempotent)
-- =====================================================================
-- STATUS: APPLIED + VERIFIED ON STAGING (2026-06-08) via pg client over
-- DATABASE_PUBLIC_URL. All statements succeeded; columns/tables verified
-- present in information_schema. NOT yet applied to PRODUCTION.
--
-- Context: QA run 2026-06-08 found staging AND production Postgres missing
-- columns/tables the code expects → live `[DB:Promise] ... does not exist`
-- errors (incl. broken AI token-accounting on prod).
--
-- Why the original migrations never landed: some were authored with SQLite
-- idioms that FAIL on Postgres (e.g. `created_at TEXT DEFAULT CURRENT_TIMESTAMP`
-- — a timestamptz default on a TEXT column). Those are corrected below
-- (`DEFAULT (now()::text)`), which is why the canonical tables were silently
-- absent. This script is the corrected, Postgres-tested version.
--
-- Run order for PROD: BACKUP prod DB → run this → watch logs for "does not
-- exist" (should disappear) → verify queries at bottom.
-- =====================================================================

BEGIN;

-- ---- Column adds (staging gaps) -------------------------------------
ALTER TABLE users            ADD COLUMN IF NOT EXISTS user_status   TEXT DEFAULT 'ACTIVE';
ALTER TABLE initiative_kpis  ADD COLUMN IF NOT EXISTS is_on_target  INTEGER DEFAULT 0;
ALTER TABLE ai_usage_logs    ADD COLUMN IF NOT EXISTS error_message TEXT;

-- ---- Missing tables (prod AI-pipeline gaps + staging sso) -----------

-- ai_policies. NOTE: the canonical migration CREATE has `name TEXT NOT NULL`,
-- but aiPolicyEngine.ts INSERTs WITHOUT `name` → would violate NOT NULL.
-- Created here with `name` NULLABLE so both READ (internet_enabled, etc.) and
-- the engine's INSERT work. Full column set merged from base CREATE + 298.
-- TODO(server): reconcile aiPolicyEngine INSERT vs the NOT NULL in migrations.
CREATE TABLE IF NOT EXISTS ai_policies (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  name TEXT,
  policy_type TEXT,
  config TEXT DEFAULT '{}',
  is_active INTEGER DEFAULT 1,
  internet_enabled INTEGER DEFAULT 1,
  policy_level TEXT DEFAULT 'ADVISORY',
  audit_required INTEGER DEFAULT 1,
  active_roles TEXT DEFAULT '["ADVISOR","PMO_MANAGER","EXECUTOR","EDUCATOR"]',
  max_policy_level TEXT DEFAULT 'ASSISTED',
  default_ai_role TEXT DEFAULT 'ADVISOR',
  proactive_notifications INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_user_style_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  organization_id TEXT,
  preferred_depth TEXT DEFAULT 'balanced' CHECK(preferred_depth IN ('executive_summary','balanced','deep_dive')),
  preferred_format TEXT DEFAULT 'structured' CHECK(preferred_format IN ('bullets','paragraphs','structured','conversational')),
  technical_level TEXT DEFAULT 'intermediate' CHECK(technical_level IN ('beginner','intermediate','expert')),
  response_length TEXT DEFAULT 'medium' CHECK(response_length IN ('concise','medium','comprehensive')),
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
  created_at TEXT DEFAULT (now()::text),   -- was: TEXT DEFAULT CURRENT_TIMESTAMP (SQLite-ism, fails on PG)
  updated_at TEXT DEFAULT (now()::text),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);

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

-- ---- Post-apply verification (expect no error) ---------------------
--   SELECT user_status FROM users LIMIT 1;
--   SELECT is_on_target FROM initiative_kpis LIMIT 1;
--   SELECT error_message FROM ai_usage_logs LIMIT 1;
--   SELECT internet_enabled FROM ai_policies LIMIT 1;
--   SELECT 1 FROM ai_user_style_profiles LIMIT 1;
--   SELECT 1 FROM sso_configurations LIMIT 1;
-- Then watch `railway logs` for "does not exist" — should be gone.
