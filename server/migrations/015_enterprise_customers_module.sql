-- Migration: 015_enterprise_customers_module.sql
-- Enterprise Customers Module - All Tables
-- Compatible with SQLite and PostgreSQL

-- Organization Metadata & Custom Fields
CREATE TABLE IF NOT EXISTS organization_metadata (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    value_type TEXT DEFAULT 'string',
    category TEXT,
    is_sensitive INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE(organization_id, key)
);

CREATE INDEX IF NOT EXISTS idx_org_metadata_org ON organization_metadata(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_metadata_category ON organization_metadata(category);

-- Organization Tags & Labels
CREATE TABLE IF NOT EXISTS organization_tags (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    color TEXT,
    category TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE(organization_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_org_tags_org ON organization_tags(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_tags_category ON organization_tags(category);

-- Organization Relationships
CREATE TABLE IF NOT EXISTS organization_relationships (
    id TEXT PRIMARY KEY,
    parent_org_id TEXT NOT NULL,
    child_org_id TEXT NOT NULL,
    relationship_type TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    metadata TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(parent_org_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(child_org_id) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE(parent_org_id, child_org_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_org_relationships_parent ON organization_relationships(parent_org_id);
CREATE INDEX IF NOT EXISTS idx_org_relationships_child ON organization_relationships(child_org_id);

-- Organization Health Scores
CREATE TABLE IF NOT EXISTS organization_health_scores (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    score_date DATE NOT NULL,
    overall_score REAL,
    engagement_score REAL,
    adoption_score REAL,
    support_score REAL,
    technical_score REAL,
    billing_score REAL,
    churn_risk REAL,
    health_trend TEXT,
    factors_json TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE(organization_id, score_date)
);

CREATE INDEX IF NOT EXISTS idx_org_health_org ON organization_health_scores(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_health_date ON organization_health_scores(score_date DESC);

-- Organization Segments
CREATE TABLE IF NOT EXISTS organization_segments (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    segment_name TEXT NOT NULL,
    segment_type TEXT,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    assigned_by TEXT,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(assigned_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_org_segments_org ON organization_segments(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_segments_type ON organization_segments(segment_type);

-- Extended User Profiles
CREATE TABLE IF NOT EXISTS user_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    job_title TEXT,
    department TEXT,
    phone TEXT,
    timezone TEXT DEFAULT 'UTC',
    locale TEXT DEFAULT 'en',
    avatar_url TEXT,
    bio TEXT,
    linkedin_url TEXT,
    github_url TEXT,
    website_url TEXT,
    skills_json TEXT DEFAULT '[]',
    certifications_json TEXT DEFAULT '[]',
    preferences_json TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user ON user_profiles(user_id);

-- User Activity Summary
CREATE TABLE IF NOT EXISTS user_activity_summary (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    login_count INTEGER DEFAULT 0,
    last_login_at DATETIME,
    ai_interactions INTEGER DEFAULT 0,
    tasks_created INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    projects_accessed INTEGER DEFAULT 0,
    features_used_json TEXT DEFAULT '[]',
    engagement_score REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE(user_id, organization_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_user_activity_user ON user_activity_summary(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_org ON user_activity_summary(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_period ON user_activity_summary(period_start DESC);

-- User Sessions (Detailed)
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    device_type TEXT,
    browser TEXT,
    os TEXT,
    location_country TEXT,
    location_city TEXT,
    login_method TEXT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    ended_at DATETIME,
    end_reason TEXT,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active, expires_at);

-- User Groups & Teams (Cross-organization)
CREATE TABLE IF NOT EXISTS user_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    group_type TEXT,
    organization_id TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_user_groups_org ON user_groups(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_groups_type ON user_groups(group_type);

CREATE TABLE IF NOT EXISTS user_group_members (
    group_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT DEFAULT 'member',
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    added_by TEXT,
    PRIMARY KEY(group_id, user_id),
    FOREIGN KEY(group_id) REFERENCES user_groups(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(added_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_user_group_members_group ON user_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_user_group_members_user ON user_group_members(user_id);

-- User Onboarding Progress
CREATE TABLE IF NOT EXISTS user_onboarding_progress (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    step_key TEXT NOT NULL,
    step_name TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    completed_at DATETIME,
    skipped INTEGER DEFAULT 0,
    skipped_at DATETIME,
    progress_data TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE(user_id, organization_id, step_key)
);

CREATE INDEX IF NOT EXISTS idx_user_onboarding_user ON user_onboarding_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_org ON user_onboarding_progress(organization_id);

-- User License Management
CREATE TABLE IF NOT EXISTS user_licenses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    license_type TEXT NOT NULL,
    features_json TEXT DEFAULT '[]',
    limits_json TEXT DEFAULT '{}',
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    assigned_by TEXT,
    notes TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(assigned_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_user_licenses_user ON user_licenses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_licenses_org ON user_licenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_licenses_type ON user_licenses(license_type);

-- IP Whitelisting
CREATE TABLE IF NOT EXISTS organization_ip_whitelist (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    ip_range TEXT,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(organization_id, ip_address)
);

CREATE INDEX IF NOT EXISTS idx_ip_whitelist_org ON organization_ip_whitelist(organization_id);

-- Device Management
CREATE TABLE IF NOT EXISTS user_devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    device_id TEXT UNIQUE NOT NULL,
    device_name TEXT,
    device_type TEXT,
    browser TEXT,
    os TEXT,
    ip_address TEXT,
    first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_trusted INTEGER DEFAULT 0,
    is_blocked INTEGER DEFAULT 0,
    blocked_reason TEXT,
    blocked_at DATETIME,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_devices_user ON user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_device_id ON user_devices(device_id);

-- MFA (Multi-Factor Authentication)
CREATE TABLE IF NOT EXISTS user_mfa_methods (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    method_type TEXT NOT NULL,
    secret TEXT,
    phone_number TEXT,
    backup_codes_json TEXT DEFAULT '[]',
    is_enabled INTEGER DEFAULT 0,
    is_primary INTEGER DEFAULT 0,
    last_used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_mfa_user ON user_mfa_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_user_mfa_enabled ON user_mfa_methods(user_id, is_enabled);

-- Password Policies
CREATE TABLE IF NOT EXISTS organization_password_policies (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,
    min_length INTEGER DEFAULT 8,
    require_uppercase INTEGER DEFAULT 1,
    require_lowercase INTEGER DEFAULT 1,
    require_numbers INTEGER DEFAULT 1,
    require_special_chars INTEGER DEFAULT 1,
    max_age_days INTEGER,
    prevent_reuse_count INTEGER DEFAULT 5,
    lockout_attempts INTEGER DEFAULT 5,
    lockout_duration_minutes INTEGER DEFAULT 30,
    require_mfa INTEGER DEFAULT 0,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Security Events & Alerts
CREATE TABLE IF NOT EXISTS security_events (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    user_id TEXT,
    event_type TEXT NOT NULL,
    severity TEXT DEFAULT 'medium',
    ip_address TEXT,
    user_agent TEXT,
    location_country TEXT,
    location_city TEXT,
    details_json TEXT DEFAULT '{}',
    resolved INTEGER DEFAULT 0,
    resolved_at DATETIME,
    resolved_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(resolved_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_security_events_org ON security_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at DESC);

-- Support Tickets
CREATE TABLE IF NOT EXISTS support_tickets (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT,
    ticket_number TEXT UNIQUE NOT NULL,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'open',
    category TEXT,
    assigned_to TEXT,
    tags_json TEXT DEFAULT '[]',
    metadata_json TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    closed_at DATETIME,
    first_response_at DATETIME,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_org ON support_tickets(organization_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_number ON support_tickets(ticket_number);

-- Support Ticket Comments
CREATE TABLE IF NOT EXISTS support_ticket_comments (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    comment_text TEXT NOT NULL,
    is_internal INTEGER DEFAULT 0,
    attachments_json TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_support_comments_ticket ON support_ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_comments_user ON support_ticket_comments(user_id);

-- Customer Success Notes
CREATE TABLE IF NOT EXISTS customer_success_notes (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT,
    note_type TEXT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    action_items_json TEXT DEFAULT '[]',
    follow_up_date DATETIME,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cs_notes_org ON customer_success_notes(organization_id);
CREATE INDEX IF NOT EXISTS idx_cs_notes_user ON customer_success_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_cs_notes_type ON customer_success_notes(note_type);

-- Customer Health Checks
CREATE TABLE IF NOT EXISTS customer_health_checks (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    check_date DATE NOT NULL,
    overall_health TEXT,
    engagement_level TEXT,
    adoption_score REAL,
    support_tickets_count INTEGER DEFAULT 0,
    open_tickets_count INTEGER DEFAULT 0,
    avg_response_time_hours REAL,
    nps_score INTEGER,
    churn_risk TEXT,
    risk_factors_json TEXT DEFAULT '[]',
    recommendations_json TEXT DEFAULT '[]',
    checked_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(checked_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(organization_id, check_date)
);

CREATE INDEX IF NOT EXISTS idx_customer_health_org ON customer_health_checks(organization_id);
CREATE INDEX IF NOT EXISTS idx_customer_health_date ON customer_health_checks(check_date DESC);

-- Customer Lifecycle Events
CREATE TABLE IF NOT EXISTS customer_lifecycle_events (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_date DATE NOT NULL,
    previous_state TEXT,
    new_state TEXT,
    metadata_json TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lifecycle_events_org ON customer_lifecycle_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_type ON customer_lifecycle_events(event_type);
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_date ON customer_lifecycle_events(event_date DESC);

-- Enhanced Feedback System
CREATE TABLE IF NOT EXISTS feedback_items (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    user_id TEXT NOT NULL,
    feedback_type TEXT NOT NULL,
    category TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'new',
    votes_count INTEGER DEFAULT 0,
    user_impact TEXT,
    screenshots_json TEXT DEFAULT '[]',
    attachments_json TEXT DEFAULT '[]',
    metadata_json TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_feedback_items_org ON feedback_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_feedback_items_user ON feedback_items(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_items_type ON feedback_items(feedback_type);
CREATE INDEX IF NOT EXISTS idx_feedback_items_status ON feedback_items(status);

-- Feedback Votes
CREATE TABLE IF NOT EXISTS feedback_votes (
    id TEXT PRIMARY KEY,
    feedback_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    vote_type TEXT DEFAULT 'upvote',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(feedback_id) REFERENCES feedback_items(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(feedback_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_votes_feedback ON feedback_votes(feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_votes_user ON feedback_votes(user_id);

-- Feedback Comments
CREATE TABLE IF NOT EXISTS feedback_comments (
    id TEXT PRIMARY KEY,
    feedback_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    comment_text TEXT NOT NULL,
    is_internal INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(feedback_id) REFERENCES feedback_items(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_feedback_comments_feedback ON feedback_comments(feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_comments_user ON feedback_comments(user_id);

-- Feature Roadmap
CREATE TABLE IF NOT EXISTS feature_roadmap (
    id TEXT PRIMARY KEY,
    feature_title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'planned',
    priority TEXT DEFAULT 'medium',
    target_release_date DATE,
    related_feedback_ids_json TEXT DEFAULT '[]',
    votes_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_feature_roadmap_status ON feature_roadmap(status);
CREATE INDEX IF NOT EXISTS idx_feature_roadmap_priority ON feature_roadmap(priority);

-- Organization Analytics
CREATE TABLE IF NOT EXISTS organization_analytics (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    metric_date DATE NOT NULL,
    total_users INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    ai_interactions INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    storage_used_gb REAL DEFAULT 0,
    projects_count INTEGER DEFAULT 0,
    tasks_created INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    support_tickets INTEGER DEFAULT 0,
    nps_score INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE(organization_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_org_analytics_org ON organization_analytics(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_analytics_date ON organization_analytics(metric_date DESC);

-- User Adoption Metrics
CREATE TABLE IF NOT EXISTS user_adoption_metrics (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    metric_date DATE NOT NULL,
    features_used_json TEXT DEFAULT '[]',
    playbooks_completed INTEGER DEFAULT 0,
    ai_interactions INTEGER DEFAULT 0,
    login_frequency INTEGER DEFAULT 0,
    engagement_score REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE(user_id, organization_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_user_adoption_user ON user_adoption_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_adoption_org ON user_adoption_metrics(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_adoption_date ON user_adoption_metrics(metric_date DESC);

-- Data Retention Policies
CREATE TABLE IF NOT EXISTS data_retention_policies (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    data_type TEXT NOT NULL,
    retention_days INTEGER NOT NULL,
    auto_delete INTEGER DEFAULT 0,
    archive_before_delete INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_retention_policies_org ON data_retention_policies(organization_id);
CREATE INDEX IF NOT EXISTS idx_retention_policies_type ON data_retention_policies(data_type);

-- GDPR Data Subject Requests (DSAR)
CREATE TABLE IF NOT EXISTS gdpr_data_subject_requests (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT,
    request_type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    data_json TEXT,
    notes TEXT,
    created_by TEXT,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_gdpr_requests_org ON gdpr_data_subject_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_user ON gdpr_data_subject_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_status ON gdpr_data_subject_requests(status);

-- Consent Management
CREATE TABLE IF NOT EXISTS user_consents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    consent_type TEXT NOT NULL,
    consent_status TEXT DEFAULT 'pending',
    consent_version TEXT,
    granted_at DATETIME,
    withdrawn_at DATETIME,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE(user_id, organization_id, consent_type)
);

CREATE INDEX IF NOT EXISTS idx_user_consents_user ON user_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_consents_org ON user_consents(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_consents_type ON user_consents(consent_type);

-- Integration Connections
CREATE TABLE IF NOT EXISTS integration_connections (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    integration_type TEXT NOT NULL,
    name TEXT NOT NULL,
    config_json TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    last_sync_at DATETIME,
    sync_status TEXT DEFAULT 'success',
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_integration_connections_org ON integration_connections(organization_id);
CREATE INDEX IF NOT EXISTS idx_integration_connections_type ON integration_connections(integration_type);

-- Automation Rules
CREATE TABLE IF NOT EXISTS automation_rules (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL,
    trigger_config_json TEXT NOT NULL,
    action_type TEXT NOT NULL,
    action_config_json TEXT NOT NULL,
    conditions_json TEXT DEFAULT '[]',
    is_active INTEGER DEFAULT 1,
    execution_count INTEGER DEFAULT 0,
    last_executed_at DATETIME,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_org ON automation_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_active ON automation_rules(is_active);

-- Webhook Subscriptions
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    events_json TEXT NOT NULL,
    secret TEXT,
    is_active INTEGER DEFAULT 1,
    failure_count INTEGER DEFAULT 0,
    last_success_at DATETIME,
    last_failure_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_org ON webhook_subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_active ON webhook_subscriptions(is_active);

-- Email Templates (if not exists)
CREATE TABLE IF NOT EXISTS email_templates (
    id TEXT PRIMARY KEY,
    template_key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT,
    variables_json TEXT DEFAULT '[]',
    category TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_templates_key ON email_templates(template_key);
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates(category);

-- Email Campaigns
CREATE TABLE IF NOT EXISTS email_campaigns (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    name TEXT NOT NULL,
    template_id TEXT,
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    recipient_filter_json TEXT DEFAULT '{}',
    status TEXT DEFAULT 'draft',
    scheduled_at DATETIME,
    sent_at DATETIME,
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    clicked_count INTEGER DEFAULT 0,
    bounced_count INTEGER DEFAULT 0,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(template_id) REFERENCES email_templates(id) ON DELETE SET NULL,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_email_campaigns_org ON email_campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status);

-- Notification Preferences (if not exists)
CREATE TABLE IF NOT EXISTS notification_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT,
    notification_type TEXT NOT NULL,
    channel TEXT,
    is_enabled INTEGER DEFAULT 1,
    frequency TEXT DEFAULT 'immediate',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE(user_id, organization_id, notification_type, channel)
);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_prefs_org ON notification_preferences(organization_id);









