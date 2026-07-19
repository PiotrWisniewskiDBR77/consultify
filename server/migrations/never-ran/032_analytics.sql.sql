-- Advanced Analytics Tables
-- Phase: P2 Implementation

-- Experiment Assignments
CREATE TABLE IF NOT EXISTS user_experiments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    experiment_id TEXT NOT NULL,
    variant TEXT NOT NULL,
    assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, experiment_id)
);

CREATE INDEX IF NOT EXISTS idx_user_experiments_user ON user_experiments(user_id);
