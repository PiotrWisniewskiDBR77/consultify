-- ===========================================
-- 233_configuration_module_seed.sql
-- Configuration Module - Seed Data for Demo
-- Includes: Settings, Branding, Legal Documents, Audit Logs, Compliance
-- ===========================================

-- ===========================================
-- 1. SYSTEM SETTINGS - Default values
-- ===========================================

INSERT INTO settings (key, value, description, category) VALUES
    ('app_name', 'TechnoLex', 'Application display name', 'general'),
    ('default_language', 'EN', 'Default platform language', 'general'),
    ('maintenance_mode', 'false', 'Enable maintenance mode (blocks non-admin users)', 'general'),
    ('system_announcement', '', 'System-wide announcement banner', 'general'),
    ('enforce_mfa', 'false', 'Require MFA for all users', 'security'),
    ('session_timeout_mins', '60', 'Session timeout in minutes', 'security'),
    ('password_min_length', '8', 'Minimum password length', 'security'),
    ('password_require_uppercase', 'true', 'Require uppercase in passwords', 'security'),
    ('password_require_number', 'true', 'Require numbers in passwords', 'security'),
    ('password_require_special', 'true', 'Require special characters in passwords', 'security'),
    ('max_login_attempts', '5', 'Maximum failed login attempts before lockout', 'security'),
    ('lockout_duration_mins', '15', 'Account lockout duration in minutes', 'security'),
    ('smtp_host', 'smtp.example.com', 'SMTP server hostname', 'email'),
    ('smtp_port', '587', 'SMTP server port', 'email'),
    ('smtp_from', 'noreply@technolex.com', 'Default from email address', 'email'),
    ('smtp_from_name', 'TechnoLex', 'Default from name', 'email'),
    ('smtp_encryption', 'tls', 'SMTP encryption (tls/ssl/none)', 'email'),
    ('legal_tos_url', 'https://technolex.com/terms', 'Terms of Service URL', 'legal'),
    ('legal_privacy_url', 'https://technolex.com/privacy', 'Privacy Policy URL', 'legal'),
    ('legal_dpa_url', 'https://technolex.com/dpa', 'Data Processing Agreement URL', 'legal'),
    ('legal_cookie_policy_url', 'https://technolex.com/cookies', 'Cookie Policy URL', 'legal'),
    ('api_rate_limit', '1000', 'Default API rate limit per hour', 'security'),
    ('file_upload_max_size_mb', '50', 'Maximum file upload size in MB', 'general'),
    ('allowed_file_types', 'pdf,doc,docx,xls,xlsx,png,jpg,jpeg,gif', 'Allowed file upload types', 'general')
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    category = EXCLUDED.category;

-- ===========================================
-- 2. ORGANIZATION BRANDING - Demo Data
-- ===========================================

-- DBR77 Organization - Custom Purple Theme
INSERT INTO organization_branding (
    id, organization_id, 
    primary_color, secondary_color, accent_color,
    background_color, text_color,
    dark_primary_color, dark_secondary_color, dark_background_color, dark_text_color,
    font_family, heading_font_family,
    login_tagline, login_welcome_message,
    hide_powered_by, custom_support_email
) VALUES (
    'branding-dbr77-001', 'org-dbr77-test',
    '#7C3AED', '#2563EB', '#059669',
    '#F8FAFC', '#1E293B',
    '#A78BFA', '#60A5FA', '#0F172A', '#F8FAFC',
    'Inter', 'Inter',
    'Powering Digital Transformation', 'Welcome back! Sign in to continue your transformation journey.',
    0, 'support@dbr77.com'
)
ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    primary_color = EXCLUDED.primary_color,
    secondary_color = EXCLUDED.secondary_color,
    accent_color = EXCLUDED.accent_color,
    background_color = EXCLUDED.background_color,
    text_color = EXCLUDED.text_color,
    dark_primary_color = EXCLUDED.dark_primary_color,
    dark_secondary_color = EXCLUDED.dark_secondary_color,
    dark_background_color = EXCLUDED.dark_background_color,
    dark_text_color = EXCLUDED.dark_text_color,
    font_family = EXCLUDED.font_family,
    heading_font_family = EXCLUDED.heading_font_family,
    login_tagline = EXCLUDED.login_tagline,
    login_welcome_message = EXCLUDED.login_welcome_message,
    hide_powered_by = EXCLUDED.hide_powered_by,
    custom_support_email = EXCLUDED.custom_support_email;

