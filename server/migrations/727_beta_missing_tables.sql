-- Migration 727: Create missing tables required for beta launch
-- The 000_z_core_baseline.sql only created ~47 tables. Many tables from the
-- full 000_initdb_core_tables.sql and legacy <500 migrations were skipped
-- by the Postgres migration runner. This migration fills the gaps for
-- tables needed by the core beta modules.

-- 1. Organization Members (critical for org creation flow)
CREATE TABLE IF NOT EXISTS organization_members (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER', 'CONSULTANT')),
    status TEXT DEFAULT 'ACTIVE',
    invited_by_user_id TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(organization_id, user_id)
);

-- 2. Organization Profiles
CREATE TABLE IF NOT EXISTS organization_profiles (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,
    industry TEXT,
    industry_code TEXT,
    industry_subsector TEXT,
    company_size TEXT,
    employee_count INTEGER,
    annual_revenue REAL,
    founding_year INTEGER,
    headquarters_country TEXT,
    strategic_priorities TEXT DEFAULT '[]',
    competitive_position TEXT,
    growth_stage TEXT,
    mission_statement TEXT,
    vision_statement TEXT,
    digital_maturity_overall REAL,
    technology_stack TEXT DEFAULT '[]',
    digital_budget_percent REAL,
    cloud_adoption_level TEXT,
    primary_markets TEXT DEFAULT '[]',
    customer_segments TEXT DEFAULT '[]',
    key_competitors TEXT DEFAULT '[]',
    market_share_estimate REAL,
    regulatory_environment TEXT DEFAULT '[]',
    risk_appetite TEXT DEFAULT 'MODERATE',
    budget_constraints TEXT,
    timeline_constraints TEXT,
    preferred_language TEXT DEFAULT 'pl',
    communication_style TEXT DEFAULT 'PROFESSIONAL',
    industry_jargon_level TEXT DEFAULT 'MEDIUM',
    last_assessment_date TIMESTAMPTZ,
    profile_completeness REAL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    updated_by TEXT,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- 3. Organization Settings (key-value store)
CREATE TABLE IF NOT EXISTS organization_settings (
    organization_id TEXT NOT NULL,
    setting_key TEXT NOT NULL,
    setting_value TEXT,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (organization_id, setting_key),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- 4. Organization Context (interview-driven context)
CREATE TABLE IF NOT EXISTS organization_context (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,
    company_name TEXT,
    industry TEXT,
    company_size TEXT,
    location TEXT,
    employee_count INTEGER,
    annual_revenue TEXT,
    key_metrics TEXT DEFAULT '[]',
    stakeholders TEXT DEFAULT '[]',
    open_gaps TEXT DEFAULT '[]',
    completeness_percent INTEGER DEFAULT 0,
    last_interview_id TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. Organization Branding
CREATE TABLE IF NOT EXISTS organization_branding (
    id TEXT PRIMARY KEY,
    organization_id TEXT UNIQUE NOT NULL,
    logo_light_url TEXT,
    logo_dark_url TEXT,
    logo_icon_url TEXT,
    favicon_url TEXT,
    primary_color TEXT DEFAULT '#8B5CF6',
    secondary_color TEXT DEFAULT '#3B82F6',
    accent_color TEXT DEFAULT '#10B981',
    background_color TEXT DEFAULT '#F8FAFC',
    text_color TEXT DEFAULT '#1E293B',
    dark_primary_color TEXT DEFAULT '#A78BFA',
    dark_secondary_color TEXT DEFAULT '#60A5FA',
    dark_background_color TEXT DEFAULT '#0F172A',
    dark_text_color TEXT DEFAULT '#F8FAFC',
    font_family TEXT DEFAULT 'Inter',
    heading_font_family TEXT DEFAULT 'Inter',
    login_background_url TEXT,
    login_tagline TEXT,
    login_welcome_message TEXT,
    custom_domain TEXT,
    custom_domain_verified BOOLEAN DEFAULT FALSE,
    custom_domain_ssl_status TEXT DEFAULT 'pending',
    hide_powered_by BOOLEAN DEFAULT FALSE,
    custom_support_email TEXT,
    custom_terms_url TEXT,
    custom_privacy_url TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- 6. Organization Events
CREATE TABLE IF NOT EXISTS organization_events (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_data TEXT DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- 7. Payment Methods
CREATE TABLE IF NOT EXISTS payment_methods (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    stripe_payment_method_id TEXT,
    type TEXT DEFAULT 'card',
    brand TEXT,
    last4 TEXT,
    exp_month INTEGER,
    exp_year INTEGER,
    holder_name TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- 8. Chat Projects
CREATE TABLE IF NOT EXISTS chat_projects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#6366f1',
    icon TEXT DEFAULT 'folder',
    scope TEXT DEFAULT 'personal',
    conversation_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);

-- 9. Tools
CREATE TABLE IF NOT EXISTS tools (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    category TEXT NOT NULL,
    tool_type TEXT,
    library_category TEXT,
    description TEXT,
    description_translations TEXT,
    library_content_translations TEXT,
    icon TEXT,
    is_licensed BOOLEAN DEFAULT FALSE,
    license_holder TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_coming_soon BOOLEAN DEFAULT FALSE,
    config_schema TEXT,
    help_url TEXT,
    tags_json TEXT DEFAULT '[]',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 10. Tool Works
CREATE TABLE IF NOT EXISTS tool_works (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    tool_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    project_id TEXT,
    initiative_id TEXT,
    task_id TEXT,
    work_data TEXT NOT NULL DEFAULT '{}',
    status TEXT DEFAULT 'draft',
    progress INTEGER DEFAULT 0,
    shared_with TEXT DEFAULT '[]',
    created_by TEXT NOT NULL,
    last_edited_by TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 11. Interview Templates
CREATE TABLE IF NOT EXISTS interview_templates (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    status TEXT DEFAULT 'approved',
    visibility TEXT DEFAULT 'org',
    is_default BOOLEAN DEFAULT FALSE,
    version INTEGER DEFAULT 1,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 12. Interview Sessions
CREATE TABLE IF NOT EXISTS interview_sessions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    name TEXT DEFAULT 'Discovery Interview',
    owner_id TEXT NOT NULL,
    status TEXT DEFAULT 'in_progress',
    progress_json TEXT DEFAULT '{}',
    total_questions INTEGER DEFAULT 0,
    answered_questions INTEGER DEFAULT 0,
    summary_facts TEXT DEFAULT '[]',
    summary_gaps TEXT DEFAULT '[]',
    summary_constraints TEXT DEFAULT '[]',
    summary_pain_points TEXT DEFAULT '[]',
    template_id TEXT,
    template_version INTEGER DEFAULT 1,
    assignment_id TEXT,
    started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 13. Interview Questions
CREATE TABLE IF NOT EXISTS interview_questions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    category TEXT NOT NULL,
    question_text TEXT NOT NULL,
    answer_text TEXT,
    status TEXT DEFAULT 'not_started',
    confidence_score INTEGER DEFAULT 0,
    answered_by TEXT,
    answered_at TIMESTAMPTZ,
    tags TEXT DEFAULT '[]',
    sort_order INTEGER DEFAULT 0,
    is_template BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES interview_sessions(id) ON DELETE CASCADE
);

-- 14. Interview Assignments
CREATE TABLE IF NOT EXISTS interview_assignments (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    assignee_user_id TEXT NOT NULL,
    template_id TEXT NOT NULL,
    template_version INTEGER NOT NULL DEFAULT 1,
    process_ref TEXT,
    status TEXT NOT NULL DEFAULT 'assigned',
    session_id TEXT,
    task_id TEXT,
    due_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    sent_back_at TIMESTAMPTZ,
    sent_back_reason TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 15. Interview Insights
CREATE TABLE IF NOT EXISTS interview_insights (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    title TEXT NOT NULL,
    prompt_type TEXT NOT NULL DEFAULT 'summary',
    source_session_ids TEXT,
    filters TEXT,
    content TEXT,
    status TEXT DEFAULT 'generating',
    error_message TEXT,
    source_session_count INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    generation_time_ms INTEGER,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- 16. Interview Answers
CREATE TABLE IF NOT EXISTS interview_answers (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    category TEXT NOT NULL,
    question_answers TEXT DEFAULT '[]',
    summary TEXT,
    confidence_score REAL DEFAULT 0,
    status TEXT DEFAULT 'draft',
    messages_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 17. Interview Notes
CREATE TABLE IF NOT EXISTS interview_notes (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    category TEXT,
    title TEXT,
    content TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES interview_sessions(id) ON DELETE CASCADE
);

-- 18. Initiative Templates
CREATE TABLE IF NOT EXISTS initiative_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    applicable_axes TEXT,
    template_data TEXT NOT NULL DEFAULT '{}',
    is_public BOOLEAN DEFAULT FALSE,
    organization_id TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- 19. Initiative Resources
CREATE TABLE IF NOT EXISTS initiative_resources (
    id TEXT PRIMARY KEY,
    initiative_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    user_id TEXT,
    name TEXT DEFAULT '',
    role TEXT NOT NULL,
    allocation_percentage INTEGER DEFAULT 100,
    start_date DATE,
    end_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- 20. Initiative Budget Items
CREATE TABLE IF NOT EXISTS initiative_budget_items (
    id TEXT PRIMARY KEY,
    initiative_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    cost_type TEXT NOT NULL DEFAULT 'OPEX',
    amount REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'PLN',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- 21. Initiative Stakeholders
CREATE TABLE IF NOT EXISTS initiative_stakeholders (
    id TEXT PRIMARY KEY,
    initiative_id TEXT NOT NULL,
    user_id TEXT,
    external_name TEXT,
    external_email TEXT,
    role TEXT,
    raci_type TEXT CHECK(raci_type IN ('R', 'A', 'C', 'I')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE
);

-- 22. Initiative Benefits
CREATE TABLE IF NOT EXISTS initiative_benefits (
    id TEXT PRIMARY KEY,
    initiative_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    benefit_type TEXT DEFAULT 'quantitative',
    kpi_id TEXT,
    category TEXT,
    baseline_value REAL,
    baseline_date DATE,
    target_value REAL NOT NULL DEFAULT 0,
    target_date DATE,
    current_value REAL,
    progress_percentage REAL DEFAULT 0,
    status TEXT DEFAULT 'not_started',
    estimated_annual_value REAL,
    actual_annual_value REAL,
    currency TEXT DEFAULT 'USD',
    confidence_level TEXT DEFAULT 'medium',
    owner_id TEXT,
    owner_name TEXT,
    measurement_frequency TEXT DEFAULT 'monthly',
    last_measured_at TIMESTAMPTZ,
    next_measurement_due DATE,
    notes TEXT,
    risks TEXT,
    dependencies TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE
);

-- 23. RAID Items
CREATE TABLE IF NOT EXISTS raid_items (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    initiative_id TEXT,
    type TEXT NOT NULL CHECK(type IN ('RISK', 'ASSUMPTION', 'ISSUE', 'DEPENDENCY')),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'MITIGATED', 'REALIZED', 'CLOSED')),
    probability TEXT CHECK(probability IN ('LOW', 'MEDIUM', 'HIGH')),
    impact TEXT CHECK(impact IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    mitigation_plan TEXT,
    owner_id TEXT,
    due_date TEXT,
    linked_items TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE SET NULL
);

-- 24. Security Events
CREATE TABLE IF NOT EXISTS security_events (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    user_id TEXT,
    event_type TEXT NOT NULL,
    severity TEXT DEFAULT 'info',
    ip_address TEXT,
    user_agent TEXT,
    metadata TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 25. KPI Definitions
CREATE TABLE IF NOT EXISTS kpi_definitions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    unit_display TEXT,
    direction TEXT NOT NULL DEFAULT 'up',
    precision INTEGER DEFAULT 2,
    default_target REAL,
    default_baseline REAL,
    warning_threshold_percentage REAL DEFAULT 20,
    critical_threshold_percentage REAL DEFAULT 40,
    is_manual BOOLEAN DEFAULT TRUE,
    data_source_type TEXT,
    data_source_config TEXT,
    collection_frequency TEXT DEFAULT 'monthly',
    chart_type TEXT DEFAULT 'line',
    color TEXT,
    is_global BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 26. KPI Measurements
CREATE TABLE IF NOT EXISTS kpi_measurements (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    kpi_id TEXT NOT NULL,
    value REAL NOT NULL,
    measured_at TIMESTAMPTZ NOT NULL,
    notes TEXT,
    explanation TEXT,
    action_items TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (kpi_id) REFERENCES initiative_kpis(id) ON DELETE CASCADE
);

-- 27. Integration Providers (needed as FK target for integrations)
CREATE TABLE IF NOT EXISTS integration_providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    description TEXT,
    icon_url TEXT,
    auth_type TEXT NOT NULL DEFAULT 'oauth2',
    oauth_config TEXT DEFAULT '{}',
    webhook_config TEXT DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    is_beta BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 28. Integrations
CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    auth_type TEXT NOT NULL DEFAULT 'oauth2',
    access_token TEXT,
    refresh_token TEXT,
    api_key TEXT,
    token_expires_at TIMESTAMPTZ,
    external_account_id TEXT,
    external_account_name TEXT,
    external_workspace_id TEXT,
    external_workspace_name TEXT,
    settings TEXT DEFAULT '{}',
    notification_settings TEXT DEFAULT '{}',
    field_mappings TEXT DEFAULT '[]',
    sync_settings TEXT DEFAULT '{"direction":"bidirectional","frequency":"realtime"}',
    channel_mappings TEXT DEFAULT '[]',
    status TEXT DEFAULT 'active',
    last_sync_at TIMESTAMPTZ,
    last_error TEXT,
    last_error_at TIMESTAMPTZ,
    error_count INTEGER DEFAULT 0,
    consecutive_errors INTEGER DEFAULT 0,
    connected_by TEXT NOT NULL DEFAULT 'system',
    connected_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    disconnected_at TIMESTAMPTZ,
    disconnected_by TEXT,
    UNIQUE(organization_id, provider_id)
);

-- 29. Password Resets (needed for forgot-password flow)
CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 30. Interview Library Templates (needed for interview module)
CREATE TABLE IF NOT EXISTS interview_library_templates (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'general',
    area TEXT,
    tags TEXT DEFAULT '[]',
    questions_json TEXT DEFAULT '[]',
    is_system BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    version INTEGER DEFAULT 1,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 31. Interview Template Questions
CREATE TABLE IF NOT EXISTS interview_template_questions (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL,
    category TEXT NOT NULL,
    question_text TEXT NOT NULL,
    question_type TEXT DEFAULT 'open',
    is_required BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    helper_text TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES interview_templates(id) ON DELETE CASCADE
);

-- 32. Interview Library Template Questions
CREATE TABLE IF NOT EXISTS interview_library_template_questions (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    question_text TEXT NOT NULL,
    question_type TEXT DEFAULT 'open',
    is_required BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    helper_text TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES interview_library_templates(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_profiles_org ON organization_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_settings_org ON organization_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_context_org ON organization_context(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_branding_org ON organization_branding(organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_org ON payment_methods(organization_id);
CREATE INDEX IF NOT EXISTS idx_chat_projects_user ON chat_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_projects_org ON chat_projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_org ON interview_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_interview_questions_session ON interview_questions(session_id);
CREATE INDEX IF NOT EXISTS idx_interview_insights_org ON interview_insights(organization_id);
CREATE INDEX IF NOT EXISTS idx_initiative_resources_init ON initiative_resources(initiative_id);
CREATE INDEX IF NOT EXISTS idx_raid_items_org ON raid_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_security_events_org ON security_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_kpi_definitions_org ON kpi_definitions(organization_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);
