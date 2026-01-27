-- INTERVIEW-ASSIGNMENTS-002: project scoping + demo seed assignments
-- Migration: 300_interview_assignments_project_and_seed.sql
-- Purpose:
--  - Add project_id to interview_assignments for manager/PM scoping
--  - Seed a few assignments + mirrored tasks for local demo data (guarded by EXISTS)

-- ==========================================
-- SCHEMA
-- ==========================================

ALTER TABLE interview_assignments ADD COLUMN project_id TEXT;
CREATE INDEX IF NOT EXISTS idx_interview_assignments_project ON interview_assignments(project_id);

-- ==========================================
-- DEMO SEED (guarded)
-- ==========================================
-- Seed for org-dbr77-test (DBR77) and known demo users.
-- This is safe because it uses INSERT OR IGNORE with fixed IDs.

-- Tasks mirror (MyWork)
INSERT OR IGNORE INTO tasks
  (id, project_id, organization_id, title, description, status, priority, assignee_id, reporter_id, due_date, task_type, created_at, updated_at)
SELECT
  't_seed_interview_1',
  'project-dbr77-opex',
  'org-dbr77-test',
  'Interview: Quick Assessment',
  '{"type":"interview_assignment","assignmentId":"ia_seed_interview_1","templateId":"itpl_quick_assessment_v1"}',
  'todo',
  'medium',
  'user-dbr77-admin',
  'user-dbr77-admin',
  datetime('now', '+2 days'),
  'interview',
  datetime('now'),
  datetime('now')
WHERE
  EXISTS (SELECT 1 FROM organizations WHERE id = 'org-dbr77-test')
  AND EXISTS (SELECT 1 FROM users WHERE id = 'user-dbr77-admin');

INSERT OR IGNORE INTO tasks
  (id, project_id, organization_id, title, description, status, priority, assignee_id, reporter_id, due_date, task_type, created_at, updated_at)
SELECT
  't_seed_interview_2',
  'project-dbr77-smart',
  'org-dbr77-test',
  'Interview: Data & Metrics',
  '{"type":"interview_assignment","assignmentId":"ia_seed_interview_2","templateId":"itpl_data_metrics_v1"}',
  'todo',
  'medium',
  'user-dbr77-user',
  'user-dbr77-admin',
  datetime('now', '+4 days'),
  'interview',
  datetime('now'),
  datetime('now')
WHERE
  EXISTS (SELECT 1 FROM organizations WHERE id = 'org-dbr77-test')
  AND EXISTS (SELECT 1 FROM users WHERE id = 'user-dbr77-user')
  AND EXISTS (SELECT 1 FROM users WHERE id = 'user-dbr77-admin');

INSERT OR IGNORE INTO tasks
  (id, project_id, organization_id, title, description, status, priority, assignee_id, reporter_id, due_date, task_type, created_at, updated_at)
SELECT
  't_seed_interview_3',
  'project-dbr77-opex',
  'org-dbr77-test',
  'Interview: Operational Excellence',
  '{"type":"interview_assignment","assignmentId":"ia_seed_interview_3","templateId":"itpl_operational_excellence_v1"}',
  'todo',
  'high',
  'user-dbr77-pm1',
  'user-dbr77-admin',
  datetime('now', '-1 days'),
  'interview',
  datetime('now'),
  datetime('now')
WHERE
  EXISTS (SELECT 1 FROM organizations WHERE id = 'org-dbr77-test')
  AND EXISTS (SELECT 1 FROM users WHERE id = 'user-dbr77-pm1')
  AND EXISTS (SELECT 1 FROM users WHERE id = 'user-dbr77-admin');

-- Assignments
INSERT OR IGNORE INTO interview_assignments
  (id, organization_id, project_id, assignee_user_id, template_id, template_version, status, task_id, due_at, created_by, created_at, updated_at)
SELECT
  'ia_seed_interview_1',
  'org-dbr77-test',
  'project-dbr77-opex',
  'user-dbr77-admin',
  'itpl_quick_assessment_v1',
  1,
  'assigned',
  't_seed_interview_1',
  datetime('now', '+2 days'),
  'user-dbr77-admin',
  datetime('now'),
  datetime('now')
WHERE
  EXISTS (SELECT 1 FROM organizations WHERE id = 'org-dbr77-test')
  AND EXISTS (SELECT 1 FROM users WHERE id = 'user-dbr77-admin');

INSERT OR IGNORE INTO interview_assignments
  (id, organization_id, project_id, assignee_user_id, template_id, template_version, status, task_id, due_at, created_by, created_at, updated_at)
SELECT
  'ia_seed_interview_2',
  'org-dbr77-test',
  'project-dbr77-smart',
  'user-dbr77-user',
  'itpl_data_metrics_v1',
  1,
  'assigned',
  't_seed_interview_2',
  datetime('now', '+4 days'),
  'user-dbr77-admin',
  datetime('now'),
  datetime('now')
WHERE
  EXISTS (SELECT 1 FROM organizations WHERE id = 'org-dbr77-test')
  AND EXISTS (SELECT 1 FROM users WHERE id = 'user-dbr77-user')
  AND EXISTS (SELECT 1 FROM users WHERE id = 'user-dbr77-admin');

INSERT OR IGNORE INTO interview_assignments
  (id, organization_id, project_id, assignee_user_id, template_id, template_version, status, task_id, due_at, created_by, created_at, updated_at)
SELECT
  'ia_seed_interview_3',
  'org-dbr77-test',
  'project-dbr77-opex',
  'user-dbr77-pm1',
  'itpl_operational_excellence_v1',
  1,
  'assigned',
  't_seed_interview_3',
  datetime('now', '-1 days'),
  'user-dbr77-admin',
  datetime('now'),
  datetime('now')
WHERE
  EXISTS (SELECT 1 FROM organizations WHERE id = 'org-dbr77-test')
  AND EXISTS (SELECT 1 FROM users WHERE id = 'user-dbr77-pm1')
  AND EXISTS (SELECT 1 FROM users WHERE id = 'user-dbr77-admin');

