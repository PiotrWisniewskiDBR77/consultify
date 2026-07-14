-- Migration: Notification enhancements
-- Adds columns for severity, enriched data, snooze, checklist, and related objects
-- Uses IF NOT EXISTS pattern for safety (columns may already exist from seed scripts)

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    icon TEXT,
    priority TEXT DEFAULT 'normal',
    entity_type TEXT,
    entity_id TEXT,
    action_url TEXT,
    actor_id TEXT,
    actor_name TEXT,
    metadata TEXT DEFAULT '{}',
    is_read INTEGER DEFAULT 0,
    read INTEGER DEFAULT 0,
    read_at TIMESTAMP,
    is_dismissed INTEGER DEFAULT 0,
    dismissed_at TIMESTAMP,
    channels_sent TEXT DEFAULT '[]',
    email_sent INTEGER DEFAULT 0,
    email_sent_at TIMESTAMP,
    email_message_id TEXT,
    email_delivered INTEGER DEFAULT 0,
    email_opened INTEGER DEFAULT 0,
    email_opened_at TIMESTAMP,
    slack_sent INTEGER DEFAULT 0,
    slack_sent_at TIMESTAMP,
    slack_message_ts TEXT,
    group_key TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- FRESH-DB CONVERGENCE (2026-07-14): on a fresh replay the notifications table
-- already exists in a minimal shape from 000_z_core_baseline.sql (the fuller
-- 257_notification_system.sql is filtered out as <500 legacy), so the CREATE
-- above is a no-op and the indexes below would fail on missing columns.
-- Converge any pre-existing table to this file's declared shape first.
-- Every ADD COLUMN IF NOT EXISTS is a no-op where the column already exists.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_id TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_id TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_name TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata TEXT DEFAULT '{}';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read INTEGER DEFAULT 0;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read INTEGER DEFAULT 0;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMP;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_dismissed INTEGER DEFAULT 0;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMP;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS channels_sent TEXT DEFAULT '[]';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_sent INTEGER DEFAULT 0;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_message_id TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_delivered INTEGER DEFAULT 0;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_opened INTEGER DEFAULT 0;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_opened_at TIMESTAMP;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS slack_sent INTEGER DEFAULT 0;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS slack_sent_at TIMESTAMP;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS slack_message_ts TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS group_key TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notifications(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_group ON notifications(group_key);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'INFO';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS related_object_type TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS related_object_id TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_actionable INTEGER DEFAULT 0;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read INTEGER DEFAULT 0;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read INTEGER DEFAULT 0;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS snoozed_until TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS checklist TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS initiative_id TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS task_id TEXT;

-- Update existing notifications: sync is_read with read column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notifications'
      AND column_name = 'read'
  ) THEN
    UPDATE notifications SET is_read = 1 WHERE is_read = 0 AND read = 1;
  END IF;
END $$;

-- Update existing notifications: compute severity from type for rows with NULL severity
UPDATE notifications SET severity = 'CRITICAL'
  WHERE (severity IS NULL OR severity = '')
  AND type IN ('SYSTEM_ALERT', 'DECISION_OVERDUE');

UPDATE notifications SET severity = 'WARNING'
  WHERE (severity IS NULL OR severity = '')
  AND type IN ('TASK_OVERDUE', 'TASK_BLOCKED', 'DECISION_REQUIRED', 'GATE_PENDING_APPROVAL', 'AI_RISK_DETECTED', 'AI_OVERLOAD_DETECTED', 'AI_DEPENDENCY_CONFLICT');

UPDATE notifications SET severity = 'INFO'
  WHERE severity IS NULL OR severity = '';

-- Sync message from body where message is empty
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notifications'
      AND column_name = 'body'
  ) THEN
    UPDATE notifications
    SET message = body
    WHERE (message IS NULL OR message = '')
      AND body IS NOT NULL AND body != '';
  END IF;
END $$;
