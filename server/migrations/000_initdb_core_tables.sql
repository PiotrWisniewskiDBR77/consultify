-- Migration: 000_initdb_core_tables.sql
-- Purpose: Create core tables from PostgresDatabase.ts initDb() function
-- Generated: 2025-01-XX
-- 
-- This migration extracts all CREATE TABLE statements from PostgresDatabase.ts
-- to ensure they exist even if initDb() hasn't run or failed.
-- 
-- Note: These tables use CREATE TABLE IF NOT EXISTS, so this migration is idempotent.
-- This should run BEFORE other migrations that depend on these tables.

-- Organizations Table
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT,
    plan TEXT DEFAULT 'free',
    status TEXT DEFAULT 'active',
    billing_status TEXT DEFAULT 'PENDING',
    organization_type TEXT DEFAULT 'TRIAL',
    token_balance INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP,
    discount_percent INTEGER DEFAULT 0,
    -- Budget tracking
    monthly_budget_usd REAL,
    budget_spent_current_period REAL DEFAULT 0,
    budget_alert_threshold REAL DEFAULT 0.8,
    budget_period_start TIMESTAMP,
    -- Resource usage tracking
    memory_usage_mb_current INTEGER DEFAULT 0,
    cpu_usage_percent_avg REAL DEFAULT 0,
    -- MFA enforcement settings (enterprise feature)
    mfa_required INTEGER DEFAULT 0,
    mfa_grace_period_days INTEGER DEFAULT 7,
    -- Trial Fields
    trial_started_at TIMESTAMP,
    trial_expires_at TIMESTAMP,
    trial_extension_count INTEGER DEFAULT 0,
    trial_warning_sent_at TIMESTAMP,
    trial_tokens_used INTEGER DEFAULT 0,
    -- Attribution
    attribution_data TEXT,
    -- Phase E: Onboarding Context
    transformation_context TEXT DEFAULT '{}',
    onboarding_status TEXT DEFAULT 'NOT_STARTED',
    onboarding_plan_snapshot TEXT,
    onboarding_plan_version INTEGER DEFAULT 0,
    onboarding_accepted_at TIMESTAMP,
    onboarding_accept_idempotency_key TEXT,
    -- AI Governance Fields
    ai_assertiveness_level TEXT DEFAULT 'MEDIUM',
    ai_autonomy_level TEXT DEFAULT 'SUGGEST_ONLY',
    created_by_user_id TEXT
);

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    email TEXT UNIQUE,
    password TEXT,
    first_name TEXT,
    last_name TEXT,
    role TEXT, 
    status TEXT DEFAULT 'active',
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    -- MFA columns
    mfa_enabled INTEGER DEFAULT 0,
    mfa_secret TEXT,
    mfa_backup_codes TEXT,
    mfa_verified_at TIMESTAMP,
    mfa_recovery_email TEXT,
    token_limit INTEGER DEFAULT 100000,
    token_used INTEGER DEFAULT 0,
    token_reset_at TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id)
);