-- Legolex Demo Corp - Blue Professional Theme
INSERT INTO organization_branding (
    id, organization_id,
    primary_color, secondary_color, accent_color,
    background_color, text_color,
    dark_primary_color, dark_secondary_color, dark_background_color, dark_text_color,
    font_family, heading_font_family,
    login_tagline, login_welcome_message,
    hide_powered_by, custom_support_email, custom_domain
) VALUES (
    'branding-legolex-001', 'org-legolex-demo',
    '#1D4ED8', '#0EA5E9', '#10B981',
    '#FFFFFF', '#111827',
    '#3B82F6', '#38BDF8', '#111827', '#F9FAFB',
    'Roboto', 'Montserrat',
    'Legal Excellence Through Technology', 'Access your legal workspace',
    1, 'help@legolexdemo.com', 'app.legolexdemo.com'
)
ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    primary_color = EXCLUDED.primary_color,
    secondary_color = EXCLUDED.secondary_color,
    accent_color = EXCLUDED.accent_color,
    background_color = EXCLUDED.background_color,
    text_color = EXCLUDED.text_color,
    dark_primary_color = EXCLUDED.dark_primary_color,
    dark_secondary_color = EXCLUDED.dark_secondary_color,
    dark_background_color = EXCLUDED.dark_background_color,
    dark_text_color = EXCLUDED.dark_text_color,
    font_family = EXCLUDED.font_family,
    heading_font_family = EXCLUDED.heading_font_family,
    login_tagline = EXCLUDED.login_tagline,
    login_welcome_message = EXCLUDED.login_welcome_message,
    hide_powered_by = EXCLUDED.hide_powered_by,
    custom_support_email = EXCLUDED.custom_support_email,
    custom_domain = EXCLUDED.custom_domain;

-- ACME Global - Green Enterprise Theme
INSERT INTO organization_branding (
    id, organization_id,
    primary_color, secondary_color, accent_color,
    background_color, text_color,
    dark_primary_color, dark_secondary_color, dark_background_color, dark_text_color,
    font_family, heading_font_family,
    login_tagline
) VALUES (
    'branding-acme-001', 'org-demo-acme-global',
    '#059669', '#0D9488', '#F59E0B',
    '#F0FDF4', '#064E3B',
    '#34D399', '#2DD4BF', '#022C22', '#ECFDF5',
    'Open Sans', 'Poppins',
    'Global Solutions, Local Impact'
)
ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    primary_color = EXCLUDED.primary_color,
    secondary_color = EXCLUDED.secondary_color,
    accent_color = EXCLUDED.accent_color,
    background_color = EXCLUDED.background_color,
    text_color = EXCLUDED.text_color,
    dark_primary_color = EXCLUDED.dark_primary_color,
    dark_secondary_color = EXCLUDED.dark_secondary_color,
    dark_background_color = EXCLUDED.dark_background_color,
    dark_text_color = EXCLUDED.dark_text_color,
    font_family = EXCLUDED.font_family,
    heading_font_family = EXCLUDED.heading_font_family,
    login_tagline = EXCLUDED.login_tagline;

-- ===========================================
-- 3. LEGAL DOCUMENTS - Platform Documents
-- ===========================================

INSERT INTO legal_documents (id, type, name, version, url, status, effective_date, requires_acceptance) VALUES
    ('legal-privacy-v1', 'privacy', 'Privacy Policy', '1.0', 'https://technolex.com/privacy', 'active', '2024-01-01', 1),
    ('legal-tos-v1', 'terms', 'Terms of Service', '1.0', 'https://technolex.com/terms', 'active', '2024-01-01', 1),
    ('legal-dpa-v1', 'dpa', 'Data Processing Agreement', '1.0', 'https://technolex.com/dpa', 'active', '2024-01-01', 0),
    ('legal-sla-v1', 'sla', 'Service Level Agreement', '1.0', 'https://technolex.com/sla', 'active', '2024-01-01', 0),
    ('legal-aup-v1', 'aup', 'AI Usage Policy', '1.0', 'https://technolex.com/ai-policy', 'active', '2024-12-15', 1),
    ('legal-cookie-v1', 'cookie', 'Cookie Policy', '1.0', 'https://technolex.com/cookies', 'active', '2024-01-01', 0)
ON CONFLICT (id) DO UPDATE SET
    type = EXCLUDED.type,
    name = EXCLUDED.name,
    version = EXCLUDED.version,
    url = EXCLUDED.url,
    status = EXCLUDED.status,
    effective_date = EXCLUDED.effective_date,
    requires_acceptance = EXCLUDED.requires_acceptance;

-- ===========================================
-- 4. COMPLIANCE FRAMEWORKS - Status
-- ===========================================

