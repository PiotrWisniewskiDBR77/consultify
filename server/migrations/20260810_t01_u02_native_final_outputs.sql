-- U02-A — native Report Builder + Presentation artifacts for Transformation final outputs.
--
-- Before U02 the final-output manifest recorded only two files. The files were
-- therefore the primary truth store: nothing pointed at an editable, versioned
-- owner artifact, so "the report" could not be opened, reviewed or amended in
-- the module that owns reports. This migration makes the manifest reference the
-- native owner rows and their immutable versions, and makes those version
-- tables fail closed on duplicates.
--
-- Forward-only and additive: every statement is IF NOT EXISTS / ADD COLUMN, so
-- re-running is a no-op and a rollback is simply not applying it (existing rows
-- keep working with NULL native references, which readback treats as legacy).

ALTER TABLE transformation_final_output_runs
  ADD COLUMN IF NOT EXISTS native_report_id TEXT;
ALTER TABLE transformation_final_output_runs
  ADD COLUMN IF NOT EXISTS native_report_version_id TEXT;
ALTER TABLE transformation_final_output_runs
  ADD COLUMN IF NOT EXISTS native_report_version_number INTEGER;
ALTER TABLE transformation_final_output_runs
  ADD COLUMN IF NOT EXISTS native_deck_id TEXT;
ALTER TABLE transformation_final_output_runs
  ADD COLUMN IF NOT EXISTS native_deck_version_id TEXT;
ALTER TABLE transformation_final_output_runs
  ADD COLUMN IF NOT EXISTS native_deck_version_number INTEGER;
ALTER TABLE transformation_final_output_runs
  ADD COLUMN IF NOT EXISTS report_registry_artifact_id TEXT;
ALTER TABLE transformation_final_output_runs
  ADD COLUMN IF NOT EXISTS deck_registry_artifact_id TEXT;

CREATE INDEX IF NOT EXISTS idx_transformation_final_output_runs_native_report
  ON transformation_final_output_runs (organization_id, native_report_id);
CREATE INDEX IF NOT EXISTS idx_transformation_final_output_runs_native_deck
  ON transformation_final_output_runs (organization_id, native_deck_id);

-- Immutable-version uniqueness — FAIL CLOSED.
--
-- Neither owner table had a uniqueness guarantee: `report_builder_versions.
-- version_number` is computed with SELECT MAX(...)+1 and both deck-version
-- writers pass a pre-read version, so concurrent writers could produce two rows
-- claiming the same version. Under U02 that would let one facts digest end up
-- with two "immutable" versions — the manifest would name one of them and the
-- other would be an unreferenced impostor.
--
-- Contract when legacy duplicates exist:
--   * NOTHING is deleted or rewritten. Version history is user data.
--   * The migration ABORTS with the affected owner IDs and version numbers, so
--     release readiness is blocked until an operator reconciles them. A skipped
--     index would otherwise let the release proceed believing a constraint
--     exists that does not.
--   * Re-running after reconciliation creates the indexes and is idempotent.
--
-- Reconciliation is deliberately manual: only the owner can decide which of two
-- rows claiming version N is the real one.
DO $$
DECLARE
  duplicate_groups INTEGER;
  affected TEXT;
BEGIN
  IF to_regclass('public.report_builder_versions') IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*), string_agg(sample, '; ' ORDER BY sample)
    INTO duplicate_groups, affected
    FROM (
      SELECT format('report_id=%s version_number=%s rows=%s',
                    report_id, version_number, COUNT(*)) AS sample
        FROM report_builder_versions
       GROUP BY report_id, version_number
      HAVING COUNT(*) > 1
       LIMIT 25
    ) d;

  IF COALESCE(duplicate_groups, 0) > 0 THEN
    RAISE EXCEPTION
      'U02_DUPLICATE_REPORT_VERSIONS: % duplicate (report_id, version_number) group(s) block the immutable-version constraint. Affected: %',
      duplicate_groups, affected
      USING HINT =
        'No rows were changed. Reconcile the listed report versions (keep one row per version_number, renumber or archive the rest), then re-run this migration.';
  END IF;

  CREATE UNIQUE INDEX IF NOT EXISTS report_builder_versions_report_version_uq
    ON report_builder_versions (report_id, version_number);
END $$;

DO $$
DECLARE
  duplicate_groups INTEGER;
  affected TEXT;
BEGIN
  IF to_regclass('public.presentation_deck_versions') IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*), string_agg(sample, '; ' ORDER BY sample)
    INTO duplicate_groups, affected
    FROM (
      SELECT format('deck_id=%s version=%s rows=%s', deck_id, version, COUNT(*)) AS sample
        FROM presentation_deck_versions
       GROUP BY deck_id, version
      HAVING COUNT(*) > 1
       LIMIT 25
    ) d;

  IF COALESCE(duplicate_groups, 0) > 0 THEN
    RAISE EXCEPTION
      'U02_DUPLICATE_DECK_VERSIONS: % duplicate (deck_id, version) group(s) block the immutable-version constraint. Affected: %',
      duplicate_groups, affected
      USING HINT =
        'No rows were changed. Reconcile the listed deck versions (keep one row per version, renumber or archive the rest), then re-run this migration.';
  END IF;

  CREATE UNIQUE INDEX IF NOT EXISTS presentation_deck_versions_deck_version_uq
    ON presentation_deck_versions (deck_id, version);
END $$;
