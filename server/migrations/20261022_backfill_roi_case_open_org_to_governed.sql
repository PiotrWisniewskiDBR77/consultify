-- AMD-FLOW-ROI-VISIBILITY-002, Variant B — backfill: re-stamp PRE-EXISTING
-- 'roi_case' resource-visibility rows from 'OPEN_ORG' to 'ROI_GOVERNED'.
--
-- THE GAP THIS CLOSES (found by the parallel read-surface audit, closure-b
-- F2 fan-in): 20261021 adds the governed mode and the machinery to enforce
-- it, but ONLY for resources whose `visibility_mode` literally already
-- reads 'ROI_GOVERNED'. A `rvn_platform_resource_visibility` row for a
-- `roi_case` created BEFORE this packet still carries whatever mode
-- `createRoiCase` wrote at the time — historically 'OPEN_ORG' (the only
-- value this codebase's `domain='roi'` policy ever held, per closure-b F2
-- Phase 1 findings: the SYNTHETIC_TEST_ONLY fixture that used to publish
-- it always used mode 'OPEN_ORG', and no other production writer existed
-- before this packet). The 'OPEN_ORG' branch in both
-- visibilityScopedQuery.ts and visibilityResolver.ts has NO membership or
-- ACTIVE-status check of any kind — it admits any caller whose JWT carries
-- the resource's organizationId, full stop. Without this migration, "the
-- governed policy is the real authority for ROI reads" is true only for
-- brand-new cases created after this packet lands; every pre-existing case
-- would stay openly visible to any org member, through all 11 ROI
-- repositories, forever — the whole point of AMD-FLOW-ROI-VISIBILITY-002
-- would be bypassed for exactly the data that already exists.
--
-- MEASURED, NOT ASSUMED: closure-b F2 queried a fresh `fin_candidate_base`-
-- derived clone before writing this migration — zero `rvn_roi_cases` rows,
-- zero `rvn_platform_resource_visibility` rows for resource_type='roi_case'
-- exist there. That tells us nothing about a real tenant database, which
-- this environment cannot see. This migration is written to be correct and
-- safe regardless of that count — including the correct, safe, and
-- currently-unverifiable-from-here case where it is zero.
--
-- SCOPE, PRECISELY: touches ONLY rows where
-- `resource_type = 'roi_case' AND visibility_mode = 'OPEN_ORG'`. Every
-- other resource_type (kpi, kpi_scorecard, okr_set, okr_program, okr_cycle,
-- okr_alignment, deviation_case) is untouched — the WHERE clause's
-- resource_type predicate is not optional, and this migration never
-- touches `rvn_platform_visibility_policies` (the historical, versioned
-- POLICY audit log — re-stamping past policy-publish records would falsify
-- history; only the per-resource CURRENT-STATE snapshot table is updated).
-- A `roi_case` row already under a DIFFERENT mode (PRIVATE/SCOPE/
-- MANAGEMENT_CHAIN/RESTRICTED_ACL/ROI_GOVERNED already) is left exactly as
-- it is — this migration narrows OPEN_ORG specifically, it does not
-- normalize every roi_case row to one mode.
--
-- THIS NARROWS EXISTING DATA ON PURPOSE, NOT AS A SIDE EFFECT: a
-- pre-existing case visible to every org member under the old default
-- becomes visible only to a same-tenant ACTIVE OWNER, ACTIVE ADMIN, or
-- current Finance-authority-grant holder after this runs — exactly the
-- rule the owner decision states, applied retroactively to data that
-- predates the rule. That is the intended outcome of this migration, not
-- an accepted side effect.
--
-- FAIL BEFORE MUTATION: verifies the CHECK constraint on
-- rvn_platform_visibility_policies.visibility_mode already permits the
-- literal 'ROI_GOVERNED' before touching a single row — i.e. that
-- 20261021_rvn_platform_visibility_roi_governed_mode.sql has already run.
-- RAISEs and updates zero rows if it has not, rather than writing a value
-- into rvn_platform_resource_visibility (a table with no CHECK constraint
-- of its own — the UPDATE below would otherwise "succeed" while producing
-- a value the shared read machinery does not yet have a branch for).
--
-- IDEMPOTENT / REPEAT-SAFE: the UPDATE's own WHERE clause
-- (visibility_mode = 'OPEN_ORG') matches zero rows on a second run, because
-- the first run already flipped every matching row to 'ROI_GOVERNED' — a
-- genuine no-op, not merely a non-error.

DO $$
DECLARE
  check_permits_roi_governed boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'rvn_platform_visibility_policies'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) LIKE '%ROI_GOVERNED%'
  ) INTO check_permits_roi_governed;

  IF NOT check_permits_roi_governed THEN
    RAISE EXCEPTION
      'rvn_platform_visibility_policies.visibility_mode CHECK does not yet permit ROI_GOVERNED — run 20261021_rvn_platform_visibility_roi_governed_mode.sql first; refusing to touch any rvn_platform_resource_visibility row';
  END IF;
END $$;

UPDATE rvn_platform_resource_visibility
   SET visibility_mode = 'ROI_GOVERNED'
 WHERE resource_type = 'roi_case'
   AND visibility_mode = 'OPEN_ORG';
