-- Migration: 539_builtin_role_permissions.sql
-- Purpose: Add built-in role permission support for PostgreSQL DBs that have role_permissions
--          with role_id/permission_id schema (from 200_security_mvp) instead of role/permission_key.
-- Date: 2026-02-17
--
-- The permissionService expects role_permissions to have (role, permission_key) for built-in
-- roles (Owner, Admin, Member, etc.). Some PostgreSQL deployments have the 200 schema
-- (role_id, permission_id) instead. This migration creates a dedicated table for built-in
-- role permissions so permissionService works without modifying the enterprise role_permissions.

-- Create table for built-in role permissions (role name + permission_key)
CREATE TABLE IF NOT EXISTS builtin_role_permissions (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    permission_key TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_builtin_role_perms_role ON builtin_role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_builtin_role_perms_key ON builtin_role_permissions(permission_key);

-- Seed essential built-in role permissions (from 014, 048, 293, 295, 296, 297, 299, 303, 305, 291)
INSERT OR IGNORE INTO builtin_role_permissions (id, role, permission_key, description) VALUES
    ('brp-sa-01', 'SUPERADMIN', 'POLICY_RULE_VIEW', 'View policy rules'),
    ('brp-sa-02', 'SUPERADMIN', 'POLICY_RULE_CREATE', 'Create policy rules'),
    ('brp-sa-03', 'SUPERADMIN', 'POLICY_RULE_UPDATE', 'Update policy rules'),
    ('brp-sa-04', 'SUPERADMIN', 'POLICY_RULE_DELETE', 'Delete policy rules'),
    ('brp-sa-05', 'SUPERADMIN', 'POLICY_RULE_TOGGLE', 'Enable/disable policy rules'),
    ('brp-sa-06', 'SUPERADMIN', 'POLICY_ENGINE_TOGGLE', 'Enable/disable policy engine'),
    ('brp-sa-07', 'SUPERADMIN', 'PLAYBOOK_VIEW', 'View playbook'),
    ('brp-sa-08', 'SUPERADMIN', 'AI_PROPOSAL_VIEW', 'View AI proposals'),
    ('brp-sa-09', 'SUPERADMIN', 'ORG_SETTINGS_VIEW', 'View org settings'),
    ('brp-sa-10', 'SUPERADMIN', 'USER_MANAGE', 'Manage users'),
    ('brp-sa-11', 'SUPERADMIN', 'ASSESSMENT_REQUEST_REVIEW', 'Request review'),
    ('brp-sa-12', 'SUPERADMIN', 'INTERVIEW_START', 'Start interview'),
    ('brp-sa-13', 'SUPERADMIN', 'INTERVIEW_ASSIGN_VIEW', 'View assignments'),
    ('brp-sa-14', 'SUPERADMIN', 'INTERVIEW_INSIGHTS_VIEW', 'View insights'),
    ('brp-sa-15', 'SUPERADMIN', 'TOOLS_REQUEST_REVIEW', 'Request review'),
    ('brp-ad-01', 'ADMIN', 'POLICY_RULE_VIEW', 'View policy rules'),
    ('brp-ad-02', 'ADMIN', 'POLICY_RULE_CREATE', 'Create policy rules'),
    ('brp-ad-03', 'ADMIN', 'PLAYBOOK_VIEW', 'View playbook'),
    ('brp-ad-04', 'ADMIN', 'AI_PROPOSAL_VIEW', 'View AI proposals'),
    ('brp-ad-05', 'ADMIN', 'ORG_SETTINGS_VIEW', 'View org settings'),
    ('brp-ad-06', 'ADMIN', 'USER_MANAGE', 'Manage users'),
    ('brp-ad-07', 'ADMIN', 'ASSESSMENT_REQUEST_REVIEW', 'Request review'),
    ('brp-ad-08', 'ADMIN', 'INTERVIEW_REMIND', 'Send reminders'),
    ('brp-ad-09', 'ADMIN', 'INTERVIEW_ASSIGN_MANAGE', 'Manage assignments'),
    ('brp-ad-10', 'ADMIN', 'INTERVIEW_INSIGHTS_VIEW', 'View insights'),
    ('brp-ad-11', 'ADMIN', 'TOOLS_REQUEST_REVIEW', 'Request review'),
    ('brp-ad-12', 'ADMIN', 'EMAIL_TEMPLATE_VIEW', 'View email templates'),
    ('brp-ad-13', 'ADMIN', 'CONTENT_VIEW', 'View content'),
    ('brp-pm-01', 'PROJECT_MANAGER', 'POLICY_RULE_VIEW', 'View policy rules'),
    ('brp-pm-02', 'PROJECT_MANAGER', 'PLAYBOOK_VIEW', 'View playbook'),
    ('brp-pm-03', 'PROJECT_MANAGER', 'AI_PROPOSAL_VIEW', 'View AI proposals'),
    ('brp-pm-04', 'PROJECT_MANAGER', 'ASSESSMENT_REQUEST_REVIEW', 'Request review'),
    ('brp-pm-05', 'PROJECT_MANAGER', 'INTERVIEW_START', 'Start interview'),
    ('brp-pm-06', 'PROJECT_MANAGER', 'INTERVIEW_ASSIGN_VIEW', 'View assignments'),
    ('brp-pm-07', 'PROJECT_MANAGER', 'INTERVIEW_ASSIGN_MANAGE', 'Manage assignments'),
    ('brp-pm-08', 'PROJECT_MANAGER', 'INTERVIEW_REMIND', 'Send reminders'),
    ('brp-pm-09', 'PROJECT_MANAGER', 'INTERVIEW_INSIGHTS_VIEW', 'View insights'),
    ('brp-pm-10', 'PROJECT_MANAGER', 'TOOLS_REQUEST_REVIEW', 'Request review'),
    ('brp-pm-11', 'PROJECT_MANAGER', 'EMAIL_TEMPLATE_VIEW', 'View email templates'),
    ('brp-pm-12', 'PROJECT_MANAGER', 'CONTENT_VIEW', 'View content'),
    ('brp-pm-13', 'PROJECT_MANAGER', 'ASSESSMENT_VIEW', 'View assessment'),
    ('brp-tm-01', 'TEAM_MEMBER', 'PLAYBOOK_VIEW', 'View playbook'),
    ('brp-tm-02', 'TEAM_MEMBER', 'AI_PROPOSAL_VIEW', 'View AI proposals'),
    ('brp-tm-03', 'TEAM_MEMBER', 'INTERVIEW_START', 'Start interview'),
    ('brp-tm-04', 'TEAM_MEMBER', 'INTERVIEW_TEMPLATE_VIEW', 'View templates'),
    ('brp-tm-05', 'TEAM_MEMBER', 'INTERVIEW_TEMPLATE_USE', 'Use templates'),
    ('brp-tm-06', 'TEAM_MEMBER', 'EMAIL_TEMPLATE_VIEW', 'View email templates'),
    ('brp-tm-07', 'TEAM_MEMBER', 'CONTENT_VIEW', 'View content'),
    ('brp-tm-08', 'TEAM_MEMBER', 'ASSESSMENT_VIEW', 'View assessment'),
    ('brp-viewer-01', 'VIEWER', 'EMAIL_TEMPLATE_VIEW', 'View email templates'),
    ('brp-viewer-02', 'VIEWER', 'CONTENT_VIEW', 'View content'),
    ('brp-viewer-03', 'VIEWER', 'ASSESSMENT_VIEW', 'View assessment'),
    ('brp-user-01', 'USER', 'INTERVIEW_TEMPLATE_VIEW', 'View templates'),
    ('brp-user-02', 'USER', 'INTERVIEW_TEMPLATE_USE', 'Use templates'),
    ('brp-member-01', 'MEMBER', 'INTERVIEW_INSIGHTS_VIEW', 'View insights');
