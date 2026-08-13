/**
 * Shared Method Kernel — process-role assignment, revocation, history and
 * approval trail (agent S2, CEL 3: role/assignment/approval przez HTTP,
 * 2026-08-13).
 *
 * Fills the gap `DrdHttpMethodWorkspaceScreen.tsx`'s header comment
 * documents explicitly: "no HTTP endpoint assigns extra process roles after
 * session creation" and "no HTTP endpoint reopens a frozen session into a
 * new revision". This service (and its router,
 * `server/src/routes/method-core-roles.routes.ts`) closes both — WITHOUT
 * touching `method-core.routes.ts` or `MethodSessionService.ts` (S1/A2
 * territory): it reads/writes the SAME `method_session_roles` table those
 * files already use, plus two append-only surfaces of its own:
 *
 *  - `method_session_role_events` (own migration,
 *    20260813_method_core_5_role_events.sql) — role grant/revoke history.
 *    `method_session_roles` is CURRENT STATE ONLY (a revoke DELETEs the
 *    row); this table is what "historia nadań/odebrań" reads from, so a
 *    revoke never erases the fact that a grant once happened.
 *
 *  - `method_events` (existing kernel table, via the shared
 *    `MethodEventStore` — read AND written here, never migrated or altered)
 *    — the approval trail. `DECISION_APPROVED` / `DECISION_SENT_BACK` /
 *    `OUTPUT_APPROVED` are already part of the frozen `METHOD_EVENT_TYPES`
 *    contract (src/method-core/contracts/events.ts) but nothing in this repo
 *    appended them before this file. `sendBack()` below appends
 *    `DECISION_SENT_BACK` itself; `DECISION_APPROVED` /`OUTPUT_APPROVED` are
 *    appended by callers over the EXISTING generic
 *    `POST /api/method/sessions/:id/events` endpoint (S1's — same pattern
 *    `method-core.routes.ts` itself uses for TERESA_PROPOSAL_ACCEPTED etc.),
 *    which `approvalTrail()` below reads back.
 *
 * ★ Revision scoping (hard rule #4 — "approval jest związane z dokładną
 * rewizją (id sesji + version), nie z sesją ogólnie"): a `frozen -> active`
 * reopen already gets a BRAND NEW `method_sessions.id` (see
 * `MethodSessionService.transition`'s frozen->active branch) — so scoping a
 * query to one exact `session_id` already scopes it to one exact revision;
 * a later revision is a DIFFERENT id and never shows up. `sendBack()`
 * additionally stamps the pre-transition `version` into the appended
 * event's payload, so within a single (never-reopened) session id the exact
 * point in its version history is still recoverable.
 */

import * as DbPromise from '../utils/DbPromise.js';
import { genId, nowIso, runOrThrow } from './db.js';
import type { MethodEventStore } from './MethodEventStore.js';
import type { MethodSessionService } from './MethodSessionService.js';
import { METHOD_PROCESS_ROLES, type MethodProcessRole, type MethodSession } from './contracts/index.js';

// ---------------------------------------------------------------------------
// Row / DTO shapes
// ---------------------------------------------------------------------------

