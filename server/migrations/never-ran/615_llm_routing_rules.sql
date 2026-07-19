-- LLM Routing Rules (persisted configuration)
-- Enables CRUD-managed routing policies used by ModelRouter.
--
-- Notes:
-- - config_json is stored as TEXT for SQLite compatibility; API layer JSON.stringifies.
-- - organization_id NULL = global rule; otherwise org-scoped override.
-- - priority: lower = higher priority (evaluated first).

CREATE TABLE IF NOT EXISTS llm_routing_rules (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  config_json TEXT DEFAULT '{}',
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_llm_routing_rules_org ON llm_routing_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_llm_routing_rules_active ON llm_routing_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_llm_routing_rules_type ON llm_routing_rules(type);
CREATE INDEX IF NOT EXISTS idx_llm_routing_rules_priority ON llm_routing_rules(priority);

