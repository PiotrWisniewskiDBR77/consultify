/**
 * KPI-E003 — Deviation Closed Loop command layer.
 *
 * Design: docs/product/results-vnext/KPI_E003_DESIGN.md §B (frozen, full
 * code copied verbatim for `openOrEscalateDeviationCase`/`closeDeviationCase`;
 * the rest of the state machine follows the exact same pattern per that
 * file's own instruction: "implement following the exact same pattern as
 * `closeDeviationCase` above").
 * Schema: server/migrations/20260811_rvn_kpi_deviation_loop.sql.
 *
 * Write pattern: every command here that mutates an EXISTING
 * `rvn_kpi_deviation_cases` row goes through `executeAtomicCommand` with
 * that row's own `row_version` as the optimistic-concurrency CAS —
 * identical convention to `kpiDefinitionCommands.ts`. `openOrEscalateDeviationCase`
 * is the one exception: it does not run as its own top-level command at
 * all — it is called from INSIDE `recordMeasurement`'s/`correctMeasurement`'s
 * `applyMutation` (kpiMeasurementCommands.ts), on that transaction's own
 * pinned `PoolClient` (design decision #3 — "SAME transaction as the
 * measurement insert"). Because of that, it cannot itself call
 * `executeAtomicCommand`/`executeAtomicCreate` (nesting a second atomic-write
 * helper inside the first's `applyMutation` would attempt a second `BEGIN`
 * on an already-open pinned client) — its case-row INSERT/UPDATE and its
 * `kpi.deviation_opened`/`kpi.deviation_escalated` event rows are written
 * with plain `client.query()` calls instead, manually replicating just the
 * event-insert + outbox-fanout shape `executeAtomicCreate` would otherwise
 * provide (see `insertManualDeviationEvent` below).
 * `reopenDeviationCase` is the other "create" shape (a genuinely NEW case
 * row, not a mutation of an existing one) and goes through
 * `executeAtomicCreate`, same as `kpiDefinitionCommands.createKpiDraft`.
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import {
  executeAtomicCommand,
  executeAtomicCreate,
  resolveConsumerGroups,
  EVENT_INSERT_SQL,
  type AtomicCommandOutcome,
  type AtomicEventInput,
} from '../platform/atomicWrite.js';
import { attachSourceEventId, createObligation } from '../platform/obligations.js';

import { computeStateHash, KPI_EVENT_SOURCE } from './kpiDefinitionCommands.js';
import {
  toDeviationCase,
  toEffectivenessVerification,
  type DeviationCase,
  type DeviationCaseRow,
  type EffectivenessVerification,
  type EffectivenessVerificationRow,
  type EffectivenessVerificationStatus,
} from './kpiDeviationTypes.js';
import type { KpiMeasurementRow } from './kpiTypes.js';

// ==========================================
// SHARED CONSTANTS (design §C)
// ==========================================

export const EXPLAIN_DEVIATION_OBLIGATION_TYPE = 'explain_warning_critical_deviation';
export const DEVIATION_CASE_REFERENCE_TYPE = 'deviation_case';

// ==========================================
// ERRORS
// ==========================================

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

/**
 * Maker-checker guard for `approvePlan` — mirrors
 * `SelfApprovalDeniedError` in `kpiDefinitionCommands.ts` (same name/shape
 * convention, this module's own class since the two domains have separate
 * aggregates).
 */
export class DeviationSelfApprovalDeniedError extends Error {
  code = 'SELF_APPROVAL_DENIED';
  details: Record<string, unknown>;
  constructor(caseId: string, approverId: string, reasonField: 'plan_submitted_by' | 'created_by') {
    super(`User ${approverId} may not approve the corrective plan for case ${caseId}: matches its own ${reasonField}`);
    this.name = 'DeviationSelfApprovalDeniedError';
    this.details = { caseId, approverId, reasonField };
  }
}

// ==========================================
// SHARED ROW LOADER (design §B closeDeviationCase example)
// ==========================================

async function loadDeviationCaseForUpdate(
  client: PoolClient,
  caseId: string,
  organizationId: string
): Promise<DeviationCaseRow | undefined> {
  const r = await client.query<DeviationCaseRow>(
    `SELECT * FROM rvn_kpi_deviation_cases WHERE case_id = $1 AND organization_id = $2 FOR UPDATE`,
    [caseId, organizationId]
  );
  return r.rows[0];
}
const caseRowVersion = (row: DeviationCaseRow) => row.row_version;

// ==========================================
// Manual event insert (openOrEscalateDeviationCase only — see file header)
// ==========================================

