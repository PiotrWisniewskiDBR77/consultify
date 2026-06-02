-- V8 PM Sync Platform Truth — core governance primitives
-- WP-W1-PMSYNC-01: Auth states, provider depth, sync status, conflict vocabulary

-- Connector auth lifecycle tracking
CREATE TABLE IF NOT EXISTS v8_connector_auth_states (
  record_id         TEXT PRIMARY KEY,
  connector_id      TEXT NOT NULL,
  organization_id   TEXT NOT NULL,
  auth_state        TEXT NOT NULL CHECK (auth_state IN (
    'not_connected', 'connecting', 'connected_pending_verification',
    'healthy', 'degraded_reauth_needed', 'degraded_scope_limited',
    'suspended', 'disconnected'
  )),
  previous_state    TEXT,
  transitioned_at   TEXT NOT NULL DEFAULT (datetime('now')),
  transitioned_by   TEXT NOT NULL,
  reason            TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_conn_auth_org
  ON v8_connector_auth_states(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_conn_auth_connector
  ON v8_connector_auth_states(connector_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_conn_auth_transitioned
  ON v8_connector_auth_states(transitioned_at);

-- Provider tier and capability profiles
CREATE TABLE IF NOT EXISTS v8_provider_depth_profiles (
  profile_id        TEXT PRIMARY KEY,
  provider_id       TEXT NOT NULL,
  provider_name     TEXT NOT NULL,
  tier              TEXT NOT NULL CHECK (tier IN ('A', 'B', 'C', 'D')),
  parity_dimensions TEXT NOT NULL DEFAULT '[]',
  limitations       TEXT NOT NULL DEFAULT '[]',
  display_contract  TEXT NOT NULL,
  organization_id   TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_provider_depth_org
  ON v8_provider_depth_profiles(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_v8_provider_depth_provider_org
  ON v8_provider_depth_profiles(provider_id, organization_id);

-- Per-object sync health
CREATE TABLE IF NOT EXISTS v8_business_object_sync_states (
  sync_state_id     TEXT PRIMARY KEY,
  object_type       TEXT NOT NULL CHECK (object_type IN ('Task', 'Decision', 'InboxItem')),
  object_id         TEXT NOT NULL,
  connector_id      TEXT NOT NULL,
  organization_id   TEXT NOT NULL,
  sync_status       TEXT NOT NULL CHECK (sync_status IN (
    'synced', 'stale', 'pending', 'conflict', 'error', 'dead_letter', 'not_synced'
  )),
  last_synced_at    TEXT,
  stale_since       TEXT,
  error_class       TEXT CHECK (error_class IS NULL OR error_class IN (
    'auth_failure', 'permission_denied', 'provider_outage',
    'mapping_failure', 'business_conflict', 'rate_limited', 'target_not_found'
  )),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_obj_sync_org
  ON v8_business_object_sync_states(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_obj_sync_connector
  ON v8_business_object_sync_states(connector_id, organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_v8_obj_sync_object
  ON v8_business_object_sync_states(object_type, object_id, connector_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_obj_sync_status
  ON v8_business_object_sync_states(sync_status) WHERE sync_status IN ('conflict', 'error', 'dead_letter');

-- Conflict instances with resolution tracking
CREATE TABLE IF NOT EXISTS v8_conflict_records (
  conflict_id         TEXT PRIMARY KEY,
  object_sync_state_id TEXT NOT NULL,
  organization_id     TEXT NOT NULL,
  conflict_class      TEXT NOT NULL CHECK (conflict_class IN (
    'field_authority_conflict', 'concurrent_edit_conflict',
    'status_model_conflict', 'schema_mismatch_conflict',
    'deleted_externally_conflict', 'stale_snapshot_conflict',
    'custom_field_conflict'
  )),
  severity            TEXT NOT NULL CHECK (severity IN ('blocking', 'degraded', 'informational')),
  resolution_path     TEXT CHECK (resolution_path IS NULL OR resolution_path IN (
    'auto_resolve_by_authority', 'manual_review', 'remap',
    'replay_after_fix', 'dismiss', 'escalate'
  )),
  resolved_at         TEXT,
  resolved_by         TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_conflict_org
  ON v8_conflict_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_conflict_sync_state
  ON v8_conflict_records(object_sync_state_id);
CREATE INDEX IF NOT EXISTS idx_v8_conflict_unresolved
  ON v8_conflict_records(organization_id) WHERE resolved_at IS NULL;
