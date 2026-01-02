-- Migration 063: RAID Items Table
-- Supports Risks, Assumptions, Issues, Dependencies tracking for initiatives

CREATE TABLE IF NOT EXISTS raid_items (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    initiative_id TEXT,
    type TEXT NOT NULL CHECK(type IN ('RISK', 'ASSUMPTION', 'ISSUE', 'DEPENDENCY')),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'MITIGATED', 'REALIZED', 'CLOSED')),
    probability TEXT CHECK(probability IN ('LOW', 'MEDIUM', 'HIGH')),
    impact TEXT CHECK(impact IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    mitigation_plan TEXT,
    owner_id TEXT,
    due_date TEXT,
    linked_items TEXT, -- JSON array of related RAID item IDs
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE SET NULL,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_raid_org ON raid_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_raid_initiative ON raid_items(initiative_id);
CREATE INDEX IF NOT EXISTS idx_raid_type_status ON raid_items(type, status);
CREATE INDEX IF NOT EXISTS idx_raid_owner ON raid_items(owner_id);
CREATE INDEX IF NOT EXISTS idx_raid_due_date ON raid_items(due_date);



