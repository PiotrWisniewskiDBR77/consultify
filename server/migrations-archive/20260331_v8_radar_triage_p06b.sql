-- P06-B: Radar triage cockpit signals
CREATE TABLE IF NOT EXISTS v8_radar_triage_signals (
  signal_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('execution_delivery','decision_alignment','finance_kpi','governance_compliance','external_change')),
  priority_level TEXT NOT NULL CHECK(priority_level IN ('P0','P1','P2')),
  score INTEGER NOT NULL DEFAULT 0,
  bands_json TEXT NOT NULL DEFAULT '{}',
  triggered_rules_json TEXT NOT NULL DEFAULT '[]',
  why_now_json TEXT NOT NULL DEFAULT '{}',
  evidence_json TEXT NOT NULL DEFAULT '{}',
  uncertainty_json TEXT NOT NULL DEFAULT '{}',
  ownership_json TEXT NOT NULL DEFAULT '{}',
  next_action_json TEXT NOT NULL DEFAULT '{}',
  triage_state TEXT NOT NULL DEFAULT 'ready',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_radar_triage_org ON v8_radar_triage_signals(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_radar_triage_priority ON v8_radar_triage_signals(organization_id, priority_level);
