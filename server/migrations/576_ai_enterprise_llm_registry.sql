-- Migration: 576_ai_enterprise_llm_registry.sql
-- Purpose: Enterprise LLM management foundation (purposes, policies, pricing snapshots, market inbox)

-- -------------------------------------------------------------------
-- 1) Extend llm_providers with enterprise metadata (non-breaking)
-- -------------------------------------------------------------------

ALTER TABLE llm_providers
  ADD COLUMN IF NOT EXISTS kind TEXT DEFAULT 'TEXT_LLM';

ALTER TABLE llm_providers
  ADD COLUMN IF NOT EXISTS provider_type TEXT DEFAULT 'aggregator';

ALTER TABLE llm_providers
  ADD COLUMN IF NOT EXISTS origin_vendor TEXT;

ALTER TABLE llm_providers
  ADD COLUMN IF NOT EXISTS execution_regions JSONB;

ALTER TABLE llm_providers
  ADD COLUMN IF NOT EXISTS allowed_data_classes JSONB;

ALTER TABLE llm_providers
  ADD COLUMN IF NOT EXISTS data_residency_attestation TEXT;

ALTER TABLE llm_providers
  ADD COLUMN IF NOT EXISTS subprocessors_ref TEXT;

-- -------------------------------------------------------------------
-- 2) Org-level provider settings (enable/disable + custom priority)
-- -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS organization_provider_settings (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT TRUE,
  custom_priority INTEGER,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_org_provider_settings_org ON organization_provider_settings(organization_id);

-- -------------------------------------------------------------------
-- 3) Org AI policy (region/provider_type/origin/data-class)
-- -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS organization_ai_policy (
  organization_id TEXT PRIMARY KEY,
  policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------------
-- 4) Purpose registry + purpose assignments
-- -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_purposes (
  purpose TEXT PRIMARY KEY,
  kind TEXT NOT NULL, -- TEXT_LLM / IMAGE_MODEL / BUSINESS_MODEL
  default_tier TEXT,
  requirements JSONB,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_purpose_assignments (
  id TEXT PRIMARY KEY,
  organization_id TEXT, -- NULL = global default
  purpose TEXT NOT NULL REFERENCES ai_purposes(purpose) ON DELETE CASCADE,
  provider_id TEXT NOT NULL, -- references llm_providers.id (not FK to keep compat across DBs)
  model_id TEXT, -- optional override (if provider row has generic provider config)
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, purpose, provider_id, COALESCE(model_id, ''))
);

CREATE INDEX IF NOT EXISTS idx_ai_purpose_assignments_purpose ON ai_purpose_assignments(purpose);
CREATE INDEX IF NOT EXISTS idx_ai_purpose_assignments_org ON ai_purpose_assignments(organization_id);

-- -------------------------------------------------------------------
-- 5) Pricing snapshots (versioned)
-- -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_price_snapshots (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  source TEXT NOT NULL DEFAULT 'manual', -- manual | api_sync | contract
  effective_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  effective_to TIMESTAMP,
  units JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_price_snapshots_provider_model ON ai_price_snapshots(provider, model_id);

-- -------------------------------------------------------------------
-- 6) Fix/extend ai_usage_logs schema to match code expectations (AIPipeline + LLMController)
-- -------------------------------------------------------------------

ALTER TABLE ai_usage_logs
  ADD COLUMN IF NOT EXISTS action TEXT;

ALTER TABLE ai_usage_logs
  ADD COLUMN IF NOT EXISTS tokens_used INTEGER DEFAULT 0;

ALTER TABLE ai_usage_logs
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'success';

ALTER TABLE ai_usage_logs
  ADD COLUMN IF NOT EXISTS metadata JSONB;

ALTER TABLE ai_usage_logs
  ADD COLUMN IF NOT EXISTS purpose TEXT;

ALTER TABLE ai_usage_logs
  ADD COLUMN IF NOT EXISTS kind TEXT;

ALTER TABLE ai_usage_logs
  ADD COLUMN IF NOT EXISTS price_snapshot_id TEXT;

-- Ensure indexes exist (best-effort)
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_action ON ai_usage_logs(action);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_purpose ON ai_usage_logs(purpose);

-- -------------------------------------------------------------------
-- 7) Market update snapshots + inbox
-- -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_market_snapshots (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL, -- e.g. openrouter
  payload JSONB NOT NULL,
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_market_inbox (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  change_type TEXT NOT NULL, -- MODEL_ADDED | MODEL_REMOVED | PRICING_CHANGED | CAPABILITY_CHANGED | CTX_CHANGED
  model_id TEXT,
  diff JSONB,
  status TEXT NOT NULL DEFAULT 'new', -- new | approved | ignored | applied
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_market_inbox_status ON ai_market_inbox(status);

