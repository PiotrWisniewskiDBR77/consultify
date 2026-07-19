-- V4-INIT-04, V4-INIT-06, V4-INIT-07,
-- V4-TOOL-03, V4-TOOL-06, V4-TOOL-07,
-- V4-ENT-05, V4-ENT-08

-- ============================================================
-- 1) V4-INIT-04: Goals/OKR spine
-- ============================================================

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  parent_goal_id TEXT,
  goal_type TEXT NOT NULL DEFAULT 'objective',
  title TEXT NOT NULL,
  description TEXT,
  owner_id TEXT,
  time_frame TEXT,
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  progress REAL DEFAULT 0.0,
  target_value REAL,
  current_value REAL,
  unit TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_goals_org ON goals(organization_id);
CREATE INDEX IF NOT EXISTS idx_goals_parent ON goals(parent_goal_id);

CREATE TABLE IF NOT EXISTS goal_initiative_links (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL,
  initiative_id TEXT NOT NULL,
  contribution_weight REAL DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(goal_id, initiative_id)
);

CREATE INDEX IF NOT EXISTS idx_goal_init_goal ON goal_initiative_links(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_init_init ON goal_initiative_links(initiative_id);

-- ============================================================
-- 2) V4-INIT-06: AI blueprint generator
-- ============================================================

