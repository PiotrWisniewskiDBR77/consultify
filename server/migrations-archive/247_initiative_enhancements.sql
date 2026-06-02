-- FLOW-INITIATIVE-001: Initiative Management Enhancements
-- Migration: 247_initiative_enhancements.sql

-- ==========================================
-- INITIATIVES TABLE ENHANCEMENTS
-- ==========================================

-- Stage gate tracking
ALTER TABLE initiatives ADD COLUMN review_requested_at TIMESTAMP;
ALTER TABLE initiatives ADD COLUMN review_requested_by TEXT;
ALTER TABLE initiatives ADD COLUMN approved_at TIMESTAMP;
ALTER TABLE initiatives ADD COLUMN approved_by TEXT;
ALTER TABLE initiatives ADD COLUMN approval_comment TEXT;

-- Execution tracking
ALTER TABLE initiatives ADD COLUMN execution_started_at TIMESTAMP;
ALTER TABLE initiatives ADD COLUMN blocked_at TIMESTAMP;
ALTER TABLE initiatives ADD COLUMN blocked_reason TEXT;
ALTER TABLE initiatives ADD COLUMN unblocked_at TIMESTAMP;
ALTER TABLE initiatives ADD COLUMN done_at TIMESTAMP;
ALTER TABLE initiatives ADD COLUMN done_by TEXT;

-- Benefits reference
ALTER TABLE initiatives ADD COLUMN benefits_tracking_enabled INTEGER DEFAULT 0;
ALTER TABLE initiatives ADD COLUMN benefits_kpi_ids TEXT; -- JSON array of KPI IDs

-- Source reference
ALTER TABLE initiatives ADD COLUMN source_type TEXT; -- 'assessment', 'manual', 'pdf_import', 'ai_generated'
ALTER TABLE initiatives ADD COLUMN source_id TEXT; -- assessment_id, pdf_id, etc.

-- Roadmap positioning
ALTER TABLE initiatives ADD COLUMN roadmap_quarter TEXT; -- 'Q1', 'Q2', etc.
ALTER TABLE initiatives ADD COLUMN roadmap_year INTEGER;
ALTER TABLE initiatives ADD COLUMN priority_order INTEGER DEFAULT 0;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_initiatives_status ON initiatives(status);
CREATE INDEX IF NOT EXISTS idx_initiatives_roadmap ON initiatives(roadmap_year, roadmap_quarter);
CREATE INDEX IF NOT EXISTS idx_initiatives_source ON initiatives(source_type, source_id);

-- ==========================================
-- INITIATIVE COMPLETION CHECKLIST
-- ==========================================

CREATE TABLE IF NOT EXISTS initiative_completion_checks (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    is_required INTEGER DEFAULT 1,
    category TEXT DEFAULT 'general', -- 'general', 'financial', 'team', 'timeline', 'scope'
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Default completion checklist
INSERT OR IGNORE INTO initiative_completion_checks (id, organization_id, field_name, display_name, is_required, category, order_index) VALUES
    ('check-title', 'default', 'title', 'Initiative Title', 1, 'general', 1),
    ('check-summary', 'default', 'summary', 'Summary Description', 1, 'general', 2),
    ('check-problem', 'default', 'problem_statement', 'Problem Statement', 1, 'general', 3),
    ('check-deliverables', 'default', 'deliverables', 'Deliverables Defined', 1, 'scope', 4),
    ('check-success', 'default', 'success_criteria', 'Success Criteria', 1, 'scope', 5),
    ('check-start-date', 'default', 'planned_start_date', 'Planned Start Date', 1, 'timeline', 6),
    ('check-end-date', 'default', 'planned_end_date', 'Planned End Date', 1, 'timeline', 7),
    ('check-owner-business', 'default', 'owner_business_id', 'Business Owner', 1, 'team', 8),
    ('check-owner-exec', 'default', 'owner_execution_id', 'Execution Owner', 0, 'team', 9),
    ('check-business-value', 'default', 'business_value', 'Business Value Estimated', 0, 'financial', 10),
    ('check-cost', 'default', 'cost_capex', 'Cost Estimate', 0, 'financial', 11);

-- ==========================================
-- INITIATIVE HISTORY (Audit trail)
-- ==========================================

CREATE TABLE IF NOT EXISTS initiative_history (
    id TEXT PRIMARY KEY,
    initiative_id TEXT NOT NULL,
    action TEXT NOT NULL, -- 'created', 'updated', 'status_changed', 'moved', 'blocked', 'unblocked'
    old_value TEXT, -- JSON
    new_value TEXT, -- JSON
    changed_by TEXT NOT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_initiative_history_initiative ON initiative_history(initiative_id);
CREATE INDEX IF NOT EXISTS idx_initiative_history_action ON initiative_history(action);

-- ==========================================
-- TASK ENHANCEMENTS (Initiative relationship)
-- ==========================================

-- Note: Tasks should already have initiative_id
-- Add blocked_by_decision field
ALTER TABLE tasks ADD COLUMN blocked_by_decision_id TEXT;
ALTER TABLE tasks ADD COLUMN blocked_at TIMESTAMP;
ALTER TABLE tasks ADD COLUMN blocked_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_tasks_blocked ON tasks(blocked_by_decision_id);
CREATE INDEX IF NOT EXISTS idx_tasks_initiative ON tasks(initiative_id);
