/**
 * OKR-E001 — Cycle command layer.
 *
 * Design: docs/product/results-vnext/OKR_E001_DESIGN.md §6.4-§6.5.
 * Schema: server/migrations/20260822_rvn_okr_program_cycle.sql.
 *
 * `createCycle` implements OKR-F-001-AC-02's fail-closed guard: loads the
 * parent Program FIRST (locked, same transaction) and throws
 * `OkrCycleProgramNotActiveError` BEFORE any INSERT if it is not `active` —
 * blocked at the command level, not merely a UI affordance. On success,
 * `policy_version_id` is pinned from `program.active_policy_version_id` and
 * never updated afterward (the mechanism `okrProgramPublish.realdb.test.ts`
 * proves against a real republish).
 *
 * `runOkrCycleLifecycleTransition` is exported directly (unlike ROI's
 * private `runRoiCaseLifecycleTransition`, design §6.5) — routes construct
 * the transition spec literal per endpoint rather than this file exporting
 * five separate named wrapper functions.
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { computeStateHash } from '../kpi/kpiDefinitionCommands.js';
import {
  executeAtomicCommand,
  executeAtomicCreate,
  AtomicWriteAggregateNotFoundError,
  type AtomicCommandOutcome,
  type AtomicEventInput,
} from '../platform/atomicWrite.js';
import { assertCommandCapability, type CommandAccessContext } from '../platform/commandCapabilityGuard.js';

import { OKR_EVENT_SOURCE } from './okrProgramCommands.js';
import type { OkrProgramRow } from './okrProgramTypes.js';
import { toOkrCycle, type OkrCycle, type OkrCycleRow, type OkrCycleStatus } from './okrCycleTypes.js';

export const OKR_CYCLE_RESOURCE_TYPE = 'okr_cycle';

// RN-G5 — command capability names (docs/product/results-vnext/RN_G5_AUTHZ_DESIGN.md).
// Cycles (like Programs) are plain RBAC resources — no owner_user_id/
// reviewer_user_id column exists anywhere on okr_vnext_cycles (unlike Sets/
// Objectives/KeyResults, which are ABAC — see okrSetCommands.ts's own file
// header for this exact distinction) — so every Cycle command here is
// capability-only, no responsibleUserIds fallback.
export const OKR_CYCLE_CAPABILITIES = {
  create: 'results.okr.cycle.create',
  openDrafting: 'results.okr.cycle.open_drafting',
  activate: 'results.okr.cycle.activate',
  openReview: 'results.okr.cycle.open_review',
  close: 'results.okr.cycle.close',
  cancel: 'results.okr.cycle.cancel',
} as const;

// ==========================================
// ERRORS
// ==========================================

/** Fail-closed error for `createCycle` when the parent Program is not
 * `active` (design §6.4, OKR-F-001-AC-02). */
export class OkrCycleProgramNotActiveError extends Error {
  code = 'PROGRAM_NOT_ACTIVE';
  constructor(programId: string, actualStatus: string) {
    super(`OKR Program ${programId} is not active (status: ${actualStatus}) — cannot open a new Cycle`);
    this.name = 'OkrCycleProgramNotActiveError';
  }
}

/** Generic invalid-state-transition / bad-input guard, mirrors
 * `RoiCaseValidationError`/`OkrProgramValidationError`. Discriminated by
 * `.code` (default `INVALID_TRANSITION`, per design §6.5). */
export class OkrCycleValidationError extends Error {
  code: string;
  details?: Record<string, unknown>;
  constructor(message: string, code = 'INVALID_TRANSITION', details?: Record<string, unknown>) {
    super(message);
    this.name = 'OkrCycleValidationError';
    this.code = code;
    this.details = details;
  }
}

/**
 * OKR-E007 (Decision D9) — a genuine gap found by direct code read: this
 * file's own `runOkrCycleLifecycleTransition` carried NO `guard` slot for
 * `okr_cycle.closed`, unlike the generic-guard shape ROI's
 * `runRoiCaseLifecycleTransition` already demonstrates working
 * (`roiCaseCommands.ts`'s `markReadyForReview`). Without a guard, a Cycle
 * could close while its Sets are still `active`/`review` — a foreseeable
 * data-integrity hole the plan's own lifecycle diagram never coupled Cycle
 * and Set state machines against. Thrown by the `guard` wired into
 * `OKR_CYCLE_CLOSE_SPEC` below.
 */
export class OkrCycleHasOpenSetsError extends Error {
  code = 'CYCLE_HAS_OPEN_SETS';
  details: Record<string, unknown>;
  constructor(cycleId: string, openSetIds: string[]) {
    super(`OKR Cycle ${cycleId} cannot close: ${openSetIds.length} Set(s) are not closed/cancelled/not_required`);
    this.name = 'OkrCycleHasOpenSetsError';
    this.details = { cycleId, openSetIds };
  }
}

