-- Migration: 019_phase_f_indexes
-- Description: Add composite indexes for org-scoped queries in Phase F Execution Mode

-- Tasks: Org + Initiative (for progress calculation)
CREATE INDEX IF NOT EXISTS idx_tasks_org_initiative 
    ON tasks(organization_id, initiative_id);

-- Tasks: Org + Assignee + Due Date (for My Work queries)
CREATE INDEX IF NOT EXISTS idx_tasks_org_assignee_due 
    ON tasks(organization_id, assignee_id, due_date);

-- Initiatives: Org + Status (for filtered lists)
CREATE INDEX IF NOT EXISTS idx_initiatives_org_status 
    ON initiatives(organization_id, status);

-- Notifications: Org + User + Created (for user notification lists)
CREATE INDEX IF NOT EXISTS idx_notifications_org_user_created 
    ON notifications(organization_id, user_id, created_at);

-- Notifications: Dedupe index (for _checkDuplicate query)
CREATE INDEX IF NOT EXISTS idx_notifications_dedupe 
    ON notifications(user_id, organization_id, type, related_object_id, created_at);
