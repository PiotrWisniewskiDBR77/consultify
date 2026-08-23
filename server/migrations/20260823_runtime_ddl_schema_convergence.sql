-- Move schema required by mounted runtime out of startup self-heal. A strict
-- baseline-first database otherwise starts by executing ALTER/CREATE DDL while
-- workers and requests are already coming online.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS branding_primary_color TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS branding_accent_color TEXT;

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS extended_preferences TEXT DEFAULT '{}';

ALTER TABLE trusted_devices ADD COLUMN IF NOT EXISTS trusted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE report_builder_reports ADD COLUMN IF NOT EXISTS report_type_v3 TEXT DEFAULT 'custom';
ALTER TABLE report_builder_reports ADD COLUMN IF NOT EXISTS period_from TEXT;
ALTER TABLE report_builder_reports ADD COLUMN IF NOT EXISTS period_to TEXT;
ALTER TABLE report_builder_reports ADD COLUMN IF NOT EXISTS communication_register TEXT;
ALTER TABLE report_builder_reports ADD COLUMN IF NOT EXISTS density TEXT DEFAULT 'standard';
ALTER TABLE report_builder_reports ADD COLUMN IF NOT EXISTS form TEXT;
ALTER TABLE report_builder_reports ADD COLUMN IF NOT EXISTS data_level TEXT DEFAULT 'balanced';
ALTER TABLE report_builder_reports ADD COLUMN IF NOT EXISTS confidentiality TEXT DEFAULT 'internal';
ALTER TABLE report_builder_reports ADD COLUMN IF NOT EXISTS theme_id TEXT;
ALTER TABLE report_builder_reports ADD COLUMN IF NOT EXISTS context_pack_snapshot TEXT;
ALTER TABLE report_builder_reports ADD COLUMN IF NOT EXISTS goal_v3 TEXT;

ALTER TABLE report_builder_sections ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE report_builder_sections ADD COLUMN IF NOT EXISTS is_refreshable INTEGER DEFAULT 0;
ALTER TABLE report_builder_sections ADD COLUMN IF NOT EXISTS last_data_timestamp TEXT;

ALTER TABLE schedule_executions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE usage_records ADD COLUMN IF NOT EXISTS metric_name TEXT;
ALTER TABLE usage_records ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 0;

CREATE TABLE IF NOT EXISTS report_public_links (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    report_type TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    link_token TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    expires_at TIMESTAMP,
    show_company_logo BOOLEAN DEFAULT TRUE,
    show_consultify_branding BOOLEAN DEFAULT TRUE,
    custom_message TEXT,
    view_count INTEGER DEFAULT 0,
    last_viewed_at TIMESTAMP,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_public_links_token ON report_public_links(link_token);
CREATE INDEX IF NOT EXISTS idx_public_links_report ON report_public_links(report_id);
CREATE INDEX IF NOT EXISTS idx_public_links_expires ON report_public_links(expires_at);

CREATE TABLE IF NOT EXISTS organization_brand_voice_profiles (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,
    register_preferences TEXT DEFAULT '{}',
    vocabulary_preferences TEXT DEFAULT '{}',
    hedging_rules TEXT DEFAULT '{}',
    compliance_mode BOOLEAN DEFAULT FALSE,
    compliance_rules TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_brand_voice_org
    ON organization_brand_voice_profiles(organization_id);
