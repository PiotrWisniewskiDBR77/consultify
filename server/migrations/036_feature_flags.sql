-- 036_feature_flags.sql
-- Dynamic feature toggles for safe deployments and staged rollouts

CREATE TABLE feature_flags (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE, -- e.g., 'new_ai_dashboard'
    description TEXT,
    is_enabled BOOLEAN DEFAULT 0, -- Global master switch
    rules TEXT, -- JSON array of rules e.g., [{"type": "org", "values": ["org-1"]}, {"type": "percentage", "value": 10}]
    created_by TEXT, -- Admin user ID
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE feature_flag_evaluations (
    id TEXT PRIMARY KEY,
    flag_key TEXT NOT NULL,
    entity_id TEXT NOT NULL, -- User ID or Org ID
    result BOOLEAN NOT NULL,
    evaluated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed some initial flags
INSERT INTO feature_flags (id, key, description, is_enabled, rules) VALUES
('flag-1', 'beta_features', 'Enable beta features for internal users', 1, '[{"type": "email_domain", "values": ["consultify.app"]}]'),
('flag-2', 'new_billing_ui', 'Rollout new billing dashboard', 0, '[]');
