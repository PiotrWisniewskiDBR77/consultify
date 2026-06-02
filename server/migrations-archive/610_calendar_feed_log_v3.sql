-- Migration: 610_calendar_feed_log_v3.sql
-- Purpose: Always-on audit log for ICS calendar feed generation (V3-M05)
-- Date: 2026-02-27

CREATE TABLE IF NOT EXISTS calendar_feed_log (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  feed_type TEXT NOT NULL DEFAULT 'ics',
  items_tasks INTEGER DEFAULT 0,
  items_milestones INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  duration_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_calendar_feed_log_org ON calendar_feed_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_calendar_feed_log_created ON calendar_feed_log(created_at);

