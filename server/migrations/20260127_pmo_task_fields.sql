-- Migration: PMO task fields (owner, acceptance, backup, weight, started_at)
-- Adds strategic/governance metadata required by PMO-style task view.

-- Execution dates / ownership
ALTER TABLE tasks ADD COLUMN started_at TIMESTAMP;
ALTER TABLE tasks ADD COLUMN owner_id TEXT REFERENCES users(id) ON DELETE SET NULL;

-- Acceptance gate (approval)
ALTER TABLE tasks ADD COLUMN requires_acceptance BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN acceptance_type TEXT; -- manual | automatic
ALTER TABLE tasks ADD COLUMN acceptor_id TEXT REFERENCES users(id) ON DELETE SET NULL;

-- Backup assignee (substitute)
ALTER TABLE tasks ADD COLUMN backup_assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL;

-- Weight for initiative progress contribution
ALTER TABLE tasks ADD COLUMN weight REAL DEFAULT 1.0;
ALTER TABLE tasks ADD COLUMN weight_reason TEXT;

-- Helpful indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_tasks_owner_id ON tasks(owner_id);
CREATE INDEX IF NOT EXISTS idx_tasks_acceptor_id ON tasks(acceptor_id);
CREATE INDEX IF NOT EXISTS idx_tasks_backup_assignee_id ON tasks(backup_assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_initiative_due ON tasks(initiative_id, due_date);
