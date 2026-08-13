-- Migration 900: Create all 56 missing tables in production
-- Hotfix: 2026-04-13
-- These tables were listed in CRITICAL_TABLES but never created because
-- the Postgres migration runner skips files with version < 500.
-- All statements are idempotent (CREATE TABLE IF NOT EXISTS).

-- ====== AI Settings (from 000_initdb_core_tables.sql) ======

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

-- FRESH-DB PARITY (2026-07-14): 20260227_01_ai_governance.sql sorts BEFORE this
-- file on a fresh replay, so its guarded context_policy_json add is skipped.
-- Re-add it here idempotently (no-op wherever it exists).
ALTER TABLE organization_ai_settings ADD COLUMN IF NOT EXISTS context_policy_json TEXT;

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

-- ====== Billing / Spending (from 000_initdb_core_tables.sql) ======

CREATE TABLE IF NOT EXISTS spending_alerts (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    alert_type TEXT,
    threshold REAL,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

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

-- ====== AI Memory (from 000_initdb_core_tables.sql) ======

CREATE TABLE IF NOT EXISTS ai_project_memory (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    memory_key TEXT NOT NULL,
    memory_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_organization_memory (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    memory_key TEXT NOT NULL,
    memory_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- ====== Admin (from 000_initdb_core_tables.sql) ======

CREATE TABLE IF NOT EXISTS admin_sessions (
    id TEXT PRIMARY KEY,
    admin_user_id TEXT NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admin_approval_workflows (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    workflow_type TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

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

CREATE TABLE IF NOT EXISTS admin_dashboards (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    dashboard_name TEXT NOT NULL,
    config TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admin_saved_reports (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    report_name TEXT NOT NULL,
    report_type TEXT,
    config TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admin_report_executions (
    id TEXT PRIMARY KEY,
    report_id TEXT,
    executed_by TEXT,
    status TEXT DEFAULT 'pending',
    executed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (executed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ====== Trends / Scores (from 000_initdb_core_tables.sql + 20251212) ======

CREATE TABLE IF NOT EXISTS megatrends (
    id TEXT PRIMARY KEY,
    industry TEXT NOT NULL,
    type TEXT NOT NULL,
    label TEXT NOT NULL,
    description TEXT,
    base_impact_score INTEGER NOT NULL,
    initial_ring TEXT NOT NULL
);

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

CREATE INDEX IF NOT EXISTS idx_megatrends_industry ON megatrends(industry);
CREATE INDEX IF NOT EXISTS idx_custom_trends_company ON custom_trends(company_id);

CREATE TABLE IF NOT EXISTS maturity_scores (
    id TEXT PRIMARY KEY,
    assessment_id TEXT,
    dimension TEXT,
    score REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS client_context (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    context_key TEXT NOT NULL,
    context_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- ====== Integrations / Monitoring (from 000_initdb_core_tables.sql) ======

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

CREATE TABLE IF NOT EXISTS system_metrics (
    id TEXT PRIMARY KEY,
    metric_name TEXT NOT NULL,
    metric_value REAL,
    metric_unit TEXT,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS compliance_records (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    compliance_type TEXT,
    status TEXT,
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS backup_records (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    backup_type TEXT,
    backup_status TEXT,
    backup_size_bytes INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- ====== Reports (from 000_initdb_core_tables.sql) ======

CREATE TABLE IF NOT EXISTS report_blocks (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    block_type TEXT,
    block_order INTEGER,
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS report_snapshots (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    snapshot_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
);

-- ====== AI Experiments (from 000_initdb_core_tables.sql) ======

CREATE TABLE IF NOT EXISTS ai_experiments (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    experiment_name TEXT NOT NULL,
    experiment_config TEXT DEFAULT '{}',
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_experiment_variants (
    id TEXT PRIMARY KEY,
    experiment_id TEXT NOT NULL,
    variant_name TEXT,
    variant_config TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (experiment_id) REFERENCES ai_experiments(id) ON DELETE CASCADE
);

-- ====== System Config (from 000_initdb_core_tables.sql) ======

CREATE TABLE IF NOT EXISTS system_config (
    id TEXT PRIMARY KEY,
    config_key TEXT UNIQUE NOT NULL,
    config_value TEXT,
    config_type TEXT DEFAULT 'string',
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====== Compliance Settings (from 000_initdb_core_tables.sql) ======

CREATE TABLE IF NOT EXISTS compliance_settings (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,
    compliance_type TEXT,
    settings TEXT DEFAULT '{}',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- ====== Governance / Permissions (from 014_governance_enterprise.sql.sql) ======

CREATE TABLE IF NOT EXISTS org_user_permissions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    permission_key TEXT NOT NULL,
    grant_type TEXT NOT NULL CHECK (grant_type IN ('GRANT', 'REVOKE')),
    granted_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, organization_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_org_user_perms_user ON org_user_permissions(user_id, organization_id);

-- ====== Token Ledger (from 018_token_ledger.sql.sql) ======

CREATE TABLE IF NOT EXISTS token_ledger (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    organization_id TEXT NOT NULL,
    actor_user_id TEXT,
    actor_type TEXT DEFAULT 'USER' CHECK (actor_type IN ('USER', 'SYSTEM', 'API')),
    type TEXT NOT NULL CHECK (type IN ('CREDIT', 'DEBIT')),
    amount INTEGER NOT NULL CHECK (amount > 0),
    reason TEXT,
    ref_entity_type TEXT CHECK (ref_entity_type IN ('AI_CALL', 'PURCHASE', 'GRANT', 'TRIAL_BONUS', 'ADJUSTMENT', 'REFUND')),
    ref_entity_id TEXT,
    metadata_json TEXT,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_token_ledger_org_id ON token_ledger(organization_id);
CREATE INDEX IF NOT EXISTS idx_token_ledger_org_created ON token_ledger(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_ledger_type ON token_ledger(type);

-- ====== User Data Retention (from 106_security_privacy_enterprise.sql) ======

CREATE TABLE IF NOT EXISTS user_data_retention (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
    retention_period TEXT DEFAULT '365' CHECK (retention_period IN ('30', '90', '180', '365', 'forever')),
    auto_delete INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_data_retention_user_id ON user_data_retention(user_id);

-- ====== GDPR Consents (from 126, fixed for PostgreSQL) ======

CREATE TABLE IF NOT EXISTS user_gdpr_consents (
    user_id TEXT PRIMARY KEY,
    analytics INTEGER DEFAULT 1,
    personalization INTEGER DEFAULT 1,
    marketing INTEGER DEFAULT 0,
    third_party_sharing INTEGER DEFAULT 0,
    ai_training INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ====== Account Deletion (from 120_settings_enhancement_tables.sql) ======

CREATE TABLE IF NOT EXISTS account_deletion_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    processed_by TEXT,
    notes TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_user ON account_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_status ON account_deletion_requests(status);

-- ====== Webhooks (from 160_configuration_enhancements.sql) ======

CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id TEXT PRIMARY KEY,
    webhook_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT,
    request_headers TEXT,
    response_status INTEGER,
    response_body TEXT,
    response_headers TEXT,
    attempt_count INTEGER DEFAULT 1,
    duration_ms INTEGER,
    success INTEGER DEFAULT 0,
    error_message TEXT,
    delivered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    next_retry_at TIMESTAMP,
    FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
);

-- Drifted DBs may already have an older webhook_deliveries (status/response_code
-- shape) without `success`; CREATE TABLE IF NOT EXISTS won't add it, so the
-- index below would fail. Retrofit the column the index needs.
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS success INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_success ON webhook_deliveries(success);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_date ON webhook_deliveries(delivered_at);

-- ====== Data Export (from 160_configuration_enhancements.sql) ======

CREATE TABLE IF NOT EXISTS data_export_requests (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    user_id TEXT NOT NULL,
    export_type TEXT NOT NULL CHECK (export_type IN ('full', 'partial', 'gdpr')),
    format TEXT DEFAULT 'json',
    include_data_types TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
    include_data TEXT,
    exclude_data TEXT,
    download_url TEXT,
    file_url TEXT,
    file_path TEXT,
    file_size INTEGER,
    expires_at TIMESTAMP,
    file_expires_at TIMESTAMP,
    error_message TEXT,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- data_export_requests exists on drifted DBs without organization_id; the
-- CREATE above is a no-op, so retrofit the column the index needs.
ALTER TABLE data_export_requests ADD COLUMN IF NOT EXISTS organization_id TEXT;

CREATE INDEX IF NOT EXISTS idx_data_export_requests_org ON data_export_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_data_export_requests_status ON data_export_requests(status);

-- ====== User Settings (from 140_settings_advanced_features.sql) ======

CREATE TABLE IF NOT EXISTS user_settings_templates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT '📋',
    settings_json TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_settings_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category TEXT NOT NULL,
    setting TEXT NOT NULL,
    action TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    device TEXT,
    ip_address TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_settings_templates_user ON user_settings_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_history_user ON user_settings_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_history_timestamp ON user_settings_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_user_settings_history_category ON user_settings_history(category);

-- ====== User Availability (from 129_user_availability.sql) ======

CREATE TABLE IF NOT EXISTS user_availability (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    status_message TEXT,
    working_hours_json TEXT DEFAULT '{}',
    dnd_hours_json TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_availability_user_id ON user_availability(user_id);

-- ====== AI Partial Responses (from 201_ai_partial_responses.sql) ======

CREATE TABLE IF NOT EXISTS ai_partial_responses (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    organization_id TEXT,
    content TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_partial_responses_session ON ai_partial_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_partial_responses_user ON ai_partial_responses(user_id);

-- ====== Stripe / Billing (from 210_stripe_production.sql.sql) ======

CREATE TABLE IF NOT EXISTS payment_attempts (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    invoice_id TEXT,
    subscription_id TEXT,
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT NOT NULL,
    stripe_payment_intent_id TEXT,
    stripe_charge_id TEXT,
    failure_code TEXT,
    failure_reason TEXT,
    attempt_number INTEGER DEFAULT 1,
    payment_method_id TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_org ON payment_attempts(organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_invoice ON payment_attempts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_status ON payment_attempts(status);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_stripe_pi ON payment_attempts(stripe_payment_intent_id);

CREATE TABLE IF NOT EXISTS dunning_states (
    id TEXT PRIMARY KEY,
    organization_id TEXT UNIQUE NOT NULL,
    subscription_id TEXT,
    current_step INTEGER DEFAULT 0,
    max_steps INTEGER DEFAULT 4,
    last_attempt_at TIMESTAMP,
    next_attempt_at TIMESTAMP,
    status TEXT DEFAULT 'active',
    total_amount_due INTEGER DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    emails_sent INTEGER DEFAULT 0,
    last_email_sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_dunning_states_org ON dunning_states(organization_id);
CREATE INDEX IF NOT EXISTS idx_dunning_states_status ON dunning_states(status);
CREATE INDEX IF NOT EXISTS idx_dunning_states_next_attempt ON dunning_states(next_attempt_at);

CREATE TABLE IF NOT EXISTS subscription_state_history (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    subscription_id TEXT NOT NULL,
    previous_state TEXT,
    new_state TEXT NOT NULL,
    trigger_event TEXT,
    trigger_event_id TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_sub_state_history_org ON subscription_state_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_sub_state_history_sub ON subscription_state_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_state_history_created ON subscription_state_history(created_at);

CREATE TABLE IF NOT EXISTS checkout_sessions (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    user_id TEXT,
    stripe_session_id TEXT UNIQUE NOT NULL,
    plan_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    mode TEXT DEFAULT 'subscription',
    success_url TEXT,
    cancel_url TEXT,
    customer_email TEXT,
    amount_total INTEGER,
    currency TEXT DEFAULT 'USD',
    expires_at TIMESTAMP,
    completed_at TIMESTAMP,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_checkout_sessions_stripe ON checkout_sessions(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_org ON checkout_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_status ON checkout_sessions(status);

CREATE TABLE IF NOT EXISTS proration_records (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    subscription_id TEXT NOT NULL,
    old_plan_id TEXT NOT NULL,
    new_plan_id TEXT NOT NULL,
    proration_amount INTEGER NOT NULL,
    credit_amount INTEGER DEFAULT 0,
    charge_amount INTEGER DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    effective_date TIMESTAMP NOT NULL,
    billing_period_start TIMESTAMP,
    billing_period_end TIMESTAMP,
    stripe_invoice_item_id TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_proration_records_org ON proration_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_proration_records_sub ON proration_records(subscription_id);

CREATE TABLE IF NOT EXISTS billing_usage_events (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    subscription_id TEXT,
    metric_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL,
    total_amount REAL,
    currency TEXT DEFAULT 'USD',
    timestamp TIMESTAMP NOT NULL,
    idempotency_key TEXT UNIQUE,
    stripe_usage_record_id TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_billing_usage_org ON billing_usage_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_usage_metric ON billing_usage_events(metric_name);
CREATE INDEX IF NOT EXISTS idx_billing_usage_timestamp ON billing_usage_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_billing_usage_idem ON billing_usage_events(idempotency_key);

CREATE TABLE IF NOT EXISTS billing_credits (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'USD',
    reason TEXT,
    source TEXT,
    source_id TEXT,
    expires_at TIMESTAMP,
    used_amount INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_billing_credits_org ON billing_credits(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_credits_status ON billing_credits(status);

CREATE TABLE IF NOT EXISTS billing_email_queue (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    email_type TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    recipient_name TEXT,
    subject TEXT NOT NULL,
    template_key TEXT NOT NULL,
    template_data JSON,
    attachments JSON,
    status TEXT DEFAULT 'pending',
    priority INTEGER DEFAULT 5,
    scheduled_at TIMESTAMP,
    sent_at TIMESTAMP,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_billing_email_queue_status ON billing_email_queue(status);
CREATE INDEX IF NOT EXISTS idx_billing_email_queue_org ON billing_email_queue(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_email_queue_scheduled ON billing_email_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_billing_email_queue_type ON billing_email_queue(email_type);

CREATE TABLE IF NOT EXISTS billing_notification_preferences (
    id TEXT PRIMARY KEY,
    organization_id TEXT UNIQUE NOT NULL,
    invoice_created BOOLEAN DEFAULT TRUE,
    invoice_paid BOOLEAN DEFAULT TRUE,
    invoice_overdue BOOLEAN DEFAULT TRUE,
    payment_failed BOOLEAN DEFAULT TRUE,
    payment_method_expiring BOOLEAN DEFAULT TRUE,
    subscription_renewed BOOLEAN DEFAULT TRUE,
    subscription_canceled BOOLEAN DEFAULT TRUE,
    credit_note_issued BOOLEAN DEFAULT TRUE,
    usage_threshold_warning BOOLEAN DEFAULT TRUE,
    additional_recipients JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_billing_notif_pref_org ON billing_notification_preferences(organization_id);

CREATE TABLE IF NOT EXISTS billing_disputes (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    stripe_dispute_id TEXT UNIQUE NOT NULL,
    stripe_charge_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'USD',
    reason TEXT,
    status TEXT DEFAULT 'warning_needs_response',
    evidence_due_by TIMESTAMP,
    is_charge_refundable BOOLEAN DEFAULT FALSE,
    outcome TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_billing_disputes_org ON billing_disputes(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_disputes_stripe ON billing_disputes(stripe_dispute_id);
CREATE INDEX IF NOT EXISTS idx_billing_disputes_status ON billing_disputes(status);

CREATE TABLE IF NOT EXISTS billing_refunds (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    invoice_id TEXT,
    payment_attempt_id TEXT,
    stripe_refund_id TEXT UNIQUE,
    stripe_charge_id TEXT,
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'USD',
    reason TEXT,
    status TEXT DEFAULT 'pending',
    failure_reason TEXT,
    receipt_number TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

CREATE INDEX IF NOT EXISTS idx_billing_refunds_org ON billing_refunds(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_refunds_stripe ON billing_refunds(stripe_refund_id);
CREATE INDEX IF NOT EXISTS idx_billing_refunds_invoice ON billing_refunds(invoice_id);

-- ====== Security (from 236_security_module_extended.sql) ======

CREATE TABLE IF NOT EXISTS security_incidents (
    id TEXT PRIMARY KEY,
    organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    incident_type TEXT NOT NULL CHECK (incident_type IN (
        'unauthorized_access', 'data_breach', 'malware', 'phishing',
        'dos_attack', 'brute_force', 'privilege_escalation', 'data_exfiltration',
        'insider_threat', 'configuration_error', 'suspicious_activity', 'other'
    )),
    title TEXT,
    description TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    affected_resources TEXT,
    metadata_json TEXT,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    resolved_by TEXT REFERENCES users(id),
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Historical demo schemas can already contain this table without the tenant column.
-- CREATE TABLE IF NOT EXISTS does not reconcile an existing table, so establish the
-- indexed column explicitly before creating the index.
ALTER TABLE security_incidents ADD COLUMN IF NOT EXISTS organization_id TEXT;

CREATE INDEX IF NOT EXISTS idx_security_incidents_org ON security_incidents(organization_id);
CREATE INDEX IF NOT EXISTS idx_security_incidents_status ON security_incidents(status);
CREATE INDEX IF NOT EXISTS idx_security_incidents_severity ON security_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_security_incidents_type ON security_incidents(incident_type);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id TEXT PRIMARY KEY,
    organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    admin_id TEXT NOT NULL REFERENCES users(id),
    action_type TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    resource_name TEXT,
    ip_address TEXT,
    user_agent TEXT,
    location TEXT,
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    status TEXT DEFAULT 'logged' CHECK (status IN ('logged', 'reviewed', 'escalated', 'resolved')),
    metadata_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    reviewed_by TEXT REFERENCES users(id),
    review_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_org ON admin_audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin ON admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON admin_audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_risk ON admin_audit_logs(risk_score);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_status ON admin_audit_logs(status);

-- ====== Interview Templates (from 295_interview_context.sql) ======

CREATE TABLE IF NOT EXISTS interview_question_templates (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    question_text TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_required INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====== Webhook Subscriptions (from 015_enterprise_customers_module.sql) ======

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    events_json TEXT NOT NULL,
    secret TEXT,
    is_active INTEGER DEFAULT 1,
    failure_count INTEGER DEFAULT 0,
    last_success_at TIMESTAMP,
    last_failure_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_org ON webhook_subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_active ON webhook_subscriptions(is_active);

-- ====== AI Feature Control (from init-pgvector.sql legacy) ======

CREATE TABLE IF NOT EXISTS ai_feature_control (
    id SERIAL PRIMARY KEY,
    feature_key VARCHAR(50) UNIQUE NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    min_role VARCHAR(20) DEFAULT 'USER',
    allowed_models TEXT[] DEFAULT ARRAY['gpt-4o-mini'],
    max_tokens_per_req INTEGER,
    requires_approval BOOLEAN DEFAULT FALSE,
    emergency_disable BOOLEAN DEFAULT FALSE,
    disable_reason TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====== AI Conversations (from init-pgvector.sql legacy) ======

CREATE TABLE IF NOT EXISTS ai_conversations (
    id SERIAL PRIMARY KEY,
    conversation_id VARCHAR(255) UNIQUE NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    organization_id VARCHAR(255),
    project_id VARCHAR(255),
    title VARCHAR(255),
    messages JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- The legacy pgvector bootstrap created ai_conversations without project_id on some
-- installations. Keep the hotfix convergent before the project index is evaluated.
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS project_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_project ON ai_conversations(project_id);