// ==========================================
// SHARED ROW LOADER
// ==========================================

async function loadOkrCycleForUpdate(
  client: PoolClient,
  cycleId: string,
  organizationId: string
): Promise<OkrCycleRow | undefined> {
  const result = await client.query<OkrCycleRow>(
    `SELECT * FROM okr_vnext_cycles WHERE cycle_id = $1 AND organization_id = $2 FOR UPDATE`,
    [cycleId, organizationId]
  );
  return result.rows[0];
}

function cycleRowVersion(row: OkrCycleRow): number {
  return row.row_version;
}

// ==========================================
// createCycle
// ==========================================

export interface CreateOkrCycleInput {
  organizationId: string;
  programId: string;
  name: string;
  startDate: string;
  endDate: string;
  draftOpenAt: string;
  submissionDueAt: string;
  approvalDueAt?: string | null;
  activeStartAt: string;
  midcycleReviewAt?: string | null;
  finalUpdateDueAt: string;
  reviewOpenAt: string;
  reflectionDueAt: string;
  managerReviewDueAt?: string | null;
  closeAt: string;
  createdBy: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

/** Decision P9: no exhaustive DB-level ordering CHECK across the 10 Cycle
 * timestamp columns (only `start_date <= end_date` is a DB CHECK) —
 * command-layer validation only, applied here so a malformed calendar 409s
 * with a specific reason instead of surfacing as a generic Postgres
 * constraint violation (or, worse, silently accepted nonsense ordering). */
function assertCycleTimestampOrdering(input: CreateOkrCycleInput): void {
  const start = Date.parse(input.startDate);
  const end = Date.parse(input.endDate);
  if (start > end) {
    throw new OkrCycleValidationError('startDate must be on or before endDate', 'INVALID_CYCLE_DATES', {
      startDate: input.startDate,
      endDate: input.endDate,
    });
  }

  const draftOpenAt = Date.parse(input.draftOpenAt);
  const submissionDueAt = Date.parse(input.submissionDueAt);
  const activeStartAt = Date.parse(input.activeStartAt);
  const finalUpdateDueAt = Date.parse(input.finalUpdateDueAt);
  const reviewOpenAt = Date.parse(input.reviewOpenAt);
  const reflectionDueAt = Date.parse(input.reflectionDueAt);
  const closeAt = Date.parse(input.closeAt);

  const pipeline: Array<[string, number, string, number]> = [
    ['draftOpenAt', draftOpenAt, 'submissionDueAt', submissionDueAt],
    ['submissionDueAt', submissionDueAt, 'activeStartAt', activeStartAt],
    ['activeStartAt', activeStartAt, 'finalUpdateDueAt', finalUpdateDueAt],
    ['finalUpdateDueAt', finalUpdateDueAt, 'reviewOpenAt', reviewOpenAt],
    ['reviewOpenAt', reviewOpenAt, 'reflectionDueAt', reflectionDueAt],
    ['reflectionDueAt', reflectionDueAt, 'closeAt', closeAt],
  ];
  for (const [earlierName, earlierValue, laterName, laterValue] of pipeline) {
    if (earlierValue > laterValue) {
      throw new OkrCycleValidationError(
        `${earlierName} must be on or before ${laterName}`,
        'INVALID_CYCLE_DATES',
        { [earlierName]: (input as unknown as Record<string, string>)[earlierName], [laterName]: (input as unknown as Record<string, string>)[laterName] }
      );
    }
  }
}

/**
 * Design §6.4: fail-closed guard (OKR-F-001-AC-02) — loads `program_id`
 * first (locked, same transaction); if `program.status !== 'active'`,
 * throws `OkrCycleProgramNotActiveError` (409) BEFORE any INSERT. On
 * success: `policy_version_id = program.active_policy_version_id` (pinned,
 * never updated after).
 */
export async function createCycle(
  input: CreateOkrCycleInput
): Promise<AtomicCommandOutcome<OkrCycle>> {
  const {
    organizationId,
    programId,
    name,
    startDate,
    endDate,
    draftOpenAt,
    submissionDueAt,
    approvalDueAt = null,
    activeStartAt,
    midcycleReviewAt = null,
    finalUpdateDueAt,
    reviewOpenAt,
    reflectionDueAt,
    managerReviewDueAt = null,
    closeAt,
    createdBy,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    access,
  } = input;

  assertCycleTimestampOrdering(input);

  return executeAtomicCreate<OkrCycle>({
    organizationId,
    applyMutation: async (client) => {
      // RN-G5: capability-only (no owner/responsible person exists for a
      // Cycle — plain RBAC resource, see OKR_CYCLE_CAPABILITIES's own
      // comment).
      assertCommandCapability({
        access,
        actorUserId: createdBy,
        capability: OKR_CYCLE_CAPABILITIES.create,
      });

      // Fail-closed guard (OKR-F-001-AC-02), BEFORE any INSERT. Locked on
      // the same transaction so a concurrent publish/suspend cannot race
      // this check.
      const programResult = await client.query<OkrProgramRow>(
        `SELECT * FROM okr_vnext_programs WHERE program_id = $1 AND organization_id = $2 FOR UPDATE`,
        [programId, organizationId]
      );
      const programRow = programResult.rows[0];
      if (!programRow) {
        throw new AtomicWriteAggregateNotFoundError(`OKR Program ${programId} not found`);
      }
      if (programRow.status !== 'active') {
        throw new OkrCycleProgramNotActiveError(programId, programRow.status);
      }
      if (!programRow.active_policy_version_id) {
        // Should not be reachable — status='active' is only ever set by
        // publishProgram, which always sets active_policy_version_id in the
        // SAME transaction — but fail loudly rather than insert a Cycle
        // with a null policy pointer (the column is NOT NULL, so this
        // would otherwise surface as an opaque Postgres error).
        throw new Error(
          `[createCycle] OKR Program ${programId} is active but has no active_policy_version_id`
        );
      }

      const insertResult = await client.query<OkrCycleRow>(
        `INSERT INTO okr_vnext_cycles
           (organization_id, program_id, name, start_date, end_date, draft_open_at,
            submission_due_at, approval_due_at, active_start_at, midcycle_review_at,
            final_update_due_at, review_open_at, reflection_due_at, manager_review_due_at,
            close_at, status, policy_version_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'planned', $16, $17)
         RETURNING *`,
        [
          organizationId,
          programId,
          name,
          startDate,
          endDate,
          draftOpenAt,
          submissionDueAt,
          approvalDueAt,
          activeStartAt,
          midcycleReviewAt,
          finalUpdateDueAt,
          reviewOpenAt,
          reflectionDueAt,
          managerReviewDueAt,
          closeAt,
          programRow.active_policy_version_id,
          createdBy,
        ]
      );
      const row = insertResult.rows[0];
      if (!row) {
        throw new Error('[createCycle] insert into okr_vnext_cycles returned no row');
      }
      return toOkrCycle(row);
    },
    buildEvent: ({ result }) => {
      const afterState: Record<string, unknown> = { cycle: result };
      return {
        schemaVersion: 1,
        eventType: 'okr_cycle.created',
        aggregateType: 'okr_cycle',
        aggregateId: result.cycleId,
        organizationId,
        actorUserId: createdBy,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: result.policyVersionId,
        beforeState: null,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: OKR_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion: null,
        resultingVersion: result.rowVersion,
        payload: { cycleId: result.cycleId, programId: result.programId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// runOkrCycleLifecycleTransition — generic guarded transition (OKR-F-002-AC-01)
// ==========================================

export interface OkrCycleLifecycleTransitionSpec {
  eventType: string;
  fromStatuses: readonly OkrCycleStatus[];
  toStatus: OkrCycleStatus;
  /**
   * OKR-E007 (D9) addition — optional, backward-compatible (IO-6: every
   * pre-existing spec constant below omits it and is byte-for-byte
   * unchanged). Evaluated against the pinned transactional client plus the
   * locked Cycle row, AFTER the `fromStatuses` check and BEFORE the
   * `UPDATE` — throw to abort the transition. Mirrors the shape (not the
   * domain-specific signature) of ROI's own `RoiCaseLifecycleTransitionSpec.guard`
   * (`roiCaseCommands.ts`).
   */
  guard?: (client: PoolClient, cycleRow: OkrCycleRow) => Promise<void>;
  /** RN-G5 capability gating this specific named transition. */
  capability: string;
}

export interface RunOkrCycleLifecycleTransitionInput {
  cycleId: string;
  organizationId: string;
  expectedVersion: number;
  /** Nullable — the platform's actual service-actor convention (design
   * §6.6): scheduler-initiated transitions pass `actorUserId: null` and
   * `actorEffectiveRole: 'system:okr_cycle_scheduler'`, there is no
   * separate `actor_type` column. */
  actorUserId: string | null;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

/**
 * Design §6.5: every Cycle status transition (open-drafting/activate/
 * open-review/close/cancel) goes through this ONE generic function, called
 * with a literal `spec` per endpoint — mirrors
 * `runRoiCaseLifecycleTransition`/`runKpiLifecycleTransition`'s shape but is
 * exported directly rather than wrapped in five named functions (design
 * §6.5's own stated departure from the ROI/KPI convention).
 */
export async function runOkrCycleLifecycleTransition(
  spec: OkrCycleLifecycleTransitionSpec,
  input: RunOkrCycleLifecycleTransitionInput
): Promise<AtomicCommandOutcome<OkrCycle>> {
  const {
    cycleId,
    organizationId,
    expectedVersion,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    access,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<OkrCycleRow, OkrCycle>({
    organizationId,
    aggregateId: cycleId,
    expectedVersion,
    loadForUpdate: loadOkrCycleForUpdate,
    getCurrentVersion: cycleRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      // RN-G5: capability-only (Cycle is plain RBAC, no owner column) —
      // actorUserId may be null (scheduler-initiated), same system-wildcard
      // pattern as okrSetCommands.ts's runOkrSetLifecycleTransition.
      assertCommandCapability({
        access,
        actorUserId: actorUserId ?? '',
        capability: spec.capability,
      });

      if (!spec.fromStatuses.includes(currentRow.status)) {
        throw new OkrCycleValidationError(
          `OKR Cycle ${cycleId} is "${currentRow.status}" — cannot transition to "${spec.toStatus}" from there`,
          'INVALID_TRANSITION',
          { cycleId, currentStatus: currentRow.status, toStatus: spec.toStatus }
        );
      }

      if (spec.guard) {
        await spec.guard(client, currentRow);
      }

      beforeState = { cycle: toOkrCycle(currentRow) };

      const updateResult = await client.query<OkrCycleRow>(
        `UPDATE okr_vnext_cycles
            SET status = $1, row_version = $2, updated_by = $3, updated_at = now()
          WHERE cycle_id = $4
          RETURNING *`,
        [spec.toStatus, nextVersion, actorUserId, cycleId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new Error(`[${spec.eventType}] update returned no row for ${cycleId}`);
      }
      return toOkrCycle(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { cycle: result };
      return {
        schemaVersion: 1,
        eventType: spec.eventType,
        aggregateType: 'okr_cycle',
        aggregateId: cycleId,
        organizationId,
        actorUserId,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: result.policyVersionId,
        beforeState,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: OKR_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { cycleId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// Named transition specs (design §6.5) — routes import these literals
// rather than re-declaring the eventType/fromStatuses/toStatus strings.
// `cancel` is a design addition beyond the epic ledger's own Command/API
// cell (which names only open-drafting/activate/open-review/close) — added
// because the plan's own lifecycle diagram shows a cancel branch from every
// non-terminal state; a Cycle with no cancel path would be a foreseeable
// gap. Stated explicitly here, not silently added.
// ==========================================

export const OKR_CYCLE_OPEN_DRAFTING_SPEC: OkrCycleLifecycleTransitionSpec = {
  eventType: 'okr_cycle.drafting_opened',
  fromStatuses: ['planned'],
  toStatus: 'drafting',
  capability: OKR_CYCLE_CAPABILITIES.openDrafting,
};

export const OKR_CYCLE_ACTIVATE_SPEC: OkrCycleLifecycleTransitionSpec = {
  eventType: 'okr_cycle.activated',
  fromStatuses: ['drafting'],
  toStatus: 'active',
  capability: OKR_CYCLE_CAPABILITIES.activate,
};

export const OKR_CYCLE_OPEN_REVIEW_SPEC: OkrCycleLifecycleTransitionSpec = {
  eventType: 'okr_cycle.review_opened',
  fromStatuses: ['active'],
  toStatus: 'review',
  capability: OKR_CYCLE_CAPABILITIES.openReview,
};

/** D9: guard added by OKR-E007 — a Cycle cannot close while any of its
 * Sets are still open (`NOT IN ('closed','cancelled','not_required')`).
 * `not_required` is included in the allowed set deliberately — a Set the
 * Program itself marked as never needing one (E002's reserved-but-unbuilt
 * `not_required` status, D2) is not "open" in any meaningful sense. */
export const OKR_CYCLE_CLOSE_SPEC: OkrCycleLifecycleTransitionSpec = {
  eventType: 'okr_cycle.closed',
  fromStatuses: ['review'],
  toStatus: 'closed',
  capability: OKR_CYCLE_CAPABILITIES.close,
  guard: async (client, cycleRow) => {
    const openSets = await client.query<{ set_id: string }>(
      `SELECT set_id FROM okr_vnext_sets WHERE cycle_id = $1 AND status NOT IN ('closed','cancelled','not_required')`,
      [cycleRow.cycle_id]
    );
    if (openSets.rows.length > 0) {
      throw new OkrCycleHasOpenSetsError(
        cycleRow.cycle_id,
        openSets.rows.map((r) => r.set_id)
      );
    }
  },
};

export const OKR_CYCLE_CANCEL_SPEC: OkrCycleLifecycleTransitionSpec = {
  eventType: 'okr_cycle.cancelled',
  fromStatuses: ['planned', 'drafting', 'active', 'review'],
  toStatus: 'cancelled',
  capability: OKR_CYCLE_CAPABILITIES.cancel,
};
