-- V4-AI-07: Eval harness — regression gates, extended evaluation columns

CREATE TABLE IF NOT EXISTS ai_eval_regression_gates (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  organization_id TEXT NOT NULL,
  purpose TEXT,
  metric_name TEXT NOT NULL,
  min_threshold REAL,
  max_degradation REAL DEFAULT 0.05,
  is_blocking BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_eval_gates_org ON ai_eval_regression_gates(organization_id);

ALTER TABLE ai_evaluations ADD COLUMN IF NOT EXISTS eval_types_json TEXT DEFAULT '[]';
ALTER TABLE ai_evaluations ADD COLUMN IF NOT EXISTS regression_baseline_id TEXT;
ALTER TABLE ai_evaluations ADD COLUMN IF NOT EXISTS regression_delta_json TEXT;
ALTER TABLE ai_evaluations ADD COLUMN IF NOT EXISTS passes_gate BOOLEAN;
ALTER TABLE ai_evaluations ADD COLUMN IF NOT EXISTS gate_violations_json TEXT DEFAULT '[]';
