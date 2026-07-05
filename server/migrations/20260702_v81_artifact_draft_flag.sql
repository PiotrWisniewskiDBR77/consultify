-- V8.1 Artifact Draft Flag (S6.3 — M17 junk filter)
-- Adds a presentational draft/final split to v8_output_artifacts so the
-- Outputs Library (M17) and the presentation generator "Select Data Sources"
-- step can hide throwaway/test/duplicate artifacts by default while keeping a
-- dedicated "Robocze" (drafts) view behind ?include=drafts.
--
-- SAFE BY DESIGN:
--   * is_draft defaults to 0 (real/final) so no existing real output disappears.
--   * The heuristic backfill only *flips to draft* rows whose title clearly
--     marks them as test scaffolding (E2E / smoke / THROWAWAY / PROBE / test).
--     It NEVER deletes data — trash purge is a separate owner-approved op.

ALTER TABLE v8_output_artifacts
  ADD COLUMN IF NOT EXISTS is_draft INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_v81_artifacts_org_is_draft
  ON v8_output_artifacts(organization_id, is_draft);

-- Heuristic backfill: mark obvious test/throwaway scaffolding as draft.
-- Matches the artifact's own title_snapshot (case-insensitive). Origin-record
-- titles (report/deck) are left to the runtime backfill guard, which re-runs
-- the same heuristic against joined titles.
UPDATE v8_output_artifacts
   SET is_draft = 1
 WHERE is_draft = 0
   AND title_snapshot IS NOT NULL
   AND (
        title_snapshot LIKE '%E2E%'
     OR title_snapshot LIKE '%THROWAWAY%'
     OR title_snapshot LIKE '%PROBE%'
     OR LOWER(title_snapshot) LIKE '%smoke%'
     OR LOWER(title_snapshot) LIKE '%toreport-%'
     OR LOWER(title_snapshot) LIKE '%test %'
     OR LOWER(title_snapshot) LIKE '% test%'
     OR LOWER(title_snapshot) LIKE 'test%'
   );
