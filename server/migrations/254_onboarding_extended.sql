-- FLOW-ONBOARDING-001: User Onboarding Extended
-- Migration: 254_onboarding_extended.sql

-- ==========================================
-- ONBOARDING STEPS DEFINITION
-- ==========================================

CREATE TABLE IF NOT EXISTS onboarding_steps (
    id TEXT PRIMARY KEY,
    step_order INTEGER NOT NULL,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    is_required BOOLEAN DEFAULT TRUE,
    points INTEGER DEFAULT 10,
    trigger_action TEXT, -- What action completes this step
    help_url TEXT,
    icon TEXT,
    estimated_minutes INTEGER DEFAULT 5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed onboarding steps
INSERT INTO onboarding_steps (id, step_order, name, display_name, description, is_required, points, trigger_action, icon) VALUES
    ('step-welcome', 1::integer, 'welcome', 'Welcome', 'Verify email and complete first login', TRUE::boolean, 10::integer, 'first_login', '👋'),
    ('step-profile', 2::integer, 'profile_setup', 'Profile Setup', 'Set up your profile and preferences', TRUE::boolean, 15::integer, 'profile_saved', '📸'),
    ('step-org', 3::integer, 'organization_context', 'Organization Context', 'Fill in company information for AI context', TRUE::boolean, 20::integer, 'org_context_saved', '🏢'),
    ('step-project', 4::integer, 'first_project', 'First Project', 'Create your first project or explore Sandbox', TRUE::boolean, 25::integer, 'project_created', '🚀'),
    ('step-assessment', 5::integer, 'first_assessment', 'First Assessment', 'Start your first digital maturity assessment', TRUE::boolean, 30::integer, 'assessment_started', '📊'),
    ('step-team', 6::integer, 'team_invitation', 'Team Invitation', 'Invite team members to collaborate', FALSE::boolean, 15::integer, 'invitation_sent', '👥')
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- ONBOARDING ACHIEVEMENTS
-- ==========================================

CREATE TABLE IF NOT EXISTS onboarding_achievements (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    points INTEGER DEFAULT 10,
    condition_type TEXT NOT NULL, -- 'step_complete', 'points_reached', 'all_complete', 'bonus'
    condition_value TEXT, -- Step ID, points threshold, or custom condition
    is_hidden BOOLEAN DEFAULT FALSE, -- Hidden achievements
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed achievements
INSERT INTO onboarding_achievements (id, name, display_name, description, icon, points, condition_type, condition_value, is_hidden) VALUES
    ('ach-first-steps', 'first_steps', 'First Steps', 'Completed welcome and first login', '🎉', 10, 'step_complete', 'welcome', FALSE),
    ('ach-looking-good', 'looking_good', 'Looking Good', 'Uploaded profile photo', '📸', 5, 'bonus', 'profile_photo', FALSE),
    ('ach-company-ready', 'company_ready', 'Company Ready', 'Filled in organization context', '🏢', 20, 'step_complete', 'organization_context', FALSE),
    ('ach-project-started', 'project_started', 'Project Started', 'Created your first project', '🚀', 25, 'step_complete', 'first_project', FALSE),
    ('ach-assessment-pro', 'assessment_pro', 'Assessment Pro', 'Completed first assessment', '📊', 50, 'bonus', 'assessment_completed', FALSE),
    ('ach-team-builder', 'team_builder', 'Team Builder', 'Invited first team member', '👥', 15, 'step_complete', 'team_invitation', FALSE),
    ('ach-onboarding-complete', 'onboarding_complete', 'Onboarding Champion', 'Completed all onboarding steps', '⭐', 100, 'all_complete', NULL, FALSE),
    ('ach-speed-runner', 'speed_runner', 'Speed Runner', 'Completed onboarding in under 15 minutes', '⚡', 50, 'bonus', 'time_15min', FALSE)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- ENHANCE USER ONBOARDING TABLE
-- ==========================================

-- Add columns to existing user_onboarding table
ALTER TABLE user_onboarding ADD COLUMN IF NOT EXISTS show_checklist BOOLEAN DEFAULT TRUE;
ALTER TABLE user_onboarding ADD COLUMN IF NOT EXISTS dismissed_until TIMESTAMP;
ALTER TABLE user_onboarding ADD COLUMN IF NOT EXISTS last_step_at TIMESTAMP;
ALTER TABLE user_onboarding ADD COLUMN IF NOT EXISTS achievements TEXT DEFAULT '[]';
ALTER TABLE user_onboarding ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0;

-- ==========================================
-- ONBOARDING TOOLTIPS
-- ==========================================

CREATE TABLE IF NOT EXISTS onboarding_tooltips (
    id TEXT PRIMARY KEY,
    target_selector TEXT NOT NULL, -- CSS selector for target element
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    position TEXT DEFAULT 'bottom', -- 'top', 'bottom', 'left', 'right'
    order_index INTEGER NOT NULL,
    page_pattern TEXT, -- URL pattern where this appears (regex)
    trigger_type TEXT DEFAULT 'auto', -- 'auto', 'click', 'hover'
    show_once BOOLEAN DEFAULT TRUE,
    delay_ms INTEGER DEFAULT 500,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed tooltips
INSERT INTO onboarding_tooltips (id, target_selector, title, content, position, order_index, page_pattern, show_once, is_active) VALUES
    ('tip-projects', '[data-nav="projects"]', 'Projects', 'Create projects to organize your transformation initiatives. Each project can have multiple initiatives and assessments.', 'bottom', 1::integer, '/dashboard', TRUE::boolean, TRUE::boolean),
    ('tip-assessments', '[data-nav="assessments"]', 'Assessments', 'Start with a digital maturity assessment to understand where you are and where you need to go.', 'bottom', 2::integer, '/dashboard', TRUE::boolean, TRUE::boolean),
    ('tip-mywork', '[data-nav="mywork"]', 'My Work', 'Your personal dashboard with all your tasks, decisions, and AI suggestions in one place.', 'bottom', 3::integer, '/dashboard', TRUE::boolean, TRUE::boolean),
    ('tip-tools', '[data-nav="tools"]', 'Tools', 'Access various tools for process mapping, problem-solving, and strategic planning.', 'bottom', 4::integer, '/dashboard', TRUE::boolean, TRUE::boolean),
    ('tip-ai-chat', '[data-chat-button]', 'AI Assistant', 'Click here anytime to chat with the AI assistant. It knows your context and can help with anything!', 'left', 5::integer, '.*', TRUE::boolean, TRUE::boolean)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- USER TOOLTIPS SEEN
-- ==========================================

CREATE TABLE IF NOT EXISTS user_tooltips_seen (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    tooltip_id TEXT NOT NULL,
    seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, tooltip_id),
    FOREIGN KEY (tooltip_id) REFERENCES onboarding_tooltips(id)
);

CREATE INDEX IF NOT EXISTS idx_user_tooltips_user ON user_tooltips_seen(user_id);

-- ==========================================
-- GUIDED TOUR SESSIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS onboarding_tours (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    tooltip_ids TEXT NOT NULL, -- JSON array of tooltip IDs in order
    trigger_condition TEXT, -- When to show this tour
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User tour progress
CREATE TABLE IF NOT EXISTS user_tour_progress (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    tour_id TEXT NOT NULL,
    current_step INTEGER DEFAULT 0,
    is_complete BOOLEAN DEFAULT FALSE,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    UNIQUE(user_id, tour_id),
    FOREIGN KEY (tour_id) REFERENCES onboarding_tours(id)
);

-- Seed main tour
INSERT INTO onboarding_tours (id, name, display_name, description, tooltip_ids, trigger_condition, is_active) VALUES
    ('tour-main', 'main_tour', 'Welcome Tour', 'Quick tour of the main features', '["tip-projects","tip-assessments","tip-mywork","tip-tools","tip-ai-chat"]', 'first_login', TRUE)
ON CONFLICT (id) DO NOTHING;
