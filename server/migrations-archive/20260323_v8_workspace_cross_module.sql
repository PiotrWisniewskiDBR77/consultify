-- V8 Workspace Cross-Module Integration — Wave 16
-- Session ↔ platform module links and cross-module activity log

-- ==========================================
-- 1. Session module links (soft unlink via unlinked_at)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_session_module_links (
  link_id             TEXT PRIMARY KEY,
  session_id          TEXT NOT NULL,
  organization_id     TEXT NOT NULL,
  module_type         TEXT NOT NULL
                      CHECK (module_type IN (
                        'initiative', 'execution_run', 'retrieval_request', 'report',
                        'presentation', 'kpi_scorecard', 'finance_model'
                      )),
  module_resource_id  TEXT NOT NULL,
  linked_by           TEXT NOT NULL,
  linked_at           TEXT NOT NULL,
  unlinked_at         TEXT,
  FOREIGN KEY (session_id) REFERENCES v8_workspace_sessions(session_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_sml_session_org
  ON v8_session_module_links(session_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_v8_sml_module_lookup
  ON v8_session_module_links(organization_id, module_type, module_resource_id);

CREATE INDEX IF NOT EXISTS idx_v8_sml_active
  ON v8_session_module_links(session_id, organization_id)
  WHERE unlinked_at IS NULL;

-- ==========================================
-- 2. Cross-module activity (append-only)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_cross_module_activity (
  activity_id         TEXT PRIMARY KEY,
  session_id          TEXT NOT NULL,
  organization_id     TEXT NOT NULL,
  module_type         TEXT NOT NULL
                      CHECK (module_type IN (
                        'initiative', 'execution_run', 'retrieval_request', 'report',
                        'presentation', 'kpi_scorecard', 'finance_model'
                      )),
  module_resource_id  TEXT NOT NULL,
  activity_type       TEXT NOT NULL,
  actor_id            TEXT NOT NULL,
  summary             TEXT NOT NULL,
  created_at          TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES v8_workspace_sessions(session_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_cma_session_org
  ON v8_cross_module_activity(session_id, organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v8_cma_org_time
  ON v8_cross_module_activity(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v8_cma_module
  ON v8_cross_module_activity(organization_id, module_type, module_resource_id);
