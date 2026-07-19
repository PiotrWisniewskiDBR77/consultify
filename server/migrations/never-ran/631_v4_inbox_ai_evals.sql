-- V4-INBX-04: Evals dla AI triage (accuracy na golden set) + cost controls
-- Golden set: expected action per item for eval harness
-- Eval runs: run results with accuracy + cost

CREATE TABLE IF NOT EXISTS inbox_ai_eval_golden_set (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  item_key TEXT NOT NULL,
  item_snapshot_json TEXT,
  expected_action TEXT NOT NULL,
  expected_reason TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, item_key)
);

CREATE TABLE IF NOT EXISTS inbox_ai_eval_runs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  ran_at TIMESTAMP NOT NULL,
  total_items INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  accuracy REAL,
  cost_usd REAL,
  model_id TEXT,
  run_params_json TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inbox_eval_golden_org ON inbox_ai_eval_golden_set(organization_id);
CREATE INDEX IF NOT EXISTS idx_inbox_eval_runs_org ON inbox_ai_eval_runs(organization_id);
CREATE INDEX IF NOT EXISTS idx_inbox_eval_runs_ran_at ON inbox_ai_eval_runs(ran_at);
