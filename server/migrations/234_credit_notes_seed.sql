-- Migration: 234_credit_notes_seed.sql
-- Description: Seed demo data for credit notes, revenue recognition, and forecasts
-- Date: 2026-01-10

-- Create temp table to get first organization
CREATE TEMP TABLE IF NOT EXISTS temp_org AS
SELECT id, name FROM organizations ORDER BY created_at LIMIT 1;

-- =========================================
-- Add partially_applied status to credit_notes if schema allows
-- (Status check already in migration 150)
-- =========================================

-- Seed credit notes (demo data)
INSERT OR IGNORE INTO credit_notes (
    id, organization_id, credit_note_number, total, amount_applied, amount_remaining,
    currency, status, reason, memo, issued_at, created_at
)
SELECT 
    'cn-demo-001',
    org.id,
    'CN-000001',
    7500,  -- $75.00
    0,
    7500,
    'USD',
    'issued',
    'service_issue',
    'Service disruption compensation - Q1 2026',
    datetime('now', '-5 days'),
    datetime('now', '-5 days')
FROM temp_org org
WHERE NOT EXISTS (SELECT 1 FROM credit_notes WHERE id = 'cn-demo-001');

INSERT OR IGNORE INTO credit_notes (
    id, organization_id, credit_note_number, total, amount_applied, amount_remaining,
    currency, status, reason, memo, issued_at, created_at
)
SELECT 
    'cn-demo-002',
    org.id,
    'CN-000002',
    2500,  -- $25.00
    2500,
    0,
    'USD',
    'applied',
    'billing_error',
    'Billing adjustment - duplicate charge correction',
    datetime('now', '-15 days'),
    datetime('now', '-15 days')
FROM temp_org org
WHERE NOT EXISTS (SELECT 1 FROM credit_notes WHERE id = 'cn-demo-002');

INSERT OR IGNORE INTO credit_notes (
    id, organization_id, credit_note_number, total, amount_applied, amount_remaining,
    currency, status, reason, memo, issued_at, refunded_at, refund_amount, refund_method,
    created_at
)
SELECT 
    'cn-demo-003',
    org.id,
    'CN-000003',
    5000,  -- $50.00
    0,
    0,
    'USD',
    'refunded',
    'cancellation',
    'Early termination refund - Pro-rated amount',
    datetime('now', '-30 days'),
    datetime('now', '-25 days'),
    5000,
    'original_payment',
    datetime('now', '-30 days')
FROM temp_org org
WHERE NOT EXISTS (SELECT 1 FROM credit_notes WHERE id = 'cn-demo-003');

INSERT OR IGNORE INTO credit_notes (
    id, organization_id, credit_note_number, total, amount_applied, amount_remaining,
    currency, status, reason, memo, issued_at, voided_at, void_reason,
    created_at
)
SELECT 
    'cn-demo-004',
    org.id,
    'CN-000004',
    1000,  -- $10.00
    0,
    0,
    'USD',
    'voided',
    'other',
    'Test credit note - voided',
    datetime('now', '-45 days'),
    datetime('now', '-44 days'),
    'Created in error - voided by admin',
    datetime('now', '-45 days')
FROM temp_org org
WHERE NOT EXISTS (SELECT 1 FROM credit_notes WHERE id = 'cn-demo-004');

INSERT OR IGNORE INTO credit_notes (
    id, organization_id, credit_note_number, total, amount_applied, amount_remaining,
    currency, status, reason, memo, issued_at, created_at
)
SELECT 
    'cn-demo-005',
    org.id,
    'CN-000005',
    12500,  -- $125.00
    5000,
    7500,
    'USD',
    'partially_applied',
    'goodwill',
    'Loyalty discount - Annual renewal bonus',
    datetime('now', '-10 days'),
    datetime('now', '-10 days')
FROM temp_org org
WHERE NOT EXISTS (SELECT 1 FROM credit_notes WHERE id = 'cn-demo-005');

-- Seed credit note items for more detail
INSERT OR IGNORE INTO credit_note_items (
    id, credit_note_id, description, quantity, unit_price, total
)
SELECT 
    'cni-demo-001-1',
    'cn-demo-001',
    'Service credit - API downtime compensation',
    1,
    5000,
    5000
WHERE EXISTS (SELECT 1 FROM credit_notes WHERE id = 'cn-demo-001');

