-- V8 Tool Collaboration Adapters — per-tool collaboration readiness contracts
-- WP-W4-COLLAB-02: Workspace Tool Collaboration Readiness

-- ==========================================
-- 1. Tool Collaboration Adapters
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_tool_collaboration_adapters (
  adapter_id            TEXT PRIMARY KEY,
  tool_name             TEXT NOT NULL
                        CHECK (tool_name IN (
                          'idea_workspace', 'whiteboard', 'mind_map',
                          'process_flow', 'table', 'notebook'
                        )),
  resource_type         TEXT NOT NULL,
  organization_id       TEXT NOT NULL,
  readiness_level       TEXT NOT NULL DEFAULT 'missing'
                        CHECK (readiness_level IN (
                          'missing', 'scaffold', 'partial',
                          'platform_integrated', 'complete'
                        )),
  room_granularity      TEXT NOT NULL
                        CHECK (room_granularity IN (
                          'workspace', 'table', 'notebook', 'canvas', 'document'
                        )),
  presence_types        TEXT NOT NULL DEFAULT '[]',
  cursor_state_schema   TEXT NOT NULL DEFAULT '{}',
  supported_lock_types  TEXT NOT NULL DEFAULT '[]',
  versioning_policy     TEXT NOT NULL DEFAULT '{}',
  offline_policy        TEXT NOT NULL
                        CHECK (offline_policy IN (
                          'queue_and_merge', 'queue_and_review',
                          'reject_on_reconnect', 'stale_warning'
                        )),
  collaboration_mode    TEXT NOT NULL
                        CHECK (collaboration_mode IN (
                          'realtime_coediting', 'controlled_coediting',
                          'review_first', 'facilitated_input', 'role_gated'
                        )),
  registered_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_v8_tool_collab_adapters_tool_org
  ON v8_tool_collaboration_adapters(organization_id, tool_name);

CREATE INDEX IF NOT EXISTS idx_v8_tool_collab_adapters_org
  ON v8_tool_collaboration_adapters(organization_id);

CREATE INDEX IF NOT EXISTS idx_v8_tool_collab_adapters_readiness
  ON v8_tool_collaboration_adapters(organization_id, readiness_level);

-- ==========================================
-- 2. Tool Readiness Audits
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_tool_readiness_audits (
  audit_id            TEXT PRIMARY KEY,
  tool_name           TEXT NOT NULL
                      CHECK (tool_name IN (
                        'idea_workspace', 'whiteboard', 'mind_map',
                        'process_flow', 'table', 'notebook'
                      )),
  organization_id     TEXT NOT NULL,
  primitive_checks    TEXT NOT NULL DEFAULT '[]',
  overall_readiness   TEXT NOT NULL DEFAULT 'missing'
                      CHECK (overall_readiness IN (
                        'missing', 'scaffold', 'partial',
                        'platform_integrated', 'complete'
                      )),
  audited_at          TEXT NOT NULL DEFAULT (datetime('now')),
  audited_by          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_v8_tool_readiness_audits_org
  ON v8_tool_readiness_audits(organization_id);

CREATE INDEX IF NOT EXISTS idx_v8_tool_readiness_audits_tool_org
  ON v8_tool_readiness_audits(organization_id, tool_name);

CREATE INDEX IF NOT EXISTS idx_v8_tool_readiness_audits_time
  ON v8_tool_readiness_audits(audited_at);

-- ==========================================
-- 3. AI Proposal Visibility (Decision W4-7)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_ai_proposal_visibility (
  proposal_id         TEXT PRIMARY KEY,
  organization_id     TEXT NOT NULL,
  tool_name           TEXT NOT NULL
                      CHECK (tool_name IN (
                        'idea_workspace', 'whiteboard', 'mind_map',
                        'process_flow', 'table', 'notebook'
                      )),
  resource_id         TEXT NOT NULL,
  author_id           TEXT NOT NULL,
  visibility          TEXT NOT NULL DEFAULT 'personal_draft'
                      CHECK (visibility IN (
                        'personal_draft', 'shared_proposal',
                        'team_review', 'accepted', 'rejected'
                      )),
  proposal_payload    TEXT NOT NULL DEFAULT '{}',
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_ai_proposal_visibility_org
  ON v8_ai_proposal_visibility(organization_id);

CREATE INDEX IF NOT EXISTS idx_v8_ai_proposal_visibility_tool_org
  ON v8_ai_proposal_visibility(organization_id, tool_name);

CREATE INDEX IF NOT EXISTS idx_v8_ai_proposal_visibility_resource
  ON v8_ai_proposal_visibility(organization_id, resource_id);

CREATE INDEX IF NOT EXISTS idx_v8_ai_proposal_visibility_author
  ON v8_ai_proposal_visibility(author_id);

CREATE INDEX IF NOT EXISTS idx_v8_ai_proposal_visibility_state
  ON v8_ai_proposal_visibility(organization_id, visibility);
