-- P04-B: KPI closed-loop signals and explicit next actions (Results runtime)

CREATE TABLE IF NOT EXISTS v8_kpi_signals (
  signal_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  kpi_id TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence_pointers TEXT NOT NULL DEFAULT '[]',
  next_action_status TEXT NOT NULL DEFAULT 'pending',
  next_action_ref TEXT,
  acknowledged_by TEXT,
  acknowledged_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (kpi_id) REFERENCES v8_kpi_definitions(kpi_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_kpi_signals_org
  ON v8_kpi_signals(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_kpi_signals_kpi
  ON v8_kpi_signals(organization_id, kpi_id);
CREATE INDEX IF NOT EXISTS idx_v8_kpi_signals_status
  ON v8_kpi_signals(organization_id, next_action_status);

CREATE TABLE IF NOT EXISTS v8_kpi_next_actions (
  action_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  signal_id TEXT NOT NULL,
  kpi_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  description TEXT NOT NULL,
  assigned_to TEXT,
  status TEXT NOT NULL,
  finance_consequence_ref TEXT,
  execution_follow_up_ref TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (kpi_id) REFERENCES v8_kpi_definitions(kpi_id),
  FOREIGN KEY (signal_id) REFERENCES v8_kpi_signals(signal_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_kpi_next_actions_org
  ON v8_kpi_next_actions(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_kpi_next_actions_signal
  ON v8_kpi_next_actions(organization_id, signal_id);
CREATE INDEX IF NOT EXISTS idx_v8_kpi_next_actions_kpi
  ON v8_kpi_next_actions(organization_id, kpi_id);
