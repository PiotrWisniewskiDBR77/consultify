-- Step 14: Governance, Security & Enterprise Controls
-- Migration: 014_governance_enterprise.sql
-- Creates tables for PBAC permissions, immutable audit logging, and break-glass sessions

-- =========================================
-- GRANULAR PERMISSIONS REGISTRY
-- =========================================
CREATE TABLE IF NOT EXISTS permissions (
    key TEXT PRIMARY KEY,
    description TEXT,
    category TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =========================================
-- DEFAULT ROLE-PERMISSION MAPPINGS
-- =========================================
CREATE TABLE IF NOT EXISTS role_permissions (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    permission_key TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role, permission_key),
    FOREIGN KEY (permission_key) REFERENCES permissions(key)
);

-- =========================================
-- ORG-USER PERMISSION OVERRIDES
-- =========================================
CREATE TABLE IF NOT EXISTS org_user_permissions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    permission_key TEXT NOT NULL,
    grant_type TEXT NOT NULL CHECK(grant_type IN ('GRANT', 'REVOKE')),
    granted_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, organization_id, permission_key),
    FOREIGN KEY (permission_key) REFERENCES permissions(key)
);

-- =========================================
-- GOVERNANCE AUDIT LOG (APPEND-ONLY, IMMUTABLE)
-- =========================================
CREATE TABLE IF NOT EXISTS governance_audit_log (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    actor_role TEXT,
    action TEXT NOT NULL CHECK(action IN (
        'CREATE', 'UPDATE', 'DELETE', 'PUBLISH', 'TOGGLE', 
        'DELETE_SOFT', 'GRANT_PERMISSION', 'REVOKE_PERMISSION',
        'BREAK_GLASS_START', 'BREAK_GLASS_CLOSE'
    )),
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    before_json TEXT,
    after_json TEXT,
    correlation_id TEXT,
    prev_hash TEXT,
    record_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =========================================
-- BREAK-GLASS EMERGENCY ACCESS SESSIONS
-- =========================================
CREATE TABLE IF NOT EXISTS break_glass_sessions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    scope TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME
);

