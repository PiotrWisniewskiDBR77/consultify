-- ==========================================
-- MIGRATION 302: Fix decisions table schema
-- Aligns existing decisions table with decisionService.ts
-- SQLite compatible version
-- ==========================================

-- Add missing columns to decisions table
-- SQLite will ignore if column exists (using PRAGMA)

-- Check and add initiative_id
ALTER TABLE decisions ADD COLUMN initiative_id TEXT;

-- Check and add task_id  
ALTER TABLE decisions ADD COLUMN task_id TEXT;

-- Check and add type
ALTER TABLE decisions ADD COLUMN type TEXT DEFAULT 'APPROVAL';

-- Check and add decision_maker_id
ALTER TABLE decisions ADD COLUMN decision_maker_id TEXT;

-- Check and add options
ALTER TABLE decisions ADD COLUMN options TEXT DEFAULT '[]';

-- Check and add criteria
ALTER TABLE decisions ADD COLUMN criteria TEXT;

-- Check and add deadline
ALTER TABLE decisions ADD COLUMN deadline TIMESTAMP;

-- Check and add escalation_deadline
ALTER TABLE decisions ADD COLUMN escalation_deadline TIMESTAMP;

-- Check and add selected_option
ALTER TABLE decisions ADD COLUMN selected_option TEXT;

-- Check and add decision_rationale
ALTER TABLE decisions ADD COLUMN decision_rationale TEXT;

-- Check and add decided_at
ALTER TABLE decisions ADD COLUMN decided_at TIMESTAMP;

-- Check and add created_by
ALTER TABLE decisions ADD COLUMN created_by TEXT;

-- Check and add updated_at
ALTER TABLE decisions ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Copy data from old columns to new columns
UPDATE decisions SET decision_maker_id = decision_owner_id WHERE decision_maker_id IS NULL;
UPDATE decisions SET deadline = due_date WHERE deadline IS NULL AND due_date IS NOT NULL;
UPDATE decisions SET created_by = decision_owner_id WHERE created_by IS NULL;

-- Set type based on existing data patterns
UPDATE decisions SET type = 'GO_NO_GO' WHERE title LIKE '%Budget%' OR title LIKE '%Migration%';
UPDATE decisions SET type = 'APPROVAL' WHERE type IS NULL OR type = '';

-- Set default options for existing decisions
UPDATE decisions SET options = '[{"id":"approve","label":"Approve"},{"id":"reject","label":"Reject"}]' 
WHERE options IS NULL OR options = '[]';

-- Set decided_at for approved/rejected decisions
UPDATE decisions SET decided_at = created_at WHERE status IN ('approved', 'rejected') AND decided_at IS NULL;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_decisions_initiative ON decisions(initiative_id);
CREATE INDEX IF NOT EXISTS idx_decisions_task ON decisions(task_id);
CREATE INDEX IF NOT EXISTS idx_decisions_maker ON decisions(decision_maker_id);
CREATE INDEX IF NOT EXISTS idx_decisions_deadline ON decisions(deadline);
