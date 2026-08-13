# KPI-E003 Deviation Closed Loop — Approved Design

> Status: APPROVED FOR IMPLEMENTATION (Integration Owner review 2026-08-09).
> Draft: agent `a925f809507d44927`. **IMPORTANT PROCESS NOTE**: this file
> contains the COMPLETE DDL and command-layer code, copied verbatim from the
> draft — not a reference to "conversation/ledger". A prior package
> (KPI-E001/E002) lost the full draft text this way and had to be
> reconstructed from a decisions-only summary, which introduced two real gaps
> vs the source plan (missing `binary` geometry, missing `pending_approval`
> status) that were caught in review and fixed afterward. Do not repeat that
> mistake — implementers must be able to work from THIS FILE ALONE.

## Decisions on the 8 open questions

| # | Question | Decision |
|---|---|---|
| 1 | `manager_user_id` on DeviationCase has no source (`rvn_kpi_definitions` never had this column, `getManagementChain()` doesn't exist) | **Option (a): caller resolves and provides it.** Do not block KPI-E003 on the unbuilt management-chain service (tracked separately as blocker for KPI-F-023). |
| 2 | "Plan" modeled as a case phase (4 columns), not a separate agregate — changes API shape from plan §7.3 | **Approved.** Avoids inventing a third, under-specified agregate not grounded in plan §3.1's YAML. API route shape (`.../plan/submit`, `.../plan/approve`, no separate `:planId`) is ratified as part of this decision — nothing implements routes yet so the change is free. |
| 3 | `openOrEscalateDeviationCase` runs in the SAME transaction as the measurement insert vs. two separate `executeAtomicCreate` calls | **Approved as designed (same transaction).** The outbox has zero working consumers today (verified: `outboxDrain.ts` is functions only, no cron, no dispatcher registry) — choosing "async" would mean deviation cases silently never get created, exactly the "flag with 0 implementation" anti-pattern this program exists to eliminate. Revisit only if this coupling proves too tight in practice (documented as a TODO in the code). |
| 4 | `kpi.deviation_opened` as a payload field inside `kpi.measurement_recorded` vs. a genuinely separate `rvn_platform_events` row | **Separate event, not nested payload.** Emit a second explicit event insert (manual, not through `buildEvent`, in the same `applyMutation`/transaction) for `kpi.deviation_opened` / `kpi.deviation_escalated` when a case is created/escalated. This preserves per-event-type audit granularity and lets future dedicated consumers (manager notification, search index) subscribe without parsing nested JSON — worth the extra few lines given this event stream is the governance backbone of the whole program. |
| 5 | `rvn_platform_obligations` — build now as part of this package, or a separate future micro-package | **Build now, platform-owned**, same pattern as `executeAtomicCreate`/`getActiveVisibilityPolicy` being extracted into `platform/*` during KPI-E001/E002. OKR (check-in-due) and ROI (PIR-due) will need the identical mechanism — building it once now avoids the exact fragmentation (5 ROI systems, 4 KPI tables) this program exists to fix. |
| 6 | `EffectivenessVerification.measurement_ids` as a normalized join table instead of the plan's literal `uuid[]` | **Approved.** A join table makes the FK per element actually enforceable (Postgres does not validate FKs inside arrays) — this is a correctness improvement over the plan's YAML sketch, not a deviation of intent. |
| 7 | `reopenDeviationCase` starting status: fresh `open` vs `analysis_required` (skip re-acknowledging root cause) | **`open`** (agent's original design). Reopening a case implies the prior closure was premature or wrong — the whole analysis is called into question, not just the corrective actions. Re-running the full loop from `open` is the more conservative, correct choice for a governance-critical process. |
| 8 | `updateCorrectiveAction`'s auto-transition `approved → executing`: first action goes `active`, or all actions must be `active` | **First action is enough.** Requiring every action to start simultaneously is unrealistic for real teams (parallel vs. sequential execution); "work has begun" is a reasonable bar for entering `executing`. |

## A) Frozen schema

Case key = `(organization_id, kpi_id)` — **at most one non-closed
DeviationCase per KPI**, enforced by a database-level partial unique index
(not just an application check). Consecutive bad measurements escalate
severity on the existing case, they never spawn a second case.

"Plan" is a phase of the case lifecycle (decision #2), not a separate table —
maker-checker for it lives as 4 columns on `rvn_kpi_deviation_cases`.

```sql
-- server/migrations/20260811_rvn_kpi_deviation_loop.sql

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
```

```sql
-- server/migrations/20260811_rvn_platform_obligations.sql (decision #5:
-- platform-owned, shared by KPI/ROI/OKR)
CREATE TABLE IF NOT EXISTS rvn_platform_obligations (
  obligation_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id                TEXT NOT NULL,
  assignee_user_id                TEXT NOT NULL,
  reference_type                 TEXT NOT NULL,
  reference_id                   UUID NOT NULL,
  aggregate_version_at_creation    INT NOT NULL,
  obligation_type                TEXT NOT NULL,
  due_at                         TIMESTAMPTZ NULL,
  status                         TEXT NOT NULL DEFAULT 'open'
                                    CHECK (status IN ('open','completed','cancelled','superseded')),
  policy_version_id               UUID NULL,
  -- Nullable: buildEvent() only gets a real event_id AFTER applyMutation
  -- returns (see atomicWrite.ts) — attach this in a second, separate query
  -- once executeAtomicCreate's outcome.eventId is known, not inline here.
  source_event_id                UUID NULL REFERENCES rvn_platform_events(event_id),
  cadence_occurrence_id           TEXT NULL,
  deduplication_key               TEXT NOT NULL,
  completed_at                    TIMESTAMPTZ NULL,
  completed_via_command           TEXT NULL,
  row_version                     INT NOT NULL DEFAULT 1,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, deduplication_key)
);
CREATE INDEX idx_rvn_platform_obligations_assignee
  ON rvn_platform_obligations(organization_id, assignee_user_id, status);
CREATE INDEX idx_rvn_platform_obligations_reference
  ON rvn_platform_obligations(organization_id, reference_type, reference_id);
```

## B) Command layer

`openOrEscalateDeviationCase` — called from INSIDE `recordMeasurement`'s and
`correctMeasurement`'s `applyMutation`, on the SAME pinned client (decision #3):

```ts
// server/src/services/resultsVnext/kpi/kpiDeviationCommands.ts
import type { PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { computeStateHash, KPI_EVENT_SOURCE } from './kpiDefinitionCommands.js';
import type { AtomicEventInput } from '../platform/atomicWrite.js';
import type { KpiMeasurementRow } from './kpiTypes.js';

export async function openOrEscalateDeviationCase(
  client: PoolClient,
  params: {
    organizationId: string;
    kpiId: string;
    measurementId: string;
    performanceStatus: KpiMeasurementRow['performance_status']; // only called for 'warning'|'critical'
    ownerUserId: string;
    managerUserId: string | null; // decision #1: caller-provided
    responseHoursOverride?: { warning: number; critical: number };
    actorUserId: string;
    actorEffectiveRole: string;
  }
): Promise<{ caseId: string; created: boolean; severityChanged: boolean } | null> {
  const { organizationId, kpiId, measurementId, performanceStatus, ownerUserId, managerUserId } = params;
  if (performanceStatus !== 'warning' && performanceStatus !== 'critical') return null;

  const existing = await client.query<{ case_id: string; status: string; severity: string }>(
    `SELECT case_id, status, severity FROM rvn_kpi_deviation_cases
      WHERE organization_id = $1 AND kpi_id = $2 AND status <> 'closed'
      FOR UPDATE`,
    [organizationId, kpiId]
  );
  const openCase = existing.rows[0];

  if (openCase) {
    if (openCase.severity === 'warning' && performanceStatus === 'critical') {
      await client.query(
        `UPDATE rvn_kpi_deviation_cases SET severity = 'critical', updated_at = now() WHERE case_id = $1`,
        [openCase.case_id]
      );
      // Decision #4: emit a separate kpi.deviation_escalated event here too
      // (manual second insert into rvn_platform_events, same transaction) —
      // implementer must add this, not just the UPDATE above.
      return { caseId: openCase.case_id, created: false, severityChanged: true };
    }
    return { caseId: openCase.case_id, created: false, severityChanged: false };
  }

  const responseHours = performanceStatus === 'critical'
    ? (params.responseHoursOverride?.critical ?? 48)
    : (params.responseHoursOverride?.warning ?? 120);

  try {
    const insertResult = await client.query<{ case_id: string }>(
      `INSERT INTO rvn_kpi_deviation_cases
         (organization_id, kpi_id, trigger_measurement_id, severity, status,
          owner_user_id, manager_user_id, response_due_at, created_by)
       VALUES ($1, $2, $3, $4, 'open', $5, $6, now() + ($7 * interval '1 hour'), $8)
       RETURNING case_id`,
      [organizationId, kpiId, measurementId, performanceStatus, ownerUserId, managerUserId, responseHours, params.actorUserId]
    );
    // Decision #4: emit kpi.deviation_opened as its OWN rvn_platform_events
    // row here (manual insert, same transaction), in addition to whatever
    // buildEvent() produces for kpi.measurement_recorded.
    return { caseId: insertResult.rows[0]!.case_id, created: true, severityChanged: false };
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') {
      const retry = await client.query<{ case_id: string }>(
        `SELECT case_id FROM rvn_kpi_deviation_cases
          WHERE organization_id = $1 AND kpi_id = $2 AND status <> 'closed'`,
        [organizationId, kpiId]
      );
      return { caseId: retry.rows[0]!.case_id, created: false, severityChanged: false };
    }
    throw err;
  }
}
```

`closeDeviationCase` — full example via `executeAtomicCommand`:

```ts
export class KpiDeviationValidationError extends Error {
  code: string;
  details?: Record<string, unknown>;
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'KpiDeviationValidationError';
    this.code = code;
    this.details = details;
  }
}

async function loadDeviationCaseForUpdate(
  client: PoolClient, caseId: string, organizationId: string
): Promise<DeviationCaseRow | undefined> {
  const r = await client.query<DeviationCaseRow>(
    `SELECT * FROM rvn_kpi_deviation_cases WHERE case_id = $1 AND organization_id = $2 FOR UPDATE`,
    [caseId, organizationId]
  );
  return r.rows[0];
}
const caseRowVersion = (row: DeviationCaseRow) => row.row_version;

export interface CloseDeviationCaseInput {
  caseId: string;
  organizationId: string;
  expectedVersion: number;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export async function closeDeviationCase(
  input: CloseDeviationCaseInput
): Promise<AtomicCommandOutcome<DeviationCase>> {
  const {
    caseId, organizationId, expectedVersion, actorUserId, actorEffectiveRole,
    idempotencyKey, correlationId, causationId = null, reason = null,
  } = input;

  let beforeState: Record<string, unknown> | null = null;
  let closingVerificationId: string | undefined;

  return executeAtomicCommand<DeviationCaseRow, DeviationCase>({
    organizationId,
    aggregateId: caseId,
    expectedVersion,
    loadForUpdate: loadDeviationCaseForUpdate,
    getCurrentVersion: caseRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (currentRow.status !== 'verification') {
        throw new KpiDeviationValidationError(
          `Case ${caseId} is "${currentRow.status}" — only a case in "verification" may be closed`,
          'NOT_IN_VERIFICATION',
          { caseId, status: currentRow.status }
        );
      }

      const policyResult = await client.query<{ accepted: string[] | null }>(
        `SELECT rp.accepted_verification_statuses AS accepted
           FROM rvn_kpi_definitions kd
           LEFT JOIN rvn_kpi_response_policies rp ON rp.response_policy_id = kd.response_policy_id
          WHERE kd.kpi_id = $1`,
        [currentRow.kpi_id]
      );
      const acceptedStatuses = policyResult.rows[0]?.accepted ?? ['effective', 'partially_effective'];

      const verificationResult = await client.query<EffectivenessVerificationRow>(
        `SELECT * FROM rvn_kpi_effectiveness_verifications
          WHERE deviation_case_id = $1
          ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        [caseId]
      );
      const verification = verificationResult.rows[0];
      if (!verification || !acceptedStatuses.includes(verification.status)) {
        throw new KpiDeviationValidationError(
          `Case ${caseId} cannot close: no EffectivenessVerification with an accepted outcome (${acceptedStatuses.join('/')})`,
          'EFFECTIVENESS_NOT_VERIFIED',
          { caseId, latestVerificationStatus: verification?.status ?? null, acceptedStatuses }
        );
      }
      closingVerificationId = verification.verification_id;

      beforeState = { case: toDeviationCase(currentRow) };

      const updateResult = await client.query<DeviationCaseRow>(
        `UPDATE rvn_kpi_deviation_cases
            SET status = 'closed', closed_at = now(), closed_by = $1,
                close_effectiveness_verification_id = $2,
                row_version = $3, updated_at = now()
          WHERE case_id = $4
          RETURNING *`,
        [actorUserId, verification.verification_id, nextVersion, caseId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) throw new Error(`[closeDeviationCase] update returned no row for ${caseId}`);
      return toDeviationCase(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { case: result };
      return {
        schemaVersion: 1,
        eventType: 'kpi.deviation_closed',
        aggregateType: 'deviation_case',
        aggregateId: result.caseId,
        organizationId,
        actorUserId,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: '',
        beforeState,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: KPI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { caseId, verificationId: closingVerificationId },
      } satisfies AtomicEventInput;
    },
  });
}
```

Rest of the state machine (implement following the exact same pattern as
`closeDeviationCase` above):

| Command | Primitive | from → to | Guard |
|---|---|---|---|
| `openOrEscalateDeviationCase` | `executeAtomicCreate` (called from inside `recordMeasurement`/`correctMeasurement`) | (none) → `open` | case-key unique index |
| `acknowledgeDeviationCase` | `executeAtomicCommand` | `open` → `analysis_required` | — |
| `submitRootCause` (PUT root-cause) | `executeAtomicCommand` | `analysis_required` → `plan_required` when `root_cause_summary`+`category` non-empty; otherwise content saved without status change | only in `analysis_required` |
| `addCorrectiveAction` | `executeAtomicCreate` (own file, own CAS on `action_id`) | (none) → `planned` | case must be in `plan_required` |
| `submitPlan` | `executeAtomicCommand` | `plan_required` → `plan_submitted` | ≥1 `corrective_action` exists |
| `approvePlan` | `executeAtomicCommand` | `plan_submitted` → `approved` | maker-checker: `plan_approved_by ≠ plan_submitted_by` AND `≠ created_by` |
| `updateCorrectiveAction` (PATCH action) | `executeAtomicCommand` (on `action_id`) | — | first `status→'active'` auto-transitions case `approved`→`executing` (decision #8) |
| `recordRecoveryObservation` | `executeAtomicCommand` | `executing` → `recovery_observed` | requires `recovery_observation_measurement_id` |
| `submitEffectivenessVerification` | `executeAtomicCommand` (case) + INSERT verification in same `applyMutation` | `executing`/`recovery_observed` → `verification`; if outcome `ineffective` → auto-return to `executing` | — |
| `closeDeviationCase` | `executeAtomicCommand` | `verification` → `closed` | shown above |
| `escalateDeviationCase`/`deescalateDeviationCase` | `executeAtomicCommand` | overlay, status unchanged | any state ≠ `closed` |
| `reopenDeviationCase` | `executeAtomicCreate` (NEW row, not UPDATE) | `closed` (old row, untouched) → new row `open` with `reopened_from_case_id` (decision #7) | prior row must be `closed`; case-key unique index prevents double reopen |

## C) MyWork integration

Dedupe key for KPI-F-013's "explain warning/critical deviation" obligation:

```
obligation_type = 'explain_warning_critical_deviation'
reference_type  = 'deviation_case'
reference_id    = case_id
cadence_occurrence_id = NULL   -- one-shot, not a recurring check-in
deduplication_key = `deviation_case:${caseId}:explain_warning_critical_deviation:v${policyVersionId ?? 'none'}`
assignee_user_id = case.owner_user_id
```

Created inline in the same transaction as `openOrEscalateDeviationCase`
(same rationale as decision #3 — no working outbox consumer today).

Completion path: **the same domain command** the KPI Tool UI calls, not a
copy. The MyWork "complete" handler for this `obligation_type` calls
`submitRootCause()` directly; that command, after a successful transition
(`root_cause_summary` non-empty, `analysis_required`→`plan_required`),
completes the obligation in the same transaction:

```sql
UPDATE rvn_platform_obligations
   SET status = 'completed', completed_at = now(), completed_via_command = 'submitRootCause'
 WHERE organization_id = $1 AND reference_type = 'deviation_case' AND reference_id = $2
   AND obligation_type = 'explain_warning_critical_deviation' AND status = 'open'
