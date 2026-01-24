-- Migration: 237_security_demo_seed.sql
-- Description: Demo seed data for Security Module
-- Date: 2026-01-10

-- Get DBR77 organization ID
-- Note: Uses subquery to get org ID dynamically

-- ==========================================
-- SECURITY INCIDENTS DEMO DATA
-- ==========================================
INSERT OR IGNORE INTO security_incidents (id, organization_id, incident_type, title, description, severity, status, affected_resources, detected_at, created_at) 
SELECT 
    'sec-inc-001',
    o.id,
    'brute_force',
    'Brute Force Login Attempt Detected',
    'Multiple failed login attempts (15 in 5 minutes) detected from IP 192.168.100.55. Automated blocking triggered.',
    'HIGH',
    'resolved',
    '["auth_service", "user_accounts"]',
    datetime('now', '-3 days'),
    datetime('now', '-3 days')
FROM organizations o WHERE o.name = 'DBR77' OR o.id = 'org-dbr77'
LIMIT 1;

INSERT OR IGNORE INTO security_incidents (id, organization_id, incident_type, title, description, severity, status, affected_resources, detected_at, created_at)
SELECT 
    'sec-inc-002',
    o.id,
    'suspicious_activity',
    'Unusual API Usage Pattern',
    'API key "prod-integration-key" showing 500% increase in requests over normal baseline. Investigating potential misuse.',
    'MEDIUM',
    'in_progress',
    '["api_gateway", "prod-integration-key"]',
    datetime('now', '-1 day'),
    datetime('now', '-1 day')
FROM organizations o WHERE o.name = 'DBR77' OR o.id = 'org-dbr77'
LIMIT 1;

INSERT OR IGNORE INTO security_incidents (id, organization_id, incident_type, title, description, severity, status, affected_resources, detected_at, created_at)
SELECT 
    'sec-inc-003',
    o.id,
    'unauthorized_access',
    'Admin Panel Access Attempt',
    'User john.doe@example.com attempted to access SuperAdmin panel without proper permissions. Access denied.',
    'LOW',
    'closed',
    '["superadmin_panel"]',
    datetime('now', '-7 days'),
    datetime('now', '-7 days')
FROM organizations o WHERE o.name = 'DBR77' OR o.id = 'org-dbr77'
LIMIT 1;

INSERT OR IGNORE INTO security_incidents (id, organization_id, incident_type, title, description, severity, status, affected_resources, detected_at, created_at)
SELECT 
    'sec-inc-004',
    o.id,
    'data_exfiltration',
    'Large Data Export Detected',
    'User exported 50,000+ records from customer database in single request. Reviewing data classification and user permissions.',
    'CRITICAL',
    'open',
    '["customer_database", "export_service"]',
    datetime('now', '-2 hours'),
    datetime('now', '-2 hours')
FROM organizations o WHERE o.name = 'DBR77' OR o.id = 'org-dbr77'
LIMIT 1;

INSERT OR IGNORE INTO security_incidents (id, organization_id, incident_type, title, description, severity, status, affected_resources, detected_at, created_at)
SELECT 
    'sec-inc-005',
    o.id,
    'configuration_error',
    'S3 Bucket Misconfiguration',
    'Security scan detected public access enabled on uploads bucket. Immediately remediated.',
    'HIGH',
    'resolved',
    '["s3://consultinity-uploads", "storage_service"]',
    datetime('now', '-5 days'),
    datetime('now', '-5 days')
FROM organizations o WHERE o.name = 'DBR77' OR o.id = 'org-dbr77'
LIMIT 1;

-- ==========================================
-- THREAT INTELLIGENCE DEMO DATA
-- ==========================================
INSERT OR IGNORE INTO threat_intelligence (id, organization_id, threat_type, indicator, threat_level, reputation_score, source, description, is_blocked, blocked_at, created_at)
SELECT 
    'threat-001',
    o.id,
    'ip',
    '192.168.100.55',
    'HIGH',
    15,
    'internal',
    'Source of brute force attack - blocked after incident sec-inc-001',
    TRUE,
    datetime('now', '-3 days'),
    datetime('now', '-3 days')
FROM organizations o WHERE o.name = 'DBR77' OR o.id = 'org-dbr77'
LIMIT 1;

INSERT OR IGNORE INTO threat_intelligence (id, organization_id, threat_type, indicator, threat_level, reputation_score, source, description, is_blocked, created_at)
SELECT 
    'threat-002',
    o.id,
    'domain',
    'malicious-phishing-site.xyz',
    'CRITICAL',
    5,
    'abuseipdb',
    'Known phishing domain targeting enterprise SaaS users',
    TRUE,
    datetime('now', '-10 days')
