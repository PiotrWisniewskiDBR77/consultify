-- Migration: Budget ↔ Initiative linking for D11
-- Tracks revenue uplift, cost savings, CAPEX from linked initiatives

CREATE TABLE IF NOT EXISTS budget_initiative_links (
    id TEXT PRIMARY KEY,
    budget_id TEXT NOT NULL,
    initiative_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    revenue_uplift REAL DEFAULT 0,
    cost_savings REAL DEFAULT 0,
    capex_required REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
    FOREIGN KEY(initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,
    UNIQUE(budget_id, initiative_id)
);

CREATE INDEX IF NOT EXISTS idx_budget_init_links_budget ON budget_initiative_links(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_init_links_initiative ON budget_initiative_links(initiative_id);
CREATE INDEX IF NOT EXISTS idx_budget_init_links_org ON budget_initiative_links(organization_id);