```

**Explicitly out of scope for this package**: wiring `rvn_platform_obligations`
into the actual MyWork Home/Inbox/Calendar UI (`myWorkRoofService.ts` reading
this table and writing the corresponding `v8_canonical_object_states`
projection) — the table existing is not the same as a user seeing it. That is
a separate integration package.

## D) Files to create

| File | Notes |
|---|---|
| `server/migrations/20260811_rvn_kpi_deviation_loop.sql` | Response policies, deviation cases, corrective actions, effectiveness verifications + join table, FK resolution |
| `server/migrations/20260811_rvn_platform_obligations.sql` | Platform-owned (decision #5) |
| `server/src/services/resultsVnext/kpi/kpiDeviationTypes.ts` | Row/DTO types mirroring `kpiTypes.ts` convention |
| `server/src/services/resultsVnext/kpi/kpiDeviationCommands.ts` | Full state machine per table above |
| `server/src/services/resultsVnext/kpi/kpiCorrectiveActionCommands.ts` | `addCorrectiveAction`, `updateCorrectiveAction` |
| `server/src/services/resultsVnext/kpi/kpiDeviationRepository.ts` | Read queries via `buildVisibilityScopedCte` |
| `server/src/services/resultsVnext/platform/obligations.ts` | `createObligation`, `completeObligation`, `attachSourceEventId` (second-step pattern per §C) |
| Edit `kpiMeasurementCommands.ts` | Wire `openOrEscalateDeviationCase` into `recordMeasurement`/`correctMeasurement` |
| Edit `atomicWrite.ts` | Add all 8 real `EVENT_TYPE_CONSUMER_GROUPS` entries for deviation events |
| Tests | Unit tests for commands + one realDB integration test proving case-key idempotency under concurrency |

Not in this package: `/api/vnext/results/kpi/deviation-cases/*` routes (next package, same as E001/E002 routes were separate).
