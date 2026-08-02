-- V4-RSLT runtime completion
-- Completes enterprise execution for Results KPI schedules, connectors, and metric audit trail.

ALTER TABLE IF EXISTS kpi_report_schedules ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMP;
ALTER TABLE IF EXISTS kpi_report_schedules ADD COLUMN IF NOT EXISTS last_run_status TEXT DEFAULT 'never';

ALTER TABLE IF EXISTS kpi_connectors ADD COLUMN IF NOT EXISTS last_run_message TEXT;

CREATE TABLE IF NOT EXISTS kpi_metric_audit_log (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  kpi_id TEXT NOT NULL,
  section TEXT NOT NULL,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'results_runtime',
  actor_user_id TEXT,
  summary TEXT,
  before_json TEXT NOT NULL DEFAULT '{}',
  after_json TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kpi_metric_audit_log_kpi
  ON kpi_metric_audit_log(organization_id, kpi_id, created_at DESC);
