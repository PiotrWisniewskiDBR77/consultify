-- AI Enterprise Tables Migration (2026-02-06)
-- Creates tables for enterprise AI services

CREATE TABLE IF NOT EXISTS ai_cost_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  tier TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_cost_org ON ai_cost_usage(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_cost_user ON ai_cost_usage(user_id, created_at);

CREATE TABLE IF NOT EXISTS ai_quality_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT, message_id TEXT, user_id TEXT, organization_id TEXT,
  relevance REAL, groundedness REAL, completeness REAL, coherence REAL, overall_score REAL,
  flags TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_quality_org ON ai_quality_metrics(organization_id, created_at);

CREATE TABLE IF NOT EXISTS rag_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query_id TEXT, organization_id TEXT,
  retrieval_latency_ms INTEGER, generation_latency_ms INTEGER, total_latency_ms INTEGER,
  chunks_retrieved INTEGER, chunks_used INTEGER, chunk_utilization REAL,
  precision_estimate REAL, groundedness REAL,
  query_length INTEGER, response_length INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rag_date ON rag_metrics(created_at);

CREATE TABLE IF NOT EXISTS ai_security_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  user_id TEXT, organization_id TEXT,
  details TEXT, severity TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sec_audit ON ai_security_audit_log(severity, created_at);

CREATE TABLE IF NOT EXISTS citation_verification_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT, message_id TEXT,
  total_citations INTEGER DEFAULT 0, verified_count INTEGER DEFAULT 0,
  unverified_count INTEGER DEFAULT 0, broken_count INTEGER DEFAULT 0,
  overall_score REAL, results_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_instruction_suggestions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  instruction TEXT NOT NULL, reason TEXT,
  based_on_patterns TEXT,
  confidence REAL DEFAULT 0.5,
  status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS ai_drafts (
  id TEXT PRIMARY KEY,
  user_id TEXT, organization_id TEXT,
  title TEXT, content TEXT, type TEXT,
  metadata TEXT, conversation_id TEXT, message_id TEXT,
  status TEXT DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS ai_dismissed_nudges (
  nudge_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  dismissed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (nudge_id, user_id)
);
