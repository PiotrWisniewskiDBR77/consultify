-- V4-ENT-07: AI governance — evaluations, metering views, policy enforcement

CREATE TABLE IF NOT EXISTS ai_evaluations (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  organization_id TEXT NOT NULL,
  purpose TEXT NOT NULL,
  model_id TEXT,
  eval_type TEXT NOT NULL DEFAULT 'quality',
  dataset_id TEXT,
  total_samples INTEGER DEFAULT 0,
  passed INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  accuracy REAL,
  avg_latency_ms REAL,
  avg_cost_usd REAL,
  results_json TEXT DEFAULT '[]',
  run_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_evals_org ON ai_evaluations(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_evals_purpose ON ai_evaluations(purpose);

CREATE TABLE IF NOT EXISTS ai_eval_datasets (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  purpose TEXT NOT NULL,
  samples_json TEXT NOT NULL DEFAULT '[]',
  sample_count INTEGER DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_eval_datasets_org ON ai_eval_datasets(organization_id);

CREATE TABLE IF NOT EXISTS ai_governance_policies (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  organization_id TEXT NOT NULL,
  policy_type TEXT NOT NULL,
  config_json TEXT NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_gov_policies_org ON ai_governance_policies(organization_id);

ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS eval_score REAL;
ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS flagged BOOLEAN DEFAULT FALSE;
ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS flag_reason TEXT;
