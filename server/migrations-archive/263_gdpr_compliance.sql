-- FLOW-GDPR-001: GDPR & Data Compliance
-- Migration: 263_gdpr_compliance.sql

-- ==========================================
-- DATA SUBJECT REQUESTS (DSAR)
-- ==========================================

CREATE TABLE IF NOT EXISTS data_subject_requests (
    id TEXT PRIMARY KEY,
    request_number TEXT NOT NULL UNIQUE,
    organization_id TEXT,
    
    -- Subject identification
    subject_email TEXT NOT NULL,
    subject_name TEXT,
    subject_user_id TEXT,
    subject_phone TEXT,
    
    -- Request details
    request_type TEXT NOT NULL, -- 'access', 'rectification', 'erasure', 'portability', 'objection', 'restriction'
    request_details TEXT,
    specific_data_categories TEXT DEFAULT '[]', -- JSON: specific data requested
    
    -- Identity verification
    identity_verified BOOLEAN DEFAULT FALSE,
    verification_method TEXT, -- 'email_code', 'account_login', 'document', 'phone'
    verification_document_url TEXT,
    verified_at TIMESTAMP,
    verified_by TEXT,
    
    -- Processing
    status TEXT DEFAULT 'pending', -- 'pending', 'verifying', 'processing', 'review', 'completed', 'rejected', 'extended'
    assigned_to TEXT,
    priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
    
    -- Deadlines (GDPR: 30 days, can extend to 90)
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deadline_at TIMESTAMP,
    extended_deadline_at TIMESTAMP,
    extension_reason TEXT,
    extension_notified_at TIMESTAMP,
    
    -- Data collection progress
    data_collection_started_at TIMESTAMP,
    data_collection_completed_at TIMESTAMP,
    data_categories_collected TEXT DEFAULT '[]', -- JSON
    
    -- Response
    response_type TEXT, -- 'full_export', 'partial_export', 'confirmation', 'no_data', 'rejection'
    response_format TEXT DEFAULT 'json', -- 'json', 'csv', 'pdf'
    response_data_url TEXT,
    response_expires_at TIMESTAMP,
    response_download_count INTEGER DEFAULT 0,
    response_notes TEXT,
    
    -- Completion
    completed_at TIMESTAMP,
    completed_by TEXT,
    
    -- Rejection (if applicable)
    rejection_reason TEXT, -- 'identity_not_verified', 'excessive_requests', 'legal_obligation', 'public_interest'
    rejection_legal_basis TEXT,
    
    -- Communication
    last_communication_at TIMESTAMP,
    communication_log TEXT DEFAULT '[]', -- JSON: [{date, type, content}]
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dsar_org ON data_subject_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_dsar_email ON data_subject_requests(subject_email);
CREATE INDEX IF NOT EXISTS idx_dsar_user ON data_subject_requests(subject_user_id);
CREATE INDEX IF NOT EXISTS idx_dsar_status ON data_subject_requests(status);
CREATE INDEX IF NOT EXISTS idx_dsar_type ON data_subject_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_dsar_deadline ON data_subject_requests(deadline_at);

-- ==========================================
-- DSAR ACTIVITY LOG
-- ==========================================

CREATE TABLE IF NOT EXISTS dsar_activity_log (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    
    activity_type TEXT NOT NULL, -- 'created', 'status_change', 'verification_sent', 'verified', 'assigned', 'data_collected', 'reviewed', 'completed', 'rejected', 'extended', 'reminder_sent'
    previous_status TEXT,
    new_status TEXT,
    description TEXT,
    
    performed_by TEXT,
    performed_by_type TEXT DEFAULT 'user', -- 'user', 'system', 'automated'
    
    metadata TEXT, -- JSON: additional context
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (request_id) REFERENCES data_subject_requests(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dsar_activity_request ON dsar_activity_log(request_id);
CREATE INDEX IF NOT EXISTS idx_dsar_activity_type ON dsar_activity_log(activity_type);

-- ==========================================
-- CONSENT RECORDS
-- ==========================================

CREATE TABLE IF NOT EXISTS consent_records (
    id TEXT PRIMARY KEY,
    
    -- Subject
    user_id TEXT,
    email TEXT,
    organization_id TEXT,
    
    -- Consent details
    consent_type TEXT NOT NULL, 
    -- Types: 'cookies_essential', 'cookies_analytics', 'cookies_marketing', 'cookies_functional',
    --        'email_marketing', 'email_product', 'email_newsletter',
    --        'data_processing', 'ai_training', 'third_party_sharing'
    
    consent_given INTEGER NOT NULL, -- 1 = consent given, 0 = consent denied/withdrawn
    
    -- Context of consent
    consent_text TEXT,
    consent_text_hash TEXT, -- To detect if text changed
    consent_version TEXT,
    consent_language TEXT DEFAULT 'en',
    
    -- Collection context
    ip_address TEXT,
    user_agent TEXT,
    geo_country TEXT,
    source TEXT, -- 'registration', 'cookie_banner', 'settings', 'email_preference', 'api'
    source_url TEXT,
    
    -- Timestamps
    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    withdrawn_at TIMESTAMP,
    withdrawal_reason TEXT,
    
    -- For double opt-in
    confirmation_required BOOLEAN DEFAULT FALSE,
    confirmation_sent_at TIMESTAMP,
    confirmed_at TIMESTAMP,
    confirmation_token TEXT,
    
    -- Expiry (some consents may expire)
    expires_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_consent_user ON consent_records(user_id);
CREATE INDEX IF NOT EXISTS idx_consent_email ON consent_records(email);
CREATE INDEX IF NOT EXISTS idx_consent_org ON consent_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_consent_type ON consent_records(consent_type);
CREATE INDEX IF NOT EXISTS idx_consent_given ON consent_records(consent_given);

-- ==========================================
-- RETENTION POLICIES
-- ==========================================

CREATE TABLE IF NOT EXISTS retention_policies (
    id TEXT PRIMARY KEY,
    organization_id TEXT, -- NULL for system-wide defaults
    
    data_category TEXT NOT NULL,
    -- Categories: 'user_profile', 'user_preferences', 'project_data', 'initiative_data', 
    --             'task_data', 'assessment_data', 'report_data', 'audit_logs', 
    --             'ai_conversations', 'ai_memory', 'session_logs', 'notification_logs',
    --             'billing_data', 'support_tickets', 'file_uploads'
    
    data_category_description TEXT,
    
    -- For active accounts
    active_retention_days INTEGER, -- NULL = indefinite
    
    -- For cancelled accounts
    grace_period_days INTEGER DEFAULT 30, -- Before any action
    archive_period_days INTEGER, -- Days in archive before deletion
    final_deletion_days INTEGER, -- Total days after cancellation to full delete
    
    -- Actions
    action_on_expiry TEXT DEFAULT 'delete', -- 'delete', 'anonymize', 'archive'
    anonymize_fields TEXT, -- JSON: fields to anonymize instead of delete
    archive_location TEXT, -- 'cold_storage', 'encrypted_archive'
    
    -- Exceptions
    legal_hold_override BOOLEAN DEFAULT FALSE, -- Can be overridden by legal hold
    minimum_retention_days INTEGER, -- Cannot delete before this (legal requirement)
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(organization_id, data_category)
);

-- Seed default retention policies
INSERT INTO retention_policies (id, organization_id, data_category, active_retention_days, grace_period_days, archive_period_days, final_deletion_days, action_on_expiry, minimum_retention_days) VALUES
    ('ret-def-audit', NULL, 'audit_logs', NULL, 0::integer, 2555::integer, 2555::integer, 'archive', 2555::integer),
    ('ret-def-billing', NULL, 'billing_data', NULL, 0::integer, 2555::integer, 2555::integer, 'archive', 2555::integer),
    ('ret-def-sessions', NULL, 'session_logs', 90::integer, 0::integer, 0::integer, 90::integer, 'delete', 0::integer),
    ('ret-def-ai-conv', NULL, 'ai_conversations', 730::integer, 30::integer, 0::integer, 760::integer, 'delete', 0::integer),
    ('ret-def-ai-mem', NULL, 'ai_memory', 365::integer, 30::integer, 0::integer, 395::integer, 'anonymize', 0::integer),
    ('ret-def-projects', NULL, 'project_data', NULL, 90::integer, 365::integer, 455::integer, 'archive', 0::integer),
    ('ret-def-users', NULL, 'user_profile', NULL, 30::integer, 0::integer, 30::integer, 'anonymize', 0::integer),
    ('ret-def-files', NULL, 'file_uploads', NULL, 30::integer, 90::integer, 120::integer, 'delete', 0::integer),
    ('ret-def-notif', NULL, 'notification_logs', 180::integer, 0::integer, 0::integer, 180::integer, 'delete', 0::integer)
ON CONFLICT (organization_id, data_category) DO NOTHING;

-- ==========================================
-- DATA DELETION LOG
-- ==========================================

CREATE TABLE IF NOT EXISTS data_deletion_log (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    
    -- What was deleted
    data_category TEXT NOT NULL,
    table_name TEXT,
    record_ids TEXT, -- JSON array (limited for privacy)
    record_count INTEGER NOT NULL,
    
    -- Why
    deletion_reason TEXT NOT NULL, -- 'retention_policy', 'user_request', 'dsar', 'account_cancellation', 'manual', 'legal_requirement'
    dsar_request_id TEXT,
    policy_id TEXT,
    
    -- Details
    deletion_method TEXT, -- 'hard_delete', 'soft_delete', 'anonymize'
    anonymization_applied TEXT, -- JSON: what was anonymized
    
    -- Who
    initiated_by TEXT,
    initiated_by_type TEXT, -- 'user', 'system', 'cron', 'admin'
    
    -- When
    scheduled_at TIMESTAMP,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Verification
    deletion_verified BOOLEAN DEFAULT FALSE,
    verified_by TEXT,
    verified_at TIMESTAMP,
    verification_method TEXT, -- 'automated_check', 'manual_review'
    
    -- Backup reference (for compliance)
    backup_reference TEXT,
    backup_retention_until DATE,
    
    FOREIGN KEY (dsar_request_id) REFERENCES data_subject_requests(id)
);

CREATE INDEX IF NOT EXISTS idx_deletion_org ON data_deletion_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_deletion_category ON data_deletion_log(data_category);
CREATE INDEX IF NOT EXISTS idx_deletion_reason ON data_deletion_log(deletion_reason);
CREATE INDEX IF NOT EXISTS idx_deletion_date ON data_deletion_log(executed_at);

-- ==========================================
-- SUB-PROCESSORS
-- ==========================================

CREATE TABLE IF NOT EXISTS sub_processors (
    id TEXT PRIMARY KEY,
    
    -- Company info
    name TEXT NOT NULL,
    legal_name TEXT,
    website TEXT,
    description TEXT,
    
    -- Purpose
    purpose TEXT NOT NULL,
    data_categories TEXT NOT NULL, -- JSON: categories of data processed
    
    -- Location & compliance
    country TEXT NOT NULL,
    country_code TEXT,
    region TEXT, -- 'EU', 'EEA', 'US', 'UK', 'APAC', 'OTHER'
    
    -- GDPR compliance
    gdpr_compliant BOOLEAN DEFAULT TRUE,
    adequacy_decision BOOLEAN DEFAULT FALSE, -- EU adequacy decision exists
    transfer_mechanism TEXT, -- 'adequacy', 'scc', 'bcr', 'derogation', 'consent'
    
    -- Agreements
    dpa_signed BOOLEAN DEFAULT TRUE,
    dpa_url TEXT,
    dpa_signed_date DATE,
    scc_version TEXT, -- '2021' for new SCCs
    
    -- Certifications
    certifications TEXT DEFAULT '[]', -- JSON: ['SOC2', 'ISO27001', etc.]
    
    -- Contact
    dpo_email TEXT,
    security_contact TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    deactivated_at TIMESTAMP,
    deactivation_reason TEXT,
    
    -- Audit
    last_reviewed_at TIMESTAMP,
    next_review_due DATE,
    
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed common sub-processors
INSERT INTO sub_processors (id, name, purpose, data_categories, country, country_code, region, gdpr_compliant, transfer_mechanism) VALUES
    ('sp-stripe', 'Stripe', 'Payment processing', '["billing_data","user_email"]', 'United States', 'US', 'US', TRUE, 'scc'),
    ('sp-aws', 'Amazon Web Services', 'Cloud infrastructure', '["all_data"]', 'Ireland', 'IE', 'EU', TRUE, 'adequacy'),
    ('sp-openai', 'OpenAI', 'AI processing', '["ai_conversations","user_prompts"]', 'United States', 'US', 'US', TRUE, 'scc'),
    ('sp-anthropic', 'Anthropic', 'AI processing', '["ai_conversations","user_prompts"]', 'United States', 'US', 'US', TRUE, 'scc'),
    ('sp-sendgrid', 'SendGrid', 'Email delivery', '["user_email","notification_content"]', 'United States', 'US', 'US', TRUE, 'scc')
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_subprocessors_active ON sub_processors(is_active);
CREATE INDEX IF NOT EXISTS idx_subprocessors_region ON sub_processors(region);

-- ==========================================
-- LEGAL HOLDS
-- ==========================================

CREATE TABLE IF NOT EXISTS legal_holds (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    
    -- Hold details
    name TEXT NOT NULL,
    description TEXT,
    legal_matter TEXT, -- Case/matter reference
    
    -- Scope
    scope_type TEXT NOT NULL, -- 'organization', 'user', 'project', 'data_category'
    scope_ids TEXT NOT NULL, -- JSON: IDs affected
    data_categories TEXT DEFAULT '["all"]', -- JSON: categories on hold
    
    -- Dates
    effective_from TIMESTAMP NOT NULL,
    effective_until TIMESTAMP, -- NULL = indefinite
    
    -- Status
    status TEXT DEFAULT 'active', -- 'active', 'released', 'expired'
    released_at TIMESTAMP,
    released_by TEXT,
    release_reason TEXT,
    
    -- Audit
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_legal_holds_org ON legal_holds(organization_id);
CREATE INDEX IF NOT EXISTS idx_legal_holds_status ON legal_holds(status);
