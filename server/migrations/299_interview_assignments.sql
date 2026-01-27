-- INTERVIEW-ASSIGNMENTS-001: Interview assignments workflow
-- Migration: 299_interview_assignments.sql
-- Purpose:
--  - Add interview_assignments table (admin assigns interview templates to users as tasks)
--  - Add assignment_id to interview_sessions for fast lookups/locking
--  - Seed permissions for assignment management

-- ==========================================
-- ASSIGNMENTS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS interview_assignments (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    assignee_user_id TEXT NOT NULL,
    template_id TEXT NOT NULL,
    template_version INTEGER NOT NULL DEFAULT 1,
    process_ref TEXT,
    status TEXT NOT NULL DEFAULT 'assigned', -- assigned | in_progress | submitted | sent_back | completed
    session_id TEXT,
    task_id TEXT,
    due_at TIMESTAMP,
    started_at TIMESTAMP,
    submitted_at TIMESTAMP,
    sent_back_at TIMESTAMP,
    sent_back_reason TEXT,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_interview_assignments_org_assignee_status
  ON interview_assignments(organization_id, assignee_user_id, status);
CREATE INDEX IF NOT EXISTS idx_interview_assignments_org_template
  ON interview_assignments(organization_id, template_id);
CREATE INDEX IF NOT EXISTS idx_interview_assignments_session
  ON interview_assignments(session_id);

-- ==========================================
-- EXTEND INTERVIEW SESSIONS
-- ==========================================

ALTER TABLE interview_sessions ADD COLUMN assignment_id TEXT;
CREATE INDEX IF NOT EXISTS idx_interview_sessions_assignment ON interview_sessions(assignment_id);

-- ==========================================
-- PERMISSIONS (Assignments)
-- ==========================================

INSERT OR IGNORE INTO permissions (key, name, description, category, icon) VALUES
('INTERVIEW_ASSIGN_VIEW', 'Interview: View Assignments', 'View interview assignments', 'INTERVIEW', 'assignment'),
('INTERVIEW_ASSIGN_MANAGE', 'Interview: Manage Assignments', 'Create and manage interview assignments', 'INTERVIEW', 'assignment_ind');

INSERT OR IGNORE INTO role_permissions (id, role, permission_key, description) VALUES
('rp_interview_assign_view_pm', 'PROJECT_MANAGER', 'INTERVIEW_ASSIGN_VIEW', 'View interview assignments'),
('rp_interview_assign_manage_pm', 'PROJECT_MANAGER', 'INTERVIEW_ASSIGN_MANAGE', 'Manage interview assignments'),
('rp_interview_assign_view_admin', 'ADMIN', 'INTERVIEW_ASSIGN_VIEW', 'View interview assignments'),
('rp_interview_assign_manage_admin', 'ADMIN', 'INTERVIEW_ASSIGN_MANAGE', 'Manage interview assignments'),
('rp_interview_assign_view_super', 'SUPERADMIN', 'INTERVIEW_ASSIGN_VIEW', 'View interview assignments'),
('rp_interview_assign_manage_super', 'SUPERADMIN', 'INTERVIEW_ASSIGN_MANAGE', 'Manage interview assignments');

