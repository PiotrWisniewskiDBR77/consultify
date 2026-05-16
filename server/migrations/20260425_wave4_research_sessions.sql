-- Wave 4 - Deep Research, ResearchSession, Evidence Graph and Report Artifact

CREATE TABLE IF NOT EXISTS research_sessions (
  session_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  project_id TEXT,
  conversation_id TEXT,
  status TEXT NOT NULL,
  mission TEXT NOT NULL,
  scope TEXT,
  questions_json TEXT NOT NULL DEFAULT '[]',
  allowed_sources_json TEXT NOT NULL DEFAULT '[]',
  budget_json TEXT NOT NULL DEFAULT '{}',
  expected_output TEXT,
  attachment_doc_ids_json TEXT NOT NULL DEFAULT '[]',
  progress_json TEXT NOT NULL DEFAULT '{}',
  final_artifact_id TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS research_session_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  actor_user_id TEXT,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS research_evidence_graph (
  node_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  source_class TEXT NOT NULL,
  source_id TEXT,
  source_title TEXT,
  source_url TEXT,
  quote TEXT,
  claim TEXT,
  confidence REAL NOT NULL DEFAULT 0.5,
  contradiction INTEGER NOT NULL DEFAULT 0,
  freshness TEXT NOT NULL DEFAULT 'unknown',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS research_report_artifacts (
  artifact_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  artifact_type TEXT NOT NULL DEFAULT 'research_report',
  title TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  citations_json TEXT NOT NULL DEFAULT '[]',
  evidence_node_ids_json TEXT NOT NULL DEFAULT '[]',
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_research_sessions_org_status
  ON research_sessions(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_research_session_events_session
  ON research_session_events(session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_research_evidence_session
  ON research_evidence_graph(session_id);
