-- ROI-E006 — PIR & Learning.
--
-- Design: docs/product/results-vnext/ROI_E006_DESIGN.md §3, full DDL copied
-- verbatim. One new table: rvn_roi_post_investment_reviews, versioned and
-- freezable in TWO stages — unconditional facts (started_by/started_at/
-- review_snapshot_payload/review_snapshot_hash/case_id/created_by) are
-- immutable from creation (AC-02: frozen at reviewer start, not finalize);
-- narrative content (outcome/lessons_learned/recommendation/
-- open_variance_waiver_reason/teresa_draft_disposition) locks a SECOND time,
-- only once status='finalized'. Zero new CHECK-constraint values on
-- rvn_roi_cases.status (Decision D1 — 'post_investment_review_due'/
-- 'post_investment_review'/'closed' were all forward-declared by ROI-E001).

-- ============================================================
-- rvn_roi_post_investment_reviews — versioned, freezable in two stages
-- ============================================================
CREATE TABLE IF NOT EXISTS rvn_roi_post_investment_reviews (
  pir_id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                         UUID NOT NULL REFERENCES rvn_roi_cases(case_id),
  organization_id                 TEXT NOT NULL,

  sequence_number                 INT NOT NULL,
  status                          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','finalized')),

  -- AC-02: frozen at reviewer start, immutable from creation.
  started_by                      TEXT NOT NULL,
  started_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  review_snapshot_payload         JSONB NOT NULL,
  review_snapshot_hash            TEXT NOT NULL,

  -- Narrative content, editable while status='draft' only.
  outcome                         TEXT NULL
                                     CHECK (outcome IN ('benefits_fully_realized','benefits_partially_realized','benefits_not_realized')),
  lessons_learned                 TEXT NULL,
  recommendation                  TEXT NULL,

  -- AC-03: closure gate — non-null only when finalized despite open variances.
  open_variance_waiver_reason     TEXT NULL,

  -- AC-06: Teresa draft never becomes authoritative without this.
  teresa_draft_lessons_payload    JSONB NULL,
  teresa_draft_generated_at       TIMESTAMPTZ NULL,
  teresa_draft_disposition        TEXT NULL CHECK (teresa_draft_disposition IN ('accepted','rejected','edited_then_accepted')),
  teresa_draft_disposition_by     TEXT NULL,
  teresa_draft_disposition_at     TIMESTAMPTZ NULL,

  finalized_by                    TEXT NULL,
  finalized_at                    TIMESTAMPTZ NULL,

  row_version                     INT NOT NULL DEFAULT 1,
  created_by                      TEXT NOT NULL,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                      TEXT NULL,
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_rvn_roi_pir_case_seq
  ON rvn_roi_post_investment_reviews(case_id, sequence_number);
CREATE UNIQUE INDEX IF NOT EXISTS ux_rvn_roi_pir_one_draft_per_case
  ON rvn_roi_post_investment_reviews(case_id) WHERE status = 'draft';
CREATE INDEX IF NOT EXISTS idx_rvn_roi_pir_case
  ON rvn_roi_post_investment_reviews(organization_id, case_id, sequence_number DESC);

CREATE OR REPLACE FUNCTION rvn_roi_pir_protect_frozen()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.started_by IS DISTINCT FROM OLD.started_by
     OR NEW.started_at IS DISTINCT FROM OLD.started_at
     OR NEW.review_snapshot_payload IS DISTINCT FROM OLD.review_snapshot_payload
     OR NEW.review_snapshot_hash IS DISTINCT FROM OLD.review_snapshot_hash
     OR NEW.case_id IS DISTINCT FROM OLD.case_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
  THEN
    RAISE EXCEPTION 'rvn_roi_post_investment_reviews: pir % review snapshot facts are immutable', OLD.pir_id
      USING ERRCODE = '23001';
  END IF;

  IF OLD.status = 'finalized' THEN
    IF NEW.outcome IS DISTINCT FROM OLD.outcome
       OR NEW.lessons_learned IS DISTINCT FROM OLD.lessons_learned
       OR NEW.recommendation IS DISTINCT FROM OLD.recommendation
       OR NEW.open_variance_waiver_reason IS DISTINCT FROM OLD.open_variance_waiver_reason
       OR NEW.teresa_draft_disposition IS DISTINCT FROM OLD.teresa_draft_disposition
    THEN
      RAISE EXCEPTION 'rvn_roi_post_investment_reviews: pir % is finalized', OLD.pir_id USING ERRCODE = '23001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rvn_roi_pir_protect_frozen ON rvn_roi_post_investment_reviews;
CREATE TRIGGER trg_rvn_roi_pir_protect_frozen
  BEFORE UPDATE ON rvn_roi_post_investment_reviews
  FOR EACH ROW EXECUTE FUNCTION rvn_roi_pir_protect_frozen();

-- No ALTER TABLE rvn_roi_cases — every column this epic writes to already
-- exists (reserved since ROI-E001).
