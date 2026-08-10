-- Finance v3 / ROI-E007 (Stream A, Gate A of the ROI-E007 program): Finance/KPI Seams —
-- version-pinned link ledger between Finance v3 and legacy ROI Actual, part 1/3 — tables.
--
-- Source of truth: docs/validation/finance-v3/generated/gate-d/ROI_E007_finance_kpi_seams_ADR.md
-- (sections 3, 4, 6, Zalacznik A) — DDL sketch, live-tested on an ephemeral Postgres by the ADR's
-- author (15 scenarios) and re-tested by this work package with an expanded battery — see
-- docs/validation/finance-v3/generated/gate-d/ROI_E007_streamA_migration_report.md.
--
-- Additive only. Zero ALTER on any pre-existing table in this file (the deny-mutation triggers on
-- pre-existing roi_realized_values / v8_roi_realization_entries / benefit_tracking live in
-- ..._03_legacy_actual_protection.sql — triggers only, no column changes anywhere in this work
-- package).
--
-- Deliberate divergences from the literal ADR sketch (full rationale in the migration report):
--   1. rvn_roi_finance_links gains an explicit `status` column ('ACTIVE'/'SUPERSEDED'/'WITHDRAWN')
--      instead of overloading `superseded_at`/`superseded_by_link_id` with two meanings. The ADR's
--      own section 11 escalation #4 flagged this ambiguity ("wycofanie bez nastepcy" vs.
--      "supersedowany") and recommended exactly this fix ("osobna kolumna... zamiast przeciazac
--      superseded_at/superseded_by_link_id NULL dwoma znaczeniami") — applied here rather than left
--      as a P1, per orchestrator scope item 1 (API DELETE = soft-delete via status, never a hard
--      DELETE — consistent with the append-only idiom this whole session's migrations use).
--   2. `uq_rvn_rfl_one_active_per_slot` is scoped to `status = 'ACTIVE'` (not the ADR sketch's
--      `WHERE superseded_by_link_id IS NULL`, which the ADR's own escalation #4 showed under-
--      constrains the "withdrawn without successor" case) — the direct consequence of divergence 1.
--   3. `chk_rvn_rfl_status_metadata` makes the three states mutually exclusive and internally
--      consistent (ACTIVE => both NULL; SUPERSEDED => both NOT NULL; WITHDRAWN => superseded_at
--      set, superseded_by_link_id NULL) — new, not in the ADR sketch, closes escalation #4 fully.
--   4. rvn_roi_finance_links gets a BEFORE DELETE deny trigger (..._02_integrity.sql) — the ADR
--      sketch left DELETE physically possible on this table (section 8 treats "DELETE" as an
--      API-level soft-delete only, with no schema-level enforcement). This migration makes "never a
--      hard DELETE" a physical guarantee, matching orchestrator scope item 1 and the same
--      physical-over-procedural reasoning the ADR itself applies to roi_realized_values (section
--      5.3).

BEGIN;

DO $$ BEGIN
  CREATE TYPE rvn_roi_finance_freshness AS ENUM (
    'NEVER_COMPUTED', 'CURRENT', 'STALE_SOURCE', 'COMPUTE_FAILED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. rvn_roi_finance_links — pin + legacy bridge (ADR section 3; bridge design in section 7)
CREATE TABLE IF NOT EXISTS rvn_roi_finance_links (
  id                       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id             TEXT NOT NULL REFERENCES organizations(id),

  -- Bridge to the future rvn_roi_cases (ADR section 7). Today the only governed ROI-side entity
  -- is Initiative; roi_case_id is NULL until WP1 lands (rvn_roi_cases table), then gets an
  -- additive FK + backfill (ADR section 7.2) — no destructive change to this column ever needed.
  roi_case_bridge_type          TEXT NOT NULL DEFAULT 'INITIATIVE' CHECK (roi_case_bridge_type = 'INITIATIVE'),
  roi_case_bridge_id              TEXT NOT NULL, -- initiatives.id today (legacy bridge reference)
  roi_case_id                       TEXT, -- NULL until WP1; FK added additively later (ADR section 7)

  finance_artifact_type                TEXT NOT NULL CHECK (finance_artifact_type IN (
                                          'STATEMENT_PACK', 'HISTORICAL_ANALYSIS', 'BASELINE_MODEL',
                                          'PREDICTION_SCENARIO', 'VALUATION_CASE', 'REPORT_EXPORT'
                                        )),
  finance_artifact_id                    TEXT NOT NULL,
  finance_version_id                       TEXT NOT NULL, -- the real pin: business_version_id

  mapping_version                            INTEGER NOT NULL DEFAULT 1,
  source                                       TEXT NOT NULL,
  as_of                                          DATE NOT NULL,
  semantic_unit                                    TEXT NOT NULL,
  semantic_currency                                  TEXT,

  link_purpose                                         TEXT NOT NULL CHECK (link_purpose IN (
                                                          'BENEFIT_EVIDENCE', 'COST_EVIDENCE', 'BASELINE_SOURCE',
                                                          'FORECAST_COMPARISON', 'ACTUAL_VERIFICATION',
                                                          'VALUATION_CONTEXT', 'OTHER'
                                                        )),

  -- Divergence 1/2/3 from the ADR sketch (see header): explicit status instead of overloading
  -- superseded_at/superseded_by_link_id. API DELETE maps to status='WITHDRAWN' (orchestrator scope 1).
  status                                                 TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN (
                                                            'ACTIVE', 'SUPERSEDED', 'WITHDRAWN'
                                                          )),

  freshness_state                                        rvn_roi_finance_freshness NOT NULL DEFAULT 'NEVER_COMPUTED',
  freshness_reason                                         TEXT,
  stale_since                                                TIMESTAMPTZ,

  superseded_by_link_id                                        TEXT REFERENCES rvn_roi_finance_links(id),
  superseded_at                                                  TIMESTAMPTZ,

  created_by                                                       TEXT NOT NULL,
  created_at                                                         TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_rvn_rfl_finance_artifact_org
    FOREIGN KEY (finance_artifact_id, organization_id)
    REFERENCES finance_artifacts (artifact_id, organization_id),
  CONSTRAINT fk_rvn_rfl_finance_version_org
    FOREIGN KEY (finance_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),

  -- Divergence 3: makes the three states mutually exclusive and internally consistent.
  CONSTRAINT chk_rvn_rfl_status_metadata CHECK (
    (status = 'ACTIVE' AND superseded_by_link_id IS NULL AND superseded_at IS NULL)
    OR (status = 'SUPERSEDED' AND superseded_by_link_id IS NOT NULL AND superseded_at IS NOT NULL)
    OR (status = 'WITHDRAWN' AND superseded_by_link_id IS NULL AND superseded_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_rvn_rfl_org_bridge ON rvn_roi_finance_links(organization_id, roi_case_bridge_type, roi_case_bridge_id);
CREATE INDEX IF NOT EXISTS idx_rvn_rfl_finance_artifact ON rvn_roi_finance_links(finance_artifact_id);
CREATE INDEX IF NOT EXISTS idx_rvn_rfl_finance_version ON rvn_roi_finance_links(finance_version_id);
CREATE INDEX IF NOT EXISTS idx_rvn_rfl_org_status ON rvn_roi_finance_links(organization_id, status);

-- At most one ACTIVE link per (Case, Finance artifact, purpose) slot (ADR section 3.3,
-- divergence 2: scoped to status='ACTIVE' rather than superseded_by_link_id IS NULL).
CREATE UNIQUE INDEX IF NOT EXISTS uq_rvn_rfl_one_active_per_slot
  ON rvn_roi_finance_links (roi_case_bridge_type, roi_case_bridge_id, finance_artifact_id, link_purpose)
  WHERE status = 'ACTIVE';

-- 2. rvn_roi_finance_reconciliations — divergence is reconciled, never overwritten; always a new
--    row per divergence occurrence (ADR section 4).
CREATE TABLE IF NOT EXISTS rvn_roi_finance_reconciliations (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id           TEXT NOT NULL REFERENCES organizations(id),
  link_id                      TEXT NOT NULL REFERENCES rvn_roi_finance_links(id),

  status                         TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN (
                                    'OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'
                                  )),
  divergence_summary                JSONB NOT NULL, -- {roi: {...}, finance: {...}, delta: {...}} — bounded snapshot

  opened_by                           TEXT NOT NULL,
  opened_at                             TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Resolve readiness (orchestrator scope item 3): these three columns are exactly what a future
  -- PATCH .../finance-reconciliations/:id resolve endpoint (ADR section 11 escalation #5, not
  -- implemented in this stream) needs to write; chk_rvn_rfr_resolution below is the sensible
  -- CHECK/default the orchestrator asked to confirm is already present — it is.
  resolved_by                             TEXT,
  resolved_at                               TIMESTAMPTZ,
  resolution_note                             TEXT,

  CONSTRAINT chk_rvn_rfr_resolution CHECK (
    (status IN ('RESOLVED', 'DISMISSED') AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL AND resolution_note IS NOT NULL)
    OR (status IN ('OPEN', 'UNDER_REVIEW') AND resolved_by IS NULL AND resolved_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_rvn_rfr_link ON rvn_roi_finance_reconciliations(link_id);
CREATE INDEX IF NOT EXISTS idx_rvn_rfr_org_status ON rvn_roi_finance_reconciliations(organization_id, status);

-- 3. rvn_roi_finance_link_events — append-only freshness/supersession propagation ledger
--    (ADR section 6; same shape as finance_lineage_freshness_events, WP-B03).
CREATE TABLE IF NOT EXISTS rvn_roi_finance_link_events (
  id                     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id            TEXT NOT NULL REFERENCES organizations(id),
  link_id                       TEXT NOT NULL REFERENCES rvn_roi_finance_links(id),
  previous_state                  TEXT,
  new_state                         TEXT NOT NULL,
  reason_code                          TEXT NOT NULL, -- NEW_APPROVED_VERSION / SOURCE_INVALIDATED / MANUAL_REFRESH
  triggering_finance_version_id          TEXT,
  created_at                               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rvn_rfle_link ON rvn_roi_finance_link_events(link_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rvn_rfle_org ON rvn_roi_finance_link_events(organization_id, created_at DESC);

COMMIT;
