CREATE TABLE IF NOT EXISTS role_change_audit_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  before_json TEXT,
  after_json TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_role_change_audit_events_org_created
  ON role_change_audit_events(organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_iam_jobs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  job_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  last_error TEXT,
  available_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lease_token TEXT,
  lease_expires_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_admin_iam_jobs_claim
  ON admin_iam_jobs(organization_id, status, available_at);

CREATE TABLE IF NOT EXISTS admin_iam_job_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  job_id TEXT NOT NULL REFERENCES admin_iam_jobs(id) ON DELETE RESTRICT,
  actor_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  details_json TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_iam_job_events_job
  ON admin_iam_job_events(organization_id, job_id, created_at);
