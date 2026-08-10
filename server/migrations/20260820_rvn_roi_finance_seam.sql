-- ROI-E007 — Finance/KPI Seams.
--
-- Design: docs/product/results-vnext/ROI_E007_DESIGN.md §3, full DDL copied
-- verbatim. Two new tables, both inherit visibility via `case_id` only — no
-- new `resource_type` (Decision D6). Neither table has a freeze trigger —
-- links are removable (DELETE, per implementation-plan §9.6), reconciliations
-- have a bounded, small lifecycle ('open'->'resolved'/'accepted_divergence')
-- governed purely by CAS, not immutability. Neither is a "decision record" in
-- the frozen-snapshot sense ApprovalSnapshot/PIR are.

-- ============================================================
-- rvn_roi_finance_links — ROI-side typed, pinned reference INTO a Finance
-- artifact. No FK to any financial_* table (Finance IDs are TEXT, Finance
-- is a separate system D06 declares off-limits for direct coupling — a
-- hard FK here would be exactly the "shared mutable table" collapse D06
-- forbids).
-- ============================================================
CREATE TABLE IF NOT EXISTS rvn_roi_finance_links (
  link_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                 UUID NOT NULL REFERENCES rvn_roi_cases(case_id),
  organization_id         TEXT NOT NULL,

  finance_artifact_type   TEXT NOT NULL,
  finance_artifact_id     TEXT NOT NULL,   -- Finance's own id, TEXT, no FK (D4)
  finance_version_id      TEXT NOT NULL,   -- Finance's own version id, TEXT, no FK (D4)
  mapping_version         INT NOT NULL DEFAULT 1,
  source                  TEXT NOT NULL,
  as_of                   TIMESTAMPTZ NOT NULL,
  semantic_unit           TEXT NULL,
  currency                TEXT NULL,
  link_purpose            TEXT NOT NULL,

  linked_by               TEXT NOT NULL,
  linked_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  row_version               INT NOT NULL DEFAULT 1,
  created_by                TEXT NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_finance_links_case
  ON rvn_roi_finance_links(organization_id, case_id);

-- ============================================================
-- rvn_roi_finance_reconciliations — AC-03: a record, never a silent sync.
-- ============================================================
CREATE TABLE IF NOT EXISTS rvn_roi_finance_reconciliations (
  reconciliation_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                 UUID NOT NULL REFERENCES rvn_roi_cases(case_id),
  organization_id         TEXT NOT NULL,
  finance_link_id         UUID NOT NULL REFERENCES rvn_roi_finance_links(link_id),

  roi_value                NUMERIC NOT NULL,
  finance_value             NUMERIC NOT NULL,
  divergence_reason          TEXT NULL,
  status                     TEXT NOT NULL DEFAULT 'open'
                                CHECK (status IN ('open','investigating','resolved','accepted_divergence')),

  opened_by                   TEXT NOT NULL,
  opened_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_by                  TEXT NULL,
  resolved_at                  TIMESTAMPTZ NULL,
  resolution_notes              TEXT NULL,

  row_version                   INT NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_finance_reconciliations_case
  ON rvn_roi_finance_reconciliations(organization_id, case_id, opened_at DESC);
