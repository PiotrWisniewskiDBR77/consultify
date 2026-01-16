-- Migration: 228_partner_referral_mock_seed.sql
-- Purpose: Seed demo data for Partner Referrals/Earnings UI (requires migration 216).

-- If no partner exists, insert demo partner org
INSERT INTO partner_organizations (id, name, contact_email, referral_code, referral_link_slug, program_type, entity_type, payout_threshold)
SELECT 'partner-mock-1'::uuid, 'Demo Partner', 'demo@partner.example.com', 'DEMO15', 'demo-partner', 'AFFILIATE', 'COMPANY', 100.00
WHERE NOT EXISTS (SELECT 1 FROM partner_organizations)
ON CONFLICT (id) DO NOTHING;

-- Use existing partner or the inserted one
WITH partner AS (
    SELECT id FROM partner_organizations LIMIT 1
)
INSERT INTO partner_payout_accounts (
    id, partner_org_id, payout_method, account_details_encrypted, account_name, account_last_four, currency, is_primary, is_verified
) SELECT
    'payout-acc-mock-1'::uuid,
    COALESCE((SELECT id FROM partner), 'partner-mock-1'::uuid),
    'BANK_TRANSFER',
    '{"iban":"PL00123456789000000000000001","bank":"Bank Demo"}',
    'Main Bank',
    '0001',
    'USD',
    true::boolean,
    true::boolean
WHERE NOT EXISTS (SELECT 1 FROM partner_payout_accounts WHERE id = 'payout-acc-mock-1'::uuid)
ON CONFLICT (id) DO NOTHING;

-- Campaign link
WITH partner AS (
    SELECT id FROM partner_organizations LIMIT 1
)
INSERT INTO partner_campaign_links (
    id, partner_org_id, name, link_slug, utm_source, utm_medium, utm_campaign, is_active, created_at
) SELECT
    'camp-mock-1'::uuid,
    COALESCE((SELECT id FROM partner), 'partner-mock-1'::uuid),
    'January Launch',
    'demo-jan',
    'newsletter',
    'email',
    'jan-launch',
    true::boolean,
    CURRENT_TIMESTAMP - INTERVAL '10 days'
ON CONFLICT (id) DO NOTHING;

-- Referral clicks
WITH partner AS (
    SELECT id FROM partner_organizations LIMIT 1
)
INSERT INTO partner_referral_clicks (
    id, partner_org_id, campaign_link_id, clicked_at, ip_hash, user_agent, landing_page
) VALUES
    ('click-mock-1'::uuid, COALESCE((SELECT id FROM partner), 'partner-mock-1'::uuid), 'camp-mock-1'::uuid, CURRENT_TIMESTAMP - INTERVAL '2 days', 'iphash1', 'Chrome/120', '/pricing'),
    ('click-mock-2'::uuid, COALESCE((SELECT id FROM partner), 'partner-mock-1'::uuid), 'camp-mock-1'::uuid, CURRENT_TIMESTAMP - INTERVAL '1 day', 'iphash2', 'Safari/iOS', '/signup')
ON CONFLICT (id) DO NOTHING;

-- Attribution and commission
WITH partner AS (
    SELECT id FROM partner_organizations LIMIT 1
), org AS (
    SELECT id FROM organizations ORDER BY created_at LIMIT 1
)
INSERT INTO partner_attributions (
    id, partner_org_id, organization_id, attribution_type, referral_code_used, referral_link_clicked_at, signup_completed_at,
    first_payment_at, lifetime_value, total_commission_earned, commission_rate_percent, commission_duration_months, status,
    utm_source, utm_medium, utm_campaign, landing_page
) SELECT
    'attr-mock-1'::uuid,
    COALESCE((SELECT id FROM partner), 'partner-mock-1'::uuid),
    (SELECT id FROM org),
    'REFERRAL_LINK',
    'DEMO15',
    CURRENT_TIMESTAMP - INTERVAL '2 days',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    CURRENT_TIMESTAMP - INTERVAL '20 hours',
    1200.00,
    180.00,
    15.0,
    12,
    'ACTIVE',
    'newsletter',
    'email',
    'jan-launch',
    '/pricing'
WHERE EXISTS (SELECT 1 FROM org)
ON CONFLICT (id) DO NOTHING;

WITH partner AS (
    SELECT id FROM partner_organizations LIMIT 1
), org AS (
    SELECT id FROM organizations ORDER BY created_at LIMIT 1
)
INSERT INTO partner_commission_transactions (
    id, partner_org_id, attribution_id, organization_id, amount, currency, commission_rate, status, description, event_type, occurred_at, created_at
) SELECT
    'comm-mock-1'::uuid,
    COALESCE((SELECT id FROM partner), 'partner-mock-1'::uuid),
    'attr-mock-1'::uuid,
    (SELECT id FROM org),
    45.00,
    'USD',
    0.15,
    'PAID',
    'January subscription',
    'subscription_payment',
    CURRENT_TIMESTAMP - INTERVAL '20 hours',
    CURRENT_TIMESTAMP - INTERVAL '20 hours'
WHERE EXISTS (SELECT 1 FROM org)
ON CONFLICT (id) DO NOTHING;

-- Payouts
WITH partner AS (
    SELECT id FROM partner_organizations LIMIT 1
)
INSERT INTO partner_payouts (
    id, partner_org_id, payout_account_id, amount, currency, status, requested_at, processed_at
) VALUES (
    'payout-mock-1'::uuid,
    COALESCE((SELECT id FROM partner), 'partner-mock-1'::uuid),
    'payout-acc-mock-1'::uuid,
    150.00,
    'USD',
    'PAID',
    CURRENT_TIMESTAMP - INTERVAL '10 hours',
    CURRENT_TIMESTAMP - INTERVAL '2 hours'
)
ON CONFLICT (id) DO NOTHING;
