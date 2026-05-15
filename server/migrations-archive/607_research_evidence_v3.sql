-- Migration: 607_research_evidence_v3.sql
-- Purpose: Minimal evidence + citation store for V3 research connectors (EDGAR/GDELT/etc.)
-- Date: 2026-02-27

CREATE TABLE IF NOT EXISTS research_evidence (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  source TEXT NOT NULL,              -- 'edgar' | 'gdelt' | 'openalex' | 'crossref' | ...
  query_key TEXT,                    -- e.g. 'cik:0000320193' or 'q:tesla+competitor'
  title TEXT,
  summary TEXT,
  source_url TEXT NOT NULL,
  retrieved_at DATETIME NOT NULL,    -- ISO timestamp
  hash TEXT NOT NULL,                -- sha256 of payload_json
  license_note TEXT,
  payload_json TEXT NOT NULL,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_research_evidence_org ON research_evidence(organization_id);
CREATE INDEX IF NOT EXISTS idx_research_evidence_source ON research_evidence(source);
CREATE INDEX IF NOT EXISTS idx_research_evidence_created ON research_evidence(created_at);
CREATE INDEX IF NOT EXISTS idx_research_evidence_hash ON research_evidence(hash);

