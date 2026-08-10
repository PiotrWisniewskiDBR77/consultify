-- ROI-E003 — Decision & Approved — schema.
--
-- Design: docs/product/results-vnext/ROI_E003_DESIGN.md §3 (FROZEN, full DDL
-- copied verbatim from that document — do not hand-modify without updating
-- the design doc first). Builds on ROI-E001's rvn_roi_cases (server/migrations/
-- 20260815_rvn_roi_core.sql) and ROI-E002's economic-model tables (server/
-- migrations/20260816_rvn_roi_economic_model.sql).
--
-- rvn_roi_cases.original_approved_snapshot_id/latest_approved_snapshot_id
-- already exist as plain nullable UUID columns (ROI-E001's own migration
-- forward-declared them, "FK ALTERed by the epic that creates the referenced
-- table") — this migration is that epic. The 3 new FK constraints below MUST
-- come AFTER rvn_roi_approval_snapshots is created.

-- ============================================================
-- rvn_roi_cases — ALTER: pin the decision under review (D5), the
-- changes-requested audit columns (D6).
-- ============================================================
ALTER TABLE rvn_roi_cases
  ADD COLUMN IF NOT EXISTS decision_calculation_run_id UUID NULL,
  ADD COLUMN IF NOT EXISTS changes_requested_by        TEXT NULL,
  ADD COLUMN IF NOT EXISTS changes_requested_at        TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS changes_requested_reason     TEXT NULL;

-- ============================================================
-- rvn_roi_approval_snapshots — immutable, one row per approval (D10)
-- ============================================================
CREATE TABLE IF NOT EXISTS rvn_roi_approval_snapshots (
  snapshot_id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                        UUID NOT NULL REFERENCES rvn_roi_cases(case_id),
  organization_id                TEXT NOT NULL,

  -- Monotonic per case: 1, 2, 3... Display label "v{sequence_number}.0".
  sequence_number                INT NOT NULL,

  decision_calculation_run_id    UUID NOT NULL REFERENCES rvn_roi_calculation_runs(run_id),

  approved_by                    TEXT NOT NULL,
  approved_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),

  content_hash                   TEXT NOT NULL,
  snapshot_payload               JSONB NOT NULL,

  created_at                     TIMESTAMPTZ NOT NULL DEFAULT now()
  -- No row_version, no UPDATE path, no frozen_at, no trigger — immutable by
  -- construction, matching rvn_roi_calculation_runs' own pattern.
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_rvn_roi_approval_snapshots_case_seq
  ON rvn_roi_approval_snapshots(case_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_approval_snapshots_case
  ON rvn_roi_approval_snapshots(organization_id, case_id, sequence_number DESC);

-- FKs on the two E001-reserved pointer columns, ALTERed here now that the
-- referenced table exists — the exact ALTER ROI-E001's own migration comment
-- forward-declared to "the epic that creates the referenced table."
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_rvn_roi_cases_original_approved_snapshot'
  ) THEN
    ALTER TABLE rvn_roi_cases
      ADD CONSTRAINT fk_rvn_roi_cases_original_approved_snapshot
        FOREIGN KEY (original_approved_snapshot_id) REFERENCES rvn_roi_approval_snapshots(snapshot_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_rvn_roi_cases_latest_approved_snapshot'
  ) THEN
    ALTER TABLE rvn_roi_cases
      ADD CONSTRAINT fk_rvn_roi_cases_latest_approved_snapshot
        FOREIGN KEY (latest_approved_snapshot_id) REFERENCES rvn_roi_approval_snapshots(snapshot_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_rvn_roi_cases_decision_calculation_run'
  ) THEN
    ALTER TABLE rvn_roi_cases
      ADD CONSTRAINT fk_rvn_roi_cases_decision_calculation_run
        FOREIGN KEY (decision_calculation_run_id) REFERENCES rvn_roi_calculation_runs(run_id);
  END IF;
END $$;
