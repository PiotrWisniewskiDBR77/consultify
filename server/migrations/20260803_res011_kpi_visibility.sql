-- RES-11 (Phase 1) — KPI visibility contract.
--
-- Adds the visibility concept the RES-011_IMPLEMENTATION_PACKET.md discovery
-- confirmed did not exist anywhere in the schema. Per the packet's own
-- recommendation (§4): lands on `initiative_kpis` (the RES-02 canonical KPI
-- owner object), not a new table and not `initiative_kpi_mappings` — a KPI
-- is today effectively 1:1 with its initiative, so a per-KPI flag is the
-- simpler, correct owner.
--
-- Three scopes, safe default:
--   org_visible          — visible to any authenticated member of the org (today's
--                           de facto behavior — MUST be the default, or every
--                           existing query's result set silently changes).
--   initiative_restricted — visible to org admins and to `initiative_resources`
--                           members of the KPI's own initiative (the real,
--                           already-existing team-membership model — see
--                           `getInitiativeResourcesRead` in
--                           planningPortfolioReadService.ts. No new membership
--                           concept invented).
--   private_to_owner      — visible to org admins and to `owner_user_id` only.
--
-- CHECK constraint enforces the closed set at the database, not just in
-- application code — a bad value can never land silently.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, and the CHECK constraint is
-- conditionally added only if absent, so re-running this file is a no-op
-- once converged.

ALTER TABLE initiative_kpis
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'org_visible';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'initiative_kpis_visibility_chk'
  ) THEN
    ALTER TABLE initiative_kpis
      ADD CONSTRAINT initiative_kpis_visibility_chk
      CHECK (visibility IN ('org_visible', 'initiative_restricted', 'private_to_owner'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_initiative_kpis_visibility ON initiative_kpis(visibility);
