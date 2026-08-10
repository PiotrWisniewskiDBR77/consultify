-- Idea confidentiality classification — epic E12 (collaboration/security).
-- SSOT: docs/qa/ideas-manual-audit-2026-08-09/09_IDEAS_COMPLETE_TRANSFORMATION_PROGRAM_FOR_CLAUDE.md §10.4
--       + 11_IDEAS_EPICS_DOD_AND_FINAL_ACCEPTANCE_PROTOCOL.md epic E12.
--
-- ★ NOT APPLIED BY THIS CHANGE. Written per repo convention (DATABASE SAFETY
--   house rule) but never run against any database — dev, demo, or
--   otherwise. The orchestrator must review and apply it deliberately.
--   Purely additive: one nullable-safe column with a DEFAULT, no
--   ALTER/DROP/type change on anything that already exists.
--
-- Before this migration, `my_ideas` carries NO confidentiality/sensitivity
-- concept at all — every Idea's content (title/seed/node labels) is sent to
-- the configured LLM provider unconditionally by the map AI endpoints
-- (POST .../map/ai-suggestions, .../map/gap-analysis, .../map/expand — see
-- server/src/routes/my-work.routes.ts) with no gate whatsoever. This column
-- is the minimum schema needed for `server/src/services/ideaConfidentiality.ts`
-- to enforce the DoD 10.4 bullet "confidential/restricted Ideas do not leak
-- content through AI prompts, exports or telemetry" for the AI-prompt path.
--
-- There is deliberately NO UI yet to set this value — see E12 report. The
-- column defaults to 'standard' (today's unchanged behavior) so existing
-- rows and every write path that doesn't know about this column keep
-- working exactly as before.

ALTER TABLE my_ideas
  ADD COLUMN IF NOT EXISTS confidentiality TEXT NOT NULL DEFAULT 'standard';

-- Keep the value set closed so a typo can't silently create an unrecognized
-- level that every reader has to special-case.
ALTER TABLE my_ideas
  DROP CONSTRAINT IF EXISTS my_ideas_confidentiality_check;
ALTER TABLE my_ideas
  ADD CONSTRAINT my_ideas_confidentiality_check
  CHECK (confidentiality IN ('standard', 'confidential', 'restricted'));

CREATE INDEX IF NOT EXISTS idx_my_ideas_confidentiality
  ON my_ideas (organization_id, confidentiality)
  WHERE confidentiality <> 'standard';
