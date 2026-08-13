-- OKR-E003 — Objective & KeyResult schema.
--
-- Design: docs/product/results-vnext/OKR_E003_DESIGN.md §8, ratified by the
-- §-IO Integration Owner rulings block at the top of that document.
-- Builds on OKR-E001's server/migrations/20260822_rvn_okr_program_cycle.sql
-- (okr_vnext_programs/okr_vnext_cycles/okr_vnext_program_policy_versions)
-- and OKR-E002's server/migrations/20260823_rvn_okr_set.sql
-- (okr_vnext_sets) — both re-verified against their actual landed columns
-- before writing this migration (IO-1 re-verification finding: E001/E002
-- have both landed as of this epic starting).
--
-- Decision D-E3-1: table names okr_vnext_objectives / okr_vnext_key_results
-- — verbatim from the E003 AC table's own Schema/constraint cells.
--
-- §-IO item 1 (binding): binary geometry — achieved = 1.0, not achieved =
-- 0.0. maintain_range geometry — in-range = 1.0, out-of-range = 0.0, with
-- the out-of-range MAGNITUDE recorded in a separate diagnostic column
-- (out_of_range_distance below), never folded into `progress`. The design
-- draft's proposed linear-falloff formula is REJECTED by the Integration
-- Owner — this migration adds `out_of_range_distance` (NOT part of the
-- frozen draft's own DDL text, added here to implement the ruling).
--
-- §-IO item 2: progress is the RAW UNCLAMPED ratio — no CHECK constraint
-- clamps it to [0,1] or [0,100]. Overachievement (e.g. 1.4) is a legitimate
-- stored value.
--
-- D09 (OKR domain independence, re-affirmed by §-IO's D09 binding
-- correction): source_type/source_reference on okr_vnext_key_results are
-- plain TEXT, NO foreign key to any kpi_*/rvn_kpi_*/initiative_kpis table.
-- No okr_vnext_key_result_source_bindings table is built in this epic
-- (§-IO item 7: deferred).

-- ============================================================
-- okr_vnext_objectives — root aggregate #4 (child of okr_vnext_sets).
-- ============================================================
CREATE TABLE IF NOT EXISTS okr_vnext_objectives (
  objective_id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id                            UUID NOT NULL REFERENCES okr_vnext_sets(set_id),
  organization_id                    TEXT NOT NULL,

  owner_user_id                        TEXT NOT NULL,
  title                                  TEXT NOT NULL,
  description                             TEXT NULL,
  rationale                                TEXT NULL,

  -- D-E3-3: schema-permissive, command-layer-gated by
  -- Program.committed_vs_aspirational_enabled (read from the Cycle's
  -- pinned policy snapshot, never a live re-read).
  ambition_type                             TEXT NOT NULL DEFAULT 'standard'
                                              CHECK (ambition_type IN ('committed','aspirational','standard')),

  status                                     TEXT NOT NULL DEFAULT 'draft'
                                              CHECK (status IN (
                                                'draft','submitted','approved','active',
                                                'at_risk','completed','cancelled','closed'
                                              )),

  -- D-E3-9: computed/persisted BY E003 (rolled up from this Objective's own
  -- KRs), never by a Set-level process. NULL = not yet calculable (no KRs,
  -- or all KRs individually not_calculable, or rollup_model='none'/'manual').
  progress                                    NUMERIC NULL,
  progress_calc_policy_version_id             UUID NULL REFERENCES okr_vnext_program_policy_versions(policy_version_id),
  progress_calc_reason                        TEXT NULL,

  -- D-E3-10: rolled up per objective_confidence_model (lowest_kr/owner_selected).
  confidence                                   TEXT NULL CHECK (confidence IN ('high','medium','low','numeric')),
  confidence_numeric_value                     NUMERIC NULL,
  confidence_calc_policy_version_id            UUID NULL REFERENCES okr_vnext_program_policy_versions(policy_version_id),
  confidence_calc_reason                       TEXT NULL,

  sort_order                                    INT NOT NULL DEFAULT 0,

  row_version                                    INT NOT NULL DEFAULT 1,
  created_by                                     TEXT NOT NULL,
  created_at                                     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                                     TEXT NULL,
  updated_at                                     TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at                                    TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_okr_vnext_objectives_org_set
  ON okr_vnext_objectives(organization_id, set_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_okr_vnext_objectives_org_owner
  ON okr_vnext_objectives(organization_id, owner_user_id);

-- ============================================================
-- okr_vnext_key_results — root aggregate #5 (child of okr_vnext_objectives).
-- D09: NO FK on any KPI-pointing column (D-E3-11, §-IO item 7 deferred).
-- ============================================================
CREATE TABLE IF NOT EXISTS okr_vnext_key_results (
  key_result_id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id                      UUID NOT NULL REFERENCES okr_vnext_objectives(objective_id),
  set_id                             UUID NOT NULL REFERENCES okr_vnext_sets(set_id),  -- denormalized for cheap Set-scoped queries, mirrors okr_vnext_objectives.set_id
  organization_id                     TEXT NOT NULL,

  owner_user_id                        TEXT NOT NULL,
  title                                 TEXT NOT NULL,
  description                            TEXT NULL,

  -- D-E3-4: schema allows all 6, command layer rejects milestone/custom
  -- until a later epic implements their geometry.
  measurement_type                        TEXT NOT NULL
                                           CHECK (measurement_type IN (
                                             'numeric','percentage','currency','binary','milestone','custom'
                                           )),
  unit                                     TEXT NULL,
  currency                                 TEXT NULL,  -- required at command layer when measurement_type='currency'

  baseline_value                            NUMERIC NULL,
  target_value                              NUMERIC NULL,
  start_value                               NUMERIC NULL,
  current_value                             NUMERIC NULL,

  -- Plan §4.6's 5-value enum — the 5 geometries of OKR-F-009-AC-01.
  direction                                  TEXT NOT NULL
                                             CHECK (direction IN ('increase','decrease','reach','maintain_range','binary')),
  range_min                                  NUMERIC NULL,  -- required at command layer when direction='maintain_range'
  range_max                                  NUMERIC NULL,

  -- D-E3-7: computed/persisted synchronously on every write by the pure
  -- progress engine. §-IO item 2: raw unclamped ratio, never clamped here.
  -- NULL progress = not_calculable; progress_calc_reason is ALWAYS
  -- populated (both success and not_calculable paths) — OKR-F-009-AC-02's
  -- audit-trail requirement.
  progress                                    NUMERIC NULL,
  progress_calc_policy_version_id             UUID NOT NULL REFERENCES okr_vnext_program_policy_versions(policy_version_id),
  progress_calc_reason                        TEXT NULL,

  -- §-IO item 1: maintain_range's out-of-range MAGNITUDE, recorded
  -- separately from `progress` (which is a strict 1.0/0.0 in-range
  -- indicator for this geometry only) — never folded into `progress` for
  -- any geometry. NULL for every KR whose direction is not
  -- 'maintain_range', or whose maintain_range progress is itself
  -- not_calculable, or whose current value is in-range (distance = 0 is
  -- represented as an explicit 0, not NULL, when in-range and calculable).
  out_of_range_distance                       NUMERIC NULL,

  -- D-E3-10: KR-level confidence is OWNER-DECLARED input, never
  -- engine-computed — no calc_policy_version_id/calc_reason pair here
  -- (those exist only on okr_vnext_objectives, where confidence IS
  -- computed via rollup).
  confidence                                   TEXT NULL CHECK (confidence IN ('high','medium','low','numeric')),
  confidence_numeric_value                     NUMERIC NULL,

  status                                        TEXT NOT NULL DEFAULT 'not_started'
                                                 CHECK (status IN (
                                                   'not_started','on_track','at_risk','off_track',
                                                   'achieved','not_achieved','cancelled'
                                                 )),

  -- D-E3-11 / §-IO D09 correction: neutral, FK-less, informational-only.
  source_type                                    TEXT NOT NULL DEFAULT 'manual'
                                                   CHECK (source_type IN ('manual','import','connector','mcp','calculated')),
  source_reference                               TEXT NULL,  -- opaque string; NEVER a live FK to kpi_*/rvn_kpi_*/initiative_kpis

  weight                                          NUMERIC NULL,  -- for objective_rollup_model='weighted_average'; NULL treated as weight=1 (equal contribution) by the engine

  row_version                                     INT NOT NULL DEFAULT 1,
  created_by                                      TEXT NOT NULL,
  created_at                                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                                      TEXT NULL,
  updated_at                                      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Cross-field sanity, not full business-rule validation (that's the
  -- command layer's job — this CHECK exists only to catch obviously
  -- malformed rows, same restraint OKR-E001 P9 used for Cycle timestamps).
  CHECK (
    (direction <> 'maintain_range') OR (range_min IS NOT NULL AND range_max IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_okr_vnext_key_results_org_objective
  ON okr_vnext_key_results(organization_id, objective_id);
CREATE INDEX IF NOT EXISTS idx_okr_vnext_key_results_org_set
  ON okr_vnext_key_results(organization_id, set_id);
CREATE INDEX IF NOT EXISTS idx_okr_vnext_key_results_org_owner
  ON okr_vnext_key_results(organization_id, owner_user_id);

-- ============================================================
-- No new RVN_RESOURCE_TYPES / rvn_platform_resource_visibility rows for
-- Objective/KeyResult (D-E3-8, design §13) — visibility inherits via
-- set_id, joined through the parent Set's own 'okr_set' visibility row.
-- No REVOKE UPDATE/DELETE on either table — both are ordinarily-mutable
-- aggregates (row_version-CAS), unlike okr_vnext_approved_snapshots.
-- ============================================================
