-- AMD-FLOW-ROI-VISIBILITY-002, Variant B — a sixth `visibility_mode` literal,
-- 'ROI_GOVERNED', on the SHARED `rvn_platform_visibility_policies` table.
--
-- CTO design decision (closure-b F2 fan-in): the standalone
-- `rvn_roi_visibility_governance` table (20261020_roi_governed_visibility_policy.sql)
-- and its parallel enforcement logic were a real, working answer, but they
-- created a SECOND, independent visibility system living alongside the
-- shared one every other ROI read surface (11 repositories, plus KPI/OKR)
-- already depends on — reachable only through the two files this packet's
-- own bounded path list touched. Ten-plus untouched ROI repositories kept
-- reading the OLD system regardless. Variant B closes that gap the other
-- way: one more literal in the machinery every read surface ALREADY calls
-- correctly, rather than ten-plus repositories rewritten to call a new one.
--
-- WHAT THIS DOES NOT DO: it does not alter or reinterpret ANY existing
-- literal. OPEN_ORG, SCOPE, MANAGEMENT_CHAIN, PRIVATE, RESTRICTED_ACL keep
-- their exact current CHECK-enforced set and their exact current branching
-- in visibilityScopedQuery.ts/visibilityResolver.ts, both byte-for-byte
-- unchanged for every existing literal. KPI and OKR reads never produce or
-- consult 'ROI_GOVERNED' — this migration is additive only. Proven by
-- running KPI/OKR's existing focused suites unmodified (see the F2 report
-- for exact denominators; this migration does not itself prove that,
-- proof is application-level).
--
-- LATE-SAFE / FAIL-BEFORE-MUTATION: the CHECK constraint on
-- `rvn_platform_visibility_policies.visibility_mode` was declared inline in
-- the original CREATE TABLE (20260809_rvn_platform_visibility_core.sql),
-- so Postgres auto-named it — this migration looks the name up via
-- pg_constraint rather than assuming the default naming convention held,
-- and RAISEs before attempting any DROP/ADD if it cannot find exactly one
-- CHECK constraint on that column. Idempotent on repeat: a second run finds
-- the constraint this migration itself created (same name, same six-literal
-- body), drops it, and re-adds the identical definition — a no-op in
-- effect. Widening-only is inherently safe against existing data: every
-- row that satisfied the five-literal CHECK before still satisfies the
-- six-literal one after, so no existing row can ever violate this ALTER.

DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
    FROM pg_constraint
   WHERE conrelid = 'rvn_platform_visibility_policies'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%visibility_mode%';

  IF con_name IS NULL THEN
    RAISE EXCEPTION
      'rvn_platform_visibility_policies: could not find the visibility_mode CHECK constraint to widen — refusing to guess a name and mutate blind';
  END IF;

  EXECUTE format('ALTER TABLE rvn_platform_visibility_policies DROP CONSTRAINT %I', con_name);
END $$;

ALTER TABLE rvn_platform_visibility_policies
  ADD CONSTRAINT rvn_platform_visibility_policies_visibility_mode_check
  CHECK (visibility_mode IN ('OPEN_ORG','SCOPE','MANAGEMENT_CHAIN','PRIVATE','RESTRICTED_ACL','ROI_GOVERNED'));