interface MethodSessionRoleRow {
  id: string;
  organization_id: string;
  session_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

interface MethodSessionRoleEventRow {
  id: string;
  organization_id: string;
  session_id: string;
  user_id: string;
  role: string;
  event_type: 'granted' | 'revoked';
  actor_user_id: string;
  occurred_at: string;
}

export interface RoleAssignment {
  readonly sessionId: string;
  readonly userId: string;
  readonly role: MethodProcessRole;
  readonly createdAt: string;
}

export interface RoleHistoryEntry {
  readonly id: string;
  readonly sessionId: string;
  readonly userId: string;
  readonly role: MethodProcessRole;
  readonly eventType: 'granted' | 'revoked';
  readonly actorUserId: string;
  readonly occurredAt: string;
}

export interface ApprovalTrailEntry {
  readonly eventId: string;
  readonly sessionId: string;
  /**
   * The session's `version` AT THE TIME of the decision, when the writer
   * supplied it in `payload.version` (both `sendBack()` below and the
   * documented `POST /events` DECISION_APPROVED convention do). `null` when
   * an external caller appended the event without it — never fabricated.
   */
  readonly version: number | null;
  readonly type: 'DECISION_APPROVED' | 'DECISION_SENT_BACK' | 'OUTPUT_APPROVED';
  readonly actorUserId: string | null;
  readonly occurredAt: string;
  readonly rationale: string | null;
}

export type AssignRoleRefusal =
  | { readonly kind: 'cannot_self_assign_approver' }
  | { readonly kind: 'unknown_role'; readonly role: string };

export type AssignRoleResult =
  | { readonly ok: true; readonly assignment: RoleAssignment; readonly alreadyGranted: boolean }
  | { readonly ok: false; readonly refusal: AssignRoleRefusal };

export type SendBackRefusal =
  | { readonly kind: 'missing_permission'; readonly requiredRole: MethodProcessRole }
  | { readonly kind: 'illegal_transition'; readonly from: MethodSession['state']; readonly to: MethodSession['state'] };

export type SendBackResult =
  | {
      readonly ok: true;
      /** The (possibly unchanged, if this session id was already `active`
       * only via a reopen — see below) session after the send-back. */
      readonly session: MethodSession;
      /** Set only when the send-back reopened a `frozen` session — the new
       * revision row `frozen -> active` produced. `null` when the send-back
       * happened before freeze (`in_review -> active`, same session id). */
      readonly newRevision: MethodSession | null;
    }
  | { readonly ok: false; readonly refusal: SendBackRefusal };

function toRoleAssignment(row: MethodSessionRoleRow): RoleAssignment {
  return {
    sessionId: row.session_id,
    userId: row.user_id,
    role: row.role as MethodProcessRole,
    createdAt: row.created_at,
  };
}

function toRoleHistoryEntry(row: MethodSessionRoleEventRow): RoleHistoryEntry {
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    role: row.role as MethodProcessRole,
    eventType: row.event_type,
    actorUserId: row.actor_user_id,
    occurredAt: row.occurred_at,
  };
}

const APPROVAL_EVENT_TYPES = new Set(['DECISION_APPROVED', 'DECISION_SENT_BACK', 'OUTPUT_APPROVED']);

export class MethodSessionRoleService {
  constructor(
    private readonly sessions: MethodSessionService,
    private readonly events: MethodEventStore
  ) {}

  // ---------------------------------------------------------------------------
  // Roles — current state (method_session_roles, shared with MethodSessionService)
  // ---------------------------------------------------------------------------

  /** Deterministic order — sorted in memory (never relies on SQL ORDER BY;
   * see db.ts's computeContentHash doc comment on why this repo insists on
   * that discipline for anything a test asserts an exact order against). */
  async listRoles(organizationId: string, sessionId: string): Promise<RoleAssignment[]> {
    const rows = await DbPromise.all<MethodSessionRoleRow>(
      `SELECT * FROM method_session_roles WHERE organization_id = ? AND session_id = ?`,
      [organizationId, sessionId]
    );
    return rows
      .filter((row) => row.session_id === sessionId)
      .map(toRoleAssignment)
      .sort((a, b) => a.role.localeCompare(b.role) || a.userId.localeCompare(b.userId));
  }

