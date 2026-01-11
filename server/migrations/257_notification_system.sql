-- FLOW-NOTIFICATION-001: Notification System
-- Migration: 257_notification_system.sql

-- ==========================================
-- NOTIFICATION TYPES
-- ==========================================

CREATE TABLE IF NOT EXISTS notification_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL, -- 'tasks', 'decisions', 'initiatives', 'assessments', 'projects', 'ai', 'system', 'billing'
    display_name TEXT NOT NULL,
    description TEXT,
    default_channels TEXT NOT NULL, -- JSON array: ['in_app', 'email']
    is_user_configurable INTEGER DEFAULT 1,
    is_critical INTEGER DEFAULT 0, -- Cannot be disabled by user
    template_subject TEXT,
    template_body TEXT,
    icon TEXT,
    color TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed notification types
INSERT OR IGNORE INTO notification_types (id, name, category, display_name, default_channels, icon, is_critical) VALUES
    -- Tasks
    ('nt-task-assigned', 'task_assigned', 'tasks', 'Task Assigned', '["in_app","email"]', '📋', 0),
    ('nt-task-due-soon', 'task_due_soon', 'tasks', 'Task Due Soon', '["in_app"]', '⏰', 0),
    ('nt-task-overdue', 'task_overdue', 'tasks', 'Task Overdue', '["in_app","email"]', '🚨', 0),
    ('nt-task-completed', 'task_completed', 'tasks', 'Task Completed', '["in_app"]', '✅', 0),
    ('nt-task-comment', 'task_comment', 'tasks', 'New Comment', '["in_app"]', '💬', 0),
    
    -- Decisions
    ('nt-decision-needed', 'decision_needed', 'decisions', 'Decision Needed', '["in_app","email"]', '🔴', 0),
    ('nt-decision-made', 'decision_made', 'decisions', 'Decision Made', '["in_app"]', '✅', 0),
    ('nt-decision-escalated', 'decision_escalated', 'decisions', 'Decision Escalated', '["in_app","email"]', '⬆️', 0),
    
    -- Initiatives
    ('nt-initiative-approved', 'initiative_approved', 'initiatives', 'Initiative Approved', '["in_app","email"]', '🎉', 0),
    ('nt-initiative-blocked', 'initiative_blocked', 'initiatives', 'Initiative Blocked', '["in_app","email"]', '🚫', 0),
    ('nt-initiative-status', 'initiative_status_change', 'initiatives', 'Initiative Status Changed', '["in_app"]', '📊', 0),
    
    -- Assessments
    ('nt-assessment-completed', 'assessment_completed', 'assessments', 'Assessment Completed', '["in_app","email"]', '📝', 0),
    ('nt-assessment-shared', 'assessment_shared', 'assessments', 'Assessment Shared', '["in_app"]', '🔗', 0),
    
    -- Projects
    ('nt-project-member-added', 'project_member_added', 'projects', 'Added to Project', '["in_app","email"]', '👥', 0),
    ('nt-project-archived', 'project_archived', 'projects', 'Project Archived', '["in_app"]', '📦', 0),
    
    -- AI
    ('nt-ai-suggestion', 'ai_suggestion', 'ai', 'AI Suggestion', '["in_app"]', '💡', 0),
    ('nt-ai-action-pending', 'ai_action_pending', 'ai', 'AI Action Pending Approval', '["in_app"]', '🤖', 0),
    ('nt-ai-insight', 'ai_insight', 'ai', 'AI Insight', '["in_app"]', '🔍', 0),
    
    -- System (critical)
    ('nt-system-maintenance', 'system_maintenance', 'system', 'System Maintenance', '["in_app","email"]', '🔧', 1),
    ('nt-subscription-change', 'subscription_change', 'billing', 'Subscription Updated', '["in_app","email"]', '💳', 1),
    ('nt-usage-alert', 'usage_alert', 'billing', 'Usage Alert', '["in_app","email"]', '📈', 1),
    ('nt-payment-failed', 'payment_failed', 'billing', 'Payment Failed', '["in_app","email"]', '❌', 1);

-- ==========================================
-- USER NOTIFICATION PREFERENCES
-- ==========================================

