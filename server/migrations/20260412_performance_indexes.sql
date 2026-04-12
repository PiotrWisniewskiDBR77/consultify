-- Performance indexes for login/auth flow optimization
-- Addresses slow queries on revoked_tokens and user_sessions during post-login burst

-- revoked_tokens: used by auth middleware on every authenticated request
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_jti ON revoked_tokens (jti);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_user_reason_expires ON revoked_tokens (user_id, reason, expires_at);

-- user_sessions: used by trackSessionActivity on every authenticated request
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON user_sessions (user_id, is_active);

-- users/org lookups: hot path for login and organization bootstrap
CREATE INDEX IF NOT EXISTS idx_users_email_login ON users (email);
CREATE INDEX IF NOT EXISTS idx_organization_profiles_org_id ON organization_profiles (organization_id);
CREATE INDEX IF NOT EXISTS idx_org_context_snapshots_org_rebuilt
  ON organization_context_snapshots (organization_id, rebuilt_at DESC);

-- refresh token lookups/rotation: hot path for login and session refresh
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash_active
  ON refresh_tokens (token_hash, revoked_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_active_created
  ON refresh_tokens (user_id, revoked_at, created_at DESC);

-- knowledge_documents: fix NOT NULL constraint on document_type
ALTER TABLE knowledge_documents ALTER COLUMN document_type SET DEFAULT 'markdown';
UPDATE knowledge_documents SET document_type = 'markdown' WHERE document_type IS NULL;