  /**
   * Grants `role` to `targetUserId` on `sessionId`. Idempotent: a second
   * identical grant does not create a second `method_session_roles` row
   * (`ON CONFLICT ... DO NOTHING`, matching `MethodSessionService.assignRole`)
   * AND does not append a second `granted` history row — `alreadyGranted`
   * tells the caller which happened.
   *
   * Hard rule: a user may never grant THEMSELVES `approver` — a session's
   * freeze gate must always be exercised by a distinct pair of eyes.
   */
  async assignRole(input: {
    readonly organizationId: string;
    readonly sessionId: string;
    readonly targetUserId: string;
    readonly role: MethodProcessRole;
    readonly actorUserId: string;
  }): Promise<AssignRoleResult> {
    if (!(METHOD_PROCESS_ROLES as readonly string[]).includes(input.role)) {
      return { ok: false, refusal: { kind: 'unknown_role', role: input.role } };
    }
    if (input.role === 'approver' && input.targetUserId === input.actorUserId) {
      return { ok: false, refusal: { kind: 'cannot_self_assign_approver' } };
    }

    const now = nowIso();
    const insertResult = await runOrThrow(
      `INSERT INTO method_session_roles (id, organization_id, session_id, user_id, role, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (session_id, user_id, role) DO NOTHING`,
      [genId(), input.organizationId, input.sessionId, input.targetUserId, input.role, now]
    );
    const newlyGranted = (insertResult.changes ?? 0) > 0;

    if (newlyGranted) {
      await runOrThrow(
        `INSERT INTO method_session_role_events
           (id, organization_id, session_id, user_id, role, event_type, actor_user_id, occurred_at)
         VALUES (?, ?, ?, ?, ?, 'granted', ?, ?)`,
        [genId(), input.organizationId, input.sessionId, input.targetUserId, input.role, input.actorUserId, now]
      );
    }

    // Re-select the exact (session, user, role) row rather than trusting the
    // insert's own echo — correct under both a real insert and a no-op
    // conflict skip (the row already existed before this call).
    const rows = await DbPromise.all<MethodSessionRoleRow>(
      `SELECT * FROM method_session_roles WHERE organization_id = ? AND session_id = ?`,
      [input.organizationId, input.sessionId]
    );
    const match = rows.find(
      (r) => r.session_id === input.sessionId && r.user_id === input.targetUserId && r.role === input.role
    );
    if (!match) {
      throw new Error('method-core-roles: assignRole insert settled to no row');
    }

    return { ok: true, assignment: toRoleAssignment(match), alreadyGranted: !newlyGranted };
  }

  /**
   * Revokes `role` from `targetUserId` on `sessionId`. Idempotent no-op if
   * the role was never granted (or already revoked) — no history row is
   * appended for a revoke of nothing. Never touches
   * `method_session_role_events` for anything but a REAL removal — the
   * append-only history is unaffected either way (hard rule #5).
   */
  async revokeRole(input: {
    readonly organizationId: string;
    readonly sessionId: string;
    readonly targetUserId: string;
    readonly role: MethodProcessRole;
    readonly actorUserId: string;
  }): Promise<{ readonly revoked: boolean }> {
    const rows = await DbPromise.all<MethodSessionRoleRow>(
      `SELECT * FROM method_session_roles WHERE organization_id = ? AND session_id = ?`,
      [input.organizationId, input.sessionId]
    );
    const match = rows.find(
      (r) => r.session_id === input.sessionId && r.user_id === input.targetUserId && r.role === input.role
    );
    if (!match) {
      return { revoked: false };
    }

    const result = await DbPromise.run(`DELETE FROM method_session_roles WHERE id = ?`, [match.id], {
      fallback: false,
    });
    if (!result.success) {
      throw new Error(`method-core-roles: revoke DELETE failed: ${result.error ?? 'unknown error'}`);
    }
    if (!result.changes) {
      // Lost a race against a concurrent revoke of the same row — the end
      // state (role gone) is what the caller asked for either way.
      return { revoked: false };
    }

    await runOrThrow(
      `INSERT INTO method_session_role_events
         (id, organization_id, session_id, user_id, role, event_type, actor_user_id, occurred_at)
       VALUES (?, ?, ?, ?, ?, 'revoked', ?, ?)`,
      [genId(), input.organizationId, input.sessionId, input.targetUserId, input.role, input.actorUserId, nowIso()]
    );

    return { revoked: true };
  }

  // ---------------------------------------------------------------------------
  // History — append-only (method_session_role_events); NEVER affected by a
  // revoke's removal from method_session_roles (hard rule #5).
  // ---------------------------------------------------------------------------

  async roleHistory(organizationId: string, sessionId: string): Promise<RoleHistoryEntry[]> {
    const rows = await DbPromise.all<MethodSessionRoleEventRow>(
      `SELECT * FROM method_session_role_events WHERE organization_id = ? AND session_id = ?`,
      [organizationId, sessionId]
    );
    return rows
      .filter((row) => row.session_id === sessionId)
      .map(toRoleHistoryEntry)
      .sort((a, b) => {
        const byTime = new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime();
        return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
      });
  }

  // ---------------------------------------------------------------------------
  // Approval trail — read from the shared, existing method_events table
  // (via MethodEventStore, never migrated/altered here). Scoped to EXACTLY
  // the given sessionId — a reopen produces a different id, so a caller
  // asking about one revision never sees another revision's decisions
  // (hard rule #4).
  // ---------------------------------------------------------------------------

