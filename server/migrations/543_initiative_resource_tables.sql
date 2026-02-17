-- ==========================================
-- INITIATIVE BUDGET ITEMS TABLE
-- ==========================================
-- Separate table for initiative budget line items (CAPEX/OPEX)

CREATE TABLE IF NOT EXISTS initiative_budget_items (
    id TEXT PRIMARY KEY,
    initiative_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',       -- 'personnel', 'technology', 'consulting', 'training', 'infrastructure', 'licenses', 'other'
    cost_type TEXT NOT NULL DEFAULT 'OPEX',        -- 'CAPEX' or 'OPEX'
    amount REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'PLN',
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_budget_items_initiative ON initiative_budget_items(initiative_id);

-- ==========================================
-- INITIATIVE TOOLS TABLE
-- ==========================================
-- Separate table for tools & infrastructure linked to an initiative

CREATE TABLE IF NOT EXISTS initiative_tools (
    id TEXT PRIMARY KEY,
    initiative_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'software',              -- 'software', 'hardware', 'cloud', 'platform', 'other'
    vendor TEXT,
    license_cost REAL DEFAULT 0,
    license_type TEXT DEFAULT 'subscription',       -- 'subscription', 'perpetual', 'open_source', 'internal'
    status TEXT DEFAULT 'planned',                  -- 'planned', 'active', 'deprecated'
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tools_initiative ON initiative_tools(initiative_id);

-- ==========================================
-- ADD MISSING COLUMNS TO initiative_resources
-- ==========================================
-- Ensure 'name' column exists for generic (non-user) resources
-- and 'updated_at' for consistency

-- SQLite doesn't support ADD COLUMN IF NOT EXISTS natively,
-- so we use a safe approach that ignores errors if column exists.

-- Add 'name' column
ALTER TABLE initiative_resources ADD COLUMN name TEXT DEFAULT '';

-- Add 'updated_at' column
ALTER TABLE initiative_resources ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;
