-- V4-IDEA-06, V4-ORG-02, V4-ORG-03, V4-ORG-04, V4-AI-04, V4-AI-08
-- Final batch: export, cohort privacy, framework mappings, benchmark pipeline,
-- typed actions, domain playbooks

-- ============================================================
-- 1) V4-IDEA-06: Export mindmap/whiteboard
-- ============================================================

CREATE TABLE IF NOT EXISTS idea_exports (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  idea_id TEXT NOT NULL,
  export_type TEXT NOT NULL,
  export_format TEXT NOT NULL,
  watermark_text TEXT,
  include_metadata INTEGER DEFAULT 1,
  file_url TEXT,
  file_size_bytes INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  requested_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_idea_exports_idea
  ON idea_exports(organization_id, idea_id);

-- ============================================================
-- 2) V4-ORG-02: Cohort privacy
-- ============================================================

CREATE TABLE IF NOT EXISTS benchmark_cohort_policies (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  min_cohort_size INTEGER NOT NULL DEFAULT 5,
  suppression_enabled INTEGER DEFAULT 1,
  noise_method TEXT DEFAULT 'rounding',
  noise_magnitude REAL DEFAULT 0.05,
  audit_all_queries INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id)
);

CREATE TABLE IF NOT EXISTS benchmark_query_audit (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  query_type TEXT NOT NULL,
  query_params TEXT DEFAULT '{}',
  cohort_size INTEGER,
  suppressed INTEGER DEFAULT 0,
  noise_applied INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bq_audit_org
  ON benchmark_query_audit(organization_id, created_at);

-- ============================================================
-- 3) V4-ORG-03: Framework mappings
-- ============================================================

CREATE TABLE IF NOT EXISTS benchmark_framework_mappings (
  id TEXT PRIMARY KEY,
  framework_key TEXT NOT NULL,
  framework_name TEXT NOT NULL,
  version TEXT,
  dimension_key TEXT NOT NULL,
  dimension_name TEXT NOT NULL,
  percentile_p25 REAL,
  percentile_p50 REAL,
  percentile_p75 REAL,
  percentile_p90 REAL,
  what_good_looks_like TEXT,
  data_source TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(framework_key, dimension_key)
);

CREATE INDEX IF NOT EXISTS idx_bfm_framework
  ON benchmark_framework_mappings(framework_key);

-- ============================================================
-- 4) V4-ORG-04: Benchmark→gap→initiatives pipeline
-- ============================================================

CREATE TABLE IF NOT EXISTS benchmark_gap_analyses (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  framework_key TEXT NOT NULL,
  assessment_id TEXT,
  gaps_json TEXT DEFAULT '[]',
  recommendations_json TEXT DEFAULT '[]',
  auto_initiatives_created INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bga_org
  ON benchmark_gap_analyses(organization_id, framework_key);

CREATE TABLE IF NOT EXISTS benchmark_gap_initiative_links (
  id TEXT PRIMARY KEY,
  gap_analysis_id TEXT NOT NULL,
  gap_dimension_key TEXT NOT NULL,
  initiative_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(gap_analysis_id, gap_dimension_key, initiative_id)
);

-- ============================================================
-- 5) V4-AI-04: Typed actions framework
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_typed_actions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target_entity_type TEXT NOT NULL,
  target_entity_id TEXT,
  proposed_changes TEXT NOT NULL DEFAULT '{}',
  preview_diff TEXT,
  status TEXT NOT NULL DEFAULT 'proposed',
  rbac_required_role TEXT,
  idempotency_key TEXT,
  proposed_by TEXT NOT NULL,
  accepted_by TEXT,
  executed_at TIMESTAMP,
  execution_result TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_ai_actions_org
  ON ai_typed_actions(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_actions_target
  ON ai_typed_actions(target_entity_type, target_entity_id);

-- ============================================================
-- 6) V4-AI-08: Domain playbooks
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_domain_playbooks (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  domain TEXT NOT NULL,
  playbook_name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  example_queries TEXT DEFAULT '[]',
  required_context TEXT DEFAULT '[]',
  output_schema TEXT DEFAULT '{}',
  is_system INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_playbooks_domain
  ON ai_domain_playbooks(domain);
CREATE INDEX IF NOT EXISTS idx_ai_playbooks_org
  ON ai_domain_playbooks(organization_id);

CREATE TABLE IF NOT EXISTS ai_playbook_executions (
  id TEXT PRIMARY KEY,
  playbook_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  input_context TEXT DEFAULT '{}',
  output_result TEXT DEFAULT '{}',
  citations TEXT DEFAULT '[]',
  confidence REAL,
  duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_pb_exec_playbook
  ON ai_playbook_executions(playbook_id);
