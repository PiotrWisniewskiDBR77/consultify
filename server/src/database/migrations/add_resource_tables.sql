/**
 * Resource Allocation Migration Script
 * Run this migration to add budget_expenses and user_quotas tables
 * 
 * Usage:
 * - PostgreSQL: psql -d consultify < server/src/database/migrations/add_resource_tables.sql
 * - SQLite: sqlite3 consultify.db < server/src/database/migrations/add_resource_tables.sql
 */

-- Budget Expenses Table
CREATE TABLE IF NOT EXISTS budget_expenses (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('TOKENS', 'STORAGE', 'COMPUTE', 'API', 'OTHER')),
    description TEXT,
    metadata TEXT DEFAULT '{}',
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- User Quotas Table  
CREATE TABLE IF NOT EXISTS user_quotas (
    user_id TEXT PRIMARY KEY,
    storage_quota_mb INTEGER,
    api_rate_limit_per_hour INTEGER,
    ai_requests_per_day INTEGER,
    max_concurrent_jobs INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for budget_expenses
CREATE INDEX IF NOT EXISTS idx_budget_expenses_org ON budget_expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_budget_expenses_category ON budget_expenses(category);
CREATE INDEX IF NOT EXISTS idx_budget_expenses_recorded_at ON budget_expenses(recorded_at DESC);

-- Indexes for user_quotas
CREATE INDEX IF NOT EXISTS idx_user_quotas_user ON user_quotas(user_id);
