-- Migration: 236_security_module_extended.sql
-- Description: Complete security module tables for enterprise features
-- Date: 2026-01-10

-- ==========================================
-- SECURITY INCIDENTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS security_incidents (
    id TEXT PRIMARY KEY,
    organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    incident_type TEXT NOT NULL CHECK(incident_type IN (
        'unauthorized_access', 'data_breach', 'malware', 'phishing', 
        'dos_attack', 'brute_force', 'privilege_escalation', 'data_exfiltration',
        'insider_threat', 'configuration_error', 'suspicious_activity', 'other'
    )),
    title TEXT,
    description TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'MEDIUM' CHECK(severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'resolved', 'closed')),
    affected_resources TEXT, -- JSON array
    metadata_json TEXT,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    resolved_by TEXT REFERENCES users(id),
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_security_incidents_org ON security_incidents(organization_id);
CREATE INDEX IF NOT EXISTS idx_security_incidents_status ON security_incidents(status);
CREATE INDEX IF NOT EXISTS idx_security_incidents_severity ON security_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_security_incidents_type ON security_incidents(incident_type);

-- ==========================================
-- THREAT INTELLIGENCE TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS threat_intelligence (
    id TEXT PRIMARY KEY,
    organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    threat_type TEXT NOT NULL CHECK(threat_type IN ('ip', 'domain', 'email', 'hash', 'url')),
    indicator TEXT NOT NULL, -- The actual IP, domain, email, hash, or URL
    threat_level TEXT NOT NULL DEFAULT 'MEDIUM' CHECK(threat_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    reputation_score INTEGER DEFAULT 50 CHECK(reputation_score >= 0 AND reputation_score <= 100),
    source TEXT, -- 'internal', 'abuseipdb', 'virustotal', 'manual', etc.
    description TEXT,
    tags TEXT, -- JSON array of tags
    first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_blocked BOOLEAN DEFAULT FALSE,
    blocked_at TIMESTAMP,
    blocked_by TEXT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_threat_intel_org ON threat_intelligence(organization_id);
CREATE INDEX IF NOT EXISTS idx_threat_intel_type ON threat_intelligence(threat_type);
CREATE INDEX IF NOT EXISTS idx_threat_intel_indicator ON threat_intelligence(indicator);
CREATE INDEX IF NOT EXISTS idx_threat_intel_blocked ON threat_intelligence(is_blocked);
CREATE INDEX IF NOT EXISTS idx_threat_intel_level ON threat_intelligence(threat_level);

-- ==========================================
-- APPROVAL WORKFLOWS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS approval_workflows (
    id TEXT PRIMARY KEY,
    organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    workflow_type TEXT NOT NULL CHECK(workflow_type IN (
        'role_assignment', 'api_key_creation', 'data_access', 
        'budget_increase', 'user_invitation', 'permission_change', 'custom'
    )),
    approvers TEXT NOT NULL, -- JSON array of user IDs or emails
    require_all_approvers BOOLEAN DEFAULT FALSE,
    auto_expire_hours INTEGER DEFAULT 72,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_approval_workflows_org ON approval_workflows(organization_id);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_type ON approval_workflows(workflow_type);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_active ON approval_workflows(is_active);

-- ==========================================
-- APPROVAL REQUESTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS approval_requests (
    id TEXT PRIMARY KEY,
    workflow_id TEXT REFERENCES approval_workflows(id) ON DELETE CASCADE,
    organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    requester_id TEXT NOT NULL REFERENCES users(id),
    request_type TEXT NOT NULL,
    request_data TEXT, -- JSON with request details
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'cancelled', 'expired')),
    approvals TEXT, -- JSON array of {userId, approvedAt, comment}
    rejections TEXT, -- JSON array of {userId, rejectedAt, reason}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    resolved_at TIMESTAMP,
    resolved_by TEXT REFERENCES users(id),
    resolution_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_workflow ON approval_requests(workflow_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_org ON approval_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_requester ON approval_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);

-- ==========================================
-- DLP POLICIES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS dlp_policies (
    id TEXT PRIMARY KEY,
    organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    policy_type TEXT NOT NULL CHECK(policy_type IN (
        'pii_detection', 'credit_card', 'ssn', 'api_key_exposure',
        'password_exposure', 'sensitive_data', 'file_upload', 'custom_regex'
    )),
    rules_json TEXT NOT NULL, -- JSON with detection rules
    enforcement_action TEXT NOT NULL DEFAULT 'warn' CHECK(enforcement_action IN ('warn', 'block', 'log_only', 'quarantine')),
    severity TEXT NOT NULL DEFAULT 'MEDIUM' CHECK(severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    is_active BOOLEAN DEFAULT TRUE,
    applies_to TEXT, -- JSON array of resource types or 'all'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_dlp_policies_org ON dlp_policies(organization_id);
CREATE INDEX IF NOT EXISTS idx_dlp_policies_type ON dlp_policies(policy_type);
CREATE INDEX IF NOT EXISTS idx_dlp_policies_active ON dlp_policies(is_active);

-- ==========================================
-- DLP VIOLATIONS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS dlp_violations (
    id TEXT PRIMARY KEY,
    policy_id TEXT REFERENCES dlp_policies(id) ON DELETE CASCADE,
    organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id),
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    resource_name TEXT,
    violation_type TEXT NOT NULL,
    matched_content TEXT, -- Redacted/masked content that triggered violation
    severity TEXT NOT NULL DEFAULT 'MEDIUM',
    action_taken TEXT NOT NULL,
    is_resolved BOOLEAN DEFAULT FALSE,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    resolved_by TEXT REFERENCES users(id),
    resolution_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_dlp_violations_policy ON dlp_violations(policy_id);
CREATE INDEX IF NOT EXISTS idx_dlp_violations_org ON dlp_violations(organization_id);
CREATE INDEX IF NOT EXISTS idx_dlp_violations_user ON dlp_violations(user_id);
CREATE INDEX IF NOT EXISTS idx_dlp_violations_resolved ON dlp_violations(is_resolved);
CREATE INDEX IF NOT EXISTS idx_dlp_violations_severity ON dlp_violations(severity);

-- ==========================================
-- ADMIN AUDIT LOGS (Extended)
-- ==========================================
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id TEXT PRIMARY KEY,
    organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    admin_id TEXT NOT NULL REFERENCES users(id),
    action_type TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    resource_name TEXT,
    ip_address TEXT,
    user_agent TEXT,
    location TEXT,
    risk_score INTEGER DEFAULT 0 CHECK(risk_score >= 0 AND risk_score <= 100),
    status TEXT DEFAULT 'logged' CHECK(status IN ('logged', 'reviewed', 'escalated', 'resolved')),
    metadata_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    reviewed_by TEXT REFERENCES users(id),
    review_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_org ON admin_audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin ON admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON admin_audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_risk ON admin_audit_logs(risk_score);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_status ON admin_audit_logs(status);

-- ==========================================
-- PERMISSION DEFINITIONS (Seed)
-- ==========================================
CREATE TABLE IF NOT EXISTS permission_definitions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    risk_level TEXT DEFAULT 'low' CHECK(risk_level IN ('low', 'medium', 'high', 'critical')),
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert permission definitions
INSERT OR IGNORE INTO permission_definitions (id, name, display_name, description, category, resource, action, risk_level, is_system) VALUES
('perm-users-read', 'users:read', 'View Users', 'View user profiles and lists', 'User Management', 'users', 'read', 'low', TRUE),
('perm-users-write', 'users:write', 'Manage Users', 'Create, edit, delete users', 'User Management', 'users', 'write', 'high', TRUE),
('perm-users-invite', 'users:invite', 'Invite Users', 'Send user invitations', 'User Management', 'users', 'invite', 'medium', TRUE),
('perm-roles-read', 'roles:read', 'View Roles', 'View roles and permissions', 'Access Control', 'roles', 'read', 'low', TRUE),
('perm-roles-write', 'roles:write', 'Manage Roles', 'Create, edit, delete roles', 'Access Control', 'roles', 'write', 'critical', TRUE),
('perm-projects-read', 'projects:read', 'View Projects', 'View project details', 'Projects', 'projects', 'read', 'low', TRUE),
('perm-projects-write', 'projects:write', 'Manage Projects', 'Create, edit projects', 'Projects', 'projects', 'write', 'medium', TRUE),
('perm-projects-delete', 'projects:delete', 'Delete Projects', 'Delete projects permanently', 'Projects', 'projects', 'delete', 'high', TRUE),
('perm-billing-read', 'billing:read', 'View Billing', 'View billing and invoices', 'Billing', 'billing', 'read', 'medium', TRUE),
('perm-billing-write', 'billing:write', 'Manage Billing', 'Modify billing settings', 'Billing', 'billing', 'write', 'critical', TRUE),
('perm-api-keys-read', 'api_keys:read', 'View API Keys', 'View API keys', 'Integrations', 'api_keys', 'read', 'medium', TRUE),
('perm-api-keys-write', 'api_keys:write', 'Manage API Keys', 'Create, revoke API keys', 'Integrations', 'api_keys', 'write', 'high', TRUE),
('perm-ai-execute', 'ai:execute', 'Execute AI', 'Use AI features', 'AI', 'ai', 'execute', 'medium', TRUE),
('perm-ai-configure', 'ai:configure', 'Configure AI', 'Configure AI settings', 'AI', 'ai', 'configure', 'high', TRUE),
('perm-security-read', 'security:read', 'View Security', 'View security settings', 'Security', 'security', 'read', 'medium', TRUE),
('perm-security-write', 'security:write', 'Manage Security', 'Modify security settings', 'Security', 'security', 'write', 'critical', TRUE),
('perm-audit-read', 'audit:read', 'View Audit Logs', 'View audit trail', 'Compliance', 'audit', 'read', 'medium', TRUE),
('perm-audit-export', 'audit:export', 'Export Audit Logs', 'Export audit data', 'Compliance', 'audit', 'export', 'high', TRUE);

-- ==========================================
-- TRIGGERS FOR updated_at
-- ==========================================
CREATE TRIGGER IF NOT EXISTS update_security_incidents_timestamp
    AFTER UPDATE ON security_incidents
    FOR EACH ROW
BEGIN
    UPDATE security_incidents SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_threat_intelligence_timestamp
    AFTER UPDATE ON threat_intelligence
    FOR EACH ROW
BEGIN
    UPDATE threat_intelligence SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_approval_workflows_timestamp
    AFTER UPDATE ON approval_workflows
    FOR EACH ROW
BEGIN
    UPDATE approval_workflows SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_dlp_policies_timestamp
    AFTER UPDATE ON dlp_policies
    FOR EACH ROW
BEGIN
    UPDATE dlp_policies SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
