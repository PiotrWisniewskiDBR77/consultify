-- Migration 560: AI Authoring Audit table (T032)
-- Tracks field-level and card-level AI authoring actions for audit trail.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS ai_authoring_audit (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  project_id TEXT,
  user_id TEXT NOT NULL,
  artifact_type TEXT NOT NULL CHECK(artifact_type IN ('initiative', 'task', 'decision')),
  artifact_id TEXT,
  action_type TEXT NOT NULL CHECK(action_type IN (
    'field_generate', 'field_improve', 'field_shorten', 'field_expand', 'field_formal',
    'card_generate'
  )),
  field_key TEXT,
  input_text TEXT,
  output_text TEXT,
  was_applied INTEGER NOT NULL DEFAULT 0,
  was_undone INTEGER NOT NULL DEFAULT 0,
  metadata TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_authoring_audit_org ON ai_authoring_audit(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_authoring_audit_user ON ai_authoring_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_authoring_audit_artifact ON ai_authoring_audit(artifact_type, artifact_id);
CREATE INDEX IF NOT EXISTS idx_ai_authoring_audit_created ON ai_authoring_audit(created_at);
