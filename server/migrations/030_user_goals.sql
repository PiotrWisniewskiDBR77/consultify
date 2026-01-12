-- User Goals Table
-- Phase: P1 Implementation
-- Purpose: Store user goal preferences for personalized onboarding

CREATE TABLE IF NOT EXISTS user_goals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    goal_id TEXT NOT NULL,  -- 'strategic_decision', 'team_alignment', 'executive_prep', 'explore'
    metadata TEXT,          -- JSON
    selected_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_user_goals_user ON user_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_goals_date ON user_goals(selected_at);
