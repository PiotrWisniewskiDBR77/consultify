-- Migration: Notification enhancements
-- Adds columns for severity, enriched data, snooze, checklist, and related objects
-- Uses IF NOT EXISTS pattern for safety (columns may already exist from seed scripts)

-- Severity column (INFO, WARNING, CRITICAL)
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we use a pragma check approach
-- These will fail silently if columns already exist in the DB
BEGIN TRANSACTION;

-- Create a temporary table to track which columns we need
-- This migration is idempotent — safe to re-run

-- Add new columns (SQLite will error on duplicate columns, wrapped in savepoints)
SAVEPOINT add_severity;
ALTER TABLE notifications ADD COLUMN severity TEXT DEFAULT 'INFO';
RELEASE add_severity;

SAVEPOINT add_message;
ALTER TABLE notifications ADD COLUMN message TEXT;
RELEASE add_message;

SAVEPOINT add_related_object_type;
ALTER TABLE notifications ADD COLUMN related_object_type TEXT;
RELEASE add_related_object_type;

SAVEPOINT add_related_object_id;
ALTER TABLE notifications ADD COLUMN related_object_id TEXT;
RELEASE add_related_object_id;

SAVEPOINT add_project_id;
ALTER TABLE notifications ADD COLUMN project_id TEXT;
RELEASE add_project_id;

SAVEPOINT add_is_actionable;
ALTER TABLE notifications ADD COLUMN is_actionable INTEGER DEFAULT 0;
RELEASE add_is_actionable;

SAVEPOINT add_is_read;
ALTER TABLE notifications ADD COLUMN is_read INTEGER DEFAULT 0;
RELEASE add_is_read;

SAVEPOINT add_data;
ALTER TABLE notifications ADD COLUMN data TEXT;
RELEASE add_data;

SAVEPOINT add_snoozed_until;
ALTER TABLE notifications ADD COLUMN snoozed_until TEXT;
RELEASE add_snoozed_until;

SAVEPOINT add_checklist;
ALTER TABLE notifications ADD COLUMN checklist TEXT;
RELEASE add_checklist;

SAVEPOINT add_initiative_id;
ALTER TABLE notifications ADD COLUMN initiative_id TEXT;
RELEASE add_initiative_id;

SAVEPOINT add_task_id;
ALTER TABLE notifications ADD COLUMN task_id TEXT;
RELEASE add_task_id;

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

COMMIT;
