-- Migration: 234_revenue_module_tables.sql
-- Revenue Module Tables for SuperAdmin
-- Date: 2026-01-10
--
-- Tables:
-- - subscription_changes: Track subscription upgrades/downgrades/cancellations
-- - subscription_events: Track MRR changes for analytics
-- - revenue_recognition: ASC 606 compliant revenue recognition
-- - revenue_forecasts: Revenue forecasting scenarios

-- ============================================================
-- SUBSCRIPTION CHANGES
-- ============================================================

CREATE TABLE IF NOT EXISTS subscription_changes (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    organization_id TEXT NOT NULL,
    subscription_id TEXT,
    
    -- Plan transition
    from_plan_id TEXT,
    to_plan_id TEXT,
    change_type TEXT NOT NULL CHECK(change_type IN ('upgrade', 'downgrade', 'cancel', 'reactivate', 'new')),
    
    -- Timing
    effective_date TEXT NOT NULL,
    requested_at TEXT DEFAULT (datetime('now')),
    
    -- Proration
    proration_amount REAL DEFAULT 0,
    proration_method TEXT DEFAULT 'day' CHECK(proration_method IN ('day', 'none', 'full_month')),
    
    -- Approval workflow
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled')),
    approved_by TEXT,
    approved_at TEXT,
    rejection_reason TEXT,
    notes TEXT,
    
    -- Metadata
    reason TEXT,
    requested_by TEXT,
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
    FOREIGN KEY (from_plan_id) REFERENCES subscription_plans(id) ON DELETE SET NULL,
    FOREIGN KEY (to_plan_id) REFERENCES subscription_plans(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_subscription_changes_org ON subscription_changes(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscription_changes_status ON subscription_changes(status);
CREATE INDEX IF NOT EXISTS idx_subscription_changes_type ON subscription_changes(change_type);
CREATE INDEX IF NOT EXISTS idx_subscription_changes_date ON subscription_changes(effective_date);

-- ============================================================
-- SUBSCRIPTION EVENTS (for MRR analytics)
-- ============================================================

CREATE TABLE IF NOT EXISTS subscription_events (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    organization_id TEXT NOT NULL,
    subscription_id TEXT,
    
    -- Event type
    event_type TEXT NOT NULL CHECK(event_type IN ('new', 'expansion', 'contraction', 'churn', 'reactivation')),
    
    -- MRR impact
    mrr_delta REAL NOT NULL DEFAULT 0,
    previous_mrr REAL DEFAULT 0,
    new_mrr REAL DEFAULT 0,
    
    -- Plan info
    from_plan_id TEXT,
    to_plan_id TEXT,
    
    -- Metadata
    reason TEXT,
    metadata TEXT, -- JSON
    
    created_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_subscription_events_org ON subscription_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_type ON subscription_events(event_type);
CREATE INDEX IF NOT EXISTS idx_subscription_events_date ON subscription_events(created_at);

-- ============================================================
-- REVENUE RECOGNITION (ASC 606 Compliant)
-- ============================================================

CREATE TABLE IF NOT EXISTS revenue_recognition (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    organization_id TEXT NOT NULL,
    invoice_id TEXT,
    subscription_id TEXT,
    
    -- Revenue details
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    recognition_date TEXT NOT NULL,
    period_start TEXT,
    period_end TEXT,
    
    -- Classification
    revenue_type TEXT DEFAULT 'subscription' CHECK(revenue_type IN ('subscription', 'usage', 'setup', 'professional_services', 'other')),
    
    -- ASC 606 fields
    contract_id TEXT,
    performance_obligation TEXT,
    transaction_price REAL,
    allocation_method TEXT DEFAULT 'standalone' CHECK(allocation_method IN ('standalone', 'relative', 'residual')),
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'recognized', 'deferred', 'reversed')),
    recognized_at TEXT,
    recognized_by TEXT,
    
    -- Metadata
    description TEXT,
    notes TEXT,
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
    FOREIGN KEY (recognized_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_revenue_recognition_org ON revenue_recognition(organization_id);
CREATE INDEX IF NOT EXISTS idx_revenue_recognition_status ON revenue_recognition(status);
CREATE INDEX IF NOT EXISTS idx_revenue_recognition_date ON revenue_recognition(recognition_date);
CREATE INDEX IF NOT EXISTS idx_revenue_recognition_invoice ON revenue_recognition(invoice_id);

-- ============================================================
-- REVENUE FORECASTS
-- ============================================================

CREATE TABLE IF NOT EXISTS revenue_forecasts (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    
    -- Forecast info
    name TEXT,
    scenario TEXT NOT NULL DEFAULT 'baseline' CHECK(scenario IN ('baseline', 'optimistic', 'conservative', 'custom')),
    forecast_date TEXT NOT NULL,
    
    -- Forecast data (JSON array of monthly projections)
    forecast_data TEXT NOT NULL, -- JSON
    
    -- Assumptions used
    assumptions TEXT, -- JSON: { growthRate, churnRate, expansionRate, etc. }
    
    -- Model info
    model_type TEXT DEFAULT 'linear' CHECK(model_type IN ('linear', 'exponential', 'seasonal', 'ml_based')),
    confidence_interval REAL DEFAULT 0.95,
    
    -- Accuracy tracking
    accuracy REAL DEFAULT 0, -- Updated when actuals come in
    variance_from_actual REAL,
    
    -- Metadata
    description TEXT,
    created_by TEXT,
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_revenue_forecasts_scenario ON revenue_forecasts(scenario);
CREATE INDEX IF NOT EXISTS idx_revenue_forecasts_date ON revenue_forecasts(forecast_date);

-- ============================================================
-- MRR SNAPSHOTS (for historical tracking)
-- ============================================================

CREATE TABLE IF NOT EXISTS mrr_snapshots (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    
    -- Snapshot date
    snapshot_date TEXT NOT NULL,
    
    -- MRR breakdown
    total_mrr REAL NOT NULL DEFAULT 0,
    new_mrr REAL DEFAULT 0,
    expansion_mrr REAL DEFAULT 0,
    contraction_mrr REAL DEFAULT 0,
    churn_mrr REAL DEFAULT 0,
    reactivation_mrr REAL DEFAULT 0,
    
    -- Customer counts
    total_customers INTEGER DEFAULT 0,
    new_customers INTEGER DEFAULT 0,
    churned_customers INTEGER DEFAULT 0,
    
    -- Plan breakdown (JSON)
    by_plan TEXT, -- JSON: [{ plan_id, plan_name, mrr, count }]
    
    created_at TEXT DEFAULT (datetime('now')),
    
    UNIQUE(snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_mrr_snapshots_date ON mrr_snapshots(snapshot_date);

-- ============================================================
-- SEED DEMO DATA
-- ============================================================

-- Demo subscription changes
INSERT OR IGNORE INTO subscription_changes (id, organization_id, from_plan_id, to_plan_id, change_type, effective_date, proration_amount, status, created_at)
SELECT 
    'sc-demo-' || x,
    (SELECT id FROM organizations ORDER BY RANDOM() LIMIT 1),
    'plan-starter',
    'plan-pro',
    CASE (x % 4) 
        WHEN 0 THEN 'upgrade'
        WHEN 1 THEN 'downgrade'
        WHEN 2 THEN 'cancel'
        ELSE 'reactivate'
    END,
    datetime('now', '-' || (x * 3) || ' days'),
    ROUND(RANDOM() % 100 + 20, 2),
    CASE (x % 4)
        WHEN 0 THEN 'pending'
        WHEN 1 THEN 'approved'
        WHEN 2 THEN 'completed'
        ELSE 'rejected'
    END,
    datetime('now', '-' || (x * 3) || ' days')
FROM (SELECT 1 x UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 
      UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10);

-- Demo subscription events for MRR tracking
INSERT OR IGNORE INTO subscription_events (id, organization_id, event_type, mrr_delta, previous_mrr, new_mrr, created_at)
SELECT 
    'se-demo-' || x,
    (SELECT id FROM organizations ORDER BY RANDOM() LIMIT 1),
    CASE (x % 5)
        WHEN 0 THEN 'new'
        WHEN 1 THEN 'expansion'
        WHEN 2 THEN 'contraction'
        WHEN 3 THEN 'churn'
        ELSE 'reactivation'
    END,
    CASE (x % 5)
        WHEN 0 THEN ABS(RANDOM() % 500) + 100
        WHEN 1 THEN ABS(RANDOM() % 200) + 50
        WHEN 2 THEN -(ABS(RANDOM() % 100) + 20)
        WHEN 3 THEN -(ABS(RANDOM() % 300) + 50)
        ELSE ABS(RANDOM() % 200) + 50
    END,
    10000 + (x * 500),
    10000 + (x * 500) + (CASE (x % 5)
        WHEN 0 THEN ABS(RANDOM() % 500) + 100
        WHEN 1 THEN ABS(RANDOM() % 200) + 50
        WHEN 2 THEN -(ABS(RANDOM() % 100) + 20)
        WHEN 3 THEN -(ABS(RANDOM() % 300) + 50)
        ELSE ABS(RANDOM() % 200) + 50
    END),
    datetime('now', '-' || x || ' days')
FROM (SELECT 1 x UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 
      UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10
      UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15
      UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19 UNION SELECT 20
      UNION SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24 UNION SELECT 25
      UNION SELECT 26 UNION SELECT 27 UNION SELECT 28 UNION SELECT 29 UNION SELECT 30);

-- Demo revenue recognitions
INSERT OR IGNORE INTO revenue_recognition (id, organization_id, amount, recognition_date, revenue_type, status, description, created_at)
SELECT 
    'rr-demo-' || x,
    (SELECT id FROM organizations ORDER BY RANDOM() LIMIT 1),
    ROUND(ABS(RANDOM() % 2000) + 500, 2),
    date('now', '-' || (x * 2) || ' days'),
    CASE (x % 4)
        WHEN 0 THEN 'subscription'
        WHEN 1 THEN 'usage'
        WHEN 2 THEN 'setup'
        ELSE 'professional_services'
    END,
    CASE (x % 3)
        WHEN 0 THEN 'pending'
        WHEN 1 THEN 'recognized'
        ELSE 'deferred'
    END,
    'Monthly revenue - Period ' || x,
    datetime('now', '-' || (x * 2) || ' days')
FROM (SELECT 1 x UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 
      UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10
      UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15);

-- Demo revenue forecasts
INSERT OR IGNORE INTO revenue_forecasts (id, scenario, forecast_date, forecast_data, assumptions, accuracy, created_at)
VALUES 
    ('forecast-baseline', 'baseline', datetime('now'), 
     '[{"month":"2026-02","projected_mrr":15750,"projected_arr":189000},{"month":"2026-03","projected_mrr":16538,"projected_arr":198450},{"month":"2026-04","projected_mrr":17365,"projected_arr":208373}]',
     '{"growthRate":0.05,"churnRate":0.02}', 87.5, datetime('now')),
    ('forecast-optimistic', 'optimistic', datetime('now'),
     '[{"month":"2026-02","projected_mrr":16200,"projected_arr":194400},{"month":"2026-03","projected_mrr":17496,"projected_arr":209952},{"month":"2026-04","projected_mrr":18896,"projected_arr":226748}]',
     '{"growthRate":0.08,"churnRate":0.015}', 82.3, datetime('now')),
    ('forecast-conservative', 'conservative', datetime('now'),
     '[{"month":"2026-02","projected_mrr":15300,"projected_arr":183600},{"month":"2026-03","projected_mrr":15606,"projected_arr":187272},{"month":"2026-04","projected_mrr":15918,"projected_arr":191017}]',
     '{"growthRate":0.02,"churnRate":0.03}', 91.2, datetime('now'));

-- Demo MRR snapshots for last 30 days
INSERT OR IGNORE INTO mrr_snapshots (id, snapshot_date, total_mrr, new_mrr, expansion_mrr, contraction_mrr, churn_mrr, total_customers, new_customers, churned_customers)
SELECT 
    'mrr-' || date('now', '-' || x || ' days'),
    date('now', '-' || x || ' days'),
    12000 + (30 - x) * 200 + ABS(RANDOM() % 500),
    ABS(RANDOM() % 800) + 200,
    ABS(RANDOM() % 400) + 100,
    ABS(RANDOM() % 200) + 50,
    ABS(RANDOM() % 300) + 100,
    80 + (30 - x),
    ABS(RANDOM() % 5) + 1,
    ABS(RANDOM() % 3)
FROM (SELECT 0 x UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 
      UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9
      UNION SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14
      UNION SELECT 15 UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19
      UNION SELECT 20 UNION SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24
      UNION SELECT 25 UNION SELECT 26 UNION SELECT 27 UNION SELECT 28 UNION SELECT 29);
