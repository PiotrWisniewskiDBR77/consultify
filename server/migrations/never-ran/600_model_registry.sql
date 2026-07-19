-- Migration: 600_model_registry.sql
-- Purpose: V3-A06 SuperAdmin Model Registry - model_registry, purpose_assignments, model_audit_log

-- -------------------------------------------------------------------
-- 1) model_registry table
-- -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS model_registry (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_type TEXT NOT NULL DEFAULT 'aggregator',
  origin_vendor TEXT NOT NULL DEFAULT '',
  model_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'TEXT_LLM',
  is_active BOOLEAN DEFAULT TRUE,
  health_status TEXT NOT NULL DEFAULT 'unknown',
  last_health_check TIMESTAMP,
  avg_latency_ms INTEGER,
  cost_per_1k REAL,
  capabilities_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  execution_regions JSONB NOT NULL DEFAULT '[]'::jsonb,
  allowed_data_classes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_model_registry_kind ON model_registry(kind);
CREATE INDEX IF NOT EXISTS idx_model_registry_provider ON model_registry(provider);
CREATE INDEX IF NOT EXISTS idx_model_registry_health ON model_registry(health_status);
CREATE INDEX IF NOT EXISTS idx_model_registry_active ON model_registry(is_active);

-- -------------------------------------------------------------------
-- 2) purpose_assignments table (links purposes to model_registry entries)
-- -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS purpose_assignments (
  id TEXT PRIMARY KEY,
  purpose TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'TEXT_LLM',
  registry_model_id TEXT NOT NULL REFERENCES model_registry(id) ON DELETE CASCADE,
  tier TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  fallback_model_id TEXT REFERENCES model_registry(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purpose_assignments_purpose ON purpose_assignments(purpose);
CREATE INDEX IF NOT EXISTS idx_purpose_assignments_kind ON purpose_assignments(kind);
CREATE INDEX IF NOT EXISTS idx_purpose_assignments_registry_model ON purpose_assignments(registry_model_id);

-- -------------------------------------------------------------------
-- 3) model_audit_log table
-- -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS model_audit_log (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  changes_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_model_audit_log_entity ON model_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_model_audit_log_changed_at ON model_audit_log(changed_at);
CREATE INDEX IF NOT EXISTS idx_model_audit_log_action ON model_audit_log(action);
