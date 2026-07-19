-- RED-RISK (2026-07-19): create missing risk_register table (never existed on Postgres).
--
-- ROOT CAUSE: no CREATE TABLE for risk_register was ever committed to server/migrations
-- (checked server/migrations, server/migrations-archive, all *.sql.sql dead migrations —
-- none define it). Only the JS/TS callers assume it exists. Result on demo/parity:
--   * report-builder steering report -> programManagementReportsService.buildSteering
--     -> aiRiskChangeControl.getOpenRisks(risk_register) -> 42P01 (relation does not exist)
--   * managementReportsService -> ManagementReportRepository.getActiveRisksAndIssues /
--     getRiskSummary -> same 42P01
--
-- Column shapes mirror the SQL in:
--   server/src/services/aiRiskChangeControl.ts (_registerRisk INSERT, getOpenRisks SELECT,
--     updateRiskStatus UPDATE, explainRisk/preEscalationWarning SELECT * ... WHERE id = ?)
--   server/src/repositories/ManagementReportRepository.ts (getRiskSummary, getActiveRisksAndIssues)
--
-- This migration is ADDITIVE + IDEMPOTENT (IF NOT EXISTS everywhere).
--
-- NOTE (sibling, NOT created here — out of scope for this migration):
--   scope_change_log (same two services, aiRiskChangeControl.trackScopeChange /
--   getScopeChangeSummary + ManagementReportRepository) is ALSO missing on Postgres and has
--   the same live caller chain. Flagged separately — see robot task spawned alongside this
--   migration.

CREATE TABLE IF NOT EXISTS risk_register (
  id                  TEXT PRIMARY KEY,
  project_id          TEXT NOT NULL,
  organization_id     TEXT,
  risk_type           TEXT NOT NULL,
  severity            TEXT NOT NULL,
  title               TEXT NOT NULL,
  description         TEXT,
  trigger_conditions  TEXT,
  affected_entities   TEXT,
  status              TEXT NOT NULL DEFAULT 'open',
  owner_id            TEXT,
  resolution_notes    TEXT,
  detected_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at         TIMESTAMPTZ,
  escalated_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_risk_register_project
  ON risk_register(project_id);
CREATE INDEX IF NOT EXISTS idx_risk_register_org
  ON risk_register(organization_id);
CREATE INDEX IF NOT EXISTS idx_risk_register_status
  ON risk_register(status);
CREATE INDEX IF NOT EXISTS idx_risk_register_owner
  ON risk_register(owner_id);
