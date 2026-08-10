-- RN-G6 — `finance_projection` outbox consumer — schema.
--
-- Design: docs/product/results-vnext/RN_G6_FINANCE_PROJECTION_DESIGN.md §2/
-- §2.1/§5. Three pieces, all additive, none touch a landed migration file:
--   1. New table `rvn_roi_finance_projections` — the read-model this
--      consumer projects into. No `financial_*` table is touched anywhere
--      in this program (§2 — confirmed dead end: `financial_roi_links` has
--      no column shaped like `rvn_roi_cases.case_id`).
--   2. Two additive, nullable columns on the already-landed
--      `rvn_roi_finance_links` (20260820_rvn_roi_finance_seam.sql) — the
--      genuine schema gap §2.1 identifies: a link pins an artifact
--      *reference* but never had anywhere to put a Finance *value* to diff
--      against.
--   3. A partial unique index on the already-landed
--      `rvn_roi_finance_reconciliations` — the DB-level race backstop for
--      "never open a second reconciliation while one is unresolved for the
--      same link" (§5.3).
--
-- ============================================================
-- DEVIATION FROM THE FROZEN DDL, DOCUMENTED (verify-signatures-yourself
-- catch, not a silent edit): design §2's literal DDL declares
--   finance_link_id UUID PRIMARY KEY REFERENCES rvn_roi_finance_links(link_id)
-- with no ON DELETE clause. `removeRoiFinanceLink`
-- (roiFinanceLinkCommands.ts, landed ROI-E007, NOT touched by this
-- migration) performs a literal hard `DELETE FROM rvn_roi_finance_links`.
-- A plain (default NO ACTION) FK from this new table would then BLOCK that
-- DELETE the instant a projection row exists for the link being removed —
-- which is the common case, not an edge case, since `finance_link_created`
-- fans out to `finance_projection` and a drained outbox creates exactly
-- such a row. `ON DELETE CASCADE` would silently destroy the projection
-- row instead, contradicting §7's explicit "is_link_active = false
-- (history retained)" for `roi.finance_link_removed` — Postgres has no FK
-- action that means "block neither side, keep both rows." Resolution:
-- `finance_link_id` stays a UUID PRIMARY KEY populated 1:1 from
-- `rvn_roi_finance_links.link_id`, but WITHOUT a DB-enforced FK constraint
-- — the exact same "pinned reference, no coupling" shape
-- `rvn_roi_finance_links.finance_artifact_id` already uses toward Finance's
-- own tables (D4), just applied one hop closer to home. This is the one
-- place this migration's DDL is not a byte-for-byte copy of §2; every other
-- column/index/CHECK below is copied verbatim.
-- ============================================================
CREATE TABLE IF NOT EXISTS rvn_roi_finance_projections (
  finance_link_id          UUID PRIMARY KEY,
  case_id                  UUID NOT NULL REFERENCES rvn_roi_cases(case_id),
  organization_id          TEXT NOT NULL,

  case_status               TEXT NOT NULL,
  is_link_active             BOOLEAN NOT NULL DEFAULT true,

  tracked_metric              TEXT NULL,
  roi_value                    NUMERIC NULL,
  roi_value_currency            TEXT NULL,

  source_kind                    TEXT NULL CHECK (source_kind IN
                                   ('approval_snapshot','forecast_version','actual_snapshot')),
  source_id                        UUID NULL,
  source_sequence_number             INT NULL,

  reconciliation_status                TEXT NULL,
  last_reconciliation_id                 UUID NULL REFERENCES rvn_roi_finance_reconciliations(reconciliation_id),

  projected_at                             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_finance_projections_case
  ON rvn_roi_finance_projections(organization_id, case_id);

-- ============================================================
-- §2.1 — additive columns on the landed rvn_roi_finance_links. Both
-- nullable, zero impact on existing rows (IO-F1: caller-supplied, no owner
-- built in this slice). `tracked_metric` reuses the SAME five-value
-- vocabulary as `ROI_COMPARE_METRICS` (roiCompareRepository.ts) rather than
-- inventing a parallel taxonomy.
-- ============================================================
ALTER TABLE rvn_roi_finance_links
  ADD COLUMN IF NOT EXISTS tracked_metric        TEXT NULL,
  ADD COLUMN IF NOT EXISTS pinned_finance_value  NUMERIC NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_rvn_roi_finance_links_tracked_metric'
  ) THEN
    ALTER TABLE rvn_roi_finance_links
      ADD CONSTRAINT chk_rvn_roi_finance_links_tracked_metric
        CHECK (tracked_metric IS NULL OR tracked_metric IN
          ('npv','simpleRoi','totalCosts','totalFinancialBenefits','paybackPeriods'));
  END IF;
END $$;

-- ============================================================
-- §5.3 guard 2 — DB-level race backstop: never more than one open/
-- investigating reconciliation per link, enforced even when two dispatcher
-- workers both pass the application-level check concurrently. A unique
-- violation against this index is caught by the consumer and treated as
-- "already opened," never surfaced as a dispatch failure.
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS ux_rvn_roi_finance_reconciliations_one_open_per_link
  ON rvn_roi_finance_reconciliations(finance_link_id)
  WHERE status IN ('open','investigating');
