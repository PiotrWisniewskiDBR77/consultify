-- Migration: 130_user_profile_extended.sql
-- Description: Extended user profile fields for enhanced settings
-- Date: 2026-01-02

-- ==========================================
-- EXTENDED USER PROFILE TABLE
-- Stores additional profile information beyond basic user data
-- ==========================================
CREATE TABLE IF NOT EXISTS user_profile_extended (
    user_id TEXT PRIMARY KEY,
    
    -- Bio & About
    short_bio TEXT,
    long_bio TEXT,
    skills TEXT, -- JSON array of skill strings
    certifications TEXT, -- JSON array of {name, issuer, date, url}
    years_experience INTEGER,
    education TEXT, -- JSON array of {institution, degree, field, year}
    
    -- Professional Details
    department TEXT,
    manager_id TEXT,
    employee_id TEXT,
    hire_date TEXT,
    contract_type TEXT DEFAULT 'full-time', -- full-time, part-time, contractor, freelance
    working_hours_start TEXT DEFAULT '09:00',
    working_hours_end TEXT DEFAULT '17:00',
    work_days TEXT DEFAULT '[1,2,3,4,5]', -- JSON array [0-6] where 0=Sunday
    
    -- Social Links
    twitter_handle TEXT,
    github_username TEXT,
    website_url TEXT,
    portfolio_url TEXT,
    custom_links TEXT, -- JSON array of {name, url, icon}
    
    -- Extended Contact Information
    work_phone TEXT,
    mobile_phone TEXT,
    office_address TEXT,
    office_building TEXT,
    office_floor TEXT,
    office_desk TEXT,
    skype_username TEXT,
    teams_username TEXT,
    slack_username TEXT,
    discord_username TEXT,
    zoom_personal_link TEXT,
    
    -- Profile Visibility Settings
    profile_visibility TEXT DEFAULT 'organization', -- public, organization, team, private
    show_email_publicly INTEGER DEFAULT 0,
    show_phone_publicly INTEGER DEFAULT 0,
    show_activity_status INTEGER DEFAULT 1,
    show_last_seen INTEGER DEFAULT 1,
    show_in_directory INTEGER DEFAULT 1,
    allow_mentions_from TEXT DEFAULT 'all', -- all, team, none
    allow_direct_messages_from TEXT DEFAULT 'all', -- all, team, none
    
    -- Email & Communication Preferences
    email_signature TEXT,
    email_signature_html TEXT,
    email_aliases TEXT, -- JSON array of email strings
    email_forwarding TEXT, -- JSON array of {email, enabled}
    out_of_office_enabled INTEGER DEFAULT 0,
    out_of_office_message TEXT,
    out_of_office_start TEXT,
    out_of_office_end TEXT,
    out_of_office_auto_reply INTEGER DEFAULT 0,
    email_digest_frequency TEXT DEFAULT 'daily', -- realtime, daily, weekly, never
    
    -- Profile Completion Tracking
    profile_completion_score INTEGER DEFAULT 0,
    profile_completion_details TEXT, -- JSON object tracking what's filled
    
    -- Metadata
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profile_extended_department ON user_profile_extended(department);
CREATE INDEX IF NOT EXISTS idx_user_profile_extended_manager ON user_profile_extended(manager_id);
CREATE INDEX IF NOT EXISTS idx_user_profile_extended_visibility ON user_profile_extended(profile_visibility);

-- ==========================================
-- USER CERTIFICATIONS TABLE (Normalized)
-- For detailed certification tracking
-- ==========================================
CREATE TABLE IF NOT EXISTS user_certifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    issuer TEXT,
    issue_date TEXT,
    expiry_date TEXT,
    credential_id TEXT,
    credential_url TEXT,
    description TEXT,
    is_verified INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_certifications_user ON user_certifications(user_id);

-- ==========================================
-- USER SKILLS TABLE (Normalized)
-- For detailed skill tracking with endorsements
-- ==========================================
CREATE TABLE IF NOT EXISTS user_skills (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT, -- technical, soft, language, tool
    proficiency_level TEXT DEFAULT 'intermediate', -- beginner, intermediate, advanced, expert
    years_experience INTEGER,
    is_primary INTEGER DEFAULT 0,
    endorsement_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_user_skills_user ON user_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_category ON user_skills(category);

-- ==========================================
-- USER EDUCATION TABLE (Normalized)
-- For education history
-- ==========================================
CREATE TABLE IF NOT EXISTS user_education (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    institution TEXT NOT NULL,
    degree TEXT,
    field_of_study TEXT,
    start_year INTEGER,
    end_year INTEGER,
    is_current INTEGER DEFAULT 0,
    description TEXT,
    grade TEXT,
    activities TEXT, -- JSON array
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_education_user ON user_education(user_id);

-- ==========================================
-- USER WORK HISTORY TABLE
-- For employment history (optional feature)
-- ==========================================
CREATE TABLE IF NOT EXISTS user_work_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    company TEXT NOT NULL,
    title TEXT NOT NULL,
    location TEXT,
    start_date TEXT,
    end_date TEXT,
    is_current INTEGER DEFAULT 0,
    description TEXT,
    skills_used TEXT, -- JSON array
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_work_history_user ON user_work_history(user_id);

-- ==========================================
-- TRIGGER: Update timestamp on profile change
-- ==========================================
CREATE TRIGGER IF NOT EXISTS update_user_profile_extended_timestamp
    AFTER UPDATE ON user_profile_extended
    FOR EACH ROW
BEGIN
    UPDATE user_profile_extended 
    SET updated_at = datetime('now') 
    WHERE user_id = NEW.user_id;
END;








