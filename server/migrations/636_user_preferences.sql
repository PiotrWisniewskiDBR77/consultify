-- Migration 636: Ensure user_preferences table exists
-- Required for demo/trial signup (setUserDemoPreference) and settings/preferences
-- Schema: user_id, key, value, updated_at (key-value store per user)

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_prefs_user ON user_preferences(user_id);
