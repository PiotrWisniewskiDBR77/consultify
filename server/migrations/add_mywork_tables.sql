-- My Work Module - Database Migrations
-- Part of PMO Upgrade to World-Class Standards
-- Run this migration to add focus tasks, inbox items, and notification preferences

-- ============================================================================
-- FOCUS TASKS TABLE
-- ============================================================================
-- Stores daily focus tasks per user with time blocks

CREATE TABLE IF NOT EXISTS focus_tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    date TEXT NOT NULL, -- ISO date YYYY-MM-DD
    time_block TEXT NOT NULL DEFAULT 'morning', -- morning, afternoon, buffer
    position INTEGER DEFAULT 0,
    is_completed INTEGER DEFAULT 0,
    completed_at TEXT,
    due_time TEXT, -- Optional specific time HH:MM
    estimated_minutes INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    -- Ensure unique task per user per day
    UNIQUE(user_id, task_id, date)
);

-- Indexes for focus_tasks
CREATE INDEX IF NOT EXISTS idx_focus_tasks_user_date ON focus_tasks(user_id, date);
CREATE INDEX IF NOT EXISTS idx_focus_tasks_task ON focus_tasks(task_id);

-- ============================================================================
-- INBOX ITEMS TABLE
-- ============================================================================
-- Stores incoming items requiring user triage

CREATE TABLE IF NOT EXISTS inbox_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- new_assignment, mention, escalation, review_request, decision_request, ai_suggestion
    title TEXT NOT NULL,
    description TEXT,
    source_type TEXT DEFAULT 'user', -- user, system, ai
    source_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    urgency TEXT DEFAULT 'normal', -- critical, high, normal, low
    linked_task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
    linked_initiative_id TEXT REFERENCES initiatives(id) ON DELETE SET NULL,
    linked_decision_id TEXT REFERENCES decisions(id) ON DELETE SET NULL,
    triaged INTEGER DEFAULT 0,
    triaged_at TEXT,
    triage_action TEXT, -- accept_today, schedule, delegate, archive, reject
    triage_params TEXT, -- JSON params for the action
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for inbox_items
CREATE INDEX IF NOT EXISTS idx_inbox_items_user ON inbox_items(user_id);
CREATE INDEX IF NOT EXISTS idx_inbox_items_user_triaged ON inbox_items(user_id, triaged);
CREATE INDEX IF NOT EXISTS idx_inbox_items_urgency ON inbox_items(urgency);
CREATE INDEX IF NOT EXISTS idx_inbox_items_type ON inbox_items(type);

-- ============================================================================
-- NOTIFICATION PREFERENCES TABLE
-- ============================================================================
-- Stores user notification preferences per category

CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    
    -- Per-category settings (JSON for flexibility)
    category_settings TEXT DEFAULT '{}',
    
    -- Quiet hours
    quiet_hours_enabled INTEGER DEFAULT 0,
    quiet_hours_start TEXT DEFAULT '20:00',
    quiet_hours_end TEXT DEFAULT '08:00',
    quiet_hours_timezone TEXT DEFAULT 'Europe/Warsaw',
    
    -- Weekend settings
    weekend_critical_only INTEGER DEFAULT 1,
    weekend_digest_only INTEGER DEFAULT 0,
    
    -- Daily digest
    daily_digest_enabled INTEGER DEFAULT 1,
    daily_digest_time TEXT DEFAULT '09:00',
    
    -- Weekly digest
    weekly_digest_enabled INTEGER DEFAULT 1,
    weekly_digest_day TEXT DEFAULT 'monday',
    weekly_digest_time TEXT DEFAULT '09:00',
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- ============================================================================
-- EXECUTION SCORES TABLE
-- ============================================================================
-- Historical execution score tracking

CREATE TABLE IF NOT EXISTS execution_scores (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    completed_count INTEGER DEFAULT 0,
    total_count INTEGER DEFAULT 0,
    overdue_count INTEGER DEFAULT 0,
    on_time_rate REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    
    UNIQUE(user_id, date)
);

-- Index for execution_scores
CREATE INDEX IF NOT EXISTS idx_execution_scores_user_date ON execution_scores(user_id, date);

-- ============================================================================
-- NOTIFICATION BATCHES TABLE
-- ============================================================================
-- For notification batching and digest generation

CREATE TABLE IF NOT EXISTS notification_batches (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    batch_type TEXT NOT NULL, -- daily, weekly, immediate
    status TEXT DEFAULT 'pending', -- pending, processing, sent, failed
    scheduled_at TEXT NOT NULL,
    sent_at TEXT,
    content TEXT, -- JSON content
    created_at TEXT DEFAULT (datetime('now'))
);

-- Index for notification_batches
CREATE INDEX IF NOT EXISTS idx_notification_batches_user_status ON notification_batches(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notification_batches_scheduled ON notification_batches(scheduled_at, status);

-- ============================================================================
-- USER NOTIFICATION SETTINGS (legacy table extension)
-- ============================================================================
-- Add new columns if not exists (SQLite compatible approach)

-- Note: In SQLite, we can't conditionally add columns, so these may need to be run separately
-- ALTER TABLE user_notification_settings ADD COLUMN muted_channels TEXT DEFAULT '[]';
-- ALTER TABLE user_notification_settings ADD COLUMN digest_preference TEXT DEFAULT 'daily';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamp trigger for focus_tasks
CREATE TRIGGER IF NOT EXISTS focus_tasks_updated_at
AFTER UPDATE ON focus_tasks
BEGIN
    UPDATE focus_tasks SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Update timestamp trigger for inbox_items
CREATE TRIGGER IF NOT EXISTS inbox_items_updated_at
AFTER UPDATE ON inbox_items
BEGIN
    UPDATE inbox_items SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Update timestamp trigger for notification_preferences
CREATE TRIGGER IF NOT EXISTS notification_preferences_updated_at
AFTER UPDATE ON notification_preferences
BEGIN
    UPDATE notification_preferences SET updated_at = datetime('now') WHERE user_id = NEW.user_id;
END;

-- ============================================================================
-- SAMPLE DATA FOR TESTING (Optional - remove in production)
-- ============================================================================

-- Insert default notification preferences for existing users
INSERT OR IGNORE INTO notification_preferences (user_id, category_settings)
SELECT id, '{"task_assigned":{"inapp":true,"push":true,"email":false},"task_overdue":{"inapp":true,"push":true,"email":true},"decision_required":{"inapp":true,"push":true,"email":true},"mention":{"inapp":true,"push":true,"email":false},"blocking_alert":{"inapp":true,"push":true,"email":true}}'
FROM users;



