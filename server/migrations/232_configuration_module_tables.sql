-- ===========================================
-- 232_configuration_module_tables.sql
-- Configuration Module - Database Tables for SuperAdmin Settings
-- Includes: Branding, Legal Documents, System Settings Extensions
-- ===========================================

-- ===========================================
-- 1. ORGANIZATION BRANDING TABLE
-- White-label branding configuration per organization
-- ===========================================

CREATE TABLE IF NOT EXISTS organization_branding (
    id TEXT PRIMARY KEY,
    organization_id TEXT UNIQUE NOT NULL,
    -- Logos
    logo_light_url TEXT,
    logo_dark_url TEXT,
    logo_icon_url TEXT,
    favicon_url TEXT,
    -- Light Mode Colors
    primary_color TEXT DEFAULT '#8B5CF6',
    secondary_color TEXT DEFAULT '#3B82F6',
    accent_color TEXT DEFAULT '#10B981',
    background_color TEXT DEFAULT '#F8FAFC',
    text_color TEXT DEFAULT '#1E293B',
    -- Dark Mode Colors
    dark_primary_color TEXT DEFAULT '#A78BFA',
    dark_secondary_color TEXT DEFAULT '#60A5FA',
    dark_background_color TEXT DEFAULT '#0F172A',
    dark_text_color TEXT DEFAULT '#F8FAFC',
    -- Typography
    font_family TEXT DEFAULT 'Inter',
    heading_font_family TEXT DEFAULT 'Inter',
    -- Login Page Customization
    login_background_url TEXT,
    login_tagline TEXT,
    login_welcome_message TEXT,
    -- Custom Domain
    custom_domain TEXT,
    custom_domain_verified INTEGER DEFAULT 0,
    custom_domain_ssl_status TEXT DEFAULT 'pending', -- 'pending', 'active', 'failed'
    -- Branding Options
    hide_powered_by INTEGER DEFAULT 0,
    custom_support_email TEXT,
    custom_terms_url TEXT,
    custom_privacy_url TEXT,
    -- Timestamps
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_org_branding_org ON organization_branding(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_branding_domain ON organization_branding(custom_domain);

-- ===========================================
-- 2. LEGAL DOCUMENTS TABLE
-- Platform legal documents management
-- ===========================================

CREATE TABLE IF NOT EXISTS legal_documents (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL, -- 'privacy', 'terms', 'dpa', 'sla', 'aup', 'cookie'
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    content TEXT, -- Full document content (optional)
    url TEXT, -- External URL if hosted elsewhere
    status TEXT DEFAULT 'active', -- 'draft', 'active', 'archived'
    effective_date TEXT,
    requires_acceptance INTEGER DEFAULT 0,
    acceptance_required_for TEXT, -- 'all', 'new_users', 'admins'
    created_by TEXT,
    published_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    published_at TEXT,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (published_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_legal_docs_type ON legal_documents(type);
CREATE INDEX IF NOT EXISTS idx_legal_docs_status ON legal_documents(status);
CREATE INDEX IF NOT EXISTS idx_legal_docs_version ON legal_documents(type, version);

-- ===========================================
-- 3. LEGAL DOCUMENT ACCEPTANCES TABLE
-- Track user acceptances of legal documents
-- ===========================================

CREATE TABLE IF NOT EXISTS legal_document_acceptances (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    document_id TEXT NOT NULL,
    document_type TEXT NOT NULL,
    document_version TEXT NOT NULL,
    accepted_at TEXT DEFAULT (datetime('now')),
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES legal_documents(id),
    UNIQUE(user_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_legal_acceptances_user ON legal_document_acceptances(user_id);
CREATE INDEX IF NOT EXISTS idx_legal_acceptances_doc ON legal_document_acceptances(document_id);

-- ===========================================
-- 4. SUPERADMIN AUDIT LOG TABLE (Enhanced)
-- Detailed audit log for SuperAdmin actions
-- ===========================================

CREATE TABLE IF NOT EXISTS superadmin_audit_log (
    id TEXT PRIMARY KEY,
    admin_user_id TEXT NOT NULL,
    admin_email TEXT,
    action TEXT NOT NULL, -- 'settings_update', 'branding_change', 'user_create', etc.
    entity_type TEXT, -- 'settings', 'branding', 'user', 'organization', 'legal'
    entity_id TEXT,
    old_value TEXT, -- JSON of previous state
    new_value TEXT, -- JSON of new state
    ip_address TEXT,
    user_agent TEXT,
    metadata TEXT DEFAULT '{}', -- Additional context JSON
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (admin_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_superadmin_audit_admin ON superadmin_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_superadmin_audit_action ON superadmin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_superadmin_audit_entity ON superadmin_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_superadmin_audit_created ON superadmin_audit_log(created_at);

-- ===========================================
-- 5. SYSTEM SETTINGS TABLE (ensure exists)
-- Global platform settings key-value store
-- ===========================================

CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    category TEXT DEFAULT 'general', -- 'general', 'security', 'email', 'legal', 'appearance'
    is_sensitive INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now')),
    updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(category);

-- ===========================================
-- 6. COMPLIANCE FRAMEWORKS TABLE
-- Track compliance certifications and status
-- ===========================================

CREATE TABLE IF NOT EXISTS compliance_frameworks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL, -- 'GDPR', 'SOC2', 'ISO27001', 'HIPAA'
    display_name TEXT NOT NULL,
    status TEXT DEFAULT 'compliant', -- 'compliant', 'in_progress', 'not_applicable'
    certification_date TEXT,
    expiry_date TEXT,
    certificate_url TEXT,
    auditor TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_compliance_name ON compliance_frameworks(name);
CREATE INDEX IF NOT EXISTS idx_compliance_status ON compliance_frameworks(status);
