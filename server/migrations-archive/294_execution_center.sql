-- FLOW-EXECUTION-001: Execution Center Module Enhancements
-- Adds execution-specific fields and indexes for Execution Center module

-- Add execution phase tracking fields to initiatives
ALTER TABLE initiatives ADD COLUMN actual_end_date DATETIME;
ALTER TABLE initiatives ADD COLUMN execution_phase TEXT DEFAULT 'PLAN'; -- PLAN, PILOT, SCALE
ALTER TABLE initiatives ADD COLUMN sla_deadline DATETIME;

-- Add indexes for execution queries
CREATE INDEX IF NOT EXISTS idx_initiatives_status ON initiatives(status);
CREATE INDEX IF NOT EXISTS idx_initiatives_project_status ON initiatives(project_id, status);
CREATE INDEX IF NOT EXISTS idx_initiatives_execution ON initiatives(status) WHERE status IN ('EXECUTING', 'BLOCKED', 'DONE', 'CANCELLED', 'ARCHIVED');

-- Add escalation deadline to decisions if not exists
ALTER TABLE decisions ADD COLUMN escalation_deadline DATETIME;

-- Add indexes for decision calendar queries
CREATE INDEX IF NOT EXISTS idx_decisions_deadline ON decisions(deadline) WHERE deadline IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_decisions_status_deadline ON decisions(status, deadline);

-- Add indexes for task calendar queries  
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_status_due ON tasks(status, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_initiative ON tasks(initiative_id);

-- Ensure decision history table exists for audit trail
CREATE TABLE IF NOT EXISTS decision_history (
    id TEXT PRIMARY KEY,
    decision_id TEXT NOT NULL,
    action TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT,
    changed_by TEXT NOT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    details TEXT,
    FOREIGN KEY (decision_id) REFERENCES decisions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_decision_history_decision ON decision_history(decision_id);
CREATE INDEX IF NOT EXISTS idx_decision_history_changed_at ON decision_history(changed_at);
