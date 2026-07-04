-- 039: Table Platform Notifications Inbox
--
-- `tp_audit_events` was write-only for two producers:
--   - RecordWatchService.notifyWatchers() writes `watch_update`/`watch_delete`
--     rows with the recipient buried in `metadata.notified_user` — nothing
--     ever read them back.
--   - RecordCommentService.addComment() persists `mentions` (JSONB array on
--     tp_record_comments) but no notification row was ever created for the
--     mentioned users.
--
-- This adds a first-class recipient + read-state to tp_audit_events so a
-- per-user inbox can be read (GET /api/table-platform/notifications) without
-- inventing a parallel notifications table. Existing audit-only rows (no
-- recipient) are unaffected — notified_user_id stays NULL for them and they
-- are excluded from inbox queries (WHERE notified_user_id = $1).

ALTER TABLE tp_audit_events
  ADD COLUMN IF NOT EXISTS notified_user_id TEXT;

ALTER TABLE tp_audit_events
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tp_audit_notified_user
  ON tp_audit_events (notified_user_id, created_at DESC)
  WHERE notified_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tp_audit_notified_user_unread
  ON tp_audit_events (notified_user_id)
  WHERE notified_user_id IS NOT NULL AND read_at IS NULL;
