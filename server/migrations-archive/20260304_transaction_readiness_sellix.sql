-- T114: Transaction Readiness Scoring + T115: Sellix Integration
-- NOTE: Consultify uses TEXT ids across core tables (organizations/users).
-- This migration stores UUID values as TEXT (generated via pgcrypto) to keep FK compatibility.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS transaction_readiness_scores (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  tier TEXT NOT NULL DEFAULT 'LOW' CHECK (tier IN ('LOW','MEDIUM','HIGH','READY')),
  dimensions_json JSONB NOT NULL DEFAULT '{}',
  penalties_json JSONB NOT NULL DEFAULT '[]',
  blockers_json JSONB NOT NULL DEFAULT '[]',
  algorithm_version TEXT NOT NULL DEFAULT 'v1',
  source_evidence_hash TEXT,
  computed_by TEXT NOT NULL DEFAULT 'system',
  computed_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, computed_at)
);
CREATE INDEX IF NOT EXISTS idx_readiness_org ON transaction_readiness_scores(organization_id);
CREATE INDEX IF NOT EXISTS idx_readiness_tier ON transaction_readiness_scores(tier);
CREATE INDEX IF NOT EXISTS idx_readiness_score ON transaction_readiness_scores(score DESC);
CREATE INDEX IF NOT EXISTS idx_readiness_computed ON transaction_readiness_scores(computed_at DESC);

CREATE TABLE IF NOT EXISTS transaction_readiness_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  old_tier TEXT, new_tier TEXT,
  old_score INTEGER, new_score INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_readiness_events_org ON transaction_readiness_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_readiness_events_type ON transaction_readiness_events(event_type);

CREATE TABLE IF NOT EXISTS sellix_config (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  enabled BOOLEAN DEFAULT FALSE,
  threshold_score INTEGER DEFAULT 80,
  cooldown_hours INTEGER DEFAULT 24,
  webhook_secret TEXT,
  sellix_endpoint TEXT,
  default_pathway TEXT DEFAULT 'TRIAL_UPGRADE_EMAIL_1',
  updated_by TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sellix_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  organization_id TEXT,
  payload JSONB DEFAULT '{}',
  signature_valid BOOLEAN DEFAULT FALSE,
  processing_status TEXT DEFAULT 'received' CHECK (processing_status IN ('received','processed','failed','duplicate')),
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(event_id)
);
CREATE INDEX IF NOT EXISTS idx_sellix_events_org ON sellix_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_sellix_events_type ON sellix_events(event_type);
CREATE INDEX IF NOT EXISTS idx_sellix_events_status ON sellix_events(processing_status);

CREATE TABLE IF NOT EXISTS sellix_delivery_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_hash TEXT,
  response_status INTEGER,
  response_body TEXT,
  attempt INTEGER DEFAULT 1,
  success BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sellix_delivery_org ON sellix_delivery_log(organization_id);