CREATE TABLE IF NOT EXISTS notification_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    
    -- Global settings
    global_enabled INTEGER DEFAULT 1,
    quiet_hours_enabled INTEGER DEFAULT 0,
    quiet_hours_start TEXT DEFAULT '22:00',
    quiet_hours_end TEXT DEFAULT '08:00',
    quiet_hours_timezone TEXT DEFAULT 'UTC',
    quiet_hours_weekends_only INTEGER DEFAULT 0,
    
    -- Email settings
    email_enabled INTEGER DEFAULT 1,
    email_digest_enabled INTEGER DEFAULT 0,
    email_digest_frequency TEXT DEFAULT 'daily', -- 'daily', 'weekly'
    email_digest_time TEXT DEFAULT '09:00',
    email_digest_day TEXT DEFAULT 'monday', -- For weekly
    
    -- Per-type settings (JSON)
    type_settings TEXT DEFAULT '{}', -- {notificationType: {enabled, channels[]}}
    
    -- Integration preferences
    slack_enabled INTEGER DEFAULT 1,
    slack_dm_enabled INTEGER DEFAULT 1,
    teams_enabled INTEGER DEFAULT 1,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id);

-- ==========================================
-- NOTIFICATIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    
    -- Notification details
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    icon TEXT,
    priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
    
    -- Related entity
    entity_type TEXT, -- 'task', 'decision', 'initiative', 'assessment', 'project'
    entity_id TEXT,
    action_url TEXT,
    
    -- Actor (who triggered this)
    actor_id TEXT,
    actor_name TEXT,
    
    -- Metadata
    metadata TEXT DEFAULT '{}', -- JSON: extra data for templating
    
    -- Status
    is_read INTEGER DEFAULT 0,
    read_at TIMESTAMP,
    is_dismissed INTEGER DEFAULT 0,
    dismissed_at TIMESTAMP,
    
    -- Delivery tracking
    channels_sent TEXT DEFAULT '[]', -- JSON array of channels used
    
    -- Email tracking
    email_sent INTEGER DEFAULT 0,
    email_sent_at TIMESTAMP,
    email_message_id TEXT,
    email_delivered INTEGER DEFAULT 0,
    email_opened INTEGER DEFAULT 0,
    email_opened_at TIMESTAMP,
    
    -- Slack tracking
    slack_sent INTEGER DEFAULT 0,
    slack_sent_at TIMESTAMP,
    slack_message_ts TEXT,
    
    -- Grouping for batching similar notifications
    group_key TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notifications(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_group ON notifications(group_key);

-- ==========================================
-- EMAIL DIGEST QUEUE
-- ==========================================

CREATE TABLE IF NOT EXISTS notification_digest_queue (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    notification_id TEXT NOT NULL,
    digest_type TEXT NOT NULL, -- 'daily', 'weekly'
    scheduled_for DATE NOT NULL,
    included_at TIMESTAMP,
    
    UNIQUE(notification_id, digest_type),
    FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_digest_queue_user ON notification_digest_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_digest_queue_scheduled ON notification_digest_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_digest_queue_type ON notification_digest_queue(digest_type);

-- ==========================================
-- DELIVERY LOG
-- ==========================================

CREATE TABLE IF NOT EXISTS notification_delivery_log (
    id TEXT PRIMARY KEY,
    notification_id TEXT NOT NULL,
    channel TEXT NOT NULL, -- 'in_app', 'email', 'slack', 'teams', 'push'
    
    -- Delivery status
    status TEXT NOT NULL, -- 'pending', 'sent', 'delivered', 'failed', 'bounced', 'skipped'
    status_reason TEXT, -- Why skipped/failed
    
    -- Timestamps
    queued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    failed_at TIMESTAMP,
    
    -- Error details
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Channel-specific
    external_id TEXT, -- Message ID from email/Slack/etc.
    
    -- Engagement (for email)
    opened_at TIMESTAMP,
    clicked_at TIMESTAMP,
    
    FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_delivery_log_notification ON notification_delivery_log(notification_id);
CREATE INDEX IF NOT EXISTS idx_delivery_log_channel ON notification_delivery_log(channel);
CREATE INDEX IF NOT EXISTS idx_delivery_log_status ON notification_delivery_log(status);

-- ==========================================
-- NOTIFICATION TEMPLATES
-- ==========================================

CREATE TABLE IF NOT EXISTS notification_templates (
    id TEXT PRIMARY KEY,
    notification_type TEXT NOT NULL,
    channel TEXT NOT NULL, -- 'email', 'slack', 'teams'
    language TEXT DEFAULT 'en',
    
    -- Template content
    subject TEXT, -- For email
    body_template TEXT NOT NULL, -- Handlebars/Mustache template
    
    -- For Slack/Teams
    blocks_template TEXT, -- JSON blocks template
    
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(notification_type, channel, language)
);

CREATE INDEX IF NOT EXISTS idx_templates_type ON notification_templates(notification_type);
