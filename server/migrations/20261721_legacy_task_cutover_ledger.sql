-- DAY197 / D-7 stage 1: durable, additive accounting for legacy task cutover.
-- Deliberately no foreign keys: legacy and canonical rows have independent
-- lifecycles, while this ledger must retain forward-repair evidence.

CREATE TABLE IF NOT EXISTS legacy_task_cutover_ledger (
  organization_id TEXT NOT NULL,
  legacy_task_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'MIGRATED', 'SKIPPED', 'FAILED')),
  reason_code TEXT,
  client_request_id TEXT NOT NULL,
  canonical_id TEXT,
  case_version_before INTEGER CHECK (case_version_before IS NULL OR case_version_before >= 0),
  case_version_after INTEGER CHECK (case_version_after IS NULL OR case_version_after >= 0),
  actor_id TEXT NOT NULL,
  checksum TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (organization_id, legacy_task_id)
);

CREATE INDEX IF NOT EXISTS idx_legacy_task_cutover_batch_status
  ON legacy_task_cutover_ledger(batch_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_legacy_task_cutover_client_request
  ON legacy_task_cutover_ledger(organization_id, client_request_id);
