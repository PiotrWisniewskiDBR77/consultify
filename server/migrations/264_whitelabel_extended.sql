-- FLOW-WHITELABEL-001: White-label Extended
-- Migration: 264_whitelabel_extended.sql

-- ==========================================
-- WHITE-LABEL ASSETS
-- ==========================================

CREATE TABLE IF NOT EXISTS white_label_assets (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    
    -- Asset type
    asset_type TEXT NOT NULL, -- 'logo_light', 'logo_dark', 'logo_small', 'favicon', 'login_bg', 'report_header', 'report_footer', 'email_header', 'email_footer'
    
    -- File info
    file_name TEXT NOT NULL,
    original_name TEXT,
    file_size INTEGER,
    mime_type TEXT,
    
    -- Storage
    storage_provider TEXT DEFAULT 'local', -- 'local', 's3', 'gcs'
    storage_path TEXT NOT NULL,
    storage_bucket TEXT,
    cdn_url TEXT,
    
    -- Image metadata
    width INTEGER,
    height INTEGER,
    format TEXT, -- 'png', 'jpg', 'svg', 'webp'
    
    -- Variants (for responsive)
    variants TEXT DEFAULT '{}', -- JSON: {small: url, medium: url, large: url}
    
    -- Status
    is_active INTEGER DEFAULT 1,
    processing_status TEXT DEFAULT 'ready', -- 'uploading', 'processing', 'ready', 'failed'
    
    uploaded_by TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_wl_assets_org ON white_label_assets(organization_id);
CREATE INDEX IF NOT EXISTS idx_wl_assets_type ON white_label_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_wl_assets_active ON white_label_assets(organization_id, asset_type, is_active);

-- ==========================================
-- DOMAIN VERIFICATIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS domain_verifications (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    
    -- Domain info
    domain TEXT NOT NULL,
    subdomain TEXT, -- If using subdomain
    full_domain TEXT NOT NULL, -- Complete domain
    
    -- Verification
    verification_method TEXT DEFAULT 'dns', -- 'dns', 'file', 'meta'
    verification_token TEXT NOT NULL,
    
    -- DNS records required
    cname_host TEXT,
    cname_target TEXT DEFAULT 'custom.consultinity.app',
    txt_host TEXT,
    txt_value TEXT,
    
    -- Alternative: File verification
    verification_file_path TEXT,
    verification_file_content TEXT,
    
    -- Status
    status TEXT DEFAULT 'pending', -- 'pending', 'dns_pending', 'verifying', 'verified', 'failed', 'expired'
    verification_attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 100,
    last_check_at TIMESTAMP,
    next_check_at TIMESTAMP,
    verified_at TIMESTAMP,
    
    -- SSL Certificate
    ssl_status TEXT DEFAULT 'pending', -- 'pending', 'provisioning', 'active', 'renewal', 'expired', 'failed'
    ssl_provider TEXT DEFAULT 'letsencrypt',
    ssl_certificate_id TEXT,
    ssl_provisioned_at TIMESTAMP,
    ssl_expires_at TIMESTAMP,
    ssl_auto_renew INTEGER DEFAULT 1,
    
    -- Errors
    last_error TEXT,
    error_count INTEGER DEFAULT 0,
    
    -- Lifecycle
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP, -- Verification must complete
    deactivated_at TIMESTAMP,
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_domain_verif_org ON domain_verifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_domain_verif_domain ON domain_verifications(full_domain);
CREATE INDEX IF NOT EXISTS idx_domain_verif_status ON domain_verifications(status);
CREATE INDEX IF NOT EXISTS idx_domain_verif_ssl ON domain_verifications(ssl_status, ssl_expires_at);

-- ==========================================
-- EMAIL SENDER VERIFICATIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS email_sender_verifications (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    
    -- Email info
    email_address TEXT NOT NULL,
    email_domain TEXT NOT NULL,
    
    -- Verification
    verification_method TEXT DEFAULT 'dkim', -- 'dkim', 'spf', 'link'
    verification_token TEXT,
    
    -- DNS records
    dkim_selector TEXT,
    dkim_record TEXT,
    spf_record TEXT,
    dmarc_record TEXT,
    
    -- Status
    status TEXT DEFAULT 'pending', -- 'pending', 'verifying', 'verified', 'failed'
    dkim_verified INTEGER DEFAULT 0,
    spf_verified INTEGER DEFAULT 0,
    dmarc_verified INTEGER DEFAULT 0,
    
    verified_at TIMESTAMP,
    last_check_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_email_verif_org ON email_sender_verifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_verif_domain ON email_sender_verifications(email_domain);

-- ==========================================
-- WHITE-LABEL THEMES (Presets)
-- ==========================================

CREATE TABLE IF NOT EXISTS white_label_themes (
    id TEXT PRIMARY KEY,
    
    name TEXT NOT NULL,
    description TEXT,
    
    -- Colors
    color_primary TEXT NOT NULL,
    color_primary_dark TEXT,
    color_secondary TEXT,
    color_accent TEXT,
    color_background TEXT,
    color_surface TEXT,
    color_text TEXT,
    color_text_secondary TEXT,
    
    -- Typography
    font_family TEXT,
    font_heading TEXT,
    
    -- Misc
    border_radius TEXT DEFAULT 'rounded', -- 'none', 'rounded', 'pill'
    
    -- Preview
    preview_image_url TEXT,
    
    is_system INTEGER DEFAULT 0, -- System preset
    is_public INTEGER DEFAULT 1, -- Available to all
    organization_id TEXT, -- If org-specific
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed default themes
INSERT OR IGNORE INTO white_label_themes (id, name, description, color_primary, color_secondary, is_system) VALUES
    ('theme-default', 'Consultinity Blue', 'Default blue theme', '#3B82F6', '#10B981', 1),
    ('theme-dark', 'Dark Professional', 'Dark mode professional', '#6366F1', '#8B5CF6', 1),
    ('theme-corporate', 'Corporate Gray', 'Neutral corporate look', '#475569', '#0EA5E9', 1),
    ('theme-green', 'Nature Green', 'Eco-friendly green', '#059669', '#10B981', 1),
    ('theme-orange', 'Energetic Orange', 'Vibrant orange theme', '#EA580C', '#F59E0B', 1);

CREATE INDEX IF NOT EXISTS idx_themes_public ON white_label_themes(is_public);
