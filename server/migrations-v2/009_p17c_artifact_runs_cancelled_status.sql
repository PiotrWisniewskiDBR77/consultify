-- Ported from: 20260409_p17c_artifact_runs_cancelled_status.sql (SQLite idioms fixed for Postgres)
-- P17-C: Add 'cancelled' as a terminal run_status for ArtifactRun.
-- SQLite does not support ALTER CHECK constraints directly.
-- Recreate the table with the updated CHECK, migrate data, and swap.

CREATE TABLE IF NOT EXISTS v8_artifact_runs_new (
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
             CHECK (run_status IN ('planned', 'proposal_created', 'retry_requested', 'completed', 'failed', 'cancelled')),
  proposal_id TEXT,
  retry_of_run_id TEXT,
  failure_reason TEXT,
  preflight_state TEXT,
  preflight_json TEXT,
  materialization_origin_runtime TEXT,
  materialization_origin_record_id TEXT,
  failure_package_json TEXT,
  started_at TEXT NOT NULL DEFAULT (TIMESTAMPTZ('now')),
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (TIMESTAMPTZ('now')),
  updated_at TEXT NOT NULL DEFAULT (TIMESTAMPTZ('now'))
);

INSERT INTO v8_artifact_runs_new
  SELECT run_id, artifact_id, organization_id, execution_run_id, context_snapshot_id,
         trigger_type, source_context_type, source_context_id, requested_by_user_id,
         plan_json, run_status, proposal_id, retry_of_run_id, failure_reason,
         preflight_state, preflight_json, materialization_origin_runtime,
         materialization_origin_record_id, failure_package_json,
         started_at, completed_at, created_at, updated_at
  FROM v8_artifact_runs
ON CONFLICT DO NOTHING;

DROP TABLE IF EXISTS v8_artifact_runs;
ALTER TABLE v8_artifact_runs_new RENAME TO v8_artifact_runs;

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
