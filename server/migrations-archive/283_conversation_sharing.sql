-- Migration: Conversation Sharing
-- Enables public sharing of conversations via unique links

CREATE TABLE IF NOT EXISTS conversation_shares (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    share_token TEXT UNIQUE NOT NULL,
    created_by TEXT NOT NULL,
    title TEXT,
    description TEXT,
    expires_at TIMESTAMP,
    view_count INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    settings JSON DEFAULT '{}',
    -- Settings can include:
    -- - allow_copy: boolean - can viewers copy messages
    -- - show_timestamps: boolean - show message timestamps
    -- - anonymize: boolean - hide user info
    -- - password_hash: string - optional password protection
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Track share views for analytics
CREATE TABLE IF NOT EXISTS conversation_share_views (
    id TEXT PRIMARY KEY,
    share_id TEXT NOT NULL REFERENCES conversation_shares(id) ON DELETE CASCADE,
    viewer_ip TEXT,
    viewer_agent TEXT,
    referrer TEXT,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shares_token ON conversation_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_shares_conversation ON conversation_shares(conversation_id);
CREATE INDEX IF NOT EXISTS idx_shares_active ON conversation_shares(is_active);
CREATE INDEX IF NOT EXISTS idx_share_views_share ON conversation_share_views(share_id);
CREATE INDEX IF NOT EXISTS idx_share_views_date ON conversation_share_views(viewed_at);