INSERT OR IGNORE INTO credit_note_items (
    id, credit_note_id, description, quantity, unit_price, total
)
SELECT 
    'cni-demo-001-2',
    'cn-demo-001',
    'Goodwill adjustment',
    1,
    2500,
    2500
WHERE EXISTS (SELECT 1 FROM credit_notes WHERE id = 'cn-demo-001');

INSERT OR IGNORE INTO credit_note_items (
    id, credit_note_id, description, quantity, unit_price, total
)
SELECT 
    'cni-demo-005-1',
    'cn-demo-005',
    'Annual loyalty bonus - 10% of subscription',
    1,
    12500,
    12500
WHERE EXISTS (SELECT 1 FROM credit_notes WHERE id = 'cn-demo-005');

-- Seed credit applications for applied/partially_applied notes
INSERT OR IGNORE INTO credit_applications (
    id, credit_note_id, invoice_id, amount, applied_at
)
SELECT 
    'ca-demo-002-1',
    'cn-demo-002',
    (SELECT id FROM invoices ORDER BY created_at LIMIT 1),
    2500,
    datetime('now', '-14 days')
WHERE EXISTS (SELECT 1 FROM credit_notes WHERE id = 'cn-demo-002')
  AND EXISTS (SELECT 1 FROM invoices LIMIT 1);

INSERT OR IGNORE INTO credit_applications (
    id, credit_note_id, invoice_id, amount, applied_at
)
SELECT 
    'ca-demo-005-1',
    'cn-demo-005',
    (SELECT id FROM invoices ORDER BY created_at LIMIT 1),
    5000,
    datetime('now', '-8 days')
WHERE EXISTS (SELECT 1 FROM credit_notes WHERE id = 'cn-demo-005')
  AND EXISTS (SELECT 1 FROM invoices LIMIT 1);

-- Seed additional VAT validations for demo
INSERT OR IGNORE INTO vat_validations (
    id, vat_number, country_code, is_valid, company_name, company_address,
    validation_source, validated_at, expires_at
)
VALUES 
    ('vat-demo-001', 'PL1234567890', 'PL', 1, 'Demo Polska Sp. z o.o.', 'ul. Testowa 123, 00-001 Warszawa', 'demo', datetime('now', '-7 days'), datetime('now', '+23 days')),
    ('vat-demo-002', 'DE123456789', 'DE', 1, 'Demo GmbH', 'Teststraße 45, 10115 Berlin', 'demo', datetime('now', '-14 days'), datetime('now', '+16 days')),
    ('vat-demo-003', 'GB123456789', 'GB', 1, 'Demo Ltd', '123 Test Street, London EC1A 1BB', 'demo', datetime('now', '-3 days'), datetime('now', '+27 days')),
    ('vat-demo-004', 'FR12345678901', 'FR', 1, 'Demo SARL', '45 Rue Test, 75001 Paris', 'demo', datetime('now', '-1 day'), datetime('now', '+29 days'));

-- Seed additional invoices for demo
INSERT OR IGNORE INTO invoices (
    id, organization_id, invoice_number, status, subtotal, tax_amount, total,
    amount_paid, amount_due, currency, due_date, line_items, created_at
)
SELECT 
    'inv-demo-pending-001',
    org.id,
    'INV-DEMO-002',
    'open',
    15000,
    3450,
    18450,
    0,
    18450,
    'USD',
    datetime('now', '+15 days'),
    '[{"description":"Professional Plan - Monthly","amount":12000},{"description":"Additional Users (3)","amount":3000}]',
    datetime('now', '-5 days')
FROM temp_org org
WHERE NOT EXISTS (SELECT 1 FROM invoices WHERE id = 'inv-demo-pending-001');

INSERT OR IGNORE INTO invoices (
    id, organization_id, invoice_number, status, subtotal, tax_amount, total,
    amount_paid, amount_due, currency, due_date, line_items, created_at
)
SELECT 
    'inv-demo-overdue-001',
    org.id,
    'INV-DEMO-003',
    'past_due',
    9900,
    2277,
    12177,
    0,
    12177,
    'USD',
    datetime('now', '-10 days'),
    '[{"description":"Standard Plan - Monthly","amount":4900},{"description":"API Overage (50k tokens)","amount":5000}]',
    datetime('now', '-40 days')
FROM temp_org org
WHERE NOT EXISTS (SELECT 1 FROM invoices WHERE id = 'inv-demo-overdue-001');

-- Drop temp table
DROP TABLE IF EXISTS temp_org;
