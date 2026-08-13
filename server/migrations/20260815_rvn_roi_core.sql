-- ROI-E001 — Case & Baseline — core schema (rvn_roi_cases / rvn_roi_baselines).
--
-- Design: docs/product/results-vnext/ROI_E001_DESIGN.md §3 (FROZEN, full DDL
-- copied verbatim from that document — do not hand-modify without updating
-- the design doc first). Builds on the RN-G1 platform foundation
-- (rvn_platform_events/outbox, rvn_platform_resource_visibility,
-- rvn_platform_visibility_policies — see server/migrations/20260809_rvn_platform_*.sql)
-- and the KPI domain's own schema conventions (server/migrations/20260810_rvn_kpi_core.sql).
--
-- Visibility is platform-owned, not domain-owned (design doc §3 header,
-- RN-G1 §C.3) — rvn_roi_cases carries NO visibility_mode/visibility_policy_id
-- columns of its own. Visibility lives exclusively in
-- rvn_platform_resource_visibility (resource_type='roi_case') and
-- rvn_platform_resource_acl, exactly like rvn_kpi_definitions.
--
-- initiatives.id is TEXT, not UUID (design doc §2, confirmed against
-- roi_assumptions.initiative_id TEXT and rvn_kpi_initiative_impacts's own
-- comment) — rvn_roi_cases.initiative_id is TEXT REFERENCES initiatives(id).

