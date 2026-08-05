-- M05-FIX-01 — forward reconciliation of the candidate acceptance receipt.
--
-- WHY THIS FILE EXISTS (and 932_initiative_candidate_acceptance_receipt.sql does not run)
-- --------------------------------------------------------------------------------------
-- On THIS branch the runtime discovery pattern is inline, in two places that must
-- agree: server/src/services/tablePlatform/migrationRunner.ts:26 and
-- server/src/database/DatabaseInitializer.ts:3198, both
-- `/^(7\d{2}|\d{8})_.*\.sql$/`. (A later refactor on the unmerged M01/M02 runner
-- branches extracts this into migrationIdentity.ts as isRuntimeMigrationFile();
-- that file does NOT exist here — do not cite it as the local contract.)
--
-- `932_*` matches neither branch (9 != 7; three digits != eight), so the runtime
-- runner never discovered it — it did not fail, it was never seen, and nothing
-- appeared in tp_migration_history. Verified 2026-08-05 against the LIVE demo
-- database: initiative_candidates had 10 columns, none of the three below.
--
-- The pattern is intentionally narrow: four unrelated `932_*` files exist, and
-- widening the regex would activate all of them at once without individual review.
-- The sanctioned answer is therefore a date prefix — which is what this file is.
-- It touches neither the historical 932 file nor any allowlist, so it carries no
-- risk to migration history and no coupling to the unmerged runner branches.
--
-- Discovered by: the runtime runner (8-digit date branch), the consolidated
-- M01/M02 runner (same predicate), and the manual script (phase-1 DATED).
--
-- Idempotent by construction: safe to apply on a database where 932 was already
-- applied by the manual script (verified in both orders), and safe to re-apply.
--
-- ORDERING: this file assumes initiative_candidates exists. Its producer,
-- 20260627_initiative_candidates.sql, sorts earlier under every runner here, so
-- the assumption holds on a fresh schema. Same exposure as 932; not widened.

ALTER TABLE initiative_candidates
  ADD COLUMN IF NOT EXISTS initiative_id TEXT,
  ADD COLUMN IF NOT EXISTS duplicate_of_initiative_id TEXT,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

-- Lookup path for "which initiative did this org's candidate resolve to".
CREATE INDEX IF NOT EXISTS idx_initiative_candidates_initiative
  ON initiative_candidates(organization_id, initiative_id)
  WHERE initiative_id IS NOT NULL;

-- (An earlier draft of this file added a second, partial index on (id) WHERE
-- initiative_id IS NULL, justified as an "idempotency anchor". That was wrong on
-- both counts and has been removed: the acceptance claim is looked up by PRIMARY
-- KEY, so the index bought nothing, and its stated purpose — making a half-written
-- receipt visible — was self-contradictory, since `WHERE initiative_id IS NULL`
-- excludes exactly the rows it claimed to expose. The idempotency guarantee comes
-- from the conditional UPDATE in acceptCandidate, not from an index.)