/**
 * Replicates just the "insert event row (idempotency-guarded) + fan out to
 * outbox" half of `executeAtomicCommand`/`executeAtomicCreate` (`atomicWrite.ts`
 * steps 5-6), for a caller that is already inside someone else's transaction
 * and cannot invoke either helper itself. Returns the new `event_id`, or
 * `undefined` if the idempotency key had already been used (a genuine
 * retry) — in that case the caller must not treat the case row it just
 * wrote as newly created for event-purposes, but per design decision #3
 * `openOrEscalateDeviationCase` already has its own upstream duplicate
 * handling (the `existing` SELECT / `23505` catch in the create branch), so
 * this returning `undefined` here is only reachable on a genuinely
 * duplicated idempotency key, not the normal "case already exists" path.
 */
async function insertManualDeviationEvent(
  client: PoolClient,
  eventInput: AtomicEventInput
): Promise<string | undefined> {
  const eventResult = await client.query<{ event_id: string; resulting_version: number }>(EVENT_INSERT_SQL, [
    eventInput.schemaVersion,
    eventInput.eventType,
    eventInput.aggregateType,
    eventInput.aggregateId,
    eventInput.organizationId,
    eventInput.actorUserId,
    eventInput.actorEffectiveRole,
    eventInput.commandId,
    eventInput.correlationId,
    eventInput.causationId,
    eventInput.occurredAt,
    eventInput.policyVersion,
    eventInput.beforeState === null ? null : JSON.stringify(eventInput.beforeState),
    eventInput.afterState === null ? null : JSON.stringify(eventInput.afterState),
    eventInput.stateHash,
    eventInput.reason,
    JSON.stringify(eventInput.evidenceRefs ?? []),
    eventInput.source,
    eventInput.idempotencyKey,
    eventInput.expectedVersion,
    eventInput.resultingVersion,
    JSON.stringify(eventInput.payload ?? {}),
  ]);

  const inserted = eventResult.rows[0];
  if (!inserted) return undefined;

  const consumerGroups = resolveConsumerGroups(eventInput.eventType);
  if (consumerGroups.length > 0) {
    await client.query(
      `INSERT INTO rvn_platform_outbox (event_id, consumer_group, status)
         SELECT $1, cg, 'pending' FROM unnest($2::text[]) AS cg`,
      [inserted.event_id, consumerGroups]
    );
  }
  return inserted.event_id;
}

// ==========================================
// openOrEscalateDeviationCase (design §B, verbatim + the two TODOs it
// flags: manual kpi.deviation_opened/kpi.deviation_escalated event inserts,
// and the §C MyWork obligation on the create branch)
// ==========================================

