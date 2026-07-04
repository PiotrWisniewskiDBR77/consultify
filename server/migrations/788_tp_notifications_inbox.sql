-- Table Platform notification inbox (P7).
-- Read-model for record-watch / mention events so users can actually READ
-- notifications instead of them being write-only into tp_audit_events.

CREATE TABLE IF NOT EXISTS tp_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,           -- recipient
  base_id UUID,
  table_id UUID,
  record_id UUID,
  type TEXT NOT NULL,              -- 'record_changed' | 'mention' | 'watch'
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Primary access path: a user's inbox, unread-first, newest-first.
CREATE INDEX IF NOT EXISTS idx_tp_notifications_user_inbox
  ON tp_notifications (user_id, read_at, created_at DESC);

-- Org scoping guard for tenant-scoped queries.
CREATE INDEX IF NOT EXISTS idx_tp_notifications_org
  ON tp_notifications (org_id);
