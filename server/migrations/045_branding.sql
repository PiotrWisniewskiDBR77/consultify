-- Migration: 045_branding.sql
-- White-label & Branding Configuration
-- Created: 2025-12-27

-- Organization branding configuration
CREATE TABLE IF NOT EXISTS organization_branding (
    id TEXT PRIMARY KEY,
    organization_id TEXT UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Logo assets
    logo_light_url TEXT, -- Logo for light backgrounds
    logo_dark_url TEXT, -- Logo for dark backgrounds
    logo_icon_url TEXT, -- Small icon/favicon
    favicon_url TEXT,
    
    -- Colors (hex values)
    primary_color TEXT DEFAULT '#8B5CF6', -- Main brand color
    secondary_color TEXT DEFAULT '#3B82F6', -- Accent color
    accent_color TEXT DEFAULT '#10B981', -- Highlight color
    background_color TEXT DEFAULT '#F8FAFC',
    text_color TEXT DEFAULT '#1E293B',
    
    -- Dark mode colors
    dark_primary_color TEXT DEFAULT '#A78BFA',
    dark_secondary_color TEXT DEFAULT '#60A5FA',
    dark_background_color TEXT DEFAULT '#0F172A',
    dark_text_color TEXT DEFAULT '#F8FAFC',
    
    -- Typography
    font_family TEXT DEFAULT 'Inter',
    heading_font_family TEXT DEFAULT 'Inter',
    font_size_base TEXT DEFAULT '14px',
    
    -- Custom CSS (advanced)
    custom_css TEXT,
    
    -- Login Page Customization
    login_background_url TEXT,
    login_background_color TEXT,
    login_tagline TEXT,
    login_welcome_message TEXT,
    
    -- Email Branding
    email_header_html TEXT,
    email_footer_html TEXT,
    email_primary_color TEXT,
    email_logo_url TEXT,
    
    -- Custom Domain
    custom_domain TEXT,
    custom_domain_verified INTEGER DEFAULT 0,
    custom_domain_ssl_status TEXT DEFAULT 'pending', -- 'pending', 'active', 'failed'
    custom_domain_verified_at TEXT,
    
    -- Feature Flags
    hide_powered_by INTEGER DEFAULT 0,
    custom_support_email TEXT,
    custom_support_url TEXT,
    custom_terms_url TEXT,
    custom_privacy_url TEXT,
    
    -- Metadata
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    created_by TEXT REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_org_branding_org ON organization_branding(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_branding_domain ON organization_branding(custom_domain) WHERE custom_domain IS NOT NULL;

-- Custom domain DNS verification records
CREATE TABLE IF NOT EXISTS domain_verifications (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    
    -- Verification
    verification_type TEXT DEFAULT 'dns_txt', -- 'dns_txt', 'cname', 'file'
    verification_token TEXT NOT NULL,
    verification_record TEXT, -- The DNS record to add
    
    -- Status
    is_verified INTEGER DEFAULT 0,
    verified_at TEXT,
    last_check_at TEXT,
    check_count INTEGER DEFAULT 0,
    
    -- Error tracking
    last_error TEXT,
    
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_domain_verifications_org ON domain_verifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_domain_verifications_domain ON domain_verifications(domain);

-- SSL certificates for custom domains
CREATE TABLE IF NOT EXISTS ssl_certificates (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    
    -- Certificate info
    certificate_type TEXT DEFAULT 'lets_encrypt', -- 'lets_encrypt', 'custom'
    certificate_pem TEXT, -- For custom certificates
    private_key_encrypted TEXT,
    
    -- Status
    status TEXT DEFAULT 'pending', -- 'pending', 'issuing', 'active', 'expired', 'failed'
    issued_at TEXT,
    expires_at TEXT,
    
    -- Auto-renewal
    auto_renew INTEGER DEFAULT 1,
    last_renewal_attempt TEXT,
    renewal_error TEXT,
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ssl_certs_org ON ssl_certificates(organization_id);
CREATE INDEX IF NOT EXISTS idx_ssl_certs_domain ON ssl_certificates(domain);
CREATE INDEX IF NOT EXISTS idx_ssl_certs_expiry ON ssl_certificates(expires_at);

-- Email templates per organization
CREATE TABLE IF NOT EXISTS email_templates (
    id TEXT PRIMARY KEY,
    organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE, -- null for system defaults
    
    -- Template info
    template_key TEXT NOT NULL, -- 'welcome', 'password_reset', 'invitation', etc.
    name TEXT NOT NULL,
    description TEXT,
    
    -- Content
    subject TEXT NOT NULL,
    html_content TEXT NOT NULL,
    text_content TEXT, -- Plain text fallback
    
    -- Variables
    available_variables TEXT DEFAULT '[]', -- JSON array of available merge tags
    
    -- Status
    is_active INTEGER DEFAULT 1,
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    created_by TEXT REFERENCES users(id),
    
    UNIQUE(organization_id, template_key)
);

CREATE INDEX IF NOT EXISTS idx_email_templates_org ON email_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_key ON email_templates(template_key);

-- Insert default email templates
INSERT OR IGNORE INTO email_templates (id, organization_id, template_key, name, subject, html_content, available_variables)
VALUES 
    ('tpl_welcome', NULL, 'welcome', 'Welcome Email', 'Welcome to {{app_name}}!', 
     '<h1>Welcome, {{first_name}}!</h1><p>Thank you for joining {{app_name}}.</p>', 
     '["first_name", "last_name", "email", "app_name", "login_url"]'),
    ('tpl_password_reset', NULL, 'password_reset', 'Password Reset', 'Reset your password',
     '<h1>Password Reset</h1><p>Click <a href="{{reset_url}}">here</a> to reset your password.</p>',
     '["first_name", "reset_url", "expires_in"]'),
    ('tpl_invitation', NULL, 'invitation', 'Team Invitation', 'You\'ve been invited to join {{org_name}}',
     '<h1>Join {{org_name}}</h1><p>{{inviter_name}} has invited you to join their team.</p><a href="{{invite_url}}">Accept Invitation</a>',
     '["first_name", "inviter_name", "org_name", "invite_url"]');


















