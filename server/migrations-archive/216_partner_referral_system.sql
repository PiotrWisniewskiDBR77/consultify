-- =============================================================================
-- Migration: 216_partner_referral_system.sql
-- Description: Complete Partner Referral System for SaaS Enterprise
--              Includes referral codes, attribution tracking, commissions, payouts
-- Author: AI Agent
-- Date: 2026-01-09
-- =============================================================================

-- =============================================================================
-- PARTNER ACCOUNTS (Extended from partner_organizations)
-- Supports both Individuals (Affiliates) and Companies (Solution Partners)
-- =============================================================================

-- Add new columns to partner_organizations if not exists
ALTER TABLE partner_organizations ADD COLUMN IF NOT EXISTS entity_type VARCHAR(20) DEFAULT 'COMPANY' 
    CHECK (entity_type IN ('INDIVIDUAL', 'COMPANY'));
ALTER TABLE partner_organizations ADD COLUMN IF NOT EXISTS program_type VARCHAR(30) DEFAULT 'SOLUTION'
    CHECK (program_type IN ('AFFILIATE', 'REFERRAL', 'RESELLER', 'SOLUTION', 'TECHNOLOGY'));
ALTER TABLE partner_organizations ADD COLUMN IF NOT EXISTS referral_code VARCHAR(50) UNIQUE;
ALTER TABLE partner_organizations ADD COLUMN IF NOT EXISTS referral_link_slug VARCHAR(100) UNIQUE;
ALTER TABLE partner_organizations ADD COLUMN IF NOT EXISTS payout_threshold DECIMAL(10,2) DEFAULT 100.00;
ALTER TABLE partner_organizations ADD COLUMN IF NOT EXISTS payout_method VARCHAR(30) DEFAULT 'BANK_TRANSFER'
    CHECK (payout_method IN ('BANK_TRANSFER', 'PAYPAL', 'STRIPE', 'WISE'));
ALTER TABLE partner_organizations ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE partner_organizations ADD COLUMN IF NOT EXISTS individual_user_id UUID; -- For INDIVIDUAL type only

-- =============================================================================
-- PARTNER PAYOUT ACCOUNTS
-- Bank/PayPal accounts for receiving commissions
-- =============================================================================

CREATE TABLE IF NOT EXISTS partner_payout_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_org_id UUID NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
    
    payout_method VARCHAR(30) NOT NULL CHECK (payout_method IN ('BANK_TRANSFER', 'PAYPAL', 'STRIPE', 'WISE')),
    
    -- Encrypted account details (JSON blob)
    account_details_encrypted TEXT NOT NULL, -- Encrypted JSON with bank details
    account_name VARCHAR(255),               -- Display name (e.g., "Main Bank Account")
    account_last_four VARCHAR(10),           -- Last 4 digits for display
    currency VARCHAR(3) DEFAULT 'EUR',
    
    is_primary BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_primary_account UNIQUE (partner_org_id, is_primary) 
        DEFERRABLE INITIALLY DEFERRED
);

-- =============================================================================
-- PARTNER ATTRIBUTIONS
-- Links organizations to their referring partner (who brought the customer)
-- =============================================================================

CREATE TABLE IF NOT EXISTS partner_attributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_org_id UUID NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL, -- References organizations table (the customer)
    
    attribution_type VARCHAR(30) NOT NULL CHECK (attribution_type IN (
        'REFERRAL_LINK',    -- Via partner's unique link
        'PROMO_CODE',       -- Via partner's promo code
        'MANUAL',           -- Manually assigned by admin
        'ACCESS_CODE',      -- Via access code system
        'DEAL_REGISTRATION' -- Partner registered the deal
    )),
    
    -- Tracking data
    referral_code_used VARCHAR(50),
    referral_link_clicked_at TIMESTAMP WITH TIME ZONE,
    signup_completed_at TIMESTAMP WITH TIME ZONE,
    first_payment_at TIMESTAMP WITH TIME ZONE,
    
    -- Financial tracking
    lifetime_value DECIMAL(12,2) DEFAULT 0.00,
    total_commission_earned DECIMAL(12,2) DEFAULT 0.00,
    
    -- Commission terms at time of attribution
    commission_rate_percent DECIMAL(5,2) NOT NULL,
    commission_duration_months INTEGER DEFAULT 12, -- How long partner earns commission
    
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN (
        'PENDING',      -- Signup but no payment yet
        'ACTIVE',       -- Paying customer
        'CHURNED',      -- Customer left
        'DISPUTED',     -- Attribution disputed
        'EXPIRED'       -- Commission period ended
    )),
    
    -- Metadata
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    landing_page VARCHAR(500),
    ip_hash VARCHAR(64),
    user_agent TEXT,
    
    attributed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_org_attribution UNIQUE (organization_id)
);

