CREATE TABLE IF NOT EXISTS transformation_monitoring_definitions (
  monitoring_definition_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  transformation_case_id TEXT NOT NULL,
  initiative_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  cadence TEXT NOT NULL CHECK (cadence IN ('daily','weekly','monthly')),
  timezone TEXT NOT NULL,
  first_run_at TIMESTAMPTZ NOT NULL,
  next_run_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')),
  lease_owner TEXT,
  lease_expires_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, transformation_case_id)
);

CREATE INDEX IF NOT EXISTS idx_transformation_monitoring_due
  ON transformation_monitoring_definitions(status,next_run_at,lease_expires_at);

CREATE TABLE IF NOT EXISTS transformation_monitoring_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  monitoring_definition_id TEXT NOT NULL REFERENCES transformation_monitoring_definitions(monitoring_definition_id),
  organization_id TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  snapshot_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (monitoring_definition_id, scheduled_for)
);

CREATE TABLE IF NOT EXISTS transformation_mobilization_owner_receipts (
  receipt_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  transformation_case_id TEXT NOT NULL,
  initiative_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  payload_digest TEXT NOT NULL,
  raid_item_ids_json JSONB NOT NULL,
  calendar_item_ids_json JSONB NOT NULL,
  monitoring_definition_id TEXT NOT NULL REFERENCES transformation_monitoring_definitions(monitoring_definition_id),
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, proposal_id)
);
