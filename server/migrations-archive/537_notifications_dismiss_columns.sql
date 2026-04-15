-- Migration 537: Add dismissal fields to notifications (SQLite drift fix)
-- Some dev DBs have an older `notifications` schema (e.g. `read` column) without dismissal support.
-- Backend queries expect `is_dismissed` and `dismissed_at`.

ALTER TABLE notifications ADD COLUMN is_dismissed INTEGER DEFAULT 0;
ALTER TABLE notifications ADD COLUMN dismissed_at TEXT;

CREATE INDEX IF NOT EXISTS idx_notifications_is_dismissed ON notifications(is_dismissed);