-- =========================================
-- INDEXES FOR PERFORMANCE
-- =========================================
CREATE INDEX IF NOT EXISTS idx_audit_org_created ON governance_audit_log(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON governance_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON governance_audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_correlation ON governance_audit_log(correlation_id);
CREATE INDEX IF NOT EXISTS idx_break_glass_active ON break_glass_sessions(organization_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_break_glass_scope ON break_glass_sessions(scope);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_org_user_perms_user ON org_user_permissions(user_id, organization_id);

-- =========================================
-- SEED DEFAULT PERMISSIONS
-- =========================================

-- Policy & Rules Permissions
INSERT OR IGNORE INTO permissions (key, description, category) VALUES
    ('POLICY_RULE_VIEW', 'View policy rules', 'POLICY'),
    ('POLICY_RULE_CREATE', 'Create policy rules', 'POLICY'),
    ('POLICY_RULE_UPDATE', 'Update policy rules', 'POLICY'),
    ('POLICY_RULE_DELETE', 'Delete policy rules', 'POLICY'),
    ('POLICY_RULE_TOGGLE', 'Enable/disable policy rules', 'POLICY'),
    ('POLICY_ENGINE_TOGGLE', 'Enable/disable global policy engine', 'POLICY');

-- Playbook Permissions
INSERT OR IGNORE INTO permissions (key, description, category) VALUES
    ('PLAYBOOK_VIEW', 'View playbook templates', 'PLAYBOOK'),
    ('PLAYBOOK_CREATE', 'Create playbook templates', 'PLAYBOOK'),
    ('PLAYBOOK_UPDATE', 'Update playbook templates', 'PLAYBOOK'),
    ('PLAYBOOK_DELETE', 'Delete playbook templates', 'PLAYBOOK'),
    ('PLAYBOOK_PUBLISH', 'Publish playbook templates', 'PLAYBOOK');

-- Connector Permissions
INSERT OR IGNORE INTO permissions (key, description, category) VALUES
    ('CONNECTOR_VIEW', 'View connector configurations', 'CONNECTOR'),
    ('CONNECTOR_CREATE', 'Create connector configurations', 'CONNECTOR'),
    ('CONNECTOR_UPDATE', 'Update connector configurations', 'CONNECTOR'),
    ('CONNECTOR_DELETE', 'Delete connector configurations', 'CONNECTOR'),
    ('CONNECTOR_CREDENTIALS', 'Manage connector credentials', 'CONNECTOR');

-- Governance & Audit Permissions
INSERT OR IGNORE INTO permissions (key, description, category) VALUES
    ('AUDIT_VIEW', 'View governance audit log', 'GOVERNANCE'),
    ('AUDIT_EXPORT', 'Export audit logs', 'GOVERNANCE'),
    ('PERMISSION_VIEW', 'View user permissions', 'GOVERNANCE'),
    ('PERMISSION_MANAGE', 'Grant/revoke user permissions', 'GOVERNANCE'),
    ('BREAK_GLASS_START', 'Start break-glass session', 'GOVERNANCE'),
    ('BREAK_GLASS_CLOSE', 'Close break-glass session', 'GOVERNANCE');

-- AI Actions Permissions
INSERT OR IGNORE INTO permissions (key, description, category) VALUES
    ('AI_PROPOSAL_VIEW', 'View AI action proposals', 'AI'),
    ('AI_PROPOSAL_DECIDE', 'Approve/reject AI proposals', 'AI'),
    ('AI_EXECUTION_VIEW', 'View AI execution history', 'AI'),
    ('AI_EXECUTION_RETRY', 'Retry failed AI executions', 'AI');

-- Organization Permissions
INSERT OR IGNORE INTO permissions (key, description, category) VALUES
    ('ORG_SETTINGS_VIEW', 'View organization settings', 'ORG'),
    ('ORG_SETTINGS_UPDATE', 'Update organization settings', 'ORG'),
    ('USER_INVITE', 'Invite users to organization', 'ORG'),
    ('USER_MANAGE', 'Manage organization users', 'ORG');

-- =========================================
-- SEED DEFAULT ROLE-PERMISSION MAPPINGS
-- =========================================

-- SUPERADMIN gets everything
INSERT OR IGNORE INTO role_permissions (id, role, permission_key) VALUES
    ('rp-sa-01', 'SUPERADMIN', 'POLICY_RULE_VIEW'),
    ('rp-sa-02', 'SUPERADMIN', 'POLICY_RULE_CREATE'),
    ('rp-sa-03', 'SUPERADMIN', 'POLICY_RULE_UPDATE'),
    ('rp-sa-04', 'SUPERADMIN', 'POLICY_RULE_DELETE'),
    ('rp-sa-05', 'SUPERADMIN', 'POLICY_RULE_TOGGLE'),
    ('rp-sa-06', 'SUPERADMIN', 'POLICY_ENGINE_TOGGLE'),
    ('rp-sa-07', 'SUPERADMIN', 'PLAYBOOK_VIEW'),
    ('rp-sa-08', 'SUPERADMIN', 'PLAYBOOK_CREATE'),
    ('rp-sa-09', 'SUPERADMIN', 'PLAYBOOK_UPDATE'),
    ('rp-sa-10', 'SUPERADMIN', 'PLAYBOOK_DELETE'),
    ('rp-sa-11', 'SUPERADMIN', 'PLAYBOOK_PUBLISH'),
    ('rp-sa-12', 'SUPERADMIN', 'CONNECTOR_VIEW'),
    ('rp-sa-13', 'SUPERADMIN', 'CONNECTOR_CREATE'),
    ('rp-sa-14', 'SUPERADMIN', 'CONNECTOR_UPDATE'),
    ('rp-sa-15', 'SUPERADMIN', 'CONNECTOR_DELETE'),
    ('rp-sa-16', 'SUPERADMIN', 'CONNECTOR_CREDENTIALS'),
    ('rp-sa-17', 'SUPERADMIN', 'AUDIT_VIEW'),
    ('rp-sa-18', 'SUPERADMIN', 'AUDIT_EXPORT'),
    ('rp-sa-19', 'SUPERADMIN', 'PERMISSION_VIEW'),
    ('rp-sa-20', 'SUPERADMIN', 'PERMISSION_MANAGE'),
    ('rp-sa-21', 'SUPERADMIN', 'BREAK_GLASS_START'),
    ('rp-sa-22', 'SUPERADMIN', 'BREAK_GLASS_CLOSE'),
    ('rp-sa-23', 'SUPERADMIN', 'AI_PROPOSAL_VIEW'),
    ('rp-sa-24', 'SUPERADMIN', 'AI_PROPOSAL_DECIDE'),
    ('rp-sa-25', 'SUPERADMIN', 'AI_EXECUTION_VIEW'),
    ('rp-sa-26', 'SUPERADMIN', 'AI_EXECUTION_RETRY'),
    ('rp-sa-27', 'SUPERADMIN', 'ORG_SETTINGS_VIEW'),
    ('rp-sa-28', 'SUPERADMIN', 'ORG_SETTINGS_UPDATE'),
    ('rp-sa-29', 'SUPERADMIN', 'USER_INVITE'),
    ('rp-sa-30', 'SUPERADMIN', 'USER_MANAGE');

-- ADMIN gets org-scoped permissions (no global toggles, break-glass)
INSERT OR IGNORE INTO role_permissions (id, role, permission_key) VALUES
    ('rp-ad-01', 'ADMIN', 'POLICY_RULE_VIEW'),
    ('rp-ad-02', 'ADMIN', 'POLICY_RULE_CREATE'),
    ('rp-ad-03', 'ADMIN', 'POLICY_RULE_UPDATE'),
    ('rp-ad-04', 'ADMIN', 'POLICY_RULE_TOGGLE'),
    ('rp-ad-05', 'ADMIN', 'PLAYBOOK_VIEW'),
    ('rp-ad-06', 'ADMIN', 'PLAYBOOK_CREATE'),
    ('rp-ad-07', 'ADMIN', 'PLAYBOOK_UPDATE'),
    ('rp-ad-08', 'ADMIN', 'CONNECTOR_VIEW'),
    ('rp-ad-09', 'ADMIN', 'CONNECTOR_CREATE'),
    ('rp-ad-10', 'ADMIN', 'CONNECTOR_UPDATE'),
    ('rp-ad-11', 'ADMIN', 'AUDIT_VIEW'),
    ('rp-ad-12', 'ADMIN', 'AUDIT_EXPORT'),
    ('rp-ad-13', 'ADMIN', 'AI_PROPOSAL_VIEW'),
    ('rp-ad-14', 'ADMIN', 'AI_PROPOSAL_DECIDE'),
    ('rp-ad-15', 'ADMIN', 'AI_EXECUTION_VIEW'),
    ('rp-ad-16', 'ADMIN', 'ORG_SETTINGS_VIEW'),
    ('rp-ad-17', 'ADMIN', 'ORG_SETTINGS_UPDATE'),
    ('rp-ad-18', 'ADMIN', 'USER_INVITE'),
    ('rp-ad-19', 'ADMIN', 'USER_MANAGE');

-- PROJECT_MANAGER gets limited permissions
INSERT OR IGNORE INTO role_permissions (id, role, permission_key) VALUES
    ('rp-pm-01', 'PROJECT_MANAGER', 'POLICY_RULE_VIEW'),
    ('rp-pm-02', 'PROJECT_MANAGER', 'PLAYBOOK_VIEW'),
    ('rp-pm-03', 'PROJECT_MANAGER', 'AI_PROPOSAL_VIEW'),
    ('rp-pm-04', 'PROJECT_MANAGER', 'AI_PROPOSAL_DECIDE'),
    ('rp-pm-05', 'PROJECT_MANAGER', 'AI_EXECUTION_VIEW');

-- USER/TEAM_MEMBER gets view-only
INSERT OR IGNORE INTO role_permissions (id, role, permission_key) VALUES
    ('rp-tm-01', 'TEAM_MEMBER', 'PLAYBOOK_VIEW'),
    ('rp-tm-02', 'TEAM_MEMBER', 'AI_PROPOSAL_VIEW');
