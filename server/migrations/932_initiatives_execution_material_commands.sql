-- Initiatives + Execution canonical material-command foundation.
-- PostgreSQL only. Every material write commits aggregate state, audit, outbox
-- and its idempotency receipt in one transaction.

BEGIN;

-- Existing `initiative_candidates` remains the source-owned proposal store.
-- Add only the governance/read-back fields required by the canonical Register flow.
DO $$
BEGIN
  IF to_regclass('public.initiative_candidates') IS NOT NULL THEN
    ALTER TABLE initiative_candidates ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE initiative_candidates ADD COLUMN IF NOT EXISTS source_version INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE initiative_candidates ADD COLUMN IF NOT EXISTS problem TEXT;
    ALTER TABLE initiative_candidates ADD COLUMN IF NOT EXISTS proposed_outcome TEXT;
    ALTER TABLE initiative_candidates ADD COLUMN IF NOT EXISTS project_id TEXT;
    ALTER TABLE initiative_candidates ADD COLUMN IF NOT EXISTS initiative_owner_id TEXT;
    ALTER TABLE initiative_candidates ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'PROJECT';
    ALTER TABLE initiative_candidates ADD COLUMN IF NOT EXISTS evidence_state TEXT NOT NULL DEFAULT 'UNKNOWN';
    ALTER TABLE initiative_candidates ADD COLUMN IF NOT EXISTS duplicate_state TEXT NOT NULL DEFAULT 'UNKNOWN';
    ALTER TABLE initiative_candidates ADD COLUMN IF NOT EXISTS provenance_json JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE initiative_candidates ADD COLUMN IF NOT EXISTS policy_id TEXT;
    ALTER TABLE initiative_candidates ADD COLUMN IF NOT EXISTS policy_version INTEGER;
    ALTER TABLE initiative_candidates ADD COLUMN IF NOT EXISTS disposition TEXT;
    ALTER TABLE initiative_candidates ADD COLUMN IF NOT EXISTS registered_initiative_id TEXT;
    ALTER TABLE initiative_candidates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_initiative_candidates_registered_initiative
      ON initiative_candidates (organization_id, registered_initiative_id)
      WHERE registered_initiative_id IS NOT NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ie_aggregate_state (
  organization_id TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (organization_id, aggregate_type, aggregate_id)
);

CREATE TABLE IF NOT EXISTS ie_governance_policies (
  organization_id TEXT NOT NULL,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('PRODUCT','ORGANIZATION','PROJECT','INITIATIVE')),
  scope_id TEXT NOT NULL,
  policy_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  baseline TEXT NOT NULL CHECK (baseline IN ('LITE','STANDARD','COMPLEX')),
  strictness INTEGER NOT NULL CHECK (strictness BETWEEN 1 AND 3),
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  downgrade_decision_id TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUPERSEDED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (organization_id, scope_type, scope_id, policy_id, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ie_governance_policy_active_scope
  ON ie_governance_policies (organization_id, scope_type, scope_id)
  WHERE status = 'ACTIVE';

INSERT INTO ie_governance_policies
  (organization_id, scope_type, scope_id, policy_id, version, baseline, strictness, config_json)
VALUES ('*','PRODUCT','DEFAULT','consultify-standard',1,'STANDARD',2,
        '{"separationOfDuties":true,"selfApproval":false}'::jsonb)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS ie_command_receipts (
  organization_id TEXT NOT NULL,
  client_request_id TEXT NOT NULL,
  command_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  aggregate_version INTEGER NOT NULL CHECK (aggregate_version >= 1),
  correlation_id TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL CHECK (length(request_fingerprint) = 64),
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (organization_id, client_request_id)
);

CREATE TABLE IF NOT EXISTS ie_audit_events (
  id BIGSERIAL PRIMARY KEY,
  organization_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  aggregate_version INTEGER NOT NULL CHECK (aggregate_version >= 1),
  command_type TEXT NOT NULL,
  client_request_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  policy_id TEXT NOT NULL,
  policy_version INTEGER NOT NULL CHECK (policy_version >= 1),
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, aggregate_type, aggregate_id, aggregate_version)
);

CREATE TABLE IF NOT EXISTS ie_outbox_events (
  id BIGSERIAL PRIMARY KEY,
  organization_id TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  aggregate_version INTEGER NOT NULL CHECK (aggregate_version >= 1),
  event_type TEXT NOT NULL CHECK (btrim(event_type) <> ''),
  correlation_id TEXT NOT NULL,
  causation_id TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  available_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, aggregate_type, aggregate_id, aggregate_version, event_type)
);

CREATE TABLE IF NOT EXISTS ie_aggregate_relations (
  organization_id TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_version INTEGER NOT NULL CHECK (source_version >= 1),
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (organization_id, relation_type, source_type, source_id),
  UNIQUE (organization_id, relation_type, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_ie_audit_aggregate
  ON ie_audit_events (organization_id, aggregate_type, aggregate_id, aggregate_version);
CREATE INDEX IF NOT EXISTS idx_ie_outbox_pending
  ON ie_outbox_events (available_at, id) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ie_receipts_aggregate
  ON ie_command_receipts (organization_id, aggregate_type, aggregate_id, aggregate_version);
CREATE INDEX IF NOT EXISTS idx_ie_relations_target
  ON ie_aggregate_relations (organization_id, target_type, target_id);

COMMIT;
