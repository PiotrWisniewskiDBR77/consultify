CREATE TABLE IF NOT EXISTS admin_iam_invitation_commands (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(id),
  command_type TEXT NOT NULL CHECK (command_type IN ('CREATE', 'RESEND', 'REVOKE')),
  idempotency_key TEXT NOT NULL,
  intent_digest TEXT NOT NULL,
  invitation_id TEXT REFERENCES invitations(id),
  receipt_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS admin_iam_invitation_delivery_attempts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invitation_id TEXT NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  command_id TEXT NOT NULL REFERENCES admin_iam_invitation_commands(id) ON DELETE CASCADE,
  delivery_state TEXT NOT NULL CHECK (delivery_state IN ('SENT', 'FAILED')),
  failure_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_iam_invitation_commands_org_created
  ON admin_iam_invitation_commands (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_iam_invitation_delivery_latest
  ON admin_iam_invitation_delivery_attempts (organization_id, invitation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_iam_member_commands (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(id),
  command_type TEXT NOT NULL CHECK (command_type IN ('ROLE_CHANGE', 'MEMBER_REVOKE')),
  idempotency_key TEXT NOT NULL,
  intent_digest TEXT NOT NULL,
  target_user_id TEXT NOT NULL REFERENCES users(id),
  receipt_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, idempotency_key)
);