export interface OpenOrEscalateDeviationCaseParams {
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

export interface OpenOrEscalateDeviationCaseResult {
  caseId: string;
  created: boolean;
  severityChanged: boolean;
}

export async function openOrEscalateDeviationCase(
  client: PoolClient,
  params: OpenOrEscalateDeviationCaseParams
): Promise<OpenOrEscalateDeviationCaseResult | null> {
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

      // Decision #4: a separate kpi.deviation_escalated event, manual
      // insert, same transaction — idempotency key keyed off the
      // TRIGGERING measurement (one escalation event per measurement that
      // causes one), not off the case, so two distinct critical
      // measurements in a row each get their own event even though they
      // escalate the same case.
      const afterState = { caseId: openCase.case_id, severity: 'critical' as const, triggerMeasurementId: measurementId };
      await insertManualDeviationEvent(client, {
        schemaVersion: 1,
        eventType: 'kpi.deviation_escalated',
        aggregateType: 'deviation_case',
        aggregateId: openCase.case_id,
        organizationId,
        actorUserId: params.actorUserId,
        actorEffectiveRole: params.actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: randomUUID(),
        causationId: null,
        occurredAt: new Date().toISOString(),
        policyVersion: '',
        beforeState: { caseId: openCase.case_id, severity: openCase.severity },
        afterState,
        stateHash: computeStateHash(afterState),
        reason: null,
        evidenceRefs: [],
        source: KPI_EVENT_SOURCE,
        idempotencyKey: `kpi.deviation_escalated:${measurementId}`,
        expectedVersion: null,
        resultingVersion: 1,
        payload: { caseId: openCase.case_id, measurementId },
      });

      return { caseId: openCase.case_id, created: false, severityChanged: true };
    }
    return { caseId: openCase.case_id, created: false, severityChanged: false };
  }

  const responseHours = performanceStatus === 'critical'
    ? (params.responseHoursOverride?.critical ?? 48)
    : (params.responseHoursOverride?.warning ?? 120);

  // -- DEVIATION FROM DESIGN: §B's literal code wraps ONLY the INSERT in a
  // plain try/catch and, on a caught 23505, immediately issues a second
  // `client.query` (the retry SELECT) on the SAME transaction. Verified
  // empirically against a real Postgres 16 (two genuinely concurrent
  // sessions racing the same INSERT) that this does NOT work: Postgres
  // aborts the WHOLE transaction on the unique-violation error, so that
  // retry SELECT itself fails with `25P02 current transaction is aborted,
  // commands ignored until end of transaction block` — the losing side of a
  // real race would throw an unhandled 25P02 instead of gracefully
  // returning the winner's case_id, defeating the entire point of "catch
  // 23505 and look it up instead" (and the case-key idempotency the design
  // itself asks for, decision text: "consecutive bad measurements escalate
  // severity on the existing case, they never spawn a second case"). Nearest
  // safe equivalent: wrap just the candidate INSERT in a SAVEPOINT so a
  // caught 23505 can `ROLLBACK TO SAVEPOINT` (clearing the aborted state)
  // before the retry SELECT — re-verified empirically that this exact
  // sequence (SAVEPOINT / failing INSERT / ROLLBACK TO SAVEPOINT / SELECT /
  // COMMIT) works. Everything else (the manual event insert, the §C
  // obligation) still runs on the SAME outer transaction, just after the
  // savepoint is released rather than inside the original try block.
  await client.query('SAVEPOINT deviation_case_create');
  let newCaseId: string;
  try {
    const insertResult = await client.query<{ case_id: string }>(
      `INSERT INTO rvn_kpi_deviation_cases
         (organization_id, kpi_id, trigger_measurement_id, severity, status,
          owner_user_id, manager_user_id, response_due_at, created_by)
       VALUES ($1, $2, $3, $4, 'open', $5, $6, now() + ($7 * interval '1 hour'), $8)
       RETURNING case_id`,
      [organizationId, kpiId, measurementId, performanceStatus, ownerUserId, managerUserId, responseHours, params.actorUserId]
    );
    newCaseId = insertResult.rows[0]!.case_id;
    await client.query('RELEASE SAVEPOINT deviation_case_create');
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') {
      await client.query('ROLLBACK TO SAVEPOINT deviation_case_create');
      const retry = await client.query<{ case_id: string }>(
        `SELECT case_id FROM rvn_kpi_deviation_cases
          WHERE organization_id = $1 AND kpi_id = $2 AND status <> 'closed'`,
        [organizationId, kpiId]
      );
      return { caseId: retry.rows[0]!.case_id, created: false, severityChanged: false };
    }
    throw err;
  }

  {
    // Decision #4: kpi.deviation_opened as its own rvn_platform_events row,
    // manual insert, same transaction, in addition to whatever buildEvent()
    // produces for kpi.measurement_recorded in the OUTER command.
    const afterState = { caseId: newCaseId, kpiId, severity: performanceStatus, ownerUserId, managerUserId };
    const eventId = await insertManualDeviationEvent(client, {
      schemaVersion: 1,
      eventType: 'kpi.deviation_opened',
      aggregateType: 'deviation_case',
      aggregateId: newCaseId,
      organizationId,
      actorUserId: params.actorUserId,
      actorEffectiveRole: params.actorEffectiveRole,
      commandId: randomUUID(),
      correlationId: randomUUID(),
      causationId: null,
      occurredAt: new Date().toISOString(),
      policyVersion: '',
      beforeState: null,
      afterState,
      stateHash: computeStateHash(afterState),
      reason: null,
      evidenceRefs: [],
      source: KPI_EVENT_SOURCE,
      idempotencyKey: `kpi.deviation_opened:${measurementId}`,
      expectedVersion: null,
      resultingVersion: 1,
      payload: { caseId: newCaseId, kpiId, measurementId },
    });

    // Design §C: MyWork "explain warning/critical deviation" obligation,
    // created inline in the SAME transaction (same rationale as decision #3
    // — no working outbox consumer today). One-shot (cadence_occurrence_id
    // NULL), assignee = case owner.
    const obligation = await createObligation(client, {
      organizationId,
      assigneeUserId: ownerUserId,
      referenceType: DEVIATION_CASE_REFERENCE_TYPE,
      referenceId: newCaseId,
      aggregateVersionAtCreation: 1,
      obligationType: EXPLAIN_DEVIATION_OBLIGATION_TYPE,
      // policyVersionId intentionally omitted — see platform/obligations.ts's
      // CreateObligationParams doc comment for why no source exists yet.
      deduplicationKey: `deviation_case:${newCaseId}:${EXPLAIN_DEVIATION_OBLIGATION_TYPE}:vnone`,
    });
    if (obligation && eventId) {
      // Already have a real event_id synchronously (the manual insert above
      // used RETURNING) — no need for the two-step attachSourceEventId
      // pattern platform/obligations.ts documents for
      // executeAtomicCommand/executeAtomicCreate callers.
      await attachSourceEventId(client, {
        organizationId,
        obligationId: obligation.obligationId,
        eventId,
      });
    }

    return { caseId: newCaseId, created: true, severityChanged: false };
  }
}

