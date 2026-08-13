/**
 * KPI-E003 — corrective action commands (`addCorrectiveAction`,
 * `updateCorrectiveAction`).
 *
 * Design: docs/product/results-vnext/KPI_E003_DESIGN.md §B (state-machine
 * table) / decision #8 (auto-transition on first action -> 'active').
 * Schema: server/migrations/20260811_rvn_kpi_deviation_loop.sql
 * (`rvn_kpi_corrective_actions`).
 *
 * `addCorrectiveAction` is a `executeAtomicCreate` (its own file, own CAS
 * surface on `action_id` for FUTURE mutations of the row it creates —
 * design §B's own phrasing) — the case it belongs to is guarded (must be
 * `plan_required`) via a `SELECT ... FOR UPDATE` inside `applyMutation`,
 * same "lock the parent while creating a scoped child" shape
 * `kpiMeasurementCommands.ts` does not need (its parent guard is a plain
 * unique index) but this domain does (status-gated, not merely
 * uniqueness-gated).
 *
 * `updateCorrectiveAction` is an `executeAtomicCommand` CAS'd on the
 * action's own `row_version` — same convention as every single-row mutation
 * elsewhere in this domain (`kpiDeviationCommands.ts`).
 *
 * RN-G5 (docs/product/results-vnext/RN_G5_AUTHZ_DESIGN.md): both commands
 * gated with `assertCommandCapability`, same pattern/ordering as every other
 * gated command in this domain — the guard runs FIRST inside `applyMutation`,
 * before any domain-state check, right after the row it needs is locked.
 * `addCorrectiveAction` has no action row of its own yet (it is the CREATE),
 * so it authorizes against the PARENT deviation case's own responsible
 * people (`owner_user_id`/`manager_user_id`) — same "lock the parent, check
 * the parent's responsible people" shape `kpiScorecardCommands.ts`'s
 * `addScorecardItem` uses for its own parent-scoped child creation.
 * `updateCorrectiveAction` authorizes against the corrective action's OWN
 * `owner_user_id` (`CorrectiveActionRow` already carries one, unlike a KPI
 * definition version) — the case's owner/manager are deliberately NOT also
 * consulted here: the action's designated owner is the person actually
 * responsible for doing (and therefore updating) the work.
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import {
  executeAtomicCommand,
  executeAtomicCreate,
  type AtomicCommandOutcome,
  type AtomicEventInput,
} from '../platform/atomicWrite.js';
import {
  assertCommandCapability,
  type CommandAccessContext,
} from '../platform/commandCapabilityGuard.js';

import { computeStateHash, KPI_EVENT_SOURCE } from './kpiDefinitionCommands.js';
import { KpiDeviationValidationError } from './kpiDeviationCommands.js';
import {
  toCorrectiveAction,
  type CorrectiveAction,
  type CorrectiveActionRow,
  type CorrectiveActionStatus,
} from './kpiDeviationTypes.js';

// ==========================================
// RN-G5 — command capability names (docs/product/results-vnext/RN_G5_AUTHZ_DESIGN.md)
// Same dotted convention as kpiDeviationCommands.ts's DEVIATION_CAPABILITIES —
// nested under the `deviation` family since corrective actions are children
// of a deviation case (event types are already named
// `kpi.deviation_corrective_action_added`/`_updated`, same nesting).
// ==========================================
export const KPI_CORRECTIVE_ACTION_CAPABILITIES = {
  add: 'results.kpi.deviation.corrective_action.add',
  update: 'results.kpi.deviation.corrective_action.update',
} as const;

// ==========================================
// addCorrectiveAction
// ==========================================

export interface AddCorrectiveActionInput {
  deviationCaseId: string;
  organizationId: string;
  title: string;
  description?: string | null;
  ownerUserId: string;
  dueDate?: string | null;
  expectedEffect?: string | null;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  /** RN-G5: resolved once by the route via `resolveEffectiveAccess`. */
  access: CommandAccessContext;
}