-- =============================================================================
-- PARTNER COMMISSION TRANSACTIONS
-- Individual commission events (subscription payments, renewals, etc.)
-- =============================================================================

CREATE TABLE IF NOT EXISTS partner_commission_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_org_id UUID NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
    attribution_id UUID REFERENCES partner_attributions(id) ON DELETE SET NULL,
    organization_id UUID NOT NULL, -- The customer organization
    
    transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN (
        'INITIAL',          -- First payment
        'SUBSCRIPTION',     -- Recurring subscription
        'RENEWAL',          -- Annual renewal
        'UPSELL',           -- Upgrade to higher plan
        'ONE_TIME',         -- One-time purchase
        'REFUND',           -- Refund (negative commission)
        'BONUS'             -- Manual bonus
    )),
    
    -- Financial details
    transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
    billing_period_start DATE,
    billing_period_end DATE,
    
    gross_amount DECIMAL(12,2) NOT NULL,      -- Customer payment amount
    commission_rate DECIMAL(5,2) NOT NULL,     -- Rate applied
    commission_amount DECIMAL(12,2) NOT NULL,  -- Calculated commission
    currency VARCHAR(3) DEFAULT 'EUR',
    
    -- External references
    invoice_id VARCHAR(100),                   -- Our invoice ID
    stripe_payment_id VARCHAR(100),            -- Stripe payment intent
    stripe_invoice_id VARCHAR(100),
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN (
        'PENDING',      -- Awaiting approval
        'APPROVED',     -- Approved, ready for payout
        'PAID',         -- Included in payout
        'CANCELLED',    -- Cancelled (e.g., refund)
        'DISPUTED'      -- Under dispute
    )),
    
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID,
    payout_id UUID, -- References partner_payouts when paid
    
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- PARTNER PAYOUTS
-- Batch payouts to partners
-- =============================================================================

CREATE TABLE IF NOT EXISTS partner_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_org_id UUID NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
    payout_account_id UUID REFERENCES partner_payout_accounts(id) ON DELETE SET NULL,
    
    -- Period covered
    payout_period_start DATE NOT NULL,
    payout_period_end DATE NOT NULL,
    
    -- Amounts
    gross_amount DECIMAL(12,2) NOT NULL,       -- Sum of commissions
    fees DECIMAL(10,2) DEFAULT 0.00,           -- Transfer fees
    tax_withheld DECIMAL(10,2) DEFAULT 0.00,   -- Tax withholding
    net_amount DECIMAL(12,2) NOT NULL,         -- Amount actually paid
    currency VARCHAR(3) DEFAULT 'EUR',
    
    -- Transaction count
    transaction_count INTEGER DEFAULT 0,
    
    -- Status
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN (
        'PENDING',      -- Payout requested
        'PROCESSING',   -- Being processed
        'COMPLETED',    -- Paid successfully
        'FAILED',       -- Payment failed
        'CANCELLED'     -- Cancelled
    )),
    
    -- Payment details
    payout_method VARCHAR(30),
    payout_reference VARCHAR(100),             -- Bank transfer reference
    external_payout_id VARCHAR(100),           -- Stripe/PayPal payout ID
    
    -- Processing
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    requested_by UUID,
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by UUID,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    failure_reason TEXT,
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- PARTNER REFERRAL CLICKS
-- Track link clicks for analytics
-- =============================================================================

CREATE TABLE IF NOT EXISTS partner_referral_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_org_id UUID NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
    referral_code VARCHAR(50) NOT NULL,
    
    clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Tracking data (anonymized)
    ip_hash VARCHAR(64),
    user_agent TEXT,
    referer VARCHAR(500),
    landing_page VARCHAR(500),
    
    -- UTM parameters
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    utm_content VARCHAR(100),
    utm_term VARCHAR(100),
    
    -- Conversion tracking
    converted BOOLEAN DEFAULT false,
    converted_at TIMESTAMP WITH TIME ZONE,
    converted_organization_id UUID,
    conversion_type VARCHAR(30), -- SIGNUP, TRIAL, PAID
    
    -- Session tracking
    session_id VARCHAR(100),
    cookie_id VARCHAR(100)
);

-- =============================================================================
-- PARTNER CAMPAIGN LINKS
-- Custom campaign links with UTM parameters
-- =============================================================================

CREATE TABLE IF NOT EXISTS partner_campaign_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_org_id UUID NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Link configuration
    slug VARCHAR(100) NOT NULL,                -- Short slug for the link
    destination_url VARCHAR(500) DEFAULT '/',  -- Where to redirect
    
    -- UTM parameters
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    utm_content VARCHAR(100),
    
    -- Stats (denormalized for performance)
    click_count INTEGER DEFAULT 0,
    signup_count INTEGER DEFAULT 0,
    conversion_count INTEGER DEFAULT 0,
    
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_partner_campaign_slug UNIQUE (partner_org_id, slug)
);

