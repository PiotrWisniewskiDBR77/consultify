-- V8 Operator/Admin Surfaces — core governance primitives
-- WP-W5-EXT-03: Fleet health, connector packages (W5-9), support notes (W5-10), emergency pause (W5-11)

-- Connector fleet health entries
CREATE TABLE IF NOT EXISTS v8_connector_fleet_health (
  entry_id            TEXT PRIMARY KEY,
  connector_id        TEXT NOT NULL,
  organization_id     TEXT NOT NULL,
  provider_key        TEXT NOT NULL,
  auth_state          TEXT NOT NULL CHECK (auth_state IN (
    'not_connected', 'connecting', 'connected_pending_verification',
    'healthy', 'degraded_reauth_needed', 'degraded_scope_limited',
    'suspended', 'disconnected'
  )),
  provider_tier       TEXT NOT NULL CHECK (provider_tier IN ('A', 'B', 'C', 'D')),
  last_sync_success   TEXT,
  last_sync_failure   TEXT,
  staleness_indicator REAL NOT NULL DEFAULT 0,
  drift_state         TEXT NOT NULL DEFAULT 'none' CHECK (drift_state IN (
    'none', 'schema', 'mapping', 'auth', 'policy'
  )),
  dead_letter_count   INTEGER NOT NULL DEFAULT 0,
  conflict_count      INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_fleet_health_org
  ON v8_connector_fleet_health(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_v8_fleet_health_connector_org
  ON v8_connector_fleet_health(connector_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_fleet_health_auth_state
  ON v8_connector_fleet_health(auth_state) WHERE auth_state IN ('degraded_reauth_needed', 'degraded_scope_limited', 'suspended');
CREATE INDEX IF NOT EXISTS idx_v8_fleet_health_drift
  ON v8_connector_fleet_health(drift_state) WHERE drift_state != 'none';

-- Connector packages — platform-managed assets (Decision W5-9)
CREATE TABLE IF NOT EXISTS v8_connector_packages (
  package_id          TEXT PRIMARY KEY,
  provider_key        TEXT NOT NULL,
  package_version     TEXT NOT NULL,
  capabilities        TEXT NOT NULL DEFAULT '[]',
  lifecycle_state     TEXT NOT NULL DEFAULT 'draft' CHECK (lifecycle_state IN (
    'draft', 'published', 'deprecated', 'retired'
  )),
  tenant_installable  INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_packages_provider
  ON v8_connector_packages(provider_key);
CREATE INDEX IF NOT EXISTS idx_v8_packages_lifecycle
  ON v8_connector_packages(lifecycle_state);
CREATE UNIQUE INDEX IF NOT EXISTS idx_v8_packages_provider_version
  ON v8_connector_packages(provider_key, package_version);

-- Tenant connector installations
CREATE TABLE IF NOT EXISTS v8_tenant_connector_installations (
  installation_id     TEXT PRIMARY KEY,
  package_id          TEXT NOT NULL,
  organization_id     TEXT NOT NULL,
  enabled_by          TEXT NOT NULL,
  configuration_scope TEXT NOT NULL,
  installed_at        TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (package_id) REFERENCES v8_connector_packages(package_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_installations_org
  ON v8_tenant_connector_installations(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_installations_package
  ON v8_tenant_connector_installations(package_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_v8_installations_package_org
  ON v8_tenant_connector_installations(package_id, organization_id);

-- Support notes — durable, incident-scoped (Decision W5-10)
CREATE TABLE IF NOT EXISTS v8_support_notes (
  note_id             TEXT PRIMARY KEY,
  incident_ref        TEXT NOT NULL,
  connector_id        TEXT NOT NULL,
  organization_id     TEXT NOT NULL,
  author_id           TEXT NOT NULL,
  author_role         TEXT NOT NULL CHECK (author_role IN ('support', 'operator')),
  content             TEXT NOT NULL,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_support_notes_org
  ON v8_support_notes(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_support_notes_connector_org
  ON v8_support_notes(connector_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_support_notes_incident
  ON v8_support_notes(incident_ref);

-- Emergency pauses — tenant-scoped (Decision W5-11)
CREATE TABLE IF NOT EXISTS v8_emergency_pauses (
  pause_id            TEXT PRIMARY KEY,
  organization_id     TEXT NOT NULL,
  pause_scope         TEXT NOT NULL CHECK (pause_scope IN ('all_connectors', 'provider_type')),
  provider_key        TEXT,
  paused_by           TEXT NOT NULL,
  reason              TEXT NOT NULL,
  blast_radius        INTEGER NOT NULL DEFAULT 0,
  paused_at           TEXT NOT NULL DEFAULT (datetime('now')),
  resumed_at          TEXT,
  resumed_by          TEXT
);

CREATE INDEX IF NOT EXISTS idx_v8_emergency_pauses_org
  ON v8_emergency_pauses(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_emergency_pauses_active
  ON v8_emergency_pauses(organization_id) WHERE resumed_at IS NULL;
