-- ROI-E008 — Teresa/Legacy/Ops — Half A.
--
-- Design: docs/product/results-vnext/ROI_E008_DESIGN.md §2/A2, Decision D8.
--
-- Extends (CREATE OR REPLACE FUNCTION only, no DROP/CREATE TRIGGER needed)
-- the freeze trigger function `rvn_roi_pir_protect_frozen()` first defined
-- in server/migrations/20260819_rvn_roi_pir_learning.sql. Verified gap: that
-- migration's finalized-guard branch does not currently cover
-- `teresa_draft_lessons_payload`/`teresa_draft_generated_at` — the two
-- columns `recordRoiPirTeresaLessonsDraft` (roiPirCommands.ts, ROI-E008)
-- writes. Once a PIR is finalized, every frozen fact this table holds gets
-- a DB-level guarantee, matching every other `rvn_roi_*` table's posture
-- since ROI-E001; this migration closes that gap for the two Teresa-draft
-- columns.
--
-- `trg_rvn_roi_pir_protect_frozen` (ROI-E006 migration) already binds this
-- function name via `BEFORE UPDATE ... EXECUTE FUNCTION
-- rvn_roi_pir_protect_frozen()` — CREATE OR REPLACE FUNCTION is sufficient,
-- the trigger picks up the new body automatically.

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
       OR NEW.teresa_draft_lessons_payload IS DISTINCT FROM OLD.teresa_draft_lessons_payload
       OR NEW.teresa_draft_generated_at IS DISTINCT FROM OLD.teresa_draft_generated_at
    THEN
      RAISE EXCEPTION 'rvn_roi_post_investment_reviews: pir % is finalized', OLD.pir_id USING ERRCODE = '23001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- No DROP/CREATE TRIGGER — trg_rvn_roi_pir_protect_frozen (ROI-E006 migration)
-- already binds this function name; CREATE OR REPLACE FUNCTION is sufficient.
