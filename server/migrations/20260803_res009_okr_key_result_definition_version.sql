-- RES-009: durable OKR/Key-Result link to the canonical KPI definition VERSION.
--
-- okr_key_results.kpi_id (914_okr_management.sql) already links a Key Result
-- to a KPI by id, informational-only by design (D7, Piotr 2026-07-12 — Key
-- Results are scored EXCLUSIVELY from manual check-ins/baseline-target-current,
-- never auto-fed from a linked KPI's own value stream; see okrService.ts's
-- KeyResult.kpiId doc comment and recomputeKeyResultScore). That decision is
-- UNCHANGED by this migration.
--
-- What was missing: the id-only link has no notion of WHICH version of the
-- KPI's definition (target/thresholds/direction — RES-02's immutable
-- kpi_definition_versions ledger) was current when the Key Result was linked.
-- Additive, informational-only column, same spirit as kpi_time_series's own
-- definition_version_id pin from RES-003 — ON DELETE SET NULL so an archived/
-- pruned definition version never blocks a Key Result read or write.
ALTER TABLE okr_key_results
  ADD COLUMN IF NOT EXISTS kpi_definition_version_id TEXT
    REFERENCES kpi_definition_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_okr_key_results_kpi_definition_version
  ON okr_key_results (kpi_definition_version_id)
  WHERE kpi_definition_version_id IS NOT NULL;
