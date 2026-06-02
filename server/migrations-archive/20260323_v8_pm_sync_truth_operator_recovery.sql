-- V8 Wave 12 — PM sync operator recovery: conflict resolution audit + auth escalations
-- Filename sorts after 20260323_v8_pm_sync_truth.sql so v8_conflict_records exists before ALTER.
-- (Lexicographic order: pm_sync_truth < pm_sync_truth_operator_recovery)

ALTER TABLE v8_conflict_records ADD COLUMN resolution_strategy TEXT;

CREATE TABLE IF NOT EXISTS v8_auth_escalations (
  escalation_id   TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  connector_id    TEXT NOT NULL,
  reason          TEXT,
  escalated_at    TEXT NOT NULL,
  resolved_at     TEXT,
  resolved_by     TEXT
);

CREATE INDEX IF NOT EXISTS idx_v8_conflicts_unresolved
  ON v8_conflict_records(organization_id) WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_v8_auth_escalations_active
  ON v8_auth_escalations(organization_id) WHERE resolved_at IS NULL;
