-- V8.1 ArtifactRun contract (Wave 1)
-- Minimal persisted planning/retry envelope for chat-driven artifact generation.

CREATE TABLE IF NOT EXISTS v8_artifact_runs (
  run_id TEXT PRIMARY KEY,
  artifact_id TEXT,
  organization_id TEXT NOT NULL,
  execution_run_id TEXT NOT NULL,
  context_snapshot_id TEXT NOT NULL,
  trigger_type TEXT NOT NULL
               CHECK (trigger_type IN ('chat', 'module_action', 'template', 'refresh')),
  source_context_type TEXT,
  source_context_id TEXT,
  requested_by_user_id TEXT NOT NULL,
  plan_json TEXT NOT NULL,
  run_status TEXT NOT NULL DEFAULT 'planned'
             CHECK (run_status IN ('planned', 'proposal_created', 'retry_requested', 'completed', 'failed')),
  proposal_id TEXT,
  retry_of_run_id TEXT,
  failure_reason TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v81_artifact_runs_org_created
  ON v8_artifact_runs(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v81_artifact_runs_execution
  ON v8_artifact_runs(execution_run_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_v81_artifact_runs_artifact
  ON v8_artifact_runs(artifact_id, organization_id)
  WHERE artifact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_v81_artifact_runs_retry
  ON v8_artifact_runs(retry_of_run_id, organization_id)
  WHERE retry_of_run_id IS NOT NULL;
