CREATE TABLE IF NOT EXISTS v8_agent_resource_policies (
  policy_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  max_concurrent_executions INTEGER NOT NULL CHECK (max_concurrent_executions > 0),
  max_estimated_cost_usd_per_run NUMERIC(18, 6) NOT NULL
    CHECK (max_estimated_cost_usd_per_run >= 0),
  lease_seconds INTEGER NOT NULL DEFAULT 300 CHECK (lease_seconds BETWEEN 1 AND 86400),
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, project_id)
);

CREATE TABLE IF NOT EXISTS v8_agent_resource_reservations (
  reservation_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  policy_id TEXT NOT NULL REFERENCES v8_agent_resource_policies(policy_id),
  status TEXT NOT NULL CHECK (status IN ('reserved', 'settled', 'released', 'expired', 'denied')),
  decision_reason TEXT NOT NULL,
  estimated_cost_usd NUMERIC(18, 6) NOT NULL CHECK (estimated_cost_usd >= 0),
  actual_cost_usd NUMERIC(18, 6),
  actual_usage_source TEXT NOT NULL DEFAULT 'UNKNOWN'
    CHECK (actual_usage_source = 'UNKNOWN'),
  lease_expires_at TEXT,
  settled_at TEXT,
  released_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_v8_agent_resource_active
  ON v8_agent_resource_reservations(organization_id, project_id, status, lease_expires_at);

CREATE INDEX IF NOT EXISTS idx_v8_agent_resource_run_cost
  ON v8_agent_resource_reservations(organization_id, project_id, run_id, status);