FROM organizations o WHERE o.name = 'DBR77' OR o.id = 'org-dbr77'
LIMIT 1;

INSERT OR IGNORE INTO threat_intelligence (id, organization_id, threat_type, indicator, threat_level, reputation_score, source, description, is_blocked, created_at)
SELECT 
    'threat-003',
    o.id,
    'ip',
    '45.33.32.156',
    'MEDIUM',
    45,
    'virustotal',
    'Suspicious scanning activity detected - monitoring',
    FALSE,
    datetime('now', '-2 days')
FROM organizations o WHERE o.name = 'DBR77' OR o.id = 'org-dbr77'
LIMIT 1;

INSERT OR IGNORE INTO threat_intelligence (id, organization_id, threat_type, indicator, threat_level, reputation_score, source, description, is_blocked, created_at)
SELECT 
    'threat-004',
    o.id,
    'email',
    'attacker@fake-vendor.com',
    'HIGH',
    20,
    'manual',
    'Phishing email sender impersonating vendor - reported by user',
    TRUE,
    datetime('now', '-1 day')
FROM organizations o WHERE o.name = 'DBR77' OR o.id = 'org-dbr77'
LIMIT 1;

INSERT OR IGNORE INTO threat_intelligence (id, organization_id, threat_type, indicator, threat_level, reputation_score, source, description, is_blocked, created_at)
SELECT 
    'threat-005',
    o.id,
    'ip',
    '103.224.182.250',
    'LOW',
    65,
    'abuseipdb',
    'Flagged for port scanning - low confidence',
    FALSE,
    datetime('now', '-5 days')
FROM organizations o WHERE o.name = 'DBR77' OR o.id = 'org-dbr77'
LIMIT 1;

-- ==========================================
-- APPROVAL WORKFLOWS DEMO DATA
-- ==========================================
INSERT OR IGNORE INTO approval_workflows (id, organization_id, name, description, workflow_type, approvers, require_all_approvers, auto_expire_hours, is_active, created_at)
SELECT 
    'workflow-001',
    o.id,
    'API Key Creation Approval',
    'Requires security team approval before creating new API keys',
    'api_key_creation',
    '["security@dbr77.com", "admin@dbr77.com"]',
    FALSE,
    48,
    TRUE,
    datetime('now', '-30 days')
FROM organizations o WHERE o.name = 'DBR77' OR o.id = 'org-dbr77'
LIMIT 1;

INSERT OR IGNORE INTO approval_workflows (id, organization_id, name, description, workflow_type, approvers, require_all_approvers, auto_expire_hours, is_active, created_at)
SELECT 
    'workflow-002',
    o.id,
    'Admin Role Assignment',
    'All admin role assignments require C-level approval',
    'role_assignment',
    '["cto@dbr77.com", "ceo@dbr77.com"]',
    TRUE,
    72,
    TRUE,
    datetime('now', '-30 days')
FROM organizations o WHERE o.name = 'DBR77' OR o.id = 'org-dbr77'
LIMIT 1;

INSERT OR IGNORE INTO approval_workflows (id, organization_id, name, description, workflow_type, approvers, require_all_approvers, auto_expire_hours, is_active, created_at)
SELECT 
    'workflow-003',
    o.id,
    'AI Budget Increase',
    'Budget increases over $500 require finance approval',
    'budget_increase',
    '["finance@dbr77.com"]',
    FALSE,
    24,
    TRUE,
    datetime('now', '-20 days')
FROM organizations o WHERE o.name = 'DBR77' OR o.id = 'org-dbr77'
LIMIT 1;

-- ==========================================
-- APPROVAL REQUESTS DEMO DATA
-- ==========================================
INSERT OR IGNORE INTO approval_requests (id, workflow_id, organization_id, requester_id, request_type, request_data, status, created_at, expires_at)
SELECT 
    'req-001',
    'workflow-001',
    o.id,
    u.id,
    'api_key_creation',
    '{"keyName": "Production Integration", "scopes": ["read:projects", "write:tasks"], "reason": "Integration with Jira"}',
    'pending',
    datetime('now', '-1 day'),
    datetime('now', '+1 day')
FROM organizations o, users u 
WHERE (o.name = 'DBR77' OR o.id = 'org-dbr77') 
AND u.organization_id = o.id
LIMIT 1;

INSERT OR IGNORE INTO approval_requests (id, workflow_id, organization_id, requester_id, request_type, request_data, status, created_at, resolved_at)
SELECT 
    'req-002',
    'workflow-002',
    o.id,
    u.id,
    'role_assignment',
    '{"userId": "user-123", "roleName": "Organization Admin", "reason": "Promotion to team lead"}',
    'approved',
    datetime('now', '-5 days'),
    datetime('now', '-4 days')
