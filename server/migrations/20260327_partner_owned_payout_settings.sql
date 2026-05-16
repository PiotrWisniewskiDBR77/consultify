-- Partner-owned payout settings for active partner portal write continuity

CREATE TABLE IF NOT EXISTS partner_organizations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    tax_id VARCHAR(100),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    website VARCHAR(255),
    logo_url VARCHAR(500),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100),
    tier VARCHAR(50) DEFAULT 'registered' CHECK (tier IN ('registered', 'certified', 'premier', 'elite')),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'inactive')),
    partner_since TIMESTAMP WITH TIME ZONE,
    contract_start_date DATE,
    contract_end_date DATE,
    license_discount_percent DECIMAL(5,2) DEFAULT 0.00,
    commission_rate_percent DECIMAL(5,2) DEFAULT 10.00,
    performance_score INTEGER DEFAULT 0 CHECK (performance_score >= 0 AND performance_score <= 100),
    public_listing_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT,
    updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_partner_orgs_status ON partner_organizations(status);

ALTER TABLE partner_organizations
  ADD COLUMN IF NOT EXISTS auto_payout_enabled BOOLEAN DEFAULT FALSE;
