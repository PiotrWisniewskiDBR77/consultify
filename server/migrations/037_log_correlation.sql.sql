-- Phase 8.1: Observability Hardening
-- Add correlation_id to activity_logs for distributed tracing support

ALTER TABLE activity_logs ADD COLUMN correlation_id TEXT;

-- Index for fast lookup in SIEM / Debugging scenarios
CREATE INDEX IF NOT EXISTS idx_activity_logs_correlation ON activity_logs(correlation_id);
