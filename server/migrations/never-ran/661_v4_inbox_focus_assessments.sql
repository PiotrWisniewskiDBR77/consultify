-- V4-INBX-02, V4-INBX-03, V4-INBX-05, V4-INBX-06 (enhanced),
-- V4-ASMT-04, V4-ASMT-05, V4-ASMT-06, V4-ASMT-07

-- ============================================================
-- 1) V4-INBX-06: Inbox connectors (enhanced) + routing rules
-- ============================================================

ALTER TABLE inbox_connector_items ADD COLUMN IF NOT EXISTS sender_email TEXT;
ALTER TABLE inbox_connector_items ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE inbox_connector_items ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE inbox_connector_items ADD COLUMN IF NOT EXISTS received_at TIMESTAMP;
ALTER TABLE inbox_connector_items ADD COLUMN IF NOT EXISTS routed_by_rule_id TEXT;
ALTER TABLE inbox_connector_items ADD COLUMN IF NOT EXISTS canonical_inbox_item_id TEXT;

ALTER TABLE inbox_routing_rules ADD COLUMN IF NOT EXISTS rule_name TEXT;
ALTER TABLE inbox_routing_rules ADD COLUMN IF NOT EXISTS action_type TEXT DEFAULT 'route_to_user';
ALTER TABLE inbox_routing_rules ADD COLUMN IF NOT EXISTS action_config TEXT DEFAULT '{}';

-- ============================================================
-- 2) V4-INBX-02: Focus board
-- ============================================================

CREATE TABLE IF NOT EXISTS focus_boards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'My Focus',
  capacity_limit INTEGER DEFAULT 5,
  rules_json TEXT DEFAULT '{}',
  is_shared INTEGER DEFAULT 0,
  template_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_focus_boards_user
  ON focus_boards(user_id, organization_id);

CREATE TABLE IF NOT EXISTS focus_board_items (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  inbox_item_id TEXT,
  source_entity_type TEXT,
  source_entity_id TEXT,
  title TEXT NOT NULL,
  priority TEXT DEFAULT 'normal',
  planned_date TEXT,
  time_estimate_minutes INTEGER,
  sort_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'planned',
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_focus_items_board
  ON focus_board_items(board_id, status);

CREATE TABLE IF NOT EXISTS focus_board_templates (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  rules_json TEXT DEFAULT '{}',
  capacity_limit INTEGER DEFAULT 5,
  is_org_default INTEGER DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_focus_templates_org
  ON focus_board_templates(organization_id);

-- ============================================================
-- 3) V4-INBX-03: AI triage
-- ============================================================

CREATE TABLE IF NOT EXISTS inbox_ai_triage_log (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  inbox_item_id TEXT NOT NULL,
  suggested_priority TEXT,
  suggested_section TEXT,
  suggested_action TEXT,
  confidence_score REAL NOT NULL DEFAULT 0.0,
  reasoning TEXT,
  accepted INTEGER,
  undone INTEGER DEFAULT 0,
  original_priority TEXT,
  original_section TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_triage_item
  ON inbox_ai_triage_log(inbox_item_id);
CREATE INDEX IF NOT EXISTS idx_ai_triage_org
  ON inbox_ai_triage_log(organization_id, created_at);

CREATE TABLE IF NOT EXISTS inbox_ai_triage_config (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  auto_triage_enabled INTEGER DEFAULT 0,
  confidence_threshold REAL DEFAULT 0.7,
  allowed_actions TEXT DEFAULT '["prioritize","section","snooze"]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, user_id)
);

-- ============================================================
-- 4) V4-ASMT-04: VDA/ISO findings, nonconformities, CAPA
-- ============================================================

CREATE TABLE IF NOT EXISTS assessment_findings (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  assessment_id TEXT NOT NULL,
  finding_type TEXT NOT NULL DEFAULT 'nonconformity',
  severity TEXT NOT NULL DEFAULT 'minor',
  clause_ref TEXT,
  framework_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  evidence_refs TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'open',
  assigned_to TEXT,
  due_date TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_asmt_findings_assessment
  ON assessment_findings(organization_id, assessment_id);
CREATE INDEX IF NOT EXISTS idx_asmt_findings_status
  ON assessment_findings(status);
CREATE INDEX IF NOT EXISTS idx_asmt_findings_clause
  ON assessment_findings(framework_id, clause_ref);

CREATE TABLE IF NOT EXISTS assessment_capa_actions (
  id TEXT PRIMARY KEY,
  finding_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  action_type TEXT NOT NULL DEFAULT 'corrective',
  title TEXT NOT NULL,
  description TEXT,
  assigned_to TEXT,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
  verification_method TEXT,
  verification_result TEXT,
  verified_by TEXT,
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_capa_finding
  ON assessment_capa_actions(finding_id);
CREATE INDEX IF NOT EXISTS idx_capa_status
  ON assessment_capa_actions(status);

-- ============================================================
-- 5) V4-ASMT-05: Evidence clause mapping + access audit
-- ============================================================

CREATE TABLE IF NOT EXISTS assessment_evidence_clause_map (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  framework_id TEXT NOT NULL,
  clause_ref TEXT NOT NULL,
  coverage_level TEXT DEFAULT 'partial',
  notes TEXT,
  mapped_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(evidence_id, framework_id, clause_ref)
);

CREATE INDEX IF NOT EXISTS idx_evidence_clause_evidence
  ON assessment_evidence_clause_map(evidence_id);
CREATE INDEX IF NOT EXISTS idx_evidence_clause_framework
  ON assessment_evidence_clause_map(framework_id, clause_ref);

CREATE TABLE IF NOT EXISTS assessment_evidence_access_audit (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_evidence_access_evidence
  ON assessment_evidence_access_audit(evidence_id);
CREATE INDEX IF NOT EXISTS idx_evidence_access_org
  ON assessment_evidence_access_audit(organization_id, created_at);

-- ============================================================
-- 6) V4-ASMT-06: AI scoring proposals
-- ============================================================

CREATE TABLE IF NOT EXISTS assessment_ai_scoring_proposals (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  assessment_id TEXT NOT NULL,
  axis_id TEXT,
  question_id TEXT,
  proposed_score REAL,
  current_score REAL,
  citations TEXT DEFAULT '[]',
  reasoning TEXT,
  confidence REAL DEFAULT 0.0,
  ai_model_used TEXT,
  status TEXT NOT NULL DEFAULT 'proposed',
  reviewed_by TEXT,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_scoring_assessment
  ON assessment_ai_scoring_proposals(organization_id, assessment_id);
CREATE INDEX IF NOT EXISTS idx_ai_scoring_status
  ON assessment_ai_scoring_proposals(status);

CREATE TABLE IF NOT EXISTS assessment_eval_datasets (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  framework_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  golden_items TEXT DEFAULT '[]',
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assessment_eval_runs (
  id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  ai_model_used TEXT,
  accuracy REAL,
  precision_score REAL,
  recall REAL,
  f1_score REAL,
  details_json TEXT DEFAULT '{}',
  run_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_eval_runs_dataset
  ON assessment_eval_runs(dataset_id);

-- ============================================================
-- 7) V4-ASMT-07: Report version diff + reviewer sign-off
-- ============================================================

CREATE TABLE IF NOT EXISTS assessment_report_reviews (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  assessment_id TEXT NOT NULL,
  version_id TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  comments TEXT,
  sign_off_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(version_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_report_reviews_assessment
  ON assessment_report_reviews(organization_id, assessment_id);
CREATE INDEX IF NOT EXISTS idx_report_reviews_status
  ON assessment_report_reviews(status);