-- ============================================================
-- rvn_roi_cases — root aggregate
-- ============================================================
CREATE TABLE IF NOT EXISTS rvn_roi_cases (
  case_id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id                TEXT NOT NULL,
  initiative_id                  TEXT NOT NULL REFERENCES initiatives(id),
  title                          TEXT NOT NULL,
  owner_user_id                  TEXT NOT NULL,

  -- Full lifecycle forward-declared now so ROI-E003/E005/E006 never ALTER
  -- this CHECK — same trick rvn_kpi_definitions.response_policy_id used
  -- ahead of KPI-E003.
  status                         TEXT NOT NULL DEFAULT 'draft'
                                    CHECK (status IN (
                                      'not_started','draft','modeling','ready_for_review',
                                      'submitted_for_approval','changes_requested','approved',
                                      'rejected','tracking','benefits_realization',
                                      'post_investment_review_due','post_investment_review',
                                      'closed','cancelled'
                                    )),

  currency                       TEXT NOT NULL,
  granularity                    TEXT NOT NULL DEFAULT 'monthly'
                                    CHECK (granularity IN ('monthly','annual')),
  analysis_start                 DATE NULL,
  analysis_end                   DATE NULL,

  -- FKs to E002/E003 tables intentionally omitted (those tables don't exist
  -- yet) — plain nullable UUID columns now, FK ALTERed by the epic that
  -- creates the referenced table, same resolution rvn_kpi_definitions.
  -- current_definition_version_id used ahead of its own FK.
  original_approved_snapshot_id  UUID NULL,
  latest_approved_snapshot_id    UUID NULL,
  current_forecast_version_id    UUID NULL,
  current_actual_snapshot_id     UUID NULL,

  next_action_type               TEXT NULL,
  next_action_due_at             TIMESTAMPTZ NULL,
  next_review_at                 TIMESTAMPTZ NULL,

  -- Reserved ahead of ROI-E003 (Decision D6) — nullable, untouched by any
  -- E001 command.
  submitted_by                   TEXT NULL,
  submitted_at                   TIMESTAMPTZ NULL,
  approved_by                    TEXT NULL,
  approved_at                    TIMESTAMPTZ NULL,
  rejected_by                    TEXT NULL,
  rejected_at                    TIMESTAMPTZ NULL,
  rejection_reason               TEXT NULL,

  -- Archive flag, orthogonal to status (Decision D4).
  archived_at                    TIMESTAMPTZ NULL,
  archived_by                    TEXT NULL,

  row_version                    INT NOT NULL DEFAULT 1,
  created_by                     TEXT NOT NULL,
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                     TEXT NULL,
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rvn_roi_cases_org_status
  ON rvn_roi_cases(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_cases_initiative
  ON rvn_roi_cases(organization_id, initiative_id);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_cases_org_archived
  ON rvn_roi_cases(organization_id, archived_at);

-- AC-02: one active Case per Initiative. Cancelled/closed cases don't
-- block a new one — same shape as
-- ux_rvn_kpi_initiative_impacts_one_active.
CREATE UNIQUE INDEX IF NOT EXISTS ux_rvn_roi_cases_one_active_per_initiative
  ON rvn_roi_cases(organization_id, initiative_id)
  WHERE status NOT IN ('cancelled','closed');

-- ============================================================
-- rvn_roi_baselines — 1:1 child, period-aware, freezable
-- ============================================================
CREATE TABLE IF NOT EXISTS rvn_roi_baselines (
  baseline_id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                        UUID NOT NULL UNIQUE REFERENCES rvn_roi_cases(case_id),
  organization_id                TEXT NOT NULL,

  -- AC-05 "period-aware": nullable — an empty shell row is created
  -- alongside the Case and stays incomplete until filled in; incomplete
  -- is a legitimate 'modeling'-state row, not an error (honest-missing
  -- philosophy, AC-03).
  baseline_period_start          DATE NULL,
  baseline_period_end            DATE NULL,
  current_measured_value         NUMERIC NULL,
  current_measured_unit          TEXT NULL,
  current_measured_as_of         DATE NULL,
  bau_projection_method          TEXT NOT NULL DEFAULT 'flat'
                                    CHECK (bau_projection_method IN ('flat','growth_rate','custom')),
  bau_growth_rate_pct            NUMERIC NULL,
  bau_reference_value            NUMERIC NULL,
  intervention_comparison_notes  TEXT NULL,
  source                         TEXT NULL,
  confidence                     TEXT NULL CHECK (confidence IN ('low','medium','high')),
  owner_user_id                  TEXT NULL,

  -- Local freeze flag — NOT a read of rvn_roi_cases.status (see §4.5 for
  -- why this must be self-contained rather than cross-table).
  frozen_at                      TIMESTAMPTZ NULL,
  frozen_by                      TEXT NULL,

  row_version                    INT NOT NULL DEFAULT 1,
  created_by                     TEXT NOT NULL,
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rvn_roi_baselines_org
  ON rvn_roi_baselines(organization_id, case_id);

CREATE OR REPLACE FUNCTION rvn_roi_baselines_protect_frozen()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.frozen_at IS NOT NULL THEN
    IF NEW.baseline_period_start IS DISTINCT FROM OLD.baseline_period_start
       OR NEW.baseline_period_end IS DISTINCT FROM OLD.baseline_period_end
       OR NEW.current_measured_value IS DISTINCT FROM OLD.current_measured_value
       OR NEW.current_measured_unit IS DISTINCT FROM OLD.current_measured_unit
       OR NEW.current_measured_as_of IS DISTINCT FROM OLD.current_measured_as_of
       OR NEW.bau_projection_method IS DISTINCT FROM OLD.bau_projection_method
       OR NEW.bau_growth_rate_pct IS DISTINCT FROM OLD.bau_growth_rate_pct
       OR NEW.bau_reference_value IS DISTINCT FROM OLD.bau_reference_value
       OR NEW.intervention_comparison_notes IS DISTINCT FROM OLD.intervention_comparison_notes
       OR NEW.source IS DISTINCT FROM OLD.source
       OR NEW.confidence IS DISTINCT FROM OLD.confidence
    THEN
      RAISE EXCEPTION
        'rvn_roi_baselines: baseline % is frozen — only row_version/updated_at bookkeeping may change',
        OLD.baseline_id
        USING ERRCODE = '23001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rvn_roi_baselines_protect_frozen ON rvn_roi_baselines;
CREATE TRIGGER trg_rvn_roi_baselines_protect_frozen
  BEFORE UPDATE ON rvn_roi_baselines
  FOR EACH ROW EXECUTE FUNCTION rvn_roi_baselines_protect_frozen();
