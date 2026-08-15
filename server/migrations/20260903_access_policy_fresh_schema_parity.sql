-- AccessPolicyService fresh-install schema parity.
--
-- The runtime bootstrap historically added these columns from
-- PostgresDatabase.initDb(), while the ordered migration chain did not. A
-- migrations-only fresh database therefore failed closed for every project
-- write. Keep this forward-only and safe for existing installations.

ALTER TABLE IF EXISTS organizations
  ADD COLUMN IF NOT EXISTS trial_tokens_used INTEGER;

UPDATE organizations
SET trial_tokens_used = 0
WHERE trial_tokens_used IS NULL;

ALTER TABLE IF EXISTS organizations
  ALTER COLUMN trial_tokens_used SET DEFAULT 0,
  ALTER COLUMN trial_tokens_used SET NOT NULL;

ALTER TABLE IF EXISTS organization_billing
  ADD COLUMN IF NOT EXISTS billing_rail TEXT,
  ADD COLUMN IF NOT EXISTS contract_status TEXT,
  ADD COLUMN IF NOT EXISTS grace_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS access_expires_at TIMESTAMPTZ;

UPDATE organization_billing
SET billing_rail = 'stripe_subscription'
WHERE billing_rail IS NULL;

ALTER TABLE IF EXISTS organization_billing
  ALTER COLUMN billing_rail SET DEFAULT 'stripe_subscription',
  ALTER COLUMN billing_rail SET NOT NULL;
