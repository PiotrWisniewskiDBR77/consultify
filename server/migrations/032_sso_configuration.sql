-- Migration: 032_sso_configuration.sql
-- SSO / SAML 2.0 Configuration
-- Created: 2025-12-21

-- SSO configuration per organization
CREATE TABLE IF NOT EXISTS sso_configurations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,
    
    -- Provider info
    provider_type TEXT NOT NULL CHECK(provider_type IN ('saml', 'oidc', 'google', 'microsoft', 'okta', 'azure_ad')),
    provider_name TEXT, -- Human-friendly name
    
    -- SAML Configuration
    idp_entity_id TEXT,
    idp_sso_url TEXT,
    idp_slo_url TEXT, -- Single Logout URL
    idp_certificate TEXT, -- X.509 certificate
    
    -- OIDC Configuration (for non-SAML providers)
    client_id TEXT,
    client_secret_encrypted TEXT,
    authorization_url TEXT,
    token_url TEXT,
    userinfo_url TEXT,
    
    -- SP (Service Provider) Configuration
    sp_entity_id TEXT,
    sp_acs_url TEXT, -- Assertion Consumer Service URL
    sp_slo_url TEXT,
    
    -- Attribute mapping (JSON)
    attribute_mapping TEXT DEFAULT '{"email": "email", "firstName": "given_name", "lastName": "family_name"}',
    
    -- Policies
    enforce_sso INTEGER DEFAULT 0, -- Force SSO for all users
    allow_password_login INTEGER DEFAULT 1, -- Allow password as fallback
    auto_provision_users INTEGER DEFAULT 1, -- Create users on first SSO login
    default_role TEXT DEFAULT 'USER',
    
    -- Status
    is_active INTEGER DEFAULT 0,
    is_verified INTEGER DEFAULT 0,
    verified_at TEXT,
    
    -- Metadata
    metadata_url TEXT, -- IdP metadata URL for auto-configuration
    raw_metadata TEXT, -- Cached IdP metadata XML
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    created_by TEXT,
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sso_config_org ON sso_configurations(organization_id);
CREATE INDEX IF NOT EXISTS idx_sso_config_active ON sso_configurations(is_active) WHERE is_active = 1;

-- SSO sessions for tracking
CREATE TABLE IF NOT EXISTS sso_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    sso_config_id TEXT NOT NULL,
    
    -- Session info
    name_id TEXT, -- SAML NameID
    session_index TEXT, -- SAML SessionIndex for SLO
    
    -- Timestamps
    authenticated_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT,
    terminated_at TEXT,
    termination_reason TEXT,
    
    -- Request info
    ip_address TEXT,
    user_agent TEXT,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (sso_config_id) REFERENCES sso_configurations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sso_sessions_user ON sso_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sso_sessions_org ON sso_sessions(organization_id);

-- SSO login attempts (for troubleshooting)
CREATE TABLE IF NOT EXISTS sso_login_attempts (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    sso_config_id TEXT,
    
    -- Attempt details
    status TEXT NOT NULL CHECK(status IN ('pending', 'success', 'failed')),
    error_code TEXT,
    error_message TEXT,
    
    -- SAML info
    request_id TEXT,
    name_id TEXT,
    
    -- User created/matched
    user_id TEXT,
    user_created INTEGER DEFAULT 0,
    
    -- Request info
    ip_address TEXT,
    user_agent TEXT,
    
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sso_attempts_org ON sso_login_attempts(organization_id);
CREATE INDEX IF NOT EXISTS idx_sso_attempts_status ON sso_login_attempts(status);
