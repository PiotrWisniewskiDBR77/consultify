-- Restore the PostgreSQL columns consumed by seatManagementService.
--
-- The fresh-DB baseline creates organization_seats as an assignment table and
-- subscription_plans without the seat-policy fields.  The runtime service also
-- persists one organization-level configuration row (user_id IS NULL).  Keep
-- both shapes in the canonical tables and make the configuration cardinality
-- explicit without constraining per-user assignments.

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS seats_included INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seat_price_monthly NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allow_seat_pooling BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS max_seats INTEGER NOT NULL DEFAULT -1;

ALTER TABLE organization_seats
  ADD COLUMN IF NOT EXISTS base_seats_included INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS additional_seats_purchased INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_seats_available INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seats_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_model TEXT NOT NULL DEFAULT 'subscription',
  ADD COLUMN IF NOT EXISTS seat_price_monthly NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_add_seats_on_invite BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_add_seats_threshold INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seat_pool_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS uq_organization_seats_config
  ON organization_seats (organization_id)
  WHERE user_id IS NULL;
