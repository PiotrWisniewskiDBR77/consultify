-- User AI Preferences Table
-- Stores personalization settings for AI interactions
-- Part of UX Excellence - Phase 4.2

CREATE TABLE IF NOT EXISTS user_ai_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    preferences TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_user_ai_preferences_user_id ON user_ai_preferences (user_id);
CREATE INDEX IF NOT EXISTS idx_user_ai_preferences_updated ON user_ai_preferences (updated_at);






