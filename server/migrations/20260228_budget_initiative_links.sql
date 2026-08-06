-- Migration: Budget ↔ Initiative linking for D11
-- Tracks revenue uplift, cost savings, CAPEX from linked initiatives

-- Baseline Postgres migrations skip the legacy SQLite-first finance migration (<500).
-- Keep the budget link migration self-contained for fresh Postgres databases.
CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'DRAFT',
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    granularity TEXT DEFAULT 'monthly' CHECK (granularity IN ('monthly','quarterly','annual')),
    currency TEXT DEFAULT 'PLN',
    baseline_source TEXT,
    assumptions JSONB DEFAULT '[]',
    approved_by TEXT,
    approved_at TIMESTAMP,
    version INTEGER DEFAULT 1,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budgets_org ON budgets(organization_id);
CREATE INDEX IF NOT EXISTS idx_budgets_status ON budgets(status);

CREATE TABLE IF NOT EXISTS budget_initiative_links (
    id TEXT PRIMARY KEY,
    budget_id TEXT NOT NULL,
    initiative_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    revenue_uplift REAL DEFAULT 0,
    cost_savings REAL DEFAULT 0,
    capex_required REAL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
    FOREIGN KEY(initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,
    UNIQUE(budget_id, initiative_id)
);

CREATE INDEX IF NOT EXISTS idx_budget_init_links_budget ON budget_initiative_links(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_init_links_initiative ON budget_initiative_links(initiative_id);
CREATE INDEX IF NOT EXISTS idx_budget_init_links_org ON budget_initiative_links(organization_id);
