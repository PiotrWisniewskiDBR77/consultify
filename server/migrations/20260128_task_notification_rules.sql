-- Migration: Task notification rules & throttling
-- Adds minimal PMO notification rules and last-sent timestamps to avoid spam.

ALTER TABLE tasks ADD COLUMN notify_on_overdue INTEGER DEFAULT 1;
ALTER TABLE tasks ADD COLUMN notify_on_acceptance INTEGER DEFAULT 1;
ALTER TABLE tasks ADD COLUMN notify_on_unassigned INTEGER DEFAULT 1;
ALTER TABLE tasks ADD COLUMN notify_on_blocked INTEGER DEFAULT 1;

ALTER TABLE tasks ADD COLUMN last_overdue_notified_at TEXT;
ALTER TABLE tasks ADD COLUMN last_acceptance_notified_at TEXT;
ALTER TABLE tasks ADD COLUMN last_unassigned_notified_at TEXT;
ALTER TABLE tasks ADD COLUMN last_blocked_notified_at TEXT;

CREATE INDEX IF NOT EXISTS idx_tasks_last_overdue_notified ON tasks(last_overdue_notified_at);
