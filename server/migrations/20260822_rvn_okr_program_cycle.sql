-- OKR-E001 — Program & Cycle schema.
--
-- Design: docs/product/results-vnext/OKR_E001_DESIGN.md §4.
--
-- Decision P1: migration FILENAME uses `rvn_okr_`, every TABLE inside uses
-- `okr_vnext_` — intentional, both source docs specify it (EXECUTION_LEDGER
-- §448 confirms this deliberate divergence).
--
-- Decision P2: no ABAC visibility rows for Program/Cycle — plain
-- organization_id scoping. No rvn_platform_resource_visibility rows written
-- by this epic's commands.
--
-- Decision D09 (OKR domain independence): zero FKs from okr_vnext_programs/
-- okr_vnext_cycles to initiatives, kpi_*, roi_*, tasks, or projects.

-- ============================================================
-- okr_vnext_programs — root aggregate #1. Org-wide policy container.
-- ============================================================
CREATE TABLE IF NOT EXISTS okr_vnext_programs (
  program_id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id                  TEXT NOT NULL,
  name                              TEXT NOT NULL,
  status                            TEXT NOT NULL DEFAULT 'draft'
                                      CHECK (status IN ('draft','active','suspended','retired')),

  cycle_model                       TEXT NOT NULL DEFAULT 'quarterly'
                                      CHECK (cycle_model IN ('quarterly','trimester','half_year','annual','custom')),
  annual_direction_enabled          BOOLEAN NOT NULL DEFAULT false,
  objective_min_recommended         INT NULL,
  objective_max_recommended         INT NULL,
  kr_min_required                   INT NOT NULL DEFAULT 2,
  kr_max_recommended                INT NULL,
  checkin_frequency                 TEXT NOT NULL DEFAULT 'biweekly'
                                      CHECK (checkin_frequency IN ('weekly','biweekly','monthly','custom')),
  approval_required                 BOOLEAN NOT NULL DEFAULT true,
  scoring_model                     TEXT NOT NULL DEFAULT 'zero_to_one'
                                      CHECK (scoring_model IN ('zero_to_one','percentage','categories','custom')),
  objective_rollup_model            TEXT NOT NULL DEFAULT 'none'
                                      CHECK (objective_rollup_model IN ('equal_average','weighted_average','manual','none')),
  confidence_enabled                BOOLEAN NOT NULL DEFAULT true,
  confidence_model                  TEXT NOT NULL DEFAULT 'high_medium_low'
                                      CHECK (confidence_model IN ('high_medium_low','numeric','custom')),
  objective_confidence_model        TEXT NOT NULL DEFAULT 'lowest_kr'
                                      CHECK (objective_confidence_model IN ('lowest_kr','owner_selected','custom')),
  -- Platform's real enum spelling (visibilityResolver.ts), not the plan
  -- doc's prose spelling.
  visibility_default                TEXT NOT NULL DEFAULT 'OPEN_ORG'
                                      CHECK (visibility_default IN ('OPEN_ORG','SCOPE','MANAGEMENT_CHAIN','PRIVATE','RESTRICTED_ACL')),
  committed_vs_aspirational_enabled BOOLEAN NOT NULL DEFAULT true,
  manager_review_required           BOOLEAN NOT NULL DEFAULT true,
  self_review_required              BOOLEAN NOT NULL DEFAULT false,
  -- EVIDENCE_NEEDED #3 (plan §20) still OPEN — false is the fail-safe
  -- default until Founder decides, not a guess at eventual policy.
  reflection_required_for_close     BOOLEAN NOT NULL DEFAULT false,
  recognition_enabled               BOOLEAN NOT NULL DEFAULT true,

  -- Circular FK with okr_vnext_program_policy_versions — plain nullable
  -- column now, ALTERed after both tables exist below. Same resolution
  -- rvn_kpi_definitions.current_definition_version_id used.
  active_policy_version_id          UUID NULL,

  row_version                       INT NOT NULL DEFAULT 1,
  created_by                        TEXT NOT NULL,
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                        TEXT NULL,
  updated_at                        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_okr_vnext_programs_org_status
  ON okr_vnext_programs(organization_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS ux_okr_vnext_programs_one_active_per_org
  ON okr_vnext_programs(organization_id)
  WHERE status = 'active';

-- ============================================================
-- okr_vnext_program_policy_versions — append-only publish history.
-- ============================================================
CREATE TABLE IF NOT EXISTS okr_vnext_program_policy_versions (
  policy_version_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id           UUID NOT NULL REFERENCES okr_vnext_programs(program_id),
  organization_id      TEXT NOT NULL,
  version_number       INT NOT NULL,
  -- Immutable snapshot of every policy field on okr_vnext_programs at the
  -- moment publishProgram() was called — the mechanism satisfying
  -- OKR-F-001-AC-01: Cycles pin policy_version_id at creation, so a later
  -- republish never reinterprets a Cycle created under an earlier snapshot.
  snapshot             JSONB NOT NULL,
  published_by         TEXT NOT NULL,
  published_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (program_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_okr_vnext_ppv_program
  ON okr_vnext_program_policy_versions(organization_id, program_id);

REVOKE UPDATE, DELETE ON okr_vnext_program_policy_versions FROM PUBLIC;

DO $$
BEGIN
  ALTER TABLE okr_vnext_programs
    ADD CONSTRAINT fk_okr_vnext_programs_active_policy_version
    FOREIGN KEY (active_policy_version_id)
    REFERENCES okr_vnext_program_policy_versions(policy_version_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- okr_vnext_cycles — root aggregate #2. Calendar/governance window.
-- ============================================================
-- REGRESSION GUARD (OKR-F-002-AC-02): do NOT add dept_id/team_id/
-- scope_type/scope_id here — that was the exact AS-IS mistake. Scope
-- belongs exclusively to okr_vnext_sets (OKR-E002), not created here.
CREATE TABLE IF NOT EXISTS okr_vnext_cycles (
  cycle_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          TEXT NOT NULL,
  program_id                UUID NOT NULL REFERENCES okr_vnext_programs(program_id),
  name                       TEXT NOT NULL,

  start_date                 DATE NOT NULL,
  end_date                   DATE NOT NULL,
  draft_open_at              TIMESTAMPTZ NOT NULL,
  submission_due_at          TIMESTAMPTZ NOT NULL,
  approval_due_at            TIMESTAMPTZ NULL,
  active_start_at            TIMESTAMPTZ NOT NULL,
  midcycle_review_at         TIMESTAMPTZ NULL,
  final_update_due_at        TIMESTAMPTZ NOT NULL,
  review_open_at             TIMESTAMPTZ NOT NULL,
  reflection_due_at          TIMESTAMPTZ NOT NULL,
  manager_review_due_at      TIMESTAMPTZ NULL,
  close_at                   TIMESTAMPTZ NOT NULL,

  status                     TEXT NOT NULL DEFAULT 'planned'
                               CHECK (status IN ('planned','drafting','active','review','closed','cancelled')),
  -- Snapshot pointer, set once at creation from
  -- okr_vnext_programs.active_policy_version_id — NEVER updated afterward.
  policy_version_id          UUID NOT NULL REFERENCES okr_vnext_program_policy_versions(policy_version_id),

  row_version                 INT NOT NULL DEFAULT 1,
  created_by                  TEXT NOT NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                  TEXT NULL,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (start_date <= end_date)
);

CREATE INDEX IF NOT EXISTS idx_okr_vnext_cycles_org_program_status
  ON okr_vnext_cycles(organization_id, program_id, status);

-- ============================================================
-- okr_vnext_checkin_occurrences — minimal shell (Decision P11).
-- ============================================================
CREATE TABLE IF NOT EXISTS okr_vnext_checkin_occurrences (
  cadence_occurrence_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id            TEXT NOT NULL,
  cycle_id                    UUID NOT NULL REFERENCES okr_vnext_cycles(cycle_id),
  window_start                DATE NOT NULL,
  window_end                  DATE NOT NULL,
  generated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by                 TEXT NOT NULL DEFAULT 'system:okr_cycle_scheduler',
  UNIQUE (cycle_id, window_start)
);

CREATE INDEX IF NOT EXISTS idx_okr_vnext_checkin_occ_cycle
  ON okr_vnext_checkin_occurrences(organization_id, cycle_id);

-- No trigger needed on okr_vnext_program_policy_versions — pure
-- INSERT-only, REVOKE UPDATE/DELETE is sufficient (never has a *partial*
-- mutability window the way KPI/ROI's approval snapshots do).
