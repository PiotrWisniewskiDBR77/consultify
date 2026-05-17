-- Migration: 575_interview_sendback_missing_items.sql
-- Purpose: Persist send-back checklist for Interview sufficiency contract (V3-D01)

CREATE TABLE IF NOT EXISTS interview_assignments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    assignee_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_id TEXT NOT NULL,
    template_version INTEGER NOT NULL DEFAULT 1,
    process_ref TEXT,
    status TEXT NOT NULL DEFAULT 'assigned',
    session_id TEXT,
    task_id TEXT,
    due_at TIMESTAMP,
    started_at TIMESTAMP,
    submitted_at TIMESTAMP,
    sent_back_at TIMESTAMP,
    sent_back_reason TEXT,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_interview_assignments_org_assignee_status
  ON interview_assignments(organization_id, assignee_user_id, status);
CREATE INDEX IF NOT EXISTS idx_interview_assignments_org_template
  ON interview_assignments(organization_id, template_id);
CREATE INDEX IF NOT EXISTS idx_interview_assignments_session
  ON interview_assignments(session_id);

ALTER TABLE interview_assignments
  ADD COLUMN IF NOT EXISTS missing_items_json TEXT;
