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
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_cost_org ON ai_cost_usage(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_cost_user ON ai_cost_usage(user_id, created_at);

CREATE TABLE IF NOT EXISTS ai_quality_metrics (
  id BIGSERIAL PRIMARY KEY,
  conversation_id TEXT, message_id TEXT, user_id TEXT, organization_id TEXT,
  relevance REAL, groundedness REAL, completeness REAL, coherence REAL, overall_score REAL,
  flags TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_quality_org ON ai_quality_metrics(organization_id, created_at);

CREATE TABLE IF NOT EXISTS rag_metrics (
  id BIGSERIAL PRIMARY KEY,
  query_id TEXT, organization_id TEXT,
  retrieval_latency_ms INTEGER, generation_latency_ms INTEGER, total_latency_ms INTEGER,
  chunks_retrieved INTEGER, chunks_used INTEGER, chunk_utilization REAL,
  precision_estimate REAL, groundedness REAL,
  query_length INTEGER, response_length INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_rag_date ON rag_metrics(created_at);

CREATE TABLE IF NOT EXISTS ai_security_audit_log (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id TEXT, organization_id TEXT,
  details TEXT, severity TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sec_audit ON ai_security_audit_log(severity, created_at);

CREATE TABLE IF NOT EXISTS citation_verification_logs (
  id BIGSERIAL PRIMARY KEY,
  conversation_id TEXT, message_id TEXT,
  total_citations INTEGER DEFAULT 0, verified_count INTEGER DEFAULT 0,
  unverified_count INTEGER DEFAULT 0, broken_count INTEGER DEFAULT 0,
  overall_score REAL, results_json TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_instruction_suggestions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  instruction TEXT NOT NULL, reason TEXT,
  based_on_patterns TEXT,
  confidence REAL DEFAULT 0.5,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ
);

-- FRESH-DB PARITY (2026-07-14): 20260303_schema_alignment.sql sorts BEFORE this
-- file on a fresh replay, so its guarded ai_instruction_suggestions column adds
-- are skipped. Re-add them here idempotently (no-op wherever they exist).
ALTER TABLE ai_instruction_suggestions ADD COLUMN IF NOT EXISTS suggested_instruction TEXT;
ALTER TABLE ai_instruction_suggestions ADD COLUMN IF NOT EXISTS confidence_score REAL DEFAULT 0.5;

CREATE TABLE IF NOT EXISTS ai_drafts (
  id TEXT PRIMARY KEY,
  user_id TEXT, organization_id TEXT,
  title TEXT, content TEXT, type TEXT,
  metadata TEXT, conversation_id TEXT, message_id TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ai_dismissed_nudges (
  nudge_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (nudge_id, user_id)
);
