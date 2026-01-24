-- SSO/SCIM configuration storage
CREATE TABLE IF NOT EXISTS sso_configs (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    provider TEXT NOT NULL, -- google | saml | oidc
    status TEXT NOT NULL DEFAULT 'active', -- active | inactive
    client_id TEXT,
    client_secret TEXT,
    redirect_uri TEXT,
    acs_url TEXT,
    entity_id TEXT,
    domains TEXT, -- JSON array of domains
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scim_tokens (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
