-- Migration: 028_refresh_tokens.sql
-- Refresh Token System for JWT Authentication
-- Created: 2025-12-21

-- Refresh tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE, -- SHA-256 hash of token
    token_family TEXT, -- For rotation detection
    device_info TEXT, -- User-friendly device description
    ip_address TEXT,
    user_agent TEXT,
    expires_at TEXT NOT NULL, -- ISO datetime
    revoked_at TEXT, -- ISO datetime (NULL if active)
    revoked_reason TEXT, -- 'logout', 'security', 'rotation', 'expired'
    created_at TEXT DEFAULT (datetime('now')),
    last_used_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(token_family);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- Active sessions view (for user account management)
CREATE VIEW IF NOT EXISTS active_sessions AS
SELECT 
    rt.id,
    rt.user_id,
    rt.device_info,
    rt.ip_address,
    rt.created_at,
    rt.last_used_at,
    u.email as user_email
FROM refresh_tokens rt
JOIN users u ON rt.user_id = u.id
WHERE rt.revoked_at IS NULL 
  AND rt.expires_at > datetime('now');
