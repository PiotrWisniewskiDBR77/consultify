-- Customer Automation Rules
-- Migration: 240_customer_automation.sql

-- Automation Rules table
CREATE TABLE IF NOT EXISTS automation_rules (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL,
    trigger_config TEXT DEFAULT '{}',
    action_type TEXT NOT NULL,
    action_config TEXT DEFAULT '{}',
    is_active INTEGER DEFAULT 1,
    executions_count INTEGER DEFAULT 0,
    last_executed_at TIMESTAMP,
    created_by TEXT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Automation Rule Executions (history)
CREATE TABLE IF NOT EXISTS automation_rule_executions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    rule_id TEXT NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
    organization_id TEXT REFERENCES organizations(id),
    user_id TEXT REFERENCES users(id),
    status TEXT DEFAULT 'completed',
    execution_details TEXT DEFAULT '{}',
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_automation_rules_active ON automation_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_automation_rule_executions_rule ON automation_rule_executions(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_rule_executions_date ON automation_rule_executions(executed_at DESC);

-- Default Automation Rules
INSERT OR IGNORE INTO automation_rules (id, name, description, trigger_type, trigger_config, action_type, action_config, is_active, executions_count, last_executed_at) VALUES
    ('rule-welcome-email', 'Welcome Email on Trial Start', 'Send welcome email when organization starts trial', 'org_created', '{"plan":"trial"}', 'send_email', '{"template":"welcome_email"}', 1, 47, datetime('now', '-2 hours')),
    ('rule-trial-expiry', 'Trial Expiry Warning', 'Notify when trial ends in 3 days', 'trial_ending', '{"days_before":3}', 'send_email', '{"template":"trial_expiry_warning"}', 1, 23, datetime('now', '-1 day')),
    ('rule-low-activity', 'Low Activity Alert', 'Alert CSM when no logins in 7 days', 'no_activity', '{"days":7}', 'notify_csm', '{"priority":"medium"}', 1, 12, datetime('now', '-3 days')),
    ('rule-renewal-reminder', 'Subscription Renewal Reminder', 'Remind about subscription renewal 30 days before', 'subscription_ending', '{"days_before":30}', 'send_email', '{"template":"renewal_reminder"}', 0, 8, NULL);