  async approvalTrail(organizationId: string, sessionId: string): Promise<ApprovalTrailEntry[]> {
    const events = await this.events.listBySession(organizationId, sessionId);
    return events
      .filter((event) => APPROVAL_EVENT_TYPES.has(event.type))
      .map((event) => {
        const payload = (event.payload ?? {}) as Record<string, unknown>;
        const version = typeof payload.version === 'number' ? payload.version : null;
        const rationale = typeof payload.rationale === 'string' ? payload.rationale : null;
        return {
          eventId: event.id,
          sessionId: event.sessionId,
          version,
          type: event.type as ApprovalTrailEntry['type'],
          actorUserId: event.actorUserId,
          occurredAt: event.occurredAt,
          rationale,
        };
      });
  }

  // ---------------------------------------------------------------------------
  // Send back — in_review -> active (reject before freeze) OR
  // frozen -> active (reopen a decision already frozen). Always requires a
  // comment (hard rule #3, enforced by the router before this is called);
  // this method requires a non-empty `comment` too, as a defensive backstop.
  // ---------------------------------------------------------------------------

  async sendBack(input: {
    readonly organizationId: string;
    readonly sessionId: string;
    readonly actorUserId: string;
    readonly comment: string;
    readonly idempotencyKey: string;
  }): Promise<SendBackResult> {
    if (!input.comment.trim()) {
      throw new Error('method-core-roles: sendBack requires a non-empty comment (router must enforce this — see 400 path)');
    }

    const before = await this.sessions.getSession(input.sessionId);
    if (!before) {
      throw new Error(`method-core-roles: sendBack session not found: ${input.sessionId}`);
    }

    const result = await this.sessions.transition({
      sessionId: input.sessionId,
      to: 'active',
      actorKind: 'human',
      actorUserId: input.actorUserId,
      rationale: input.comment,
      idempotencyKey: input.idempotencyKey,
    });

    if (!result.ok) {
      const refusal = result.refusal;
      if (refusal.kind === 'missing_permission') {
        return { ok: false, refusal: { kind: 'missing_permission', requiredRole: refusal.requiredRole } };
      }
      if (refusal.kind === 'illegal_transition') {
        return { ok: false, refusal: { kind: 'illegal_transition', from: refusal.from, to: refusal.to } };
      }
      // readiness_blocked / pack_not_released never apply to a `to: 'active'`
      // transition (TRANSITION_AUTHORITY has no readiness gate on 'active')
      // — unreachable in practice, but mapped defensively rather than thrown.
      return { ok: false, refusal: { kind: 'illegal_transition', from: before.state, to: 'active' } };
    }

    // Append the domain event tying this decision to the EXACT pre-transition
    // revision (session id, already exact — see class doc comment — plus the
    // version at the moment of the decision).
    await this.events.append({
      organizationId: input.organizationId,
      sessionId: input.sessionId,
      type: 'DECISION_SENT_BACK',
      actorKind: 'human',
      actorUserId: input.actorUserId,
      methodPackVersion: before.methodPackVersion,
      idempotencyKey: `send-back:${input.idempotencyKey}`,
      payload: {
        decisionId: genId(),
        subject: before.state === 'frozen' ? 'freeze' : 'output_approval',
        rationale: input.comment,
        version: before.version,
        sentBackFrom: before.state,
      },
    });

    let newRevision: MethodSession | null = null;
    if (before.state === 'frozen') {
      // The frozen -> active branch of MethodSessionService.transition()
      // inserts a NEW session row (a new id) and leaves the original frozen
      // row untouched — this is the "no HTTP endpoint reopens a frozen
      // session" gap DrdHttpMethodWorkspaceScreen.tsx's header comment
      // names explicitly. Closing it here: find the fresh revision and hand
      // it back to the caller instead of leaving it undiscoverable.
      const revisions = await this.sessions.listRevisions(input.organizationId, input.sessionId);
      newRevision =
        revisions
          .filter((r) => r.revisionOfSessionId === input.sessionId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
    }

    const after = await this.sessions.getSession(input.sessionId);
    if (!after) {
      throw new Error(`method-core-roles: session vanished right after send-back: ${input.sessionId}`);
    }

    return { ok: true, session: after, newRevision };
  }
}
