-- Early Initializer for AI Budgets
-- Extracted from 200_security_mvp_enterprise to satisfy 038_budget_hardening dependencies
-- Created: 2026-01-20

CREATE TABLE IF NOT EXISTS ai_budgets (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT, -- null = org-level budget
    
    -- Budget type
    budget_type TEXT NOT NULL CHECK(budget_type IN ('tokens', 'cost', 'requests')),
    
    -- Period
    period TEXT NOT NULL CHECK(period IN ('daily', 'weekly', 'monthly', 'yearly', 'total')),
    period_start TEXT, -- For custom periods
    period_end TEXT,
    
    -- Limits
    budget_limit REAL NOT NULL,
    warning_threshold REAL DEFAULT 0.8, -- 80% warning
    hard_limit INTEGER DEFAULT 1, -- Block when exceeded
    
    -- Current usage
    current_usage REAL DEFAULT 0,
    current_month_usage REAL DEFAULT 0, -- Added for compatibility with 038
    last_reset_at TEXT,
    
    -- Status
    is_active INTEGER DEFAULT 1,
    exceeded_at TEXT, -- When budget was exceeded
    
    -- Rollover
    rollover_enabled INTEGER DEFAULT 0,
    rollover_percentage REAL DEFAULT 0, -- % of unused to rollover
    rollover_amount REAL DEFAULT 0, -- Amount carried over
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    created_by TEXT,
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_budgets_org ON ai_budgets(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_budgets_user ON ai_budgets(user_id);
