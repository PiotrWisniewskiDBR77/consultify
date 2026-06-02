-- P01 Integration: Per-workflow policy gates
-- Adds workflow-level pause/block with reason and policy type

CREATE TABLE IF NOT EXISTS integration_providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    provider_type TEXT DEFAULT 'generic',
    display_name TEXT,
    description TEXT,
    auth_type TEXT DEFAULT 'api_key',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider_id TEXT NOT NULL REFERENCES integration_providers(id),
    auth_type TEXT NOT NULL DEFAULT 'api_key',
    access_token TEXT,
    refresh_token TEXT,
    api_key TEXT,
    token_expires_at TIMESTAMP,
    external_account_id TEXT,
    external_account_name TEXT,
    external_workspace_id TEXT,
    external_workspace_name TEXT,
    settings TEXT DEFAULT '{}',
    notification_settings TEXT DEFAULT '{}',
    field_mappings TEXT DEFAULT '[]',
    sync_settings TEXT DEFAULT '{"direction":"bidirectional","frequency":"realtime"}',
    channel_mappings TEXT DEFAULT '[]',
    status TEXT DEFAULT 'active',
    last_sync_at TIMESTAMP,
    last_error TEXT,
    last_error_at TIMESTAMP,
    error_count INTEGER DEFAULT 0,
    consecutive_errors INTEGER DEFAULT 0,
    connected_by TEXT,
    connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    disconnected_at TIMESTAMP,
    disconnected_by TEXT,
    UNIQUE(organization_id, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_integrations_org ON integrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON integrations(provider_id);

ALTER TABLE integrations
  ADD COLUMN IF NOT EXISTS workflow_policy TEXT NOT NULL DEFAULT 'active'
    CHECK (workflow_policy IN ('active', 'paused', 'blocked', 'safety_gate'));

ALTER TABLE integrations
  ADD COLUMN IF NOT EXISTS workflow_policy_reason TEXT;

ALTER TABLE integrations
  ADD COLUMN IF NOT EXISTS workflow_policy_set_by TEXT;

ALTER TABLE integrations
  ADD COLUMN IF NOT EXISTS workflow_policy_set_at TIMESTAMPTZ;
