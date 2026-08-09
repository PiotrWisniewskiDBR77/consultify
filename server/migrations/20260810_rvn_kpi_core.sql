-- KPI-E001/E002 — core schema (rvn_kpi_definitions / rvn_kpi_definition_versions
-- / rvn_kpi_measurements).
--
-- Design: docs/product/results-vnext/KPI_E001_E002_DESIGN.md (frozen,
-- APPROVED FOR IMPLEMENTATION 2026-08-09). Builds on the RN-G1 platform
-- foundation (rvn_platform_events/outbox, rvn_platform_resource_visibility,
-- rvn_platform_visibility_policies — see server/migrations/20260809_rvn_platform_*.sql).
--
-- -- DEVIATION FROM DESIGN (process note, not a schema deviation): the
-- design doc's own text says the full DDL is "ratified as-is" from a prior
-- agent's draft (`a2f31db3dd772a6e2`) and points to "conversation/ledger for
-- complete text". That literal DDL text is NOT present anywhere in this
-- worktree — verified via `grep -rln "rvn_kpi_definitions" .` returning only
-- the two design/ledger markdown files (which summarize decisions, not the
-- SQL itself) before this migration was written. This file is therefore a
-- from-scratch reconstruction that satisfies every explicit, literal
-- constraint the design doc DOES state (table names, the partial EXCLUDE,
-- the protect_approved trigger name and semantics, the two independent
-- measurement status columns, the single-resource_type visibility rule, the
-- append-only REVOKE, the circular-FK resolution via post-creation ALTER,
-- the boundary-rule/exact-geometry semantics from decyzje #7/#9/#10) — column
-- names/types beyond what the doc pins down are this implementer's
-- judgment, following the conventions of the sibling RN-G1 migrations in
-- this same directory. Flag for review against the original draft text if
-- it resurfaces.
--
-- -- FIX (EXECUTION_LEDGER.md §16, 2026-08-09/10): the reconstruction above
-- omitted two enum members that ARE explicit in the source domain plan
-- (`docs/product/results-vnext/02_KPI_IMPLEMENTATION_PLAN.md` §3.1 "KPI
-- Definition Version" / §4.1 "KPI lifecycle"), not merely the 12
-- design-doc decisions this file's header above cross-checks against —
-- `target_geometry`'s `'binary'` case and `rvn_kpi_definitions.status`'s
-- `'pending_approval'` state. Both are added below (still edited in place,
-- not stacked as a second migration — this file had not left the branch
-- when the gap was found). See `binary_success_value` below and this
-- table's `status` CHECK for the concrete fix.

-- ==========================================
-- rvn_kpi_definitions — root aggregate.
-- ==========================================
-- The ONLY KPI table with a corresponding row in
-- rvn_platform_resource_visibility (resource_type='kpi', design doc "Key
-- points" list) — versions and measurements inherit visibility via kpi_id,
-- no separate resource_type per child table.
--
-- current_definition_version_id has a circular dependency with
-- rvn_kpi_definition_versions (that table's rows reference kpi_id back to
-- this one) — created here as a plain nullable column with NO inline FK,
-- the FK constraint is added by ALTER TABLE after both tables exist (below).
CREATE TABLE IF NOT EXISTS rvn_kpi_definitions (
  kpi_id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id             TEXT NOT NULL,
  kpi_code                  TEXT NOT NULL,
  -- 'pending_approval' sits between 'draft' and 'active' (plan §4.1:
  -- "draft -> pending_approval -> active <-> suspended -> archived") —
  -- entered by submitDefinition() when the KPI's first/current definition
  -- version is submitted for review, left by approveDefinitionVersion()
  -- only implicitly (status stays 'pending_approval' until activateKpi()
  -- explicitly moves it to 'active' — approval and activation are distinct
  -- actions, see kpiDefinitionCommands.ts) or by rejectDefinitionVersion()
  -- (moves back to 'draft' so the KPI can be edited and resubmitted).
  status                    TEXT NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft','pending_approval','active','suspended','archived')),
  current_definition_version_id UUID NULL,
  -- No FK, no process registry check (decyzja #5) — deferred, flagged for
  -- verification before the Slice K1 process-picker UI is built.
  primary_process_id            TEXT NULL,
  -- No FK yet (decyzja #6) — column exists so KPI-E003 (Deviation) can add
  -- the FK to its response-policy table without a second migration touching
  -- this column.
  response_policy_id            TEXT NULL,
  owner_user_id               TEXT NULL,
  -- Optimistic-concurrency version for executeAtomicCommand callers that
  -- mutate this root row directly (activateKpi/suspendKpi/archiveKpi).
  row_version                 INT NOT NULL DEFAULT 1,
  created_by                 TEXT NOT NULL,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, kpi_code)
);

CREATE INDEX IF NOT EXISTS idx_rvn_kpi_definitions_org_status
  ON rvn_kpi_definitions(organization_id, status);

-- ==========================================
-- rvn_kpi_definition_versions — versioned contract.
-- ==========================================
-- One row per (kpi_id, version_number). `approval_status` drives the
-- maker-checker lifecycle (draft -> submitted -> approved|rejected).
-- Approved rows become immutable except `effective_to`
-- (trg_rvn_kpi_definition_versions_protect_approved below).
--
-- target_geometry + the six numeric bound columns are consumed by the pure
-- evaluatePerformanceStatus() function (targetGeometryEvaluator.ts, design
-- §C) — see that file for the exact per-geometry semantics of each bound.
-- 'custom' geometry never reads formula_text at evaluation time (decyzja
-- #9: "no arbitrary code execution in custom formulas" — always neutral).
--
-- 'binary' (plan §3.1's `direction: ... | binary | ...`) is the sixth
-- geometry — zero-event compliance ("zero incidents", "certificate valid",
-- "report filed on time"). It does NOT fit the six numeric bound columns
-- above (there is no zone to be near/far from — a period either satisfies
-- the compliance condition or it does not, decyzja #7-style boundary logic
-- does not apply). Rather than repurpose `target_value`/NUMERIC(0/1) with
-- no column documenting what "1" is supposed to mean for a given KPI, this
-- migration adds one dedicated column below (`binary_success_value`) that
-- pins, per definition version, which `rvn_kpi_measurements.actual_value`
-- (0 or 1) counts as success — see that column's own comment and
-- targetGeometryEvaluator.ts's evalBinary() for the read side.
CREATE TABLE IF NOT EXISTS rvn_kpi_definition_versions (
  definition_version_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id                 UUID NOT NULL REFERENCES rvn_kpi_definitions(kpi_id),
  organization_id           TEXT NOT NULL,
  version_number            INT NOT NULL,
  name                   TEXT NOT NULL,
  description              TEXT NULL,
  unit                   TEXT NULL,
  target_geometry           TEXT NOT NULL
                            CHECK (target_geometry IN
                              ('threshold_min','threshold_max','range','exact','binary','custom')),
  target_value             NUMERIC NULL,
  target_min               NUMERIC NULL,
  target_max               NUMERIC NULL,
  warning_low              NUMERIC NULL,
  warning_high              NUMERIC NULL,
  critical_low              NUMERIC NULL,
  critical_high             NUMERIC NULL,
  -- Only meaningful when target_geometry = 'binary'. The `actual_value`
  -- (0 or 1, see rvn_kpi_measurements below) that counts as "on target" for
  -- THIS definition version — e.g. 0 for "zero incidents" (success is the
  -- absence of the event), 1 for "certificate valid"/"report filed on
  -- time" (success is the presence/occurrence of the event). Kept as its
  -- own NUMERIC(0|1) column, comparable directly against
  -- rvn_kpi_measurements.actual_value without a type cast, rather than
  -- repurposing target_value (which every OTHER geometry already uses for
  -- a genuine numeric target and would make a binary KPI's target_value
  -- ambiguous between "the target number" and "the success flag"). NULL
  -- for every non-'binary' geometry, and NULL is also a legal (if
  -- incomplete) state for a 'binary' draft — evaluatePerformanceStatus()
  -- treats a 'binary' measurement with no configured success value as
  -- 'neutral', the same "missing config never fabricates a status" rule
  -- every other geometry follows for its own missing bounds.
  binary_success_value        NUMERIC NULL CHECK (binary_success_value IN (0,1)),
  -- Free-text formula description for human readers / future restricted
  -- expression engine (decyzja #9 explicitly defers that engine as a
  -- separate future package) — never evaluated as code by this package.
  formula_text             TEXT NULL,
  approval_status            TEXT NOT NULL DEFAULT 'draft'
                            CHECK (approval_status IN ('draft','submitted','approved','rejected')),
  effective_from            TIMESTAMPTZ NULL,
  effective_to              TIMESTAMPTZ NULL,
  created_by               TEXT NOT NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_by              TEXT NULL,
  submitted_at              TIMESTAMPTZ NULL,
  approved_by               TEXT NULL,
  approved_at               TIMESTAMPTZ NULL,
  rejected_by               TEXT NULL,
  rejected_at               TIMESTAMPTZ NULL,
  rejection_reason           TEXT NULL,
  row_version              INT NOT NULL DEFAULT 1,
  UNIQUE (kpi_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_rvn_kpi_definition_versions_kpi
  ON rvn_kpi_definition_versions(kpi_id, version_number);
CREATE INDEX IF NOT EXISTS idx_rvn_kpi_definition_versions_org_status
  ON rvn_kpi_definition_versions(organization_id, approval_status);

-- Partial EXCLUDE (decyzja #3, "approved as designed"): overlapping
-- effective periods are only forbidden between APPROVED versions of the
-- SAME kpi_id — draft/submitted/rejected rows never participate, so the
-- normal draft -> reject -> redraft authoring cycle (which routinely
-- produces multiple non-approved rows with overlapping/undefined periods)
-- stays possible. `btree_gist` is enabled by the RN-G1 visibility-core
-- migration already; `CREATE EXTENSION IF NOT EXISTS` here too so this file
-- does not depend on migration ORDER for that prerequisite.
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  ALTER TABLE rvn_kpi_definition_versions
    ADD CONSTRAINT ux_rvn_kpi_definition_versions_approved_no_overlap
    EXCLUDE USING gist (
      kpi_id WITH =,
      tstzrange(effective_from, effective_to) WITH &&
    ) WHERE (approval_status = 'approved');
-- EXCLUDE constraints back an index under the SAME name — Postgres raises
-- `duplicate_table` (42P07, the relation-namespace error) for the index
-- collision on a re-run, NOT `duplicate_object` (42710, which is what a
-- plain re-added CHECK/FK constraint would raise) — verified empirically
-- against a real Postgres 16 re-run, not assumed. Catch both.
EXCEPTION WHEN duplicate_object OR duplicate_table THEN
  -- Re-run of this migration (idempotency requirement, RN-G1 §11 pattern) —
  -- constraint already exists, nothing to do.
  NULL;
END $$;

-- Row-level immutability trigger (decyzja #4: "new, second immutability
-- pattern in this program — partial-mutability via trigger, for rows where
-- exactly one field (effective_to) must stay writable after approval to
-- close a period"). Unlike rvn_platform_events' whole-table REVOKE (which
-- protects every column of every row unconditionally), this trigger only
-- blocks UPDATEs that change protected data while approval_status was
-- (before the UPDATE) 'approved', and it allows `effective_to` through even
-- then — closing an approved version's effective period is a legitimate,
-- expected write (e.g. suspendKpi/archiveKpi/superseding-version flows),
-- not a mutation of the approved contract itself.
CREATE OR REPLACE FUNCTION rvn_kpi_definition_versions_protect_approved()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.approval_status = 'approved' THEN
    IF NEW.kpi_id IS DISTINCT FROM OLD.kpi_id
       OR NEW.version_number IS DISTINCT FROM OLD.version_number
       OR NEW.name IS DISTINCT FROM OLD.name
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.unit IS DISTINCT FROM OLD.unit
       OR NEW.target_geometry IS DISTINCT FROM OLD.target_geometry
       OR NEW.target_value IS DISTINCT FROM OLD.target_value
       OR NEW.target_min IS DISTINCT FROM OLD.target_min
       OR NEW.target_max IS DISTINCT FROM OLD.target_max
       OR NEW.warning_low IS DISTINCT FROM OLD.warning_low
       OR NEW.warning_high IS DISTINCT FROM OLD.warning_high
       OR NEW.critical_low IS DISTINCT FROM OLD.critical_low
       OR NEW.critical_high IS DISTINCT FROM OLD.critical_high
       OR NEW.binary_success_value IS DISTINCT FROM OLD.binary_success_value
       OR NEW.formula_text IS DISTINCT FROM OLD.formula_text
       OR NEW.approval_status IS DISTINCT FROM OLD.approval_status
       OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.submitted_by IS DISTINCT FROM OLD.submitted_by
       OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
       OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
    THEN
      RAISE EXCEPTION
        'rvn_kpi_definition_versions: version % is approved — only effective_to (and row_version/updated_at bookkeeping) may change',
        OLD.definition_version_id
        USING ERRCODE = '23001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rvn_kpi_definition_versions_protect_approved ON rvn_kpi_definition_versions;
CREATE TRIGGER trg_rvn_kpi_definition_versions_protect_approved
  BEFORE UPDATE ON rvn_kpi_definition_versions
  FOR EACH ROW
  EXECUTE FUNCTION rvn_kpi_definition_versions_protect_approved();

-- Resolve the circular dependency: rvn_kpi_definitions.current_definition_version_id
-- -> rvn_kpi_definition_versions, added now that the target table exists.
DO $$
BEGIN
  ALTER TABLE rvn_kpi_definitions
    ADD CONSTRAINT fk_rvn_kpi_definitions_current_version
    FOREIGN KEY (current_definition_version_id)
    REFERENCES rvn_kpi_definition_versions(definition_version_id);
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- ==========================================
-- rvn_kpi_measurements — append-only.
-- ==========================================
-- performance_status and data_quality_status are ALWAYS two independent
-- columns (design doc "Key points" list — never collapsed into one field):
-- performance_status is the target-geometry evaluation outcome
-- (evaluatePerformanceStatus() output); data_quality_status is the
-- record/correct/verify/dispute workflow outcome. Neither implies the
-- other — a 'critical' measurement can be 'verified', an 'on_target' one
-- can be 'disputed'.
--
-- Append-only end to end (decyzja #12): recordMeasurement writes the first
-- row for a period; correctMeasurement/verifyMeasurement/disputeMeasurement
-- each write a NEW row referencing the prior one via
-- correction_of_measurement_id rather than UPDATing it — consistent with
-- the REVOKE UPDATE, DELETE below and with decyzja #12's routing of ALL
-- FOUR measurement commands through executeAtomicCreate (never CAS/UPDATE).
CREATE TABLE IF NOT EXISTS rvn_kpi_measurements (
  measurement_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id                   UUID NOT NULL REFERENCES rvn_kpi_definitions(kpi_id),
  definition_version_id        UUID NOT NULL REFERENCES rvn_kpi_definition_versions(definition_version_id),
  organization_id             TEXT NOT NULL,
  period_start               TIMESTAMPTZ NOT NULL,
  period_end                TIMESTAMPTZ NOT NULL,
  actual_value               NUMERIC NULL,
  performance_status           TEXT NOT NULL
                              CHECK (performance_status IN ('on_target','warning','critical','neutral')),
  data_quality_status           TEXT NOT NULL DEFAULT 'unverified'
                              CHECK (data_quality_status IN ('unverified','verified','disputed','estimated')),
  -- NULL = an original recording (participates in the "one row per period"
  -- uniqueness below); NOT NULL = a correction/verify/dispute row that
  -- supersedes an earlier row for the same period without deleting it.
  correction_of_measurement_id     UUID NULL REFERENCES rvn_kpi_measurements(measurement_id),
  correction_reason             TEXT NULL,
  source                    TEXT NOT NULL,
  evidence_refs                JSONB NOT NULL DEFAULT '[]',
  notes                    TEXT NULL,
  recorded_by                 TEXT NOT NULL,
  recorded_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Decyzja #12, quoted: "The ux_rvn_kpi_measurements_period unique index
-- (kpi_id, period_start, period_end WHERE correction_of_measurement_id IS
-- NULL) already provides the concurrency guarantee needed (first writer for
-- a given period wins...)". Corrections are deliberately UNCONSTRAINED by
-- this index (multiple corrections over time are expected).
CREATE UNIQUE INDEX IF NOT EXISTS ux_rvn_kpi_measurements_period
  ON rvn_kpi_measurements(kpi_id, period_start, period_end)
  WHERE correction_of_measurement_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_rvn_kpi_measurements_kpi
  ON rvn_kpi_measurements(organization_id, kpi_id, period_start);
CREATE INDEX IF NOT EXISTS idx_rvn_kpi_measurements_correction_of
  ON rvn_kpi_measurements(correction_of_measurement_id) WHERE correction_of_measurement_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rvn_kpi_measurements_quality
  ON rvn_kpi_measurements(organization_id, kpi_id, data_quality_status);

-- Same append-only limitation as rvn_platform_events (decyzja/"Key points"
-- list, explicit): REVOKE from PUBLIC does not stop an owner/superuser
-- connection — see 20260809_rvn_platform_events_outbox.sql's header comment
-- for the full rationale and the repo-wide grep that established this as
-- the pattern (no named least-privilege application role exists yet).
REVOKE UPDATE, DELETE ON rvn_kpi_measurements FROM PUBLIC;
