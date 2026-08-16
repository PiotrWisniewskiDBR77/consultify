-- INT-BVP-001: durable invite expiry/revocation. Public tokens remain opaque;
-- every active invite has a hard expiry and revocation is durable.

ALTER TABLE interview_distributions
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE interview_distributions
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE interview_distributions
  ADD COLUMN IF NOT EXISTS revoked_by TEXT;

UPDATE interview_distributions
   SET expires_at = COALESCE(created_at, CURRENT_TIMESTAMP) + INTERVAL '7 days'
 WHERE expires_at IS NULL;

ALTER TABLE interview_distributions
  ALTER COLUMN expires_at SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days');
ALTER TABLE interview_distributions
  ALTER COLUMN expires_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_interview_distributions_active_token
  ON interview_distributions(public_token, expires_at)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_interview_distributions_org_session_governance
  ON interview_distributions(organization_id, session_id, revoked_at, expires_at);