export async function addCorrectiveAction(
  input: AddCorrectiveActionInput
): Promise<AtomicCommandOutcome<CorrectiveAction>> {
  const {
    deviationCaseId,
    organizationId,
    title,
    description = null,
    ownerUserId,
    dueDate = null,
    expectedEffect = null,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    access,
  } = input;

  return executeAtomicCreate<CorrectiveAction>({
    organizationId,
    applyMutation: async (client) => {
      const caseResult = await client.query<{
        status: string;
        owner_user_id: string;
        manager_user_id: string | null;
      }>(
        `SELECT status, owner_user_id, manager_user_id FROM rvn_kpi_deviation_cases
          WHERE case_id = $1 AND organization_id = $2 FOR UPDATE`,
        [deviationCaseId, organizationId]
      );
      const caseRow = caseResult.rows[0];
      if (!caseRow) {
        throw new KpiDeviationValidationError(`Deviation case ${deviationCaseId} not found`, 'CASE_NOT_FOUND', {
          deviationCaseId,
        });
      }

      // RN-G5: authorization FIRST, before the domain-state check below —
      // see this file's own header comment for why the PARENT case's
      // responsible people are what's checked (no action row exists yet).
      assertCommandCapability({
        access,
        actorUserId,
        capability: KPI_CORRECTIVE_ACTION_CAPABILITIES.add,
        responsibleUserIds: [caseRow.owner_user_id, caseRow.manager_user_id],
      });

      if (caseRow.status !== 'plan_required') {
        throw new KpiDeviationValidationError(
          `Deviation case ${deviationCaseId} is "${caseRow.status}" — corrective actions may only be added while "plan_required"`,
          'NOT_PLAN_REQUIRED',
          { deviationCaseId, status: caseRow.status }
        );
      }

      const insertResult = await client.query<CorrectiveActionRow>(
        `INSERT INTO rvn_kpi_corrective_actions
           (deviation_case_id, organization_id, title, description, owner_user_id, due_date, expected_effect, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [deviationCaseId, organizationId, title, description, ownerUserId, dueDate, expectedEffect, actorUserId]
      );
      const row = insertResult.rows[0];
      if (!row) throw new Error('[addCorrectiveAction] insert returned no row');
      return toCorrectiveAction(row);
    },
    buildEvent: ({ result }) => {
      const afterState = { action: result };
      return {
        schemaVersion: 1,
        eventType: 'kpi.deviation_corrective_action_added',
        aggregateType: 'deviation_case',
        aggregateId: result.deviationCaseId,
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
        payload: { actionId: result.actionId, deviationCaseId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// updateCorrectiveAction
// ==========================================

async function loadCorrectiveActionForUpdate(
  client: PoolClient,
  actionId: string,
  organizationId: string
): Promise<CorrectiveActionRow | undefined> {
  const result = await client.query<CorrectiveActionRow>(
    `SELECT * FROM rvn_kpi_corrective_actions WHERE action_id = $1 AND organization_id = $2 FOR UPDATE`,
    [actionId, organizationId]
  );
  return result.rows[0];
}
const actionRowVersion = (row: CorrectiveActionRow) => row.row_version;

export interface UpdateCorrectiveActionInput {
  actionId: string;
  organizationId: string;
  expectedVersion: number;
  status?: CorrectiveActionStatus;
  title?: string;
  description?: string | null;
  ownerUserId?: string;
  dueDate?: string | null;
  expectedEffect?: string | null;
  actualEffect?: string | null;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  /** RN-G5: resolved once by the route via `resolveEffectiveAccess`. */
  access: CommandAccessContext;
}

export interface UpdateCorrectiveActionResult {
  action: CorrectiveAction;
  /** True when this update's `status -> 'active'` transition was the FIRST
   * corrective action to enter `'active'` on its case and therefore
   * auto-transitioned the case `approved -> executing` (decision #8) — the
   * caller/UI can use this to know a case-level status change also
   * happened, without re-reading the case. */
  caseAutoTransitionedToExecuting: boolean;
}

export async function updateCorrectiveAction(
  input: UpdateCorrectiveActionInput
): Promise<AtomicCommandOutcome<UpdateCorrectiveActionResult>> {
  const {
    actionId,
    organizationId,
    expectedVersion,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    access,
    ...edits
  } = input;

  let beforeState: Record<string, unknown> | null = null;
  let caseAutoTransitioned = false;

  return executeAtomicCommand<CorrectiveActionRow, UpdateCorrectiveActionResult>({
    organizationId,
    aggregateId: actionId,
    expectedVersion,
    loadForUpdate: loadCorrectiveActionForUpdate,
    getCurrentVersion: actionRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      // RN-G5: authorization FIRST — the action's OWN designated owner (see
      // file header for why the parent case's owner/manager are NOT also
      // consulted here).
      assertCommandCapability({
        access,
        actorUserId,
        capability: KPI_CORRECTIVE_ACTION_CAPABILITIES.update,
        responsibleUserIds: [currentRow.owner_user_id],
      });

      if (currentRow.status === 'completed' || currentRow.status === 'cancelled') {
        throw new KpiDeviationValidationError(
          `Corrective action ${actionId} is "${currentRow.status}" — a terminal action cannot be updated`,
          'ACTION_TERMINAL',
          { actionId, status: currentRow.status }
        );
      }

      beforeState = { action: toCorrectiveAction(currentRow) };

      const merged = {
        title: edits.title ?? currentRow.title,
        description: edits.description !== undefined ? edits.description : currentRow.description,
        owner_user_id: edits.ownerUserId ?? currentRow.owner_user_id,
        due_date: edits.dueDate !== undefined ? edits.dueDate : currentRow.due_date,
        status: edits.status ?? currentRow.status,
        expected_effect: edits.expectedEffect !== undefined ? edits.expectedEffect : currentRow.expected_effect,
        actual_effect: edits.actualEffect !== undefined ? edits.actualEffect : currentRow.actual_effect,
      };

      const updateResult = await client.query<CorrectiveActionRow>(
        `UPDATE rvn_kpi_corrective_actions
            SET title = $1, description = $2, owner_user_id = $3, due_date = $4, status = $5,
                expected_effect = $6, actual_effect = $7, row_version = $8, updated_at = now()
          WHERE action_id = $9
          RETURNING *`,
        [
          merged.title,
          merged.description,
          merged.owner_user_id,
          merged.due_date,
          merged.status,
          merged.expected_effect,
          merged.actual_effect,
          nextVersion,
          actionId,
        ]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) throw new Error(`[updateCorrectiveAction] update returned no row for ${actionId}`);

      // Decision #8: the FIRST corrective action to enter 'active' on its
      // case auto-transitions the case 'approved' -> 'executing' — "work
      // has begun" is the bar, not "every action started simultaneously".
      // The `status = 'approved'` predicate in the UPDATE below makes this
      // naturally a no-op (0 rows) for every subsequent action's own
      // 'active' transition, since the case has already left 'approved' by
      // then — no separate "is this the first one" query needed.
      if (merged.status === 'active' && currentRow.status !== 'active') {
        const caseTransition = await client.query(
          `UPDATE rvn_kpi_deviation_cases
              SET status = 'executing', updated_at = now()
            WHERE case_id = $1 AND status = 'approved'
            RETURNING case_id`,
          [updatedRow.deviation_case_id]
        );
        caseAutoTransitioned = (caseTransition.rowCount ?? 0) > 0;
      }

      return { action: toCorrectiveAction(updatedRow), caseAutoTransitionedToExecuting: caseAutoTransitioned };
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = {
        action: result.action,
        caseAutoTransitionedToExecuting: result.caseAutoTransitionedToExecuting,
      };
      return {
        schemaVersion: 1,
        eventType: 'kpi.deviation_corrective_action_updated',
        aggregateType: 'deviation_case',
        aggregateId: result.action.deviationCaseId,
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
        payload: { actionId: result.action.actionId, deviationCaseId: result.action.deviationCaseId },
      } satisfies AtomicEventInput;
    },
  });
}
