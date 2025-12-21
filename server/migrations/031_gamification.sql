-- Gamification System Tables
-- Phase: P2 Implementation

-- User Points Ledger
CREATE TABLE IF NOT EXISTS user_points_ledger (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    action_type TEXT NOT NULL, -- 'LOGIN', 'CREATE_AXIS', 'INVITE_USER', etc.
    points_awarded INTEGER NOT NULL,
    metadata TEXT, -- JSON
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User Achievements
CREATE TABLE IF NOT EXISTS user_achievements (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    achievement_id TEXT NOT NULL, -- 'first_steps', 'team_player', etc.
    unlocked_at TEXT DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, achievement_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_points_user ON user_points_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
