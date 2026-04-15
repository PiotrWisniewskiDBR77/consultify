-- Initiative Milestones for Roadmap Module
-- Migration: 293_initiative_milestones.sql
-- Enables milestone tracking and timeline planning in Initiatives module

-- ==========================================
-- INITIATIVE MILESTONES TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS initiative_milestones (
    id TEXT PRIMARY KEY,
    initiative_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    target_date DATE,
    actual_date DATE,
    status TEXT DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED, DELAYED
    order_index INTEGER DEFAULT 0,
    is_gate INTEGER DEFAULT 0, -- 1 = requires decision before proceeding
    gate_decision_id TEXT, -- linked decision if is_gate=1
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    FOREIGN KEY(initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(gate_decision_id) REFERENCES decisions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_milestones_initiative ON initiative_milestones(initiative_id);
CREATE INDEX IF NOT EXISTS idx_milestones_org ON initiative_milestones(organization_id);
CREATE INDEX IF NOT EXISTS idx_milestones_target_date ON initiative_milestones(target_date);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON initiative_milestones(status);

-- ==========================================
-- INITIATIVE RESOURCES TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS initiative_resources (
    id TEXT PRIMARY KEY,
    initiative_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    user_id TEXT,
    role TEXT NOT NULL, -- 'lead', 'member', 'consultant', 'stakeholder'
    allocation_percentage INTEGER DEFAULT 100, -- 0-100
    start_date DATE,
    end_date DATE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_resources_initiative ON initiative_resources(initiative_id);
CREATE INDEX IF NOT EXISTS idx_resources_user ON initiative_resources(user_id);

-- ==========================================
-- INITIATIVE PHASE TRACKING
-- ==========================================

-- Add phase column to initiatives
ALTER TABLE initiatives ADD COLUMN phase TEXT DEFAULT 'PLAN'; -- PLAN, PILOT, SCALE

-- Add current milestone reference
ALTER TABLE initiatives ADD COLUMN current_milestone_id TEXT;

-- Add capacity tracking
ALTER TABLE initiatives ADD COLUMN required_capacity_fte REAL DEFAULT 0;
ALTER TABLE initiatives ADD COLUMN allocated_capacity_fte REAL DEFAULT 0;

-- ==========================================
-- GATE DECISION TYPES (extend decisions)
-- ==========================================

-- Ensure decisions table has proper columns for gates
-- These columns may already exist from previous migrations

-- Add gate-specific fields if not exist
-- Note: Using a safe approach with CREATE TABLE for demo since ALTER might fail

-- ==========================================
-- SEED STANDARD MILESTONES TEMPLATE
-- ==========================================

INSERT OR IGNORE INTO initiative_milestones (id, initiative_id, organization_id, name, description, order_index, is_gate)
SELECT 
    'template-kick-off-' || i.id,
    i.id,
    i.organization_id,
    'Kick-off',
    'Project kick-off meeting and team alignment',
    1,
    0
FROM initiatives i
WHERE i.status IN ('PLANNING', 'REVIEW', 'APPROVED')
AND NOT EXISTS (
    SELECT 1 FROM initiative_milestones m 
    WHERE m.initiative_id = i.id AND m.name = 'Kick-off'
);

-- Add indexes for timeline queries
CREATE INDEX IF NOT EXISTS idx_initiatives_phase ON initiatives(phase);
CREATE INDEX IF NOT EXISTS idx_initiatives_dates ON initiatives(planned_start_date, planned_end_date);
