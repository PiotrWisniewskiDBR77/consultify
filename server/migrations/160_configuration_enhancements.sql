-- Configuration Module Enhancements Migration
-- Version: 160
-- Date: 2026-01-02

-- IP Access Rules table (for IP allowlist/blocklist management)
CREATE TABLE IF NOT EXISTS ip_access_rules (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    rule_type TEXT NOT NULL CHECK(rule_type IN ('allow', 'block')),
    description TEXT,
    is_active INTEGER DEFAULT 1,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ip_access_rules_org ON ip_access_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_ip_access_rules_type ON ip_access_rules(rule_type, is_active);

-- Feature flag overrides for per-org settings
CREATE TABLE IF NOT EXISTS feature_flag_overrides (
    id TEXT PRIMARY KEY,
    flag_key TEXT NOT NULL,
    organization_id TEXT,
    user_id TEXT,
    enabled INTEGER NOT NULL,
    variant TEXT,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    expires_at DATETIME,
    FOREIGN KEY (flag_key) REFERENCES feature_flags(key) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_feature_flag_overrides_flag ON feature_flag_overrides(flag_key);
CREATE INDEX IF NOT EXISTS idx_feature_flag_overrides_org ON feature_flag_overrides(organization_id);

-- Webhook deliveries table for delivery logging
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
    delivered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    next_retry_at DATETIME,
    FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_success ON webhook_deliveries(success);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_date ON webhook_deliveries(delivered_at);

-- Data export requests table
CREATE TABLE IF NOT EXISTS data_export_requests (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    export_type TEXT NOT NULL CHECK(export_type IN ('full', 'partial', 'gdpr')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
    include_data TEXT, -- JSON array of data types to include
    exclude_data TEXT, -- JSON array of data types to exclude
    file_url TEXT,
    file_size INTEGER,
    file_expires_at DATETIME,
    error_message TEXT,
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_data_export_requests_org ON data_export_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_data_export_requests_status ON data_export_requests(status);

-- Backup configurations
CREATE TABLE IF NOT EXISTS backup_configurations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,
    enabled INTEGER DEFAULT 1,
    frequency TEXT NOT NULL DEFAULT 'daily' CHECK(frequency IN ('hourly', 'daily', 'weekly', 'monthly')),
    retention_days INTEGER DEFAULT 30,
    include_attachments INTEGER DEFAULT 1,
    include_audit_logs INTEGER DEFAULT 1,
    last_backup_at DATETIME,
    last_backup_status TEXT,
    last_backup_size INTEGER,
    next_backup_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Email configurations for organizations
CREATE TABLE IF NOT EXISTS email_configurations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL DEFAULT 'smtp' CHECK(provider IN ('smtp', 'sendgrid', 'mailgun', 'ses')),
    smtp_host TEXT,
    smtp_port INTEGER DEFAULT 587,
    smtp_username TEXT,
    smtp_password_encrypted TEXT,
    smtp_use_tls INTEGER DEFAULT 1,
    from_email TEXT,
    from_name TEXT,
    reply_to_email TEXT,
    api_key_encrypted TEXT, -- For SendGrid, Mailgun, SES
    domain TEXT, -- For Mailgun
    region TEXT, -- For SES
    spf_verified INTEGER DEFAULT 0,
    dkim_verified INTEGER DEFAULT 0,
    dmarc_verified INTEGER DEFAULT 0,
    last_verified_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Email templates
CREATE TABLE IF NOT EXISTS email_templates (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    template_key TEXT NOT NULL,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body_html TEXT,
    body_text TEXT,
    variables TEXT, -- JSON array of available variables
    is_default INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_templates_key ON email_templates(organization_id, template_key);

-- Email send logs
CREATE TABLE IF NOT EXISTS email_logs (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    template_id TEXT,
    recipient_email TEXT NOT NULL,
    recipient_name TEXT,
    subject TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued', 'sent', 'delivered', 'bounced', 'failed', 'opened', 'clicked')),
    provider_message_id TEXT,
    error_message TEXT,
    opened_at DATETIME,
    clicked_at DATETIME,
    sent_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL,
    FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_email_logs_org ON email_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_date ON email_logs(created_at);

-- Billing invoices
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    invoice_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
    currency TEXT DEFAULT 'USD',
    subtotal INTEGER NOT NULL DEFAULT 0, -- in cents
    tax_amount INTEGER DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    amount_paid INTEGER DEFAULT 0,
    amount_due INTEGER NOT NULL DEFAULT 0,
    due_date DATETIME,
    paid_at DATETIME,
    period_start DATETIME,
    period_end DATETIME,
    line_items TEXT, -- JSON array of line items
    metadata TEXT, -- JSON object
    stripe_invoice_id TEXT,
    pdf_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(created_at);

-- Subscription plans
CREATE TABLE IF NOT EXISTS subscription_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price_monthly INTEGER NOT NULL, -- in cents
    price_yearly INTEGER,
    currency TEXT DEFAULT 'USD',
    features TEXT, -- JSON array of features
    limits TEXT, -- JSON object of limits
    is_active INTEGER DEFAULT 1,
    is_public INTEGER DEFAULT 1,
    trial_days INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    stripe_price_id_monthly TEXT,
    stripe_price_id_yearly TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Organization subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'paused')),
    billing_cycle TEXT DEFAULT 'monthly' CHECK(billing_cycle IN ('monthly', 'yearly')),
    current_period_start DATETIME,
    current_period_end DATETIME,
    cancel_at_period_end INTEGER DEFAULT 0,
    canceled_at DATETIME,
    trial_start DATETIME,
    trial_end DATETIME,
    stripe_subscription_id TEXT,
    stripe_customer_id TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Usage metering
CREATE TABLE IF NOT EXISTS usage_records (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit TEXT,
    metadata TEXT, -- JSON
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    billing_period_start DATETIME,
    billing_period_end DATETIME,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_usage_records_org ON usage_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_metric ON usage_records(metric_name);
CREATE INDEX IF NOT EXISTS idx_usage_records_date ON usage_records(recorded_at);

-- Insert default email templates
INSERT OR IGNORE INTO email_templates (id, organization_id, template_key, name, subject, body_html, body_text, variables, is_default, is_active)
VALUES 
    ('tpl_welcome', NULL, 'welcome', 'Welcome Email', 'Welcome to {{app_name}}!', 
     '<h1>Welcome, {{user_name}}!</h1><p>Thank you for joining {{app_name}}.</p>', 
     'Welcome, {{user_name}}! Thank you for joining {{app_name}}.', 
     '["user_name", "app_name", "login_url"]', 1, 1),
    ('tpl_password_reset', NULL, 'password_reset', 'Password Reset', 'Reset Your Password', 
     '<h1>Password Reset</h1><p>Click <a href="{{reset_url}}">here</a> to reset your password.</p>', 
     'Reset your password by visiting: {{reset_url}}', 
     '["user_name", "reset_url", "expires_in"]', 1, 1),
    ('tpl_invoice', NULL, 'invoice', 'Invoice', 'Invoice #{{invoice_number}}', 
     '<h1>Invoice #{{invoice_number}}</h1><p>Amount due: {{amount_due}}</p>', 
     'Invoice #{{invoice_number}} - Amount due: {{amount_due}}', 
     '["invoice_number", "amount_due", "due_date", "payment_url"]', 1, 1);




