-- W11: org context store — Goals/Challenges/Strategy/CompanyProfile per-org persistence.
-- Replaces localStorage (useContextBuilderStore) with real server-side storage.
-- Each org has exactly one row; upserted on every PUT.

CREATE TABLE IF NOT EXISTS organization_context_store (
  organization_id TEXT PRIMARY KEY,
  goals_json       JSONB NOT NULL DEFAULT '{}',
  challenges_json  JSONB NOT NULL DEFAULT '{}',
  synthesis_json   JSONB NOT NULL DEFAULT '{}',
  company_profile_json JSONB NOT NULL DEFAULT '{}',
  updated_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by       TEXT
);

CREATE INDEX IF NOT EXISTS idx_org_context_store_org ON organization_context_store(organization_id);