// ==========================================
// closeDeviationCase (design §B, verbatim)
// ==========================================

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

// ==========================================
// Shared base input shape for the remaining single-case CAS commands.
// ==========================================

interface BaseCaseCommandInput {
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

// ==========================================
// acknowledgeDeviationCase: open -> analysis_required
// ==========================================

export type AcknowledgeDeviationCaseInput = BaseCaseCommandInput;

export async function acknowledgeDeviationCase(
  input: AcknowledgeDeviationCaseInput
): Promise<AtomicCommandOutcome<DeviationCase>> {
  const {
    caseId, organizationId, expectedVersion, actorUserId, actorEffectiveRole,
    idempotencyKey, correlationId, causationId = null, reason = null,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<DeviationCaseRow, DeviationCase>({
    organizationId,
    aggregateId: caseId,
    expectedVersion,
    loadForUpdate: loadDeviationCaseForUpdate,
    getCurrentVersion: caseRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (currentRow.status !== 'open') {
        throw new KpiDeviationValidationError(
          `Case ${caseId} is "${currentRow.status}" — only an "open" case may be acknowledged`,
          'NOT_OPEN',
          { caseId, status: currentRow.status }
        );
      }
      beforeState = { case: toDeviationCase(currentRow) };

      const updateResult = await client.query<DeviationCaseRow>(
        `UPDATE rvn_kpi_deviation_cases
            SET status = 'analysis_required', row_version = $1, updated_at = now()
          WHERE case_id = $2
          RETURNING *`,
        [nextVersion, caseId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) throw new Error(`[acknowledgeDeviationCase] update returned no row for ${caseId}`);
      return toDeviationCase(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { case: result };
      return {
        schemaVersion: 1,
        eventType: 'kpi.deviation_acknowledged',
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
        payload: { caseId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// submitRootCause: analysis_required -> plan_required (when summary +
// category are both non-empty; otherwise content is saved without a status
// change) — guard: only callable while "analysis_required".
// ==========================================

export interface SubmitRootCauseInput extends BaseCaseCommandInput {
  rootCauseSummary?: string | null;
  rootCauseCategory?: string | null;
  recurrenceFlag?: boolean;
  expectedRecoveryDate?: string | null;
  expectedRecoveryValue?: number | null;
}

export async function submitRootCause(
  input: SubmitRootCauseInput
): Promise<AtomicCommandOutcome<DeviationCase>> {
  const {
    caseId, organizationId, expectedVersion, actorUserId, actorEffectiveRole,
    idempotencyKey, correlationId, causationId = null, reason = null,
    rootCauseSummary = null, rootCauseCategory = null, recurrenceFlag = false,
    expectedRecoveryDate = null, expectedRecoveryValue = null,
  } = input;

  let beforeState: Record<string, unknown> | null = null;
  let transitionedToPlanRequired = false;

  return executeAtomicCommand<DeviationCaseRow, DeviationCase>({
    organizationId,
    aggregateId: caseId,
    expectedVersion,
    loadForUpdate: loadDeviationCaseForUpdate,
    getCurrentVersion: caseRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (currentRow.status !== 'analysis_required') {
        throw new KpiDeviationValidationError(
          `Case ${caseId} is "${currentRow.status}" — root cause may only be submitted while "analysis_required"`,
          'NOT_ANALYSIS_REQUIRED',
          { caseId, status: currentRow.status }
        );
      }
      beforeState = { case: toDeviationCase(currentRow) };

      const hasCompleteRootCause = Boolean(rootCauseSummary) && Boolean(rootCauseCategory);
      const nextStatus = hasCompleteRootCause ? 'plan_required' : 'analysis_required';
      transitionedToPlanRequired = hasCompleteRootCause;

      const updateResult = await client.query<DeviationCaseRow>(
        `UPDATE rvn_kpi_deviation_cases
            SET root_cause_summary = $1, root_cause_category = $2, recurrence_flag = $3,
                expected_recovery_date = $4, expected_recovery_value = $5,
                status = $6, row_version = $7, updated_at = now()
          WHERE case_id = $8
          RETURNING *`,
        [
          rootCauseSummary,
          rootCauseCategory,
          recurrenceFlag,
          expectedRecoveryDate,
          expectedRecoveryValue,
          nextStatus,
          nextVersion,
          caseId,
        ]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) throw new Error(`[submitRootCause] update returned no row for ${caseId}`);

      if (hasCompleteRootCause) {
        // Design §C completion path: "the same domain command the KPI Tool
        // UI calls ... after a successful transition, completes the
        // obligation in the same transaction."
        await client.query(
          `UPDATE rvn_platform_obligations
              SET status = 'completed', completed_at = now(), completed_via_command = 'submitRootCause',
                  row_version = row_version + 1, updated_at = now()
            WHERE organization_id = $1 AND reference_type = $2 AND reference_id = $3
              AND obligation_type = $4 AND status = 'open'`,
          [organizationId, DEVIATION_CASE_REFERENCE_TYPE, caseId, EXPLAIN_DEVIATION_OBLIGATION_TYPE]
        );
      }

      return toDeviationCase(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { case: result, transitionedToPlanRequired };
      return {
        schemaVersion: 1,
        eventType: 'kpi.deviation_root_cause_submitted',
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
        payload: { caseId, transitionedToPlanRequired },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// submitPlan: plan_required -> plan_submitted (guard: >=1 corrective action)
// ==========================================

export type SubmitPlanInput = BaseCaseCommandInput;

export async function submitPlan(
  input: SubmitPlanInput
): Promise<AtomicCommandOutcome<DeviationCase>> {
  const {
    caseId, organizationId, expectedVersion, actorUserId, actorEffectiveRole,
    idempotencyKey, correlationId, causationId = null, reason = null,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<DeviationCaseRow, DeviationCase>({
    organizationId,
    aggregateId: caseId,
    expectedVersion,
    loadForUpdate: loadDeviationCaseForUpdate,
    getCurrentVersion: caseRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (currentRow.status !== 'plan_required') {
        throw new KpiDeviationValidationError(
          `Case ${caseId} is "${currentRow.status}" — a plan may only be submitted while "plan_required"`,
          'NOT_PLAN_REQUIRED',
          { caseId, status: currentRow.status }
        );
      }

      const actionCountResult = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM rvn_kpi_corrective_actions WHERE deviation_case_id = $1`,
        [caseId]
      );
      if (Number(actionCountResult.rows[0]?.count ?? '0') < 1) {
        throw new KpiDeviationValidationError(
          `Case ${caseId} has no corrective actions — at least one is required before submitting a plan`,
          'NO_CORRECTIVE_ACTIONS',
          { caseId }
        );
      }

      beforeState = { case: toDeviationCase(currentRow) };

      const updateResult = await client.query<DeviationCaseRow>(
        `UPDATE rvn_kpi_deviation_cases
            SET status = 'plan_submitted', plan_submitted_by = $1, plan_submitted_at = now(),
                row_version = $2, updated_at = now()
          WHERE case_id = $3
          RETURNING *`,
        [actorUserId, nextVersion, caseId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) throw new Error(`[submitPlan] update returned no row for ${caseId}`);
      return toDeviationCase(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { case: result };
      return {
        schemaVersion: 1,
        eventType: 'kpi.deviation_corrective_plan_submitted',
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
        payload: { caseId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// approvePlan: plan_submitted -> approved (maker-checker: plan_approved_by
// must differ from BOTH plan_submitted_by and the case's created_by)
// ==========================================

export interface ApprovePlanInput extends BaseCaseCommandInput {
  approverId: string;
}

export async function approvePlan(
  input: ApprovePlanInput
): Promise<AtomicCommandOutcome<DeviationCase>> {
  const {
    caseId, organizationId, expectedVersion, approverId, actorEffectiveRole,
    idempotencyKey, correlationId, causationId = null, reason = null,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<DeviationCaseRow, DeviationCase>({
    organizationId,
    aggregateId: caseId,
    expectedVersion,
    loadForUpdate: loadDeviationCaseForUpdate,
    getCurrentVersion: caseRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      // Self-approval denial FIRST, before any write — same discipline as
      // kpiDefinitionCommands.approveDefinitionVersion.
      if (currentRow.plan_submitted_by === approverId) {
        throw new DeviationSelfApprovalDeniedError(caseId, approverId, 'plan_submitted_by');
      }
      if (currentRow.created_by === approverId) {
        throw new DeviationSelfApprovalDeniedError(caseId, approverId, 'created_by');
      }

      if (currentRow.status !== 'plan_submitted') {
        throw new KpiDeviationValidationError(
          `Case ${caseId} is "${currentRow.status}" — only a "plan_submitted" case's plan may be approved`,
          'NOT_PLAN_SUBMITTED',
          { caseId, status: currentRow.status }
        );
      }

      beforeState = { case: toDeviationCase(currentRow) };

      const updateResult = await client.query<DeviationCaseRow>(
        `UPDATE rvn_kpi_deviation_cases
            SET status = 'approved', plan_approved_by = $1, plan_approved_at = now(),
                row_version = $2, updated_at = now()
          WHERE case_id = $3
          RETURNING *`,
        [approverId, nextVersion, caseId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) throw new Error(`[approvePlan] update returned no row for ${caseId}`);
      return toDeviationCase(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { case: result };
      return {
        schemaVersion: 1,
        eventType: 'kpi.deviation_corrective_plan_approved',
        aggregateType: 'deviation_case',
        aggregateId: result.caseId,
        organizationId,
        actorUserId: approverId,
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
        payload: { caseId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// recordRecoveryObservation: executing -> recovery_observed
// (requires recovery_observation_measurement_id)
// ==========================================

export interface RecordRecoveryObservationInput extends BaseCaseCommandInput {
  recoveryObservationMeasurementId: string;
}

export async function recordRecoveryObservation(
  input: RecordRecoveryObservationInput
): Promise<AtomicCommandOutcome<DeviationCase>> {
  const {
    caseId, organizationId, expectedVersion, actorUserId, actorEffectiveRole,
    idempotencyKey, correlationId, causationId = null, reason = null,
    recoveryObservationMeasurementId,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<DeviationCaseRow, DeviationCase>({
    organizationId,
    aggregateId: caseId,
    expectedVersion,
    loadForUpdate: loadDeviationCaseForUpdate,
    getCurrentVersion: caseRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (currentRow.status !== 'executing') {
        throw new KpiDeviationValidationError(
          `Case ${caseId} is "${currentRow.status}" — a recovery observation may only be recorded while "executing"`,
          'NOT_EXECUTING',
          { caseId, status: currentRow.status }
        );
      }

      const measurementCheck = await client.query(
        `SELECT 1 FROM rvn_kpi_measurements WHERE measurement_id = $1 AND organization_id = $2 AND kpi_id = $3`,
        [recoveryObservationMeasurementId, organizationId, currentRow.kpi_id]
      );
      if (!measurementCheck.rowCount) {
        throw new KpiDeviationValidationError(
          `Measurement ${recoveryObservationMeasurementId} does not exist for KPI ${currentRow.kpi_id} in this organization`,
          'RECOVERY_MEASUREMENT_NOT_FOUND',
          { caseId, recoveryObservationMeasurementId }
        );
      }

      beforeState = { case: toDeviationCase(currentRow) };

      const updateResult = await client.query<DeviationCaseRow>(
        `UPDATE rvn_kpi_deviation_cases
            SET status = 'recovery_observed', recovery_observed_by = $1, recovery_observed_at = now(),
                recovery_observation_measurement_id = $2, row_version = $3, updated_at = now()
          WHERE case_id = $4
          RETURNING *`,
        [actorUserId, recoveryObservationMeasurementId, nextVersion, caseId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) throw new Error(`[recordRecoveryObservation] update returned no row for ${caseId}`);
      return toDeviationCase(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { case: result };
      return {
        schemaVersion: 1,
        eventType: 'kpi.deviation_recovery_observed',
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
        payload: { caseId, recoveryObservationMeasurementId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// submitEffectivenessVerification: executing/recovery_observed ->
// verification; outcome 'ineffective' auto-returns the case to 'executing'.
// INSERTs the EffectivenessVerification (+ join-table rows) in the SAME
// applyMutation as the case status UPDATE.
// ==========================================

export interface SubmitEffectivenessVerificationInput extends BaseCaseCommandInput {
  verificationWindowStart: string;
  verificationWindowEnd: string;
  outcome: EffectivenessVerificationStatus;
  rationale?: string | null;
  measurementIds?: string[];
}

export interface SubmitEffectivenessVerificationResult {
  case: DeviationCase;
  verification: EffectivenessVerification;
}

export async function submitEffectivenessVerification(
  input: SubmitEffectivenessVerificationInput
): Promise<AtomicCommandOutcome<SubmitEffectivenessVerificationResult>> {
  const {
    caseId, organizationId, expectedVersion, actorUserId, actorEffectiveRole,
    idempotencyKey, correlationId, causationId = null, reason = null,
    verificationWindowStart, verificationWindowEnd, outcome, rationale = null,
    measurementIds = [],
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<DeviationCaseRow, SubmitEffectivenessVerificationResult>({
    organizationId,
    aggregateId: caseId,
    expectedVersion,
    loadForUpdate: loadDeviationCaseForUpdate,
    getCurrentVersion: caseRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (currentRow.status !== 'executing' && currentRow.status !== 'recovery_observed') {
        throw new KpiDeviationValidationError(
          `Case ${caseId} is "${currentRow.status}" — an effectiveness verification may only be submitted while "executing" or "recovery_observed"`,
          'NOT_EXECUTING_OR_RECOVERY_OBSERVED',
          { caseId, status: currentRow.status }
        );
      }
      beforeState = { case: toDeviationCase(currentRow) };

      const verificationInsert = await client.query<EffectivenessVerificationRow>(
        `INSERT INTO rvn_kpi_effectiveness_verifications
           (deviation_case_id, organization_id, verification_window_start, verification_window_end,
            status, rationale, verified_by, verified_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $8)
         RETURNING *`,
        [caseId, organizationId, verificationWindowStart, verificationWindowEnd, outcome, rationale, actorUserId, actorUserId]
      );
      const verificationRow = verificationInsert.rows[0];
      if (!verificationRow) throw new Error('[submitEffectivenessVerification] verification insert returned no row');

      for (const measurementId of measurementIds) {
        await client.query(
          `INSERT INTO rvn_kpi_effectiveness_verification_measurements (verification_id, measurement_id)
           VALUES ($1, $2)`,
          [verificationRow.verification_id, measurementId]
        );
      }

      // Table §B: outcome 'ineffective' auto-returns the case to
      // 'executing' (more corrective work is needed); any other outcome
      // lands the case in 'verification' (awaiting closeDeviationCase).
      const nextStatus = outcome === 'ineffective' ? 'executing' : 'verification';

      const caseUpdate = await client.query<DeviationCaseRow>(
        `UPDATE rvn_kpi_deviation_cases
            SET status = $1, row_version = $2, updated_at = now()
          WHERE case_id = $3
          RETURNING *`,
        [nextStatus, nextVersion, caseId]
      );
      const updatedCaseRow = caseUpdate.rows[0];
      if (!updatedCaseRow) throw new Error(`[submitEffectivenessVerification] case update returned no row for ${caseId}`);

      return {
        case: toDeviationCase(updatedCaseRow),
        verification: toEffectivenessVerification(verificationRow, measurementIds),
      };
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { case: result.case, verification: result.verification };
      return {
        schemaVersion: 1,
        eventType: 'kpi.deviation_effectiveness_verified',
        aggregateType: 'deviation_case',
        aggregateId: result.case.caseId,
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
        payload: { caseId, verificationId: result.verification.verificationId, outcome },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// escalateDeviationCase / deescalateDeviationCase: non-exclusive overlay,
// case status untouched — legal in any state != 'closed'.
// ==========================================

export interface EscalateDeviationCaseInput extends BaseCaseCommandInput {
  escalatedReason?: string | null;
}

async function runEscalationOverlay(
  eventType: string,
  escalated: boolean,
  input: EscalateDeviationCaseInput
): Promise<AtomicCommandOutcome<DeviationCase>> {
  const {
    caseId, organizationId, expectedVersion, actorUserId, actorEffectiveRole,
    idempotencyKey, correlationId, causationId = null, reason = null, escalatedReason = null,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<DeviationCaseRow, DeviationCase>({
    organizationId,
    aggregateId: caseId,
    expectedVersion,
    loadForUpdate: loadDeviationCaseForUpdate,
    getCurrentVersion: caseRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (currentRow.status === 'closed') {
        throw new KpiDeviationValidationError(
          `Case ${caseId} is "closed" — escalation overlay cannot change on a closed case`,
          'CASE_CLOSED',
          { caseId }
        );
      }
      beforeState = { case: toDeviationCase(currentRow) };

      const updateResult = await client.query<DeviationCaseRow>(
        `UPDATE rvn_kpi_deviation_cases
            SET escalated = $1, escalated_at = now(), escalated_reason = $2, escalated_by = $3,
                row_version = $4, updated_at = now()
          WHERE case_id = $5
          RETURNING *`,
        [escalated, escalatedReason, actorUserId, nextVersion, caseId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) throw new Error(`[${eventType}] update returned no row for ${caseId}`);
      return toDeviationCase(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { case: result };
      return {
        schemaVersion: 1,
        eventType,
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
        payload: { caseId, escalated },
      } satisfies AtomicEventInput;
    },
  });
}

/**
 * -- IMPLEMENTER NAMING NOTE: the design doc's own event-type pin (decision
 * #4) only names `kpi.deviation_escalated` for `openOrEscalateDeviationCase`'s
 * automatic SEVERITY escalation (warning -> critical). This command is a
 * different action — a manual, human-initiated escalation of the
 * `escalated` overlay flag (e.g. "flag this case for my manager's
 * attention"), not a severity change. Reusing the same event type for both
 * would make `kpi.deviation_escalated` ambiguous between two unrelated
 * triggers, so this command gets its own event type
 * (`kpi.deviation_manager_escalated`) — not pinned by the design doc, this
 * package's own consistent naming choice, registered in
 * `atomicWrite.ts`'s `EVENT_TYPE_CONSUMER_GROUPS` under the same rationale.
 */
export function escalateDeviationCase(
  input: EscalateDeviationCaseInput
): Promise<AtomicCommandOutcome<DeviationCase>> {
  return runEscalationOverlay('kpi.deviation_manager_escalated', true, input);
}

export function deescalateDeviationCase(
  input: EscalateDeviationCaseInput
): Promise<AtomicCommandOutcome<DeviationCase>> {
  return runEscalationOverlay('kpi.deviation_deescalated', false, input);
}

// ==========================================
// reopenDeviationCase: NEW row (not an UPDATE of the closed one) —
// executeAtomicCreate, prior case must be 'closed', case-key unique index
// prevents double reopen.
// ==========================================

export interface ReopenDeviationCaseInput {
  priorCaseId: string;
  organizationId: string;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  /** Defaults to the prior case's own trigger_measurement_id — reopening is
   * not itself triggered by a new measurement, but the column is NOT NULL. */
  triggerMeasurementId?: string;
  ownerUserId?: string;
  managerUserId?: string | null;
}

export async function reopenDeviationCase(
  input: ReopenDeviationCaseInput
): Promise<AtomicCommandOutcome<DeviationCase>> {
  const {
    priorCaseId, organizationId, actorUserId, actorEffectiveRole, idempotencyKey,
    correlationId, causationId = null, reason = null,
    triggerMeasurementId, ownerUserId, managerUserId,
  } = input;

  return executeAtomicCreate<DeviationCase>({
    organizationId,
    applyMutation: async (client) => {
      const priorResult = await client.query<DeviationCaseRow>(
        `SELECT * FROM rvn_kpi_deviation_cases WHERE case_id = $1 AND organization_id = $2`,
        [priorCaseId, organizationId]
      );
      const prior = priorResult.rows[0];
      if (!prior) {
        throw new KpiDeviationValidationError(`Deviation case ${priorCaseId} not found`, 'CASE_NOT_FOUND', {
          priorCaseId,
        });
      }
      if (prior.status !== 'closed') {
        throw new KpiDeviationValidationError(
          `Deviation case ${priorCaseId} is "${prior.status}" — only a closed case may be reopened`,
          'NOT_CLOSED',
          { priorCaseId, status: prior.status }
        );
      }

      // Best-effort pre-check — the real guarantee is the DB-level partial
      // unique index (ux_rvn_kpi_deviation_cases_one_active_per_kpi); this
      // only turns the common non-racy case into a typed error instead of a
      // raw 23505 surfacing from the INSERT below.
      const activeResult = await client.query<{ case_id: string }>(
        `SELECT case_id FROM rvn_kpi_deviation_cases WHERE organization_id = $1 AND kpi_id = $2 AND status <> 'closed'`,
        [organizationId, prior.kpi_id]
      );
      const active = activeResult.rows[0];
      if (active) {
        throw new KpiDeviationValidationError(
          `KPI ${prior.kpi_id} already has an active deviation case (${active.case_id}) — cannot reopen ${priorCaseId}`,
          'OTHER_ACTIVE_CASE_EXISTS',
          { priorCaseId, kpiId: prior.kpi_id, activeCaseId: active.case_id }
        );
      }

      const insertResult = await client.query<DeviationCaseRow>(
        `INSERT INTO rvn_kpi_deviation_cases
           (organization_id, kpi_id, trigger_measurement_id, severity, status,
            owner_user_id, manager_user_id, reopened_from_case_id, created_by)
         VALUES ($1, $2, $3, $4, 'open', $5, $6, $7, $8)
         RETURNING *`,
        [
          organizationId,
          prior.kpi_id,
          triggerMeasurementId ?? prior.trigger_measurement_id,
          prior.severity,
          ownerUserId ?? prior.owner_user_id,
          managerUserId ?? prior.manager_user_id,
          priorCaseId,
          actorUserId,
        ]
      );
      const row = insertResult.rows[0];
      if (!row) throw new Error('[reopenDeviationCase] insert returned no row');
      return toDeviationCase(row);
    },
    buildEvent: ({ result }) => {
      const afterState = { case: result };
      return {
        schemaVersion: 1,
        eventType: 'kpi.deviation_reopened',
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
        beforeState: null,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: KPI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion: null,
        resultingVersion: 1,
        payload: { caseId: result.caseId, reopenedFromCaseId: priorCaseId },
      } satisfies AtomicEventInput;
    },
  });
}
