-- Migration: 297_decision_impacts_table.sql
-- Purpose: Create decision_impacts table for decision management system
-- This table tracks which entities (tasks, initiatives, projects, gates) are impacted by decisions

CREATE TABLE IF NOT EXISTS decision_impacts (
    id TEXT PRIMARY KEY,
    decision_id TEXT NOT NULL,
    impacted_type TEXT NOT NULL, -- 'task', 'initiative', 'project', 'gate'
    impacted_id TEXT NOT NULL,
    impact_description TEXT,
    is_blocker INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_decision_impacts_decision ON decision_impacts(decision_id);
CREATE INDEX IF NOT EXISTS idx_decision_impacts_blocker ON decision_impacts(is_blocker);
CREATE INDEX IF NOT EXISTS idx_decision_impacts_impacted ON decision_impacts(impacted_type, impacted_id);

-- Note: Foreign key constraint to decisions table is added separately if decisions table exists
-- This allows the table to be created even if decisions table doesn't exist yet
