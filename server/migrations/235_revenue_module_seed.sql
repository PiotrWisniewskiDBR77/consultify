-- Migration: 235_revenue_module_seed.sql
-- Description: Seed demo data for Revenue Module
-- Date: 2026-01-10

-- Create temp table to get first organization and plans
CREATE TEMP TABLE IF NOT EXISTS temp_org AS
SELECT id FROM organizations ORDER BY created_at LIMIT 1;

CREATE TEMP TABLE IF NOT EXISTS temp_plans AS
SELECT id, name FROM subscription_plans ORDER BY sort_order LIMIT 3;

-- =========================================
-- SUBSCRIPTION CHANGES (Demo Data)
-- =========================================

INSERT INTO subscription_changes (
    id, organization_id, change_type, from_plan_id, to_plan_id,
    proration_amount, proration_type, status, customer_reason, created_at
)
SELECT 
    'sc-demo-001',
    (SELECT id FROM temp_org),
    'upgrade',
    (SELECT id FROM temp_plans LIMIT 1),
    (SELECT id FROM temp_plans LIMIT 1 OFFSET 1),
    2500,
    'charge',
    'pending',
    'Need more features for growing team',
    CURRENT_TIMESTAMP - INTERVAL '2 days'
WHERE EXISTS (SELECT 1 FROM temp_org)
ON CONFLICT (id) DO NOTHING;

INSERT INTO subscription_changes (
    id, organization_id, change_type, from_plan_id, to_plan_id,
    proration_amount, proration_type, status, customer_reason, processed_at, admin_notes, created_at
)
SELECT 
    'sc-demo-002',
    (SELECT id FROM temp_org),
    'upgrade',
    (SELECT id FROM temp_plans LIMIT 1),
    (SELECT id FROM temp_plans LIMIT 1 OFFSET 2),
    7500,
    'charge',
    'approved',
    'Moving to enterprise tier',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    'Approved - key customer expansion',
    CURRENT_TIMESTAMP - INTERVAL '5 days'
WHERE EXISTS (SELECT 1 FROM temp_org)
ON CONFLICT (id) DO NOTHING;

INSERT INTO subscription_changes (
    id, organization_id, change_type, from_plan_id, to_plan_id,
    proration_amount, proration_type, status, customer_reason, created_at
)
SELECT 
    'sc-demo-003',
    (SELECT id FROM temp_org),
    'downgrade',
    (SELECT id FROM temp_plans LIMIT 1 OFFSET 1),
    (SELECT id FROM temp_plans LIMIT 1),
    -1500,
    'credit',
    'pending',
    'Budget constraints',
    CURRENT_TIMESTAMP - INTERVAL '1 day'
WHERE EXISTS (SELECT 1 FROM temp_org)
ON CONFLICT (id) DO NOTHING;

INSERT INTO subscription_changes (
    id, organization_id, change_type, status, customer_reason, 
    processed_at, rejection_reason, created_at
)
SELECT 
    'sc-demo-004',
    (SELECT id FROM temp_org),
    'cancel',
    'rejected',
    'Switching to competitor',
    CURRENT_TIMESTAMP - INTERVAL '3 days',
    'Offered 20% retention discount - customer accepted',
    CURRENT_TIMESTAMP - INTERVAL '7 days'
WHERE EXISTS (SELECT 1 FROM temp_org)
ON CONFLICT (id) DO NOTHING;

INSERT INTO subscription_changes (
    id, organization_id, change_type, status, customer_reason, created_at
)
SELECT 
    'sc-demo-005',
    (SELECT id FROM temp_org),
    'cancel',
    'pending',
    'Project completed',
    datetime('now')
WHERE EXISTS (SELECT 1 FROM temp_org)
ON CONFLICT (id) DO NOTHING;

-- =========================================
-- REVENUE RECOGNITION (Demo Data)
-- =========================================