INSERT INTO compliance_frameworks (id, name, display_name, status, certification_date, expiry_date, auditor) VALUES
    ('compliance-gdpr', 'GDPR', 'General Data Protection Regulation', 'compliant', '2024-01-15', NULL, 'Internal Audit'),
    ('compliance-soc2', 'SOC2', 'SOC 2 Type II', 'compliant', '2024-06-01', '2025-06-01', 'Deloitte'),
    ('compliance-iso27001', 'ISO27001', 'ISO 27001:2022', 'compliant', '2024-03-01', '2027-03-01', 'BSI Group'),
    ('compliance-hipaa', 'HIPAA', 'HIPAA Compliance', 'in_progress', NULL, NULL, NULL),
    ('compliance-ccpa', 'CCPA', 'California Consumer Privacy Act', 'compliant', '2024-01-01', NULL, 'Internal Audit')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    display_name = EXCLUDED.display_name,
    status = EXCLUDED.status,
    certification_date = EXCLUDED.certification_date,
    expiry_date = EXCLUDED.expiry_date,
    auditor = EXCLUDED.auditor;

-- ===========================================
-- 5. SUPERADMIN AUDIT LOG - Demo Entries
-- ===========================================

INSERT INTO superadmin_audit_log (id, admin_user_id, admin_email, action, entity_type, entity_id, old_value, new_value, ip_address, created_at) VALUES
    ('audit-sa-001', 'user-superadmin-dbr77', 'admin@dbr77.com', 'settings_update', 'settings', 'app_name', '{"value": "Consultinity"}', '{"value": "TechnoLex"}', '192.168.1.100', CURRENT_TIMESTAMP - INTERVAL '7 days'),
    ('audit-sa-002', 'user-superadmin-dbr77', 'admin@dbr77.com', 'user_create', 'user', 'user-demo-001', NULL, '{"email": "demo@example.com", "role": "USER"}', '192.168.1.100', CURRENT_TIMESTAMP - INTERVAL '6 days'),
    ('audit-sa-003', 'user-superadmin-dbr77', 'admin@dbr77.com', 'branding_change', 'branding', 'branding-dbr77-001', '{"primaryColor": "#6366F1"}', '{"primaryColor": "#7C3AED"}', '192.168.1.100', CURRENT_TIMESTAMP - INTERVAL '5 days'),
    ('audit-sa-004', 'user-superadmin-dbr77', 'admin@dbr77.com', 'settings_update', 'settings', 'enforce_mfa', '{"value": "true"}', '{"value": "false"}', '192.168.1.100', CURRENT_TIMESTAMP - INTERVAL '4 days'),
    ('audit-sa-005', 'user-superadmin-dbr77', 'admin@dbr77.com', 'organization_update', 'organization', 'org-dbr77-test', '{"plan": "starter"}', '{"plan": "pro"}', '192.168.1.100', CURRENT_TIMESTAMP - INTERVAL '3 days'),
    ('audit-sa-006', 'user-superadmin-dbr77', 'admin@dbr77.com', 'legal_publish', 'legal', 'legal-aup-v1', NULL, '{"version": "1.0", "status": "active"}', '192.168.1.100', CURRENT_TIMESTAMP - INTERVAL '2 days'),
    ('audit-sa-007', 'user-superadmin-dbr77', 'admin@dbr77.com', 'settings_update', 'settings', 'session_timeout_mins', '{"value": "30"}', '{"value": "60"}', '192.168.1.100', CURRENT_TIMESTAMP - INTERVAL '1 day'),
    ('audit-sa-008', 'user-superadmin-dbr77', 'admin@dbr77.com', 'user_impersonate', 'user', 'user-demo-001', NULL, '{"reason": "support request #1234"}', '192.168.1.100', CURRENT_TIMESTAMP - INTERVAL '12 hours'),
    ('audit-sa-009', 'user-superadmin-dbr77', 'admin@dbr77.com', 'api_key_create', 'api_key', 'apikey-demo-001', NULL, '{"name": "External Integration", "permissions": ["read"]}', '192.168.1.100', CURRENT_TIMESTAMP - INTERVAL '6 hours'),
    ('audit-sa-010', 'user-superadmin-dbr77', 'admin@dbr77.com', 'login', 'session', NULL, NULL, '{"method": "password", "mfa": true}', '192.168.1.100', CURRENT_TIMESTAMP - INTERVAL '2 hours')
ON CONFLICT (id) DO UPDATE SET
    admin_user_id = EXCLUDED.admin_user_id,
    admin_email = EXCLUDED.admin_email,
    action = EXCLUDED.action,
    entity_type = EXCLUDED.entity_type,
    entity_id = EXCLUDED.entity_id,
    old_value = EXCLUDED.old_value,
    new_value = EXCLUDED.new_value,
    ip_address = EXCLUDED.ip_address,
    created_at = EXCLUDED.created_at;

