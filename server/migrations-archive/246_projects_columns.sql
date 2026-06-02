-- FLOW-PROJECT-001: Add columns to projects table
-- Migration: 246_projects_columns.sql
-- Note: Run after 245_project_enhancements.sql

-- Check if columns exist before adding (SQLite workaround)
-- In production, use proper migration tool

-- PMO standard for project
ALTER TABLE projects ADD COLUMN pmo_standard TEXT DEFAULT 'pmbok';

-- Location reference
ALTER TABLE projects ADD COLUMN location_id TEXT;

-- Project timeline
ALTER TABLE projects ADD COLUMN start_date DATE;
ALTER TABLE projects ADD COLUMN target_end_date DATE;
ALTER TABLE projects ADD COLUMN actual_end_date DATE;

-- Budget tracking
ALTER TABLE projects ADD COLUMN budget_amount DECIMAL(15,2);
ALTER TABLE projects ADD COLUMN budget_currency TEXT DEFAULT 'EUR';

-- Archive info
ALTER TABLE projects ADD COLUMN archived_at TIMESTAMP;
ALTER TABLE projects ADD COLUMN archived_by TEXT;

-- Index for location filtering
CREATE INDEX IF NOT EXISTS idx_projects_location ON projects(location_id);
CREATE INDEX IF NOT EXISTS idx_projects_pmo_standard ON projects(pmo_standard);
CREATE INDEX IF NOT EXISTS idx_projects_archived ON projects(archived_at);
