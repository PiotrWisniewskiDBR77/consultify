-- Origin tracking: link tasks/decisions back to their source artifact (idea or notebook page).
-- Canonical API: server/src/routes/my-work.routes.ts (conversion endpoints)
--
-- After converting an idea or notebook page into a task/decision,
-- source_type + source_id record the origin so detail views can show backlinks.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_id TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_source ON tasks(source_type, source_id);

CREATE TABLE IF NOT EXISTS decisions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id TEXT,
    initiative_id TEXT,
    task_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'APPROVAL',
    decision_maker_id TEXT,
    options TEXT DEFAULT '[]',
    criteria TEXT,
    deadline TIMESTAMP,
    escalation_deadline TIMESTAMP,
    status TEXT DEFAULT 'pending',
    selected_option TEXT,
    decision_rationale TEXT,
    decided_at TIMESTAMP,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_decisions_org ON decisions(organization_id);
CREATE INDEX IF NOT EXISTS idx_decisions_project ON decisions(project_id);
CREATE INDEX IF NOT EXISTS idx_decisions_initiative ON decisions(initiative_id);
CREATE INDEX IF NOT EXISTS idx_decisions_task ON decisions(task_id);
CREATE INDEX IF NOT EXISTS idx_decisions_maker ON decisions(decision_maker_id);
CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status);
CREATE INDEX IF NOT EXISTS idx_decisions_deadline ON decisions(deadline);

ALTER TABLE decisions ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT NULL;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS source_id TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_decisions_source ON decisions(source_type, source_id);
