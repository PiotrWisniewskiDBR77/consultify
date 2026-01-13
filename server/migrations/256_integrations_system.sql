-- FLOW-INTEGRATION-001: External Integrations
-- Migration: 256_integrations_system.sql

-- ==========================================
-- INTEGRATION PROVIDERS
-- ==========================================

CREATE TABLE IF NOT EXISTS integration_providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'communication', 'project_management', 'storage', 'crm', 'automation', 'bi'
    description TEXT,
    icon_url TEXT,
    auth_type TEXT NOT NULL, -- 'oauth2', 'api_key', 'webhook'
    oauth_config TEXT, -- JSON: {authUrl, tokenUrl, scopes, clientIdEnv, clientSecretEnv}
    webhook_config TEXT, -- JSON: webhook configuration
    is_active INTEGER DEFAULT 1,
    is_beta INTEGER DEFAULT 0,
    is_enterprise_only INTEGER DEFAULT 0,
    documentation_url TEXT,
    setup_guide_url TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed providers
INSERT OR IGNORE INTO integration_providers (id, name, display_name, category, description, auth_type, is_active, sort_order) VALUES
    -- Communication (P0)
    ('int-slack', 'slack', 'Slack', 'communication', 'Real-time notifications and decision requests in Slack', 'oauth2', 1, 1),
    ('int-teams', 'microsoft_teams', 'Microsoft Teams', 'communication', 'Notifications and collaboration in Teams', 'oauth2', 1, 2),
    
    -- Project Management (P0)
    ('int-jira', 'jira', 'Jira', 'project_management', 'Bi-directional sync with Jira issues', 'oauth2', 1, 10),
    ('int-asana', 'asana', 'Asana', 'project_management', 'Sync tasks with Asana', 'oauth2', 1, 11),
    ('int-monday', 'monday', 'Monday.com', 'project_management', 'Sync with Monday.com boards', 'oauth2', 1, 12),
    
    -- Google Workspace (P1)
    ('int-gdrive', 'google_drive', 'Google Drive', 'storage', 'Store files and reports in Google Drive', 'oauth2', 1, 20),
    ('int-gcalendar', 'google_calendar', 'Google Calendar', 'productivity', 'Sync deadlines and meetings', 'oauth2', 1, 21),
    
    -- Microsoft 365 (P1)
    ('int-onedrive', 'onedrive', 'OneDrive', 'storage', 'Store files in OneDrive/SharePoint', 'oauth2', 1, 30),
    ('int-outlook', 'outlook', 'Outlook Calendar', 'productivity', 'Sync with Outlook calendar', 'oauth2', 1, 31),
    
    -- Cloud Storage (P1)
    ('int-s3', 'aws_s3', 'AWS S3', 'storage', 'Store files in Amazon S3', 'api_key', 1, 40),
    ('int-azure-blob', 'azure_blob', 'Azure Blob Storage', 'storage', 'Store files in Azure', 'api_key', 1, 41),
    
    -- Automation (P2)
    ('int-zapier', 'zapier', 'Zapier', 'automation', 'Connect with 5000+ apps via Zapier', 'api_key', 1, 50),
    ('int-make', 'make', 'Make (Integromat)', 'automation', 'Advanced automation workflows', 'api_key', 1, 51),
    
    -- CRM (P2)
    ('int-salesforce', 'salesforce', 'Salesforce', 'crm', 'Sync with Salesforce CRM', 'oauth2', 0, 60),
    ('int-hubspot', 'hubspot', 'HubSpot', 'crm', 'Connect with HubSpot CRM', 'oauth2', 0, 61),
    
    -- BI (P2)
    ('int-powerbi', 'power_bi', 'Power BI', 'bi', 'Export data to Power BI', 'oauth2', 0, 70),
    ('int-tableau', 'tableau', 'Tableau', 'bi', 'Connect to Tableau dashboards', 'api_key', 0, 71);

-- Mark beta/enterprise
UPDATE integration_providers SET is_beta = 1 WHERE name IN ('salesforce', 'hubspot', 'power_bi', 'tableau');
UPDATE integration_providers SET is_enterprise_only = 1 WHERE name IN ('azure_blob', 'salesforce', 'power_bi', 'tableau');

-- ==========================================
-- ORGANIZATION INTEGRATIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    
    -- Authentication (encrypted in app layer)
    auth_type TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    api_key TEXT,
    token_expires_at TIMESTAMP,
    
    -- Provider-specific data
    external_account_id TEXT,
    external_account_name TEXT,
    external_workspace_id TEXT,
    external_workspace_name TEXT,
    
    -- Settings
    settings TEXT DEFAULT '{}', -- JSON: provider-specific settings
    notification_settings TEXT DEFAULT '{}', -- JSON: which events trigger notifications
    field_mappings TEXT DEFAULT '[]', -- JSON: field mapping config
    sync_settings TEXT DEFAULT '{"direction":"bidirectional","frequency":"realtime"}',
    
    -- Channel/Project mappings
    channel_mappings TEXT DEFAULT '[]', -- JSON: [{projectId, channelId/boardId}]
    
    -- Status
    status TEXT DEFAULT 'active', -- 'active', 'paused', 'error', 'disconnected'
    last_sync_at TIMESTAMP,
    last_error TEXT,
    last_error_at TIMESTAMP,
    error_count INTEGER DEFAULT 0,
    consecutive_errors INTEGER DEFAULT 0,
    
    -- Audit
    connected_by TEXT NOT NULL,
    connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    disconnected_at TIMESTAMP,
    disconnected_by TEXT,
    
    UNIQUE(organization_id, provider_id),
    FOREIGN KEY (provider_id) REFERENCES integration_providers(id)
);

