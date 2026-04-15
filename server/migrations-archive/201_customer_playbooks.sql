-- Customer Success Playbooks Tables
-- Migration: 201_customer_playbooks.sql

-- Playbooks (automated customer success workflows)
CREATE TABLE IF NOT EXISTS customer_success_playbooks (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    description TEXT,
    trigger_conditions_json TEXT DEFAULT '{}',
    actions_json TEXT DEFAULT '[]',
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Playbook Actions (executed actions log)
CREATE TABLE IF NOT EXISTS customer_playbook_actions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    playbook_id TEXT NOT NULL REFERENCES customer_success_playbooks(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    action_config_json TEXT DEFAULT '{}',
    status TEXT DEFAULT 'pending',
    executed_at TIMESTAMP,
    result_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_playbook_actions_playbook ON customer_playbook_actions(playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_actions_org ON customer_playbook_actions(organization_id);
CREATE INDEX IF NOT EXISTS idx_playbook_actions_status ON customer_playbook_actions(status);

-- Default Playbooks
INSERT OR IGNORE INTO customer_success_playbooks (id, name, description, trigger_conditions_json, actions_json) VALUES
    ('pb-onboarding', 'Onboarding Welcome', 'Welcome new customers and guide them through setup', 
     '{"type":"onboarding_complete","conditions":{"stage":"trial"}}',
     '[{"type":"send_email","config":{"template":"welcome_email"}},{"type":"create_task","config":{"title":"Schedule kickoff call"}}]'),
    ('pb-trial-ending', 'Trial Ending Follow-up', 'Engage customers whose trial is ending soon',
     '{"type":"trial_ending","conditions":{"days_remaining":7}}',
     '[{"type":"notify_csm","config":{"message":"Trial ending in 7 days"}},{"type":"send_email","config":{"template":"trial_ending"}}]'),
    ('pb-low-engagement', 'Low Engagement Alert', 'Re-engage customers with declining activity',
     '{"type":"low_engagement","conditions":{"threshold_percent":30}}',
     '[{"type":"update_health","config":{"decrease":10}},{"type":"notify_csm","config":{"priority":"high"}}]'),
    ('pb-health-drop', 'Health Score Alert', 'Alert when customer health drops significantly',
     '{"type":"health_score_drop","conditions":{"threshold":50}}',
     '[{"type":"notify_csm","config":{"priority":"urgent"}},{"type":"schedule_call","config":{"type":"check-in"}}]');
