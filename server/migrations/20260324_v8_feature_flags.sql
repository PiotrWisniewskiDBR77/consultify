-- V8 Feature Flags — per-org module-level feature gating
-- CP-05: Feature Flag System

CREATE TABLE IF NOT EXISTS v8_feature_flags (
  flag_id           TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL,
  module            TEXT NOT NULL,
  enabled           INTEGER NOT NULL DEFAULT 0,
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by        TEXT,
  UNIQUE(organization_id, module)
);

CREATE INDEX IF NOT EXISTS idx_v8_ff_org ON v8_feature_flags(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_ff_org_module ON v8_feature_flags(organization_id, module);
