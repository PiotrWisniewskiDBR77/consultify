-- Step 130: User Achievements System
-- Migration: 130_user_achievements.sql
-- Creates table for user achievements/badges

-- =========================================
-- USER ACHIEVEMENTS
-- =========================================
CREATE TABLE IF NOT EXISTS user_achievements (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    achievement_type TEXT NOT NULL,
    unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT DEFAULT '{}', -- JSON for additional data
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_type ON user_achievements(achievement_type);

-- Achievement types:
-- PROFILE_COMPLETE_25, PROFILE_COMPLETE_50, PROFILE_COMPLETE_75, PROFILE_COMPLETE_100
-- LINKEDIN_CONNECTED, MFA_ENABLED, FIRST_PROJECT, FIRST_TASK, etc.






