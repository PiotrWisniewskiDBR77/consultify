-- V8 PM Sync Auth Baseline — Wave 5 auth lifecycle hardening
-- WP-W5-EXT-01: Credential refs, refresh timing policies, admin re-bind audit

-- Encrypted credential references (NOT actual tokens — references only)
CREATE TABLE IF NOT EXISTS v8_connection_credentials (
  credential_id         TEXT PRIMARY KEY,
  connector_id          TEXT NOT NULL,
  organization_id       TEXT NOT NULL,
  provider_account_id   TEXT NOT NULL,
  workspace_or_tenant_id TEXT NOT NULL,
  scopes_granted        TEXT NOT NULL DEFAULT '[]',
  token_expires_at      TEXT,
  last_verification_at  TEXT,
  last_refresh_at       TEXT,
  last_refresh_result   TEXT CHECK (last_refresh_result IS NULL OR last_refresh_result IN (
    'success', 'transient_failure', 'credential_expired', 'scope_revoked'
  )),
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_conn_cred_org
  ON v8_connection_credentials(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_v8_conn_cred_connector_org
  ON v8_connection_credentials(connector_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_conn_cred_expires
  ON v8_connection_credentials(token_expires_at) WHERE token_expires_at IS NOT NULL;

-- Per-provider refresh timing policies
CREATE TABLE IF NOT EXISTS v8_refresh_timing_policies (
  policy_id                       TEXT PRIMARY KEY,
  provider_family                 TEXT NOT NULL CHECK (provider_family IN (
    'google_workspace', 'microsoft_365', 'atlassian',
    'asana', 'monday', 'clickup', 'linear'
  )),
  organization_id                 TEXT NOT NULL,
  typical_token_lifetime_minutes  INTEGER NOT NULL,
  refresh_window_minutes          INTEGER NOT NULL,
  max_retry_attempts              INTEGER NOT NULL DEFAULT 3,
  created_at                      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_refresh_policy_org
  ON v8_refresh_timing_policies(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_v8_refresh_policy_family_org
  ON v8_refresh_timing_policies(provider_family, organization_id);

-- Admin re-binding audit trail (Decision W5-1)
CREATE TABLE IF NOT EXISTS v8_admin_rebind_records (
  rebind_id           TEXT PRIMARY KEY,
  connector_id        TEXT NOT NULL,
  organization_id     TEXT NOT NULL,
  old_credential_ref  TEXT NOT NULL,
  new_credential_ref  TEXT NOT NULL,
  actor_id            TEXT NOT NULL,
  reason              TEXT NOT NULL,
  audit_timestamp     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_rebind_org
  ON v8_admin_rebind_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_rebind_connector_org
  ON v8_admin_rebind_records(connector_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_rebind_timestamp
  ON v8_admin_rebind_records(audit_timestamp);
