// @ts-nocheck
/**
 * Initiative Transition Service
 *
 * Canonical domain service owning EVERY initiative status transition.
 * Extracted from InitiativeController.ts (H16/INI-005 fix, 2026-08-01) so the
 * same engine can be called both from HTTP adapters (PATCH /:id/status,
 * POST /:id/approve, POST /:id/start-execution) AND from non-HTTP callers
 * such as the initiativeAutoStartJob cron job — no second copy of
 * validation/RBAC/gate/decision-currency logic anywhere else in the codebase.
 */

import { v4 as uuidv4 } from 'uuid';

import { isAiGate } from '../../constants/initiativeGateAi.js';
import {
  GATE_PERMISSIONS,
  GateType,
  INITIATIVE_FLAG_RULES,
  getGateForTransition,
  getTransitionDefinition,
  InitiativeStatus,
  isTerminalStatus,
  isValidTransition,
  VALID_TRANSITIONS,
  willChangeModule,
  type InitiativeFlagOperation,
} from '../../constants/initiativeStatuses.js';
import { gateAiSoftBlocks } from '../../types/gateAi.js';
import logger from '../../utils/Logger.js';
import type { PgTransactionClient } from '../../utils/queryHelpers.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import auditEventsService from '../AuditEventsService.js';
import {
  createReceiptOnClosure,
  triggerImmediateDeliveryBestEffort,
} from '../closureDeliveryReceiptService.js';
import notificationService from '../notificationService.js';
import { getGateReadiness } from './gateAiReadinessService.js';
import { recordGateAiEvent } from './gateAiTelemetryService.js';
import { getTimelineFlags } from './gateTimelineService.js';
import {
  canExecuteGate,
  resolveGateRequiredRoles,
  resolveInitiativeCapabilityContext,
} from './initiativeCapabilityMatrix.js';
import {
  assertCurrentApprovedInitiativeLifecycleGateDecision,
  type InitiativeLifecycleGateDomain,
} from './initiativeLifecycleGateDecisionService.js';
import { isInitiativeGateAiEnabled } from './initiativeGateAiConfig.js';
import { getBlockingReadinessItems } from './initiativeGateReadinessService.js';
import {
  coerceInitiativeStatusForWrite,
  hasInitiativeStatusSchemaDrift,
  normalizeInitiativeDbStatusForRead,
  resolveInitiativeStageForRow,
} from './initiativeLifecycleCanon.js';
import { resolveInitiativeLifecycleStage } from '../../constants/initiativeLifecycleStages.js';
import { recordHandoff as recordStageHandoff } from './stageHandoffService.js';
import {
  evaluateInitiativeAuthorOnly,
  evaluateInitiativeTransitionCondition,
} from './initiativeTransitionConditions.js';

// ==========================================
// SHARED HELPERS (moved from InitiativeController.ts — these are also used by
// other, non-transition controller methods, which now import them from here)
// ==========================================

export const normalizeStatus = (value: string | null | undefined): string =>
  String(value || '').toUpperCase();

export const getColumnNameSet = (
  columns: Array<{
    name?: string | null;
  }>
): Set<string> =>
  new Set(columns.map((column) => String(column?.name || '').trim()).filter(Boolean));

export const pushOptionalColumnUpdate = (
  updates: string[],
  params: unknown[],
  columns: Set<string>,
  column: string,
  value: unknown
) => {
  if (!columns.has(column)) return;
  updates.push(`${column} = ?`);
  params.push(value);
};

/**
 * Canonical writer for the initiative aggregate lifecycle stage.
 *
 * Kept as an exported transaction helper so seed/repair paths can reuse the
 * exact runtime upsert instead of copying the payload merge and version rules.
 * A disposition has no stage and deliberately leaves the aggregate untouched.
 */
export async function writeInitiativeAggregateLifecycleStage(
  client: PgTransactionClient,
  input: {
    organizationId: string;
    initiativeId: string;
    lifecycleStage: string | null;
  }
): Promise<'written' | 'skipped' | 'aggregate-table-missing'> {
  if (input.lifecycleStage === null) return 'skipped';

  const stagePatch = JSON.stringify({
    initiativeId: input.initiativeId,
    lifecycleState: input.lifecycleStage,
  });
  try {
    await client.query(
      `INSERT INTO ie_aggregate_state
         (organization_id, aggregate_type, aggregate_id, version, payload_json, updated_at)
       VALUES (?, 'initiative', ?, 1, CAST(? AS jsonb), NOW())
       ON CONFLICT (organization_id, aggregate_type, aggregate_id) DO UPDATE
         SET version = ie_aggregate_state.version + 1,
             payload_json = ie_aggregate_state.payload_json || CAST(? AS jsonb),
             updated_at = NOW()`,
      [input.organizationId, input.initiativeId, stagePatch, stagePatch]
    );
    return 'written';
  } catch (stageErr: unknown) {
    const msg = String((stageErr as Error)?.message || stageErr || '');
    if (!/ie_aggregate_state/i.test(msg) || !/does not exist|no such table/i.test(msg)) {
      throw stageErr;
    }
    logger.warn(
      `[initiatives] etap silnika ${input.lifecycleStage} NIE zapisany dla ${input.initiativeId}: brak tabeli ie_aggregate_state`
    );
    return 'aggregate-table-missing';
  }
}

interface GateDecisionCheck {
  ok: boolean;
  decisionId: string | null;
}

/**
 * Thrown (never returned as a normal `{kind:'error',...}` outcome) by the
 * pre-commit gate-decision recheck inside `executeInitiativeTransition`'s
 * `withPgTransaction` body when the decision that satisfied a gate earlier in
 * the SAME transition has been superseded by the time the write path is about
 * to run. MUST be a `throw`, not a `return`: by this point (specifically for
 * the APPROVED->SCHEDULED branch) a schedule-baseline INSERT may already have
 * executed on this same pinned connection, and only a thrown error causes
 * `withPgTransaction` to ROLLBACK — an early `return` from the transaction body
 * still reaches `COMMIT` (see `queryHelpers.withPgTransaction`).
 */
export class TransitionGateSupersededError extends Error {
  constructor(
    public readonly gate: string,
    public readonly pmoDomain: string
  ) {
    super(`Gate decision for ${pmoDomain} was superseded during the transition`);
    this.name = 'TransitionGateSupersededError';
  }
}

/**
 * Canonical lifecycle gate-decision currency check.
 *
 * Only the highest immutable version in `initiative_lifecycle_gate_decisions`
 * can satisfy a lifecycle gate. The owner read and every owner append acquire
 * the same transaction-scoped advisory lock on the caller's pinned client, so
 * a generic `decisions` row cannot unlock a transition and a new canonical
 * version cannot land between this read and the transition commit.
 */
/**
 * Bramka GO na starcie realizacji (H1d / H16 / INI-005) za flagą serwerową.
 * Domyślnie WYŁĄCZONA — patrz komentarz przy `GateType.START` w
 * `evaluateInitiativeTransition`. Czytana przy każdym wywołaniu (nie w module),
 * żeby test mógł ją przestawić bez przeładowania modułu.
 */
export const isLifecycleGoGateEnabled = (): boolean =>
  process.env.ENABLE_LIFECYCLE_GO_GATE === 'true';

export const hasApprovedGateDecision = async (
  orgId: string,
  initiativeId: string,
  pmoDomain: string,
  client: PgTransactionClient
): Promise<GateDecisionCheck> => {
  try {
    const decision = await assertCurrentApprovedInitiativeLifecycleGateDecision(client, {
      organizationId: orgId,
      initiativeId,
      pmoDomain: pmoDomain as InitiativeLifecycleGateDomain,
    });
    return { ok: true, decisionId: decision.decisionId };
  } catch {
    return { ok: false, decisionId: null };
  }
};

export const getInitiativeNotificationRecipients = async (
  orgId: string,
  initiativeId: string
): Promise<string[]> => {
  const recipients = new Set<string>();

  const initiative = await queryHelpers.queryOne(
    `SELECT owner_business_id, owner_execution_id, sponsor_id, name
     FROM initiatives WHERE id = ? AND organization_id = ?`,
    [initiativeId, orgId]
  );

  const ownerBusinessId = (initiative as any)?.owner_business_id;
  const ownerExecutionId = (initiative as any)?.owner_execution_id;
  const sponsorId = (initiative as any)?.sponsor_id;
  [ownerBusinessId, ownerExecutionId, sponsorId]
    .filter(Boolean)
    .forEach((id: string) => recipients.add(id));

  // Watchers (if feature enabled)
  try {
    const watcherRows = await queryHelpers.queryAll(
      `SELECT w.user_id as "userId"
       FROM initiative_watchers w
       JOIN initiatives i ON i.id = w.initiative_id
       WHERE w.initiative_id = ? AND i.organization_id = ?`,
      [initiativeId, orgId]
    );
    watcherRows.forEach((r: any) => r?.userId && recipients.add(r.userId));
  } catch {
    // table may not exist yet
  }

  // Stakeholders (RACI)
  try {
    const stakeholderRows = await queryHelpers.queryAll(
      `SELECT s.user_id as "userId"
       FROM initiative_stakeholders s
       JOIN initiatives i ON i.id = s.initiative_id
       WHERE s.initiative_id = ? AND i.organization_id = ? AND s.user_id IS NOT NULL`,
      [initiativeId, orgId]
    );
    stakeholderRows.forEach((r: any) => r?.userId && recipients.add(r.userId));
  } catch {
    // table may not exist yet
  }

  return Array.from(recipients);
};

export const hasPendingExecutionGateDecisions = async (
  orgId: string,
  initiativeId: string
): Promise<boolean> => {
  const columns = await queryHelpers.getTableColumns('decisions');
  const hasColumn = (column: string) => columns.some((col) => col.name === column);
  const hasInitiativeId = hasColumn('initiative_id');
  const hasTaskId = hasColumn('task_id');
  const hasRelatedObjectType = hasColumn('related_object_type');
  const hasRelatedObjectId = hasColumn('related_object_id');
  const hasType = hasColumn('type');

  const params: Array<string> = [orgId];
  let sql = `
        SELECT d.id
        FROM decisions d
    `;

  if (hasTaskId) {
    sql += ' LEFT JOIN tasks t ON d.task_id = t.id';
  }

  sql += ' WHERE d.organization_id = ?';

  const scopeConditions: string[] = [];
  if (hasInitiativeId) {
    scopeConditions.push('d.initiative_id = ?');
    params.push(initiativeId);
  }
  if (hasTaskId) {
    scopeConditions.push('t.initiative_id = ?');
    params.push(initiativeId);
  }
  if (hasRelatedObjectType && hasRelatedObjectId) {
    scopeConditions.push("(d.related_object_type = 'initiative' AND d.related_object_id = ?)");
    params.push(initiativeId);
  }

  if (scopeConditions.length === 0) {
    return false;
  }

  sql += ` AND (${scopeConditions.join(' OR ')})`;
  sql += ` AND d.status IN ('pending', 'escalated')`;

  if (hasType) {
    sql += ` AND d.type IN ('SCOPE_CHANGE', 'RISK_ACCEPTANCE', 'BLOCKER_RESOLUTION', 'PHASE_TRANSITION')`;
  }

  sql += ' LIMIT 1';
  const rows = await queryHelpers.queryAll(sql, params);
  return rows.length > 0;
};

