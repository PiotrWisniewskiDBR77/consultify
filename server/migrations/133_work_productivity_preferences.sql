-- Migration 133: Work & Productivity Preferences
-- Adds work preferences, productivity settings, and collaboration preferences

-- Work Preferences (rozszerzenie istniejących work_hours)
CREATE TABLE IF NOT EXISTS user_work_preferences (
    user_id TEXT PRIMARY KEY,
    -- Working hours (już w users, ale tutaj bardziej szczegółowe)
    lunch_break_duration INTEGER DEFAULT 60, -- minutes
    focus_mode_enabled INTEGER DEFAULT 1,
    pomodoro_enabled INTEGER DEFAULT 0,
    pomodoro_duration INTEGER DEFAULT 25, -- minutes
    break_duration INTEGER DEFAULT 5, -- minutes
    break_reminders INTEGER DEFAULT 1,
    -- Goals
    daily_task_goal INTEGER DEFAULT 5,
    weekly_task_goal INTEGER DEFAULT 20,
    -- Task defaults
    auto_snooze_duration INTEGER DEFAULT 24, -- hours
    task_reminder_hours_before INTEGER DEFAULT 2,
    default_task_duration_minutes INTEGER DEFAULT 60,
    -- Capacity
    capacity_planning_enabled INTEGER DEFAULT 1,
    max_daily_hours REAL DEFAULT 8.0,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Productivity Preferences
CREATE TABLE IF NOT EXISTS user_productivity_preferences (
    user_id TEXT PRIMARY KEY,
    quick_actions TEXT DEFAULT '[]', -- JSON array
    command_palette_shortcuts TEXT DEFAULT '{}', -- JSON object
    custom_keyboard_shortcuts TEXT DEFAULT '{}', -- JSON object
    saved_filters TEXT DEFAULT '[]', -- JSON array
    default_filters TEXT DEFAULT '{}', -- JSON object per view
    smart_suggestions INTEGER DEFAULT 1,
    auto_assignment_rules TEXT DEFAULT '[]', -- JSON array
    auto_tagging_rules TEXT DEFAULT '[]', -- JSON array
    template_library_access INTEGER DEFAULT 1,
    quick_capture_enabled INTEGER DEFAULT 1,
    inbox_zero_preferences TEXT DEFAULT '{}', -- JSON object
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Team & Collaboration Preferences
CREATE TABLE IF NOT EXISTS user_collaboration_preferences (
    user_id TEXT PRIMARY KEY,
    team_visibility TEXT DEFAULT 'team', -- public, team, private
    mention_preferences TEXT DEFAULT '{}', -- JSON object
    collaboration_notifications INTEGER DEFAULT 1,
    shared_calendar_enabled INTEGER DEFAULT 1,
    team_status_updates INTEGER DEFAULT 1,
    availability_calendar_enabled INTEGER DEFAULT 1,
    meeting_preferences TEXT DEFAULT '{}', -- JSON: {defaultPlatform: 'zoom'}
    video_call_preferences TEXT DEFAULT '{}', -- JSON object
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indeksy
CREATE INDEX IF NOT EXISTS idx_work_prefs_user ON user_work_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_productivity_prefs_user ON user_productivity_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_prefs_user ON user_collaboration_preferences(user_id);

