-- Migration: Pinned Prompts
-- Creates table for user's frequently used AI prompts

CREATE TABLE IF NOT EXISTS pinned_prompts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT,
    prompt TEXT NOT NULL,
    label TEXT,
    category TEXT DEFAULT 'general',
    usage_count INTEGER DEFAULT 0,
    last_used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_pinned_prompts_user ON pinned_prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_pinned_prompts_org ON pinned_prompts(organization_id);
CREATE INDEX IF NOT EXISTS idx_pinned_prompts_usage ON pinned_prompts(user_id, usage_count DESC);














