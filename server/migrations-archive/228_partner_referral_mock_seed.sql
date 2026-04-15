-- Migration: 228_partner_referral_mock_seed.sql
-- Purpose: Seed demo data for Partner Referrals/Earnings UI (requires migration 216).

WITH partner AS (
    SELECT id FROM partner_organizations LIMIT 1
), org AS (
    SELECT id FROM organizations ORDER BY created_at LIMIT 1
)

-- If no partner exists, insert demo partner org
INSERT OR IGNORE INTO partner_organizations (id, name, referral_code, referral_link_slug, program_type, entity_type, payout_threshold)
SELECT 'partner-mock-1', 'Demo Partner', 'DEMO15', 'demo-partner', 'AFFILIATE', 'COMPANY', 100.00
WHERE NOT EXISTS (SELECT 1 FROM partner_organizations);

-- Use existing partner or the inserted one
INSERT OR IGNORE INTO partner_payout_accounts (
    id, partner_org_id, payout_method, account_details_encrypted, account_name, account_last_four, currency, is_primary, is_verified
) SELECT
    'payout-acc-mock-1',
    COALESCE((SELECT id FROM partner), 'partner-mock-1'),
    'BANK_TRANSFER',
    '{"iban":"PL00123456789000000000000001","bank":"Bank Demo"}',
    'Main Bank',
    '0001',
    'USD',
    true,
    true;

-- Campaign link
INSERT OR IGNORE INTO partner_campaign_links (
    id, partner_org_id, name, link_slug, utm_source, utm_medium, utm_campaign, is_active, created_at
) SELECT
    'camp-mock-1',
    COALESCE((SELECT id FROM partner), 'partner-mock-1'),
    'January Launch',
    'demo-jan',
    'newsletter',
    'email',
    'jan-launch',
    true,
    datetime('now','-10 days');

-- Referral clicks
INSERT OR IGNORE INTO partner_referral_clicks (
    id, partner_org_id, campaign_link_id, clicked_at, ip_hash, user_agent, landing_page
) VALUES
    ('click-mock-1', COALESCE((SELECT id FROM partner), 'partner-mock-1'), 'camp-mock-1', datetime('now','-2 days'), 'iphash1', 'Chrome/120', '/pricing'),
    ('click-mock-2', COALESCE((SELECT id FROM partner), 'partner-mock-1'), 'camp-mock-1', datetime('now','-1 days'), 'iphash2', 'Safari/iOS', '/signup');

-- Attribution and commission
INSERT OR IGNORE INTO partner_attributions (
    id, partner_org_id, organization_id, attribution_type, referral_code_used, referral_link_clicked_at, signup_completed_at,
    first_payment_at, lifetime_value, total_commission_earned, commission_rate_percent, commission_duration_months, status,
    utm_source, utm_medium, utm_campaign, landing_page
) SELECT
    'attr-mock-1',
    COALESCE((SELECT id FROM partner), 'partner-mock-1'),
    (SELECT id FROM org),
    'REFERRAL_LINK',
    'DEMO15',
    datetime('now','-2 days'),
    datetime('now','-1 day'),
    datetime('now','-20 hours'),
    1200.00,
    180.00,
    15.0,
    12,
    'ACTIVE',
    'newsletter',
    'email',
    'jan-launch',
    '/pricing'
WHERE EXISTS (SELECT 1 FROM org);

INSERT OR IGNORE INTO partner_commission_transactions (
    id, partner_org_id, attribution_id, organization_id, amount, currency, commission_rate, status, description, event_type, occurred_at, created_at
) SELECT
    'comm-mock-1',
    COALESCE((SELECT id FROM partner), 'partner-mock-1'),
    'attr-mock-1',
    (SELECT id FROM org),
    45.00,
    'USD',
    0.15,
    'PAID',
    'January subscription',
    'subscription_payment',
    datetime('now','-20 hours'),
    datetime('now','-20 hours')
WHERE EXISTS (SELECT 1 FROM org);

-- Payouts
INSERT OR IGNORE INTO partner_payouts (
    id, partner_org_id, payout_account_id, amount, currency, status, requested_at, processed_at
) VALUES (
    'payout-mock-1',
    COALESCE((SELECT id FROM partner), 'partner-mock-1'),
    'payout-acc-mock-1',
    150.00,
    'USD',
    'PAID',
    datetime('now','-10 hours'),
    datetime('now','-2 hours')
);
