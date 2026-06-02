-- V10 Expanded Canvas runtime tables
-- Mirrors server/migrations/760_work_canvas_runtime.sql for the v2 migration runner.

CREATE TABLE IF NOT EXISTS work_canvas_drafts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  content_json TEXT NOT NULL,
  sources_json TEXT,
  provenance_json TEXT,
  client_id TEXT,
  project_id TEXT,
  owner_id TEXT,
  research_session_id TEXT,
  artifact_run_id TEXT,
  artifact_id TEXT,
  artifact_version INTEGER,
  save_state TEXT NOT NULL,
  lifecycle_state TEXT NOT NULL,
  dirty_state TEXT NOT NULL,
  visibility TEXT NOT NULL,
  audit_status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS work_canvas_proposals (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  target TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL,
  payload_json TEXT,
  required_capability TEXT,
  target_object_id TEXT,
  read_back_json TEXT,
  audit_event_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS work_canvas_ideas (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  source_draft_id TEXT NOT NULL,
  source_proposal_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_work_canvas_drafts_org_conversation
  ON work_canvas_drafts (organization_id, conversation_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_work_canvas_drafts_org_project
  ON work_canvas_drafts (organization_id, project_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_work_canvas_proposals_draft
  ON work_canvas_proposals (organization_id, draft_id, updated_at);
