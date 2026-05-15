-- Migration: 223_billing_mock_seed.sql
-- Purpose: Seed demo billing data into real tables so UI has data without stubbed endpoints.

-- Use first organization as demo target
WITH org AS (
    SELECT id FROM organizations ORDER BY created_at LIMIT 1
)
-- Seed subscription plans
INSERT OR IGNORE INTO subscription_plans (id, name, description, price_monthly, price_yearly, currency, features, limits, is_active, is_public, trial_days, sort_order)
SELECT 'plan-mock-basic', 'Basic', 'Mock Basic Plan', 4900, 49900, 'USD', '["10 seats","100k tokens","10GB storage"]', '{"tokens":100000,"storage_gb":10}', 1, 1, 14, 1
WHERE EXISTS (SELECT 1 FROM org);

INSERT OR IGNORE INTO subscription_plans (id, name, description, price_monthly, price_yearly, currency, features, limits, is_active, is_public, trial_days, sort_order)
SELECT 'plan-mock-pro', 'Pro', 'Mock Pro Plan', 9900, 99900, 'USD', '["20 seats","500k tokens","50GB storage"]', '{"tokens":500000,"storage_gb":50}', 1, 1, 14, 2
WHERE EXISTS (SELECT 1 FROM org);

-- Seed subscription for org
INSERT OR IGNORE INTO subscriptions (id, organization_id, plan_id, status, billing_cycle, current_period_start, current_period_end)
SELECT 'sub-mock-001', org.id, 'plan-mock-pro', 'active', 'monthly', datetime('now','-5 days'), datetime('now','+25 days')
FROM org;

-- Seed payment methods
INSERT OR IGNORE INTO payment_methods (id, organization_id, stripe_payment_method_id, type, brand, last4, exp_month, exp_year, holder_name, is_default)
SELECT 'pm-mock-visa', org.id, 'pm_visa_mock', 'card', 'Visa', '4242', 12, 2026, 'Demo User', 1 FROM org;

INSERT OR IGNORE INTO payment_methods (id, organization_id, stripe_payment_method_id, type, brand, last4, exp_month, exp_year, holder_name, is_default)
SELECT 'pm-mock-mc', org.id, 'pm_mc_mock', 'card', 'Mastercard', '5454', 11, 2027, 'Demo User', 0 FROM org;

-- Seed billing alerts
INSERT OR IGNORE INTO billing_alerts (id, organization_id, token_threshold_80, token_threshold_90, token_threshold_100, cost_cap_monthly, email_notifications)
SELECT 'alert-mock', org.id, 1, 1, 1, 2000, 1 FROM org;

-- Seed tax settings
INSERT OR IGNORE INTO billing_tax_settings (id, organization_id, tax_id, tax_id_type, tax_exempt, billing_name, billing_email, billing_address_line1, billing_address_line2, billing_city, billing_state, billing_postal_code, billing_country, invoice_prefix, po_number)
SELECT 'tax-mock', org.id, 'PL1234567890', 'VAT', 0, 'Company Legal Name', 'billing@company.com', 'Street address', 'Apartment, suite, etc.', 'City', 'State/Region', '00-000', 'PL', 'ACME-', 'PO-001' FROM org;

-- Seed invoices (amounts in cents)
INSERT OR IGNORE INTO invoices (id, organization_id, invoice_number, status, currency, subtotal, tax_amount, total, amount_paid, amount_due, due_date, paid_at, line_items, metadata)
SELECT 'inv-mock-001', org.id, 'INV-MOCK-001', 'paid', 'USD', 7500, 0, 7500, 7500, 0, datetime('now'), datetime('now'),
       '[{"description":"AI Tokens (45k)","amount":4500},{"description":"Storage 1.5GB","amount":1500},{"description":"Seats (5)","amount":1500}]',
       '{"mock":true}'
FROM org;

-- Seed usage records
INSERT OR IGNORE INTO usage_records (id, organization_id, metric_name, quantity, unit, recorded_at)
SELECT 'usage-mock-tokens', org.id, 'tokens', 45000, 'count', datetime('now','-1 day') FROM org;

INSERT OR IGNORE INTO usage_records (id, organization_id, metric_name, quantity, unit, recorded_at)
SELECT 'usage-mock-storage', org.id, 'storage_gb', 1500, 'mb', datetime('now','-1 day') FROM org;

-- Seed organization billing info if table exists
INSERT OR IGNORE INTO organization_billing (organization_id, plan, status, token_balance, trial_tokens_used)
SELECT org.id, 'Free', 'active', 100000, 45000 FROM org;
