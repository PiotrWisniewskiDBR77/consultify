-- KPI-E003 — Deviation Closed Loop schema (response policies, deviation
-- cases, corrective actions, effectiveness verifications).
--
-- Design: docs/product/results-vnext/KPI_E003_DESIGN.md §A (frozen, APPROVED
-- FOR IMPLEMENTATION 2026-08-09 — full DDL copied verbatim from that file,
-- not reconstructed; unlike KPI-E001/E002 (see 20260810_rvn_kpi_core.sql's
-- header), this design doc's own text explicitly warns against the
-- "conversation/ledger" pointer mistake and pastes the complete SQL inline).
-- Builds on server/migrations/20260810_rvn_kpi_core.sql
-- (rvn_kpi_definitions, rvn_kpi_measurements) and the RN-G1 platform
-- foundation (rvn_platform_events — see 20260809_rvn_platform_events_outbox.sql).
--
-- Case key = (organization_id, kpi_id) — at most one non-closed
-- DeviationCase per KPI, enforced by ux_rvn_kpi_deviation_cases_one_active_per_kpi
-- below (a database-level partial unique index, not just an application
-- check). Consecutive bad measurements escalate severity on the existing
-- case, they never spawn a second case (kpiDeviationCommands.ts's
-- openOrEscalateDeviationCase).
--
-- "Plan" is a phase of the case lifecycle (design decision #2), not a
-- separate table — maker-checker for it lives as 4 columns
-- (plan_submitted_by/_at, plan_approved_by/_at) on rvn_kpi_deviation_cases.
--
-- -- IDEMPOTENCY DEVIATION FROM DESIGN (process note, not a schema change):
-- the design doc's literal DDL for the two `rvn_platform_obligations`-style
-- trailing indexes in the SIBLING migration (20260811_rvn_platform_obligations.sql)
-- omits `IF NOT EXISTS`; this file's own plain `CREATE INDEX IF NOT EXISTS`
-- statements already matched the doc verbatim (the doc uses `IF NOT EXISTS`
-- on every index here), so no change was needed in THIS file. Noted here
-- only so a reviewer diffing this file against §A does not need to
-- re-derive that fact independently.

-- DEVIATION FROM DESIGN: verified on a real ephemeral Postgres 16 that the
-- literal ALTER TABLE ... ADD CONSTRAINT fk_rvn_kpi_definitions_response_policy
-- below fails with "incompatible types: text and uuid" as written —
-- `rvn_kpi_definitions.response_policy_id` was created as `TEXT NULL` by
-- 20260810_rvn_kpi_core.sql ("No FK yet (decyzja #6) — column exists so
-- KPI-E003 can add the FK ... without a second migration touching this
-- column"), but §A's `rvn_kpi_response_policies.response_policy_id` is
-- `UUID PRIMARY KEY DEFAULT gen_random_uuid()`. The design doc's own DDL for
-- both tables is copied verbatim above/below; this mismatch was not caught
-- by the earlier design review. Nearest safe equivalent, since
-- 20260810_rvn_kpi_core.sql is an already-landed migration in this branch
-- and rewriting a shipped migration file is riskier than converting the
-- column in the migration that actually needs the new type: convert
-- `response_policy_id` to UUID here, immediately before the FK is added,
-- via an explicit cast. The column has no production data yet (this domain
-- is still pre-launch), and `TEXT::uuid` is a no-op on a column that is
-- already UUID (idempotent re-run), so this is safe on both a fresh table
-- and a second run of this file.
DO $$
BEGIN
  ALTER TABLE rvn_kpi_definitions
    ALTER COLUMN response_policy_id TYPE UUID USING response_policy_id::uuid;
END $$;

-- Resolves the debt from KPI_E001_E002_DESIGN.md decision #6
-- ("response_policy_id — no FK yet, FK added when KPI-E003 lands").
CREATE TABLE IF NOT EXISTS rvn_kpi_response_policies (
  response_policy_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id                 TEXT NOT NULL,
  name                            TEXT NOT NULL,
  warning_response_hours          INT NOT NULL DEFAULT 120,
  critical_response_hours         INT NOT NULL DEFAULT 48,
  requires_effectiveness_verification_to_close BOOLEAN NOT NULL DEFAULT true,
  accepted_verification_statuses  TEXT[] NOT NULL
                                    DEFAULT ARRAY['effective','partially_effective'],
  is_default                      BOOLEAN NOT NULL DEFAULT false,
  row_version                     INT NOT NULL DEFAULT 1,
  created_by                      TEXT NOT NULL,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_rvn_kpi_response_policies_one_default
  ON rvn_kpi_response_policies(organization_id) WHERE is_default;

DO $$
BEGIN
  ALTER TABLE rvn_kpi_definitions
    ADD CONSTRAINT fk_rvn_kpi_definitions_response_policy
    FOREIGN KEY (response_policy_id) REFERENCES rvn_kpi_response_policies(response_policy_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS rvn_kpi_deviation_cases (
  case_id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id             TEXT NOT NULL,
  kpi_id                     UUID NOT NULL REFERENCES rvn_kpi_definitions(kpi_id),
  trigger_measurement_id       UUID NOT NULL REFERENCES rvn_kpi_measurements(measurement_id),
  severity                   TEXT NOT NULL CHECK (severity IN ('warning','critical')),
  status                     TEXT NOT NULL DEFAULT 'open'
                                CHECK (status IN (
                                  'open','analysis_required','plan_required','plan_submitted',
                                  'approved','executing','recovery_observed','verification','closed'
                                )),
  -- escalated = non-exclusive overlay, NEVER a state in the machine above.
  escalated                  BOOLEAN NOT NULL DEFAULT false,
  escalated_at                TIMESTAMPTZ NULL,
  escalated_reason            TEXT NULL,
  escalated_by                TEXT NULL,

  owner_user_id               TEXT NOT NULL,
  -- Decision #1: caller-provided, not resolved by this domain.
  manager_user_id             TEXT NULL,

  detected_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  response_due_at             TIMESTAMPTZ NULL,

  root_cause_summary           TEXT NULL,
  root_cause_category          TEXT NULL,
  recurrence_flag              BOOLEAN NOT NULL DEFAULT false,
  expected_recovery_date        DATE NULL,
  expected_recovery_value       NUMERIC NULL,

  -- "Plan" as case phase (decision #2).
  plan_submitted_by            TEXT NULL,
  plan_submitted_at            TIMESTAMPTZ NULL,
  plan_approved_by             TEXT NULL,
  plan_approved_at             TIMESTAMPTZ NULL,

  recovery_observed_by          TEXT NULL,
  recovery_observed_at          TIMESTAMPTZ NULL,
  recovery_observation_measurement_id UUID NULL REFERENCES rvn_kpi_measurements(measurement_id),

  closed_at                   TIMESTAMPTZ NULL,
  closed_by                   TEXT NULL,
  close_effectiveness_verification_id UUID NULL,   -- FK added below after that table exists

  reopened_from_case_id         UUID NULL REFERENCES rvn_kpi_deviation_cases(case_id),

  row_version                  INT NOT NULL DEFAULT 1,
  created_by                  TEXT NOT NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case-key idempotency (invariant #8) — hard DB guarantee.
CREATE UNIQUE INDEX IF NOT EXISTS ux_rvn_kpi_deviation_cases_one_active_per_kpi
  ON rvn_kpi_deviation_cases(organization_id, kpi_id)
  WHERE status <> 'closed';

CREATE INDEX IF NOT EXISTS idx_rvn_kpi_deviation_cases_org_status
  ON rvn_kpi_deviation_cases(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_rvn_kpi_deviation_cases_owner
  ON rvn_kpi_deviation_cases(organization_id, owner_user_id, status);
CREATE INDEX IF NOT EXISTS idx_rvn_kpi_deviation_cases_reopened_from
  ON rvn_kpi_deviation_cases(reopened_from_case_id) WHERE reopened_from_case_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS rvn_kpi_corrective_actions (
  action_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deviation_case_id      UUID NOT NULL REFERENCES rvn_kpi_deviation_cases(case_id),
  organization_id        TEXT NOT NULL,
  title                 TEXT NOT NULL,
  description            TEXT NULL,
  owner_user_id          TEXT NOT NULL,
  due_date              TIMESTAMPTZ NULL,
  status                TEXT NOT NULL DEFAULT 'planned'
                          CHECK (status IN ('planned','active','blocked','completed','cancelled')),
  expected_effect        TEXT NULL,
  actual_effect          TEXT NULL,
  row_version            INT NOT NULL DEFAULT 1,
  created_by             TEXT NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rvn_kpi_corrective_actions_case
  ON rvn_kpi_corrective_actions(deviation_case_id, status);
CREATE INDEX IF NOT EXISTS idx_rvn_kpi_corrective_actions_owner
  ON rvn_kpi_corrective_actions(organization_id, owner_user_id, status);

CREATE TABLE IF NOT EXISTS rvn_kpi_effectiveness_verifications (
  verification_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deviation_case_id           UUID NOT NULL REFERENCES rvn_kpi_deviation_cases(case_id),
  organization_id             TEXT NOT NULL,
  verification_window_start     TIMESTAMPTZ NOT NULL,
  verification_window_end       TIMESTAMPTZ NOT NULL,
  status                      TEXT NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','effective','partially_effective','ineffective')),
  rationale                   TEXT NULL,
  verified_by                  TEXT NULL,
  verified_at                  TIMESTAMPTZ NULL,
  row_version                 INT NOT NULL DEFAULT 1,
  created_by                  TEXT NOT NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rvn_kpi_effectiveness_verifications_case
  ON rvn_kpi_effectiveness_verifications(deviation_case_id, status);

-- Decision #6: normalized join table instead of literal uuid[].
CREATE TABLE IF NOT EXISTS rvn_kpi_effectiveness_verification_measurements (
  verification_id   UUID NOT NULL REFERENCES rvn_kpi_effectiveness_verifications(verification_id),
  measurement_id     UUID NOT NULL REFERENCES rvn_kpi_measurements(measurement_id),
  PRIMARY KEY (verification_id, measurement_id)
);

DO $$
BEGIN
  ALTER TABLE rvn_kpi_deviation_cases
    ADD CONSTRAINT fk_rvn_kpi_deviation_cases_close_verification
    FOREIGN KEY (close_effectiveness_verification_id)
    REFERENCES rvn_kpi_effectiveness_verifications(verification_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
