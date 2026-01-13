-- Customer Lifecycle Management Tables
-- Migration: 200_customer_lifecycle.sql

-- Lifecycle Stages (e.g., Trial, Onboarding, Active, At Risk, Churned)
CREATE TABLE IF NOT EXISTS customer_lifecycle_stages (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    description TEXT,
    order_index INTEGER DEFAULT 0,
    color TEXT DEFAULT '#3B82F6',
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lifecycle Transitions (tracks when organizations move between stages)
CREATE TABLE IF NOT EXISTS customer_lifecycle_transitions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    from_stage_id TEXT REFERENCES customer_lifecycle_stages(id),
    to_stage_id TEXT NOT NULL REFERENCES customer_lifecycle_stages(id),
    transitioned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    transitioned_by TEXT REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Organization's current lifecycle stage (SQLite doesn't support IF NOT EXISTS for ALTER)
-- Run this only if column doesn't exist:
-- ALTER TABLE organizations ADD COLUMN lifecycle_stage_id TEXT REFERENCES customer_lifecycle_stages(id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lifecycle_transitions_org ON customer_lifecycle_transitions(organization_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_transitions_date ON customer_lifecycle_transitions(transitioned_at DESC);
CREATE INDEX IF NOT EXISTS idx_lifecycle_stages_order ON customer_lifecycle_stages(order_index);

-- Default Lifecycle Stages
INSERT OR IGNORE INTO customer_lifecycle_stages (id, name, description, order_index, color) VALUES
    ('stage-trial', 'Trial', 'Customer is in trial period', 0, '#3B82F6'),
    ('stage-onboarding', 'Onboarding', 'Customer is being onboarded', 1, '#10B981'),
    ('stage-active', 'Active', 'Customer is actively using the platform', 2, '#8B5CF6'),
    ('stage-growth', 'Growth', 'Customer is expanding usage', 3, '#F59E0B'),
    ('stage-at-risk', 'At Risk', 'Customer showing signs of potential churn', 4, '#EF4444'),
    ('stage-churned', 'Churned', 'Customer has cancelled', 5, '#6B7280');
