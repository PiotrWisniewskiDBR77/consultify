-- RN-G6-SRV — D08/B2: persist the `not_calculable` REASON at Set and
-- Check-in level (docs/product/results-vnext/RN_G2_OPEN_QUESTIONS_UI.md
-- §OQ-UI-C).
--
-- Diagnosis (re-verified against landed code before writing this file):
--   - Objective/Key Result already persist their own progress/confidence
--     REASON (`okr_vnext_objectives.progress_calc_reason`/
--     `confidence_calc_reason`, `okr_vnext_key_results.progress_calc_reason`
--     — both from 20260824_rvn_okr_objective_key_result.sql). Those two
--     levels already round-trip `null` vs `'not_calculable: ...'` correctly.
--   - `okrSetRollupCalculator.ts::computeSetRollup` ALREADY COMPUTES a
--     separate progress/confidence reason string (it just concatenates them
--     into one combined `reason` field today) — `applySetRollupUpdate`
--     (okrCheckInCommands.ts) never puts either half in its `UPDATE
--     okr_vnext_sets` column list, so the computed value is thrown away.
--     `okr_vnext_sets` (20260823_rvn_okr_set.sql) has no reason column at
--     all for `overall_progress`/`overall_confidence`.
--   - `okr_vnext_checkins.calculated_progress` (20260825_rvn_okr_checkin.sql)
--     has NO reason column whatsoever, even though `recordCheckIn`/
--     `correctCheckIn` already compute `progressCalc.reason` (the exact
--     same `calculateKeyResultProgress` reason string that DOES get
--     persisted onto the sibling Key Result row via
--     `okr_vnext_key_results.progress_calc_reason` in the same statement).
--
-- Effect today: at Set and Check-in level, `null` and "nieobliczalne" render
-- IDENTICALLY on the wire — a direct violation of D08 (`null` ≠ zero ≠
-- not_calculable) for those two surfaces specifically.
--
-- This migration is PURELY ADDITIVE: three nullable columns, no rewrite of
-- any existing row, no backfill (every existing row simply reads NULL for
-- these three columns until the next command run recomputes it — same
-- "reserved for a not-yet-built epic" precedent
-- `okr_vnext_sets.overall_progress`/`overall_confidence` itself used when
-- OKR-E002 first reserved them ahead of OKR-E004). No CHECK constraint is
-- added — these are free-text audit-trail reasons, exactly like the
-- Objective/Key-Result/Set-version `reason`/`*_calc_reason` columns already
-- on these tables, none of which carry a CHECK either. Additive migration,
-- no rollback required.

ALTER TABLE okr_vnext_sets
  ADD COLUMN IF NOT EXISTS overall_progress_reason   TEXT NULL,
  ADD COLUMN IF NOT EXISTS overall_confidence_reason  TEXT NULL;

ALTER TABLE okr_vnext_checkins
  ADD COLUMN IF NOT EXISTS calculated_progress_reason TEXT NULL;
