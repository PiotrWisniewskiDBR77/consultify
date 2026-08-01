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
  getGateForTransition,
  isValidTransition,
  VALID_TRANSITIONS,
} from '../../constants/initiativeStatuses.js';
import auditEventsService from '../AuditEventsService.js';
import { fireClosureHandoff } from '../executionResultsBridge.js';
import notificationService from '../notificationService.js';
import { gateAiSoftBlocks } from '../../types/gateAi.js';
import logger from '../../utils/Logger.js';
import { flagOn } from '../../utils/pgFlags.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import { getGateReadiness } from './gateAiReadinessService.js';
import { recordGateAiEvent } from './gateAiTelemetryService.js';
import { getTimelineFlags } from './gateTimelineService.js';
import { resolveInitiativeAccessContext } from './initiativeAccessResolver.js';
import { isInitiativeGateAiEnabled } from './initiativeGateAiConfig.js';
import { getBlockingReadinessItems } from './initiativeGateReadinessService.js';
import {
  coerceInitiativeStatusForWrite,
  normalizeInitiativeDbStatusForRead,
} from './initiativeLifecycleCanon.js';
import { recordHandoff as recordStageHandoff } from './stageHandoffService.js';

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

interface GateDecisionCheck {
  ok: boolean;
  decisionId: string | null;
}

/**
 * GO/NO-GO decision-currency check for a gate.
 *
 * ★ Decision-currency fix (2026-08-01): `decisions` has no `superseded`/`is_current`/
 * version column and no unique constraint on (organization_id, initiative_id,
 * pmo_domain) — decisionService always INSERTs a fresh row, it never supersedes an
 * older one for the same gate tuple. That means multiple decision rows for the same
 * gate legitimately accumulate over time (e.g. a rework cycle: GO → sent back to
 * REVIEW → a second decision for the same tuple comes back NO-GO or is still
 * pending). The PREVIOUS implementation used `.some()` over ALL rows for the tuple,
 * so a stale APPROVED row from a superseded round kept satisfying the gate forever,
 * regardless of what the newest decision actually says.
 *
 * FIX: only the MOST RECENT decision row for the tuple (by
 * `COALESCE(decided_at, created_at) DESC`) may satisfy the gate. If the latest row
 * is anything other than approved+owner+deadline (NO-GO, pending, escalated, …), the
 * gate is blocked even if an older approved row exists.
 *
 * Returns which decision satisfied the gate (`decisionId`) so callers can preserve a
 * decision reference in the transition history.
 */
