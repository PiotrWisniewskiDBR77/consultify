-- Migration: 131_settings_preferences_extended.sql
-- Description: Extended settings preferences tables for keyboard shortcuts, layouts, search, etc.
-- Date: 2026-01-02

-- ==========================================
-- USER KEYBOARD SHORTCUTS TABLE
-- Custom keyboard shortcuts configuration
-- ==========================================
CREATE TABLE IF NOT EXISTS user_keyboard_shortcuts (
    user_id TEXT PRIMARY KEY,
    preset TEXT DEFAULT 'default', -- default, vscode, sublime, vim, custom
    enabled INTEGER DEFAULT 1,
    custom_shortcuts TEXT, -- JSON object mapping action -> shortcut
    disabled_shortcuts TEXT, -- JSON array of disabled default shortcuts
    show_hints INTEGER DEFAULT 1, -- Show keyboard hints in UI
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================
-- USER DASHBOARD LAYOUTS TABLE
-- Multiple saved dashboard configurations
-- ==========================================
CREATE TABLE IF NOT EXISTS user_dashboard_layouts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_default INTEGER DEFAULT 0,
    layout_config TEXT NOT NULL, -- JSON: widgets, positions, sizes
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_dashboard_layouts_user ON user_dashboard_layouts(user_id);

-- ==========================================
-- USER SEARCH PREFERENCES TABLE
-- Search behavior and history settings
-- ==========================================
CREATE TABLE IF NOT EXISTS user_search_preferences (
    user_id TEXT PRIMARY KEY,
    default_filters TEXT, -- JSON object of default filter settings
    search_history_enabled INTEGER DEFAULT 1,
    max_history_items INTEGER DEFAULT 50,
    include_archived INTEGER DEFAULT 0,
    fuzzy_search_enabled INTEGER DEFAULT 1,
    search_scope TEXT DEFAULT 'all', -- all, projects, tasks, documents
    recent_searches TEXT, -- JSON array of recent search queries
    saved_searches TEXT, -- JSON array of {name, query, filters}
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================
-- USER PERFORMANCE PREFERENCES TABLE
-- Performance and quality settings
-- ==========================================
CREATE TABLE IF NOT EXISTS user_performance_preferences (
    user_id TEXT PRIMARY KEY,
    image_quality TEXT DEFAULT 'high', -- low, medium, high, original
    video_quality TEXT DEFAULT 'auto', -- low, medium, high, auto
    auto_load_images INTEGER DEFAULT 1,
    auto_load_videos INTEGER DEFAULT 1,
    bandwidth_saver_mode INTEGER DEFAULT 0,
    offline_mode_enabled INTEGER DEFAULT 0,
    offline_sync_wifi_only INTEGER DEFAULT 1,
    cache_size_mb INTEGER DEFAULT 500,
    animation_enabled INTEGER DEFAULT 1,
    reduce_data_usage INTEGER DEFAULT 0,
    preload_content INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================
-- USER COLLABORATION PREFERENCES TABLE
-- Team collaboration settings
-- ==========================================
CREATE TABLE IF NOT EXISTS user_collaboration_preferences (
    user_id TEXT PRIMARY KEY,
    default_mention_behavior TEXT DEFAULT 'notify', -- notify, silent, none
    default_comment_visibility TEXT DEFAULT 'team', -- team, project, public
    auto_follow_created_items INTEGER DEFAULT 1,
    auto_follow_assigned_items INTEGER DEFAULT 1,
    auto_follow_commented_items INTEGER DEFAULT 0,
    show_typing_indicators INTEGER DEFAULT 1,
    show_read_receipts INTEGER DEFAULT 1,
    default_share_permission TEXT DEFAULT 'view', -- view, comment, edit
    collaboration_mode TEXT DEFAULT 'realtime', -- realtime, periodic, manual
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================
-- USER MOBILE PREFERENCES TABLE
-- Mobile/Desktop sync settings
-- ==========================================
CREATE TABLE IF NOT EXISTS user_mobile_preferences (
    user_id TEXT PRIMARY KEY,
    push_notifications_enabled INTEGER DEFAULT 1,
    mobile_data_sync_enabled INTEGER DEFAULT 0,
    wifi_only_sync INTEGER DEFAULT 1,
    mobile_offline_mode INTEGER DEFAULT 0,
    biometric_login_enabled INTEGER DEFAULT 0,
    quick_actions TEXT, -- JSON array of enabled quick actions
    widget_config TEXT, -- JSON object for mobile widget
    haptic_feedback_enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================
-- USER AUTOMATION RULES TABLE
-- Personal automation rules
-- ==========================================
CREATE TABLE IF NOT EXISTS user_automation_rules (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL, -- task_created, task_completed, due_date, etc.
    trigger_config TEXT NOT NULL, -- JSON configuration for trigger
    action_type TEXT NOT NULL, -- notify, assign, move, tag, etc.
    action_config TEXT NOT NULL, -- JSON configuration for action
    is_enabled INTEGER DEFAULT 1,
    run_count INTEGER DEFAULT 0,
    last_run_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_automation_rules_user ON user_automation_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_user_automation_rules_trigger ON user_automation_rules(trigger_type);

-- ==========================================
-- USER AI LEARNING PREFERENCES TABLE
-- AI training and learning settings
-- ==========================================
CREATE TABLE IF NOT EXISTS user_ai_learning_preferences (
    user_id TEXT PRIMARY KEY,
    allow_learning_from_interactions INTEGER DEFAULT 1,
    allow_learning_from_documents INTEGER DEFAULT 0,
    allow_learning_from_tasks INTEGER DEFAULT 1,
    allow_personalization INTEGER DEFAULT 1,
    share_anonymous_usage INTEGER DEFAULT 1,
    ai_suggestions_enabled INTEGER DEFAULT 1,
    ai_auto_complete_enabled INTEGER DEFAULT 1,
    ai_smart_replies_enabled INTEGER DEFAULT 1,
    ai_summary_enabled INTEGER DEFAULT 1,
    ai_priority_suggestions INTEGER DEFAULT 1,
    feedback_collection_enabled INTEGER DEFAULT 1,
    model_preference TEXT DEFAULT 'balanced', -- speed, balanced, quality
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================
-- USER QUIET HOURS TABLE
-- Do not disturb schedules
-- ==========================================
CREATE TABLE IF NOT EXISTS user_quiet_hours (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT DEFAULT 'Default',
    is_enabled INTEGER DEFAULT 0,
    start_time TEXT NOT NULL, -- HH:MM format
    end_time TEXT NOT NULL, -- HH:MM format
    days_of_week TEXT DEFAULT '[1,2,3,4,5]', -- JSON array [0-6]
    allow_urgent INTEGER DEFAULT 1, -- Allow urgent notifications
    allow_mentions INTEGER DEFAULT 0, -- Allow @mentions
    allow_direct_messages INTEGER DEFAULT 0,
    auto_reply_enabled INTEGER DEFAULT 0,
    auto_reply_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_quiet_hours_user ON user_quiet_hours(user_id);

-- ==========================================
-- USER SECURITY ALERT PREFERENCES TABLE
-- Security notification settings
-- ==========================================
CREATE TABLE IF NOT EXISTS user_security_alert_preferences (
    user_id TEXT PRIMARY KEY,
    alert_new_login INTEGER DEFAULT 1,
    alert_new_device INTEGER DEFAULT 1,
    alert_password_change INTEGER DEFAULT 1,
    alert_email_change INTEGER DEFAULT 1,
    alert_mfa_change INTEGER DEFAULT 1,
    alert_api_key_created INTEGER DEFAULT 1,
    alert_suspicious_activity INTEGER DEFAULT 1,
    alert_failed_login_attempts INTEGER DEFAULT 1,
    failed_login_threshold INTEGER DEFAULT 3,
    alert_session_timeout INTEGER DEFAULT 0,
    alert_data_export INTEGER DEFAULT 1,
    alert_channel TEXT DEFAULT 'both', -- email, push, both
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================
-- USER TASK TEMPLATES TABLE
-- Personal task templates
-- ==========================================
CREATE TABLE IF NOT EXISTS user_task_templates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    default_title TEXT,
    default_description TEXT,
    default_priority TEXT DEFAULT 'medium',
    default_tags TEXT, -- JSON array
    default_checklist TEXT, -- JSON array of checklist items
    default_assignee TEXT, -- 'self', 'manager', or user_id
    default_due_days INTEGER, -- Days from creation
    default_project_id TEXT,
    is_favorite INTEGER DEFAULT 0,
    use_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_task_templates_user ON user_task_templates(user_id);

-- ==========================================
-- EXTEND EXISTING PREFERENCES
-- Add new categories to valid list in settings.js
-- ==========================================

-- Update extended_preferences column if needed (handled in application layer)
-- Valid categories: work, dashboard, accessibility, privacy, ai, regional, 
--                   sound, advanced, shortcuts, collaboration, performance, 
--                   mobile, automation, aiLearning, quietHours, securityAlerts







