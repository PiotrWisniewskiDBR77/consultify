-- OKR-E007 — Review & Learning schema. Closes the Set/Cycle lifecycle:
-- final scoring, OKRReflection narrative capture, manager/self review
-- (maker-checker), carry-forward lineage, and the Cycle-close guard.
--
-- Design: docs/product/results-vnext/OKR_E007_DESIGN.md, ratified by the
-- §-IO Integration Owner rulings block at the top of that document.
--
-- IO-1 re-verification finding (binding, done before writing this file):
-- the design was drafted before E001-E006 landed and flagged every
-- cross-reference as provisional. Direct read of the ACTUAL LANDED code
-- confirms/corrects the design's assumptions:
--   * `okr_vnext_programs` ALREADY carries `scoring_model`/
--     `manager_review_required`/`self_review_required`/
--     `reflection_required_for_close` columns (OKR-E001,
--     20260822_rvn_okr_program_cycle.sql) — IO-2's "no column" branch does
--     NOT apply to any of these four; no ALTER needed on that table.
--   * `okr_vnext_objectives`' parent FK column is `set_id`, NOT
--     `okr_set_id` as this design's DDL sketch (§3) wrote it — matching
--     OKR-E003's actual landed `okr_vnext_objectives`/`okr_vnext_key_results`
--     shape (20260824_rvn_okr_objective_key_result.sql). This migration's
--     `okr_vnext_reflections.objective_id` FK is unaffected (it points at
--     `okr_vnext_objectives(objective_id)`, unchanged), but all reads in the
--     command layer join through `set_id`, not `okr_set_id`.
--   * OKR-E003 did NOT register a new 'okr_objective' ABAC resource_type
--     (confirmed again here, same finding OKR-E005's migration header
--     already recorded) — Objectives/KeyResults, and by the same
--     inheritance this epic's `okr_vnext_reflections`/`okr_vnext_reviews`,
--     all resolve visibility exclusively through the parent Set's own
--     'okr_set' row, joined on `set_id`. No new resource_type here either.
--   * E003's landed confidence columns are `confidence`/
--     `confidence_numeric_value` (okrObjectiveTypes.ts) — consistent with
--     this design's own §3 (no change needed there).
--
-- D3: one `okr_vnext_reflections` row per Objective — two writers
-- (finalScoreOkrSet freezes the score fields; recordObjectiveReflection
-- writes the narrative fields), matching the ledger's single Aggregate
-- cell for an AC whose Command/API cell names two distinct routes.
--
-- D4: two-stage freeze, structurally identical to ROI-E006's own
-- `rvn_roi_pir_protect_frozen` (20260819_rvn_roi_pir_learning.sql) — facts
-- frozen from creation is NOT used here (unlike ROI's PIR, this row's
-- fields are ALL freely re-editable while status='draft', since both the
-- score half and the narrative half are legitimately revisable up until
-- `closeOkrSet` finalizes); only the single `status='finalized'` trigger
-- gate applies.
--
-- D5: one `okr_vnext_reviews` row per (set_id, review_type), review_type
-- IN ('self','manager') — reused/updated across draft->submitted->
-- (approved|changes_requested), never an append-only snapshot log (that
-- role is already filled by rvn_platform_events, D12/D14 below).
--
-- D12/D14: every event this epic writes uses aggregateType='okr_set' (the
-- parent Set's identity), confirmed as the actual, already-proven
-- convention by direct read of the landed `roiPirCommands.ts` (every one
-- of its 6 commands emits aggregateType='roi_case' even when only a child
-- table is touched) and OKR-E003's own `okr_objective.*`/`okr_key_result.*`
-- events. History reads the shared `rvn_platform_events` (RN-G1) — no
-- `okr_vnext_events` table is created here; that name never existed as a
-- real table anywhere in this program (D14's own restated naming-drift
-- note).
--
-- D15: `carried_from_set_id` reserved on `okr_vnext_sets` by THIS epic's
-- own additive ALTER (new nullable column, zero backfill, zero data
-- impact) rather than a retroactive edit to OKR-E002's already-frozen DDL.

-- ============================================================
-- okr_vnext_reflections — OKRReflection. One row per Objective (D3).
-- Two writers: finalScoreOkrSet (score fields), recordObjectiveReflection
-- (narrative fields). Finalized only by closeOkrSet (D4).
-- ============================================================
CREATE TABLE IF NOT EXISTS okr_vnext_reflections (
  reflection_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id                        UUID NOT NULL REFERENCES okr_vnext_sets(set_id),
  objective_id                  UUID NOT NULL REFERENCES okr_vnext_objectives(objective_id),
  organization_id                TEXT NOT NULL,

  status                         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','finalized')),

  -- Final score (D1/D2) — written by finalScoreOkrSet, Set-level batch
  -- command. 'zero_to_one'/'percentage' pass objective.progress through
  -- (unchanged / x100); 'categories'/'custom' have no source-defined
  -- bucket boundaries anywhere in this program (IO-5) — final_score stays
  -- NULL, scoring_model_unsupported=true, never a fabricated threshold.
  final_score                    NUMERIC NULL,
  scoring_model_unsupported       BOOLEAN NOT NULL DEFAULT false,
  -- Frozen pointer-plus-copy of this Objective's KRs at scoring time (D3),
  -- shape: [{ keyResultId, progress, confidence, weight }].
  final_score_payload             JSONB NULL,
  scoring_policy_version_id        UUID NULL REFERENCES okr_vnext_program_policy_versions(policy_version_id),
  scored_by                        TEXT NULL,
  scored_at                        TIMESTAMPTZ NULL,

  -- Narrative (OKRReflection proper) — written by recordObjectiveReflection.
  -- "co zadziałało/nie/dlaczego/nauka/zmiana/dyspozycja" (OKR-F-021-AC-01).
  what_worked                      TEXT NULL,
  what_did_not_work                TEXT NULL,
  why                              TEXT NULL,
  learning                         TEXT NULL,
  next_cycle_change                TEXT NULL,
  -- "dyspozycja" — the Objective's own fate going into the next cycle.
  disposition                      TEXT NULL CHECK (disposition IN ('complete','carry_forward','drop','redefine')),

  finalized_by                     TEXT NULL,
  finalized_at                     TIMESTAMPTZ NULL,

  row_version                      INT NOT NULL DEFAULT 1,
  created_by                       TEXT NOT NULL,
  created_at                       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                       TEXT NULL,
  updated_at                       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_okr_vnext_reflections_objective
  ON okr_vnext_reflections(objective_id);
CREATE INDEX IF NOT EXISTS idx_okr_vnext_reflections_set
  ON okr_vnext_reflections(organization_id, set_id);

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
    THEN
      RAISE EXCEPTION 'okr_vnext_reflections: reflection % is finalized', OLD.reflection_id
        USING ERRCODE = '23001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_okr_vnext_reflection_protect_frozen ON okr_vnext_reflections;
CREATE TRIGGER trg_okr_vnext_reflection_protect_frozen
  BEFORE UPDATE ON okr_vnext_reflections
  FOR EACH ROW EXECUTE FUNCTION okr_vnext_reflection_protect_frozen();

-- ============================================================
-- okr_vnext_reviews — OKRReview. One row per (set_id, review_type) (D5).
-- ============================================================
CREATE TABLE IF NOT EXISTS okr_vnext_reviews (
  review_id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id                        UUID NOT NULL REFERENCES okr_vnext_sets(set_id),
  organization_id                TEXT NOT NULL,

  review_type                    TEXT NOT NULL CHECK (review_type IN ('self','manager')),
  reviewer_user_id                TEXT NOT NULL,

  status                          TEXT NOT NULL DEFAULT 'draft'
                                    CHECK (status IN ('draft','submitted','approved','changes_requested')),

  outcome                         TEXT NULL,
  -- [{ level: 'set'|'objective'|'key_result', targetId, text, createdAt }]
  comments                         JSONB NOT NULL DEFAULT '[]',
  -- Set.current_version at submission time.
  reviewed_set_version              INT NULL,

  submitted_by                     TEXT NULL,
  submitted_at                     TIMESTAMPTZ NULL,
  decided_by                       TEXT NULL,
  decided_at                       TIMESTAMPTZ NULL,

  row_version                      INT NOT NULL DEFAULT 1,
  created_by                       TEXT NOT NULL,
  created_at                       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                       TEXT NULL,
  updated_at                       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_okr_vnext_reviews_set_type
  ON okr_vnext_reviews(set_id, review_type);
CREATE INDEX IF NOT EXISTS idx_okr_vnext_reviews_set
  ON okr_vnext_reviews(organization_id, set_id);

-- ============================================================
-- okr_vnext_sets — carry-forward lineage (D15). Additive ALTER, safe
-- regardless of concurrent E002 state (new nullable column, zero backfill).
-- ============================================================
ALTER TABLE okr_vnext_sets
  ADD COLUMN IF NOT EXISTS carried_from_set_id UUID NULL REFERENCES okr_vnext_sets(set_id);

CREATE INDEX IF NOT EXISTS idx_okr_vnext_sets_carried_from
  ON okr_vnext_sets(carried_from_set_id) WHERE carried_from_set_id IS NOT NULL;

-- No okr_vnext_events table (D14) — history reads rvn_platform_events
-- (already exists, RN-G1) and okr_vnext_set_versions (already landed by
-- OKR-E002, 20260823_rvn_okr_set.sql).
