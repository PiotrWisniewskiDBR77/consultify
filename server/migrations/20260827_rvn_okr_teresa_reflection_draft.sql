-- OKR-E008 — Half A (Teresa), reflection_synthesis mode (OKR-F-027).
--
-- Design: docs/product/results-vnext/OKR_E008_DESIGN.md §3.9, D-OKR8-7/D-OKR8-8.
--
-- IO-1 re-verification (done before writing this file, per §-IO): the design
-- was drafted when zero OKR vNext code existed; `okr_vnext_reflections` has
-- since landed (OKR-E007, 20260826_rvn_okr_review_reflection.sql). Direct
-- read of that migration + `okrReflectionTypes.ts` confirms it reserved NO
-- Teresa draft columns (unlike ROI-E006's PIR table, which pre-reserved
-- `teresa_draft_lessons_payload`/`teresa_draft_generated_at` for ROI-E008 to
-- fill). This migration adds them now, additive only, same 2-gate shape
-- ROI-E008 proved: Teresa writes ONLY `teresa_draft_reflection_payload`/
-- `teresa_draft_generated_at`; a human's own `recordOkrReflectionTeresaDraftDisposition`
-- (okrReflectionCommands.ts, OKR-E008) is the ONLY path that ever copies a
-- disposed draft into the authoritative narrative fields
-- (what_worked/what_did_not_work/why/learning/next_cycle_change/disposition)
-- via the EXISTING `recordObjectiveReflection` command — never a second,
-- parallel write path.
--
-- D-OKR8-8 (this epic's own resolution): OKR-E007 named no Teresa draft
-- mechanism in any of its ACs (re-checked, OKR-F-021..024 verbatim, none
-- mention it) — this epic is the first to specify AND land it, and lands
-- the two new command functions directly inside `okrReflectionCommands.ts`
-- (OKR-E007's own file, now landed) rather than inventing a new file, same
-- placement ROI-E008 chose for its own PIR draft functions inside
-- `roiPirCommands.ts`.
--
-- Extends (CREATE OR REPLACE FUNCTION only, no DROP/CREATE TRIGGER needed)
-- the freeze trigger function `okr_vnext_reflection_protect_frozen()` first
-- defined in 20260826_rvn_okr_review_reflection.sql — `trg_okr_vnext_reflection_protect_frozen`
-- already binds this function name via `BEFORE UPDATE ... EXECUTE FUNCTION`;
-- CREATE OR REPLACE FUNCTION is sufficient, the trigger picks up the new
-- body automatically. Once a reflection is finalized, the Teresa-draft
-- columns get the same DB-level immutability guarantee as every other
-- column already protected by this trigger.

ALTER TABLE okr_vnext_reflections
  ADD COLUMN IF NOT EXISTS teresa_draft_reflection_payload JSONB NULL,
  ADD COLUMN IF NOT EXISTS teresa_draft_generated_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS teresa_draft_disposition TEXT NULL
    CHECK (teresa_draft_disposition IN ('accepted', 'rejected') OR teresa_draft_disposition IS NULL),
  ADD COLUMN IF NOT EXISTS teresa_draft_disposition_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS teresa_draft_disposition_at TIMESTAMPTZ NULL;

CREATE OR REPLACE FUNCTION okr_vnext_reflection_protect_frozen()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'finalized' THEN
    IF NEW.final_score IS DISTINCT FROM OLD.final_score
       OR NEW.final_score_payload IS DISTINCT FROM OLD.final_score_payload
       OR NEW.scoring_model_unsupported IS DISTINCT FROM OLD.scoring_model_unsupported
       OR NEW.what_worked IS DISTINCT FROM OLD.what_worked
       OR NEW.what_did_not_work IS DISTINCT FROM OLD.what_did_not_work
       OR NEW.why IS DISTINCT FROM OLD.why
       OR NEW.learning IS DISTINCT FROM OLD.learning
       OR NEW.next_cycle_change IS DISTINCT FROM OLD.next_cycle_change
       OR NEW.disposition IS DISTINCT FROM OLD.disposition
       OR NEW.teresa_draft_reflection_payload IS DISTINCT FROM OLD.teresa_draft_reflection_payload
       OR NEW.teresa_draft_generated_at IS DISTINCT FROM OLD.teresa_draft_generated_at
       OR NEW.teresa_draft_disposition IS DISTINCT FROM OLD.teresa_draft_disposition
       OR NEW.teresa_draft_disposition_by IS DISTINCT FROM OLD.teresa_draft_disposition_by
       OR NEW.teresa_draft_disposition_at IS DISTINCT FROM OLD.teresa_draft_disposition_at
    THEN
      RAISE EXCEPTION 'okr_vnext_reflections: reflection % is finalized', OLD.reflection_id
        USING ERRCODE = '23001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- No DROP/CREATE TRIGGER — trg_okr_vnext_reflection_protect_frozen
-- (OKR-E007 migration) already binds this function name; CREATE OR REPLACE
-- FUNCTION is sufficient.
