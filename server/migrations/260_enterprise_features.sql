-- FLOW-ENTERPRISE-001: Enterprise Features
-- Migration: 260_enterprise_features.sql

-- ==========================================
-- ENTERPRISE CONTRACTS
-- ==========================================

CREATE TABLE IF NOT EXISTS enterprise_contracts (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    
    -- Contract info
    contract_type TEXT NOT NULL DEFAULT 'standard', -- 'standard', 'annual', 'enterprise', 'custom'
    contract_number TEXT UNIQUE,
    contract_name TEXT,
    
    -- Dates
    start_date DATE NOT NULL,
    end_date DATE,
    signed_date DATE,
    auto_renew INTEGER DEFAULT 0,
    renewal_notice_days INTEGER DEFAULT 30,
    
    -- SLA
    sla_level TEXT DEFAULT 'standard', -- 'standard', 'premium', 'enterprise'
    uptime_guarantee REAL DEFAULT 99.9,
    support_response_hours TEXT DEFAULT '{"critical":4,"high":8,"medium":24,"low":48}',
    
    -- Limits (NULL = plan default)
    max_users INTEGER,
    max_projects INTEGER,
    max_storage_gb INTEGER,
    max_tokens_monthly INTEGER,
    max_assessments_monthly INTEGER,
    
    -- Pricing
    base_price REAL,
    per_user_price REAL,
    per_seat_price REAL,
    currency TEXT DEFAULT 'USD',
    billing_cycle TEXT DEFAULT 'monthly', -- 'monthly', 'quarterly', 'annual'
    payment_terms_days INTEGER DEFAULT 30,
    custom_pricing_notes TEXT,
    
    -- Discounts
    discount_percentage REAL DEFAULT 0,
    discount_reason TEXT,
    
    -- Features
    enabled_features TEXT DEFAULT '[]', -- JSON array of feature flags
    disabled_features TEXT DEFAULT '[]',
    
    -- Support
    account_manager_id TEXT,
    account_manager_name TEXT,
    account_manager_email TEXT,
    account_manager_phone TEXT,
    support_slack_channel TEXT,
    support_priority TEXT DEFAULT 'standard', -- 'standard', 'priority', 'dedicated'
    
    -- Documents
    signed_contract_url TEXT,
    terms_accepted_at TIMESTAMP,
    terms_version TEXT,
    addendums TEXT DEFAULT '[]', -- JSON array: [{name, url, signedAt}]
    
    -- Status
    status TEXT DEFAULT 'draft', -- 'draft', 'pending_signature', 'active', 'expired', 'terminated', 'suspended'
    termination_reason TEXT,
    terminated_at TIMESTAMP,
    
    -- Audit
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_contracts_org ON enterprise_contracts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON enterprise_contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON enterprise_contracts(end_date);

-- ==========================================
-- DATA RESIDENCY
-- ==========================================

CREATE TABLE IF NOT EXISTS data_residency (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,
    
    -- Region
    region TEXT NOT NULL DEFAULT 'eu', -- 'eu', 'us', 'apac', 'custom'
    region_display_name TEXT,
    region_locked INTEGER DEFAULT 0, -- Cannot change after data migration
    locked_at TIMESTAMP,
    locked_reason TEXT,
    
    -- Compliance requirements
    data_sovereignty_required INTEGER DEFAULT 0,
    cross_border_transfer_allowed INTEGER DEFAULT 1,
    specific_country TEXT, -- ISO country code if specific country required
    
    -- Storage locations (for multi-region setup)
    primary_database_region TEXT,
    replica_database_regions TEXT DEFAULT '[]', -- JSON array
    file_storage_region TEXT,
    backup_regions TEXT DEFAULT '[]', -- JSON array
    cdn_regions TEXT DEFAULT '["global"]', -- JSON array
    
    -- AI processing
    ai_processing_region TEXT DEFAULT 'same', -- 'same', 'us', 'eu', 'any'
    ai_data_leaves_region INTEGER DEFAULT 0,
    
    -- Compliance attestations
    gdpr_compliant INTEGER DEFAULT 1,
    hipaa_compliant INTEGER DEFAULT 0,
    sox_compliant INTEGER DEFAULT 0,
    
    configured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    configured_by TEXT,
    last_verified_at TIMESTAMP,
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_residency_org ON data_residency(organization_id);
CREATE INDEX IF NOT EXISTS idx_residency_region ON data_residency(region);

-- ==========================================
-- WHITE-LABEL CONFIGURATIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS white_label_config (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,
    
    -- Branding - Logo
    logo_light_url TEXT,
    logo_dark_url TEXT,
    logo_small_url TEXT, -- For mobile/favicon
    favicon_url TEXT,
    
    -- Branding - Colors
    color_primary TEXT,
    color_primary_dark TEXT,
    color_secondary TEXT,
    color_accent TEXT,
    color_background TEXT,
    color_text TEXT,
    
    -- Branding - Typography
    font_family TEXT,
    font_heading TEXT,
    
    -- Custom CSS
    custom_css TEXT,
    custom_css_enabled INTEGER DEFAULT 0,
    
    -- Custom Domain
    custom_domain TEXT UNIQUE,
    custom_domain_status TEXT DEFAULT 'pending', -- 'pending', 'verifying', 'verified', 'failed'
    custom_domain_verified_at TIMESTAMP,
    custom_domain_dns_records TEXT, -- JSON: required DNS records
    ssl_certificate_id TEXT,
    ssl_certificate_expires_at TIMESTAMP,
    ssl_auto_renew INTEGER DEFAULT 1,
    
    -- Email Branding
    email_from_name TEXT,
    email_from_address TEXT,
    email_reply_to TEXT,
    email_domain_verified INTEGER DEFAULT 0,
    email_dkim_configured INTEGER DEFAULT 0,
    email_spf_configured INTEGER DEFAULT 0,
    email_template_header TEXT, -- Custom HTML
    email_template_footer TEXT,
    
    -- Report Branding
    report_header_logo_url TEXT,
    report_footer_logo_url TEXT,
    report_footer_text TEXT,
    report_cover_template TEXT,
    hide_consultinity_branding INTEGER DEFAULT 0,
    
    -- Login Page
    login_background_url TEXT,
    login_background_color TEXT,
    login_welcome_title TEXT,
    login_welcome_text TEXT,
    login_custom_html TEXT,
    login_show_social INTEGER DEFAULT 1,
    
    -- App Customization
    app_name TEXT, -- Override "Consultinity"
    app_tagline TEXT,
    help_url TEXT, -- Custom help center URL
    support_email TEXT,
    privacy_policy_url TEXT,
    terms_url TEXT,
    
    -- Feature visibility
    hide_upgrade_prompts INTEGER DEFAULT 0,
    hide_partner_links INTEGER DEFAULT 0,
    
    is_enabled INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_whitelabel_org ON white_label_config(organization_id);
CREATE INDEX IF NOT EXISTS idx_whitelabel_domain ON white_label_config(custom_domain);

-- ==========================================
-- SLA TRACKING
-- ==========================================

CREATE TABLE IF NOT EXISTS sla_tracking (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    month DATE NOT NULL, -- First day of month (YYYY-MM-01)
    
    -- Uptime metrics
    total_minutes INTEGER NOT NULL DEFAULT 43200, -- ~30 days
    scheduled_maintenance_minutes INTEGER DEFAULT 0,
    unplanned_downtime_minutes INTEGER DEFAULT 0,
    uptime_percentage REAL,
    
    -- Incidents
    incidents_total INTEGER DEFAULT 0,
    incidents_critical INTEGER DEFAULT 0,
    incidents_major INTEGER DEFAULT 0,
    incidents_minor INTEGER DEFAULT 0,
    mttr_minutes INTEGER, -- Mean time to recovery
    
    -- Support metrics
    tickets_total INTEGER DEFAULT 0,
    tickets_critical INTEGER DEFAULT 0,
    tickets_high INTEGER DEFAULT 0,
    tickets_medium INTEGER DEFAULT 0,
    tickets_low INTEGER DEFAULT 0,
    tickets_within_sla INTEGER DEFAULT 0,
    tickets_breached_sla INTEGER DEFAULT 0,
    avg_first_response_minutes INTEGER,
    avg_resolution_minutes INTEGER,
    
    -- Performance
    avg_response_time_ms INTEGER,
    p95_response_time_ms INTEGER,
    p99_response_time_ms INTEGER,
    
    -- SLA breach & credits
    sla_target REAL, -- From contract
    sla_met INTEGER DEFAULT 1,
    credit_eligible INTEGER DEFAULT 0,
    credit_percentage REAL DEFAULT 0,
    credit_amount REAL DEFAULT 0,
    credit_currency TEXT DEFAULT 'USD',
    credit_applied INTEGER DEFAULT 0,
    credit_applied_at TIMESTAMP,
    credit_invoice_id TEXT,
    
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(organization_id, month)
);

CREATE INDEX IF NOT EXISTS idx_sla_org ON sla_tracking(organization_id);
CREATE INDEX IF NOT EXISTS idx_sla_month ON sla_tracking(month);
CREATE INDEX IF NOT EXISTS idx_sla_breach ON sla_tracking(sla_met);

-- ==========================================
-- FEATURE FLAGS (Enterprise overrides)
-- ==========================================

CREATE TABLE IF NOT EXISTS enterprise_feature_flags (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    
    feature_key TEXT NOT NULL,
    is_enabled INTEGER NOT NULL,
    
    -- Override reason
    reason TEXT,
    enabled_by TEXT,
    enabled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP, -- Temporary override
    
    UNIQUE(organization_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_org ON enterprise_feature_flags(organization_id);
CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON enterprise_feature_flags(feature_key);
