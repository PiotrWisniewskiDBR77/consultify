CREATE TABLE IF NOT EXISTS initiative_wizard_sessions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT,
  mode TEXT NOT NULL,
  business_priorities_json TEXT NOT NULL DEFAULT '[]',
  target_count INTEGER,
  time_horizon TEXT,
  risk_appetite TEXT,
  source_basket_json TEXT NOT NULL DEFAULT '[]',
  manual_notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_initiative_wizard_sessions_org
  ON initiative_wizard_sessions(organization_id, created_at);

CREATE INDEX IF NOT EXISTS idx_initiative_wizard_sessions_project
  ON initiative_wizard_sessions(project_id);

CREATE TABLE IF NOT EXISTS initiative_wizard_candidates (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  wizard_session_id TEXT NOT NULL,
  title TEXT NOT NULL,
  problem_statement TEXT NOT NULL,
  opportunity_statement TEXT NOT NULL,
  rationale_text TEXT NOT NULL,
  confidence_level TEXT NOT NULL DEFAULT 'medium',
  limits_json TEXT NOT NULL DEFAULT '[]',
  impact_score INTEGER NOT NULL DEFAULT 3,
  effort_score INTEGER NOT NULL DEFAULT 3,
  risk_score INTEGER NOT NULL DEFAULT 3,
  time_to_value_score INTEGER NOT NULL DEFAULT 3,
  strategic_fit_score INTEGER NOT NULL DEFAULT 3,
  suggested_owner TEXT,
  suggested_kpi TEXT,
  first_step TEXT,
  initiative_level TEXT NOT NULL DEFAULT 'standard',
  triage_status TEXT NOT NULL DEFAULT 'new_candidate',
  triage_reason TEXT,
  linked_initiative_id TEXT,
  source_refs_json TEXT NOT NULL DEFAULT '[]',
  evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_initiative_wizard_candidates_session
  ON initiative_wizard_candidates(wizard_session_id);

CREATE INDEX IF NOT EXISTS idx_initiative_wizard_candidates_status
  ON initiative_wizard_candidates(triage_status);

CREATE TABLE IF NOT EXISTS initiative_wizard_audit_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  wizard_session_id TEXT,
  candidate_id TEXT,
  actor_id TEXT,
  event_type TEXT NOT NULL,
  event_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_initiative_wizard_audit_session
  ON initiative_wizard_audit_events(wizard_session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_initiative_wizard_audit_candidate
  ON initiative_wizard_audit_events(candidate_id, created_at);

CREATE INDEX IF NOT EXISTS idx_initiative_wizard_audit_org
  ON initiative_wizard_audit_events(organization_id, created_at);
