-- V4-ENT-01: SSO auth states + session hardening columns
-- Migration: 651_v4_sso_sessions.sql

-- Temporary auth states for OIDC/SAML login flows (state, nonce, PKCE)
CREATE TABLE IF NOT EXISTS sso_auth_states (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    organization_id TEXT NOT NULL,
    state TEXT NOT NULL UNIQUE,
    nonce TEXT,
    provider_type TEXT NOT NULL,
    redirect_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '10 minutes')
);

CREATE INDEX IF NOT EXISTS idx_sso_auth_states_state ON sso_auth_states(state);
CREATE INDEX IF NOT EXISTS idx_sso_auth_states_expires ON sso_auth_states(expires_at);

-- Extend user_sessions with SSO-specific columns
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS sso_session_id TEXT;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS sso_provider_config_id TEXT;
