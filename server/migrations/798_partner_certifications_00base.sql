-- Strict runtime-order producer for partner certification state consumed by 799.
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
    partner_since TIMESTAMPTZ,
    contract_start_date DATE,
    contract_end_date DATE,
    license_discount_percent DECIMAL(5,2) DEFAULT 0.00,
    commission_rate_percent DECIMAL(5,2) DEFAULT 10.00,
    performance_score INTEGER DEFAULT 0 CHECK (performance_score >= 0 AND performance_score <= 100),
    public_listing_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,
    updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_partner_orgs_status ON partner_organizations(status);

CREATE TABLE IF NOT EXISTS partner_certifications (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    partner_org_id TEXT NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    certification_name VARCHAR(255) NOT NULL,
    certification_type VARCHAR(50),
    status VARCHAR(50) DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'expired')),
    progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    certificate_id VARCHAR(100),
    certificate_url VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_certifications_partner ON partner_certifications(partner_org_id);
CREATE INDEX IF NOT EXISTS idx_partner_certifications_user ON partner_certifications(user_id);
