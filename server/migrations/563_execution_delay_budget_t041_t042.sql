-- Migration 563: T041 Delay Detection + T042 Budget Planning
-- Adds tables for delay signals, budget entries, and budget thresholds

-- ============================================================
-- T041: Delay Signals — stores computed deviations per initiative/task
-- ============================================================
CREATE TABLE IF NOT EXISTS delay_signals (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('INITIATIVE', 'TASK')),
    entity_id TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    deviation_type TEXT NOT NULL CHECK (deviation_type IN ('LATE_START', 'LATE_FINISH_RISK', 'DEADLINE_RISK', 'OVERDUE')),
    severity TEXT NOT NULL CHECK (severity IN ('WARNING', 'CRITICAL')),
    days_deviation INTEGER NOT NULL DEFAULT 0,
    planned_date TEXT,
    actual_or_current TEXT,
    why_slip_reasons JSONB DEFAULT '[]',
    is_dismissed BOOLEAN DEFAULT FALSE,
    dismissed_by TEXT,
    dismissed_at TIMESTAMP,
    alert_sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_delay_signals_org ON delay_signals(organization_id);
CREATE INDEX IF NOT EXISTS idx_delay_signals_entity ON delay_signals(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_delay_signals_severity ON delay_signals(severity);
CREATE INDEX IF NOT EXISTS idx_delay_signals_created ON delay_signals(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_delay_signals_unique_entity
    ON delay_signals(entity_type, entity_id, deviation_type)
    WHERE is_dismissed = FALSE;

-- ============================================================
-- T041: Delay alert throttling — tracks when alerts were last sent
-- ============================================================
CREATE TABLE IF NOT EXISTS delay_alert_log (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    organization_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    deviation_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT NOW(),
    recipient_id TEXT,
    channel TEXT DEFAULT 'in_app'
);

CREATE INDEX IF NOT EXISTS idx_delay_alert_log_entity ON delay_alert_log(entity_type, entity_id, deviation_type);
CREATE INDEX IF NOT EXISTS idx_delay_alert_log_sent ON delay_alert_log(sent_at DESC);

-- ============================================================
-- T042: Budget entries — actual cost tracking per initiative
-- ============================================================
CREATE TABLE IF NOT EXISTS budget_entries (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    organization_id TEXT NOT NULL,
    initiative_id TEXT NOT NULL,
    project_id TEXT,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('ACTUAL', 'FORECAST', 'ADJUSTMENT')),
    cost_type TEXT NOT NULL CHECK (cost_type IN ('CAPEX', 'OPEX')),
    category TEXT NOT NULL DEFAULT 'General',
    amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'PLN',
    description TEXT,
    period_month INTEGER CHECK (period_month BETWEEN 1 AND 12),
    period_year INTEGER,
    source TEXT DEFAULT 'manual',
    created_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_budget_entries_initiative ON budget_entries(initiative_id);
CREATE INDEX IF NOT EXISTS idx_budget_entries_org ON budget_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_budget_entries_period ON budget_entries(period_year, period_month);

-- ============================================================
-- T042: Budget thresholds — configurable alert thresholds
-- ============================================================
CREATE TABLE IF NOT EXISTS budget_thresholds (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    organization_id TEXT NOT NULL,
    scope_type TEXT NOT NULL CHECK (scope_type IN ('ORGANIZATION', 'PROJECT', 'INITIATIVE')),
    scope_id TEXT,
    warning_percent INTEGER NOT NULL DEFAULT 80,
    critical_percent INTEGER NOT NULL DEFAULT 90,
    hard_limit_percent INTEGER NOT NULL DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_budget_thresholds_scope ON budget_thresholds(organization_id, scope_type, scope_id);

-- ============================================================
-- T042: Budget overspend signals — stores detected overspend risks
-- ============================================================
CREATE TABLE IF NOT EXISTS budget_overspend_signals (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    organization_id TEXT NOT NULL,
    initiative_id TEXT,
    project_id TEXT,
    signal_type TEXT NOT NULL CHECK (signal_type IN ('THRESHOLD_WARNING', 'THRESHOLD_CRITICAL', 'THRESHOLD_EXCEEDED', 'BURN_RATE_HIGH', 'FORECAST_OVERSPEND')),
    severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    planned_amount NUMERIC(15,2),
    actual_amount NUMERIC(15,2),
    variance_percent NUMERIC(5,2),
    burn_rate_percent NUMERIC(5,2),
    forecast_total NUMERIC(15,2),
    message TEXT,
    is_dismissed BOOLEAN DEFAULT FALSE,
    dismissed_by TEXT,
    dismissed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_budget_overspend_org ON budget_overspend_signals(organization_id);
CREATE INDEX IF NOT EXISTS idx_budget_overspend_initiative ON budget_overspend_signals(initiative_id);

-- ============================================================
-- Add execution tracking fields to initiatives (if not exist)
-- ============================================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'initiatives' AND column_name = 'planned_budget_total') THEN
        ALTER TABLE initiatives ADD COLUMN planned_budget_total NUMERIC(15,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'initiatives' AND column_name = 'actual_budget_total') THEN
        ALTER TABLE initiatives ADD COLUMN actual_budget_total NUMERIC(15,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'initiatives' AND column_name = 'budget_currency') THEN
        ALTER TABLE initiatives ADD COLUMN budget_currency TEXT DEFAULT 'PLN';
    END IF;
END $$;