-- =============================================================================
-- PARTNER TAX INFORMATION
-- W-9, W-8BEN, VAT details for compliance
-- =============================================================================

CREATE TABLE IF NOT EXISTS partner_tax_info (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_org_id UUID NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
    
    -- Tax form type
    tax_form_type VARCHAR(20) CHECK (tax_form_type IN ('W9', 'W8BEN', 'W8BENE', 'VAT', 'OTHER')),
    
    -- Encrypted tax details
    tax_details_encrypted TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN (
        'PENDING',      -- Not submitted
        'SUBMITTED',    -- Submitted, awaiting review
        'APPROVED',     -- Approved
        'REJECTED',     -- Rejected, needs resubmission
        'EXPIRED'       -- Form expired
    )),
    
    submitted_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Document storage
    document_url VARCHAR(500),
    
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_partner_tax_info UNIQUE (partner_org_id)
);

-- =============================================================================
-- PARTNER AGREEMENTS (for tracking signed agreements)
-- =============================================================================

CREATE TABLE IF NOT EXISTS partner_agreement_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_org_id UUID NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    
    agreement_version VARCHAR(20) NOT NULL,
    agreement_type VARCHAR(30) NOT NULL CHECK (agreement_type IN (
        'AFFILIATE_TERMS',
        'PARTNER_AGREEMENT',
        'RESELLER_AGREEMENT',
        'NDA',
        'DATA_PROCESSING'
    )),
    
    signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    -- Document reference
    document_url VARCHAR(500),
    signature_hash VARCHAR(64),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Partner organization indexes
CREATE INDEX IF NOT EXISTS idx_partner_orgs_referral_code ON partner_organizations(referral_code);
CREATE INDEX IF NOT EXISTS idx_partner_orgs_referral_slug ON partner_organizations(referral_link_slug);
CREATE INDEX IF NOT EXISTS idx_partner_orgs_program_type ON partner_organizations(program_type);
CREATE INDEX IF NOT EXISTS idx_partner_orgs_status ON partner_organizations(status);

-- Attribution indexes
CREATE INDEX IF NOT EXISTS idx_partner_attributions_partner ON partner_attributions(partner_org_id);
CREATE INDEX IF NOT EXISTS idx_partner_attributions_org ON partner_attributions(organization_id);
CREATE INDEX IF NOT EXISTS idx_partner_attributions_code ON partner_attributions(referral_code_used);
CREATE INDEX IF NOT EXISTS idx_partner_attributions_status ON partner_attributions(status);

