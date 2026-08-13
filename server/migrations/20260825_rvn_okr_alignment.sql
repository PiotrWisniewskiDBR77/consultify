-- OKR-E005 — Alignment schema. ObjectiveAlignment: Objective -> Objective edge.
--
-- Design: docs/product/results-vnext/OKR_E005_DESIGN.md, ratified by the
-- §-IO Integration Owner rulings block at the top of that document.
--
-- IO-1 re-verification finding (binding, done before writing this file):
-- the design doc assumed OKR-E003 would register a NEW 'okr_objective'
-- resource_type in RVN_RESOURCE_TYPES / rvn_platform_resource_visibility for
-- Objectives. Direct read of the ACTUAL LANDED
-- server/migrations/20260824_rvn_okr_objective_key_result.sql and
-- server/src/services/resultsVnext/okr/okrObjectiveRepository.ts shows E003
-- landed a DIFFERENT, simpler choice: Objectives/KeyResults have NO
-- independent resource_type/ABAC row at all — they inherit visibility
-- entirely through the parent Set's own 'okr_set' visibility row, joined on
-- `set_id`. This migration and its command/repository layer are written
-- against that ACTUAL landed shape, not the design draft's assumption — see
-- the E005 closure entry (EXECUTION_LEDGER.md) for the full divergence note.
--
-- D09/OKR-F-015 (the defining constraint of this epic — "brak FK/roll-up
-- inheritance", 01_RESULTS_MASTER_IMPLEMENTATION_PLAN.md's D09 gate-table
-- acceptance-evidence column): NO trigger, NO FK-driven cascade, and NO
-- column on this table (or on okr_vnext_objectives) that could carry an
-- inherited score exists anywhere below. Layer 1 of the four-layer
-- structural proof (design §B) — see
-- tests/resultsVnext/okr/alignmentNoScoreMutation.static.test.ts (Layer 2),
-- tests/resultsVnext/okr/alignmentNoScoreMutation.realdb.test.ts (Layers 3+4)
-- for the rest.

-- ============================================================
-- okr_vnext_alignments — ObjectiveAlignment. Objective -> Objective edge.
-- D09/OKR-F-015: NO trigger, NO cascade to okr_vnext_objectives, anywhere.
-- ============================================================
CREATE TABLE IF NOT EXISTS okr_vnext_alignments (
  alignment_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           TEXT NOT NULL,

  source_objective_id       UUID NOT NULL REFERENCES okr_vnext_objectives(objective_id),
  target_objective_id       UUID NOT NULL REFERENCES okr_vnext_objectives(objective_id),

  -- MVP: exactly one legal relation. Neither the AC table nor plan §6 names
  -- a second relation type ("supports"/"depends-on" were the task brief's
  -- own speculative paraphrase, not sourced text, per design §J item 2) —
  -- widen only against a future AC, not speculatively.
  relation                  TEXT NOT NULL DEFAULT 'contributes_to'
                               CHECK (relation IN ('contributes_to')),
  rationale                 TEXT NULL,

  status                    TEXT NOT NULL DEFAULT 'proposed'
                               CHECK (status IN ('proposed','accepted','rejected','removed')),

  -- OKR-F-016: cycle/org compatibility as a REAL DB-level CHECK, not only
  -- app-code validation — denormalized at write time from each Objective's
  -- owning Set (Postgres CHECK constraints cannot cross-reference other
  -- tables). Design §C's chosen interpretation: same organization_id AND
  -- same cycle_id (resolved transitively via okr_vnext_objectives.set_id ->
  -- okr_vnext_sets.cycle_id).
  source_cycle_id            UUID NOT NULL,
  target_cycle_id            UUID NOT NULL,

  proposed_by                TEXT NOT NULL,
  proposed_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_by                TEXT NULL,
  responded_at                TIMESTAMPTZ NULL,
  response_reason             TEXT NULL,
  removed_by                  TEXT NULL,
  removed_at                  TIMESTAMPTZ NULL,

  row_version                  INT NOT NULL DEFAULT 1,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- No self-loop.
  CHECK (source_objective_id <> target_objective_id),
  -- OKR-F-016: same-Cycle required (design §C — cross-Program alignment is
  -- rejected as a consequence, since a Cycle belongs to exactly one Program).
  CHECK (source_cycle_id = target_cycle_id)
);

CREATE INDEX IF NOT EXISTS idx_okr_vnext_alignments_org_source
  ON okr_vnext_alignments(organization_id, source_objective_id, status);
CREATE INDEX IF NOT EXISTS idx_okr_vnext_alignments_org_target
  ON okr_vnext_alignments(organization_id, target_objective_id, status);

-- Dedup slot: rejected/removed frees the slot (same "frees the slot" pattern
-- as okr_vnext_sets' ux_okr_vnext_sets_one_per_scope_cycle_owner, D3 of
-- OKR-E002) — a fresh proposal is allowed after a prior one was rejected or
-- removed; a live proposed/accepted duplicate is not.
CREATE UNIQUE INDEX IF NOT EXISTS ux_okr_vnext_alignments_live_edge
  ON okr_vnext_alignments(organization_id, source_objective_id, target_objective_id, relation)
  WHERE status IN ('proposed','accepted');

-- ============================================================
-- Explicitly absent by design (D09/OKR-F-015):
--   * no trigger on this table touching okr_vnext_objectives;
--   * no FOREIGN KEY ... ON UPDATE CASCADE anywhere near progress/confidence;
--   * no rvn_platform_resource_visibility row for this table's own
--     alignment_id (alignment visibility is DERIVED at read time from both
--     endpoints' Objective visibility — inherited via each Objective's own
--     set_id -> the parent Set's 'okr_set' visibility row, never
--     independently set on the edge itself — see okrAlignmentRepository.ts);
--   * no 'okr_alignment' entry in rvn_platform_resource_visibility /
--     RVN_RESOURCE_TYPES's ABAC surface — 'okr_alignment' IS appended to
--     RVN_RESOURCE_TYPES (resourceTypes.ts) but ONLY for
--     PlatformEventEnvelope.aggregateType tagging purposes, mirroring the
--     existing 'okr_program'/'okr_cycle' entries' own precedent comment
--     ("NOT for ABAC rows... only because aggregateType is typed to this
--     union"). No ABAC row is ever written for it.
-- ============================================================
