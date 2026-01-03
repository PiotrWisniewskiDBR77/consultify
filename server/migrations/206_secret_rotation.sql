-- Secret Rotation Tracking Tables
-- Part of Security Excellence - Phase 3.2

-- Main tracking table for secrets
CREATE TABLE IF NOT EXISTS secret_rotation_tracking (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL,
    secret_type TEXT NOT NULL,
    secret_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    last_rotated_at DATETIME,
    rotation_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    metadata TEXT,
    UNIQUE(provider_id, secret_type)
);

-- Audit log for secret operations
CREATE TABLE IF NOT EXISTS secret_rotation_audit (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    provider_id TEXT,
    secret_type TEXT,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_secret_tracking_provider ON secret_rotation_tracking (provider_id);
CREATE INDEX IF NOT EXISTS idx_secret_tracking_expires ON secret_rotation_tracking (expires_at);
CREATE INDEX IF NOT EXISTS idx_secret_tracking_status ON secret_rotation_tracking (status);
CREATE INDEX IF NOT EXISTS idx_secret_audit_action ON secret_rotation_audit (action);
CREATE INDEX IF NOT EXISTS idx_secret_audit_created ON secret_rotation_audit (created_at);




