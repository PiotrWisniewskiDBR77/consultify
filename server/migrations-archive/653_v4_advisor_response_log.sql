-- V4-AI-01: Canonical AdvisorResponse audit log
-- Migration: 653_v4_advisor_response_log.sql

CREATE TABLE IF NOT EXISTS advisor_response_log (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  conversation_id TEXT,
  intent TEXT NOT NULL,
  answer_preview TEXT,
  citations_count INTEGER DEFAULT 0,
  actions_count INTEGER DEFAULT 0,
  questions_count INTEGER DEFAULT 0,
  confidence REAL,
  safety_notes_json TEXT DEFAULT '[]',
  model TEXT,
  tokens_used INTEGER,
  latency_ms INTEGER,
  purpose TEXT,
  response_json TEXT NOT NULL,
  feedback_score INTEGER,
  feedback_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_advisor_log_org ON advisor_response_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_advisor_log_user ON advisor_response_log(user_id);
CREATE INDEX IF NOT EXISTS idx_advisor_log_intent ON advisor_response_log(intent);
CREATE INDEX IF NOT EXISTS idx_advisor_log_conv ON advisor_response_log(conversation_id);
