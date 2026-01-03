-- Budget Tracking System
-- PMO Standards Compliance:
-- - ISO 21500:2021 - Cost Management (Clause 4.4.4)
-- - PMI PMBOK 7th Edition - Cost Performance Domain
-- - PRINCE2 - Business Case / Cost Management
--
-- PMO Domain: RESOURCE_RESPONSIBILITY, PERFORMANCE_MONITORING

-- Initiative Budgets - Master budget record per initiative
CREATE TABLE IF NOT EXISTS initiative_budgets (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    initiative_id TEXT NOT NULL,
    budget_type TEXT NOT NULL DEFAULT 'COMBINED', -- CAPEX, OPEX, COMBINED
    planned_amount REAL NOT NULL DEFAULT 0,
    approved_amount REAL DEFAULT 0,
    currency TEXT DEFAULT 'PLN',
    fiscal_year INTEGER,
    contingency_percent REAL DEFAULT 10,
    contingency_amount REAL DEFAULT 0,
    status TEXT DEFAULT 'DRAFT', -- DRAFT, SUBMITTED, APPROVED, LOCKED
    approved_by TEXT,
    approved_at TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- Budget Line Items - Breakdown by category
CREATE TABLE IF NOT EXISTS budget_line_items (
    id TEXT PRIMARY KEY,
    budget_id TEXT NOT NULL,
    category TEXT NOT NULL, -- PERSONNEL, TECHNOLOGY, CONSULTING, TRAINING, INFRASTRUCTURE, OTHER
    subcategory TEXT,
    description TEXT,
    budget_type TEXT DEFAULT 'OPEX', -- CAPEX, OPEX
    planned_amount REAL NOT NULL DEFAULT 0,
    actual_amount REAL DEFAULT 0,
    committed_amount REAL DEFAULT 0, -- PO issued but not yet spent
    variance_amount REAL GENERATED ALWAYS AS (actual_amount - planned_amount) STORED,
    variance_percent REAL,
    forecast_amount REAL,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (budget_id) REFERENCES initiative_budgets(id) ON DELETE CASCADE
);

-- Budget Transactions - Individual expenses/commitments
CREATE TABLE IF NOT EXISTS budget_transactions (
    id TEXT PRIMARY KEY,
    budget_id TEXT NOT NULL,
    line_item_id TEXT,
    transaction_type TEXT NOT NULL, -- EXPENSE, COMMITMENT, REVERSAL, ADJUSTMENT
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'PLN',
    description TEXT,
    vendor TEXT,
    invoice_number TEXT,
    transaction_date TEXT NOT NULL,
    period_month INTEGER, -- 1-12
    period_year INTEGER,
    cost_center TEXT,
    gl_account TEXT,
    status TEXT DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, POSTED
    approved_by TEXT,
    approved_at TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (budget_id) REFERENCES initiative_budgets(id) ON DELETE CASCADE,
    FOREIGN KEY (line_item_id) REFERENCES budget_line_items(id) ON DELETE SET NULL
);

-- Budget Snapshots - For variance tracking over time
CREATE TABLE IF NOT EXISTS budget_snapshots (
    id TEXT PRIMARY KEY,
    budget_id TEXT NOT NULL,
    snapshot_type TEXT NOT NULL, -- BASELINE, MONTHLY, QUARTERLY, REFORECAST
    snapshot_date TEXT NOT NULL,
    planned_total REAL,
    actual_total REAL,
    committed_total REAL,
    forecast_total REAL,
    variance_total REAL,
    burn_rate REAL, -- Monthly burn rate at time of snapshot
    forecast_at_completion REAL,
    estimate_to_complete REAL,
    created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (budget_id) REFERENCES initiative_budgets(id) ON DELETE CASCADE
);

-- Budget Alerts - Threshold notifications
CREATE TABLE IF NOT EXISTS budget_alerts (
    id TEXT PRIMARY KEY,
    budget_id TEXT NOT NULL,
    alert_type TEXT NOT NULL, -- THRESHOLD_WARNING, THRESHOLD_CRITICAL, OVERRUN, FORECAST_EXCEEDED
    threshold_percent REAL, -- e.g., 80 for 80% consumed
    current_percent REAL,
    message TEXT,
    severity TEXT DEFAULT 'WARNING', -- INFO, WARNING, CRITICAL
    is_acknowledged INTEGER DEFAULT 0,
    acknowledged_by TEXT,
    acknowledged_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (budget_id) REFERENCES initiative_budgets(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_initiative_budgets_initiative ON initiative_budgets(initiative_id);
CREATE INDEX IF NOT EXISTS idx_initiative_budgets_org ON initiative_budgets(organization_id);
CREATE INDEX IF NOT EXISTS idx_budget_line_items_budget ON budget_line_items(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_transactions_budget ON budget_transactions(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_transactions_date ON budget_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_budget_snapshots_budget ON budget_snapshots(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_alerts_budget ON budget_alerts(budget_id);