export const hasApprovedGateDecision = async (
  orgId: string,
  initiativeId: string,
  pmoDomain: string
): Promise<GateDecisionCheck> => {
  const sql = `
        SELECT id, status, decision_maker_id, deadline
        FROM decisions
        WHERE organization_id = ?
          AND initiative_id = ?
          AND pmo_domain = ?
        ORDER BY COALESCE(decided_at, created_at) DESC
        LIMIT 1
    `;
  const latest = await queryHelpers.queryOne<Record<string, unknown>>(sql, [
    orgId,
    initiativeId,
    pmoDomain,
  ]);
  if (!latest) return { ok: false, decisionId: null };

  const status = String(latest.status || '').toLowerCase();
  const hasOwner = !!latest.decision_maker_id;
  const hasDueDate = !!latest.deadline;
  const ok = status === 'approved' && hasOwner && hasDueDate;
  return { ok, decisionId: ok ? String(latest.id) : null };
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
  | { kind: 'user' }
  | { kind: 'system'; systemActorId: string; systemActorLabel: string };

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
  /** Defaults to `{ kind: 'user' }` — every existing caller is unaffected. */
  actor?: InitiativeTransitionActor;
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

  // No outer try/catch here on purpose: an unexpected error thrown inside the
  // transaction rolls it back (see withPgTransaction) and then propagates
  // uncaught out of this function to the calling asyncHandler-wrapped route
  // method, which forwards it to Express's error middleware — the same coded,
  // non-leaking 5xx envelope every other unexpected failure in this codebase
  // gets (see asyncHandler.ts: `.catch(next)`). We do NOT want a bespoke 500
  // JSON shape here that bypasses that shared handling, and we must never
  // return an `ok: true` response if COMMIT didn't unambiguously succeed.
  const outcome: TransitionOutcome = await queryHelpers.withPgTransaction(async (client) => {
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

    // DISAMBIGUATION GUARD (see ExecuteInitiativeTransitionParams.expectedCurrentStatus
    // doc comment): must run BEFORE isValidTransition, since e.g. SCHEDULED->EXECUTING
    // and BLOCKED->EXECUTING are BOTH independently valid — this is the check that
    // makes /unblock fail cleanly on a non-BLOCKED initiative instead of silently
    // acting as if it were /start-execution.
    if (params.expectedCurrentStatus) {
      const expected = normalizeStatus(params.expectedCurrentStatus);
      if (currentStatus !== expected) {
        return {
          kind: 'error',
          statusCode: 400,
          body: {
            error: `This action requires the initiative to be ${expected}, but it is ${currentStatus}`,
            rule: 'UNEXPECTED_CURRENT_STATUS',
            from: currentStatus,
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
    // CANCELLED is a lifecycle escape hatch — no gate, no AI soft-block, no readiness check.
    const gate =
      nextStatus === 'CANCELLED'
        ? null
        : getGateForTransition(currentStatus as any, nextStatus as any);
    if (gate && isSystemActor) {
      // ★ System-actor RBAC carve-out (INI-005 fix, 2026-08-01) — DELIBERATELY
      // NARROW. The system actor (currently only `initiativeAutoStartJob`) is
      // authorized for EXACTLY the START gate (SCHEDULED->EXECUTING) and
      // nothing else — it never reaches this engine for any other gate today,
      // but if it ever did (bug, future caller reusing `{kind:'system'}`),
      // this rejects it instead of silently granting a human role. This is
      // NOT a blanket "system can do anything" bypass: there is no human role
      // lookup here at all (a cron job has no `req.user`/role to look up),
      // just a hardcoded allow-list of one gate. Every other check in this
      // function — readiness, and critically the GO/NO-GO decision-currency
      // check a few lines below — is UNCHANGED and still runs for this actor.
      if (gate !== GateType.START) {
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
      const accessCtx = await resolveInitiativeAccessContext(orgId, id, actorId, actorRole);
      const isAdmin = accessCtx.effectiveRoles.includes('ADMIN');
      const steeringBoardEnabled = !!accessCtx.steeringBoard.enabled;
      const requiredRoles = GATE_PERMISSIONS[gate] || [];
      const effectiveRequiredRoles = steeringBoardEnabled
        ? requiredRoles
        : requiredRoles.flatMap((r: string) => {
            if (r === 'STEERING_COMMITTEE') return ['PROJECT_SPONSOR', 'PORTFOLIO_OWNER'];
            return [r];
          });

      const canExecute =
        isAdmin ||
        effectiveRequiredRoles.some((r: string) => accessCtx.effectiveRoles.includes(r));

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
      nextStatus === 'CANCELLED' ? [] : await getBlockingReadinessItems(orgId, id);
    if (blockingItems.length > 0) {
      return {
        kind: 'error',
        statusCode: 400,
        body: {
          error: 'Gate readiness check failed. Complete missing requirements before transitioning.',
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

    // Gate decision validation
    // Canonical flow (PMO):
    // DRAFT -> PENDING_REVIEW -> REVIEW -> PROMOTED -> PLANNING -> APPROVED -> SCHEDULED -> EXECUTING -> DONE -> TRACKING
    let satisfyingDecisionId: string | null = null;

    // REVIEW -> PROMOTED: requires Go/No-Go decision (governance)
    if (currentStatus === 'REVIEW' && nextStatus === 'PROMOTED') {
      const goNoGo = await hasApprovedGateDecision(orgId, id, 'GOVERNANCE_DECISION_MAKING');
      if (!goNoGo.ok) {
        return {
          kind: 'error',
          statusCode: 400,
          body: {
            error: 'Go/No-Go decision is required to promote this initiative',
            rule: 'GATE_DECISION_REQUIRED',
          },
          notify: {
            type: 'initiative.gate_blocked',
            title: 'Initiative gate blocked',
            body: `${initiativeName}: Go/No-Go decision is required to promote.`,
            priority: 'high',
            metadata: { currentStatus, nextStatus, gate: 'GOVERNANCE_DECISION_MAKING' },
          },
        };
      }
      satisfyingDecisionId = goNoGo.decisionId;
    }

    // PROMOTED -> PLANNING: requires Resources Commit decision
    if (currentStatus === 'PROMOTED' && nextStatus === 'PLANNING') {
      const resourcesCommit = await hasApprovedGateDecision(orgId, id, 'RESOURCE_RESPONSIBILITY');
      if (!resourcesCommit.ok) {
        return {
          kind: 'error',
          statusCode: 400,
          body: {
            error: 'Resources Commit decision is required to start planning',
            rule: 'GATE_DECISION_REQUIRED',
          },
          notify: {
            type: 'initiative.gate_blocked',
            title: 'Initiative gate blocked',
            body: `${initiativeName}: Resources Commit decision is required to start planning.`,
            priority: 'high',
            metadata: { currentStatus, nextStatus, gate: 'RESOURCE_RESPONSIBILITY' },
          },
        };
      }
      satisfyingDecisionId = resourcesCommit.decisionId;
    }

    // APPROVED -> SCHEDULED: requires Schedule Lock decision (and dates + milestones + baseline)
    let plannedStart: unknown;
    let plannedEnd: unknown;
    if (currentStatus === 'APPROVED' && nextStatus === 'SCHEDULED') {
      const scheduleLock = await hasApprovedGateDecision(orgId, id, 'SCHEDULE_MILESTONES');
      if (!scheduleLock.ok) {
        return {
          kind: 'error',
          statusCode: 400,
          body: {
            error: 'Schedule Lock decision is required to schedule this initiative',
            rule: 'GATE_DECISION_REQUIRED',
          },
          notify: {
            type: 'initiative.gate_blocked',
            title: 'Initiative gate blocked',
            body: `${initiativeName}: Schedule Lock decision is required to schedule.`,
            priority: 'high',
            metadata: { currentStatus, nextStatus, gate: 'SCHEDULE_MILESTONES' },
          },
        };
      }
      satisfyingDecisionId = scheduleLock.decisionId;

      plannedStart = lockedRow.planned_start_date;
      plannedEnd = lockedRow.planned_end_date;
      if (!plannedStart || !plannedEnd) {
        return {
          kind: 'error',
          statusCode: 400,
          body: {
            error: 'plannedStartDate and plannedEndDate are required to schedule this initiative',
            rule: 'SCHEDULE_DATES_REQUIRED',
          },
          notify: {
            type: 'initiative.gate_blocked',
            title: 'Initiative gate blocked',
            body: `${initiativeName}: plannedStartDate and plannedEndDate are required to schedule.`,
            priority: 'high',
            metadata: { currentStatus, nextStatus, gate: 'SCHEDULE_DATES_REQUIRED' },
          },
        };
      }

      // Require at least one milestone before baselining/scheduling
      try {
        const m = await queryHelpers.queryOne(
          `SELECT COUNT(*) as c
           FROM initiative_milestones
           WHERE initiative_id = ? AND organization_id = ?`,
          [id, orgId]
        );
        const c = Number((m as any)?.c || 0);
        if (c <= 0) {
          return {
            kind: 'error',
            statusCode: 400,
            body: {
              error: 'At least one milestone is required to schedule this initiative',
              rule: 'SCHEDULE_MILESTONES_REQUIRED',
            },
          };
        }
      } catch (e: any) {
        const msg = String(e?.message || e || '').toLowerCase();
        if (
          msg.includes('no such table') ||
          msg.includes('does not exist') ||
          msg.includes('relation')
        ) {
          return {
            kind: 'error',
            statusCode: 400,
            body: {
              error:
                'Milestones schema is required to schedule (missing initiative_milestones). Run migrations.',
              rule: 'SCHEDULE_SCHEMA_MISSING',
              table: 'initiative_milestones',
            },
          };
        }
        throw e;
      }

      // Create schedule baseline snapshot (versioned) — on the SAME pinned client
      // as the rest of this transition, so it commits/rolls back atomically with
      // the state UPDATE below (previously a separate, unpinned queryRun call).
      const existingBaselineVersion = Number((lockedRow as any)?.baseline_version || 0) || 0;
      const baselineVersion = existingBaselineVersion + 1;
      const baselineId = uuidv4();
      const capturedAt = new Date().toISOString();

      const milestones = (await queryHelpers
        .queryAll(
          `SELECT id, name, description, target_date, actual_date, status, order_index, is_gate, gate_decision_id
           FROM initiative_milestones
           WHERE initiative_id = ? AND organization_id = ?
           ORDER BY order_index ASC, target_date ASC`,
          [id, orgId]
        )
        .catch(() => [])) as any[];

      const deps = (await queryHelpers
        .queryAll(
          `SELECT id, from_initiative_id, to_initiative_id, type
           FROM initiative_dependencies
           WHERE organization_id = ?
             AND (from_initiative_id = ? OR to_initiative_id = ?)
           ORDER BY created_at ASC`,
          [orgId, id, id]
        )
        .catch(() => [])) as any[];

      const snapshot = {
        initiativeId: id,
        statusAtBaseline: currentStatus,
        plannedStartDate: plannedStart,
        plannedEndDate: plannedEnd,
        milestones: (milestones || []).map((mm) => ({
          id: mm.id,
          name: mm.name,
          description: mm.description || null,
          targetDate: mm.target_date || null,
          actualDate: mm.actual_date || null,
          status: mm.status || null,
          orderIndex: mm.order_index ?? 0,
          isGate: flagOn(mm.is_gate),
          gateDecisionId: mm.gate_decision_id || null,
        })),
        dependencies: (deps || []).map((d) => ({
          id: d.id,
          fromInitiativeId: d.from_initiative_id,
          toInitiativeId: d.to_initiative_id,
          type: d.type,
        })),
        capturedAt,
        capturedBy: actorId || null,
      };

      try {
        await client.query(
          `INSERT INTO initiative_schedule_baselines
             (id, organization_id, initiative_id, version, status_at_baseline, planned_start_date, planned_end_date, snapshot, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            baselineId,
            orgId,
            id,
            baselineVersion,
            currentStatus,
            plannedStart,
            plannedEnd,
            JSON.stringify(snapshot),
            actorId || null,
            capturedAt,
          ]
        );
      } catch (e: any) {
        const msg = String(e?.message || e || '').toLowerCase();
        if (
          msg.includes('no such table') ||
          msg.includes('does not exist') ||
          msg.includes('relation')
        ) {
          return {
            kind: 'error',
            statusCode: 400,
            body: {
              error:
                'Schedule baseline schema is required to schedule (missing initiative_schedule_baselines). Run migrations.',
              rule: 'SCHEDULE_BASELINE_SCHEMA_MISSING',
              table: 'initiative_schedule_baselines',
            },
          };
        }
        throw e;
      }

      // Persist baseline reference on the locked row (so UI can show version +
      // lock state) — best-effort for legacy schemas missing these columns,
      // same as before, but now on the pinned client.
      if (initiativeColumns.has('baseline_version') && initiativeColumns.has('schedule_baseline_id')) {
        await client.query(
          `UPDATE initiatives
           SET baseline_version = ?, schedule_baseline_id = ?
           WHERE id = ? AND organization_id = ?`,
          [baselineVersion, baselineId, id, orgId]
        );
      }
    }

    // NEW (H16 fix): SCHEDULED -> EXECUTING (START) now requires GO/NO-GO
    // decision currency, exactly like the three gates above. This transition
    // previously had ZERO decision enforcement — the entire bypass this
    // packet closes (only PMO-role RBAC was ever checked, via the `gate`
    // block above / the legacy /start-execution endpoint had no check at
    // all). Reuses the SAME gate/pmoDomain as the REVIEW->PROMOTED check
    // (GOVERNANCE_DECISION_MAKING) — it's the same GO/NO-GO governance
    // decision that must still be current (not superseded by a later
    // NO-GO/pending re-decision) at the moment execution actually starts.
    //
    // EXTENDED (INI-005 follow-up, 2026-08-01) to also cover BLOCKED ->
    // EXECUTING (UNBLOCK, /unblock endpoint — previously a raw UPDATE with
    // NO decision check at all). Design decision, made explicit: unblocking
    // resumes execution, and the exact rework/supersession risk the H16 fix
    // exists for applies just as much here — a block can span a rework cycle
    // where the initiative's GO decision gets superseded by a NO-GO before
    // anyone unblocks it. Requiring a CURRENT approved GOVERNANCE_DECISION_
    // MAKING decision at unblock time (not just at the original SCHEDULED->
    // EXECUTING start) closes that gap too, for the same reason and via the
    // same check — not a separate, parallel decision type.
    if (
      (currentStatus === 'SCHEDULED' || currentStatus === 'BLOCKED') &&
      nextStatus === 'EXECUTING'
    ) {
      const executionGoNoGo = await hasApprovedGateDecision(
        orgId,
        id,
        'GOVERNANCE_DECISION_MAKING'
      );
      if (!executionGoNoGo.ok) {
        return {
          kind: 'error',
          statusCode: 400,
          body: {
            error:
              currentStatus === 'BLOCKED'
                ? 'A current Go/No-Go decision is required to unblock and resume execution of this initiative'
                : 'Go/No-Go decision is required to start execution of this initiative',
            rule: 'GATE_DECISION_REQUIRED',
          },
          notify: {
            type: 'initiative.gate_blocked',
            title: 'Initiative gate blocked',
            body:
              currentStatus === 'BLOCKED'
                ? `${initiativeName}: a current Go/No-Go decision is required to unblock.`
                : `${initiativeName}: Go/No-Go decision is required to start execution.`,
            priority: 'high',
            metadata: { currentStatus, nextStatus, gate: 'GOVERNANCE_DECISION_MAKING' },
          },
        };
      }
      satisfyingDecisionId = executionGoNoGo.decisionId;
    }

    // DEF-1 hardening (parytet z kanonicznym validateTransition): BLOCKED wymaga
    // powodu. Wcześniej handler zapisywał blocked_reason=null bez walidacji — co
    // rozjeżdżało się z modelem stanów. Dotyczy tylko PATCH /:id/status.
    if (nextStatus === 'BLOCKED' && !String(reason ?? '').trim()) {
      return {
        kind: 'error',
        statusCode: 400,
        body: { error: 'Blocked status requires a reason', rule: 'BLOCKED_REASON_REQUIRED' },
      };
    }

    if (
      ['EXECUTING', 'BLOCKED'].includes(currentStatus) &&
      nextStatus === 'DONE' &&
      (await hasPendingExecutionGateDecisions(orgId, id))
    ) {
      return {
        kind: 'error',
        statusCode: 400,
        body: {
          error: 'Resolve pending execution gate decisions before closing this initiative',
          rule: 'EXECUTION_GATE_DECISION_REQUIRED',
        },
      };
    }

    // DONE -> TRACKING (Benefits start) policy enforcement:
    // - Business Owner must be assigned (initiative.owner_business_id)
    // - at least 1 KPI must exist, and at least 1 KPI must have target + unit
    if (currentStatus === 'DONE' && nextStatus === 'TRACKING') {
      const ownerBusinessId = lockedRow.owner_business_id
        ? String(lockedRow.owner_business_id)
        : '';
      if (!ownerBusinessId) {
        return {
          kind: 'error',
          statusCode: 400,
          body: {
            error: 'Business Owner is required to start benefits tracking',
            rule: 'BENEFITS_OWNER_REQUIRED',
            field: 'ownerBusinessId',
          },
        };
      }

      try {
        const kpiCount = await queryHelpers.queryOne(
          `SELECT COUNT(*) as c FROM initiative_kpis WHERE initiative_id = ?`,
          [id]
        );
        const cAll = Number((kpiCount as any)?.c || 0);
        if (cAll <= 0) {
          return {
            kind: 'error',
            statusCode: 400,
            body: {
              error: 'At least one KPI is required to start benefits tracking',
              rule: 'BENEFITS_KPI_REQUIRED',
            },
          };
        }

        const readyCount = await queryHelpers.queryOne(
          `SELECT COUNT(*) as c
           FROM initiative_kpis
           WHERE initiative_id = ?
             AND target_value IS NOT NULL
             AND unit IS NOT NULL`,
          [id]
        );
        const cReady = Number((readyCount as any)?.c || 0);
        if (cReady <= 0) {
          return {
            kind: 'error',
            statusCode: 400,
            body: {
              error: 'KPI target and unit are required to start benefits tracking',
              rule: 'BENEFITS_KPI_TARGET_REQUIRED',
            },
          };
        }
      } catch (e: any) {
        const msg = String(e?.message || e || '').toLowerCase();
        // If KPI schema is missing, block transition with a clear message.
        if (msg.includes('no such table') || msg.includes('initiative_kpis')) {
          return {
            kind: 'error',
            statusCode: 400,
            body: {
              error: 'KPI schema is required to start benefits tracking (missing initiative_kpis)',
              rule: 'BENEFITS_KPI_SCHEMA_MISSING',
            },
          };
        }
        throw e;
      }
    }

    // ---- WRITE PATH (atomic from here on: state UPDATE + both history INSERTs) ----
    const now = new Date().toISOString();
    const lifecycleUpdates: string[] = ['status = ?', 'updated_at = ?'];
    const lifecycleParams: unknown[] = [nextStatus, now];

    if (nextStatus === 'PENDING_REVIEW') {
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
    if (nextStatus === 'SCHEDULED') {
      pushOptionalColumnUpdate(
        lifecycleUpdates,
        lifecycleParams,
        initiativeColumns,
        'execution_started_at',
        null
      ); // will be set when EXECUTING starts
    }
    // INI-005 follow-up (2026-08-01): only set execution_started_at on a
    // GENUINE first start (SCHEDULED->EXECUTING, the START gate). Excluded
    // for BLOCKED->EXECUTING (UNBLOCK) — that's a resume, not a new start;
    // the raw UPDATE this replaced never touched this column on unblock
    // either, so this preserves that behavior rather than resetting the
    // original start timestamp every time an initiative is blocked/unblocked.
    if (nextStatus === 'EXECUTING' && currentStatus !== 'BLOCKED') {
      pushOptionalColumnUpdate(
        lifecycleUpdates,
        lifecycleParams,
        initiativeColumns,
        'execution_started_at',
        now
      );
    }
    if (nextStatus === 'BLOCKED') {
      pushOptionalColumnUpdate(
        lifecycleUpdates,
        lifecycleParams,
        initiativeColumns,
        'blocked_at',
        now
      );
      pushOptionalColumnUpdate(
        lifecycleUpdates,
        lifecycleParams,
        initiativeColumns,
        'blocked_reason',
        reason || null
      );
    }
    if (currentStatus === 'BLOCKED' && nextStatus === 'EXECUTING') {
      pushOptionalColumnUpdate(
        lifecycleUpdates,
        lifecycleParams,
        initiativeColumns,
        'unblocked_at',
        now
      );
      pushOptionalColumnUpdate(
        lifecycleUpdates,
        lifecycleParams,
        initiativeColumns,
        'blocked_at',
        null
      );
      pushOptionalColumnUpdate(
        lifecycleUpdates,
        lifecycleParams,
        initiativeColumns,
        'blocked_reason',
        null
      );
    }
    if (nextStatus === 'DONE') {
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
    if (nextStatus === 'CANCELLED') {
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
    if (nextStatus === 'ARCHIVED') {
      pushOptionalColumnUpdate(
        lifecycleUpdates,
        lifecycleParams,
        initiativeColumns,
        'archived_at',
        now
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

    // Benefits tracking window defaults — same transaction/client now. Only a
    // genuinely-missing legacy column is swallowed; any other error aborts
    // (rolls back) the whole transition, unlike the previous best-effort catch.
    if (currentStatus === 'DONE' && nextStatus === 'TRACKING') {
      const trackingStart = now;
      const trackingEnd = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(); // default 90 days
      try {
        await client.query(
          `UPDATE initiatives
           SET tracking_started_at = COALESCE(tracking_started_at, ?),
               tracking_started_by = COALESCE(tracking_started_by, ?),
               tracking_start_date = COALESCE(tracking_start_date, ?),
               tracking_end_date = COALESCE(tracking_end_date, ?),
               updated_at = ?
           WHERE id = ? AND organization_id = ?`,
          [trackingStart, actorId || null, trackingStart, trackingEnd, now, id, orgId]
        );
      } catch (e: any) {
        const msg = String(e?.message || e || '').toLowerCase();
        if (!msg.includes('no such column') && !msg.includes('does not exist')) throw e;
        // ignore for legacy schemas
      }
    }

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
    const statusHistoryCols = ['id', 'initiative_id', 'organization_id', 'from_status', 'to_status'];
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

    return {
      kind: 'success',
      currentStatus,
      nextStatus,
      gate: gate || null,
      correlationId,
      initiativeName,
    };
  });

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

  // Uspójnienie F2.2–2.5/2.7 — record the stage-boundary handoff (event + lineage)
  // on every successful status transition. Fail-safe (never throws/blocks).
  void recordStageHandoff(orgId, id, currentStatus, nextStatus, actorId);

  // M14 → M15 closure handoff (Decision B1b, hardened G1 2026-07-10): on
  // close (→ DONE), materialize the initiative's planned KPIs (or, absent
  // those, its expected_roi business case) into the canonical M15 registry
  // (initiative_benefits). fireClosureHandoff is the SINGLE choke-point
  // wrapper used by every DONE-transition path in this codebase — fire-and-forget
  // + idempotent internally, so it never blocks the status change.
  if (currentStatus !== 'DONE' && nextStatus === 'DONE') {
    fireClosureHandoff(orgId, id, actorId || null);
  }

  // Emit notifications (best-effort)
  try {
    const recipients = await getInitiativeNotificationRecipients(orgId, id);
    const isModuleChange =
      (currentStatus === 'PENDING_REVIEW' && nextStatus === 'REVIEW') ||
      (currentStatus === 'SCHEDULED' && nextStatus === 'EXECUTING') ||
      (currentStatus === 'DONE' && nextStatus === 'TRACKING');

    // 1. General status change notification to all stakeholders.
    // M13/R4: this is the SINGLE canonical status-change notification.
    // A → BLOCKED transition is escalated to CRITICAL and carries the
    // blocker reason (replaces the removed dedicated R4 emitter).
    const statusSeverity: 'INFO' | 'WARNING' | 'CRITICAL' =
      nextStatus === 'BLOCKED' ? 'CRITICAL' : nextStatus === 'CANCELLED' ? 'WARNING' : 'INFO';
    const statusTitle = isModuleChange
      ? 'Initiative moved to new module'
      : nextStatus === 'BLOCKED'
        ? 'Initiative blocked'
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
            priority:
              nextStatus === 'BLOCKED' || nextStatus === 'CANCELLED' ? 'high' : 'normal',
            metadata: { from: currentStatus, to: nextStatus, reason, gate },
          })
        )
    );

    // 2. Gate-specific notification: notify users who hold the gate role for the NEXT gate
    // This tells the approver "this initiative is now waiting for your decision"
    try {
      const nextTransitions =
        VALID_TRANSITIONS[nextStatus as keyof typeof VALID_TRANSITIONS] || [];
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
            if (
              requiredRoles.includes(roleUser.gateRole as any) &&
              roleUser.userId !== actorId
            ) {
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

  return { ok: true, id, status: nextStatus, previousStatus: currentStatus, gate, correlationId };
}
