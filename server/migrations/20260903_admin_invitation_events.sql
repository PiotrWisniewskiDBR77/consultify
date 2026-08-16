-- ADM-BVP-001: durable invitation lifecycle audit.
-- The InvitationDataService has always treated this table as its event owner,
-- but a strict PostgreSQL schema had no corresponding migration. That made
-- invite/accept/revoke appear successful while every audit insert was swallowed.
CREATE TABLE IF NOT EXISTS invitation_events (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  performed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  ip_address TEXT,
  user_agent TEXT,
  metadata TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invitation_events_invitation_created
  ON invitation_events(invitation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_invitation_events_actor_created
  ON invitation_events(performed_by_user_id, created_at)
  WHERE performed_by_user_id IS NOT NULL;
