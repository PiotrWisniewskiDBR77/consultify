-- Assessment Workflow Enhancements
-- Migration: 286_assessment_workflow_enhancements.sql
-- Adds missing columns and tables for full workflow support

-- ============================================
-- Assessment Workflow Transitions
-- History of status changes
-- ============================================
CREATE TABLE IF NOT EXISTS assessment_workflow_transitions (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    triggered_by TEXT NOT NULL,
    triggered_by_name TEXT,
    reason TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (workflow_id) REFERENCES assessment_workflows(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transitions_workflow ON assessment_workflow_transitions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_transitions_timestamp ON assessment_workflow_transitions(timestamp);

-- ============================================
-- Add missing columns to assessment_reviews
-- ============================================
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE
-- These will fail silently if columns already exist

-- Add assessment_id to reviews for direct lookup
-- Wrapped in a transaction to handle potential errors
BEGIN TRANSACTION;
ALTER TABLE assessment_reviews ADD COLUMN assessment_id TEXT;
COMMIT;

-- Add feedback column as alias for comments
BEGIN TRANSACTION;
ALTER TABLE assessment_reviews ADD COLUMN feedback TEXT;
COMMIT;

-- Add assigned_at as alias for requested_at
BEGIN TRANSACTION;
ALTER TABLE assessment_reviews ADD COLUMN assigned_at DATETIME;
COMMIT;

-- Add message column for review request messages
BEGIN TRANSACTION;
ALTER TABLE assessment_reviews ADD COLUMN message TEXT;
COMMIT;

-- ============================================
-- Add missing columns to assessment_workflows
-- ============================================
-- Add SLA deadline tracking
BEGIN TRANSACTION;
ALTER TABLE assessment_workflows ADD COLUMN sla_deadline DATETIME;
COMMIT;

-- ============================================
-- Update assessment_versions for compatibility
-- ============================================
-- Add data column as alias for assessment_data
BEGIN TRANSACTION;
ALTER TABLE assessment_versions ADD COLUMN data TEXT;
COMMIT;

-- Add change_log column as alias for change_summary
BEGIN TRANSACTION;
ALTER TABLE assessment_versions ADD COLUMN change_log TEXT;
COMMIT;

-- ============================================
-- Create view for easier review access
-- ============================================
DROP VIEW IF EXISTS v_assessment_reviews_full;
CREATE VIEW IF NOT EXISTS v_assessment_reviews_full AS
SELECT 
    r.id,
    r.workflow_id,
    COALESCE(r.assessment_id, w.assessment_id) as assessment_id,
    r.reviewer_id,
    r.reviewer_role,
    r.status,
    r.rating,
    COALESCE(r.feedback, r.comments) as feedback,
    r.comments,
    r.recommendation,
    COALESCE(r.assigned_at, r.requested_at) as assigned_at,
    r.due_date,
    r.started_at,
    r.completed_at,
    r.message,
    w.organization_id
FROM assessment_reviews r
LEFT JOIN assessment_workflows w ON r.workflow_id = w.id;

-- ============================================
-- Create view for version history
-- ============================================
DROP VIEW IF EXISTS v_assessment_versions_full;
CREATE VIEW IF NOT EXISTS v_assessment_versions_full AS
SELECT 
    id,
    assessment_id,
    version,
    COALESCE(data, assessment_data) as data,
    COALESCE(change_log, change_summary) as change_log,
    changed_axes,
    created_by,
    created_at
FROM assessment_versions;
