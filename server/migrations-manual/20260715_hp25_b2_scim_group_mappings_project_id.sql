-- HP-25 B2 — add optional per-project dimension to scim_group_mappings
--
-- ★★ MANUAL / NON-AUTO-RUN MIGRATION ★★
-- This file lives in server/migrations-manual/ ON PURPOSE. The auto-run loader
-- (server/src/database/DatabaseInitializer.ts) only scans server/migrations/ for
-- files matching /^(7\d{2}|\d{8})_.*\.sql$/. Files here are NEVER auto-applied.
-- Apply it by hand on each environment (demo/TROLLEY first, per demo=holy rule),
-- with an explicit go-ahead — see Harvard/wdrozenie-100/_KONCEPT_HP25_GOVERNANCE_SYNC.md.
--
-- WHY MANUAL: scim_group_mappings had an active P1 cross-org leak 48h ago
-- (fix 3edaf2a130). Schema changes on this table are applied deliberately, not
-- on boot, so a bad column add can never take the security-sensitive table down
-- with it. The application code tolerates the column being absent (it falls back
-- to org-wide mappings), so applying this migration is a no-downtime upgrade.
--
-- SEMANTICS: project_id NULL = org-wide mapping (legacy behaviour, unchanged).
--            project_id set  = mapping applies only to that project.
--            Resolution precedence (see scimGroupMappingService.resolveScimGroupGrant):
--              project-specific mapping wins over the org-wide mapping.
--
-- SAFETY: the org-scope of every row still lives in organization_id. project_id
--         is validated at write time to belong to the same organization; this
--         migration only adds the nullable column + a scoped lookup index.

-- ── Postgres (staging=TROLLEY, prod=centerbeam) ──────────────────────────────
ALTER TABLE scim_group_mappings ADD COLUMN IF NOT EXISTS project_id TEXT;

CREATE INDEX IF NOT EXISTS idx_scim_group_mappings_org_group_project
  ON scim_group_mappings (organization_id, external_group_id, project_id);

-- ── SQLite (local/mock) equivalent — run manually if targeting a SQLite file ──
-- SQLite lacks "ADD COLUMN IF NOT EXISTS"; guard with a pragma check or ignore
-- the "duplicate column name" error if re-applied:
--   ALTER TABLE scim_group_mappings ADD COLUMN project_id TEXT;
--   CREATE INDEX IF NOT EXISTS idx_scim_group_mappings_org_group_project
--     ON scim_group_mappings (organization_id, external_group_id, project_id);
