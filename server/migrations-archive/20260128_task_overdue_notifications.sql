-- Migration: Task overdue notifications (anti-spam timestamp)
-- Adds a dedicated timestamp so overdue reminders do not interfere with escalation timestamps.

DO $$ BEGIN
  ALTER TABLE tasks ADD COLUMN last_overdue_notified_at TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Helpful index for cron scans (idempotent)
CREATE INDEX IF NOT EXISTS idx_tasks_last_overdue_notified_at ON tasks(last_overdue_notified_at);