CREATE INDEX IF NOT EXISTS idx_integrations_org ON integrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON integrations(provider_id);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON integrations(status);

-- ==========================================
-- INTEGRATION WEBHOOKS
-- ==========================================

CREATE TABLE IF NOT EXISTS integration_webhooks (
    id TEXT PRIMARY KEY,
    integration_id TEXT NOT NULL,
    
    -- Webhook config
    direction TEXT NOT NULL, -- 'inbound', 'outbound'
    webhook_url TEXT NOT NULL,
    webhook_secret TEXT,
    
    -- Events
    events TEXT NOT NULL, -- JSON array of event types
    
    -- Status
    is_active INTEGER DEFAULT 1,
    last_triggered_at TIMESTAMP,
    trigger_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    last_failure_at TIMESTAMP,
    last_failure_reason TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhooks_integration ON integration_webhooks(integration_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON integration_webhooks(is_active);

-- ==========================================
-- SYNC MAPPINGS
-- ==========================================

CREATE TABLE IF NOT EXISTS integration_sync_mappings (
    id TEXT PRIMARY KEY,
    integration_id TEXT NOT NULL,
    
    -- Local entity
    local_type TEXT NOT NULL, -- 'task', 'initiative', 'project', 'decision'
    local_id TEXT NOT NULL,
    
    -- External entity
    external_type TEXT NOT NULL, -- 'issue', 'task', 'card', 'message'
    external_id TEXT NOT NULL,
    external_url TEXT,
    
    -- Sync state
    last_local_update TIMESTAMP,
    last_external_update TIMESTAMP,
    last_sync_at TIMESTAMP,
    sync_status TEXT DEFAULT 'synced', -- 'synced', 'pending_push', 'pending_pull', 'conflict', 'error'
    conflict_data TEXT, -- JSON: conflict details
    
    -- Metadata
    metadata TEXT DEFAULT '{}', -- JSON: extra sync data
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(integration_id, local_type, local_id),
    UNIQUE(integration_id, external_type, external_id),
    FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sync_mappings_integration ON integration_sync_mappings(integration_id);
CREATE INDEX IF NOT EXISTS idx_sync_mappings_local ON integration_sync_mappings(local_type, local_id);
CREATE INDEX IF NOT EXISTS idx_sync_mappings_external ON integration_sync_mappings(external_type, external_id);
CREATE INDEX IF NOT EXISTS idx_sync_mappings_status ON integration_sync_mappings(sync_status);

-- ==========================================
-- SYNC LOG
-- ==========================================

CREATE TABLE IF NOT EXISTS integration_sync_log (
    id TEXT PRIMARY KEY,
    integration_id TEXT NOT NULL,
    
    -- Sync details
    sync_type TEXT NOT NULL, -- 'full', 'incremental', 'single_item', 'webhook'
    direction TEXT NOT NULL, -- 'push', 'pull', 'bidirectional'
    trigger_type TEXT DEFAULT 'scheduled', -- 'scheduled', 'manual', 'webhook', 'realtime'
    
    -- Results
    status TEXT NOT NULL, -- 'success', 'partial', 'failed'
    items_processed INTEGER DEFAULT 0,
    items_created INTEGER DEFAULT 0,
    items_updated INTEGER DEFAULT 0,
    items_deleted INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,
    items_skipped INTEGER DEFAULT 0,
    
    -- Errors
    error_summary TEXT,
    error_details TEXT, -- JSON array of errors
    
    -- Performance
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms INTEGER,
    
    FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sync_log_integration ON integration_sync_log(integration_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_status ON integration_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_sync_log_started ON integration_sync_log(started_at);

-- ==========================================
-- ZAPIER/MAKE API KEYS
-- ==========================================

CREATE TABLE IF NOT EXISTS integration_api_keys (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    
    -- Key details
    name TEXT NOT NULL,
    api_key_hash TEXT NOT NULL, -- Hashed key
    key_prefix TEXT NOT NULL, -- First 8 chars for identification
    
    -- Permissions
    permissions TEXT DEFAULT '["read","write"]', -- JSON array
    allowed_events TEXT DEFAULT '[]', -- JSON array of allowed trigger events
    allowed_actions TEXT DEFAULT '[]', -- JSON array of allowed actions
    
    -- Rate limiting
    rate_limit_per_minute INTEGER DEFAULT 60,
    rate_limit_per_day INTEGER DEFAULT 10000,
    
    -- Usage tracking
    last_used_at TIMESTAMP,
    request_count INTEGER DEFAULT 0,
    
    -- Status
    is_active INTEGER DEFAULT 1,
    expires_at TIMESTAMP,
    
    -- Audit
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP,
    revoked_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_api_keys_org ON integration_api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON integration_api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON integration_api_keys(is_active);
