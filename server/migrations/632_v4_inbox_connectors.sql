-- V4-INBX-06: Connectors — email→inbox, Slack/Teams webhooks→inbox; routing rules
-- Items ingested from external channels
-- Routing rules for org-level policy

CREATE TABLE IF NOT EXISTS inbox_connector_items (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  source_channel TEXT NOT NULL,
  source_id TEXT,
  payload_json TEXT,
  target_user_id TEXT,
  target_item_key TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inbox_routing_rules (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  conditions_json TEXT,
  target_user_id TEXT,
  target_project_id TEXT,
  priority INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inbox_connector_items_org ON inbox_connector_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_inbox_connector_items_status ON inbox_connector_items(status);
CREATE INDEX IF NOT EXISTS idx_inbox_routing_rules_org ON inbox_routing_rules(organization_id);
