-- Ported from: 20260409_p17c_artifact_run_audit_log.sql (SQLite idioms fixed for Postgres)
-- P17-C: Explicit audit log for ArtifactRun lifecycle transitions.
-- Each status change, preflight, materialization, and retry is recorded.

CREATE TABLE IF NOT EXISTS v8_artifact_run_audit_log (
  audit_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  action TEXT NOT NULL
    CHECK (action IN (
      'created', 'preflight', 'plan_accepted', 'materialized',
      'failed', 'cancelled', 'retry_requested', 'status_changed'
    )),
  from_status TEXT,
  to_status TEXT,
  actor_user_id TEXT NOT NULL,
  detail_json TEXT,
  created_at TEXT NOT NULL DEFAULT (TIMESTAMPTZ('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_artifact_run_audit_run
  ON v8_artifact_run_audit_log(run_id, organization_id, created_at);

CREATE INDEX IF NOT EXISTS idx_v8_artifact_run_audit_org
  ON v8_artifact_run_audit_log(organization_id, created_at DESC);
