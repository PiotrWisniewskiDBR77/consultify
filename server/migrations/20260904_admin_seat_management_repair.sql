-- ADM-BVP-001: reconcile the minimal per-user seat table with the governed
-- organization-level seat configuration used by SeatManagementService.

ALTER TABLE organization_seats ADD COLUMN IF NOT EXISTS base_seats_included INTEGER NOT NULL DEFAULT 0;
ALTER TABLE organization_seats ADD COLUMN IF NOT EXISTS additional_seats_purchased INTEGER NOT NULL DEFAULT 0;
ALTER TABLE organization_seats ADD COLUMN IF NOT EXISTS total_seats_available INTEGER NOT NULL DEFAULT 0;
ALTER TABLE organization_seats ADD COLUMN IF NOT EXISTS seats_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE organization_seats ADD COLUMN IF NOT EXISTS billing_model TEXT NOT NULL DEFAULT 'subscription';
ALTER TABLE organization_seats ADD COLUMN IF NOT EXISTS seat_price_monthly NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE organization_seats ADD COLUMN IF NOT EXISTS auto_add_seats_on_invite INTEGER NOT NULL DEFAULT 0;
ALTER TABLE organization_seats ADD COLUMN IF NOT EXISTS auto_add_seats_threshold INTEGER NOT NULL DEFAULT 80;
ALTER TABLE organization_seats ADD COLUMN IF NOT EXISTS seat_pool_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE organization_seats ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS uq_organization_seat_config
  ON organization_seats (organization_id)
  WHERE user_id IS NULL;

ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS seats_included INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS seat_price_monthly NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS billing_model TEXT NOT NULL DEFAULT 'subscription';
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS allow_seat_pooling INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_seats INTEGER NOT NULL DEFAULT 0;

ALTER TABLE organization_billing ADD COLUMN IF NOT EXISTS billing_rail TEXT;
ALTER TABLE organization_billing ADD COLUMN IF NOT EXISTS contract_status TEXT;
ALTER TABLE organization_billing ADD COLUMN IF NOT EXISTS grace_until TIMESTAMPTZ;
ALTER TABLE organization_billing ADD COLUMN IF NOT EXISTS access_expires_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS seat_transactions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL,
  seats_count INTEGER NOT NULL,
  unit_price NUMERIC(12,2),
  total_amount NUMERIC(14,2),
  billing_period_start TIMESTAMPTZ,
  billing_period_end TIMESTAMPTZ,
  triggered_by TEXT,
  triggered_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_seat_transactions_org_created
  ON seat_transactions (organization_id, created_at DESC);