FROM organizations o, users u 
WHERE (o.name = 'DBR77' OR o.id = 'org-dbr77') 
AND u.organization_id = o.id
LIMIT 1;

INSERT OR IGNORE INTO approval_requests (id, workflow_id, organization_id, requester_id, request_type, request_data, status, created_at, resolved_at, resolution_notes)
SELECT 
    'req-003',
    'workflow-003',
    o.id,
    u.id,
    'budget_increase',
    '{"currentBudget": 500, "requestedBudget": 1500, "reason": "Q1 AI initiative expansion"}',
    'rejected',
    datetime('now', '-3 days'),
    datetime('now', '-2 days'),
    'Budget increase deferred to Q2 planning'
FROM organizations o, users u 
WHERE (o.name = 'DBR77' OR o.id = 'org-dbr77') 
AND u.organization_id = o.id
LIMIT 1;

-- ==========================================
-- DLP POLICIES DEMO DATA
-- ==========================================
INSERT OR IGNORE INTO dlp_policies (id, organization_id, name, description, policy_type, rules_json, enforcement_action, severity, is_active, applies_to, created_at)
SELECT 
    'dlp-001',
    o.id,
    'Credit Card Detection',
    'Detect and block credit card numbers in exports and messages',
    'credit_card',
    '{"patterns": ["\\b(?:\\d{4}[- ]?){3}\\d{4}\\b"], "matchThreshold": 1}',
    'block',
    'CRITICAL',
    TRUE,
    '["exports", "messages", "documents"]',
    datetime('now', '-60 days')
FROM organizations o WHERE o.name = 'DBR77' OR o.id = 'org-dbr77'
LIMIT 1;

INSERT OR IGNORE INTO dlp_policies (id, organization_id, name, description, policy_type, rules_json, enforcement_action, severity, is_active, applies_to, created_at)
SELECT 
    'dlp-002',
    o.id,
    'API Key Exposure Prevention',
    'Detect API keys and secrets in code and documents',
    'api_key_exposure',
    '{"patterns": ["sk-[a-zA-Z0-9]{32,}", "AKIA[0-9A-Z]{16}", "ghp_[a-zA-Z0-9]{36}"], "matchThreshold": 1}',
    'warn',
    'HIGH',
    TRUE,
    '["documents", "code_snippets", "messages"]',
    datetime('now', '-45 days')
FROM organizations o WHERE o.name = 'DBR77' OR o.id = 'org-dbr77'
LIMIT 1;

INSERT OR IGNORE INTO dlp_policies (id, organization_id, name, description, policy_type, rules_json, enforcement_action, severity, is_active, applies_to, created_at)
SELECT 
    'dlp-003',
    o.id,
    'PII Detection - SSN',
    'Detect Social Security Numbers in content',
    'ssn',
    '{"patterns": ["\\b\\d{3}-\\d{2}-\\d{4}\\b"], "matchThreshold": 1}',
    'block',
    'CRITICAL',
    TRUE,
    '["all"]',
    datetime('now', '-30 days')
FROM organizations o WHERE o.name = 'DBR77' OR o.id = 'org-dbr77'
LIMIT 1;

-- ==========================================
-- DLP VIOLATIONS DEMO DATA
-- ==========================================
INSERT OR IGNORE INTO dlp_violations (id, policy_id, organization_id, user_id, resource_type, resource_id, resource_name, violation_type, matched_content, severity, action_taken, is_resolved, detected_at)
SELECT 
    'violation-001',
    'dlp-002',
    o.id,
    u.id,
    'document',
    'doc-12345',
    'Integration Guide.docx',
    'api_key_exposure',
    'sk-****************************abc1',
    'HIGH',
    'warn',
    TRUE,
    datetime('now', '-2 days')
FROM organizations o, users u 
WHERE (o.name = 'DBR77' OR o.id = 'org-dbr77') 
AND u.organization_id = o.id
LIMIT 1;

INSERT OR IGNORE INTO dlp_violations (id, policy_id, organization_id, user_id, resource_type, resource_id, resource_name, violation_type, matched_content, severity, action_taken, is_resolved, detected_at)
SELECT 
    'violation-002',
    'dlp-001',
    o.id,
    u.id,
    'export',
    'export-67890',
    'Customer Report Q4.csv',
    'credit_card',
    '4111-****-****-1111',
    'CRITICAL',
    'block',
    FALSE,
    datetime('now', '-4 hours')
FROM organizations o, users u 
WHERE (o.name = 'DBR77' OR o.id = 'org-dbr77') 
AND u.organization_id = o.id
LIMIT 1;

