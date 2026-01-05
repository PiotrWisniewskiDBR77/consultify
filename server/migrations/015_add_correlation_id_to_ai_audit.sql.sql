-- Step 9.5: Observability Completeness
-- Migration: 015_add_correlation_id_to_ai_audit.sql

-- Add correlation_id column to ai_audit_logs to allow tracing
-- flow from Proposal -> Decision -> Execution.
ALTER TABLE ai_audit_logs ADD COLUMN correlation_id TEXT;

-- Index for fast lookup of full trace by correlation_id
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_correlation ON ai_audit_logs(correlation_id);