-- Commission transaction indexes
CREATE INDEX IF NOT EXISTS idx_partner_commissions_partner ON partner_commission_transactions(partner_org_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_org ON partner_commission_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_status ON partner_commission_transactions(status);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_date ON partner_commission_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_payout ON partner_commission_transactions(payout_id);

-- Payout indexes
CREATE INDEX IF NOT EXISTS idx_partner_payouts_partner ON partner_payouts(partner_org_id);
CREATE INDEX IF NOT EXISTS idx_partner_payouts_status ON partner_payouts(status);
CREATE INDEX IF NOT EXISTS idx_partner_payouts_period ON partner_payouts(payout_period_start, payout_period_end);

-- Click tracking indexes
CREATE INDEX IF NOT EXISTS idx_partner_clicks_partner ON partner_referral_clicks(partner_org_id);
CREATE INDEX IF NOT EXISTS idx_partner_clicks_code ON partner_referral_clicks(referral_code);
CREATE INDEX IF NOT EXISTS idx_partner_clicks_date ON partner_referral_clicks(clicked_at);
CREATE INDEX IF NOT EXISTS idx_partner_clicks_converted ON partner_referral_clicks(converted) WHERE converted = true;

-- Campaign link indexes
CREATE INDEX IF NOT EXISTS idx_partner_campaigns_partner ON partner_campaign_links(partner_org_id);
CREATE INDEX IF NOT EXISTS idx_partner_campaigns_active ON partner_campaign_links(is_active) WHERE is_active = true;

-- =============================================================================
-- FUNCTIONS & TRIGGERS
-- =============================================================================

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION generate_partner_referral_code()
RETURNS TRIGGER AS $$
DECLARE
    new_code VARCHAR(50);
    code_exists BOOLEAN;
BEGIN
    -- Only generate if not already set
    IF NEW.referral_code IS NULL THEN
        LOOP
            -- Generate code: PARTNER-XXXXXX (6 random alphanumeric chars)
            new_code := 'PARTNER-' || upper(substring(md5(random()::text) from 1 for 6));
            
            -- Check if exists
            SELECT EXISTS(SELECT 1 FROM partner_organizations WHERE referral_code = new_code) INTO code_exists;
            
            EXIT WHEN NOT code_exists;
        END LOOP;
        
        NEW.referral_code := new_code;
    END IF;
    
    -- Also generate slug if not set
    IF NEW.referral_link_slug IS NULL THEN
        NEW.referral_link_slug := lower(replace(NEW.referral_code, '-', ''));
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-generating referral codes
DROP TRIGGER IF EXISTS trg_generate_partner_referral_code ON partner_organizations;
CREATE TRIGGER trg_generate_partner_referral_code
    BEFORE INSERT ON partner_organizations
    FOR EACH ROW
    EXECUTE FUNCTION generate_partner_referral_code();

-- Function to update attribution LTV
CREATE OR REPLACE FUNCTION update_attribution_ltv()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF NEW.status = 'APPROVED' OR NEW.status = 'PAID' THEN
            UPDATE partner_attributions
            SET 
                lifetime_value = lifetime_value + NEW.gross_amount,
                total_commission_earned = total_commission_earned + NEW.commission_amount,
                updated_at = NOW()
            WHERE id = NEW.attribution_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_attribution_ltv ON partner_commission_transactions;
CREATE TRIGGER trg_update_attribution_ltv
    AFTER INSERT OR UPDATE ON partner_commission_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_attribution_ltv();

-- Function to increment click count on campaign links
CREATE OR REPLACE FUNCTION increment_campaign_click()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE partner_campaign_links
    SET click_count = click_count + 1, updated_at = NOW()
    WHERE partner_org_id = NEW.partner_org_id 
      AND slug = split_part(NEW.referral_code, '-', 2);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- VIEWS FOR REPORTING
-- =============================================================================

-- Partner earnings summary view
CREATE OR REPLACE VIEW v_partner_earnings_summary AS
SELECT 
    po.id AS partner_org_id,
    po.name AS partner_name,
    po.tier,
    po.program_type,
    po.referral_code,
    COUNT(DISTINCT pa.id) AS total_attributions,
    COUNT(DISTINCT pa.id) FILTER (WHERE pa.status = 'ACTIVE') AS active_customers,
    SUM(pa.lifetime_value) AS total_customer_ltv,
    SUM(pa.total_commission_earned) AS total_commission_earned,
    COUNT(DISTINCT pct.id) AS total_transactions,
    SUM(pct.commission_amount) FILTER (WHERE pct.status = 'PENDING') AS pending_commission,
    SUM(pct.commission_amount) FILTER (WHERE pct.status = 'APPROVED') AS approved_commission,
    SUM(pct.commission_amount) FILTER (WHERE pct.status = 'PAID') AS paid_commission,
    SUM(pp.net_amount) FILTER (WHERE pp.status = 'COMPLETED') AS total_payouts
FROM partner_organizations po
LEFT JOIN partner_attributions pa ON pa.partner_org_id = po.id
LEFT JOIN partner_commission_transactions pct ON pct.partner_org_id = po.id
LEFT JOIN partner_payouts pp ON pp.partner_org_id = po.id
GROUP BY po.id, po.name, po.tier, po.program_type, po.referral_code;

-- Partner referral funnel view
CREATE OR REPLACE VIEW v_partner_referral_funnel AS
SELECT 
    po.id AS partner_org_id,
    po.name AS partner_name,
    po.referral_code,
    COUNT(prc.id) AS total_clicks,
    COUNT(DISTINCT prc.id) FILTER (WHERE prc.converted = true) AS signups,
    COUNT(DISTINCT pa.id) FILTER (WHERE pa.status = 'PENDING') AS trials,
    COUNT(DISTINCT pa.id) FILTER (WHERE pa.status = 'ACTIVE') AS paid_customers,
    ROUND(
        COUNT(DISTINCT pa.id) FILTER (WHERE pa.status = 'ACTIVE') * 100.0 / 
        NULLIF(COUNT(prc.id), 0), 2
    ) AS conversion_rate
FROM partner_organizations po
LEFT JOIN partner_referral_clicks prc ON prc.partner_org_id = po.id
LEFT JOIN partner_attributions pa ON pa.partner_org_id = po.id
GROUP BY po.id, po.name, po.referral_code;

-- =============================================================================
-- SEED DATA: Commission Rates by Tier
-- =============================================================================

-- Update existing partner organizations with referral codes if missing
UPDATE partner_organizations 
SET 
    referral_code = 'PARTNER-' || upper(substring(md5(id::text) from 1 for 6)),
    referral_link_slug = lower('partner' || substring(md5(id::text) from 1 for 6))
WHERE referral_code IS NULL;

-- Log migration
INSERT INTO schema_migrations (version, description, applied_at) 
VALUES ('216', 'Partner Referral System - Complete', NOW())
ON CONFLICT (version) DO NOTHING;
