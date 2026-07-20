-- Migration: 20260720_fala4_kpi_snap_milestone_deps_ai_policies.sql
-- FALA 4 schema-drift sweep — 3 NOT-NULL/missing-column/missing-constraint gaps between
-- application code and the real (live/baseline_gap) schema. Additive + idempotent.

-- ---------------------------------------------------------------------------
-- (a) results_kpi_report_snapshots is missing `kpi_id`/`status`, which
--     server/src/routes/v8/results.routes.ts (POST /workflow/kpi/:kpiId/report,
--     findKpiReportFinalizationViolation) reads/writes. Add both, nullable, so the
--     existing period-scoped multi-KPI report path (kpiReportSnapshotService.ts,
--     which never sets these two columns) is unaffected.
-- ---------------------------------------------------------------------------
ALTER TABLE results_kpi_report_snapshots ADD COLUMN IF NOT EXISTS kpi_id TEXT;
ALTER TABLE results_kpi_report_snapshots ADD COLUMN IF NOT EXISTS status TEXT;
CREATE INDEX IF NOT EXISTS idx_results_kpi_report_snapshots_kpi_id
  ON results_kpi_report_snapshots(kpi_id);

-- ---------------------------------------------------------------------------
-- (b) blueprintService.ts#applyMilestoneDependencies (live: POST
--     /api/initiatives/:id/apply-blueprint) links MILESTONE ids, not initiative ids.
--     The only existing dependency table, `initiative_dependencies`, is initiative-to-
--     initiative with hard NOT-NULL FKs to `initiatives(id)` on from_initiative_id/
--     to_initiative_id — milestone ids would violate those FKs even after a column
--     rename, so this is a genuinely missing table, not a rename. New dedicated table,
--     FK-scoped to `initiative_milestones`.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS initiative_milestone_dependencies (
  id TEXT PRIMARY KEY,
  initiative_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  source_milestone_id TEXT NOT NULL,
  target_milestone_id TEXT NOT NULL,
  dependency_type TEXT NOT NULL DEFAULT 'finish_to_start',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (source_milestone_id) REFERENCES initiative_milestones(id) ON DELETE CASCADE,
  FOREIGN KEY (target_milestone_id) REFERENCES initiative_milestones(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_initiative_milestone_deps_initiative
  ON initiative_milestone_dependencies(initiative_id);
CREATE INDEX IF NOT EXISTS idx_initiative_milestone_deps_source
  ON initiative_milestone_dependencies(source_milestone_id);
CREATE INDEX IF NOT EXISTS idx_initiative_milestone_deps_target
  ON initiative_milestone_dependencies(target_milestone_id);

-- ---------------------------------------------------------------------------
-- (c) ai_policies.organization_id has no unique constraint, so
--     AIPolicyEngine.updatePolicy's `ON CONFLICT(organization_id) DO UPDATE` always
--     42P10s (live callers: PATCH /api/ai/policy, ai-governance.routes.ts policy
--     endpoint). Dedupe any pre-existing duplicate org rows (keep newest) before
--     adding the unique index — defensive; this environment has zero ai_policies
--     rows so the DELETE is a no-op here, but production may not be.
-- ---------------------------------------------------------------------------
DELETE FROM ai_policies
WHERE organization_id IS NOT NULL
  AND id NOT IN (
    SELECT DISTINCT ON (organization_id) id
    FROM ai_policies
    WHERE organization_id IS NOT NULL
    ORDER BY organization_id, updated_at DESC NULLS LAST, id
  );
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_policies_organization_id_unique
  ON ai_policies(organization_id);
