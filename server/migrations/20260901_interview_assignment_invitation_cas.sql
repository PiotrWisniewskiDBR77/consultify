-- INT-001B: governed external Interview assignment access and optimistic CAS.
-- Raw bearer tokens are never persisted; only their SHA-256 digest is stored.

ALTER TABLE interview_assignments
  ADD COLUMN IF NOT EXISTS row_version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS interview_assignment_invitations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  assignment_id TEXT NOT NULL REFERENCES interview_assignments(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoked_by TEXT,
  consumed_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (char_length(token_hash) = 64),
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_interview_assignment_invitation_assignment
  ON interview_assignment_invitations(organization_id, assignment_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ux_interview_assignment_invitation_active
  ON interview_assignment_invitations(assignment_id)
  WHERE revoked_at IS NULL AND consumed_at IS NULL;
