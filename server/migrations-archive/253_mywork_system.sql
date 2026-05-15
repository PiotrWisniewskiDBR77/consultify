-- FLOW-MYWORK-001: MyWork Dashboard
-- Migration: 253_mywork_system.sql

-- ==========================================
-- MYWORK PREFERENCES
-- ==========================================

CREATE TABLE IF NOT EXISTS mywork_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    
    -- Display preferences
    default_view TEXT DEFAULT 'all', -- 'all', 'tasks', 'decisions', 'focus'
    show_completed_tasks INTEGER DEFAULT 0,
    show_completed_days INTEGER DEFAULT 7, -- Show completed from last N days
    task_grouping TEXT DEFAULT 'due_date', -- 'due_date', 'project', 'priority', 'status'
    
    -- Focus settings
    focus_max_items INTEGER DEFAULT 5,
    focus_include_decisions INTEGER DEFAULT 1,
    focus_include_assessments INTEGER DEFAULT 1,
    
    -- Widget visibility
    show_ai_inbox INTEGER DEFAULT 1,
    show_activity_feed INTEGER DEFAULT 1,
    show_quick_stats INTEGER DEFAULT 1,
    
    -- Notifications
    daily_summary_enabled INTEGER DEFAULT 1,
    daily_summary_time TEXT DEFAULT '08:00',
    weekly_summary_enabled INTEGER DEFAULT 1,
    weekly_summary_day TEXT DEFAULT 'monday',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mywork_prefs_user ON mywork_preferences(user_id);

-- ==========================================
-- AI INBOX
-- ==========================================

CREATE TABLE IF NOT EXISTS ai_inbox (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    
    -- Item details
    type TEXT NOT NULL, -- 'suggestion', 'insight', 'alert', 'action', 'reminder'
    category TEXT, -- 'task_risk', 'decision_pending', 'optimization', 'deadline', 'pattern'
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    
    -- Context
    related_type TEXT, -- 'task', 'initiative', 'project', 'decision', 'assessment'
    related_id TEXT,
    related_name TEXT,
    
    -- Action
    action_type TEXT, -- 'view', 'decide', 'update', 'review'
    action_url TEXT, -- Deep link
    
    -- Status
    status TEXT DEFAULT 'unread', -- 'unread', 'read', 'dismissed', 'actioned', 'snoozed'
    read_at TIMESTAMP,
    dismissed_at TIMESTAMP,
    actioned_at TIMESTAMP,
    snoozed_until TIMESTAMP,
    
    -- AI metadata
    confidence_score REAL DEFAULT 0.8,
    generated_by TEXT DEFAULT 'ai',
    generation_context TEXT, -- JSON with why this was generated
    
    -- Lifecycle
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_inbox_user ON ai_inbox(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_inbox_org ON ai_inbox(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_inbox_status ON ai_inbox(status);
CREATE INDEX IF NOT EXISTS idx_ai_inbox_type ON ai_inbox(type);
CREATE INDEX IF NOT EXISTS idx_ai_inbox_created ON ai_inbox(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_inbox_expires ON ai_inbox(expires_at);

-- ==========================================
-- USER ACTIVITY LOG
-- ==========================================

CREATE TABLE IF NOT EXISTS user_activity (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    
    -- Activity details
    activity_type TEXT NOT NULL, 
    -- Types: 'task_created', 'task_completed', 'task_updated', 
    -- 'decision_made', 'decision_created', 'comment_added',
    -- 'assessment_started', 'assessment_completed', 'initiative_created',
    -- 'report_generated', 'login', 'logout'
    
    activity_data TEXT, -- JSON with details
    description TEXT, -- Human-readable description
    
    -- Related entity
    entity_type TEXT, -- 'task', 'decision', 'initiative', 'assessment', 'project', 'report'
    entity_id TEXT,
    entity_name TEXT,
    
    -- Context
    project_id TEXT,
    project_name TEXT,
    
    -- Visibility
    is_public INTEGER DEFAULT 1, -- Visible to team members
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_activity_user ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_org ON user_activity(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_type ON user_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_created ON user_activity(created_at);
CREATE INDEX IF NOT EXISTS idx_user_activity_entity ON user_activity(entity_type, entity_id);

-- ==========================================
-- FOCUS ITEMS (cached)
-- ==========================================

CREATE TABLE IF NOT EXISTS mywork_focus_cache (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    
    -- Focus items (JSON array)
    items TEXT NOT NULL,
    
    -- Cache metadata
    calculated_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_focus_cache_user ON mywork_focus_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_focus_cache_expires ON mywork_focus_cache(expires_at);

-- ==========================================
-- DAILY/WEEKLY SUMMARY TRACKING
-- ==========================================

CREATE TABLE IF NOT EXISTS summary_sends (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    summary_type TEXT NOT NULL, -- 'daily', 'weekly'
    period_date DATE NOT NULL,
    
    -- Summary content
    summary_data TEXT, -- JSON with what was included
    
    -- Status
    sent_at TIMESTAMP,
    delivered INTEGER DEFAULT 0,
    opened INTEGER DEFAULT 0,
    
    UNIQUE(user_id, summary_type, period_date)
);

CREATE INDEX IF NOT EXISTS idx_summary_sends_user ON summary_sends(user_id);
CREATE INDEX IF NOT EXISTS idx_summary_sends_date ON summary_sends(period_date);
