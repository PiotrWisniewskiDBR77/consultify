-- FLOW-SECURITY-001: Advanced Security (SSO & SCIM)
-- Migration: 258_advanced_security.sql

-- ==========================================
-- SSO CONFIGURATIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS sso_configurations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    
    -- Protocol
    protocol TEXT NOT NULL, -- 'saml', 'oidc'
    provider_name TEXT NOT NULL,
    provider_type TEXT NOT NULL, -- 'okta', 'azure_ad', 'google', 'onelogin', 'auth0', 'keycloak', 'custom'
    
    -- SAML config (JSON)
    saml_entity_id TEXT,
    saml_sso_url TEXT,
    saml_slo_url TEXT,
    saml_certificate TEXT,
    saml_signature_algorithm TEXT DEFAULT 'SHA256',
    saml_name_id_format TEXT DEFAULT 'emailAddress',
    
    -- OIDC config (encrypted in app layer)
    oidc_issuer TEXT,
    oidc_client_id TEXT,
    oidc_client_secret TEXT, -- Encrypted
    oidc_authorization_url TEXT,
    oidc_token_url TEXT,
    oidc_userinfo_url TEXT,
    oidc_scopes TEXT DEFAULT 'openid profile email',
    
    -- Attribute mappings (JSON)
    attribute_mappings TEXT DEFAULT '{"email":"email","firstName":"given_name","lastName":"family_name"}',
    
    -- Settings
    jit_provisioning INTEGER DEFAULT 1, -- Just-in-time user provisioning
    default_role TEXT DEFAULT 'user',
    group_mappings TEXT DEFAULT '[]', -- JSON: [{idpGroup, appRole}]
    
    -- Domains
    allowed_domains TEXT, -- JSON array of email domains
    
    -- Status
    is_enabled INTEGER DEFAULT 0,
    is_default INTEGER DEFAULT 0,
    
    -- Audit
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP,
    
    UNIQUE(organization_id, provider_name)
);

CREATE INDEX IF NOT EXISTS idx_sso_config_org ON sso_configurations(organization_id);
CREATE INDEX IF NOT EXISTS idx_sso_config_enabled ON sso_configurations(is_enabled);

-- ==========================================
-- SCIM CONFIGURATION
-- ==========================================

CREATE TABLE IF NOT EXISTS scim_configurations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,
    
    -- Token (hashed)
    bearer_token_hash TEXT NOT NULL,
    token_prefix TEXT NOT NULL, -- First 8 chars for identification
    
    -- Settings
    is_enabled INTEGER DEFAULT 1,
    sync_groups INTEGER DEFAULT 1,
    auto_deprovision INTEGER DEFAULT 0, -- Auto-deactivate removed users
    
    -- Rate limits
    rate_limit_per_minute INTEGER DEFAULT 100,
    
    -- Audit
    last_sync_at TIMESTAMP,
    total_users_synced INTEGER DEFAULT 0,
    total_groups_synced INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- SCIM SYNC LOG
-- ==========================================

CREATE TABLE IF NOT EXISTS scim_sync_log (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    
    -- Operation
    operation TEXT NOT NULL, -- 'create_user', 'update_user', 'delete_user', 'create_group', 'update_group', 'delete_group'
    resource_type TEXT NOT NULL, -- 'User', 'Group'
    
    -- Resource
    resource_id TEXT,
    external_id TEXT,
    
    -- Result
    status TEXT NOT NULL, -- 'success', 'error', 'skipped'
    error_message TEXT,
    
    -- Request/Response
    request_data TEXT, -- JSON
    response_data TEXT, -- JSON
    
    -- Client info
    client_ip TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scim_log_org ON scim_sync_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_scim_log_operation ON scim_sync_log(operation);
CREATE INDEX IF NOT EXISTS idx_scim_log_created ON scim_sync_log(created_at);

-- ==========================================
-- SESSION CONFIGURATIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS session_configurations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,
    
    -- Timeouts
    session_timeout_minutes INTEGER DEFAULT 480, -- 8 hours
    idle_timeout_minutes INTEGER DEFAULT 30,
    
    -- Concurrent sessions
    max_concurrent_sessions INTEGER DEFAULT 0, -- 0 = unlimited
    
    -- Re-authentication
    enforce_reauth_sensitive INTEGER DEFAULT 0,
    reauth_timeout_minutes INTEGER DEFAULT 15,
    
    -- IP binding
    bind_session_to_ip INTEGER DEFAULT 0,
    
    -- Remember me
    allow_remember_me INTEGER DEFAULT 1,
    remember_me_days INTEGER DEFAULT 30,
    
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- USER SESSIONS (enhanced)
-- ==========================================

CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    
    -- Tokens (hashed)
    session_token_hash TEXT NOT NULL,
    refresh_token_hash TEXT,
    
    -- Device info
    user_agent TEXT,
    browser TEXT,
    browser_version TEXT,
    os TEXT,
    os_version TEXT,
    device_type TEXT, -- 'desktop', 'mobile', 'tablet', 'unknown'
    device_name TEXT,
    
    -- Location
    ip_address TEXT,
    geo_country TEXT,
    geo_country_code TEXT,
    geo_city TEXT,
    geo_region TEXT,
    
    -- Authentication method
    auth_method TEXT DEFAULT 'password', -- 'password', 'sso', 'magic_link', 'api_key'
    sso_provider TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    
    -- Status
    is_active INTEGER DEFAULT 1,
    is_remember_me INTEGER DEFAULT 0,
    revoked_at TIMESTAMP,
    revoked_by TEXT,
    revoke_reason TEXT -- 'user_logout', 'admin_revoke', 'session_limit', 'password_change', 'security_concern'
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_org ON user_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON user_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);