CREATE TABLE IF NOT EXISTS initiative_ai_blueprints (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  initiative_id TEXT,
  prompt_text TEXT,
  generated_wbs TEXT DEFAULT '[]',
  generated_milestones TEXT DEFAULT '[]',
  generated_deps TEXT DEFAULT '[]',
  generated_resources TEXT DEFAULT '[]',
  citations TEXT DEFAULT '[]',
  ai_model_used TEXT,
  confidence REAL DEFAULT 0.0,
  status TEXT NOT NULL DEFAULT 'proposed',
  applied_at TIMESTAMP,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_blueprints_org
  ON initiative_ai_blueprints(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_blueprints_init
  ON initiative_ai_blueprints(initiative_id);

-- ============================================================
-- 3) V4-INIT-07: Decision governance + RAID gates
-- ============================================================

CREATE TABLE IF NOT EXISTS initiative_governance_gates (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  initiative_id TEXT NOT NULL,
  gate_type TEXT NOT NULL DEFAULT 'phase_gate',
  gate_name TEXT NOT NULL,
  required_decisions TEXT DEFAULT '[]',
  required_raid_status TEXT DEFAULT '{}',
  required_approvers TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  evaluated_at TIMESTAMP,
  evaluation_result TEXT DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gov_gates_init
  ON initiative_governance_gates(organization_id, initiative_id);

CREATE TABLE IF NOT EXISTS initiative_decision_links (
  id TEXT PRIMARY KEY,
  initiative_id TEXT NOT NULL,
  decision_id TEXT NOT NULL,
  link_type TEXT NOT NULL DEFAULT 'required',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(initiative_id, decision_id)
);

CREATE INDEX IF NOT EXISTS idx_init_dec_init
  ON initiative_decision_links(initiative_id);

-- ============================================================
-- 4) V4-TOOL-03: Template library
-- ============================================================

CREATE TABLE IF NOT EXISTS tool_template_library (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  template_key TEXT NOT NULL,
  template_name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  schema_json TEXT NOT NULL DEFAULT '{}',
  default_config TEXT DEFAULT '{}',
  is_system INTEGER DEFAULT 0,
  is_org_curated INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tool_templates_org
  ON tool_template_library(organization_id);
CREATE INDEX IF NOT EXISTS idx_tool_templates_key
  ON tool_template_library(template_key);
CREATE INDEX IF NOT EXISTS idx_tool_templates_category
  ON tool_template_library(category);

-- ============================================================
-- 5) V4-TOOL-06: Knowledge bank + RAG
-- ============================================================

CREATE TABLE IF NOT EXISTS tool_knowledge_bank (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  tool_session_id TEXT,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  content_text TEXT,
  embedding_vector TEXT,
  metadata_json TEXT DEFAULT '{}',
  scope TEXT DEFAULT 'session',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tool_kb_org
  ON tool_knowledge_bank(organization_id, scope);
CREATE INDEX IF NOT EXISTS idx_tool_kb_session
  ON tool_knowledge_bank(tool_session_id);
CREATE INDEX IF NOT EXISTS idx_tool_kb_source
  ON tool_knowledge_bank(source_type, source_id);

CREATE TABLE IF NOT EXISTS tool_rag_queries (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  tool_session_id TEXT,
  query_text TEXT NOT NULL,
  results_json TEXT DEFAULT '[]',
  citations_json TEXT DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tool_rag_session
  ON tool_rag_queries(tool_session_id);

-- ============================================================
-- 6) V4-TOOL-07: Entitlement model
-- ============================================================

CREATE TABLE IF NOT EXISTS tool_entitlements (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  pack_key TEXT NOT NULL,
  pack_name TEXT NOT NULL,
  licensed_tools TEXT DEFAULT '[]',
  max_sessions_per_month INTEGER,
  max_concurrent_users INTEGER,
  is_active INTEGER DEFAULT 1,
  valid_from TEXT,
  valid_until TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, pack_key)
);

CREATE INDEX IF NOT EXISTS idx_tool_ent_org
  ON tool_entitlements(organization_id, is_active);

CREATE TABLE IF NOT EXISTS tool_usage_log (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  tool_key TEXT NOT NULL,
  entitlement_id TEXT,
  action TEXT DEFAULT 'session_start',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tool_usage_org
  ON tool_usage_log(organization_id, created_at);

-- ============================================================
-- 7) V4-ENT-05: Integration hub
-- ============================================================

CREATE TABLE IF NOT EXISTS integration_connectors (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  connector_type TEXT NOT NULL,
  connector_name TEXT NOT NULL,
  config_json TEXT DEFAULT '{}',
  secrets_ref TEXT,
  status TEXT NOT NULL DEFAULT 'configured',
  health_status TEXT DEFAULT 'unknown',
  last_health_check_at TIMESTAMP,
  allowlist_domains TEXT DEFAULT '[]',
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_int_connectors_org
  ON integration_connectors(organization_id);

CREATE TABLE IF NOT EXISTS integration_queue (
  id TEXT PRIMARY KEY,
  connector_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'outbound',
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMP,
  error_message TEXT,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_int_queue_status
  ON integration_queue(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_int_queue_connector
  ON integration_queue(connector_id);

CREATE TABLE IF NOT EXISTS integration_secrets (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  connector_id TEXT,
  secret_key TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  rotated_at TIMESTAMP,
  UNIQUE(organization_id, connector_id, secret_key)
);

-- ============================================================
-- 8) V4-ENT-08: Observability
-- ============================================================

CREATE TABLE IF NOT EXISTS observability_metrics (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  metric_name TEXT NOT NULL,
  metric_type TEXT NOT NULL DEFAULT 'counter',
  value REAL NOT NULL,
  labels_json TEXT DEFAULT '{}',
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_obs_metrics_name
  ON observability_metrics(metric_name, recorded_at);

CREATE TABLE IF NOT EXISTS observability_slos (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  slo_name TEXT NOT NULL,
  target_percentage REAL NOT NULL,
  window_days INTEGER DEFAULT 30,
  current_percentage REAL,
  budget_remaining REAL,
  last_calculated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS observability_traces (
  id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  span_id TEXT NOT NULL,
  parent_span_id TEXT,
  operation_name TEXT NOT NULL,
  service_name TEXT DEFAULT 'consultify-api',
  duration_ms REAL,
  status_code TEXT,
  attributes_json TEXT DEFAULT '{}',
  started_at TIMESTAMP,
  ended_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_obs_traces_trace
  ON observability_traces(trace_id);
CREATE INDEX IF NOT EXISTS idx_obs_traces_op
  ON observability_traces(operation_name, started_at);

CREATE TABLE IF NOT EXISTS observability_dr_drills (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  drill_type TEXT NOT NULL,
  scenario TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  results_json TEXT DEFAULT '{}',
  conducted_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
