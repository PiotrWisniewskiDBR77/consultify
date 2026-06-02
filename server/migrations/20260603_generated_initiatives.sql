-- 20260603 — Module 05 Inicjatywy — Initiative Generator backing table
--
-- The AI initiative-generator router (server/src/routes/initiative-generator.routes.ts)
-- reads/writes a `generated_initiatives` table that no prior migration created.
-- Migration 011_initiative_generator.sql only added `initiative_drafts` and
-- `assessment_initiatives`, so the router was mounted as a production-disabled
-- `mountStub` and any call against it failed silently (503 / "no such table").
--
-- This migration creates the table so the router can be promoted to a real
-- mount at `/api/initiative-generator` and actually persist AI-generated
-- initiative drafts. Additive and idempotent.
--
-- Columns mirror exactly what the router selects/inserts:
--   GET /        -> id, title, description, source, priority, status,
--                   estimated_impact, created_at
--   POST /generate -> id, organization_id, title, description, source,
--                     priority, status, assessment_id, created_by, created_at
--   PUT /:id     -> title, description, priority, status

CREATE TABLE IF NOT EXISTS generated_initiatives (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'AI Generated Initiative',
  description TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'draft',
  estimated_impact TEXT,
  assessment_id TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generated_initiatives_org
  ON generated_initiatives(organization_id);

CREATE INDEX IF NOT EXISTS idx_generated_initiatives_assessment
  ON generated_initiatives(assessment_id);
