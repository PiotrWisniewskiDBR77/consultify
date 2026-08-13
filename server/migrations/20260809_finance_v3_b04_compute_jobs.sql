-- Finance v3 — Gate C (WP-C01): WP-B04 persisted compute jobs (queued/running/succeeded/failed/cancelled).
--
-- Source: docs/validation/finance-v3/generated/gate-b/WP-B04_jobs_runs_outputs_ADR.md section 3.
--
-- Additive only.
--
-- Implementation notes:
--   1. TEXT ids, not UUID — same reconciliation as the B01 migration (organizations(id) is TEXT,
--      and every other Finance v3 table in this migration set uses TEXT).
--   2. compute_jobs/compute_job_runs/compute_job_outputs intentionally keep the WITHOUT `finance_`
--      prefix naming from the B04 ADR as-is. WP-B06 section 0 explicitly flags this as a known,
--      un-reconciled naming inconsistency ("bez prefiksu finance_ — niespojnosc nieadresowana
--      przez rekoncyliacje, bo ta objela tylko B01-B03"). Renaming it unilaterally in WP-C01 would
--      contradict the literal DDL all three downstream ADRs (B05 evidence JSONB, B06 compute
--      snapshots, B07 correlation-id/reason-code columns) were written and cross-checked against.
--      Left as documented technical debt for a future orchestrator-approved rename, not silently
--      fixed here.
--   3. `org_concurrency_limit(organization_id, job_type)` and `is_org_compute_killed(organization_id,
--      job_type)`, referenced in the ADR's claim-query sketch (section 5.1), are configuration
--      lookups with no concrete DDL anywhere in Gate B (B04 section 7.2 punts the kill-switch
--      storage to "a new table or extension of v8_feature_flags", not designed here). Not created
--      by this migration — the three core tables (queue/runs/outputs) are complete and testable
--      without them; the claim-query's use of those two functions is an implementation detail of
--      the future worker process (Gate C service layer), not a schema requirement.

BEGIN;

CREATE TABLE IF NOT EXISTS compute_jobs (
  id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id      TEXT NOT NULL REFERENCES organizations(id),
  job_type             TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'queued'
                         CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),

  input_artifact_id      TEXT NOT NULL,
  input_revision_hash    TEXT NOT NULL,
  engine_manifest_id     TEXT NOT NULL REFERENCES finance_engine_manifests(engine_manifest_id),

  idempotency_key      TEXT NOT NULL,

  lease_owner          TEXT,
  lease_expires_at     TIMESTAMPTZ,

  attempt_count        INTEGER NOT NULL DEFAULT 0,
  max_attempts          INTEGER NOT NULL DEFAULT 5,
  next_attempt_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  cancel_requested_at    TIMESTAMPTZ,
  cancel_reason          TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at            TIMESTAMPTZ,
  finished_at           TIMESTAMPTZ,

  error                TEXT,

  requested_by_user_id    TEXT NOT NULL,
  request_id            TEXT, -- correlation id from HTTP layer (WP-B07 section 2.2, reserved here as B04 pre-allocated it)

  CONSTRAINT fk_compute_jobs_artifact_org
    FOREIGN KEY (input_artifact_id, organization_id)
    REFERENCES finance_artifacts (artifact_id, organization_id),

  CONSTRAINT compute_jobs_idempotency_uq
    UNIQUE (organization_id, job_type, idempotency_key)
);

CREATE INDEX IF NOT EXISTS compute_jobs_claim_idx
  ON compute_jobs (job_type, next_attempt_at)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS compute_jobs_org_running_idx
  ON compute_jobs (organization_id, job_type)
  WHERE status = 'running';

CREATE INDEX IF NOT EXISTS compute_jobs_lease_reaper_idx
  ON compute_jobs (lease_expires_at)
  WHERE status = 'running';

CREATE TABLE IF NOT EXISTS compute_job_runs (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  job_id            TEXT NOT NULL REFERENCES compute_jobs(id),
  attempt_number     INTEGER NOT NULL,
  worker_id           TEXT NOT NULL,
  claimed_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_heartbeat_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at               TIMESTAMPTZ,
  outcome                    TEXT CHECK (outcome IN
                                ('succeeded', 'failed', 'cancelled', 'lease_expired', 'killed')),
  error                        TEXT,

  CONSTRAINT compute_job_runs_job_attempt_uq UNIQUE (job_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS compute_job_runs_job_idx ON compute_job_runs (job_id, attempt_number);

CREATE TABLE IF NOT EXISTS compute_job_outputs (
  id                          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  job_id                      TEXT NOT NULL REFERENCES compute_jobs(id),
  organization_id             TEXT NOT NULL REFERENCES organizations(id),
  output_artifact_id            TEXT NOT NULL,
  output_business_version_id      TEXT,
  output_working_revision_id        TEXT NOT NULL REFERENCES finance_working_revisions(working_revision_id),
  committed_by_attempt_number         INTEGER NOT NULL,
  content_semantic_hash                 TEXT NOT NULL,
  freshness                               TEXT NOT NULL DEFAULT 'CURRENT'
                                            CHECK (freshness IN
                                              ('CURRENT', 'STALE_SOURCE', 'STALE_ASSUMPTIONS', 'COMPUTE_FAILED')),
  committed_at                              TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT compute_job_outputs_job_uq UNIQUE (job_id),
  CONSTRAINT compute_job_outputs_idempotency_uq
    UNIQUE (organization_id, output_artifact_id, content_semantic_hash),

  CONSTRAINT fk_compute_job_outputs_artifact_org
    FOREIGN KEY (output_artifact_id, organization_id)
    REFERENCES finance_artifacts (artifact_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_compute_job_outputs_artifact ON compute_job_outputs(output_artifact_id, committed_at DESC);

COMMIT;
