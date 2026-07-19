-- Migration: 605_ai_usage_logs_cost_contract_v3.sql
-- Purpose: Ensure ai_usage_logs supports v3 cost + error analytics (no best-effort dependence)

-- Cost/metering columns used by AIPipeline + analytics UIs
ALTER TABLE ai_usage_logs
  ADD COLUMN IF NOT EXISTS estimated_cost_usd REAL;

ALTER TABLE ai_usage_logs
  ADD COLUMN IF NOT EXISTS price_snapshot_id TEXT;

-- v3 routing keys
ALTER TABLE ai_usage_logs
  ADD COLUMN IF NOT EXISTS purpose TEXT;

ALTER TABLE ai_usage_logs
  ADD COLUMN IF NOT EXISTS kind TEXT;

-- Error analytics (separate from freeform error_message)
ALTER TABLE ai_usage_logs
  ADD COLUMN IF NOT EXISTS error_class TEXT;

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_price_snapshot_id ON ai_usage_logs(price_snapshot_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_error_class ON ai_usage_logs(error_class);