-- ===========================================
-- 6. ACTIVITY LOGS - Extended Demo Data for Audit Tab
-- ===========================================

INSERT INTO activity_logs (id, user_id, user_name, user_email, action, entity_type, entity_id, entity_name, details, created_at) VALUES
    ('activity-cfg-001', 'user-superadmin-dbr77', 'Super Admin', 'admin@dbr77.com', 'updated', 'settings', 'app_name', 'Application Name', '{"field": "app_name", "newValue": "TechnoLex"}', CURRENT_TIMESTAMP - INTERVAL '7 days'),
    ('activity-cfg-002', 'user-superadmin-dbr77', 'Super Admin', 'admin@dbr77.com', 'created', 'user', 'user-demo-new', 'New Demo User', '{"email": "newdemo@example.com"}', CURRENT_TIMESTAMP - INTERVAL '6 days'),
    ('activity-cfg-003', 'user-superadmin-dbr77', 'Super Admin', 'admin@dbr77.com', 'updated', 'branding', 'branding-dbr77-001', 'DBR77 Branding', '{"field": "primaryColor"}', CURRENT_TIMESTAMP - INTERVAL '5 days'),
    ('activity-cfg-004', 'user-superadmin-dbr77', 'Super Admin', 'admin@dbr77.com', 'updated', 'settings', 'enforce_mfa', 'Security Policy', '{"field": "enforce_mfa", "newValue": "false"}', CURRENT_TIMESTAMP - INTERVAL '4 days'),
    ('activity-cfg-005', 'user-superadmin-dbr77', 'Super Admin', 'admin@dbr77.com', 'updated', 'organization', 'org-dbr77-test', 'DBR77', '{"field": "plan", "newValue": "pro"}', CURRENT_TIMESTAMP - INTERVAL '3 days'),
    ('activity-cfg-006', 'user-superadmin-dbr77', 'Super Admin', 'admin@dbr77.com', 'published', 'legal', 'legal-aup-v1', 'AI Usage Policy', '{"version": "1.0"}', CURRENT_TIMESTAMP - INTERVAL '2 days'),
    ('activity-cfg-007', 'user-superadmin-dbr77', 'Super Admin', 'admin@dbr77.com', 'updated', 'settings', 'session_timeout_mins', 'Session Timeout', '{"newValue": "60"}', CURRENT_TIMESTAMP - INTERVAL '1 day'),
    ('activity-cfg-008', 'user-superadmin-dbr77', 'Super Admin', 'admin@dbr77.com', 'impersonated', 'user', 'user-demo-001', 'Demo User', '{"reason": "support"}', CURRENT_TIMESTAMP - INTERVAL '12 hours'),
    ('activity-cfg-009', 'user-superadmin-dbr77', 'Super Admin', 'admin@dbr77.com', 'created', 'api_key', 'apikey-demo-001', 'External Integration Key', '{}', CURRENT_TIMESTAMP - INTERVAL '6 hours'),
    ('activity-cfg-010', 'user-superadmin-dbr77', 'Super Admin', 'admin@dbr77.com', 'login', 'session', NULL, 'Admin Login', '{"method": "password+mfa"}', CURRENT_TIMESTAMP - INTERVAL '2 hours'),
    ('activity-cfg-011', 'user-superadmin-dbr77', 'Super Admin', 'admin@dbr77.com', 'updated', 'settings', 'smtp_host', 'Email Configuration', '{"field": "smtp_host"}', CURRENT_TIMESTAMP - INTERVAL '30 minutes'),
    ('activity-cfg-012', 'user-superadmin-dbr77', 'Super Admin', 'admin@dbr77.com', 'viewed', 'database', 'organizations', 'Database Explorer', '{"table": "organizations"}', CURRENT_TIMESTAMP - INTERVAL '15 minutes')
ON CONFLICT (id) DO NOTHING;

-- ===========================================
-- 7. GDPR REQUESTS - Demo Data
-- ===========================================

INSERT INTO gdpr_requests (id, user_id, type, status, reason, created_at, scheduled_at) VALUES
    ('gdpr-req-001', 'user-demo-001', 'export', 'completed', NULL, CURRENT_TIMESTAMP - INTERVAL '14 days', NULL),
    ('gdpr-req-002', 'user-demo-002', 'export', 'pending', NULL, CURRENT_TIMESTAMP - INTERVAL '2 days', NULL),
    ('gdpr-req-003', 'user-demo-003', 'deletion', 'pending', 'No longer using the service', CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP + INTERVAL '25 days')
ON CONFLICT (id) DO NOTHING;