-- ==========================================
-- IP WHITELIST
-- ==========================================

CREATE TABLE IF NOT EXISTS ip_whitelist (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    
    -- Rule
    rule_type TEXT NOT NULL, -- 'ip', 'cidr', 'range'
    rule_value TEXT NOT NULL, -- IP address, CIDR block, or "start-end"
    description TEXT,
    
    -- Enforcement
    is_enabled INTEGER DEFAULT 1,
    bypass_for_admins INTEGER DEFAULT 1,
    
    -- Audit
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ip_whitelist_org ON ip_whitelist(organization_id);
CREATE INDEX IF NOT EXISTS idx_ip_whitelist_enabled ON ip_whitelist(is_enabled);

-- ==========================================
-- SECURITY EVENTS
-- ==========================================

CREATE TABLE IF NOT EXISTS security_events (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    user_id TEXT,
    
    -- Event details
    event_type TEXT NOT NULL, 
    -- Types: 'login_success', 'login_failed', 'logout', 'session_created', 'session_revoked',
    --        'password_changed', 'password_reset_requested', 'mfa_enabled', 'mfa_disabled',
    --        'ip_blocked', 'suspicious_activity', 'api_key_created', 'api_key_revoked',
    --        'sso_login', 'scim_sync', 'admin_action'
    
    severity TEXT DEFAULT 'info', -- 'info', 'warning', 'critical'
    
    -- Context
    ip_address TEXT,
    user_agent TEXT,
    geo_location TEXT, -- JSON: {country, city, region}
    
    -- Details
    description TEXT,
    details TEXT, -- JSON with event-specific data
    
    -- Related entities
    target_type TEXT, -- 'user', 'session', 'api_key', 'sso_config'
    target_id TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_security_events_org ON security_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at);

-- ==========================================
-- MFA CONFIGURATIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS mfa_configurations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    
    -- TOTP
    totp_enabled INTEGER DEFAULT 0,
    totp_secret TEXT, -- Encrypted
    totp_verified_at TIMESTAMP,
    
    -- WebAuthn / Passkeys
    webauthn_enabled INTEGER DEFAULT 0,
    webauthn_credentials TEXT DEFAULT '[]', -- JSON array
    
    -- Backup codes
    backup_codes TEXT, -- JSON array (hashed)
    backup_codes_generated_at TIMESTAMP,
    backup_codes_used INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mfa_user ON mfa_configurations(user_id);

-- ==========================================
-- ORG SECURITY SETTINGS
-- ==========================================

CREATE TABLE IF NOT EXISTS org_security_settings (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,
    
    -- Password policy
    password_min_length INTEGER DEFAULT 8,
    password_require_uppercase INTEGER DEFAULT 1,
    password_require_lowercase INTEGER DEFAULT 1,
    password_require_number INTEGER DEFAULT 1,
    password_require_special INTEGER DEFAULT 0,
    password_expiry_days INTEGER DEFAULT 0, -- 0 = never
    password_history_count INTEGER DEFAULT 0, -- Prevent reuse of last N passwords
    
    -- MFA policy
    mfa_required INTEGER DEFAULT 0,
    mfa_required_for_admins INTEGER DEFAULT 0,
    
    -- Login policy
    max_login_attempts INTEGER DEFAULT 5,
    lockout_duration_minutes INTEGER DEFAULT 30,
    
    -- API
    api_keys_allowed INTEGER DEFAULT 1,
    api_key_max_age_days INTEGER DEFAULT 365,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_org_security_org ON org_security_settings(organization_id);
