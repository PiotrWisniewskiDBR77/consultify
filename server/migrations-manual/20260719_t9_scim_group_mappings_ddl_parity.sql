-- T9-2 — close residual DDL drift on scim_group_mappings vs canonical migration
-- 656_v4_scim_enhanced.sql (+ 20260715_hp25_b2 project_id patch).
--
-- ★★ MANUAL / NON-AUTO-RUN MIGRATION ★★ (same reasoning as the project_id patch:
-- this table had an active P1 cross-org leak; schema changes are applied by hand,
-- never on boot.)
--
-- CONTEXT (2026-07-19 audit): TROLLEY's live scim_group_mappings table was not
-- created by 656_v4_scim_enhanced.sql. It was created by one of the THREE
-- competing `CREATE TABLE IF NOT EXISTS scim_group_mappings` statements that
-- live in application code (server/src/routes/integrations/scim.routes.ts
-- `ensureScimTables()` and server/src/routes/adminP32.routes.ts), whichever ran
-- first — each declares a slightly different column set, and because Postgres
-- `CREATE TABLE IF NOT EXISTS` silently no-ops when the table already exists,
-- 656's canonical CREATE TABLE never actually applied on TROLLEY. organization_id
-- and project_id were added by hand on 07-18 (per T9-2 dispatch note); the rest
-- of the canonical shape was still missing as of 2026-07-19. See the T9-2 report
-- for the full diff and for contentious items intentionally NOT applied here
-- (NOT NULL / FK on organization_id, auto_sync INTEGER vs BOOLEAN, created_at
-- TEXT vs TIMESTAMPTZ with a broken literal 'now()' default).
--
-- SAFETY: applied 2026-07-19 on TROLLEY while the table had 0 rows (verified
-- immediately before running, inside the same transaction as the DDL). All
-- statements are additive/idempotent (IF NOT EXISTS guards) except the id
-- DEFAULT (metadata-only, does not touch existing rows) and the UNIQUE
-- constraint (safe on an empty table; Postgres treats NULLs as distinct so it
-- will not block future org-null rows from the unscoped legacy insert path
-- flagged in the report).

-- ── Postgres (staging=TROLLEY, prod=centerbeam) ──────────────────────────────
ALTER TABLE scim_group_mappings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE scim_group_mappings ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_scim_group_mappings_org ON scim_group_mappings(organization_id);
CREATE INDEX IF NOT EXISTS idx_scim_group_mappings_external ON scim_group_mappings(external_group_id);

ALTER TABLE scim_group_mappings ALTER COLUMN id SET DEFAULT gen_random_uuid()::TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'scim_group_mappings'::regclass
      AND contype = 'u'
      AND conname = 'scim_group_mappings_organization_id_external_group_id_key'
  ) THEN
    ALTER TABLE scim_group_mappings
      ADD CONSTRAINT scim_group_mappings_organization_id_external_group_id_key
      UNIQUE (organization_id, external_group_id);
  END IF;
END $$;

-- NOTE: run ONLY on an empty (or verified-safe) table. Re-check row count
-- before re-applying on prod (centerbeam) or any other environment.