INSERT INTO revenue_recognition (
    id, organization_id, contract_id, contract_name, total_amount,
    recognized_amount, remaining_amount, currency, recognition_method,
    recognition_schedule, status, start_date
)
SELECT 
    'rr-demo-001',
    (SELECT id FROM temp_org),
    'contract-001',
    'Enterprise License - Annual',
    12000000,
    3000000,
    9000000,
    'USD',
    'straight_line',
    '[{"period":"2026-01","amount":1000000,"recognized":true,"recognized_at":"2026-01-15"},{"period":"2026-02","amount":1000000,"recognized":true,"recognized_at":"2026-02-15"},{"period":"2026-03","amount":1000000,"recognized":true,"recognized_at":"2026-03-15"},{"period":"2026-04","amount":1000000,"recognized":false},{"period":"2026-05","amount":1000000,"recognized":false},{"period":"2026-06","amount":1000000,"recognized":false},{"period":"2026-07","amount":1000000,"recognized":false},{"period":"2026-08","amount":1000000,"recognized":false},{"period":"2026-09","amount":1000000,"recognized":false},{"period":"2026-10","amount":1000000,"recognized":false},{"period":"2026-11","amount":1000000,"recognized":false},{"period":"2026-12","amount":1000000,"recognized":false}]',
    'in_progress',
    '2026-01-01'
WHERE EXISTS (SELECT 1 FROM temp_org)
ON CONFLICT (id) DO NOTHING;

INSERT INTO revenue_recognition (
    id, organization_id, contract_id, contract_name, total_amount,
    recognized_amount, remaining_amount, currency, recognition_method,
    recognition_schedule, status, start_date
)
SELECT 
    'rr-demo-002',
    (SELECT id FROM temp_org),
    'contract-002',
    'Professional Services',
    4500000,
    2700000,
    1800000,
    'USD',
    'milestone',
    '[{"period":"Discovery","amount":900000,"recognized":true,"recognized_at":"2025-12-20"},{"period":"Development","amount":1800000,"recognized":true,"recognized_at":"2026-01-05"},{"period":"Testing","amount":900000,"recognized":false},{"period":"Deployment","amount":900000,"recognized":false}]',
    'in_progress',
    '2025-12-01'
WHERE EXISTS (SELECT 1 FROM temp_org)
ON CONFLICT (id) DO NOTHING;

INSERT INTO revenue_recognition (
    id, organization_id, contract_id, contract_name, total_amount,
    recognized_amount, remaining_amount, currency, recognition_method,
    recognition_schedule, status, start_date
)
SELECT 
    'rr-demo-003',
    (SELECT id FROM temp_org),
    'contract-003',
    'Consulting Package',
    2500000,
    2500000,
    0,
    'USD',
    'point_in_time',
    '[{"period":"Completion","amount":2500000,"recognized":true,"recognized_at":"2025-12-30"}]',
    'completed',
    '2025-10-15'
WHERE EXISTS (SELECT 1 FROM temp_org)
ON CONFLICT (id) DO NOTHING;

INSERT INTO revenue_recognition (
    id, organization_id, contract_id, contract_name, total_amount,
    recognized_amount, remaining_amount, currency, recognition_method,
    status, start_date
)
SELECT 
    'rr-demo-004',
    (SELECT id FROM temp_org),
    'contract-004',
    'SaaS Subscription Q1',
    3600000,
    0,
    3600000,
    'USD',
    'straight_line',
    'pending',
    '2026-01-15'
WHERE EXISTS (SELECT 1 FROM temp_org)
ON CONFLICT (id) DO NOTHING;

-- =========================================
-- REVENUE FORECASTS (Demo Data)
-- =========================================

INSERT INTO revenue_forecasts (
    id, forecast_type, scenario, period_start, period_end,
    forecasted_amount, currency, confidence_level, method, status, accuracy
)
VALUES
    ('rf-demo-001', 'mrr', 'base', '2026-01-01', '2026-12-31', 85000000, 'USD', 0.82, 'linear', 'active', 0),
    ('rf-demo-002', 'mrr', 'optimistic', '2026-01-01', '2026-12-31', 120000000, 'USD', 0.65, 'exponential', 'active', 0),
    ('rf-demo-003', 'mrr', 'pessimistic', '2026-01-01', '2026-12-31', 65000000, 'USD', 0.75, 'moving_average', 'active', 0);

-- =========================================
-- PAYMENT FAILURES (Demo Data)
-- =========================================

INSERT INTO payment_failures (
    id, organization_id, amount, currency, failure_code, failure_message,
    decline_code, payment_method_type, payment_method_last4,
    recovery_status, retry_count, failed_at
)
SELECT 
    'pf-demo-001',
    (SELECT id FROM temp_org),
    4900,
    'USD',
    'card_declined',
    'Your card was declined. Please use a different payment method.',
    'insufficient_funds',
    'card',
    '4242',
    'pending',
    1,
    CURRENT_TIMESTAMP - INTERVAL '2 days'
