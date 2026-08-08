CREATE TABLE IF NOT EXISTS v8_agent_quality_eval_runs (
  eval_run_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  execution_run_id TEXT NOT NULL,
  candidate_sha TEXT NOT NULL,
  suite_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed')),
  score REAL NOT NULL,
  threshold REAL NOT NULL,
  total_cases INTEGER NOT NULL,
  passed_cases INTEGER NOT NULL,
  critical_failures_json TEXT NOT NULL DEFAULT '[]',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS v8_agent_quality_eval_cases (
  result_id TEXT PRIMARY KEY,
  eval_run_id TEXT NOT NULL REFERENCES v8_agent_quality_eval_runs(eval_run_id),
  organization_id TEXT NOT NULL,
  case_key TEXT NOT NULL,
  capability TEXT NOT NULL,
  dimension TEXT NOT NULL,
  critical_invariant TEXT,
  validator TEXT NOT NULL,
  passed INTEGER NOT NULL,
  actual_json TEXT NOT NULL,
  expected_json TEXT NOT NULL,
  evidence_refs_json TEXT NOT NULL,
  failure_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(eval_run_id, case_key)
);

CREATE INDEX IF NOT EXISTS idx_agent_quality_eval_run
  ON v8_agent_quality_eval_runs(organization_id, execution_run_id, created_at);
