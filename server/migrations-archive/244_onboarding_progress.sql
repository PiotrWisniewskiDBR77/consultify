-- GAP-AUTH-002: Onboarding progress tracking
-- Migration: 244_onboarding_progress.sql

CREATE TABLE IF NOT EXISTS user_onboarding (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    organization_id TEXT NOT NULL,
    
    -- Onboarding steps completion
    profile_completed INTEGER DEFAULT 0,
    team_invited INTEGER DEFAULT 0,
    first_project_created INTEGER DEFAULT 0,
    first_assessment_run INTEGER DEFAULT 0,
    ai_assistant_used INTEGER DEFAULT 0,
    settings_configured INTEGER DEFAULT 0,
    
    -- Progress tracking
    current_step TEXT DEFAULT 'profile',
    completed_steps TEXT DEFAULT '[]', -- JSON array of step names
    skipped_steps TEXT DEFAULT '[]',   -- JSON array of skipped steps
    
    -- Timestamps
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_onboarding_user ON user_onboarding(user_id);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_org ON user_onboarding(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_completed ON user_onboarding(completed_at);