WHERE EXISTS (SELECT 1 FROM temp_org)
ON CONFLICT (id) DO NOTHING;

INSERT INTO payment_failures (
    id, organization_id, amount, currency, failure_code, failure_message,
    payment_method_type, payment_method_last4,
    recovery_status, retry_count, recovered_at, failed_at
)
SELECT 
    'pf-demo-002',
    (SELECT id FROM temp_org),
    9900,
    'USD',
    'expired_card',
    'Your card has expired.',
    'card',
    '5555',
    'recovered',
    2,
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    CURRENT_TIMESTAMP - INTERVAL '5 days'
WHERE EXISTS (SELECT 1 FROM temp_org)
ON CONFLICT (id) DO NOTHING;

INSERT INTO payment_failures (
    id, organization_id, amount, currency, failure_code, failure_message,
    payment_method_type, payment_method_last4,
    recovery_status, retry_count, resolution_type, resolved_at, failed_at
)
SELECT 
    'pf-demo-003',
    (SELECT id FROM temp_org),
    2500,
    'USD',
    'processing_error',
    'An error occurred while processing your card.',
    'card',
    '1234',
    'resolved',
    3,
    'manual',
    CURRENT_TIMESTAMP - INTERVAL '3 days',
    CURRENT_TIMESTAMP - INTERVAL '10 days'
WHERE EXISTS (SELECT 1 FROM temp_org)
ON CONFLICT (id) DO NOTHING;

-- =========================================
-- PRICING PLAN FEATURES (Demo Data)
-- =========================================

-- Get plan IDs
INSERT INTO pricing_plan_features (id, plan_id, feature_key, feature_name, category, feature_value, is_included, display_order)
SELECT 
    'ppf-' || p.id || '-users',
    p.id,
    'users',
    'Team Members',
    'limits',
    CASE 
        WHEN p.name LIKE '%Basic%' THEN '5'
        WHEN p.name LIKE '%Pro%' OR p.name LIKE '%Professional%' THEN '25'
        ELSE 'unlimited'
    END,
    1,
    1
FROM subscription_plans p WHERE p.is_active = 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO pricing_plan_features (id, plan_id, feature_key, feature_name, category, feature_value, is_included, display_order)
SELECT 
    'ppf-' || p.id || '-projects',
    p.id,
    'projects',
    'Active Projects',
    'limits',
    CASE 
        WHEN p.name LIKE '%Basic%' THEN '3'
        WHEN p.name LIKE '%Pro%' OR p.name LIKE '%Professional%' THEN '20'
        ELSE 'unlimited'
    END,
    1,
    2
FROM subscription_plans p WHERE p.is_active = 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO pricing_plan_features (id, plan_id, feature_key, feature_name, category, feature_value, is_included, display_order)
SELECT 
    'ppf-' || p.id || '-storage',
    p.id,
    'storage_gb',
    'Storage',
    'limits',
    CASE 
        WHEN p.name LIKE '%Basic%' THEN '10 GB'
        WHEN p.name LIKE '%Pro%' OR p.name LIKE '%Professional%' THEN '100 GB'
        ELSE '500 GB'
    END,
    1,
    3
FROM subscription_plans p WHERE p.is_active = 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO pricing_plan_features (id, plan_id, feature_key, feature_name, category, feature_value, is_included, display_order)
SELECT 
    'ppf-' || p.id || '-ai',
    p.id,
    'ai_tokens',
    'AI Tokens/month',
    'ai',
    CASE 
        WHEN p.name LIKE '%Basic%' THEN '50,000'
        WHEN p.name LIKE '%Pro%' OR p.name LIKE '%Professional%' THEN '500,000'
        ELSE '2,000,000'
    END,
    1,
    4
FROM subscription_plans p WHERE p.is_active = 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO pricing_plan_features (id, plan_id, feature_key, feature_name, category, feature_value, is_included, display_order)
SELECT 
    'ppf-' || p.id || '-sso',
    p.id,
    'sso',
    'Single Sign-On',
    'security',
    CASE 
        WHEN p.name LIKE '%Basic%' THEN NULL
        ELSE 'Included'
    END,
    CASE WHEN p.name LIKE '%Basic%' THEN 0 ELSE 1 END,
    5
