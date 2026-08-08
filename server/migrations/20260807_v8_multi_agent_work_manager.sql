CREATE TABLE IF NOT EXISTS v8_agent_work_graphs (
  graph_id TEXT PRIMARY KEY,
  execution_run_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  lead_agent_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('sequential', 'hierarchical', 'router_parallel')),
  status TEXT NOT NULL CHECK (status IN ('planned', 'running', 'synthesizing', 'completed', 'blocked', 'cancelled')),
  budget_json TEXT NOT NULL DEFAULT '{}',
  usage_json TEXT NOT NULL DEFAULT '{}',
  synthesis_json TEXT,
  contradictions_json TEXT NOT NULL DEFAULT '[]',
  synthesis_proposal_id TEXT,
  runtime_bundle_json TEXT,
  runtime_bundle_digest TEXT,
  source_template_ref_json TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS v8_agent_branch_tasks (
  task_id TEXT PRIMARY KEY,
  graph_id TEXT NOT NULL REFERENCES v8_agent_work_graphs(graph_id),
  organization_id TEXT NOT NULL,
  specialist_agent_id TEXT NOT NULL,
  title TEXT NOT NULL,
  objective TEXT NOT NULL,
  expected_output_schema_json TEXT NOT NULL DEFAULT '{}',
  dependencies_json TEXT NOT NULL DEFAULT '[]',
  tool_scope_json TEXT NOT NULL DEFAULT '[]',
  budget_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  lease_owner TEXT,
  lease_expires_at TEXT,
  output_json TEXT,
  evidence_json TEXT NOT NULL DEFAULT '[]',
  confidence REAL,
  error_text TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE v8_agent_branch_tasks ADD COLUMN IF NOT EXISTS usage_json TEXT NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'v8_agent_work_graphs'::regclass
      AND conname = 'v8_agent_work_graphs_status_check'
      AND pg_get_constraintdef(oid) LIKE '%cancellation_requested%'
  ) THEN
    ALTER TABLE v8_agent_work_graphs DROP CONSTRAINT IF EXISTS v8_agent_work_graphs_status_check;
    ALTER TABLE v8_agent_work_graphs ADD CONSTRAINT v8_agent_work_graphs_status_check
      CHECK (status IN ('planned','running','synthesizing','completed','blocked','cancellation_requested','cancelled'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'v8_agent_branch_tasks'::regclass
      AND conname = 'v8_agent_branch_tasks_status_check'
      AND pg_get_constraintdef(oid) LIKE '%cancellation_requested%'
  ) THEN
    ALTER TABLE v8_agent_branch_tasks DROP CONSTRAINT IF EXISTS v8_agent_branch_tasks_status_check;
    ALTER TABLE v8_agent_branch_tasks ADD CONSTRAINT v8_agent_branch_tasks_status_check
      CHECK (status IN ('pending','running','completed','failed','cancellation_requested','cancelled'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_v8_agent_graphs_run ON v8_agent_work_graphs(execution_run_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_agent_tasks_ready ON v8_agent_branch_tasks(graph_id, organization_id, status);

CREATE TABLE IF NOT EXISTS v8_agent_contradiction_resolutions (
  resolution_id TEXT PRIMARY KEY,
  graph_id TEXT NOT NULL REFERENCES v8_agent_work_graphs(graph_id),
  organization_id TEXT NOT NULL,
  claim_key TEXT NOT NULL,
  resolution_type TEXT NOT NULL CHECK (resolution_type IN ('choose_branch', 'human_judgement')),
  source_task_id TEXT,
  selected_value_json TEXT NOT NULL,
  rationale TEXT NOT NULL,
  resolved_by TEXT NOT NULL,
  resolved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(graph_id, claim_key)
);

CREATE INDEX IF NOT EXISTS idx_v8_agent_resolutions_graph
  ON v8_agent_contradiction_resolutions(graph_id, organization_id, resolved_at);
