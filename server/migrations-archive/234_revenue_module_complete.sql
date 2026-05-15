-- Migration: 234_revenue_module_complete.sql
-- Description: Complete Revenue Module database tables
-- Date: 2026-01-10

-- =========================================
-- SUBSCRIPTION CHANGES (Upgrade/Downgrade/Cancel)
-- =========================================

CREATE TABLE IF NOT EXISTS subscription_changes (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    subscription_id TEXT,
    
    -- Change details
    change_type TEXT NOT NULL CHECK(change_type IN ('upgrade', 'downgrade', 'cancel', 'reactivate')),
    from_plan_id TEXT,
    to_plan_id TEXT,
    
    -- Financial
    proration_amount INTEGER DEFAULT 0, -- cents
    proration_type TEXT CHECK(proration_type IN ('credit', 'charge', 'none')),
    
    -- Scheduling
    requested_at TEXT DEFAULT (datetime('now')),
    effective_date TEXT,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled')),
    
    -- Processing
    processed_at TEXT,
    processed_by TEXT,
    admin_notes TEXT,
    rejection_reason TEXT,
    customer_reason TEXT,
    
    -- Audit
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
    FOREIGN KEY (from_plan_id) REFERENCES subscription_plans(id) ON DELETE SET NULL,
    FOREIGN KEY (to_plan_id) REFERENCES subscription_plans(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_subscription_changes_org ON subscription_changes(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscription_changes_status ON subscription_changes(status);
CREATE INDEX IF NOT EXISTS idx_subscription_changes_type ON subscription_changes(change_type);

-- =========================================
-- REVENUE RECOGNITION (ASC 606)
-- =========================================

CREATE TABLE IF NOT EXISTS revenue_recognition (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    contract_id TEXT,
    contract_name TEXT,
    
    -- Amounts (cents)
    total_amount INTEGER NOT NULL,
    recognized_amount INTEGER DEFAULT 0,
    remaining_amount INTEGER,
    currency TEXT DEFAULT 'USD',
    
    -- Recognition method
    recognition_method TEXT DEFAULT 'straight_line' CHECK(recognition_method IN ('straight_line', 'milestone', 'percentage_completion', 'point_in_time', 'usage_based')),
    recognition_schedule TEXT, -- JSON array of periods
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'on_hold')),
    
    -- Dates
    start_date TEXT,
    end_date TEXT,
    
    -- Audit
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_revenue_recognition_org ON revenue_recognition(organization_id);
CREATE INDEX IF NOT EXISTS idx_revenue_recognition_status ON revenue_recognition(status);
CREATE INDEX IF NOT EXISTS idx_revenue_recognition_method ON revenue_recognition(recognition_method);

-- =========================================
-- REVENUE FORECASTS
-- =========================================

CREATE TABLE IF NOT EXISTS revenue_forecasts (
    id TEXT PRIMARY KEY,
    
    -- Forecast type
    forecast_type TEXT NOT NULL CHECK(forecast_type IN ('mrr', 'arr', 'revenue', 'churn', 'ltv')),
    scenario TEXT DEFAULT 'base' CHECK(scenario IN ('base', 'optimistic', 'pessimistic', 'custom')),
    
    -- Time period
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    
    -- Forecast values
    forecasted_amount INTEGER NOT NULL, -- cents
    currency TEXT DEFAULT 'USD',
    confidence_level REAL DEFAULT 0.75,
    
    -- Model info
    method TEXT DEFAULT 'linear' CHECK(method IN ('linear', 'exponential', 'moving_average', 'arima', 'ml_based')),
    input_data TEXT, -- JSON with historical data used
    model_parameters TEXT, -- JSON with model config
    
    -- Accuracy tracking
    actual_amount INTEGER, -- filled when period ends
    accuracy REAL, -- calculated accuracy
    
    -- Status
    status TEXT DEFAULT 'active' CHECK(status IN ('draft', 'active', 'expired', 'archived')),
    
    -- Audit
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_revenue_forecasts_type ON revenue_forecasts(forecast_type);
CREATE INDEX IF NOT EXISTS idx_revenue_forecasts_scenario ON revenue_forecasts(scenario);
CREATE INDEX IF NOT EXISTS idx_revenue_forecasts_status ON revenue_forecasts(status);

-- =========================================
-- PAYMENT FAILURES (Dunning)
-- =========================================

CREATE TABLE IF NOT EXISTS payment_failures (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    subscription_id TEXT,
    invoice_id TEXT,
    
    -- Failure details
    amount INTEGER NOT NULL, -- cents
    currency TEXT DEFAULT 'USD',
    failure_code TEXT,
    failure_message TEXT,
    decline_code TEXT,
    
    -- Payment method
    payment_method_id TEXT,
    payment_method_type TEXT,
    payment_method_last4 TEXT,
    
    -- Recovery
    recovery_status TEXT DEFAULT 'pending' CHECK(recovery_status IN ('pending', 'retrying', 'recovered', 'failed', 'resolved')),
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    last_retry_at TEXT,
    next_retry_at TEXT,
    
    -- Resolution
    resolution_type TEXT CHECK(resolution_type IN ('auto_recovered', 'manual', 'payment_updated', 'written_off', 'refunded')),
    resolved_at TEXT,
    resolved_by TEXT,
    
    -- Timing
    failed_at TEXT DEFAULT (datetime('now')),
    recovered_at TEXT,
    
    -- Audit
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_failures_org ON payment_failures(organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_failures_status ON payment_failures(recovery_status);
CREATE INDEX IF NOT EXISTS idx_payment_failures_date ON payment_failures(failed_at);

-- =========================================
-- PRICING PLAN FEATURES (Feature Matrix)
-- =========================================

CREATE TABLE IF NOT EXISTS pricing_plan_features (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    
    -- Feature info
    feature_key TEXT NOT NULL,
    feature_name TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    
    -- Value
    feature_value TEXT, -- can be number, text, or 'unlimited'
    is_included INTEGER DEFAULT 1,
    
    -- Display
    display_order INTEGER DEFAULT 0,
    tooltip TEXT,
    
    -- Audit
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE CASCADE,
    UNIQUE(plan_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_pricing_plan_features_plan ON pricing_plan_features(plan_id);
CREATE INDEX IF NOT EXISTS idx_pricing_plan_features_category ON pricing_plan_features(category);

-- =========================================
-- MRR SNAPSHOTS (Analytics Cache)
-- =========================================

CREATE TABLE IF NOT EXISTS mrr_snapshots (
    id TEXT PRIMARY KEY,
    snapshot_date TEXT NOT NULL,
    
    -- MRR breakdown
    mrr INTEGER NOT NULL DEFAULT 0, -- cents
    new_mrr INTEGER DEFAULT 0,
    expansion_mrr INTEGER DEFAULT 0,
    contraction_mrr INTEGER DEFAULT 0,
    churned_mrr INTEGER DEFAULT 0,
    reactivation_mrr INTEGER DEFAULT 0,
    
    -- Metrics
    active_subscriptions INTEGER DEFAULT 0,
    new_subscriptions INTEGER DEFAULT 0,
    churned_subscriptions INTEGER DEFAULT 0,
    growth_rate REAL DEFAULT 0,
    
    -- Audit
    created_at TEXT DEFAULT (datetime('now')),
    
    UNIQUE(snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_mrr_snapshots_date ON mrr_snapshots(snapshot_date);

-- =========================================
-- SUBSCRIPTION EVENTS (Analytics)
-- =========================================

CREATE TABLE IF NOT EXISTS subscription_events (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    subscription_id TEXT,
    
    -- Event details
    event_type TEXT NOT NULL CHECK(event_type IN (
        'created', 'activated', 'trial_started', 'trial_ended',
        'upgraded', 'downgraded', 'renewed', 'canceled', 'expired',
        'paused', 'resumed', 'reactivated', 'payment_failed', 'payment_succeeded'
    )),
    
    -- Event data
    from_plan_id TEXT,
    to_plan_id TEXT,
    mrr_change INTEGER DEFAULT 0, -- positive for gain, negative for loss
    
    -- Metadata
    metadata TEXT, -- JSON
    
    -- Timing
    event_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_subscription_events_org ON subscription_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_type ON subscription_events(event_type);
CREATE INDEX IF NOT EXISTS idx_subscription_events_date ON subscription_events(event_at);