FROM subscription_plans p WHERE p.is_active = 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO pricing_plan_features (id, plan_id, feature_key, feature_name, category, feature_value, is_included, display_order)
SELECT 
    'ppf-' || p.id || '-api',
    p.id,
    'api_access',
    'API Access',
    'integrations',
    CASE 
        WHEN p.name LIKE '%Basic%' THEN NULL
        WHEN p.name LIKE '%Pro%' OR p.name LIKE '%Professional%' THEN 'Standard'
        ELSE 'Advanced'
    END,
    CASE WHEN p.name LIKE '%Basic%' THEN 0 ELSE 1 END,
    6
FROM subscription_plans p WHERE p.is_active = 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO pricing_plan_features (id, plan_id, feature_key, feature_name, category, feature_value, is_included, display_order)
SELECT 
    'ppf-' || p.id || '-support',
    p.id,
    'support',
    'Support Level',
    'support',
    CASE 
        WHEN p.name LIKE '%Basic%' THEN 'Email'
        WHEN p.name LIKE '%Pro%' OR p.name LIKE '%Professional%' THEN 'Priority'
        ELSE 'Dedicated CSM'
    END,
    1,
    7
FROM subscription_plans p WHERE p.is_active = 1
ON CONFLICT (id) DO NOTHING;

-- =========================================
-- MRR SNAPSHOTS (Demo Data - 7 months history)
-- =========================================

INSERT INTO mrr_snapshots (id, snapshot_date, mrr, new_mrr, expansion_mrr, contraction_mrr, churned_mrr, active_subscriptions, new_subscriptions, churned_subscriptions, growth_rate)
VALUES
    ('mrr-2025-07', '2025-07-01', 4200000, 350000, 120000, 50000, 80000, (42 > 0)::boolean, 5::integer, 1::integer, 0.08::real),
    ('mrr-2025-08', '2025-08-01', 4500000, 400000, 150000, 30000, 120000, (46 > 0)::boolean, 6::integer, 2::integer, 0.07::real),
    ('mrr-2025-09', '2025-09-01', 4800000, 380000, 180000, 40000, 90000, (49 > 0)::boolean, 5::integer, 1::integer, 0.07::real),
    ('mrr-2025-10', '2025-10-01', 5200000, 450000, 200000, 60000, 100000, (53 > 0)::boolean, 7::integer, 2::integer, 0.08::real),
    ('mrr-2025-11', '2025-11-01', 5600000, 500000, 220000, 40000, 80000, (58 > 0)::boolean, 8::integer, 1::integer, 0.08::real),
    ('mrr-2025-12', '2025-12-01', 6000000, 480000, 250000, 50000, 70000, (63 > 0)::boolean, 7::integer, 1::integer, 0.07::real),
    ('mrr-2026-01', '2026-01-01', 6500000, 550000, 280000, 30000, 60000, (69 > 0)::boolean, 9::integer, 1::integer, 0.08::real)
ON CONFLICT (id) DO NOTHING;

-- =========================================
-- SUBSCRIPTION EVENTS (Demo Data)
-- =========================================

INSERT INTO subscription_events (id, organization_id, event_type, mrr_change, event_at)
SELECT 'se-demo-001', (SELECT id FROM temp_org), 'upgraded', 5000, datetime('now', '-30 days')
WHERE EXISTS (SELECT 1 FROM temp_org)
ON CONFLICT (id) DO NOTHING;

INSERT INTO subscription_events (id, organization_id, event_type, mrr_change, event_at)
SELECT 'se-demo-002', (SELECT id FROM temp_org), 'renewed', 0, datetime('now', '-15 days')
WHERE EXISTS (SELECT 1 FROM temp_org)
ON CONFLICT (id) DO NOTHING;

INSERT INTO subscription_events (id, organization_id, event_type, mrr_change, event_at)
SELECT 'se-demo-003', (SELECT id FROM temp_org), 'payment_succeeded', 0, datetime('now', '-1 day')
WHERE EXISTS (SELECT 1 FROM temp_org)
ON CONFLICT (id) DO NOTHING;

-- Drop temp tables
DROP TABLE IF EXISTS temp_org;
DROP TABLE IF EXISTS temp_plans;