// ==========================================
// CANONICAL TRANSITION ENGINE
// ==========================================

/**
 * ============================================
 * CANONICAL TRANSITION ENGINE
 * ============================================
 *
 * Single internal function that owns EVERY initiative status transition —
 * validation (transition table, RBAC/gate, AI soft-block, readiness, GO/NO-GO
 * decision currency), the atomic write (state UPDATE + audit history), and the
 * best-effort side effects (notifications, stage handoff, closure handoff,
 * audit log). `updateInitiativeStatus` (PATCH /:id/status), `approveInitiative`
 * (POST /:id/approve) and `startExecution` (POST /:id/start-execution) are all
 * thin HTTP-layer adapters over this ONE function — no other code path may
 * write `initiatives.status`.
 *
 * ATOMICITY / CONCURRENCY (H16 fix, 2026-08-01): the read-then-write of the
 * initiative row happens on a SINGLE pinned PostgreSQL client
 * (queryHelpers.withPgTransaction — see that function's doc comment for why
 * queryAll/queryOne/queryRun cannot be composed into a transaction in this
 * codebase). The row is locked with `SELECT … FOR UPDATE` FIRST; every
 * subsequent check in this function reads `currentStatus` from THAT locked
 * row, never from a pre-transaction read. The state UPDATE and both audit
 * INSERTs run on the same client inside the same transaction — if the audit
 * writes fail, the whole transition rolls back (no more "state changed but
 * audit trail silently didn't", the previous best-effort try/catch behavior).
 *
 * Two concurrent requests targeting the same initiative serialize on the row
 * lock: whichever acquires it first runs validation + write + COMMIT (which
 * releases the lock); the second blocks on `FOR UPDATE` until the first
 * COMMITs, then re-reads the NOW-CHANGED status and evaluates
 * `isValidTransition` against it — since no status transitions to itself in
 * VALID_TRANSITIONS, a same-target retry (or a genuine race) cleanly fails
 * INVALID_TRANSITION (400) instead of double-writing or corrupting history.
 * The identical mechanism makes a duplicate/retried request idempotent for
 * free — no bespoke idempotency-key system needed.
 *
 * Secondary reads used only for validation (decisions, milestones, KPIs, gate
 * roles) are NOT part of the race and intentionally stay on the shared pool.
 * Non-critical side effects (notifications, recordStageHandoff,
 * fireClosureHandoff, the audit-events log) intentionally run AFTER the
 * transaction commits/rolls back — they must never hold the row lock open.
 *
 * EXTRACTION (INI-005 fix, 2026-08-01): moved here from InitiativeController.ts
 * so `initiativeAutoStartJob` can call the SAME engine — see the `actor`
 * parameter below and its `kind: 'system'` branch for the auto-start carve-out.
 */
