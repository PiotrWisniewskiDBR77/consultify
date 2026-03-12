-- V4-AI-02: Intent routing + context pack snapshots

CREATE TABLE IF NOT EXISTS ai_context_snapshots (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  organization_id TEXT NOT NULL,
  conversation_id TEXT,
  version INTEGER DEFAULT 1,
  intent TEXT NOT NULL,
  artifacts_json TEXT NOT NULL DEFAULT '[]',
  token_estimate INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
);
CREATE INDEX IF NOT EXISTS idx_ai_ctx_snap_org ON ai_context_snapshots(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_ctx_snap_conv ON ai_context_snapshots(conversation_id);

CREATE TABLE IF NOT EXISTS ai_intent_routing_log (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  message_preview TEXT,
  classified_intent TEXT NOT NULL,
  confidence REAL,
  selected_tier TEXT,
  selected_purpose TEXT,
  context_snapshot_id TEXT,
  routing_trace_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_intent_log_org ON ai_intent_routing_log(organization_id);
