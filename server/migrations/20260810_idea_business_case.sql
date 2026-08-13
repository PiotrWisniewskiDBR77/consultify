-- Idea business-case schema — Program D / epic E08.
-- SSOT: docs/qa/ideas-manual-audit-2026-08-09/09_IDEAS_COMPLETE_TRANSFORMATION_PROGRAM_FOR_CLAUDE.md §6.2
--       + 11_IDEAS_EPICS_DOD_AND_FINAL_ACCEPTANCE_PROTOCOL.md epic E08.
--
-- ★ NOT APPLIED BY THIS CHANGE. This file is written per repo convention
--   (DATABASE SAFETY house rule) but was never run against any database —
--   dev, demo, or otherwise. The orchestrator must review and apply it
--   deliberately. Purely additive: one new table, a FK to the existing
--   `my_ideas` table, no ALTER/DROP/type change on anything that exists
--   today.
--
-- Stores ONE business case per idea (server enforces via unique index on
-- idea_id). The whole §6.2 section set (problem/baseline, objective,
-- stakeholders, alternatives, recommendation, benefits/disbenefits, costs,
-- operational impact, risks/controls/dependencies, milestones, KPIs,
-- confidence/readiness, decision requested) is stored as one JSON blob
-- (`sections_json`) matching `IdeaBusinessCaseSections` in
-- src/types/ideaBusinessCase.ts — same pattern as `my_idea_maps.nodes_json`
-- and `artifact_evidence`'s JSON columns elsewhere in this schema. The
-- "evidence, assumptions and evidence gaps" section is NOT duplicated here —
-- it is a pointer into the existing `artifact_evidence` envelope for
-- artifact_type='canvas', artifact_id=<idea id> (see evidenceEnvelopeService.ts).

CREATE TABLE IF NOT EXISTS idea_business_cases (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  sections_json TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(idea_id) REFERENCES my_ideas(id) ON DELETE CASCADE
);

-- One business case per idea.
CREATE UNIQUE INDEX IF NOT EXISTS ux_idea_business_cases_idea_id ON idea_business_cases(idea_id);
CREATE INDEX IF NOT EXISTS idx_idea_business_cases_org_id ON idea_business_cases(organization_id);