-- Projects (must come before sessions, tasks, initiatives)
CREATE TABLE IF NOT EXISTS projects(
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    name TEXT,
    description TEXT,
    goal TEXT,
    status TEXT DEFAULT 'active',
    owner_id TEXT,
    initiative_count INTEGER DEFAULT 0,
    assessment_count INTEGER DEFAULT 0,
    member_count INTEGER DEFAULT 0,
    document_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Settings (no dependencies)
CREATE TABLE IF NOT EXISTS settings(
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions (references users and projects - must come after both)
CREATE TABLE IF NOT EXISTS sessions(
    id TEXT PRIMARY KEY,
    user_id TEXT,
    project_id TEXT,
    type TEXT,
    data TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(project_id) REFERENCES projects(id)
);

-- Knowledge Docs
CREATE TABLE IF NOT EXISTS knowledge_docs(
    id TEXT PRIMARY KEY,
    filename TEXT,
    filepath TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Knowledge Chunks
CREATE TABLE IF NOT EXISTS knowledge_chunks(
    id TEXT PRIMARY KEY,
    doc_id TEXT,
    content TEXT,
    chunk_index INTEGER,
    embedding TEXT,
    FOREIGN KEY(doc_id) REFERENCES knowledge_docs(id) ON DELETE CASCADE
);

-- LLM Providers
CREATE TABLE IF NOT EXISTS llm_providers(
    id TEXT PRIMARY KEY,
    name TEXT,
    provider TEXT,
    api_key TEXT,
    endpoint TEXT,
    model_id TEXT,
    cost_per_1k REAL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    is_default INTEGER DEFAULT 0,
    visibility TEXT DEFAULT 'admin'
);

-- Teams
CREATE TABLE IF NOT EXISTS teams(
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    lead_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(lead_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Team Members
CREATE TABLE IF NOT EXISTS team_members(
    team_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(team_id, user_id),
    FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Project Users
CREATE TABLE IF NOT EXISTS project_users(
    project_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT DEFAULT 'member',
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(project_id, user_id),
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Custom Statuses
CREATE TABLE IF NOT EXISTS custom_statuses(
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6B7280',
    sort_order INTEGER DEFAULT 0,
    is_default INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks(
    id TEXT PRIMARY KEY,
    project_id TEXT,
    organization_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'todo',
    priority TEXT DEFAULT 'medium',
    assignee_id TEXT,
    reporter_id TEXT,
    due_date TIMESTAMP,
    estimated_hours REAL,
    checklist TEXT,
    attachments TEXT,
    tags TEXT,
    custom_status_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    task_type TEXT DEFAULT 'execution',
    budget_allocated REAL DEFAULT 0,
    budget_spent REAL DEFAULT 0,
    risk_rating TEXT DEFAULT 'low',
    acceptance_criteria TEXT DEFAULT '',
    blocking_issues TEXT DEFAULT '',
    step_phase TEXT DEFAULT 'design',
    initiative_id TEXT,
    why TEXT DEFAULT '',
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(assignee_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(reporter_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(custom_status_id) REFERENCES custom_statuses(id) ON DELETE SET NULL
);

-- Task Comments
CREATE TABLE IF NOT EXISTS task_comments(
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Notifications (enhanced with organization_id, is_read, severity)
CREATE TABLE IF NOT EXISTS notifications(
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    body TEXT,
    data TEXT,
    read INTEGER DEFAULT 0,
    is_read BOOLEAN DEFAULT FALSE,
    severity TEXT DEFAULT 'normal',
    priority TEXT DEFAULT 'normal',
    icon TEXT,
    entity_type TEXT,
    entity_id TEXT,
    action_url TEXT,
    actor_id TEXT,
    actor_name TEXT,
    metadata TEXT DEFAULT '{}',
    read_at TIMESTAMP,
    is_dismissed BOOLEAN DEFAULT FALSE,
    dismissed_at TIMESTAMP,
    channels_sent TEXT DEFAULT '[]',
    email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMP,
    email_message_id TEXT,
    email_delivered BOOLEAN DEFAULT FALSE,
    email_opened BOOLEAN DEFAULT FALSE,
    email_opened_at TIMESTAMP,
    slack_sent BOOLEAN DEFAULT FALSE,
    slack_sent_at TIMESTAMP,
    slack_message_ts TEXT,
    group_key TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs(
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    entity_name TEXT,
    old_value TEXT,
    new_value TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- AI Feedback
CREATE TABLE IF NOT EXISTS ai_feedback(
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    user_id TEXT,
    context TEXT,
    prompt TEXT,
    response TEXT,
    helpful INTEGER,
    comment TEXT,
    rating INTEGER,
    correction TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Custom Prompts
CREATE TABLE IF NOT EXISTS custom_prompts(
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    context TEXT NOT NULL,
    template TEXT NOT NULL,
    variables TEXT,
    is_active INTEGER DEFAULT 1,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Webhooks
CREATE TABLE IF NOT EXISTS webhooks(
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    url TEXT NOT NULL,
    events TEXT NOT NULL,
    secret TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- AI Logs
CREATE TABLE IF NOT EXISTS ai_logs(
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT,
    model TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    latency_ms INTEGER,
    topic TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System Prompts
CREATE TABLE IF NOT EXISTS system_prompts(
    id TEXT PRIMARY KEY,
    key TEXT UNIQUE,
    content TEXT,
    description TEXT,
    updated_by TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Feedback
CREATE TABLE IF NOT EXISTS feedback(
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    screenshot TEXT,
    url TEXT,
    status TEXT DEFAULT 'new',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Revoked Tokens
CREATE TABLE IF NOT EXISTS revoked_tokens(
    jti TEXT PRIMARY KEY,
    user_id TEXT,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason TEXT DEFAULT 'logout',
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Invitations
CREATE TABLE IF NOT EXISTS invitations(
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'USER',
    token TEXT UNIQUE,
    token_hash TEXT UNIQUE,
    status TEXT DEFAULT 'pending',
    invited_by TEXT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP,
    invitation_type TEXT DEFAULT 'ORG',
    project_id TEXT,
    role_to_assign TEXT,
    accepted_by_user_id TEXT,
    metadata TEXT DEFAULT '{}',
    resend_count INTEGER DEFAULT 0,
    last_resent_at TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(invited_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Access Requests
CREATE TABLE IF NOT EXISTS access_requests(
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    organization_id TEXT,
    organization_name TEXT,
    requested_role TEXT DEFAULT 'USER',
    status TEXT DEFAULT 'pending',
    request_type TEXT DEFAULT 'new_user',
    metadata TEXT,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_by TEXT,
    reviewed_at TIMESTAMP,
    rejection_reason TEXT,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Access Codes
CREATE TABLE IF NOT EXISTS access_codes(
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    created_by TEXT NOT NULL,
    role TEXT DEFAULT 'USER',
    max_uses INTEGER DEFAULT 1,
    current_uses INTEGER DEFAULT 0,
    expires_at TIMESTAMP,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Access Code Usage
CREATE TABLE IF NOT EXISTS access_code_usage(
    id TEXT PRIMARY KEY,
    code_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(code_id) REFERENCES access_codes(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Initiatives
CREATE TABLE IF NOT EXISTS initiatives(
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    name TEXT NOT NULL,
    axis TEXT,
    area TEXT,
    summary TEXT,
    hypothesis TEXT,
    status TEXT DEFAULT 'step3',
    current_stage TEXT,
    business_value TEXT,
    competencies_required TEXT,
    cost_capex REAL,
    cost_opex REAL,
    expected_roi REAL,
    social_impact TEXT,
    start_date TIMESTAMP,
    pilot_end_date TIMESTAMP,
    end_date TIMESTAMP,
    owner_business_id TEXT,
    owner_execution_id TEXT,
    sponsor_id TEXT,
    market_context TEXT,
    problem_statement TEXT DEFAULT '',
    deliverables TEXT DEFAULT '[]',
    success_criteria TEXT DEFAULT '[]',
    scope_in TEXT DEFAULT '[]',
    scope_out TEXT DEFAULT '[]',
    key_risks TEXT DEFAULT '[]',
    report_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(owner_business_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(owner_execution_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(sponsor_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Task Dependencies
CREATE TABLE IF NOT EXISTS task_dependencies(
    id TEXT PRIMARY KEY,
    from_task_id TEXT NOT NULL,
    to_task_id TEXT NOT NULL,
    type TEXT DEFAULT 'hard',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(from_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY(to_task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Subscription Plans
CREATE TABLE IF NOT EXISTS subscription_plans(
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price_monthly REAL NOT NULL,
    price_yearly INTEGER,
    price_monthly_cents INTEGER,
    token_limit INTEGER,
    storage_limit_gb REAL,
    memory_limit_mb INTEGER,
    cpu_quota_percent REAL,
    max_concurrent_ai_jobs INTEGER,
    token_overage_rate REAL,
    storage_overage_rate REAL,
    stripe_price_id TEXT,
    stripe_price_id_monthly TEXT,
    stripe_price_id_yearly TEXT,
    features TEXT DEFAULT '[]',
    limits TEXT DEFAULT '{}',
    is_active INTEGER DEFAULT 1,
    is_public INTEGER DEFAULT 1,
    trial_days INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subscriptions (from 160_configuration_enhancements.sql)
CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    subscription_plan_id TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'paused')),
    billing_cycle TEXT DEFAULT 'monthly' CHECK(billing_cycle IN ('monthly', 'yearly')),
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    cancel_at_period_end INTEGER DEFAULT 0,
    canceled_at TIMESTAMP,
    trial_start TIMESTAMP,
    trial_end TIMESTAMP,
    stripe_subscription_id TEXT,
    stripe_customer_id TEXT,
    metadata TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id),
    FOREIGN KEY (subscription_plan_id) REFERENCES subscription_plans(id)
);

-- Organization Billing
CREATE TABLE IF NOT EXISTS organization_billing(
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,
    subscription_plan_id TEXT,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    billing_email TEXT,
    billing_address TEXT,
    payment_method_last4 TEXT,
    payment_method_brand TEXT,
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(subscription_plan_id) REFERENCES subscription_plans(id)
);

-- Usage Records
CREATE TABLE IF NOT EXISTS usage_records(
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT,
    type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    action TEXT,
    metadata TEXT,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Usage Summaries
CREATE TABLE IF NOT EXISTS usage_summaries(
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    tokens_included INTEGER DEFAULT 0,
    tokens_overage INTEGER DEFAULT 0,
    storage_bytes_peak INTEGER DEFAULT 0,
    storage_gb_included REAL DEFAULT 0,
    storage_gb_overage REAL DEFAULT 0,
    overage_amount REAL DEFAULT 0,
    billed INTEGER DEFAULT 0,
    stripe_invoice_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, period_start)
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices(
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    stripe_invoice_id TEXT UNIQUE,
    amount_due REAL,
    amount_paid REAL,
    currency TEXT DEFAULT 'usd',
    status TEXT,
    period_start DATE,
    period_end DATE,
    pdf_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Plan Features
CREATE TABLE IF NOT EXISTS plan_features(
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    feature_key TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    limit_value INTEGER,
    FOREIGN KEY(plan_id) REFERENCES subscription_plans(id) ON DELETE CASCADE
);

-- Billing Margins
CREATE TABLE IF NOT EXISTS billing_margins(
    id TEXT PRIMARY KEY,
    source_type TEXT NOT NULL UNIQUE,
    display_name TEXT,
    base_cost_per_1k REAL DEFAULT 0,
    margin_percent REAL NOT NULL,
    min_charge REAL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Token Packages
CREATE TABLE IF NOT EXISTS token_packages(
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    tokens INTEGER NOT NULL,
    price_usd REAL NOT NULL,
    stripe_price_id TEXT,
    bonus_percent INTEGER DEFAULT 0,
    is_popular INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Token Balance
CREATE TABLE IF NOT EXISTS user_token_balance(
    user_id TEXT PRIMARY KEY,
    platform_tokens INTEGER DEFAULT 0,
    platform_tokens_bonus INTEGER DEFAULT 0,
    byok_usage_tokens INTEGER DEFAULT 0,
    local_usage_tokens INTEGER DEFAULT 0,
    lifetime_purchased INTEGER DEFAULT 0,
    lifetime_used INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Token Transactions
CREATE TABLE IF NOT EXISTS token_transactions(
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT,
    type TEXT NOT NULL,
    source_type TEXT,
    tokens INTEGER NOT NULL,
    cost_usd REAL DEFAULT 0,
    margin_usd REAL DEFAULT 0,
    net_revenue_usd REAL DEFAULT 0,
    stripe_payment_id TEXT,
    package_id TEXT,
    llm_provider TEXT,
    model_used TEXT,
    description TEXT,
    metadata TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(package_id) REFERENCES token_packages(id) ON DELETE SET NULL
);

-- User API Keys
CREATE TABLE IF NOT EXISTS user_api_keys(
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    permissions TEXT DEFAULT '[]',
    rate_limit INTEGER DEFAULT 1000,
    is_active INTEGER DEFAULT 1,
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, name)
);

-- GDPR Requests
CREATE TABLE IF NOT EXISTS gdpr_requests(
    id VARCHAR(36) PRIMARY KEY,
    organization_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    result_url TEXT,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Consents
CREATE TABLE IF NOT EXISTS user_consents(
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id),
    consent_type VARCHAR(100) NOT NULL,
    consent_version VARCHAR(50),
    consent_status VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    granted_at TIMESTAMP,
    withdrawn_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, organization_id, consent_type)
);

-- AI Ideas Board
CREATE TABLE IF NOT EXISTS ai_ideas(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'new',
    priority VARCHAR(50) DEFAULT 'medium',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI System Observations
CREATE TABLE IF NOT EXISTS ai_observations(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    category VARCHAR(50),
    confidence_score REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Approval Assignments
CREATE TABLE IF NOT EXISTS approval_assignments(
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    proposal_id TEXT NOT NULL,
    assigned_to_user_id TEXT NOT NULL,
    requested_by_user_id TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    sla_due_at TIMESTAMP NOT NULL,
    escalated_to_user_id TEXT,
    escalated_at TIMESTAMP,
    escalation_reason TEXT,
    acked_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(org_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(assigned_to_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(escalated_to_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- MFA Attempts
CREATE TABLE IF NOT EXISTS mfa_attempts(
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    attempt_type TEXT NOT NULL CHECK(attempt_type IN('TOTP', 'BACKUP_CODE', 'SMS', 'EMAIL')),
    success INTEGER NOT NULL DEFAULT 0,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Trusted Devices
CREATE TABLE IF NOT EXISTS trusted_devices(
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    device_fingerprint TEXT NOT NULL,
    device_name TEXT,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, device_fingerprint)
);

-- Refresh Tokens
CREATE TABLE IF NOT EXISTS refresh_tokens(
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    token_family TEXT,
    device_info TEXT,
    ip_address TEXT,
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    revoked_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Scheduled Emails
CREATE TABLE IF NOT EXISTS scheduled_emails(
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    recipients TEXT NOT NULL,
    scheduled_time TIMESTAMP NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING', 'SENT', 'FAILED')),
    sent_at TIMESTAMP,
    error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- CRITICAL TABLES FROM OTHER MIGRATIONS
-- These are required by DatabaseInitializer
-- ============================================

-- SuperAdmin AI Settings
CREATE TABLE IF NOT EXISTS superadmin_ai_settings (
    id TEXT PRIMARY KEY DEFAULT 'global',
    default_provider TEXT,
    fallback_chain TEXT DEFAULT '[]',
    circuit_breaker_config TEXT DEFAULT '{"failureThreshold": 5, "cooldownSeconds": 60}',
    global_token_limit INTEGER DEFAULT 10000000,
    global_rate_limit TEXT DEFAULT '{"requestsPerMinute": 60, "requestsPerHour": 1000}',
    max_context_window_size INTEGER DEFAULT 128000,
    max_tokens_per_request INTEGER DEFAULT 8192,
    pii_detection_sensitivity TEXT DEFAULT 'medium' CHECK (pii_detection_sensitivity IN ('low', 'medium', 'high')),
    require_encryption INTEGER DEFAULT 1,
    data_residency TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT
);

-- Organization AI Settings
CREATE TABLE IF NOT EXISTS organization_ai_settings (
    organization_id TEXT PRIMARY KEY,
    policy_level TEXT DEFAULT 'ADVISORY' CHECK (policy_level IN ('ADVISORY', 'ASSISTED', 'PROACTIVE', 'AUTOPILOT')),
    max_policy_level TEXT DEFAULT 'ASSISTED' CHECK (max_policy_level IN ('ADVISORY', 'ASSISTED', 'PROACTIVE', 'AUTOPILOT')),
    default_proactivity_mode TEXT DEFAULT 'BALANCED' CHECK (default_proactivity_mode IN ('REACTIVE', 'BALANCED', 'PROACTIVE')),
    active_roles TEXT DEFAULT '["ADVISOR"]',
    default_role TEXT DEFAULT 'ADVISOR',
    enabled_model_ids TEXT DEFAULT '[]',
    max_ai_calls_per_day INTEGER DEFAULT 100,
    max_tokens_per_month INTEGER DEFAULT 500000,
    monthly_budget_usd REAL DEFAULT 0,
    hard_limit_usd REAL DEFAULT 0,
    freeze_on_limit INTEGER DEFAULT 0,
    web_search_enabled INTEGER DEFAULT 1,
    artifacts_enabled INTEGER DEFAULT 1,
    thinking_steps_enabled INTEGER DEFAULT 1,
    focus_modes_enabled INTEGER DEFAULT 1,
    voice_enabled INTEGER DEFAULT 0,
    audit_all_requests INTEGER DEFAULT 0,
    audit_policy_changes INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- User AI Settings
CREATE TABLE IF NOT EXISTS user_ai_settings (
    user_id TEXT PRIMARY KEY,
    response_style TEXT DEFAULT 'balanced' CHECK (response_style IN ('concise', 'balanced', 'detailed')),
    writing_tone TEXT DEFAULT 'professional' CHECK (writing_tone IN ('professional', 'casual', 'technical', 'friendly')),
    preferred_language TEXT DEFAULT 'auto',
    code_explanations INTEGER DEFAULT 1,
    show_sources INTEGER DEFAULT 1,
    proactivity_mode TEXT DEFAULT 'BALANCED' CHECK (proactivity_mode IN ('REACTIVE', 'BALANCED', 'PROACTIVE')),
    model_temperature REAL DEFAULT 0.7 CHECK (model_temperature >= 0 AND model_temperature <= 2),
    max_tokens INTEGER DEFAULT 4096,
    top_p REAL DEFAULT 1.0 CHECK (top_p >= 0 AND top_p <= 1),
    frequency_penalty REAL DEFAULT 0.0 CHECK (frequency_penalty >= -2 AND frequency_penalty <= 2),
    presence_penalty REAL DEFAULT 0.0 CHECK (presence_penalty >= -2 AND presence_penalty <= 2),
    system_instructions TEXT DEFAULT '',
    visible_model_ids TEXT DEFAULT '[]',
    preferred_model_id TEXT DEFAULT NULL,
    enable_pii_redaction INTEGER DEFAULT 0,
    data_retention_policy TEXT DEFAULT 'standard' CHECK (data_retention_policy IN ('minimal', 'standard', 'extended')),
    share_usage_analytics INTEGER DEFAULT 1,
    context_retention TEXT DEFAULT 'session' CHECK (context_retention IN ('session', 'day', 'week', 'month', 'permanent')),
    auto_suggestions INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- AI Policies (stub - will be expanded by other migrations)
CREATE TABLE IF NOT EXISTS ai_policies (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    name TEXT NOT NULL,
    policy_type TEXT,
    config TEXT DEFAULT '{}',
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Maturity Assessments (stub - will be expanded by other migrations)
CREATE TABLE IF NOT EXISTS maturity_assessments (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

-- Payment Methods
CREATE TABLE IF NOT EXISTS payment_methods (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    stripe_payment_method_id TEXT NOT NULL,
    type TEXT DEFAULT 'card',
    brand TEXT,
    last4 TEXT,
    exp_month INTEGER,
    exp_year INTEGER,
    holder_name TEXT,
    is_default INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Spending Alerts (stub)
CREATE TABLE IF NOT EXISTS spending_alerts (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    alert_type TEXT,
    threshold REAL,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Organization Seats (stub)
CREATE TABLE IF NOT EXISTS organization_seats (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT,
    seat_type TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Organization Limits (stub)
CREATE TABLE IF NOT EXISTS organization_limits (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,
    limit_type TEXT,
    limit_value INTEGER,
    current_usage INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- AI Project Memory (stub)
CREATE TABLE IF NOT EXISTS ai_project_memory (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    memory_key TEXT NOT NULL,
    memory_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- AI Organization Memory (stub)
CREATE TABLE IF NOT EXISTS ai_organization_memory (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    memory_key TEXT NOT NULL,
    memory_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Usage Counters (stub)
CREATE TABLE IF NOT EXISTS usage_counters (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    counter_type TEXT NOT NULL,
    count_value INTEGER DEFAULT 0,
    period_start TIMESTAMP,
    period_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- AI Partial Responses (stub)
CREATE TABLE IF NOT EXISTS ai_partial_responses (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    organization_id TEXT,
    response_chunk TEXT,
    chunk_index INTEGER,
    is_complete INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Circuit Breaker State (stub)
CREATE TABLE IF NOT EXISTS circuit_breaker_state (
    id TEXT PRIMARY KEY,
    breaker_key TEXT NOT NULL UNIQUE,
    state TEXT DEFAULT 'closed' CHECK (state IN ('closed', 'open', 'half_open')),
    failure_count INTEGER DEFAULT 0,
    last_failure_at TIMESTAMP,
    opened_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin Sessions (stub)
CREATE TABLE IF NOT EXISTS admin_sessions (
    id TEXT PRIMARY KEY,
    admin_user_id TEXT NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Permissions
CREATE TABLE IF NOT EXISTS permissions (
    key TEXT PRIMARY KEY,
    description TEXT,
    category TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin Approval Workflows (stub)
CREATE TABLE IF NOT EXISTS admin_approval_workflows (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    workflow_type TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Admin Approval Requests (stub)
CREATE TABLE IF NOT EXISTS admin_approval_requests (
    id TEXT PRIMARY KEY,
    workflow_id TEXT,
    requester_id TEXT,
    approver_id TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Admin Dashboards (stub)
CREATE TABLE IF NOT EXISTS admin_dashboards (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    dashboard_name TEXT NOT NULL,
    config TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Admin Saved Reports (stub)
CREATE TABLE IF NOT EXISTS admin_saved_reports (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    report_name TEXT NOT NULL,
    report_type TEXT,
    config TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Admin Report Executions (stub)
CREATE TABLE IF NOT EXISTS admin_report_executions (
    id TEXT PRIMARY KEY,
    report_id TEXT,
    executed_by TEXT,
    status TEXT DEFAULT 'pending',
    executed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (executed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- System Feedback
CREATE TABLE IF NOT EXISTS system_feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    organization_id TEXT,
    feedback_type TEXT,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'new',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Megatrends
CREATE TABLE IF NOT EXISTS megatrends (
    id TEXT PRIMARY KEY,
    industry TEXT NOT NULL,
    type TEXT NOT NULL,
    label TEXT NOT NULL,
    description TEXT,
    base_impact_score INTEGER NOT NULL,
    initial_ring TEXT NOT NULL
);

-- Custom Trends
CREATE TABLE IF NOT EXISTS custom_trends (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    industry TEXT NOT NULL,
    type TEXT NOT NULL,
    label TEXT NOT NULL,
    description TEXT,
    ring TEXT NOT NULL,
    FOREIGN KEY (company_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Maturity Scores (stub)
CREATE TABLE IF NOT EXISTS maturity_scores (
    id TEXT PRIMARY KEY,
    assessment_id TEXT,
    dimension TEXT,
    score REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Client Context (stub)
CREATE TABLE IF NOT EXISTS client_context (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    context_key TEXT NOT NULL,
    context_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Webhook Deliveries (stub)
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id TEXT PRIMARY KEY,
    webhook_id TEXT,
    url TEXT NOT NULL,
    payload TEXT,
    status TEXT DEFAULT 'pending',
    response_code INTEGER,
    attempted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Integration Sync Logs (stub)
CREATE TABLE IF NOT EXISTS integration_sync_logs (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    integration_type TEXT,
    sync_status TEXT,
    records_synced INTEGER DEFAULT 0,
    sync_started_at TIMESTAMP,
    sync_completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- System Metrics (stub)
CREATE TABLE IF NOT EXISTS system_metrics (
    id TEXT PRIMARY KEY,
    metric_name TEXT NOT NULL,
    metric_value REAL,
    metric_unit TEXT,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Compliance Records (stub)
CREATE TABLE IF NOT EXISTS compliance_records (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    compliance_type TEXT,
    status TEXT,
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Backup Records (stub)
CREATE TABLE IF NOT EXISTS backup_records (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    backup_type TEXT,
    backup_status TEXT,
    backup_size_bytes INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Reports (stub)
CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    project_id TEXT,
    report_type TEXT NOT NULL,
    report_name TEXT,
    config TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

-- Report Blocks (stub)
CREATE TABLE IF NOT EXISTS report_blocks (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    block_type TEXT,
    block_order INTEGER,
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
);

-- Report Snapshots (stub)
CREATE TABLE IF NOT EXISTS report_snapshots (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    snapshot_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
);

-- Multi Framework Assessments
CREATE TABLE IF NOT EXISTS multi_framework_assessments (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    framework TEXT NOT NULL CHECK (framework IN ('DRD', 'SIRI', 'ADMA', 'CMMI', 'LEAN')),
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED')),
    framework_data TEXT DEFAULT '{}',
    import_source TEXT DEFAULT '{}',
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    completed_dimensions TEXT DEFAULT '[]',
    total_dimensions INTEGER DEFAULT 0,
    workflow_status TEXT DEFAULT 'DRAFT',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL,
    last_modified_by TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (last_modified_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Help Events (stub)
CREATE TABLE IF NOT EXISTS help_events (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    event_type TEXT,
    event_data TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Organization Events (stub)
CREATE TABLE IF NOT EXISTS organization_events (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_data TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- AI Experiments (stub)
CREATE TABLE IF NOT EXISTS ai_experiments (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    experiment_name TEXT NOT NULL,
    experiment_config TEXT DEFAULT '{}',
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- AI Experiment Variants (stub)
CREATE TABLE IF NOT EXISTS ai_experiment_variants (
    id TEXT PRIMARY KEY,
    experiment_id TEXT NOT NULL,
    variant_name TEXT,
    variant_config TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (experiment_id) REFERENCES ai_experiments(id) ON DELETE CASCADE
);

-- System Config (stub)
CREATE TABLE IF NOT EXISTS system_config (
    id TEXT PRIMARY KEY,
    config_key TEXT UNIQUE NOT NULL,
    config_value TEXT,
    config_type TEXT DEFAULT 'string',
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Sessions (from 101_security_sessions.sql)
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_jti TEXT UNIQUE,
    device_info TEXT,
    ip_address TEXT,
    user_agent TEXT,
    location TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    is_current INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Login History (from 101_security_sessions.sql, 080_user_settings_extended.sql)
CREATE TABLE IF NOT EXISTS login_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    location TEXT,
    status TEXT DEFAULT 'success',
    failure_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);

-- API Keys (from 044_api_keys.sql)
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    user_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    key_hash TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    key_type TEXT DEFAULT 'org' CHECK(key_type IN ('org', 'user', 'service')),
    scopes TEXT NOT NULL DEFAULT '[]',
    rate_limit_per_minute INTEGER DEFAULT 60,
    rate_limit_per_day INTEGER DEFAULT 10000,
    allowed_ips TEXT,
    last_used_at TIMESTAMP,
    usage_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP,
    is_active INTEGER DEFAULT 1,
    revoked_at TIMESTAMP,
    revoked_by TEXT,
    revoke_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (revoked_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- API Key Usage (from 044_api_keys.sql)
CREATE TABLE IF NOT EXISTS api_key_usage (
    id TEXT PRIMARY KEY,
    api_key_id TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    ip_address TEXT,
    user_agent TEXT,
    requests_remaining INTEGER,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE
);

-- Help Analytics (from 070_help_feedback.sql)
CREATE TABLE IF NOT EXISTS help_analytics (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    organization_id TEXT,
    session_id TEXT,
    event_type TEXT NOT NULL CHECK (event_type IN ('view', 'search', 'click', 'complete', 'video_progress', 'tour_step', 'tour_complete', 'feedback_submit')),
    content_type TEXT CHECK (content_type IN ('module', 'card', 'faq', 'video', 'tour', 'search')),
    content_id TEXT,
    metadata TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);

-- Compliance Settings (stub - will be expanded by other migrations)
CREATE TABLE IF NOT EXISTS compliance_settings (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,
    compliance_type TEXT,
    settings TEXT DEFAULT '{}',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Organization Data Retention (stub)
CREATE TABLE IF NOT EXISTS organization_data_retention (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    data_type TEXT NOT NULL,
    retention_days INTEGER,
    auto_delete INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Partner Portal Tables (stubs - from 215_partner_portal.sql, 216_partner_referral_system.sql)
-- Note: The actual table is "partner_organizations" but some migrations reference "partner"
CREATE TABLE IF NOT EXISTS partner_organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    legal_name TEXT,
    tax_id TEXT,
    contact_email TEXT NOT NULL,
    contact_phone TEXT,
    website TEXT,
    logo_url TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    postal_code TEXT,
    country TEXT,
    tier TEXT DEFAULT 'registered' CHECK (tier IN ('registered', 'certified', 'premier', 'elite')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'inactive')),
    partner_since TIMESTAMP,
    contract_start_date DATE,
    contract_end_date DATE,
    license_discount_percent REAL DEFAULT 0.00,
    commission_rate_percent REAL DEFAULT 10.00,
    performance_score INTEGER DEFAULT 0,
    public_listing_enabled INTEGER DEFAULT 0,
    entity_type TEXT DEFAULT 'COMPANY',
    program_type TEXT DEFAULT 'SOLUTION',
    referral_code TEXT UNIQUE,
    referral_link_slug TEXT UNIQUE,
    payout_threshold REAL DEFAULT 100.00,
    payout_method TEXT DEFAULT 'BANK_TRANSFER',
    verified_at TIMESTAMP,
    individual_user_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    updated_by TEXT
);

-- Alias table "partner" for compatibility (some migrations reference it)
CREATE TABLE IF NOT EXISTS partner (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    partner_code TEXT UNIQUE,
    partner_name TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS partner_campaign_links (
    id TEXT PRIMARY KEY,
    partner_id TEXT,
    campaign_code TEXT NOT NULL,
    link_url TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS partner_referral_clicks (
    id TEXT PRIMARY KEY,
    partner_id TEXT,
    campaign_link_id TEXT,
    referrer_url TEXT,
    ip_address TEXT,
    user_agent TEXT,
    clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS partner_commission_transactions (
    id TEXT PRIMARY KEY,
    partner_id TEXT,
    organization_id TEXT,
    transaction_type TEXT,
    amount REAL,
    commission_rate REAL,
    commission_amount REAL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS partner_payouts (
    id TEXT PRIMARY KEY,
    partner_id TEXT,
    payout_amount REAL,
    payout_status TEXT DEFAULT 'pending',
    payout_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Revenue Module Tables (from 234_revenue_module_complete.sql)
-- Subscription Changes
CREATE TABLE IF NOT EXISTS subscription_changes (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    subscription_id TEXT,
    change_type TEXT NOT NULL CHECK(change_type IN ('upgrade', 'downgrade', 'cancel', 'reactivate', 'new')),
    from_plan_id TEXT,
    to_plan_id TEXT,
    proration_amount INTEGER DEFAULT 0,
    proration_type TEXT CHECK(proration_type IN ('credit', 'charge', 'none')),
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    effective_date TIMESTAMP,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled')),
    processed_at TIMESTAMP,
    processed_by TEXT,
    admin_notes TEXT,
    rejection_reason TEXT,
    customer_reason TEXT,
    reason TEXT,
    requested_by TEXT,
    approved_by TEXT,
    approved_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
    FOREIGN KEY (from_plan_id) REFERENCES subscription_plans(id) ON DELETE SET NULL,
    FOREIGN KEY (to_plan_id) REFERENCES subscription_plans(id) ON DELETE SET NULL,
    FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Subscription Events
CREATE TABLE IF NOT EXISTS subscription_events (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    subscription_id TEXT,
    event_type TEXT NOT NULL CHECK(event_type IN (
        'created', 'activated', 'trial_started', 'trial_ended',
        'upgraded', 'downgraded', 'renewed', 'canceled', 'expired',
        'paused', 'resumed', 'reactivated', 'payment_failed', 'payment_succeeded',
        'new', 'expansion', 'contraction', 'churn', 'reactivation',
        'subscription_created', 'subscription_updated', 'subscription_canceled',
        'subscription_paused', 'subscription_resumed', 'subscription_expired',
        'plan_upgraded', 'plan_downgraded', 'trial_converted',
        'payment_succeeded', 'payment_refunded', 'invoice_created', 'invoice_paid',
        'credit_applied', 'discount_applied', 'seat_added', 'seat_removed'
    )),
    from_plan_id TEXT,
    to_plan_id TEXT,
    mrr_delta REAL DEFAULT 0,
    mrr_change INTEGER DEFAULT 0,
    previous_mrr REAL DEFAULT 0,
    from_mrr INTEGER DEFAULT 0,
    new_mrr REAL DEFAULT 0,
    to_mrr INTEGER DEFAULT 0,
    amount INTEGER,
    currency TEXT DEFAULT 'USD',
    trigger TEXT CHECK(trigger IN ('user', 'admin', 'system', 'stripe_webhook', 'dunning', 'scheduled')),
    triggered_by TEXT,
    invoice_id TEXT,
    payment_id TEXT,
    discount_code_id TEXT,
    reason TEXT,
    metadata TEXT DEFAULT '{}',
    occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    event_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL
);

-- Payment Failures
CREATE TABLE IF NOT EXISTS payment_failures (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    subscription_id TEXT,
    invoice_id TEXT,
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'USD',
    failure_code TEXT,
    failure_message TEXT,
    decline_code TEXT,
    payment_method_id TEXT,
    payment_method_type TEXT,
    payment_method_last4 TEXT,
    recovery_status TEXT DEFAULT 'pending' CHECK(recovery_status IN ('pending', 'retrying', 'recovered', 'failed', 'resolved')),
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    last_retry_at TIMESTAMP,
    next_retry_at TIMESTAMP,
    resolution_type TEXT CHECK(resolution_type IN ('auto_recovered', 'manual', 'payment_updated', 'written_off', 'refunded')),
    resolved_at TIMESTAMP,
    resolved_by TEXT,
    failed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    recovered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL
);

-- Revenue Recognition
CREATE TABLE IF NOT EXISTS revenue_recognition (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    contract_id TEXT,
    contract_name TEXT,
    invoice_id TEXT,
    total_amount INTEGER NOT NULL,
    recognized_amount INTEGER DEFAULT 0,
    remaining_amount INTEGER,
    currency TEXT DEFAULT 'USD',
    recognition_method TEXT DEFAULT 'straight_line' CHECK(recognition_method IN ('straight_line', 'milestone', 'percentage_completion', 'point_in_time', 'usage_based')),
    recognition_schedule TEXT DEFAULT '[]',
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'on_hold')),
    start_date DATE,
    end_date DATE,
    recognition_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Revenue Forecasts
CREATE TABLE IF NOT EXISTS revenue_forecasts (
    id TEXT PRIMARY KEY,
    forecast_type TEXT NOT NULL CHECK(forecast_type IN ('mrr', 'arr', 'revenue', 'churn', 'ltv')),
    scenario TEXT DEFAULT 'base' CHECK(scenario IN ('base', 'optimistic', 'pessimistic', 'custom')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    forecast_date DATE,
    forecasted_amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'USD',
    confidence_level REAL DEFAULT 0.75,
    method TEXT DEFAULT 'linear' CHECK(method IN ('linear', 'exponential', 'moving_average', 'arima', 'ml_based')),
    input_data TEXT DEFAULT '{}',
    model_parameters TEXT DEFAULT '{}',
    actual_amount INTEGER,
    accuracy REAL,
    status TEXT DEFAULT 'active' CHECK(status IN ('draft', 'active', 'expired', 'archived')),
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MRR Snapshots
CREATE TABLE IF NOT EXISTS mrr_snapshots (
    id TEXT PRIMARY KEY,
    snapshot_date DATE NOT NULL UNIQUE,
    total_mrr REAL DEFAULT 0,
    mrr INTEGER DEFAULT 0,
    new_mrr REAL DEFAULT 0,
    expansion_mrr REAL DEFAULT 0,
    contraction_mrr REAL DEFAULT 0,
    churned_mrr REAL DEFAULT 0,
    churn_mrr REAL DEFAULT 0,
    reactivation_mrr REAL DEFAULT 0,
    total_customers INTEGER DEFAULT 0,
    active_subscriptions INTEGER DEFAULT 0,
    new_customers INTEGER DEFAULT 0,
    new_subscriptions INTEGER DEFAULT 0,
    churned_customers INTEGER DEFAULT 0,
    churned_subscriptions INTEGER DEFAULT 0,
    growth_rate REAL DEFAULT 0,
    by_plan TEXT DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI Usage Logs (from 208_ai_usage_logs.sql)
CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    user_id TEXT,
    session_id TEXT,
    model TEXT,
    provider TEXT,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    latency_ms INTEGER,
    endpoint TEXT,
    status_code INTEGER,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Decisions (from 245_project_enhancements.sql)
CREATE TABLE IF NOT EXISTS decisions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    initiative_id TEXT,
    task_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL,
    decision_maker_id TEXT NOT NULL,
    decision_owner_id TEXT,
    options TEXT DEFAULT '[]',
    criteria TEXT,
    deadline TIMESTAMP,
    escalation_deadline TIMESTAMP,
    status TEXT DEFAULT 'pending',
    selected_option TEXT,
    decision_rationale TEXT,
    decided_at TIMESTAMP,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY(initiative_id) REFERENCES initiatives(id) ON DELETE SET NULL,
    FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE SET NULL,
    FOREIGN KEY(decision_maker_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Email Templates
CREATE TABLE IF NOT EXISTS email_templates (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    template_key TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    subject TEXT NOT NULL,
    html_content TEXT NOT NULL,
    text_content TEXT,
    available_variables TEXT DEFAULT '[]',
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(organization_id, template_key)
);

-- Content Categories (must come before ai_playbook_templates due to FK)
CREATE TABLE IF NOT EXISTS content_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    content_type TEXT NOT NULL DEFAULT 'ALL',
    parent_id TEXT,
    sort_order INTEGER DEFAULT 0,
    color TEXT DEFAULT '#6366F1',
    icon TEXT DEFAULT 'folder',
    organization_id TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    FOREIGN KEY(parent_id) REFERENCES content_categories(id) ON DELETE SET NULL,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- AI Playbook Templates
CREATE TABLE IF NOT EXISTS ai_playbook_templates (
    id TEXT PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    trigger_signal TEXT,
    template_graph TEXT,
    estimated_duration_mins INTEGER,
    status TEXT DEFAULT 'DRAFT',
    version INTEGER DEFAULT 1,
    category_id TEXT,
    organization_id TEXT,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP,
    avg_execution_time_mins INTEGER,
    success_rate REAL,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    FOREIGN KEY(category_id) REFERENCES content_categories(id) ON DELETE SET NULL,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Content Tags
CREATE TABLE IF NOT EXISTS content_tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'ALL',
    color TEXT DEFAULT '#10B981',
    organization_id TEXT,
    usage_count INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Automation Rules
CREATE TABLE IF NOT EXISTS automation_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL,
    trigger_config TEXT DEFAULT '{}',
    action_type TEXT NOT NULL,
    action_config TEXT DEFAULT '{}',
    is_active INTEGER DEFAULT 1,
    executions_count INTEGER DEFAULT 0,
    last_executed_at TIMESTAMP,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Organization Facilities (must come before facility_users)
CREATE TABLE IF NOT EXISTS organization_facilities (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    parent_facility_id TEXT,
    level INTEGER DEFAULT 0,
    address TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'closed')),
    is_headquarters INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(parent_facility_id) REFERENCES organization_facilities(id) ON DELETE SET NULL
);

-- Facility Users
CREATE TABLE IF NOT EXISTS facility_users (
    facility_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    assignment_type TEXT DEFAULT 'primary' CHECK(assignment_type IN ('primary', 'secondary', 'temporary')),
    role TEXT DEFAULT 'member' CHECK(role IN ('manager', 'lead', 'member', 'viewer')),
    can_view_all_tasks INTEGER DEFAULT 0,
    can_manage_users INTEGER DEFAULT 0,
    can_edit_facility INTEGER DEFAULT 0,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by TEXT,
    valid_until TIMESTAMP,
    notes TEXT,
    PRIMARY KEY(facility_id, user_id),
    FOREIGN KEY(facility_id) REFERENCES organization_facilities(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(assigned_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Management Reports
CREATE TABLE IF NOT EXISTS management_reports (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    report_type TEXT NOT NULL CHECK (report_type IN ('TEAM_MEETING', 'STEERING_COMMITTEE')),
    scope TEXT NOT NULL DEFAULT 'PROJECT' CHECK (scope IN ('PROJECT', 'PORTFOLIO')),
    title TEXT NOT NULL,
    period_start DATE,
    period_end DATE,
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'FINAL', 'ARCHIVED')),
    generated_by TEXT NOT NULL,
    content TEXT, -- JSON stored as TEXT for PostgreSQL compatibility
    ai_narrative TEXT,
    ai_warnings TEXT, -- JSON stored as TEXT
    pdf_path TEXT,
    pptx_path TEXT,
    share_token TEXT UNIQUE,
    share_expires_at TIMESTAMP,
    pmo_domain TEXT DEFAULT 'PERFORMANCE_MONITORING',
    iso21500_mapping TEXT DEFAULT 'Project Performance Measurement (Clause 4.4.22)',
    pmbok_mapping TEXT DEFAULT 'Measurement Performance Domain',
    prince2_mapping TEXT DEFAULT 'Highlight Report / Progress Theme',
    current_version INTEGER DEFAULT 1,
    approval_status TEXT DEFAULT 'NONE',
    requires_approval INTEGER DEFAULT 0,
    approval_config TEXT, -- JSON stored as TEXT
    locked_at TIMESTAMP,
    locked_by TEXT,
    finalized_at TIMESTAMP,
    finalized_by TEXT,
    integrity_hash TEXT,
    previous_report_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY(generated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Management Report Versions
CREATE TABLE IF NOT EXISTS management_report_versions (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    version_label TEXT,
    content TEXT NOT NULL, -- JSON stored as TEXT
    ai_narrative TEXT,
    ai_warnings TEXT, -- JSON stored as TEXT
    change_summary TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(report_id) REFERENCES management_reports(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Management Report Approvals
CREATE TABLE IF NOT EXISTS management_report_approvals (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    version_id TEXT,
    approval_level INTEGER DEFAULT 1,
    required_role TEXT NOT NULL,
    assigned_to TEXT,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED')),
    decision_comment TEXT,
    decided_at TIMESTAMP,
    decided_by TEXT,
    sla_due_at TIMESTAMP,
    reminder_sent_at TIMESTAMP,
    escalated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(report_id) REFERENCES management_reports(id) ON DELETE CASCADE,
    FOREIGN KEY(version_id) REFERENCES management_report_versions(id) ON DELETE SET NULL,
    FOREIGN KEY(assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(decided_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Management Report Comments
CREATE TABLE IF NOT EXISTS management_report_comments (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    version_id TEXT,
    section_id TEXT,
    parent_comment_id TEXT,
    content TEXT NOT NULL,
    mentions TEXT, -- JSON stored as TEXT
    is_resolved INTEGER DEFAULT 0,
    resolved_by TEXT,
    resolved_at TIMESTAMP,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(report_id) REFERENCES management_reports(id) ON DELETE CASCADE,
    FOREIGN KEY(version_id) REFERENCES management_report_versions(id) ON DELETE SET NULL,
    FOREIGN KEY(parent_comment_id) REFERENCES management_report_comments(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(resolved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Management Report Audit Log
CREATE TABLE IF NOT EXISTS management_report_audit_log (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    version_id TEXT,
    action TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    actor_name TEXT,
    actor_email TEXT,
    details TEXT, -- JSON stored as TEXT
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(report_id) REFERENCES management_reports(id) ON DELETE CASCADE,
    FOREIGN KEY(version_id) REFERENCES management_report_versions(id) ON DELETE SET NULL
);

-- Management Report Recipients
CREATE TABLE IF NOT EXISTS management_report_recipients (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    user_id TEXT,
    email TEXT,
    sent_at TIMESTAMP,
    opened_at TIMESTAMP,
    viewed_at TIMESTAMP,
    view_count INTEGER DEFAULT 0,
    last_viewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(report_id) REFERENCES management_reports(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Assessments (base table - referenced by assessment_reports)
CREATE TABLE IF NOT EXISTS assessments (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    project_id TEXT,
    type TEXT,
    name TEXT,
    status TEXT DEFAULT 'draft',
    framework TEXT DEFAULT 'DRD',
    overall_score REAL,
    maturity_level INTEGER,
    source_type TEXT DEFAULT 'manual',
    source_reference TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    report_generated_at TIMESTAMP,
    initiatives_generated INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Assessment Reports
CREATE TABLE IF NOT EXISTS assessment_reports (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL UNIQUE,
    organization_id TEXT NOT NULL,
    executive_summary TEXT,
    detailed_analysis TEXT, -- JSON stored as TEXT
    recommendations TEXT, -- JSON stored as TEXT
    benchmark_data TEXT, -- JSON stored as TEXT
    generated_by TEXT DEFAULT 'ai',
    generation_params TEXT, -- JSON stored as TEXT
    public_link_id TEXT,
    public_link_expires_at TIMESTAMP,
    public_link_password TEXT,
    last_export_format TEXT,
    last_export_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Report Comments
CREATE TABLE IF NOT EXISTS report_comments (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    section_id TEXT,
    section_type TEXT,
    user_id TEXT NOT NULL,
    user_name TEXT,
    comment_type TEXT DEFAULT 'FEEDBACK' CHECK(comment_type IN ('FEEDBACK', 'SUGGESTION', 'QUESTION', 'APPROVAL', 'REJECTION')),
    content TEXT NOT NULL,
    ai_response TEXT,
    ai_suggested_edits TEXT, -- JSON stored as TEXT
    ai_processed_at TIMESTAMP,
    status TEXT DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED')),
    resolved_by TEXT,
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    parent_comment_id TEXT,
    thread_position INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(report_id) REFERENCES assessment_reports(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(resolved_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(parent_comment_id) REFERENCES report_comments(id) ON DELETE CASCADE
);

-- Report Edit History
CREATE TABLE IF NOT EXISTS report_edit_history (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    section_id TEXT NOT NULL,
    edit_type TEXT DEFAULT 'MANUAL' CHECK(edit_type IN ('MANUAL', 'AI_GENERATED', 'AI_REGENERATED', 'COMMENT_BASED')),
    editor_id TEXT NOT NULL,
    editor_name TEXT,
    previous_content TEXT, -- JSON stored as TEXT
    new_content TEXT, -- JSON stored as TEXT
    change_summary TEXT,
    related_comment_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(report_id) REFERENCES assessment_reports(id) ON DELETE CASCADE,
    FOREIGN KEY(editor_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(related_comment_id) REFERENCES report_comments(id) ON DELETE SET NULL
);

-- Add missing columns to existing tables
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS token_jti TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_token_unique ON user_sessions(token_jti);
ALTER TABLE login_history ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE system_feedback ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE system_feedback ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE system_feedback ADD COLUMN IF NOT EXISTS rating INTEGER;
ALTER TABLE system_feedback ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';
ALTER TABLE system_feedback ADD COLUMN IF NOT EXISTS metadata TEXT;
ALTER TABLE system_feedback ADD COLUMN IF NOT EXISTS admin_response TEXT;
ALTER TABLE system_feedback ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE system_feedback ADD COLUMN IF NOT EXISTS responded_at TIMESTAMP;
ALTER TABLE system_feedback ADD COLUMN IF NOT EXISTS responded_by TEXT;
ALTER TABLE system_feedback ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- Create indexes (wrapped in DO blocks to handle missing columns gracefully)
DO $$
BEGIN
    -- Users indexes
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'organization_id') THEN
        CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
        CREATE INDEX IF NOT EXISTS idx_users_org_status ON users(organization_id, status);
    END IF;
    
    -- Sessions indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sessions') THEN
        CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    END IF;
    
    -- Revoked tokens indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'revoked_tokens') THEN
        CREATE INDEX IF NOT EXISTS idx_revoked_tokens_user ON revoked_tokens(user_id);
    END IF;
    
    -- Teams indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teams') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_teams_org ON teams(organization_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'lead_id') THEN
            CREATE INDEX IF NOT EXISTS idx_teams_lead ON teams(lead_id);
        END IF;
    END IF;
    
    -- Invitations indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invitations') THEN
        CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
        CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invitations' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_invitations_org_status ON invitations(organization_id, status);
        END IF;
    END IF;
    
    -- Access requests indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'access_requests') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'access_requests' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_access_requests_org ON access_requests(organization_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'access_requests' AND column_name = 'reviewed_by') THEN
            CREATE INDEX IF NOT EXISTS idx_access_requests_reviewer ON access_requests(reviewed_by);
        END IF;
    END IF;
    
    -- Access codes indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'access_codes') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'access_codes' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_access_codes_org ON access_codes(organization_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'access_codes' AND column_name = 'created_by') THEN
            CREATE INDEX IF NOT EXISTS idx_access_codes_creator ON access_codes(created_by);
        END IF;
    END IF;
    
    -- Access code usage indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'access_code_usage') THEN
        CREATE INDEX IF NOT EXISTS idx_access_code_usage_code ON access_code_usage(code_id);
        CREATE INDEX IF NOT EXISTS idx_access_code_usage_user ON access_code_usage(user_id);
    END IF;
    
    -- Tasks indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_tasks_org ON tasks(organization_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_org_status ON tasks(organization_id, status);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'assignee_id') THEN
            CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_assignee_status ON tasks(assignee_id, status);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'reporter_id') THEN
            CREATE INDEX IF NOT EXISTS idx_tasks_reporter ON tasks(reporter_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'custom_status_id') THEN
            CREATE INDEX IF NOT EXISTS idx_tasks_custom_status ON tasks(custom_status_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'initiative_id') THEN
            CREATE INDEX IF NOT EXISTS idx_tasks_initiative ON tasks(initiative_id);
        END IF;
    END IF;
    
    -- Task comments indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_comments') THEN
        CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);
        CREATE INDEX IF NOT EXISTS idx_task_comments_user ON task_comments(user_id);
    END IF;
    
    -- Notifications indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
        CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications(organization_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'read') THEN
            CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read, created_at DESC);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'is_read') THEN
            CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'severity') THEN
            CREATE INDEX IF NOT EXISTS idx_notifications_user_severity ON notifications(user_id, severity, created_at);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'type') THEN
            CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
        END IF;
    END IF;
    
    -- Activity logs indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activity_logs') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_logs' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_activity_logs_org ON activity_logs(organization_id);
            CREATE INDEX IF NOT EXISTS idx_activity_logs_org_time ON activity_logs(organization_id, created_at DESC);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_logs' AND column_name = 'user_id') THEN
            CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
        END IF;
    END IF;
    
    -- Feedback indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'feedback') THEN
        CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id);
    END IF;
    
    -- AI feedback indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_feedback') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_feedback' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_ai_feedback_org ON ai_feedback(organization_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_feedback' AND column_name = 'user_id') THEN
            CREATE INDEX IF NOT EXISTS idx_ai_feedback_user ON ai_feedback(user_id);
        END IF;
    END IF;
    
    -- Custom prompts indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'custom_prompts') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'custom_prompts' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_custom_prompts_org ON custom_prompts(organization_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'custom_prompts' AND column_name = 'created_by') THEN
            CREATE INDEX IF NOT EXISTS idx_custom_prompts_creator ON custom_prompts(created_by);
        END IF;
    END IF;
    
    -- Webhooks indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'webhooks') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'webhooks' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_webhooks_org ON webhooks(organization_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'webhooks' AND column_name = 'created_by') THEN
            CREATE INDEX IF NOT EXISTS idx_webhooks_creator ON webhooks(created_by);
        END IF;
    END IF;
    
    -- Projects indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projects') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(organization_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'owner_id') THEN
            CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
        END IF;
    END IF;
    
    -- Subscriptions indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscriptions') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON subscriptions(organization_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'status') THEN
            CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
        END IF;
    END IF;
    
    -- Initiatives indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'initiatives') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'initiatives' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_initiatives_org ON initiatives(organization_id);
        END IF;
    END IF;
    
    -- Knowledge chunks indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'knowledge_chunks') THEN
        CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc ON knowledge_chunks(doc_id);
    END IF;
    
    -- Usage records indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'usage_records') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usage_records' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_usage_records_org_time ON usage_records(organization_id, recorded_at);
        END IF;
    END IF;
    
    -- GDPR requests indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gdpr_requests') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gdpr_requests' AND column_name = 'user_id') THEN
            CREATE INDEX IF NOT EXISTS idx_gdpr_requests_user ON gdpr_requests(user_id);
        END IF;
    END IF;
    
    -- User consents indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_consents') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_consents' AND column_name = 'user_id') THEN
            CREATE INDEX IF NOT EXISTS idx_user_consents_user ON user_consents(user_id);
        END IF;
    END IF;
    
    -- Approval assignments indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'approval_assignments') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'approval_assignments' AND column_name = 'org_id') THEN
            CREATE INDEX IF NOT EXISTS idx_approval_assignments_org ON approval_assignments(org_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'approval_assignments' AND column_name = 'assigned_to_user_id') THEN
            CREATE INDEX IF NOT EXISTS idx_approval_assignments_user ON approval_assignments(assigned_to_user_id, status);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'approval_assignments' AND column_name = 'proposal_id') THEN
            CREATE INDEX IF NOT EXISTS idx_approval_assignments_proposal ON approval_assignments(proposal_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'approval_assignments' AND column_name = 'sla_due_at') THEN
            CREATE INDEX IF NOT EXISTS idx_approval_assignments_sla ON approval_assignments(sla_due_at, status);
        END IF;
    END IF;
    
    -- MFA attempts indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mfa_attempts') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mfa_attempts' AND column_name = 'user_id') THEN
            CREATE INDEX IF NOT EXISTS idx_mfa_attempts_user_time ON mfa_attempts(user_id, created_at DESC);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mfa_attempts' AND column_name = 'ip_address') THEN
            CREATE INDEX IF NOT EXISTS idx_mfa_attempts_ip ON mfa_attempts(ip_address, created_at DESC);
        END IF;
    END IF;
    
    -- Trusted devices indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trusted_devices') THEN
        CREATE INDEX IF NOT EXISTS idx_trusted_devices_user ON trusted_devices(user_id);
        CREATE INDEX IF NOT EXISTS idx_trusted_devices_fingerprint ON trusted_devices(device_fingerprint);
    END IF;
    
    -- Refresh tokens indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'refresh_tokens') THEN
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refresh_tokens' AND column_name = 'token_family') THEN
            CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(token_family);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refresh_tokens' AND column_name = 'expires_at') THEN
            CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
        END IF;
    END IF;
    
    -- Scheduled emails indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scheduled_emails') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_emails' AND column_name = 'status') THEN
            CREATE INDEX IF NOT EXISTS idx_scheduled_emails_status_time ON scheduled_emails(status, scheduled_time);
        END IF;
        CREATE INDEX IF NOT EXISTS idx_scheduled_emails_report ON scheduled_emails(report_id);
    END IF;
    
    -- AI Settings indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organization_ai_settings') THEN
        CREATE INDEX IF NOT EXISTS idx_org_ai_settings_org ON organization_ai_settings(organization_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_ai_settings') THEN
        CREATE INDEX IF NOT EXISTS idx_user_ai_settings_user ON user_ai_settings(user_id);
    END IF;
    
    -- AI Policies indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_policies') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_policies' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_ai_policies_org ON ai_policies(organization_id);
        END IF;
    END IF;
    
    -- Maturity Assessments indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'maturity_assessments') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maturity_assessments' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_maturity_assessments_org ON maturity_assessments(organization_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maturity_assessments' AND column_name = 'project_id') THEN
            CREATE INDEX IF NOT EXISTS idx_maturity_assessments_project ON maturity_assessments(project_id);
        END IF;
    END IF;
    
    -- Payment Methods indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_methods') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_methods' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_payment_methods_org ON payment_methods(organization_id);
        END IF;
    END IF;
    
    -- Spending Alerts indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'spending_alerts') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'spending_alerts' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_spending_alerts_org ON spending_alerts(organization_id);
        END IF;
    END IF;
    
    -- Organization Seats indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organization_seats') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_seats' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_org_seats_org ON organization_seats(organization_id);
        END IF;
    END IF;
    
    -- Organization Limits indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organization_limits') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_limits' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_org_limits_org ON organization_limits(organization_id);
        END IF;
    END IF;
    
    -- AI Memory indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_project_memory') THEN
        CREATE INDEX IF NOT EXISTS idx_ai_project_memory_project ON ai_project_memory(project_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_organization_memory') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_organization_memory' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_ai_org_memory_org ON ai_organization_memory(organization_id);
        END IF;
    END IF;
    
    -- Usage Counters indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'usage_counters') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usage_counters' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_usage_counters_org ON usage_counters(organization_id);
        END IF;
    END IF;
    
    -- AI Partial Responses indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_partial_responses') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_partial_responses' AND column_name = 'user_id') THEN
            CREATE INDEX IF NOT EXISTS idx_ai_partial_responses_user ON ai_partial_responses(user_id);
        END IF;
    END IF;
    
    -- Circuit Breaker State indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'circuit_breaker_state') THEN
        CREATE INDEX IF NOT EXISTS idx_circuit_breaker_key ON circuit_breaker_state(breaker_key);
    END IF;
    
    -- Admin Sessions indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_sessions') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_sessions' AND column_name = 'admin_user_id') THEN
            CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON admin_sessions(admin_user_id);
        END IF;
        CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token);
    END IF;
    
    -- Admin Approval indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_approval_workflows') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_approval_workflows' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_admin_workflows_org ON admin_approval_workflows(organization_id);
        END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_approval_requests') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_approval_requests' AND column_name = 'requester_id') THEN
            CREATE INDEX IF NOT EXISTS idx_admin_requests_requester ON admin_approval_requests(requester_id);
        END IF;
    END IF;
    
    -- Admin Dashboards indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_dashboards') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_dashboards' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_admin_dashboards_org ON admin_dashboards(organization_id);
        END IF;
    END IF;
    
    -- Admin Reports indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_saved_reports') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_saved_reports' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_admin_saved_reports_org ON admin_saved_reports(organization_id);
        END IF;
    END IF;
    
    -- System Feedback indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_feedback') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_feedback' AND column_name = 'user_id') THEN
            CREATE INDEX IF NOT EXISTS idx_system_feedback_user ON system_feedback(user_id);
        END IF;
    END IF;
    
    -- Megatrends indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'megatrends') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'megatrends' AND column_name = 'industry') THEN
            CREATE INDEX IF NOT EXISTS idx_megatrends_industry ON megatrends(industry);
        END IF;
    END IF;
    
    -- Custom Trends indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'custom_trends') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'custom_trends' AND column_name = 'company_id') THEN
            CREATE INDEX IF NOT EXISTS idx_custom_trends_company ON custom_trends(company_id);
        END IF;
    END IF;
    
    -- Maturity Scores indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'maturity_scores') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maturity_scores' AND column_name = 'assessment_id') THEN
            CREATE INDEX IF NOT EXISTS idx_maturity_scores_assessment ON maturity_scores(assessment_id);
        END IF;
    END IF;
    
    -- Client Context indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_context') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_context' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_client_context_org ON client_context(organization_id);
        END IF;
    END IF;
    
    -- Webhook Deliveries indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'webhook_deliveries') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'webhook_deliveries' AND column_name = 'webhook_id') THEN
            CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
        END IF;
    END IF;
    
    -- Integration Sync Logs indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integration_sync_logs') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'integration_sync_logs' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_org ON integration_sync_logs(organization_id);
        END IF;
    END IF;
    
    -- System Metrics indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_metrics') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_metrics' AND column_name = 'metric_name') THEN
            CREATE INDEX IF NOT EXISTS idx_system_metrics_name ON system_metrics(metric_name);
        END IF;
    END IF;
    
    -- Compliance Records indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'compliance_records') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'compliance_records' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_compliance_records_org ON compliance_records(organization_id);
        END IF;
    END IF;
    
    -- Backup Records indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'backup_records') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'backup_records' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_backup_records_org ON backup_records(organization_id);
        END IF;
    END IF;
    
    -- Reports indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reports') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reports' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_reports_org ON reports(organization_id);
        END IF;
    END IF;
    
    -- Report Blocks indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'report_blocks') THEN
        CREATE INDEX IF NOT EXISTS idx_report_blocks_report ON report_blocks(report_id);
    END IF;
    
    -- Report Snapshots indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'report_snapshots') THEN
        CREATE INDEX IF NOT EXISTS idx_report_snapshots_report ON report_snapshots(report_id);
    END IF;
    
    -- Multi Framework Assessments indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'multi_framework_assessments') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'multi_framework_assessments' AND column_name = 'project_id') THEN
            CREATE INDEX IF NOT EXISTS idx_mfa_project ON multi_framework_assessments(project_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'multi_framework_assessments' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_mfa_organization ON multi_framework_assessments(organization_id);
        END IF;
    END IF;
    
    -- Help Events indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'help_events') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'help_events' AND column_name = 'user_id') THEN
            CREATE INDEX IF NOT EXISTS idx_help_events_user ON help_events(user_id);
        END IF;
    END IF;
    
    -- Organization Events indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organization_events') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_events' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_org_events_org ON organization_events(organization_id);
        END IF;
    END IF;
    
    -- AI Experiments indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_experiments') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_experiments' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_ai_experiments_org ON ai_experiments(organization_id);
        END IF;
    END IF;
    
    -- AI Experiment Variants indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_experiment_variants') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_experiment_variants' AND column_name = 'experiment_id') THEN
            CREATE INDEX IF NOT EXISTS idx_ai_experiment_variants_exp ON ai_experiment_variants(experiment_id);
        END IF;
    END IF;
    
    -- System Config indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_config') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_config' AND column_name = 'config_key') THEN
            CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(config_key);
        END IF;
    END IF;
    
    -- User Sessions indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_sessions') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_sessions' AND column_name = 'user_id') THEN
            CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_sessions' AND column_name = 'token_jti') THEN
            CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token_jti);
        END IF;
    END IF;
    
    -- Login History indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'login_history') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'login_history' AND column_name = 'user_id') THEN
            CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'login_history' AND column_name = 'status') THEN
            CREATE INDEX IF NOT EXISTS idx_login_history_status ON login_history(status, created_at);
        END IF;
    END IF;
    
    -- API Keys indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_keys') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_keys' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(organization_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_keys' AND column_name = 'user_id') THEN
            CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_keys' AND column_name = 'key_prefix') THEN
            CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
        END IF;
    END IF;
    
    -- API Key Usage indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_key_usage') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_key_usage' AND column_name = 'api_key_id') THEN
            CREATE INDEX IF NOT EXISTS idx_api_key_usage_key ON api_key_usage(api_key_id);
        END IF;
    END IF;
    
    -- Help Analytics indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'help_analytics') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'help_analytics' AND column_name = 'event_type') THEN
            CREATE INDEX IF NOT EXISTS idx_help_analytics_event ON help_analytics(event_type);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'help_analytics' AND column_name = 'user_id') THEN
            CREATE INDEX IF NOT EXISTS idx_help_analytics_user ON help_analytics(user_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'help_analytics' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_help_analytics_org ON help_analytics(organization_id);
        END IF;
    END IF;
    
    -- Compliance Settings indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'compliance_settings') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'compliance_settings' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_compliance_settings_org ON compliance_settings(organization_id);
        END IF;
    END IF;
    
    -- Organization Data Retention indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organization_data_retention') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_data_retention' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_org_data_retention_org ON organization_data_retention(organization_id);
        END IF;
    END IF;
    
    -- Partner Portal indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partner') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partner' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_partner_org ON partner(organization_id);
        END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partner_campaign_links') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partner_campaign_links' AND column_name = 'partner_id') THEN
            CREATE INDEX IF NOT EXISTS idx_partner_campaign_links_partner ON partner_campaign_links(partner_id);
        END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partner_referral_clicks') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partner_referral_clicks' AND column_name = 'partner_id') THEN
            CREATE INDEX IF NOT EXISTS idx_partner_referral_clicks_partner ON partner_referral_clicks(partner_id);
        END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partner_commission_transactions') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partner_commission_transactions' AND column_name = 'partner_id') THEN
            CREATE INDEX IF NOT EXISTS idx_partner_commissions_partner ON partner_commission_transactions(partner_id);
        END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partner_payouts') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partner_payouts' AND column_name = 'partner_id') THEN
            CREATE INDEX IF NOT EXISTS idx_partner_payouts_partner ON partner_payouts(partner_id);
        END IF;
    END IF;
    
    -- Decisions indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'decisions') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'decisions' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_decisions_org ON decisions(organization_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'decisions' AND column_name = 'project_id') THEN
            CREATE INDEX IF NOT EXISTS idx_decisions_project ON decisions(project_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'decisions' AND column_name = 'decision_maker_id') THEN
            CREATE INDEX IF NOT EXISTS idx_decisions_maker ON decisions(decision_maker_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'decisions' AND column_name = 'decision_owner_id') THEN
            CREATE INDEX IF NOT EXISTS idx_decisions_owner ON decisions(decision_owner_id, status);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'decisions' AND column_name = 'status') THEN
            CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status);
        END IF;
    END IF;
    
    -- Subscription Changes indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscription_changes') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_changes' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_subscription_changes_org ON subscription_changes(organization_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_changes' AND column_name = 'status') THEN
            CREATE INDEX IF NOT EXISTS idx_subscription_changes_status ON subscription_changes(status);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_changes' AND column_name = 'change_type') THEN
            CREATE INDEX IF NOT EXISTS idx_subscription_changes_type ON subscription_changes(change_type);
        END IF;
    END IF;
    
    -- Subscription Events indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscription_events') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_events' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_subscription_events_org ON subscription_events(organization_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_events' AND column_name = 'event_type') THEN
            CREATE INDEX IF NOT EXISTS idx_subscription_events_type ON subscription_events(event_type);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_events' AND column_name = 'event_at') THEN
            CREATE INDEX IF NOT EXISTS idx_subscription_events_date ON subscription_events(event_at);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_events' AND column_name = 'occurred_at') THEN
            CREATE INDEX IF NOT EXISTS idx_subscription_events_occurred ON subscription_events(occurred_at);
        END IF;
    END IF;
    
    -- Payment Failures indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_failures') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_failures' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_payment_failures_org ON payment_failures(organization_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_failures' AND column_name = 'recovery_status') THEN
            CREATE INDEX IF NOT EXISTS idx_payment_failures_status ON payment_failures(recovery_status);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_failures' AND column_name = 'failed_at') THEN
            CREATE INDEX IF NOT EXISTS idx_payment_failures_date ON payment_failures(failed_at);
        END IF;
    END IF;
    
    -- Revenue Recognition indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'revenue_recognition') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenue_recognition' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_revenue_recognition_org ON revenue_recognition(organization_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenue_recognition' AND column_name = 'recognition_date') THEN
            CREATE INDEX IF NOT EXISTS idx_revenue_recognition_date ON revenue_recognition(recognition_date);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenue_recognition' AND column_name = 'invoice_id') THEN
            CREATE INDEX IF NOT EXISTS idx_revenue_recognition_invoice ON revenue_recognition(invoice_id);
        END IF;
    END IF;
    
    -- Revenue Forecasts indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'revenue_forecasts') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenue_forecasts' AND column_name = 'forecast_type') THEN
            CREATE INDEX IF NOT EXISTS idx_revenue_forecasts_type ON revenue_forecasts(forecast_type);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenue_forecasts' AND column_name = 'forecast_date') THEN
            CREATE INDEX IF NOT EXISTS idx_revenue_forecasts_date ON revenue_forecasts(forecast_date);
        END IF;
    END IF;
    
    -- MRR Snapshots indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mrr_snapshots') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mrr_snapshots' AND column_name = 'snapshot_date') THEN
            CREATE INDEX IF NOT EXISTS idx_mrr_snapshots_date ON mrr_snapshots(snapshot_date);
        END IF;
    END IF;
    
    -- AI Usage Logs indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_usage_logs') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_usage_logs' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_org ON ai_usage_logs(organization_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_usage_logs' AND column_name = 'user_id') THEN
            CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user ON ai_usage_logs(user_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_usage_logs' AND column_name = 'created_at') THEN
            CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created ON ai_usage_logs(created_at);
        END IF;
    END IF;
    
    -- Email Templates indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_templates') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_templates' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_email_templates_org ON email_templates(organization_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_templates' AND column_name = 'template_key') THEN
            CREATE INDEX IF NOT EXISTS idx_email_templates_key ON email_templates(template_key);
        END IF;
    END IF;
    
    -- AI Playbook Templates indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_playbook_templates') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_playbook_templates' AND column_name = 'key') THEN
            CREATE INDEX IF NOT EXISTS idx_ai_playbook_templates_key ON ai_playbook_templates(key);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_playbook_templates' AND column_name = 'status') THEN
            CREATE INDEX IF NOT EXISTS idx_ai_playbook_templates_status ON ai_playbook_templates(status);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_playbook_templates' AND column_name = 'category_id') THEN
            CREATE INDEX IF NOT EXISTS idx_ai_playbook_templates_category ON ai_playbook_templates(category_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_playbook_templates' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_ai_playbook_templates_org ON ai_playbook_templates(organization_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_playbook_templates' AND column_name = 'usage_count') THEN
            CREATE INDEX IF NOT EXISTS idx_ai_playbook_templates_usage ON ai_playbook_templates(usage_count DESC);
        END IF;
    END IF;
    
    -- Content Categories indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'content_categories') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_categories' AND column_name = 'slug') THEN
            CREATE UNIQUE INDEX IF NOT EXISTS idx_content_categories_slug ON content_categories(slug, organization_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_categories' AND column_name = 'content_type') THEN
            CREATE INDEX IF NOT EXISTS idx_content_categories_type ON content_categories(content_type);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_categories' AND column_name = 'parent_id') THEN
            CREATE INDEX IF NOT EXISTS idx_content_categories_parent ON content_categories(parent_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_categories' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_content_categories_org ON content_categories(organization_id);
        END IF;
    END IF;
    
    -- Content Tags indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'content_tags') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_tags' AND column_name = 'slug') THEN
            CREATE UNIQUE INDEX IF NOT EXISTS idx_content_tags_slug ON content_tags(slug, organization_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_tags' AND column_name = 'content_type') THEN
            CREATE INDEX IF NOT EXISTS idx_content_tags_type ON content_tags(content_type);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_tags' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_content_tags_org ON content_tags(organization_id);
        END IF;
    END IF;
    
    -- Automation Rules indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'automation_rules') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'automation_rules' AND column_name = 'is_active') THEN
            CREATE INDEX IF NOT EXISTS idx_automation_rules_active ON automation_rules(is_active);
        END IF;
    END IF;
    
    -- Organization Facilities indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organization_facilities') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_facilities' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_facilities_org ON organization_facilities(organization_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_facilities' AND column_name = 'parent_facility_id') THEN
            CREATE INDEX IF NOT EXISTS idx_facilities_parent ON organization_facilities(parent_facility_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_facilities' AND column_name = 'status') THEN
            CREATE INDEX IF NOT EXISTS idx_facilities_status ON organization_facilities(status);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_facilities' AND column_name = 'code') THEN
            CREATE INDEX IF NOT EXISTS idx_facilities_code ON organization_facilities(code);
        END IF;
    END IF;
    
    -- Facility Users indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'facility_users') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'facility_users' AND column_name = 'user_id') THEN
            CREATE INDEX IF NOT EXISTS idx_facility_users_user ON facility_users(user_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'facility_users' AND column_name = 'assignment_type') THEN
            CREATE INDEX IF NOT EXISTS idx_facility_users_type ON facility_users(assignment_type);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'facility_users' AND column_name = 'role') THEN
            CREATE INDEX IF NOT EXISTS idx_facility_users_role ON facility_users(role);
        END IF;
    END IF;
    
    -- Management Reports indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'management_reports') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'management_reports' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_mr_organization ON management_reports(organization_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'management_reports' AND column_name = 'project_id') THEN
            CREATE INDEX IF NOT EXISTS idx_mr_project ON management_reports(project_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'management_reports' AND column_name = 'report_type') THEN
            CREATE INDEX IF NOT EXISTS idx_mr_type ON management_reports(report_type);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'management_reports' AND column_name = 'status') THEN
            CREATE INDEX IF NOT EXISTS idx_mr_status ON management_reports(status);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'management_reports' AND column_name = 'created_at') THEN
            CREATE INDEX IF NOT EXISTS idx_mr_created ON management_reports(created_at DESC);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'management_reports' AND column_name = 'share_token') THEN
            CREATE INDEX IF NOT EXISTS idx_mr_share_token ON management_reports(share_token);
        END IF;
    END IF;
    
    -- Management Report Versions indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'management_report_versions') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'management_report_versions' AND column_name = 'report_id') THEN
            CREATE INDEX IF NOT EXISTS idx_mrv_report ON management_report_versions(report_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'management_report_versions' AND column_name = 'version_number') THEN
            CREATE INDEX IF NOT EXISTS idx_mrv_version ON management_report_versions(report_id, version_number);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'management_report_versions' AND column_name = 'created_at') THEN
            CREATE INDEX IF NOT EXISTS idx_mrv_created ON management_report_versions(created_at DESC);
        END IF;
    END IF;
    
    -- Management Report Approvals indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'management_report_approvals') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'management_report_approvals' AND column_name = 'report_id') THEN
            CREATE INDEX IF NOT EXISTS idx_mra_report ON management_report_approvals(report_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'management_report_approvals' AND column_name = 'status') THEN
            CREATE INDEX IF NOT EXISTS idx_mra_status ON management_report_approvals(status);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'management_report_approvals' AND column_name = 'assigned_to') THEN
            CREATE INDEX IF NOT EXISTS idx_mra_assigned ON management_report_approvals(assigned_to, status);
        END IF;
    END IF;
    
    -- Management Report Comments indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'management_report_comments') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'management_report_comments' AND column_name = 'report_id') THEN
            CREATE INDEX IF NOT EXISTS idx_mrc_report ON management_report_comments(report_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'management_report_comments' AND column_name = 'section_id') THEN
            CREATE INDEX IF NOT EXISTS idx_mrc_section ON management_report_comments(report_id, section_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'management_report_comments' AND column_name = 'parent_comment_id') THEN
            CREATE INDEX IF NOT EXISTS idx_mrc_parent ON management_report_comments(parent_comment_id);
        END IF;
    END IF;
    
    -- Management Report Audit Log indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'management_report_audit_log') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'management_report_audit_log' AND column_name = 'report_id') THEN
            CREATE INDEX IF NOT EXISTS idx_mral_report ON management_report_audit_log(report_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'management_report_audit_log' AND column_name = 'action') THEN
            CREATE INDEX IF NOT EXISTS idx_mral_action ON management_report_audit_log(action);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'management_report_audit_log' AND column_name = 'created_at') THEN
            CREATE INDEX IF NOT EXISTS idx_mral_created ON management_report_audit_log(created_at DESC);
        END IF;
    END IF;
    
    -- Management Report Recipients indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'management_report_recipients') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'management_report_recipients' AND column_name = 'report_id') THEN
            CREATE INDEX IF NOT EXISTS idx_mrr_report ON management_report_recipients(report_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'management_report_recipients' AND column_name = 'user_id') THEN
            CREATE INDEX IF NOT EXISTS idx_mrr_user ON management_report_recipients(user_id);
        END IF;
    END IF;
    
    -- Assessments indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assessments') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assessments' AND column_name = 'organization_id') THEN
            CREATE INDEX IF NOT EXISTS idx_assessments_org ON assessments(organization_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assessments' AND column_name = 'project_id') THEN
            CREATE INDEX IF NOT EXISTS idx_assessments_project ON assessments(project_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assessments' AND column_name = 'framework') THEN
            CREATE INDEX IF NOT EXISTS idx_assessments_framework ON assessments(framework);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assessments' AND column_name = 'status') THEN
            CREATE INDEX IF NOT EXISTS idx_assessments_status ON assessments(status);
        END IF;
    END IF;
    
    -- Assessment Reports indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assessment_reports') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assessment_reports' AND column_name = 'assessment_id') THEN
            CREATE INDEX IF NOT EXISTS idx_assessment_reports_assessment ON assessment_reports(assessment_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assessment_reports' AND column_name = 'public_link_id') THEN
            CREATE INDEX IF NOT EXISTS idx_assessment_reports_public ON assessment_reports(public_link_id);
        END IF;
    END IF;
    
    -- Report Comments indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'report_comments') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_comments' AND column_name = 'report_id') THEN
            CREATE INDEX IF NOT EXISTS idx_report_comments_report ON report_comments(report_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_comments' AND column_name = 'section_id') THEN
            CREATE INDEX IF NOT EXISTS idx_report_comments_section ON report_comments(report_id, section_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_comments' AND column_name = 'user_id') THEN
            CREATE INDEX IF NOT EXISTS idx_report_comments_user ON report_comments(user_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_comments' AND column_name = 'status') THEN
            CREATE INDEX IF NOT EXISTS idx_report_comments_status ON report_comments(status);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_comments' AND column_name = 'parent_comment_id') THEN
            CREATE INDEX IF NOT EXISTS idx_report_comments_thread ON report_comments(parent_comment_id);
        END IF;
    END IF;
    
    -- Report Edit History indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'report_edit_history') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_edit_history' AND column_name = 'report_id') THEN
            CREATE INDEX IF NOT EXISTS idx_report_edit_history_report ON report_edit_history(report_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_edit_history' AND column_name = 'section_id') THEN
            CREATE INDEX IF NOT EXISTS idx_report_edit_history_section ON report_edit_history(report_id, section_id);
        END IF;
    END IF;
    
    -- System Feedback type index
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_feedback') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_feedback' AND column_name = 'type') THEN
            CREATE INDEX IF NOT EXISTS idx_system_feedback_type ON system_feedback(type);
        END IF;
    END IF;
END $$;
