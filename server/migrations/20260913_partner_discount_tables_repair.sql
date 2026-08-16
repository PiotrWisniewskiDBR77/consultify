-- Fresh-install repair for the Partner attribution registration seam.
--
-- The historical 217 migration is outside the canonical PostgreSQL execution
-- set, while auth registration still performs an optional lookup against these
-- tables after writing partner_attributions. This repair is structural only:
-- it deliberately seeds no discount value or commercial policy.

CREATE TABLE IF NOT EXISTS partner_discount_config (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  discount_type TEXT NOT NULL DEFAULT 'PERCENTAGE'
    CHECK (discount_type IN ('PERCENTAGE', 'FLAT')),
  discount_value REAL NOT NULL,
  duration_months INTEGER NOT NULL,
  max_discount_per_month REAL,
  tier_overrides TEXT DEFAULT '{}',
  -- Existing Partner readers and writers use the cross-engine 0/1 contract.
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS organization_discounts (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  organization_id TEXT NOT NULL,
  -- partner_organizations.id is UUID on the canonical PostgreSQL baseline,
  -- while legacy consumers still bind this value through TEXT contracts.
  -- Keep the historical TEXT shape; cross-type FK repair belongs to cutover.
  partner_org_id TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('PERCENTAGE', 'FLAT')),
  discount_value REAL NOT NULL,
  start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  end_date TIMESTAMP NOT NULL,
  total_discount_applied REAL DEFAULT 0.00,
  status TEXT DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_org_discounts_org_id
  ON organization_discounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_discounts_partner_id
  ON organization_discounts(partner_org_id);
CREATE INDEX IF NOT EXISTS idx_org_discounts_status
  ON organization_discounts(status);
