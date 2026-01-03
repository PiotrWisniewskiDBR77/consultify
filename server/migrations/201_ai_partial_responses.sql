-- AI Partial Responses Table
-- For streaming resilience: saves partial responses for reconnection
-- Created: 2025-01-03

CREATE TABLE IF NOT EXISTS ai_partial_responses (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    organization_id TEXT,
    content TEXT NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for fast lookups by session
CREATE INDEX IF NOT EXISTS idx_partial_responses_session ON ai_partial_responses(session_id);

-- Index for user-based queries
CREATE INDEX IF NOT EXISTS idx_partial_responses_user ON ai_partial_responses(user_id);

-- Cleanup old partial responses (older than 1 hour)
-- This should be run periodically via cron job
-- DELETE FROM ai_partial_responses WHERE updated_at < datetime('now', '-1 hour');


