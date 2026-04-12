-- Performance indexes for login/auth flow optimization
-- Addresses slow queries on revoked_tokens and user_sessions during post-login burst

-- revoked_tokens: used by auth middleware on every authenticated request
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_jti ON revoked_tokens (jti);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_user_reason_expires ON revoked_tokens (user_id, reason, expires_at);

-- user_sessions: used by trackSessionActivity on every authenticated request
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON user_sessions (user_id, is_active);

-- knowledge_documents: fix NOT NULL constraint on document_type
ALTER TABLE knowledge_documents ALTER COLUMN document_type SET DEFAULT 'markdown';
UPDATE knowledge_documents SET document_type = 'markdown' WHERE document_type IS NULL;
