-- Migration: 755_v10_learning_loop_tables.sql
-- Purpose: Persist V10 Learning Loop signals (feedback/retention/stewardship/incidents)

CREATE TABLE IF NOT EXISTS v10_learning_feedback (
  feedback_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  target_type TEXT NOT NULL CHECK (target_type IN ('chat', 'artifact', 'tool', 'unknown')),
  target_id TEXT,
  comment_redacted TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_v10_learning_feedback_org_created_at
  ON v10_learning_feedback (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v10_learning_feedback_org_target_type
  ON v10_learning_feedback (organization_id, target_type);

CREATE TABLE IF NOT EXISTS v10_learning_retention_previews (
  preview_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  retain BOOLEAN NOT NULL,
  ttl_days INTEGER NOT NULL CHECK (ttl_days >= 0),
  reasons_json TEXT NOT NULL DEFAULT '[]',
  redacted_sample TEXT,
  context_hint TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_v10_learning_retention_org_created_at
  ON v10_learning_retention_previews (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS v10_learning_stewardship_queue (
  item_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('low_rating_feedback', 'retention_blocked', 'incident_reported', 'drift_detected')),
  summary TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'resolved')),
  resolved_at TIMESTAMP,
  payload_json TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_v10_learning_stewardship_org_status_created_at
  ON v10_learning_stewardship_queue (organization_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS v10_learning_incidents (
  incident_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('drift', 'incident')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  summary TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL CHECK (status IN ('open', 'resolved')),
  resolved_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_v10_learning_incidents_org_status_created_at
  ON v10_learning_incidents (organization_id, status, created_at DESC);