interface GateBlockedNotify {
  type: string;
  title: string;
  body: string;
  priority?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Who is performing the transition.
 *
 * `{ kind: 'user' }` (the default when `actor` is omitted) is every existing
 * HTTP caller — behavior is byte-identical to before this type existed.
 *
 * `{ kind: 'system', ... }` is the ONLY way a non-human caller (currently:
 * `initiativeAutoStartJob`) may drive this engine. It does NOT grant a
 * blanket bypass — see the narrow `gate !== GateType.START` carve-out below
 * and the AI-soft-block skip. It NEVER affects the GO/NO-GO decision-currency
 * check, which always runs regardless of actor kind.
 *
 * `systemActorId` is what gets written to `changed_by`/`approved_by`/etc. —
 * it must be a stable, honest, non-human-impersonating string (see
 * `SYSTEM_ACTOR_AUTO_START` in initiativeAutoStartJob.ts). `systemActorLabel`
 * is a human-readable version used for the audit-trail `actorName`.
 */
export type InitiativeTransitionActor =
  { kind: 'user' } | { kind: 'system'; systemActorId: string; systemActorLabel: string };

interface ExecuteInitiativeTransitionParams {
  orgId: string;
  initiativeId: string;
  actorId: string;
  /** Human caller's role — used for the RBAC/gate lookup. Ignored (and not
   *  required) when `actor.kind === 'system'`. */
  actorRole?: string | null;
  actorFirstName?: string | null;
  actorLastName?: string | null;
  actorEmail?: string | null;
  nextStatusInput: string;
  /** Operacja na fladze DEC-424; status pozostaje bez zmian. */
  flagOperation?: InitiativeFlagOperation;
  reason?: string | null;
  overrideReason?: string | null;
  /** Best-effort request metadata for the audit-events log. Absent for
   *  non-HTTP callers (there is no request). */
  requestIp?: string | null;
  requestUserAgent?: string | null;
  /**
   * Disambiguation guard (INI-005 follow-up, 2026-08-01) — required when the
   * SAME `nextStatusInput` is reachable from more than one `from` status via
   * DIFFERENT gates. Concretely: EXECUTING is reachable both from SCHEDULED
   * (gate START) and from BLOCKED (gate UNBLOCK) — `isValidTransition` alone
   * accepts either, so without this guard a caller hitting the /unblock
   * adapter on a SCHEDULED (not BLOCKED) initiative would silently succeed
   * via the START gate instead of failing with a clear "not blocked" error.
   * When set, the locked row's current status must match exactly or the
   * transition is refused (400 UNEXPECTED_CURRENT_STATUS) before any gate/
   * RBAC/decision check runs.
   */
  expectedCurrentStatus?: string | null;
  /** Optional caller-owned transaction. When supplied, no nested BEGIN/COMMIT is opened. */
  transactionClient?: PgTransactionClient;
  /** Registers effects that may run only after the caller commits its pinned transaction. */
  deferPostCommitEffect?: (effect: () => Promise<void>) => void;
  /** Defaults to `{ kind: 'user' }` — every existing caller is unaffected. */
  actor?: InitiativeTransitionActor;
  /**
   * ★ TEST-ONLY synchronization hook (decision-race test packet, 2026-08-01).
   * Lets acceptance tests pause this function at controlled points to inject a
   * concurrent write (e.g. a competing `decisions` UPDATE via a second pg
   * client) and deterministically observe how the transition reacts — without
   * resorting to `setTimeout`/sleep-based races. Defaults to a no-op.
   *
   * NEVER populated by any real HTTP adapter: every production call site
   * (`InitiativeController.ts`'s four `executeInitiativeTransition({...})`
   * call sites and `initiativeAutoStartJob.ts`'s one) builds this params
   * object as an explicit field-literal object, never a spread of `req.body`
   * or any other externally-controlled object — so there is no way a request
   * body could inject this field. (Verified by inspection as part of this
   * change; re-verify if a new call site is ever added.)
   */
  __testSyncHook?: (point: 'after-decision-read' | 'before-commit') => Promise<void>;
}

type ExecuteInitiativeTransitionResult =
  | {
      ok: true;
      id: string;
      status: string;
      previousStatus: string;
      gate: string | null;
      correlationId: string;
    }
  | {
      ok: false;
      statusCode: number;
      body: Record<string, unknown>;
    };

export async function executeInitiativeTransition(
  params: ExecuteInitiativeTransitionParams
): Promise<ExecuteInitiativeTransitionResult> {
  const {
    orgId,
    initiativeId: id,
    actorId,
    reason,
    actorRole = null,
    actorFirstName = null,
    actorLastName = null,
    actorEmail = null,
    requestIp = null,
    requestUserAgent = null,
  } = params;
  const actor: InitiativeTransitionActor = params.actor ?? { kind: 'user' };
  const isSystemActor = actor.kind === 'system';
  // Test-only synchronization hook — see `__testSyncHook`'s doc comment on
  // `ExecuteInitiativeTransitionParams`. No-op for every real caller.
  const syncHook = params.__testSyncHook ?? (async () => {});

  const actorName = isSystemActor
    ? actor.systemActorLabel
    : actorFirstName && actorLastName
      ? `${actorFirstName} ${actorLastName}`
      : actorEmail || undefined;

  // Pure input validation — no DB needed, so fail fast before ever opening a
  // transaction / acquiring a pinned connection + row lock for garbage input.
  // NOTE (disclosed precedence change vs. the pre-refactor handler): previously
  // a request with BOTH a nonexistent initiative id AND an unrecognized target
  // status returned 404 (existence was checked first). Since this check is now
  // pre-transaction, that combination now returns 400 UNKNOWN_TARGET_STATUS
  // instead. Harmless in practice (both are client errors) but noted for the
  // record.
  const nextInput = normalizeStatus(params.nextStatusInput);
  const coercedNext = coerceInitiativeStatusForWrite(nextInput);
  if (!coercedNext.ok) {
    return {
      ok: false,
      statusCode: 400,
      body: {
        error: coercedNext.message,
        code: coercedNext.code,
        rule: 'UNKNOWN_TARGET_STATUS',
      },
    };
  }
  const nextStatus = coercedNext.status;
  // H1c / DEC-506 — druga prawda tego samego celu: etap silnika (12, DEC-490).
  // `nextStatus` idzie do kolumny (7 kodów, CHECK P12), `nextStage` do agregatu
  // silnika, żeby kolaps 12→7 nie zjadał informacji (APPROVED_BACKLOG i
  // SCHEDULED to ten sam kod `APPROVED`, DELIVERED i CLOSED to ten sam `CLOSED`).
  const nextStage = coercedNext.stage;
  const overrideReasonTrimmed = params.overrideReason ? String(params.overrideReason).trim() : '';

  type TransitionOutcome =
    | {
        kind: 'error';
        statusCode: number;
        body: Record<string, unknown>;
        notify?: GateBlockedNotify;
      }
    | {
        kind: 'success';
        currentStatus: string;
        nextStatus: string;
        gate: string | null;
        correlationId: string;
        initiativeName: string;
      };

  // Deliberately narrow try/catch (decision-race fix, 2026-08-01): this exists
  // ONLY to translate the specific, expected `TransitionGateSupersededError`
  // thrown by the pre-commit gate-decision recheck (see `decisionGatePmoDomain`
  // below) into this function's normal structured 409 response shape. It must
  // `throw` (not `return`) from inside the transaction body so `withPgTransaction`
  // ROLLBACKs before this catch ever runs (see `TransitionGateSupersededError`'s
  // doc comment). EVERY OTHER error continues to propagate uncaught out of this
  // function to the calling asyncHandler-wrapped route method, which forwards it
  // to Express's error middleware — the same coded, non-leaking 5xx envelope
  // every other unexpected failure in this codebase gets (see asyncHandler.ts:
  // `.catch(next)`). We do NOT want a bespoke 500 JSON shape here that bypasses
  // that shared handling, and we must never return an `ok: true` response if
  // COMMIT didn't unambiguously succeed.
  let outcome: TransitionOutcome;
  try {
    const transitionBody = async (client: PgTransactionClient): Promise<TransitionOutcome> => {
      // CONCURRENCY FIX: lock the row FIRST. Every check below reads
      // `currentStatus`/`initiativeName`/etc. from THIS locked row.
      const lockedRows = (
        await client.query<Record<string, unknown>>(
          `SELECT * FROM initiatives WHERE id = ? AND organization_id = ? FOR UPDATE`,
          [id, orgId]
        )
      ).rows;
      const lockedRow = lockedRows[0];
      if (!lockedRow) {
        return { kind: 'error', statusCode: 404, body: { error: 'Initiative not found' } };
      }

      const currentStatus = normalizeInitiativeDbStatusForRead(String(lockedRow.status || ''));
      const initiativeName = String(lockedRow.name || 'Initiative');
      const initiativeColumns = getColumnNameSet(await queryHelpers.getTableColumns('initiatives'));

      if (params.flagOperation) {
        const operation = params.flagOperation;
        const rule = INITIATIVE_FLAG_RULES[operation];
        const onHold = Boolean(lockedRow.on_hold);
        const allowedState = operation === 'ARCHIVE'
          ? currentStatus === 'CLOSED' || currentStatus === 'REJECTED'
          : currentStatus === 'IN_EXECUTION';
        if (!allowedState || (operation === 'RESUME' && !onHold)) {
          return { kind: 'error', statusCode: 400, body: {
            error: `Flag operation ${operation} is not allowed for ${currentStatus}`,
            rule: 'INVALID_FLAG_OPERATION',
          } };
        }
        if (rule.reasonRequired && !String(reason ?? '').trim()) {
          return { kind: 'error', statusCode: 400, body: {
            error: 'Reason is required', rule: 'REASON_REQUIRED',
          } };
        }
        if (!isSystemActor) {
          const accessCtx = await resolveInitiativeCapabilityContext(orgId, id, actorId, actorRole);
          if (!canExecuteGate({ gate: rule.gate, effectiveRoles: accessCtx.effectiveRoles,
            steeringBoardEnabled: accessCtx.steeringBoardEnabled, conditionSatisfied: true })) {
            return { kind: 'error', statusCode: 403, body: {
              error: 'Permission denied for initiative flag operation', gate: rule.gate,
              requiredRoles: resolveGateRequiredRoles(rule.gate, accessCtx.steeringBoardEnabled),
            } };
          }
        }
        if (operation === 'HOLD') {
          await client.query(`UPDATE initiatives SET on_hold = TRUE, blocked_at = CURRENT_TIMESTAMP,
            blocked_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
          [String(reason).trim(), id, orgId]);
        } else if (operation === 'RESUME') {
          await client.query(`UPDATE initiatives SET on_hold = FALSE, blocked_at = NULL,
            blocked_reason = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
          [id, orgId]);
        } else {
          await client.query(`UPDATE initiatives SET archived = TRUE, archived_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`, [id, orgId]);
        }
        return { kind: 'success', currentStatus, nextStatus: currentStatus, gate: rule.gate,
          correlationId: uuidv4(), initiativeName };
      }

      // DISAMBIGUATION GUARD (see ExecuteInitiativeTransitionParams.expectedCurrentStatus
      // doc comment): must run BEFORE isValidTransition, since e.g. SCHEDULED->EXECUTING
      // and BLOCKED->EXECUTING are BOTH independently valid — this is the check that
      // makes /unblock fail cleanly on a non-BLOCKED initiative instead of silently
      // acting as if it were /start-execution.
      if (params.expectedCurrentStatus) {
        // H1c / DEC-506 — CZWARTE miejsce tego samego rozjazdu słowników.
        // `expectedCurrentStatus` przychodzi z adaptera przejść cyklu życia
        // pisanego ETAPAMI silnika (SCHEDULED · EXECUTING · PROMOTED), a
        // `currentStatus` to kod kolumny (7, P12). Surowe `!==` znaczyło
        // „wymaga SCHEDULED, a jest APPROVED" dla inicjatywy, która JEST na
        // etapie SCHEDULED — bo etap SCHEDULED zapisuje się w kolumnie
        // właśnie jako APPROVED. Porównujemy więc ETAP z ETAPEM: agregat
        // silnika jest prawdą pierwszą, kolumna zapasem.
        const expected = normalizeStatus(params.expectedCurrentStatus);
        const expectedStage = resolveInitiativeLifecycleStage(expected);
        const aggregateStage = (
          await client.query<{ lifecycle_state: string | null }>(
            `SELECT payload_json->>'lifecycleState' AS lifecycle_state
               FROM ie_aggregate_state
              WHERE organization_id = ? AND aggregate_type = 'initiative' AND aggregate_id = ?`,
            [orgId, id]
          ).catch(() => ({ rows: [] as Array<{ lifecycle_state: string | null }> }))
        ).rows[0]?.lifecycle_state;
        const currentStage = resolveInitiativeStageForRow({
          lifecycleStage: String(lockedRow.lifecycle_stage || '') || null,
          aggregateLifecycleState: aggregateStage ?? null,
          dbStatus: currentStatus,
        });
        if (!expectedStage || currentStage !== expectedStage) {
          return {
            kind: 'error',
            statusCode: 400,
            body: {
              error: `This action requires the initiative to be ${expected}, but it is ${currentStage ?? currentStatus}`,
              rule: 'UNEXPECTED_CURRENT_STATUS',
              from: currentStatus,
              fromStage: currentStage,
              expected,
              to: nextStatus,
            },
          };
        }
      }

      // TRANSITION VALIDATION: check if from→to is allowed
      if (!isValidTransition(currentStatus as any, nextStatus as any)) {
        return {
          kind: 'error',
          statusCode: 400,
          body: {
            error: `Invalid status transition: ${currentStatus} → ${nextStatus}`,
            rule: 'INVALID_TRANSITION',
            from: currentStatus,
            to: nextStatus,
            validNext: VALID_TRANSITIONS[currentStatus as keyof typeof VALID_TRANSITIONS] || [],
          },
        };
      }

      // RBAC + gate enforcement (enterprise governance)
      // - Consultant can only SUBMIT_FOR_REVIEW for initiatives they authored (created_by)
      // - PM/Lead/PMO gate approvals move initiatives to global visibility (REVIEW)
      const transitionDefinition = getTransitionDefinition(currentStatus as any, nextStatus as any);
      const gate = getGateForTransition(currentStatus as any, nextStatus as any);
      // `isValidTransition` above and this guard intentionally fail closed twice:
      // a matrix row without a gate is never an executable transition.
      if (!transitionDefinition || !gate) {
        return { kind: 'error', statusCode: 400, body: {
          error: 'Status transition has no governed gate', rule: 'MISSING_TRANSITION_GATE',
          from: currentStatus, to: nextStatus,
        } };
      }

      const condition = transitionDefinition.condition;
      // Warunki merytoryczne liczy WSPÓLNY moduł `initiativeTransitionConditions`
      // — ten sam, z którego korzysta `GET /:id/transition-preflight`. Dzięki temu
      // przycisk wyszarzony w interfejsie i odmowa pisarza mają jedno źródło.
      const conditionFailure = await evaluateInitiativeTransitionCondition(client, {
        orgId,
        initiativeId: id,
        row: lockedRow,
        condition,
        reason: String(reason ?? '').trim(),
        hasApprovedGateDecision,
        hasPendingExecutionGateDecisions,
      });
      if (conditionFailure) {
        return { kind: 'error', statusCode: 400, body: {
          error: conditionFailure.error, rule: conditionFailure.rule,
        } };
      }
      // DEC-453: resolved ONCE for a human actor and reused below (role-gate
      // check) — the authorOnly carve-out (ADMIN/OWNER, or a draft with no
      // recorded author) needs the same effectiveRoles the gate check needs,
      // and computing it twice would be a second, driftable copy of "who is
      // this actor" for the same request.
      const humanAccessCtx = isSystemActor
        ? null
        : await resolveInitiativeCapabilityContext(orgId, id, actorId, actorRole);
      if (transitionDefinition.authorOnly && !isSystemActor) {
        const authorFailure = evaluateInitiativeAuthorOnly(
          lockedRow,
          actorId,
          humanAccessCtx?.effectiveRoles
        );
        if (authorFailure) {
          return { kind: 'error', statusCode: 403, body: {
            error: authorFailure.error, rule: authorFailure.rule,
          } };
        }
      }
      if (gate && isSystemActor) {
        // ★ System-actor RBAC carve-out (INI-005 fix, 2026-08-01; widened
        // 2026-08-01 for the Decision/Initiative integration packet) —
        // DELIBERATELY NARROW allow-list, not a blanket "system can do
        // anything" bypass. Originally just `GateType.START`
        // (`initiativeAutoStartJob`, SCHEDULED->EXECUTING). Now also allows
        // `GateType.UNBLOCK` (BLOCKED->EXECUTING) for exactly one caller:
        // `DecisionController.ts`'s post-commit cascade, which re-evaluates an
        // initiative's block state after a decision resolves. Rationale for
        // including UNBLOCK here rather than requiring a human
        // PROJECT_SPONSOR/STEERING_COMMITTEE role for this one automated path:
        // the actual safety gate — the GO/NO-GO decision-currency check
        // (`hasApprovedGateDecision` for GOVERNANCE_DECISION_MAKING, a few
        // lines below) — is NEVER skipped for system actors regardless of this
        // allow-list, exactly like the START case. Widening this allow-list
        // only removes the human-RBAC-role requirement for a cascade that is
        // itself gated by that same GO/NO-GO check; it does not weaken it.
        // There is still no human role lookup at all for a system actor (a
        // cascade/cron caller has no `req.user`/role to look up) — just this
        // hardcoded allow-list of two gates.
        const SYSTEM_ACTOR_ALLOWED_GATES: readonly string[] = [GateType.START, GateType.UNBLOCK];
        if (!SYSTEM_ACTOR_ALLOWED_GATES.includes(gate)) {
          return {
            kind: 'error',
            statusCode: 403,
            body: {
              error: 'System actor is not authorized for this gate',
              gate,
              from: currentStatus,
              to: nextStatus,
            },
          };
        }
        // Authorized — fall through without a human accessCtx/role lookup.
      } else if (gate) {
        // INI-04: the approval decision comes from the SAME matrix the two
        // gate-readiness read models use to render the CTA bar. Previously this
        // was a fourth hand-rolled copy of the rule, so a drift would have shown
        // the user a button that the writer then refused.
        // (accessCtx already resolved above, for the authorOnly check.)
        const accessCtx = humanAccessCtx;
        const steeringBoardEnabled = accessCtx.steeringBoardEnabled;
        const effectiveRequiredRoles = resolveGateRequiredRoles(gate, steeringBoardEnabled);

        const canExecute = canExecuteGate({
          gate,
          effectiveRoles: accessCtx.effectiveRoles,
          steeringBoardEnabled,
          conditionSatisfied: true,
        });

        if (!canExecute) {
          return {
            kind: 'error',
            statusCode: 403,
            body: {
              error: 'Permission denied for this status transition',
              gate,
              from: currentStatus,
              to: nextStatus,
              roles: accessCtx.effectiveRoles,
              requiredRoles: effectiveRequiredRoles,
            },
          };
        }
        if (
          gate === GateType.SUBMIT_FOR_REVIEW &&
          accessCtx.effectiveRoles.includes('CONSULTANT')
        ) {
          const createdBy = lockedRow.created_by ? String(lockedRow.created_by) : null;
          if (createdBy && actorId && createdBy !== String(actorId)) {
            return {
              kind: 'error',
              statusCode: 403,
              body: {
                error: 'Consultants can only submit initiatives they created',
                gate,
                from: currentStatus,
                to: nextStatus,
              },
            };
          }
        }
        if (gate === GateType.SEND_BACK && !reason) {
          return {
            kind: 'error',
            statusCode: 400,
            body: {
              error: 'Reason is required to send back an initiative',
              gate,
              from: currentStatus,
              to: nextStatus,
              requiresReason: true,
            },
          };
        }
      }

      // M13 Depth · Fala 1 — AI gate soft-block (advisory, per-org flag, fail-open).
      // Forward-progress gates only; flag OFF or any error → zero behavior change.
      // Below-threshold readiness OR a blocking timeline flag requires an explicit
      // `overrideReason` to proceed; every decision is recorded to telemetry.
      //
      // System-actor design decision (INI-005 fix, 2026-08-01): this soft-block
      // is SKIPPED for the system actor. Rationale: it's an advisory heuristic
      // whose only escape hatch is a human-authored `overrideReason` — that
      // doesn't translate to an unattended job (there's no human to author a
      // justification, and inventing one would be dishonest telemetry). By
      // contrast, readiness (`getBlockingReadinessItems`, below/unchanged) is a
      // hard data-completeness gate, not a judgment call, so it still applies
      // to the system actor — and the GO/NO-GO decision-currency check is
      // NEVER skipped for any actor, system included.
      if (gate && isAiGate(gate) && !isSystemActor) {
        try {
          if (await isInitiativeGateAiEnabled(orgId)) {
            const [aiReadiness, timeline] = await Promise.all([
              getGateReadiness(id, gate, orgId),
              getTimelineFlags(id, gate, orgId),
            ]);
            const timelineBlock = !!timeline?.flags?.some((f: any) => f.severity === 'block');
            const softBlocks = gateAiSoftBlocks({
              enabled: true,
              gate,
              aiReadiness,
              timeline,
            } as any);
            if (softBlocks && !overrideReasonTrimmed) {
              await recordGateAiEvent({
                organizationId: orgId,
                initiativeId: id,
                gate,
                score: aiReadiness?.score ?? null,
                timelineBlock,
                blocked: true,
                overridden: false,
                userId: actorId,
              });
              return {
                kind: 'error',
                statusCode: 422,
                body: {
                  error:
                    'Gate readiness is below threshold. Provide an overrideReason to proceed anyway.',
                  code: 'INITIATIVE_GATE_AI_SOFT_BLOCK',
                  gate,
                  from: currentStatus,
                  to: nextStatus,
                  aiReadiness,
                  timeline,
                },
              };
            }
            await recordGateAiEvent({
              organizationId: orgId,
              initiativeId: id,
              gate,
              score: aiReadiness?.score ?? null,
              timelineBlock,
              blocked: false,
              overridden: softBlocks,
              overrideReason: softBlocks ? overrideReasonTrimmed : null,
              userId: actorId,
            });
          }
        } catch (e: any) {
          logger.warn('[initiatives] gate-ai soft-block skipped (fail-open):', e?.message);
        }
      }

      // V4-INIT-01: Gate readiness blocking — block transition if blocking items exist.
      // CANCELLED bypasses readiness (same as gate bypass above).
      const blockingItems =
        nextStatus === InitiativeStatus.REJECTED ? [] : await getBlockingReadinessItems(orgId, id);
      if (blockingItems.length > 0) {
        return {
          kind: 'error',
          statusCode: 400,
          body: {
            error:
              'Gate readiness check failed. Complete missing requirements before transitioning.',
            rule: 'GATE_BLOCKED',
            gate_blocked: true,
            missing: blockingItems,
            from: currentStatus,
            to: nextStatus,
          },
          notify: {
            type: 'initiative.gate_blocked',
            title: 'Initiative gate blocked',
            body: `${initiativeName}: ${blockingItems[0]?.label || 'Readiness check failed'}.`,
            priority: 'high',
            metadata: { currentStatus, nextStatus, missing: blockingItems },
          },
        };
      }

      // ══════════════════════════════════════════════════════════════════════
      // BRAMKI DECYZYJNE — H1d: KLUCZOWANE BRAMKĄ Z MACIERZY, NIE LITERAŁEM KODU
      // ══════════════════════════════════════════════════════════════════════
      //
      // CO BYŁO ZEPSUTE (zmierzone na realnym Postgresie, test
      // `h1d-start-execution-go-gate.pg.test.ts`, wariant A):
      // ten blok składał się z siedmiu warunków pisanych STARYM słownikiem
      // runtime — `currentStatus === 'REVIEW' && nextStatus === 'PROMOTED'`,
      // `'PROMOTED'→'PLANNING'`, `'APPROVED'→'SCHEDULED'`,
      // `('SCHEDULED'|'BLOCKED')→'EXECUTING'`, `'EXECUTING'→'DONE'`,
      // `nextStatus === 'BLOCKED'`, `'DONE'→'TRACKING'`. Od migracji
      // `20262103_p12_initiative_status_slownik.sql` kolumna `initiatives.status`
      // nie może zawierać ŻADNEGO z tych kodów (CHECK `initiatives_status_check_p12`
      // dopuszcza siedem: PROPOSED · DRAFT · PENDING_APPROVAL · APPROVED ·
      // IN_EXECUTION · CLOSED · REJECTED), a `currentStatus`/`nextStatus` są
      // w tym miejscu JUŻ znormalizowane do tych siedmiu. Żaden z siedmiu
      // warunków nie mógł być prawdziwy — cała egzekucja H16/INI-005 („decyzja
      // GO musi być aktualna w momencie startu realizacji") była martwa, a start
      // realizacji przechodził BEZ ani jednego wiersza w
      // `initiative_lifecycle_gate_decisions`.
      //
      // DLACZEGO BRAMKA, A NIE ETAP: `gate` pochodzi z
      // `INITIATIVE_TRANSITION_MATRIX` (jedno źródło, to samo, z którego UI
      // rysuje przyciski), więc nie da się go rozjechać ze słownikiem kolumny
      // tak, jak rozjechał się literał. Etap silnika (12, DEC-490) jest potrzebny
      // tam, gdzie DWA etapy mapują się na jeden kod — a to nie zdarza się
      // w żadnej z trzech bramek decyzyjnych poniżej (START i COMPLETE są 1:1,
      // APPROVE prowadzi do jedynego kodu APPROVED).
      //
      // CO ZNIKŁO RAZEM ZE STARYMI WARUNKAMI (świadomie, nie przez przeoczenie):
      //  · `'PROMOTED'→'PLANNING'` (decyzja RESOURCE_RESPONSIBILITY) — po P12
      //    macierz nie ma przejścia, do którego dałoby się tę bramkę przypiąć:
      //    oba etapy kolapsują na kod PENDING_APPROVAL. Bramka wymaga decyzji
      //    właściciela (patrz raport H1d), nie cichego przywrócenia.
      //  · `'APPROVED'→'SCHEDULED'` (decyzja SCHEDULE_MILESTONES + daty +
      //    kamienie milowe + snapshot `initiative_schedule_baselines`) — to
      //    przejście zmienia WYŁĄCZNIE etap silnika (APPROVED_BACKLOG→SCHEDULED,
      //    kod kolumny w obu przypadkach APPROVED), więc `isValidTransition`
      //    odrzuca je zanim ten blok zdąży się wykonać. Żywym właścicielem tej
      //    ścieżki jest `domain/initiatives-execution/scheduleDecision.ts`
      //    (pisze `lifecycleState: 'SCHEDULED'` do agregatu). Kopia tutaj była
      //    duplikatem, i to nieosiągalnym.
      //  · `nextStatus === 'BLOCKED'` i `'DONE'→'TRACKING'` — BLOCKED to od
      //    DEC-424 flaga `on_hold` (ścieżka `flagOperation` wyżej, kończy się
      //    `return` przed tym blokiem), a TRACKING nie jest kodem kolumny.
      //
      let satisfyingDecisionId: string | null = null;
      // Zapamiętuje domenę, która bramkę zaspokoiła, żeby przedcommitowa
      // kontrola (tuż przed ścieżką zapisu) wiedziała, którą krotkę zweryfikować
      // ponownie wobec równoległego zapisu decyzji. Patrz `TransitionGateSupersededError`.
      let decisionGatePmoDomain: string | null = null;

      /**
       * Jedno miejsce na „bramka wymaga AKTUALNEJ, zatwierdzonej decyzji domeny X".
       * Zwraca opis odmowy albo `null`; przy powodzeniu pina decyzję do
       * przedcommitowej kontroli.
       */
      const requireCurrentGateDecision = async (
        pmoDomain: string,
        refusal: { error: string; rule: string; notifyBody: string }
      ): Promise<TransitionOutcome | null> => {
        const decision = await hasApprovedGateDecision(orgId, id, pmoDomain, client);
        if (!decision.ok) {
          return {
            kind: 'error',
            // 409, nie 400: żądanie jest poprawne, a odmowa wynika ze STANU
            // rządzenia (brak decyzji / decyzja nieaktualna lub wygasła) —
            // to konflikt, nie błąd składni wejścia.
            statusCode: 409,
            body: {
              error: refusal.error,
              rule: refusal.rule,
              gate: pmoDomain,
              from: currentStatus,
              to: nextStatus,
            },
            notify: {
              type: 'initiative.gate_blocked',
              title: 'Initiative gate blocked',
              body: `${initiativeName}: ${refusal.notifyBody}`,
              priority: 'high',
              metadata: { currentStatus, nextStatus, gate: pmoDomain },
            },
          };
        }
        satisfyingDecisionId = decision.decisionId;
        decisionGatePmoDomain = pmoDomain;
        await syncHook('after-decision-read');
        return null;
      };

      // APPROVE (PENDING_APPROVAL → APPROVED): decyzja GO/NO-GO.
      // Warunek `CURRENT_GO_DECISION` sprawdził ją już wyżej (wspólny moduł
      // warunków, ten sam, którego używa preflight) — tutaj PINUJEMY jej
      // identyfikator, żeby przedcommitowa kontrola wykryła podmianę decyzji
      // w trakcie przejścia. Bez tego pinu ochrona przed wyścigiem (H16)
      // obejmowała START i COMPLETE, ale nie APPROVE.
      if (gate === GateType.APPROVE) {
        const refusal = await requireCurrentGateDecision('GOVERNANCE_DECISION_MAKING', {
          error: 'A current Go/No-Go decision is required to approve this initiative',
          rule: 'GATE_DECISION_REQUIRED',
          notifyBody: 'a current Go/No-Go decision is required to approve.',
        });
        if (refusal) return refusal;
      }

      // ★ START (APPROVED → IN_EXECUTION): SEDNO NAPRAWY H1d.
      // To jest bramka H16/INI-005 — „decyzja GO musi być aktualna w momencie
      // startu realizacji". Dotyczy KAŻDEGO wołacza tej samej funkcji:
      // `POST /:id/start-execution`, `PATCH /:id/status`, cron
      // `initiativeAutoStartJob` (aktor systemowy NIE omija tej kontroli —
      // lista dozwolonych bramek zdejmuje z niego tylko wymóg roli ludzkiej).
      //
      // ★★ DECYZJA CTO (integracja fala B3, 14.09) — TA BRAMKA IDZIE ZA FLAGĄ
      // SERWEROWĄ `ENABLE_LIFECYCLE_GO_GATE`, DOMYŚLNIE WYŁĄCZONĄ. Powód nie
      // jest kosmetyczny, jest mierzalny:
      //  · wiersz macierzy APPROVED→IN_EXECUTION ma warunek
      //    `HANDOFF_AND_START_DATE`, a NIE `CURRENT_GO_DECISION`, więc
      //    `initiativeTransitionPreflightService` (jedyne źródło, z którego UI
      //    rysuje dostępność przycisku) nadal raportuje to przejście jako
      //    DOZWOLONE. Bez flagi przycisk byłby aktywny, a serwer odpowiadałby
      //    409 — rozjazd UI↔serwer, nie bramka.
      //  · JEDYNYM kodem zapisującym decyzję GOVERNANCE_DECISION_MAKING dla
      //    inicjatywy jest trasa `POST /:id/lifecycle-gate-decisions` oraz
      //    adapter Teresy; zmierzone `git grep 'lifecycle-gate-decisions' -- src`
      //    = 0 trafień, a schemat trasy wymaga `sourceDigest` (SHA-256),
      //    `a05ProposalVersionId` i `a05ApprovalReceiptRef` — prowenancji,
      //    której człowiek nie wpisze z ręki. Ludzka ścieżka zapisu tej decyzji
      //    powstaje dopiero ze skrzynką recenzenta (H1b, `VITE_TRANSITION_INBOX`,
      //    też OFF).
      // Włączenie bramki przy OFF-owej skrzynce dałoby kształt „zamknięte przez
      // wygaszenie": start realizacji odmawiany WSZYSTKIM, bez ścieżki naprawy.
      // Flagę włączamy dopiero razem ze skrzynką (i po dopisaniu warunku
      // `CURRENT_GO_DECISION` do wiersza START macierzy, żeby preflight mówił
      // to samo co writer).
      if (gate === GateType.START && isLifecycleGoGateEnabled()) {
        const refusal = await requireCurrentGateDecision('GOVERNANCE_DECISION_MAKING', {
          error: 'A current Go/No-Go decision is required to start execution of this initiative',
          rule: 'GATE_DECISION_REQUIRED',
          notifyBody: 'a current Go/No-Go decision is required to start execution.',
        });
        if (refusal) return refusal;
      }

      // COMPLETE (IN_EXECUTION → CLOSED): decyzja CLOSURE + zerowa otwarta praca.
      // Warunek macierzy `NO_OPEN_WORK` liczy otwarte ZADANIA i wiszące decyzje
      // wykonawcze; kamieni milowych nie liczy, a decyzji CLOSURE nie sprawdza
      // wcale — te dwie kontrole żyły wyłącznie w martwym warunku
      // `'EXECUTING'→'DONE'` i razem z nim przestały działać.
      //
      // ★ DECYZJA CTO (H1d) — CZEGO TU CELOWO NIE MA: martwa gałąź
      // `'EXECUTING'→'DONE'` wymagała też AKTUALNEJ decyzji `CLOSURE`
      // w `initiative_lifecycle_gate_decisions`. Przywrócenie tego wymogu
      // ZAMKNĘŁOBY domknięcie dla wszystkich: jedynym kodem, który taką decyzję
      // zapisuje, jest adapter Teresy
      // (`transformationInitiativeTransitionAdapterService`), a ludzka ścieżka
      // domknięcia (`initiativeClosureService`: pakiet dowodowy + role
      // zatwierdzające + warunek `NO_OPEN_WORK`) nie tworzy go wcale i nigdy
      // nie tworzyła — zmierzone: `rg recordInitiativeLifecycleGateDecision
      // server/src/services/initiative/initiativeClosureService.ts` = 0 trafień.
      // Wymóg dałby więc 409 na KAŻDYM ludzkim domknięciu — dokładnie kształt
      // „zamknięte przez wygaszenie". Zostaje kontrola KOMPLETNOŚCI PRACY, bo
      // ona nie zależy od artefaktu, którego nikt nie produkuje.
      // ★★ TA SAMA FLAGA `ENABLE_LIFECYCLE_GO_GATE` (integracja fala B3, 14.09).
      // Powód: liczenie KAMIENI MILOWYCH jest tu NOWE — warunek macierzy
      // `NO_OPEN_WORK`, żywy i na linii, liczy otwarte ZADANIA i wiszące decyzje
      // wykonawcze, ale kamieni milowych nie liczył nigdy. Przy fladze OFF
      // domknięcie zachowuje się DOKŁADNIE jak na linii (zadania dalej pilnuje
      // `NO_OPEN_WORK`), więc wdrożenie nie wnosi ANI JEDNEJ nowej odmowy.
      // Dodatkowy powód, żeby nie puszczać tego bez flagi: kod odmowy
      // `CLOSURE_WORK_INCOMPLETE` nie ma wpisu w `initiativeLifecycleMessages`
      // (zmierzone), więc użytkownik zobaczyłby surowy angielski komunikat
      // serwera. Włączamy razem z bramką GO, po dopisaniu tłumaczenia.
      if (gate === GateType.COMPLETE && isLifecycleGoGateEnabled()) {
        // Predykat kompletności zostaje na TEJ przypiętej transakcji, a istniejące
        // wiersze potomne są blokowane przed policzeniem. Błąd zapytania/schematu
        // propaguje się — domknięcie ma padać zamknięte, a nie uznawać
        // nieczytelnej pracy za skończoną.
        await client.query(
          `SELECT id FROM tasks
           WHERE initiative_id=? AND organization_id=?
           FOR SHARE`,
          [id, orgId]
        );
        await client.query(
          `SELECT id FROM initiative_milestones
           WHERE initiative_id=? AND organization_id=?
           FOR SHARE`,
          [id, orgId]
        );
        const incomplete = (
          await client.query<{ open_tasks: number; open_milestones: number }>(
            `SELECT
               (SELECT COUNT(*)::int FROM tasks
                 WHERE initiative_id=? AND organization_id=?
                   AND UPPER(COALESCE(status,'')) NOT IN ('DONE','COMPLETED')) AS open_tasks,
               (SELECT COUNT(*)::int FROM initiative_milestones
                 WHERE initiative_id=? AND organization_id=?
                   AND UPPER(COALESCE(status,'')) <> 'COMPLETED') AS open_milestones`,
            [id, orgId, id, orgId]
          )
        ).rows[0];
        if (
          Number(incomplete?.open_tasks || 0) > 0 ||
          Number(incomplete?.open_milestones || 0) > 0
        ) {
          return {
            kind: 'error',
            statusCode: 400,
            body: {
              error: 'All Initiative tasks and milestones must be complete before closure',
              rule: 'CLOSURE_WORK_INCOMPLETE',
              openTasks: Number(incomplete?.open_tasks || 0),
              openMilestones: Number(incomplete?.open_milestones || 0),
            },
          };
        }
      }
      // Pre-commit defense in depth. The canonical decision owner already uses
      // the same advisory lock as this read, so a new version cannot commit
      // concurrently. Rechecking the exact immutable decision id also protects
      // callers if this function is ever invoked with a non-conforming client.
      if (satisfyingDecisionId && decisionGatePmoDomain) {
        const recheck = await hasApprovedGateDecision(orgId, id, decisionGatePmoDomain, client);
        if (!recheck.ok || recheck.decisionId !== satisfyingDecisionId) {
          throw new TransitionGateSupersededError(
            gate ?? decisionGatePmoDomain,
            decisionGatePmoDomain
          );
        }
      }
      await syncHook('before-commit');

      // ---- WRITE PATH (atomic from here on: state UPDATE + both history INSERTs) ----
      const now = new Date().toISOString();
      const lifecycleUpdates: string[] = ['status = ?', 'updated_at = ?'];
      const lifecycleParams: unknown[] = [nextStatus, now];

      // DEC-539: the twelve-stage column is now the product truth. A rejected
      // initiative is a disposition, so it keeps the stage at which it died.
      if (nextStage !== null) {
        pushOptionalColumnUpdate(
          lifecycleUpdates,
          lifecycleParams,
          initiativeColumns,
          'lifecycle_stage',
          nextStage
        );
        pushOptionalColumnUpdate(
          lifecycleUpdates,
          lifecycleParams,
          initiativeColumns,
          'lifecycle_stage_source',
          'writer'
        );
      }

      // H1d: kod 'PENDING_REVIEW' nie istnieje w słowniku siedmiu (CHECK P12);
      // prośba o recenzję to dziś PENDING_APPROVAL. UWAGA DO RAPORTU: na bazie
      // po `strict migrate` kolumn `review_requested_at`/`review_requested_by`
      // NIE MA, więc `pushOptionalColumnUpdate` je pominie — poprawka czyni kod
      // prawdziwym, ale sama nie tworzy kolumny (migracje poza zakresem H1d).
      if (nextStatus === InitiativeStatus.PENDING_APPROVAL) {
        pushOptionalColumnUpdate(
          lifecycleUpdates,
          lifecycleParams,
          initiativeColumns,
          'review_requested_at',
          now
        );
        pushOptionalColumnUpdate(
          lifecycleUpdates,
          lifecycleParams,
          initiativeColumns,
          'review_requested_by',
          actorId || null
        );
      }
      if (nextStatus === 'APPROVED') {
        pushOptionalColumnUpdate(
          lifecycleUpdates,
          lifecycleParams,
          initiativeColumns,
          'approved_at',
          now
        );
        pushOptionalColumnUpdate(
          lifecycleUpdates,
          lifecycleParams,
          initiativeColumns,
          'approved_by',
          actorId || null
        );
        if (reason) {
          pushOptionalColumnUpdate(
            lifecycleUpdates,
            lifecycleParams,
            initiativeColumns,
            'approval_comment',
            reason
          );
        }
      }
      // ── STEMPLE CZASOWE — H1d: KODY Z SIEDMIOSŁOWNIKA, NIE ZE STAREGO ──────
      //
      // Każdy z pięciu warunków niżej porównywał `nextStatus` ze STARYM
      // słownikiem runtime ('SCHEDULED' · 'EXECUTING' · 'BLOCKED' · 'DONE' ·
      // 'CANCELLED' · 'ARCHIVED'), którego CHECK `initiatives_status_check_p12`
      // nie dopuszcza. Skutek zmierzony na realnym Postgresie: `execution_started_at`
      // NIGDY nie było ustawiane (INI-005), `done_at`/`completed_at` też nie.
      // Warunki dotyczące BLOCKED/ARCHIVED usunięte, bo od DEC-424 to FLAGI
      // (`on_hold`/`archived`), obsługiwane w ścieżce `flagOperation`, która
      // kończy się `return` daleko przed tym miejscem.
      //
      // ★ INI-005: `execution_started_at` stemplowane przy WEJŚCIU w IN_EXECUTION.
      // Dawne wykluczenie „nie resetuj przy wznowieniu z BLOCKED" zostaje
      // zachowane co do sensu, ale wyrażone stanem docelowym: wejście liczy się
      // tylko wtedy, gdy inicjatywa NIE była już w realizacji.
      if (nextStatus === InitiativeStatus.IN_EXECUTION && currentStatus !== InitiativeStatus.IN_EXECUTION) {
        pushOptionalColumnUpdate(
          lifecycleUpdates,
          lifecycleParams,
          initiativeColumns,
          'execution_started_at',
          now
        );
      }
      if (nextStatus === InitiativeStatus.CLOSED) {
        pushOptionalColumnUpdate(
          lifecycleUpdates,
          lifecycleParams,
          initiativeColumns,
          'done_at',
          now
        );
        pushOptionalColumnUpdate(
          lifecycleUpdates,
          lifecycleParams,
          initiativeColumns,
          'done_by',
          actorId || null
        );
        pushOptionalColumnUpdate(
          lifecycleUpdates,
          lifecycleParams,
          initiativeColumns,
          'completed_at',
          now
        );
      }
      if (nextStatus === InitiativeStatus.REJECTED) {
        pushOptionalColumnUpdate(
          lifecycleUpdates,
          lifecycleParams,
          initiativeColumns,
          'cancelled_at',
          now
        );
        pushOptionalColumnUpdate(
          lifecycleUpdates,
          lifecycleParams,
          initiativeColumns,
          'cancelled_reason',
          reason || null
        );
      }
      if (
        actorId &&
        (process.env.DB_TYPE || '').toLowerCase() !== 'postgres' &&
        initiativeColumns.has('updated_by')
      ) {
        lifecycleUpdates.push('updated_by = ?');
        lifecycleParams.push(actorId);
      }

      lifecycleParams.push(id, orgId);
      await client.query(
        `UPDATE initiatives SET ${lifecycleUpdates.join(', ')} WHERE id = ? AND organization_id = ?`,
        lifecycleParams
      );

      // ---- H1c / DEC-506: ETAP SILNIKA (12) DO AGREGATU, W TEJ SAMEJ TRANSAKCJI ----
      //
      // Kolumna `initiatives.status` niesie SIEDEM kodów i nie ma jak odróżnić
      // APPROVED_BACKLOG od SCHEDULED ani DELIVERED od CLOSED. Dwunastostopniowa
      // prawda DEC-490 mieszka więc tam, gdzie już dziś mieszka —
      // `ie_aggregate_state` (`aggregate_type='initiative'`, klucz
      // `payload_json.lifecycleState`), zapisywana przez `registerInitiative`
      // i czytana przez `initiativeUnifiedReader`.
      //
      // W TEJ SAMEJ TRANSAKCJI — celowo. Gdyby etap lądował po COMMIT-cie, każdy
      // błąd między zapisami zostawiałby kolumnę i agregat w rozjeździe, czyli
      // dokładnie stan, który H1c ma zlikwidować. `||` scala z istniejącym
      // payloadem, więc nie kasujemy pól, których ta ścieżka nie zna.
      // H1d: DYSPOZYCJA (REJECTED/CANCELLED) nie ma etapu — `nextStage` jest
      // wtedy `null` i agregatu NIE dotykamy. Inicjatywa odrzucona zachowuje
      // etap, na którym umarła; nadpisanie go `CLOSED` kłamałoby, że przeszła
      // całą ścieżkę realizacji (canon §5.3: odrzucenie to dyspozycja, nie etap).
      await writeInitiativeAggregateLifecycleStage(client, {
        organizationId: orgId,
        initiativeId: id,
        lifecycleStage: nextStage,
      });

      // H1d — USUNIĘTE: domyślne okno śledzenia korzyści przy 'DONE'→'TRACKING'.
      // Ani 'DONE', ani 'TRACKING' nie są kodami kolumny po P12 (CHECK
      // `initiatives_status_check_p12`), a `BENEFITS_TRACKING` jest ETAPEM silnika,
      // który mapuje się na ten sam kod `CLOSED` co `DELIVERED` i `CLOSED` —
      // przejście nie przechodzi więc przez `isValidTransition` i ten kod był
      // nieosiągalny. Kolumny `tracking_*` zostają nietknięte; właścicielem
      // otwierania okna korzyści musi zostać ścieżka etapowa (patrz raport H1d,
      // decyzja do właściciela). Nic tu nie zostało „po cichu wyłączone" — ta
      // gałąź nie wykonała się ani razu od migracji P12.

      // Audit trail — ONE correlationId shared by both rows. It IS the
      // initiative_status_history primary key, and is also embedded in
      // initiative_history's `notes` JSON (which already carried a JSON blob —
      // no migration needed to link the two rows losslessly). Any failure here
      // rolls back the WHOLE transition: the state must not change if the audit
      // trail doesn't (previously these were two independent best-effort
      // try/catch INSERTs that could silently no-op after the state UPDATE had
      // already committed).
      const correlationId = uuidv4();

      const statusHistoryColumns = getColumnNameSet(
        await queryHelpers.getTableColumns('initiative_status_history')
      );
      const statusHistoryCols = [
        'id',
        'initiative_id',
        'organization_id',
        'from_status',
        'to_status',
      ];
      const statusHistoryVals: unknown[] = [correlationId, id, orgId, currentStatus, nextStatus];
      if (statusHistoryColumns.has('changed_by')) {
        statusHistoryCols.push('changed_by');
        statusHistoryVals.push(actorId || null);
      }
      if (statusHistoryColumns.has('reason')) {
        statusHistoryCols.push('reason');
        statusHistoryVals.push(reason || null);
      }
      if (statusHistoryColumns.has('gate_type')) {
        statusHistoryCols.push('gate_type');
        statusHistoryVals.push(gate || null);
      }
      if (statusHistoryColumns.has('created_at')) {
        statusHistoryCols.push('created_at');
        statusHistoryVals.push(now);
      }
      await client.query(
        `INSERT INTO initiative_status_history (${statusHistoryCols.join(', ')}) VALUES (${statusHistoryCols
          .map(() => '?')
          .join(', ')})`,
        statusHistoryVals
      );

      const historyColumns = getColumnNameSet(
        await queryHelpers.getTableColumns('initiative_history')
      );
      const histId = uuidv4();
      const historyNotes = JSON.stringify({
        actorName: actorName || null,
        from: currentStatus,
        to: nextStatus,
        reason: reason || null,
        gate: gate || null,
        correlationId,
        decisionId: satisfyingDecisionId,
      });
      const historyCols = ['id', 'initiative_id', 'action'];
      const historyVals: unknown[] = [histId, id, 'status_changed'];
      if (historyColumns.has('changed_by')) {
        historyCols.push('changed_by');
        historyVals.push(actorId || 'system');
      }
      if (historyColumns.has('changed_at')) {
        historyCols.push('changed_at');
        historyVals.push(now);
      }
      if (historyColumns.has('notes')) {
        historyCols.push('notes');
        historyVals.push(historyNotes);
      }
      await client.query(
        `INSERT INTO initiative_history (${historyCols.join(', ')}) VALUES (${historyCols
          .map(() => '?')
          .join(', ')})`,
        historyVals
      );

      // EXE-09 — durable closure→Results/Finance delivery receipt, written
      // atomically in THIS SAME transaction (same `client`, same
      // `correlationId` as the audit rows above) so a closure can never commit
      // without a receipt to track its downstream delivery. Replaces the old
      // purely-fire-and-forget `fireClosureHandoff` call below with a durable
      // row; the actual delivery attempt still happens outside this
      // transaction (see the post-commit trigger below), but its durable
      // bookkeeping does not depend on that attempt ever running.
      if (currentStatus !== InitiativeStatus.CLOSED && nextStatus === InitiativeStatus.CLOSED) {
        await createReceiptOnClosure(client, {
          organizationId: orgId,
          initiativeId: id,
          correlationId,
          actorId: actorId || null,
        });
      }

      return {
        kind: 'success',
        currentStatus,
        nextStatus,
        gate: gate || null,
        correlationId,
        initiativeName,
      };
    };
    outcome = params.transactionClient
      ? await transitionBody(params.transactionClient)
      : await queryHelpers.withPgTransaction(transitionBody);
  } catch (err) {
    if (err instanceof TransitionGateSupersededError) {
      return {
        ok: false,
        statusCode: 409,
        body: {
          error:
            'The gate decision required for this transition was superseded by a newer decision while it was being processed. Re-check the gate and retry.',
          rule: 'GATE_DECISION_SUPERSEDED',
          gate: err.gate,
          pmoDomain: err.pmoDomain,
        },
      };
    }
    throw err;
  }

  if (outcome.kind === 'error') {
    if (outcome.notify) {
      const notify = outcome.notify;
      try {
        const recipients = await getInitiativeNotificationRecipients(orgId, id);
        await Promise.allSettled(
          recipients
            .filter((uid) => uid && uid !== actorId)
            .map((userId) =>
              notificationService.send({
                userId,
                organizationId: orgId,
                type: notify.type,
                title: notify.title,
                body: notify.body,
                entityType: 'initiative',
                entityId: id,
                actionUrl: '/initiatives',
                actorId,
                actorName,
                priority: notify.priority,
                metadata: notify.metadata,
              })
            )
        );
      } catch {
        /* best-effort */
      }
    }
    return { ok: false, statusCode: outcome.statusCode, body: outcome.body };
  }

  // NOTE: `nextStatus` is intentionally NOT re-destructured here — it's already in
  // scope from the coercion step above and `outcome.nextStatus` always equals it.
  const { currentStatus, gate, correlationId, initiativeName } = outcome;

  // ---- Non-critical side effects (best-effort, deliberately OUTSIDE the transaction —
  // the row lock is already released by the time we get here) ----
  const runPostCommitEffects = async (): Promise<void> => {

  // Uspójnienie F2.2–2.5/2.7 — record the stage-boundary handoff (event + lineage)
  // on every successful status transition. Fail-safe (never throws/blocks).
  void recordStageHandoff(orgId, id, currentStatus, nextStatus, actorId);

  // EXE-09 — best-effort IMMEDIATE delivery attempt for the receipt row
  // already committed atomically inside the transaction above. Unlike the
  // old `fireClosureHandoff` (fire-and-forget with nothing durable behind
  // it), a failure or a process crash right here loses nothing: the
  // receipt already exists in PENDING state and
  // `runReconciliationSweep`/its cron (server/src/index.ts) will pick it up
  // and retry independently of whether this call ever ran. Still
  // non-blocking by design — callers must not wait on downstream delivery
  // to get a response to the status change itself.
  if (currentStatus !== InitiativeStatus.CLOSED && nextStatus === InitiativeStatus.CLOSED) {
    triggerImmediateDeliveryBestEffort(correlationId);
  }

  // Emit notifications (best-effort)
  try {
    const recipients = await getInitiativeNotificationRecipients(orgId, id);
    // H1d: „zmiana modułu" liczona przez `getModuleForStatus` (SSOT z
    // `initiativeStatuses`), a nie przez trzy pary starych kodów, z których
    // ŻADNA nie mogła być prawdziwa po P12 — powiadomienie o przeniesieniu
    // między modułami nie wysyłało się nigdy.
    const isModuleChange = willChangeModule(currentStatus as any, nextStatus as any);

    // 1. General status change notification to all stakeholders.
    // M13/R4: this is the SINGLE canonical status-change notification.
    // A → BLOCKED transition is escalated to CRITICAL and carries the
    // blocker reason (replaces the removed dedicated R4 emitter).
    const statusSeverity: 'INFO' | 'WARNING' | 'CRITICAL' =
      nextStatus === InitiativeStatus.REJECTED ? 'WARNING' : 'INFO';
    const statusTitle = isModuleChange
      ? 'Initiative moved to new module'
      : 'Initiative status changed';
    await Promise.allSettled(
      recipients
        .filter((uid) => uid && uid !== actorId)
        .map((userId) =>
          notificationService.send({
            userId,
            organizationId: orgId,
            type: isModuleChange ? 'initiative.module_changed' : 'initiative.status_changed',
            title: statusTitle,
            body: `${initiativeName}: ${currentStatus} → ${nextStatus}${reason ? ` (${reason})` : ''}`,
            entityType: 'initiative',
            entityId: id,
            actionUrl: '/initiatives',
            actorId,
            actorName,
            severity: statusSeverity,
            priority: nextStatus === InitiativeStatus.REJECTED ? 'high' : 'normal',
            metadata: { from: currentStatus, to: nextStatus, reason, gate },
          })
        )
    );

    // 2. Gate-specific notification: notify users who hold the gate role for the NEXT gate
    // This tells the approver "this initiative is now waiting for your decision"
    try {
      const nextTransitions = VALID_TRANSITIONS[nextStatus as keyof typeof VALID_TRANSITIONS] || [];
      const nextGates = nextTransitions
        .map((to: string) => getGateForTransition(nextStatus as any, to as any))
        .filter(Boolean)
        .filter((g: any) => g !== 'CANCEL'); // Don't notify for cancel gate

      if (nextGates.length > 0) {
        // Get gate role assignments for this initiative
        let gateRoleUsers: Array<{ gateRole: string; userId: string }> = [];
        try {
          const rows = await queryHelpers.queryAll(
            `SELECT gate_role as "gateRole", user_id as "userId"
             FROM initiative_gate_roles WHERE initiative_id = ?`,
            [id]
          );
          gateRoleUsers = rows as any[];
        } catch {
          // Table may not exist yet
        }

        // Add auto-derived roles
        const ini = await queryHelpers.queryOne(
          `SELECT owner_business_id, owner_execution_id, sponsor_id FROM initiatives WHERE id = ?`,
          [id]
        );
        if (ini) {
          const iniAny = ini as any;
          if (iniAny.owner_business_id) {
            gateRoleUsers.push({
              gateRole: 'INITIATIVE_OWNER',
              userId: iniAny.owner_business_id,
            });
            gateRoleUsers.push({
              gateRole: 'BUSINESS_OWNER',
              userId: iniAny.owner_business_id,
            });
          }
          if (iniAny.owner_execution_id) {
            gateRoleUsers.push({
              gateRole: 'INITIATIVE_OWNER',
              userId: iniAny.owner_execution_id,
            });
          }
          if (iniAny.sponsor_id) {
            gateRoleUsers.push({ gateRole: 'PROJECT_SPONSOR', userId: iniAny.sponsor_id });
          }
        }

        // Find users who need to approve the next gate
        const nextGateApprovers = new Set<string>();
        for (const nextGate of nextGates) {
          const requiredRoles = GATE_PERMISSIONS[nextGate as keyof typeof GATE_PERMISSIONS] || [];
          for (const roleUser of gateRoleUsers) {
            if (requiredRoles.includes(roleUser.gateRole as any) && roleUser.userId !== actorId) {
              nextGateApprovers.add(roleUser.userId);
            }
          }
        }

        // Send targeted "gate ready for your action" notifications
        const nextGateLabel = nextGates[0] || 'NEXT_GATE';
        await Promise.allSettled(
          Array.from(nextGateApprovers).map((userId) =>
            notificationService.send({
              userId,
              organizationId: orgId,
              type: 'initiative.gate_action_required',
              title: 'Gate action required',
              body: `${initiativeName} is now in ${nextStatus} and requires your gate decision (${nextGateLabel})`,
              entityType: 'initiative',
              entityId: id,
              actionUrl: '/initiatives',
              actorId,
              actorName,
              priority: 'high',
              isActionable: true,
              metadata: {
                from: currentStatus,
                to: nextStatus,
                nextGate: nextGateLabel,
                previousGate: gate,
              },
            })
          )
        );
      }
    } catch {
      // best-effort — gate notifications are nice-to-have
    }
  } catch {
    // best-effort
  }

  try {
    await auditEventsService.log({
      actorId,
      actorType: isSystemActor ? 'SYSTEM' : 'USER',
      action: 'initiative.status_changed',
      resourceType: 'initiative',
      resourceId: id,
      before: { status: currentStatus },
      after: { status: nextStatus },
      metadata: { gate: gate || null, reason: reason || null, correlationId },
      organizationId: orgId,
      ip: requestIp || undefined,
      userAgent: requestUserAgent || undefined,
    });
  } catch {
    /* best-effort audit */
  }
  };

  if (params.deferPostCommitEffect) params.deferPostCommitEffect(runPostCommitEffects);
  else await runPostCommitEffects();

  return { ok: true, id, status: nextStatus, previousStatus: currentStatus, gate, correlationId };
}

// ==========================================
// DECISION-DRIVEN BLOCK (narrow canonical entry point)
// ==========================================

export type DecisionBlockTransitionResult =
  | {
      ok: true;
      id: string;
      status: string;
      previousStatus: string;
      alreadyBlocked: boolean;
      correlationId: string | null;
    }
  | { ok: false; statusCode: number; body: Record<string, unknown> };

export interface ApplyDecisionBlockTransitionParams {
  orgId: string;
  initiativeId: string;
  decisionId: string;
  reason?: string | null;
}

/**
 * Statuses a Decision-driven block must NEVER move an initiative INTO/past —
 * checked case-insensitively against a small EXPLICIT set, not a single
 * `===`/`isTerminalStatus` comparison (2026-08-01 Codex review: "Nie opieraj
 * ochrony tylko na lowercase/uppercase jednego statusu"). `isTerminalStatus`
 * (the canon's own terminal check) only covers CANCELLED/ARCHIVED — it does
 * NOT include DONE. 'COMPLETED' is a legacy synonym for DONE that some
 * non-canonical write paths still persist (`normalizeInitiativeDbStatusForRead`
 * already maps it to DONE — this set is additional, explicit defense, not a
 * replacement for that normalization). Checked in combination with
 * `isTerminalStatus` below for defense in depth: if the canon ever grows a
 * new terminal status, it is protected here automatically too.
 */
const DECISION_BLOCK_TERMINAL_OR_DONE_STATUSES = new Set<string>([
  'DONE',
  'COMPLETED',
  'CANCELLED',
  'ARCHIVED',
]);

/**
 * Stable, honest, non-human-impersonating actor identity for the
 * Decision-driven BLOCK cascade below — parallel to
 * `initiativeAutoStartJob.ts`'s `SYSTEM_ACTOR_ID` and to
 * `DecisionController.ts`'s `DECISION_UNBLOCK_SYSTEM_ACTOR_ID`
 * (`system:decision-driven-unblock`, the UNBLOCK-side mirror of this
 * constant).
 */
export const DECISION_BLOCK_SYSTEM_ACTOR_ID = 'system:decision-driven-block';

/**
 * NARROW canonical entry point for exactly ONE mutation: "a Decision impact
 * marks an Initiative as a blocker" -> the Initiative's `on_hold` flag flips
 * true (DEC-424/P12: blocking is a FLAG on IN_EXECUTION, never a separate
 * status — see `INITIATIVE_FLAG_RULES.HOLD` in `constants/initiativeStatuses.ts`
 * and the SSOT doc's "on_hold ustawia i zdejmuje ta sama ścieżka co dziś
 * BLOCK/UNBLOCK").
 *
 * WHY NOT `executeInitiativeTransition`'s general `flagOperation: 'HOLD'`
 * path: that path enforces normal human RBAC
 * (`GATE_PERMISSIONS`/`INITIATIVE_FLAG_RULES.HOLD.roles` =
 * `[Role.INITIATIVE_OWNER, Role.PMO]`). This is a SYSTEM-actor cascade
 * (`DECISION_BLOCK_SYSTEM_ACTOR_ID`) triggered by a Decision's own
 * `is_blocker` impact, not a human clicking "Block" — widening the human
 * gate's RBAC to also accept a decision-driven system caller would make
 * ordinary HUMAN block permissions correspondingly different for everyone,
 * not just this one automated cascade. That is out of scope here:
 * `GATE_PERMISSIONS`, `VALID_TRANSITIONS`/`GATE_TRANSITIONS[GateType.BLOCK]`,
 * and `InitiativeController.blockInitiative` are all untouched by this
 * function. Like the human path, this ONLY applies at `IN_EXECUTION` — a
 * decision created against an initiative that hasn't started execution yet
 * (PROPOSED/DRAFT/PENDING_APPROVAL/APPROVED) is still recorded, it just does
 * not flip this execution-phase flag (see `INITIATIVE_FLAG_INVALID_STATE`
 * below; `DecisionController.ts`'s caller treats that refusal as an
 * expected, non-fatal outcome — the decision itself is not rolled back).
 *
 * Instead, this is ONE MORE narrowly-scoped canonical entry point living in
 * the same canonical file as `executeInitiativeTransition` — not a second,
 * competing transition engine. This function (and its client-parameterized
 * core, `applyDecisionBlockTransitionOnClient`, below) is the SOLE owner of
 * the Decision-driven BLOCK mutation, its validation, and its audit, exactly
 * as `executeInitiativeTransition` is the sole owner of every OTHER
 * initiative status transition.
 *
 * SPLIT INTO TWO FUNCTIONS (2026-08-01 Codex review — atomicity follow-up):
 * `applyDecisionBlockTransitionOnClient(client, params)` is the actual
 * validation/mutation/audit logic, parameterized by an ALREADY-OPEN pinned
 * transaction client — it does not open or commit a transaction itself.
 * `applyDecisionBlockTransition(params)` (this function) is a thin wrapper
 * that opens its OWN `withPgTransaction` around that core, for callers that
 * want a standalone atomic call. `DecisionController.ts`'s `createDecision`
 * does NOT call this wrapper — it calls `applyDecisionBlockTransitionOnClient`
 * directly, passing its OWN outer transaction's client, so the Decision
 * INSERT + `decision_history` + `decision_impacts` + this BLOCK + both
 * Initiative audit rows all commit or roll back as ONE atomic unit (nesting
 * two independent `withPgTransaction` calls would NOT achieve that: two
 * separate physical connections commit independently of each other, so the
 * inner one could durably commit the block even if the outer one later rolls
 * back the decision itself). This still means there is only ONE
 * implementation of the mutation — the core function — never a duplicate.
 *
 * LOCKING: takes the row lock (`SELECT ... FOR UPDATE`) first, then the SAME
 * advisory-lock key (`orgId:initiativeId:GOVERNANCE_DECISION_MAKING`) that
 * `hasApprovedGateDecision` takes for the UNBLOCK gate inside
 * `executeInitiativeTransition` — same order (row lock, then advisory lock)
 * as that function, so the two paths cannot deadlock against each other, and
 * a concurrent decision-driven block and a concurrent decision-driven
 * unblock on the SAME initiative genuinely serialize.
 *
 * TERMINAL PROTECTION: never blocks DONE, COMPLETED (legacy DONE synonym),
 * CANCELLED, or ARCHIVED — see `DECISION_BLOCK_TERMINAL_OR_DONE_STATUSES`
 * above. A genuinely UNRECOGNIZED status value (not a known canonical status
 * and not one of the STEP3/STEP4/STEP5/COMPLETED legacy synonyms
 * `normalizeInitiativeDbStatusForRead` already understands) is rejected
 * FAIL-CLOSED rather than silently treated as blockable — see the
 * `hasInitiativeStatusSchemaDrift` check below; relying on
 * `normalizeInitiativeDbStatusForRead`'s own fallback (which defaults any
 * unrecognized string to 'DRAFT', a normal blockable status) would do the
 * opposite of fail-closed.
 *
 * IDEMPOTENCY: if the initiative is already BLOCKED, this is a no-op for the
 * state/audit (`alreadyBlocked: true`, no duplicate `initiative_status_history`/
 * `initiative_history` rows) — a second decision blocking an already-blocked
 * initiative must not fabricate a fake "transition happened" audit trail.
 */
export async function applyDecisionBlockTransitionOnClient(
  client: PgTransactionClient,
  params: ApplyDecisionBlockTransitionParams
): Promise<DecisionBlockTransitionResult> {
  const { orgId, initiativeId, decisionId } = params;

  // Row lock FIRST (same order as executeInitiativeTransition) — every
  // check below reads `currentStatus` from THIS locked row.
  const lockedRows = (
    await client.query<Record<string, unknown>>(
      `SELECT * FROM initiatives WHERE id = ? AND organization_id = ? FOR UPDATE`,
      [initiativeId, orgId]
    )
  ).rows;
  const lockedRow = lockedRows[0];
  if (!lockedRow) {
    return { ok: false, statusCode: 404, body: { error: 'Initiative not found' } };
  }

  // Then the advisory lock — same key/domain the UNBLOCK path already
  // takes, so the two cascades serialize against each other.
  await client.query(
    `SELECT pg_advisory_xact_lock(hashtextextended(? || ':' || ? || ':' || ?, 0))`,
    [orgId, initiativeId, 'GOVERNANCE_DECISION_MAKING']
  );

  // FAIL-CLOSED on schema drift / an unrecognized raw status (test case 19):
  // checked BEFORE normalizing, on the RAW value — see doc comment above.
  if (hasInitiativeStatusSchemaDrift(lockedRow.status)) {
    const rawStatus = String(lockedRow.status ?? '')
      .trim()
      .toUpperCase();
    return {
      ok: false,
      statusCode: 400,
      body: {
        error: `Cannot block an initiative with an unrecognized status (${rawStatus || '(empty)'})`,
        rule: 'INITIATIVE_STATUS_UNRECOGNIZED',
        from: rawStatus,
      },
    };
  }

  const currentStatus = normalizeInitiativeDbStatusForRead(String(lockedRow.status || ''));

  // Terminal/DONE protection — explicit set PLUS the canon's own
  // `isTerminalStatus`, combined (defense in depth, see doc comment above).
  if (
    DECISION_BLOCK_TERMINAL_OR_DONE_STATUSES.has(currentStatus) ||
    isTerminalStatus(currentStatus as any)
  ) {
    return {
      ok: false,
      statusCode: 400,
      body: {
        error: `Cannot block an initiative that is ${currentStatus}`,
        rule: 'INITIATIVE_TERMINAL',
        from: currentStatus,
      },
    };
  }

  if (lockedRow.on_hold === true) {
    // Idempotent no-op — do not fabricate a second transition/audit row.
    return {
      ok: true,
      id: initiativeId,
      status: currentStatus,
      previousStatus: currentStatus,
      alreadyBlocked: true,
      correlationId: null,
    };
  }

  // DEC-424 (P12-int-c, znalezisko 6): INITIATIVE_FLAG_RULES.HOLD only ever
  // applies at IN_EXECUTION (initiativeStatuses.ts's own flagOperation guard
  // in executeInitiativeTransition enforces exactly this for the human BLOCK
  // gate — see `allowedState = currentStatus === 'IN_EXECUTION'` above).
  // `on_hold` never replaces status (§4 SSOT doc: "inicjatywa wstrzymana ma
  // status IN_EXECUTION i flagę on_hold=true") — a decision blocking an
  // initiative that hasn't started execution yet (PROPOSED/DRAFT/
  // PENDING_APPROVAL/APPROVED) has nothing to put "on hold": the decision is
  // still created and audited (see DecisionController's caller, which treats
  // this refusal as an expected, non-fatal outcome), it just does not flip
  // this execution-phase flag on a status where the flag has no meaning.
  if (currentStatus !== InitiativeStatus.IN_EXECUTION) {
    return {
      ok: false,
      statusCode: 400,
      body: {
        error: `Cannot put an initiative on hold from ${currentStatus} (only ${InitiativeStatus.IN_EXECUTION} supports on_hold)`,
        rule: 'INITIATIVE_FLAG_INVALID_STATE',
        from: currentStatus,
      },
    };
  }

  const now = new Date().toISOString();
  const reasonText = params.reason ?? `Blocked by Decision ${decisionId}`;

  const initiativeColumns = getColumnNameSet(await queryHelpers.getTableColumns('initiatives'));
  // DEC-424 (P12): blokada to FLAGA `on_hold`, nie status. Zapis `status = 'BLOCKED'`
  // po migracji 20262103_p12 łamie CHECK `initiatives_status_check_p12` — cała
  // transakcja `createDecision` padała, więc decyzji-blokera NIE DAŁO SIĘ utworzyć.
  // Status zostaje bez zmian; „zablokowana" czyta się jako IN_EXECUTION AND on_hold.
  const lifecycleUpdates: string[] = ['updated_at = ?'];
  const lifecycleParams: unknown[] = [now];
  pushOptionalColumnUpdate(lifecycleUpdates, lifecycleParams, initiativeColumns, 'on_hold', true);
  pushOptionalColumnUpdate(lifecycleUpdates, lifecycleParams, initiativeColumns, 'blocked_at', now);
  // Legacy `blocked_reason` bookkeeping (best-effort, additive only — the
  // canonical audit trail is the two INSERTs below, not this column). Only
  // fills it in when unset, mirroring the semantics of the raw UPDATE this
  // replaces.
  if (initiativeColumns.has('blocked_reason')) {
    lifecycleUpdates.push(
      `blocked_reason = CASE WHEN blocked_reason IS NULL OR blocked_reason = '' THEN ? ELSE blocked_reason END`
    );
    lifecycleParams.push(reasonText);
  }
  lifecycleParams.push(initiativeId, orgId);
  await client.query(
    `UPDATE initiatives SET ${lifecycleUpdates.join(', ')} WHERE id = ? AND organization_id = ?`,
    lifecycleParams
  );

  // Audit trail — same shape as executeInitiativeTransition's own INSERTs.
  const correlationId = uuidv4();

  const statusHistoryColumns = getColumnNameSet(
    await queryHelpers.getTableColumns('initiative_status_history')
  );
  const statusHistoryCols = ['id', 'initiative_id', 'organization_id', 'from_status', 'to_status'];
  // DEC-424: przejście statusu nie następuje (zmienia się flaga), więc ślad
  // audytowy zapisuje ten sam status po obu stronach — gate DECISION_AUTO_BLOCK
  // niżej niesie informację, CO się wydarzyło.
  const statusHistoryVals: unknown[] = [
    correlationId,
    initiativeId,
    orgId,
    currentStatus,
    currentStatus,
  ];
  if (statusHistoryColumns.has('changed_by')) {
    statusHistoryCols.push('changed_by');
    statusHistoryVals.push(DECISION_BLOCK_SYSTEM_ACTOR_ID);
  }
  if (statusHistoryColumns.has('reason')) {
    statusHistoryCols.push('reason');
    statusHistoryVals.push(reasonText);
  }
  if (statusHistoryColumns.has('gate_type')) {
    statusHistoryCols.push('gate_type');
    statusHistoryVals.push('DECISION_AUTO_BLOCK');
  }
  if (statusHistoryColumns.has('created_at')) {
    statusHistoryCols.push('created_at');
    statusHistoryVals.push(now);
  }
  await client.query(
    `INSERT INTO initiative_status_history (${statusHistoryCols.join(
      ', '
    )}) VALUES (${statusHistoryCols.map(() => '?').join(', ')})`,
    statusHistoryVals
  );

  const historyColumns = getColumnNameSet(await queryHelpers.getTableColumns('initiative_history'));
  const histId = uuidv4();
  const historyNotes = JSON.stringify({
    from: currentStatus,
    // DEC-424: status się nie zmienia — zapala się flaga `on_hold`.
    to: currentStatus,
    onHold: true,
    reason: reasonText,
    gate: 'DECISION_AUTO_BLOCK',
    correlationId,
    decisionId,
  });
  const historyCols = ['id', 'initiative_id', 'action'];
  const historyVals: unknown[] = [histId, initiativeId, 'status_changed'];
  if (historyColumns.has('changed_by')) {
    historyCols.push('changed_by');
    historyVals.push(DECISION_BLOCK_SYSTEM_ACTOR_ID);
  }
  if (historyColumns.has('changed_at')) {
    historyCols.push('changed_at');
    historyVals.push(now);
  }
  if (historyColumns.has('notes')) {
    historyCols.push('notes');
    historyVals.push(historyNotes);
  }
  await client.query(
    `INSERT INTO initiative_history (${historyCols.join(', ')}) VALUES (${historyCols
      .map(() => '?')
      .join(', ')})`,
    historyVals
  );

  return {
    ok: true,
    id: initiativeId,
    // DEC-424: status nietknięty; blokadę niesie flaga `on_hold`.
    status: currentStatus,
    previousStatus: currentStatus,
    alreadyBlocked: false,
    correlationId,
  };
}

/**
 * Standalone wrapper — opens its own transaction around
 * `applyDecisionBlockTransitionOnClient`. See that function's doc comment for
 * why `createDecision` does NOT call this wrapper and instead calls the core
 * function directly with its own outer transaction's client.
 */
export async function applyDecisionBlockTransition(
  params: ApplyDecisionBlockTransitionParams
): Promise<DecisionBlockTransitionResult> {
  return queryHelpers.withPgTransaction((client) =>
    applyDecisionBlockTransitionOnClient(client, params)
  );
}