-- ==========================================
-- ADMIN AUDIT LOGS DEMO DATA
-- ==========================================
INSERT OR IGNORE INTO admin_audit_logs (id, organization_id, admin_id, action_type, resource_type, resource_id, resource_name, ip_address, user_agent, risk_score, status, created_at)
SELECT 
    'audit-001',
    o.id,
    u.id,
    'user_role_change',
    'user',
    'user-456',
    'john.doe@example.com',
    '192.168.1.100',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    25,
    'logged',
    datetime('now', '-1 day')
FROM organizations o, users u 
WHERE (o.name = 'DBR77' OR o.id = 'org-dbr77') 
AND u.organization_id = o.id AND u.role IN ('super_admin', 'admin')
LIMIT 1;

INSERT OR IGNORE INTO admin_audit_logs (id, organization_id, admin_id, action_type, resource_type, resource_id, resource_name, ip_address, user_agent, risk_score, status, created_at)
SELECT 
    'audit-002',
    o.id,
    u.id,
    'api_key_created',
    'api_key',
    'key-789',
    'Production Integration Key',
    '10.0.0.50',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    45,
    'reviewed',
    datetime('now', '-3 days')
FROM organizations o, users u 
WHERE (o.name = 'DBR77' OR o.id = 'org-dbr77') 
AND u.organization_id = o.id AND u.role IN ('super_admin', 'admin')
LIMIT 1;

INSERT OR IGNORE INTO admin_audit_logs (id, organization_id, admin_id, action_type, resource_type, resource_id, resource_name, ip_address, user_agent, risk_score, status, created_at)
SELECT 
    'audit-003',
    o.id,
    u.id,
    'security_policy_change',
    'security_policy',
    'policy-mfa',
    'MFA Enforcement Policy',
    '172.16.0.10',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    75,
    'escalated',
    datetime('now', '-6 hours')
FROM organizations o, users u 
WHERE (o.name = 'DBR77' OR o.id = 'org-dbr77') 
AND u.organization_id = o.id AND u.role IN ('super_admin', 'admin')
LIMIT 1;

-- ==========================================
-- SSO CONFIG DEMO DATA
-- ==========================================
INSERT OR IGNORE INTO sso_configs (id, organization_id, provider, status, client_id, redirect_uri, domains, created_at)
SELECT 
    'sso-demo-001',
    o.id,
    'google',
    'active',
    'demo-client-id.apps.googleusercontent.com',
    'http://localhost:3000/api/sso/google/callback',
    '["dbr77.com", "consultinity.com"]',
    datetime('now', '-90 days')
FROM organizations o WHERE o.name = 'DBR77' OR o.id = 'org-dbr77'
LIMIT 1;

-- ==========================================
-- SCIM TOKENS DEMO DATA  
-- ==========================================
INSERT OR IGNORE INTO scim_tokens (id, token, created_at)
VALUES ('scim-demo-001', 'scim_demo_token_for_testing_only_do_not_use_in_prod', datetime('now', '-30 days'));

-- ==========================================
-- CUSTOM ROLES DEMO DATA
-- ==========================================
INSERT OR IGNORE INTO custom_roles (id, organization_id, name, display_name, description, color, icon, base_role, role_type, scope, priority, is_active, is_default, created_at)
SELECT 
    'role-security-admin',
    o.id,
    'security_admin',
    'Security Administrator',
    'Full access to security features, incidents, and compliance',
    '#ef4444',
    'shield',
    'admin',
    'custom',
    'organization',
    80,
    TRUE,
    FALSE,
    datetime('now', '-60 days')
FROM organizations o WHERE o.name = 'DBR77' OR o.id = 'org-dbr77'
LIMIT 1;

INSERT OR IGNORE INTO custom_roles (id, organization_id, name, display_name, description, color, icon, base_role, role_type, scope, priority, is_active, is_default, created_at)
SELECT 
    'role-compliance-officer',
    o.id,
    'compliance_officer',
    'Compliance Officer',
    'Access to audit logs, compliance reports, and DLP management',
    '#8b5cf6',
    'clipboard-check',
    'manager',
    'custom',
    'organization',
    70,
    TRUE,
    FALSE,
    datetime('now', '-45 days')
FROM organizations o WHERE o.name = 'DBR77' OR o.id = 'org-dbr77'
LIMIT 1;

INSERT OR IGNORE INTO custom_roles (id, organization_id, name, display_name, description, color, icon, base_role, role_type, scope, priority, is_active, is_default, created_at)
SELECT 
    'role-api-developer',
    o.id,
    'api_developer',
    'API Developer',
    'Can create and manage API keys, view integration docs',
    '#06b6d4',
    'code',
    'member',
    'custom',
    'organization',
    50,
    TRUE,
    FALSE,
    datetime('now', '-30 days')
FROM organizations o WHERE o.name = 'DBR77' OR o.id = 'org-dbr77'
LIMIT 1;
