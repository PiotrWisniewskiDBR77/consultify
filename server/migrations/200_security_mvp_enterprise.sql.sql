-- Migration: 200_security_mvp_enterprise.sql
-- Security MVP Enterprise - Full Enterprise Security Features
-- Date: 2026-01-02
-- 
-- Features:
-- - SCIM 2.0 Provisioning
-- - WebAuthn/Passkeys
-- - AI Budgets & Spending Controls
-- - Custom Roles (RBAC)
-- - Enhanced Audit Logs
-- - Azure AD SSO Extensions

-- ============================================================
-- SECTION 1: SCIM 2.0 PROVISIONING TABLES
-- ============================================================

-- SCIM Service Provider Configuration
CREATE TABLE IF NOT EXISTS scim_service_providers (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,
    
    -- Endpoint configuration
    base_url TEXT NOT NULL,
    
    -- Authentication
    auth_type TEXT DEFAULT 'bearer' CHECK(auth_type IN ('bearer', 'basic', 'oauth2')),
    
    -- Supported features
    patch_supported INTEGER DEFAULT 1,
    bulk_supported INTEGER DEFAULT 0,
    bulk_max_operations INTEGER DEFAULT 1000,
    bulk_max_payload_size INTEGER DEFAULT 1048576,
    filter_supported INTEGER DEFAULT 1,
    change_password_supported INTEGER DEFAULT 0,
    sort_supported INTEGER DEFAULT 0,
    etag_supported INTEGER DEFAULT 0,
    
    -- Schemas supported
    schemas_supported TEXT DEFAULT '["urn:ietf:params:scim:schemas:core:2.0:User","urn:ietf:params:scim:schemas:core:2.0:Group"]',
    
    -- Status
    is_active INTEGER DEFAULT 1,
    last_sync_at TEXT,
    sync_status TEXT DEFAULT 'pending' CHECK(sync_status IN ('pending', 'syncing', 'success', 'error')),
    sync_error TEXT,
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scim_sp_org ON scim_service_providers(organization_id);

-- SCIM Bearer Tokens
CREATE TABLE IF NOT EXISTS scim_tokens (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    
    -- Token info
    name TEXT NOT NULL,
    description TEXT,
    token_hash TEXT NOT NULL, -- bcrypt hash of the token
    token_prefix TEXT NOT NULL, -- first 8 chars for identification
    
    -- Permissions
    scopes TEXT DEFAULT '["users:read","users:write","groups:read","groups:write"]',
    
    -- Usage tracking
    last_used_at TEXT,
    usage_count INTEGER DEFAULT 0,
    
    -- Expiration
    expires_at TEXT,
    
    -- Status
    is_active INTEGER DEFAULT 1,
    revoked_at TEXT,
    revoked_by TEXT,
    
    created_at TEXT DEFAULT (datetime('now')),
    created_by TEXT,
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (revoked_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_scim_tokens_org ON scim_tokens(organization_id);
CREATE INDEX IF NOT EXISTS idx_scim_tokens_prefix ON scim_tokens(token_prefix);
CREATE INDEX IF NOT EXISTS idx_scim_tokens_hash ON scim_tokens(token_hash);

-- SCIM Sync Logs
CREATE TABLE IF NOT EXISTS scim_sync_logs (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    scim_token_id TEXT,
    
    -- Operation info
    operation TEXT NOT NULL CHECK(operation IN ('CREATE', 'UPDATE', 'DELETE', 'PATCH', 'BULK')),
    resource_type TEXT NOT NULL CHECK(resource_type IN ('User', 'Group')),
    resource_id TEXT,
    external_id TEXT, -- ID from IdP
    
    -- Request/Response
    request_body TEXT, -- JSON
    response_status INTEGER,
    response_body TEXT, -- JSON
    
    -- Result
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'success', 'error')),
    error_message TEXT,
    error_code TEXT,
    
    -- Metadata
    ip_address TEXT,
    user_agent TEXT,
    
    created_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (scim_token_id) REFERENCES scim_tokens(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_scim_logs_org ON scim_sync_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_scim_logs_resource ON scim_sync_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_scim_logs_status ON scim_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_scim_logs_created ON scim_sync_logs(created_at);

-- SCIM Group Mappings (map external groups to internal roles)
CREATE TABLE IF NOT EXISTS scim_group_mappings (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    
    -- External group info
    external_group_id TEXT NOT NULL,
    external_group_name TEXT NOT NULL,
    
    -- Internal mapping
    internal_role TEXT NOT NULL, -- Role to assign users in this group
    custom_role_id TEXT, -- If using custom roles
    
    -- Status
    is_active INTEGER DEFAULT 1,
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (custom_role_id) REFERENCES custom_roles(id) ON DELETE SET NULL,
    UNIQUE(organization_id, external_group_id)
);

CREATE INDEX IF NOT EXISTS idx_scim_group_mappings_org ON scim_group_mappings(organization_id);
CREATE INDEX IF NOT EXISTS idx_scim_group_mappings_external ON scim_group_mappings(external_group_id);

-- SCIM User External IDs
CREATE TABLE IF NOT EXISTS scim_user_mappings (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    
    -- External IDs
    scim_id TEXT NOT NULL, -- SCIM resource ID
    external_id TEXT, -- externalId from IdP
    
    -- Sync metadata
    last_synced_at TEXT,
    sync_source TEXT DEFAULT 'idp' CHECK(sync_source IN ('idp', 'manual')),
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(organization_id, user_id),
    UNIQUE(organization_id, scim_id)
);

CREATE INDEX IF NOT EXISTS idx_scim_user_mappings_org ON scim_user_mappings(organization_id);
CREATE INDEX IF NOT EXISTS idx_scim_user_mappings_user ON scim_user_mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_scim_user_mappings_scim ON scim_user_mappings(scim_id);

-- ============================================================
-- SECTION 2: WEBAUTHN / PASSKEYS TABLES
-- ============================================================

-- WebAuthn Credentials
CREATE TABLE IF NOT EXISTS webauthn_credentials (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    
    -- Credential info
    credential_id TEXT NOT NULL UNIQUE, -- Base64URL encoded
    public_key TEXT NOT NULL, -- COSE key in base64
    
    -- Authenticator info
    aaguid TEXT, -- Authenticator Attestation GUID
    sign_count INTEGER DEFAULT 0,
    transports TEXT, -- JSON array: ['usb', 'nfc', 'ble', 'internal']
    
    -- Attestation
    attestation_type TEXT DEFAULT 'none', -- 'none', 'direct', 'indirect', 'enterprise'
    attestation_format TEXT, -- 'packed', 'tpm', 'android-key', etc.
    
    -- Device info
    device_name TEXT,
    device_type TEXT DEFAULT 'unknown' CHECK(device_type IN ('platform', 'cross-platform', 'unknown')),
    
    -- Backup eligibility (for passkeys)
    backup_eligible INTEGER DEFAULT 0,
    backup_state INTEGER DEFAULT 0,
    
    -- Usage
    last_used_at TEXT,
    usage_count INTEGER DEFAULT 0,
    
    -- Status
    is_active INTEGER DEFAULT 1,
    revoked_at TEXT,
    revoked_reason TEXT,
    
    created_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webauthn_creds_user ON webauthn_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_creds_credential ON webauthn_credentials(credential_id);
-- Drop index if it exists (may have been created with old INTEGER column type)
DROP INDEX IF EXISTS idx_webauthn_creds_active;
-- Recreate index - cast to boolean to handle both INTEGER and BOOLEAN column types
CREATE INDEX idx_webauthn_creds_active ON webauthn_credentials(is_active) WHERE (is_active::boolean) = TRUE;

-- WebAuthn Challenges (for registration and authentication)
CREATE TABLE IF NOT EXISTS webauthn_challenges (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    
    -- Challenge data
    challenge TEXT NOT NULL, -- Base64URL encoded
    challenge_type TEXT NOT NULL CHECK(challenge_type IN ('registration', 'authentication')),
    
    -- RP info
    rp_id TEXT NOT NULL,
    rp_name TEXT,
    
    -- User verification requirement
    user_verification TEXT DEFAULT 'preferred' CHECK(user_verification IN ('required', 'preferred', 'discouraged')),
    
    -- For registration
    attestation TEXT DEFAULT 'none' CHECK(attestation IN ('none', 'direct', 'indirect', 'enterprise')),
    authenticator_selection TEXT, -- JSON
    
    -- For authentication
    allowed_credentials TEXT, -- JSON array of credential IDs
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'used', 'expired')),
    
    -- Expiration
    expires_at TEXT NOT NULL,
    
    created_at TEXT DEFAULT (datetime('now')),
    used_at TEXT,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_user ON webauthn_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_status ON webauthn_challenges(status);
CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_expires ON webauthn_challenges(expires_at);

-- ============================================================
-- SECTION 3: AI BUDGETS & SPENDING CONTROLS
-- ============================================================

-- AI Budgets per Organization/User
CREATE TABLE IF NOT EXISTS ai_budgets (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT, -- null = org-level budget
    
    -- Budget type
    budget_type TEXT NOT NULL CHECK(budget_type IN ('tokens', 'cost', 'requests')),
    
    -- Period
    period TEXT NOT NULL CHECK(period IN ('daily', 'weekly', 'monthly', 'yearly', 'total')),
    period_start TEXT, -- For custom periods
    period_end TEXT,
    
    -- Limits
    budget_limit REAL NOT NULL,
    warning_threshold REAL DEFAULT 0.8, -- 80% warning
    hard_limit INTEGER DEFAULT 1, -- Block when exceeded
    
    -- Current usage
    current_usage REAL DEFAULT 0,
    last_reset_at TEXT,
    
    -- Status
    is_active INTEGER DEFAULT 1,
    exceeded_at TEXT, -- When budget was exceeded
    
    -- Rollover
    rollover_enabled INTEGER DEFAULT 0,
    rollover_percentage REAL DEFAULT 0, -- % of unused to rollover
    rollover_amount REAL DEFAULT 0, -- Amount carried over
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    created_by TEXT,
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_budgets_org ON ai_budgets(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_budgets_user ON ai_budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_budgets_type ON ai_budgets(budget_type);
-- Drop index if it exists (may have been created with old INTEGER column type)
DROP INDEX IF EXISTS idx_ai_budgets_active;
-- Recreate index - cast to boolean to handle both INTEGER and BOOLEAN column types
CREATE INDEX idx_ai_budgets_active ON ai_budgets(is_active) WHERE (is_active::boolean) = TRUE;

-- AI Spending Alerts
CREATE TABLE IF NOT EXISTS ai_spending_alerts (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT,
    budget_id TEXT,
    
    -- Alert type
    alert_type TEXT NOT NULL CHECK(alert_type IN ('warning', 'exceeded', 'anomaly', 'spike')),
    
    -- Alert details
    title TEXT NOT NULL,
    message TEXT,
    
    -- Threshold info
    threshold_value REAL,
    current_value REAL,
    percentage REAL,
    
    -- Status
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'acknowledged', 'resolved', 'dismissed')),
    acknowledged_at TEXT,
    acknowledged_by TEXT,
    
    -- Notifications
    notification_sent INTEGER DEFAULT 0,
    notification_channels TEXT DEFAULT '["email"]', -- JSON array
    
    created_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (budget_id) REFERENCES ai_budgets(id) ON DELETE SET NULL,
    FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_spending_alerts_org ON ai_spending_alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_spending_alerts_status ON ai_spending_alerts(status);
CREATE INDEX IF NOT EXISTS idx_ai_spending_alerts_type ON ai_spending_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_ai_spending_alerts_created ON ai_spending_alerts(created_at);

-- AI Model Permissions (which models users can access)
CREATE TABLE IF NOT EXISTS ai_model_permissions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    
    -- Scope
    scope_type TEXT NOT NULL CHECK(scope_type IN ('organization', 'role', 'user')),
    scope_id TEXT NOT NULL, -- org_id, role_id, or user_id
    
    -- Model
    model_id TEXT NOT NULL, -- e.g., 'gpt-4', 'claude-3-opus'
    model_provider TEXT NOT NULL, -- 'openai', 'anthropic', 'google'
    
    -- Permissions
    is_allowed INTEGER DEFAULT 1, -- Allow or deny
    max_tokens_per_request INTEGER,
    daily_token_limit INTEGER,
    
    -- Priority (higher = takes precedence)
    priority INTEGER DEFAULT 0,
    
    -- Status
    is_active INTEGER DEFAULT 1,
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    created_by TEXT,
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(organization_id, scope_type, scope_id, model_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_model_perms_org ON ai_model_permissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_model_perms_scope ON ai_model_permissions(scope_type, scope_id);
CREATE INDEX IF NOT EXISTS idx_ai_model_perms_model ON ai_model_permissions(model_id);

-- ============================================================
-- SECTION 4: CUSTOM ROLES (RBAC)
-- ============================================================

-- Permission Definitions (all available permissions)
CREATE TABLE IF NOT EXISTS permission_definitions (
    id TEXT PRIMARY KEY,
    
    -- Permission info
    name TEXT NOT NULL UNIQUE, -- e.g., 'projects:read', 'users:write'
    display_name TEXT NOT NULL,
    description TEXT,
    
    -- Category for UI grouping
    category TEXT NOT NULL, -- 'projects', 'users', 'settings', 'billing', etc.
    
    -- Permission type
    permission_type TEXT DEFAULT 'resource' CHECK(permission_type IN ('resource', 'action', 'feature')),
    
    -- Resource and action
    resource TEXT, -- 'projects', 'users', 'assessments'
    action TEXT, -- 'read', 'write', 'delete', 'admin'
    
    -- Dependencies
    requires TEXT, -- JSON array of required permission IDs
    implied_by TEXT, -- JSON array of permissions that imply this one
    
    -- Risk level
    risk_level TEXT DEFAULT 'low' CHECK(risk_level IN ('low', 'medium', 'high', 'critical')),
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_system BOOLEAN DEFAULT TRUE, -- System permissions can't be deleted
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_permission_defs_name ON permission_definitions(name);
CREATE INDEX IF NOT EXISTS idx_permission_defs_category ON permission_definitions(category);
CREATE INDEX IF NOT EXISTS idx_permission_defs_resource ON permission_definitions(resource);

-- Custom Roles
CREATE TABLE IF NOT EXISTS custom_roles (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    
    -- Role info
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#6366f1', -- For UI display
    icon TEXT DEFAULT 'shield', -- Lucide icon name
    
    -- Base role (inherits permissions)
    base_role TEXT, -- 'viewer', 'member', 'admin', or custom_role_id
    
    -- Type
    role_type TEXT DEFAULT 'custom' CHECK(role_type IN ('system', 'custom', 'template')),
    
    -- Scope
    scope TEXT DEFAULT 'organization' CHECK(scope IN ('organization', 'project', 'global')),
    
    -- Priority (for conflict resolution)
    priority INTEGER DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE, -- Default role for new users
    
    -- Metadata
    user_count INTEGER DEFAULT 0, -- Cached count
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    created_by TEXT,
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_custom_roles_org ON custom_roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_custom_roles_name ON custom_roles(name);
-- Drop index if it exists (may have been created with old INTEGER column type)
DROP INDEX IF EXISTS idx_custom_roles_active;
-- Recreate index - cast to boolean to handle both INTEGER and BOOLEAN column types
CREATE INDEX idx_custom_roles_active ON custom_roles(is_active) WHERE (is_active::boolean) = TRUE;

-- Role Permissions (M:M between roles and permissions)
CREATE TABLE IF NOT EXISTS role_permissions (
    id TEXT PRIMARY KEY,
    role_id TEXT NOT NULL,
    permission_id TEXT NOT NULL,
    
    -- Override type
    grant_type TEXT DEFAULT 'allow' CHECK(grant_type IN ('allow', 'deny')),
    
    -- Conditions (JSON)
    conditions TEXT, -- e.g., {"own_resources_only": true}
    
    created_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (role_id) REFERENCES custom_roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permission_definitions(id) ON DELETE CASCADE,
    UNIQUE(role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_perms_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_perms_permission ON role_permissions(permission_id);

-- User Role Assignments
CREATE TABLE IF NOT EXISTS user_role_assignments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    
    -- Scope (for project-level roles)
    scope_type TEXT DEFAULT 'organization' CHECK(scope_type IN ('organization', 'project')),
    scope_id TEXT, -- project_id if scope_type = 'project'
    
    -- Validity
    valid_from TEXT DEFAULT (datetime('now')),
    valid_until TEXT, -- null = permanent
    
    -- Status
    is_active INTEGER DEFAULT 1,
    
    -- Audit
    assigned_by TEXT,
    assigned_reason TEXT,
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES custom_roles(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_user_role_assign_user ON user_role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assign_role ON user_role_assignments(role_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assign_org ON user_role_assignments(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assign_active ON user_role_assignments(is_active) WHERE is_active = 1;

-- ============================================================
-- SECTION 5: ENHANCED AUDIT LOGS
-- ============================================================

-- Audit Log Integrity (for tamper detection)
CREATE TABLE IF NOT EXISTS audit_log_integrity (
    id TEXT PRIMARY KEY,
    
    -- Block info
    block_number INTEGER NOT NULL,
    block_start_id TEXT NOT NULL,
    block_end_id TEXT NOT NULL,
    entry_count INTEGER NOT NULL,
    
    -- Hashes
    entries_hash TEXT NOT NULL, -- Hash of all entries in block
    previous_block_hash TEXT, -- Hash of previous block (blockchain-style)
    block_hash TEXT NOT NULL, -- Hash of this block including previous_block_hash
    
    -- Metadata
    block_created_at TEXT DEFAULT (datetime('now')),
    verification_status TEXT DEFAULT 'valid' CHECK(verification_status IN ('valid', 'invalid', 'pending')),
    last_verified_at TEXT,
    
    UNIQUE(block_number)
);

CREATE INDEX IF NOT EXISTS idx_audit_integrity_block ON audit_log_integrity(block_number);
CREATE INDEX IF NOT EXISTS idx_audit_integrity_status ON audit_log_integrity(verification_status);

-- Audit Exports
CREATE TABLE IF NOT EXISTS audit_exports (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    
    -- Export info
    export_type TEXT NOT NULL CHECK(export_type IN ('csv', 'json', 'pdf')),
    date_range_start TEXT,
    date_range_end TEXT,
    filters TEXT, -- JSON
    
    -- File info
    file_path TEXT,
    file_size INTEGER,
    file_hash TEXT, -- SHA256 for integrity
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
    error_message TEXT,
    
    -- Download tracking
    download_count INTEGER DEFAULT 0,
    last_downloaded_at TEXT,
    expires_at TEXT,
    
    created_at TEXT DEFAULT (datetime('now')),
    created_by TEXT,
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_exports_org ON audit_exports(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_exports_status ON audit_exports(status);
CREATE INDEX IF NOT EXISTS idx_audit_exports_created ON audit_exports(created_at);

-- ============================================================
-- SECTION 6: EXTENSIONS TO EXISTING TABLES
-- ============================================================

-- Note: ALTER TABLE ADD COLUMN IF NOT EXISTS is not supported in older SQLite
-- These columns will be added via JavaScript migration runner if tables exist
-- The following are documented for reference:
-- ALTER TABLE sso_configurations ADD COLUMN tenant_id TEXT;
-- ALTER TABLE sso_configurations ADD COLUMN scim_enabled INTEGER DEFAULT 0;
-- ALTER TABLE sso_configurations ADD COLUMN scim_token_id TEXT;
-- ALTER TABLE api_webhooks ADD COLUMN signing_secret_encrypted TEXT;
-- ALTER TABLE api_webhooks ADD COLUMN headers TEXT;
-- ALTER TABLE api_webhooks ADD COLUMN filters TEXT;

-- ============================================================
-- SECTION 7: SEED DATA - PERMISSION DEFINITIONS
-- ============================================================

-- Insert default permission definitions
INSERT INTO permission_definitions (id, name, display_name, description, category, resource, action, risk_level, is_system) VALUES
-- Projects
('perm_projects_read', 'projects:read', 'View Projects', 'View project details and contents', 'Projects', 'projects', 'read', 'low', TRUE),
('perm_projects_write', 'projects:write', 'Edit Projects', 'Create and edit projects', 'Projects', 'projects', 'write', 'medium', TRUE),
('perm_projects_delete', 'projects:delete', 'Delete Projects', 'Delete projects', 'Projects', 'projects', 'delete', 'high', TRUE),
('perm_projects_admin', 'projects:admin', 'Manage Projects', 'Full project administration', 'Projects', 'projects', 'admin', 'high', TRUE),

-- Users
('perm_users_read', 'users:read', 'View Users', 'View user profiles', 'Users', 'users', 'read', 'low', TRUE),
('perm_users_write', 'users:write', 'Edit Users', 'Edit user profiles', 'Users', 'users', 'write', 'medium', TRUE),
('perm_users_delete', 'users:delete', 'Delete Users', 'Delete user accounts', 'Users', 'users', 'delete', 'critical', TRUE),
('perm_users_invite', 'users:invite', 'Invite Users', 'Invite new users', 'Users', 'users', 'invite', 'medium', TRUE),
('perm_users_admin', 'users:admin', 'Manage Users', 'Full user administration', 'Users', 'users', 'admin', 'critical', TRUE),

-- Assessments
('perm_assessments_read', 'assessments:read', 'View Assessments', 'View assessment data', 'Assessments', 'assessments', 'read', 'low', TRUE),
('perm_assessments_write', 'assessments:write', 'Edit Assessments', 'Create and edit assessments', 'Assessments', 'assessments', 'write', 'medium', TRUE),
('perm_assessments_delete', 'assessments:delete', 'Delete Assessments', 'Delete assessments', 'Assessments', 'assessments', 'delete', 'high', TRUE),

-- Initiatives
('perm_initiatives_read', 'initiatives:read', 'View Initiatives', 'View initiatives', 'Initiatives', 'initiatives', 'read', 'low', TRUE),
('perm_initiatives_write', 'initiatives:write', 'Edit Initiatives', 'Create and edit initiatives', 'Initiatives', 'initiatives', 'write', 'medium', TRUE),
('perm_initiatives_delete', 'initiatives:delete', 'Delete Initiatives', 'Delete initiatives', 'Initiatives', 'initiatives', 'delete', 'high', TRUE),
('perm_initiatives_approve', 'initiatives:approve', 'Approve Initiatives', 'Approve initiative workflows', 'Initiatives', 'initiatives', 'approve', 'high', TRUE),

-- Tasks
('perm_tasks_read', 'tasks:read', 'View Tasks', 'View tasks', 'Tasks', 'tasks', 'read', 'low', TRUE),
('perm_tasks_write', 'tasks:write', 'Edit Tasks', 'Create and edit tasks', 'Tasks', 'tasks', 'write', 'low', TRUE),
('perm_tasks_delete', 'tasks:delete', 'Delete Tasks', 'Delete tasks', 'Tasks', 'tasks', 'delete', 'medium', TRUE),
('perm_tasks_assign', 'tasks:assign', 'Assign Tasks', 'Assign tasks to users', 'Tasks', 'tasks', 'assign', 'low', TRUE),

-- Reports
('perm_reports_read', 'reports:read', 'View Reports', 'View reports', 'Reports', 'reports', 'read', 'low', TRUE),
('perm_reports_write', 'reports:write', 'Create Reports', 'Create and edit reports', 'Reports', 'reports', 'write', 'medium', TRUE),
('perm_reports_export', 'reports:export', 'Export Reports', 'Export reports to PDF/Excel', 'Reports', 'reports', 'export', 'medium', TRUE),
('perm_reports_share', 'reports:share', 'Share Reports', 'Share reports externally', 'Reports', 'reports', 'share', 'high', TRUE),

-- AI Features
('perm_ai_chat', 'ai:chat', 'AI Chat', 'Use AI chat features', 'AI', 'ai', 'chat', 'low', TRUE),
('perm_ai_generate', 'ai:generate', 'AI Generation', 'Use AI content generation', 'AI', 'ai', 'generate', 'medium', TRUE),
('perm_ai_analyze', 'ai:analyze', 'AI Analysis', 'Use AI analysis features', 'AI', 'ai', 'analyze', 'medium', TRUE),
('perm_ai_admin', 'ai:admin', 'AI Administration', 'Manage AI settings and budgets', 'AI', 'ai', 'admin', 'high', TRUE),

-- Settings
('perm_settings_read', 'settings:read', 'View Settings', 'View organization settings', 'Settings', 'settings', 'read', 'low', TRUE),
('perm_settings_write', 'settings:write', 'Edit Settings', 'Edit organization settings', 'Settings', 'settings', 'write', 'high', TRUE),

-- Security
('perm_security_read', 'security:read', 'View Security', 'View security settings and logs', 'Security', 'security', 'read', 'medium', TRUE),
('perm_security_write', 'security:write', 'Edit Security', 'Edit security settings', 'Security', 'security', 'write', 'critical', TRUE),
('perm_security_audit', 'security:audit', 'Audit Access', 'Access audit logs', 'Security', 'security', 'audit', 'high', TRUE),

-- Billing
('perm_billing_read', 'billing:read', 'View Billing', 'View billing information', 'Billing', 'billing', 'read', 'medium', TRUE),
('perm_billing_write', 'billing:write', 'Manage Billing', 'Manage billing and subscriptions', 'Billing', 'billing', 'write', 'critical', TRUE),

-- Integrations
('perm_integrations_read', 'integrations:read', 'View Integrations', 'View integrations', 'Integrations', 'integrations', 'read', 'low', TRUE),
('perm_integrations_write', 'integrations:write', 'Manage Integrations', 'Configure integrations', 'Integrations', 'integrations', 'write', 'high', TRUE),

-- Roles
('perm_roles_read', 'roles:read', 'View Roles', 'View role definitions', 'Roles', 'roles', 'read', 'low', TRUE),
('perm_roles_write', 'roles:write', 'Manage Roles', 'Create and edit roles', 'Roles', 'roles', 'write', 'critical', TRUE),
('perm_roles_assign', 'roles:assign', 'Assign Roles', 'Assign roles to users', 'Roles', 'roles', 'assign', 'high', TRUE)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- SECTION 8: TRIGGERS
-- ============================================================

-- Update ai_budgets timestamp
CREATE TRIGGER IF NOT EXISTS trg_ai_budgets_updated
    AFTER UPDATE ON ai_budgets
    FOR EACH ROW
BEGIN
    UPDATE ai_budgets SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Update custom_roles timestamp
CREATE TRIGGER IF NOT EXISTS trg_custom_roles_updated
    AFTER UPDATE ON custom_roles
    FOR EACH ROW
BEGIN
    UPDATE custom_roles SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Update scim_group_mappings timestamp
CREATE TRIGGER IF NOT EXISTS trg_scim_group_mappings_updated
    AFTER UPDATE ON scim_group_mappings
    FOR EACH ROW
BEGIN
    UPDATE scim_group_mappings SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Update scim_service_providers timestamp
CREATE TRIGGER IF NOT EXISTS trg_scim_sp_updated
    AFTER UPDATE ON scim_service_providers
    FOR EACH ROW
BEGIN
    UPDATE scim_service_providers SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================

