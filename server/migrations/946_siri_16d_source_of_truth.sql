-- A4 SIRI Method Pack — additive persistence for the 16-Dimension source of
-- truth (Assessment Matrix) and its frozen Prioritisation Matrix output.
--
-- STATUS: PREPARED, NOT APPLIED. This migration is committed as part of the
-- Method Assessment Core "SIRI Method Pack" packet (agent A4,
-- codex/mac-a4-siri-20260813) but has deliberately NOT been run against any
-- database. Applying it is blocked on COORD-02 (the open coordination point
-- covering `src/services/siriStructure.ts`, whose "8 Dimensions" /
-- "16 Prioritisation Areas" naming is inverted relative to the licensed SIRI
-- canon — see src/method-core/methods/siri/compileSiriPack.ts file header).
--
-- Number choice: 946 is the next free slot after 945_chat_m01p04c_knowledge_doc_scope.sql
-- in this worktree at the time of writing. Unlike that migration's own
-- precedent, this number was NOT cross-checked against every local branch
-- (100+ branches exist; out of scope for this packet) — re-verify with
-- `git ls-tree <branch> -- server/migrations/ | grep '^946_'` across active
-- lanes before this migration is actually applied.
--
-- Design notes:
--   * 100% additive: CREATE TABLE IF NOT EXISTS only. No ALTER, no DROP, no
--     data migration/backfill from the existing 8D `siri_assessments`-style
--     tables (none of which are touched here).
--   * Mirrors the shared Method Kernel event/session shapes
--     (src/method-core/contracts/{events,session}.ts) loosely, but does NOT
--     depend on those tables existing — this module owns its own rows and
--     joins by (organization_id, session_id) convention only.
--   * `unit_id` values are the 16 canonical SIRI dimension ids from
--     `SIRI_PRIORITISATION_AREAS` (e.g. 'vertical_integration',
--     'shop_floor_automation', ...) — NOT the 8-pillar ids.

CREATE TABLE IF NOT EXISTS siri_dimension_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  session_id UUID NOT NULL,

  -- One of the 16 canonical SIRI dimension ids (SIRI_PRIORITISATION_AREAS).
  unit_id TEXT NOT NULL,

  -- Proposed vs. participant-confirmed vs. frozen, mirroring the kernel's
  -- ScoringResult.verdict ('scored' | 'needs_evidence' | 'not_applicable' | 'unknown').
  verdict TEXT NOT NULL CHECK (
    verdict IN ('scored', 'needs_evidence', 'not_applicable', 'unknown')
  ),

  -- Band 0-5, nullable when verdict is not 'scored' (no silent zero — see
  -- ASSESSMENT_KB_SIRI.md §3 "brak dowodu pozostaje jawny").
  proposed_level SMALLINT CHECK (proposed_level IS NULL OR proposed_level BETWEEN 0 AND 5),

  -- Human decision, separate from the adapter's proposal per
  -- MethodAdapter.computeScore doc: "finalną decyzję Band podejmują
  -- uprawnieni uczestnicy/approver; adapter tylko PROPONUJE".
  decided_level SMALLINT CHECK (decided_level IS NULL OR decided_level BETWEEN 0 AND 5),
  decided_by_user_id UUID,
  decided_at TIMESTAMPTZ,

  -- Raw per-band attribute tallies feeding the 80:20 rule, shape
  -- { "0": {"satisfied": n, "total": n}, "1": {...}, ... } — see
  -- src/method-core/methods/siri/siriAdapter.ts computeScore().
  band_attribute_tallies JSONB NOT NULL DEFAULT '{}'::jsonb,

  is_frozen BOOLEAN NOT NULL DEFAULT FALSE,
  frozen_snapshot_id UUID,

  method_pack_version TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT siri_dimension_scores_unique_live_row
    UNIQUE (organization_id, session_id, unit_id, is_frozen, frozen_snapshot_id)
);

CREATE INDEX IF NOT EXISTS idx_siri_dimension_scores_session
  ON siri_dimension_scores (organization_id, session_id);

CREATE INDEX IF NOT EXISTS idx_siri_dimension_scores_unit
  ON siri_dimension_scores (unit_id);

-- Frozen Prioritisation Matrix (TIER) output — kept in a SEPARATE table on
-- purpose. Canon: ASSESSMENT_KB_SIRI.md §4 "Nie wolno łączyć wyboru Band z
-- priorytetyzacją w jednym formularzu." `prioritise()` in siriAdapter.ts
-- accepts only frozen unit levels; this table records exactly that
-- frozen-only input plus the resulting ranking, never a live/proposal score.
CREATE TABLE IF NOT EXISTS siri_prioritisation_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  session_id UUID NOT NULL,
  frozen_snapshot_id UUID NOT NULL,

  planning_horizon TEXT NOT NULL CHECK (
    planning_horizon IN ('strategic', 'tactical', 'operational')
  ),

  -- Inputs collected per Module 5 §3.10 "Collecting Inputs for the
  -- Prioritization Matrix": cost profile (10 categories), top 5 KPI
  -- categories, Industry Best-in-Class benchmark selection.
  cost_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  top_kpi_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  industry_best_in_class_group TEXT,

  -- Full 16-dimension ranking + rationale, as returned by
  -- MethodAdapter.prioritise() -> PrioritisationResult.
  ranked_unit_ids JSONB NOT NULL,
  rationale_by_unit_id JSONB NOT NULL,
  parameters_version TEXT NOT NULL,

  -- COORD-08 (agent A11, codex/mac-a11-siri-pm-20260813): which Impact Value
  -- formula produced this snapshot — see src/services/siriPrioritisation.ts
  -- SiriPmCalculationVersion. Added directly into the CREATE TABLE (this
  -- table has never been applied to any database — see file header STATUS —
  -- so there is no existing row to backfill and no need for a separate
  -- ALTER TABLE step). Defaults to 'legacy_v1' to match the engine's own
  -- default calculation path (ZAKAZ CICHEJ ZMIANY — see
  -- SIRI_PM_V2_BACKFILL_PLAN.md). Do NOT widen this CHECK without updating
  -- SiriPmCalculationVersion in lockstep.
  calculation_version TEXT NOT NULL DEFAULT 'legacy_v1' CHECK (
    calculation_version IN ('legacy_v1', 'siri_pm_v2')
  ),

  -- Selected focus dimensions (>=1 per Building Block, plus the Step-8b
  -- bonus) — denormalised for fast read, derivable from rationale_by_unit_id.
  focus_unit_ids JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_siri_prioritisation_snapshots_session
  ON siri_prioritisation_snapshots (organization_id, session_id);
