/**
 * Shared Method Kernel — session lifecycle.
 *
 * Enforces `METHOD_SESSION_TRANSITIONS` / `TRANSITION_AUTHORITY` from
 * src/method-core/contracts/session.ts against `method_sessions`
 * (server/migrations/20260813_method_core_kernel.sql). One state machine,
 * three front doors (assessment / tools / audits) — this file holds no
 * DRD/SIRI/ADMA rule.
 *
 * Design notes not spelled out by the (frozen) contract types themselves:
 *
 * - `frozen -> active` reopens as a NEW REVISION, never an in-place mutate.
 *   `MethodTransitionRequest` has no `to`-payload beyond the target state,
 *   and `TransitionResult` on success is just `{ ok: true }` with no id —
 *   so the new revision's id is discoverable via `listRevisions()`, not via
 *   the transition call itself. The original frozen row's `state`,
 *   `frozenSnapshotId` and `version` are never touched by a reopen.
 *
 * - Optimistic locking: `MethodTransitionRequest` does not carry an
 *   expected `version` (the contract doesn't expose one), so this service
 *   reads the row, then writes with `WHERE id = ? AND version = ?` using
 *   the version it just read. If another transition landed in between, the
 *   UPDATE matches zero rows; the closed `TransitionRefusal` union has no
 *   dedicated "version conflict" kind, so a lost race is reported as
 *   `illegal_transition` computed against the freshly re-read `from` state
 *   — never a silent overwrite. See COORD note candidate for Codex if a
 *   dedicated refusal kind is wanted later.
 *
 * - Freezing (`to === 'frozen'`) also writes an immutable `method_snapshots`
 *   row (deterministic `content_hash` via `computeContentHash`, sorted in
 *   memory — see db.ts) and points `frozen_snapshot_id` at it. Reopening
 *   never rewrites that snapshot row.
 *
 * - ★ A6/COORD (2026-08-13) — Output bridge: A8 built `MethodOutputService`
 *   (immutable `AssessmentOutput`) but nothing called it from here — a
 *   session could freeze and the Output surface would just never exist.
 *   `outputBridge` (optional, 3rd constructor arg) closes that gap WITHOUT
 *   teaching this file any DRD/SIRI/ADMA rule: the kernel only knows "freeze
 *   happened, here is the snapshot id, tell whoever cares" — building the
 *   actual `AssessmentOutput` (findings, evidence, business narrative) from
 *   the method's own event log is the bridge implementation's job (see
 *   `outputs/EventDerivedOutputBridge.ts`), not this service's. A missing
 *   bridge is still legal (constructor arg is optional) — `snapshotOnFreeze`
 *   degrades to "snapshot only, no Output", the pre-A6 behaviour, so callers
 *   that never wire a bridge (SIRI/ADMA, until they do the same) are
 *   unaffected.
 */

import * as DbPromise from '../utils/DbPromise.js';
import { computeContentHash, genId, nowIso, runOrThrow } from './db.js';
import type { MethodEventStore } from './MethodEventStore.js';
import {
  canTransition,
  TRANSITION_AUTHORITY,
  type MethodProcessRole,
  type MethodSaveState,
  type MethodSession,
  type MethodSessionState,
  type MethodTransitionRequest,
  type TransitionResult,
} from './contracts/index.js';

interface MethodSessionRow {
  id: string;
  organization_id: string;
  project_id: string | null;
  module: string;
  method_pack_id: string;
  method_pack_version: string;
  state: string;
  domain_stage: string | null;
  mode: string;
  owner_user_id: string;
  version: number;
  frozen_snapshot_id: string | null;
  revision_of_session_id: string | null;
  created_at: string;
  updated_at: string;
  /**
   * Whether this session was created via the demo bypass of the pack-
   * readiness gate (server/src/method-core/demoBypass.ts). NOT part of the
   * frozen `MethodSession` contract (see `contracts/session.ts`'s header on
   * why that file must stay byte-identical to its src/ mirror) — kept on the
   * internal row/service boundary only, and threaded through to
   * `MethodOutputBridge.onSessionFrozen` so a demo-bypassed session's Output
   * (and, downstream, its Report) can carry an explicit, visible
   * demonstration marker instead of looking indistinguishable from a
   * production one once the create-session response is gone.
   */
  demo_bypass_active: boolean;
}

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
  action: 'assigned' | 'revoked';
  actor_user_id: string;
  occurred_at: string;
}

/** One `method_session_role_events` row — see `server/migrations/
 * 20260813c_method_core_roles_and_approvals.sql` for why this is
 * append-only (revoke never rewrites the 'assigned' row that preceded it). */
export interface MethodSessionRoleEvent {
  readonly id: string;
  readonly sessionId: string;
  readonly userId: string;
  readonly role: MethodProcessRole;
  readonly action: 'assigned' | 'revoked';
  readonly actorUserId: string;
  readonly occurredAt: string;
}

/** Current role holder — one row per (session, user, role) still in force. */
export interface MethodSessionRoleAssignment {
  readonly userId: string;
  readonly role: MethodProcessRole;
  readonly createdAt: string;
}

interface MethodApprovalRow {
  id: string;
  organization_id: string;
  session_id: string;
  revision: number;
  decision: 'approved' | 'sent_back';
  comment: string | null;
  actor_user_id: string;
  created_at: string;
}

/** One `method_approvals` row — tied to the EXACT revision (`sessionId` +
 * `revision` = `MethodSession.version` at decision time). A reopened
 * session freezes under a brand-new `sessionId` (see `transition()`'s
 * `frozen -> active` branch below), so a query scoped to a session id can
 * never surface another revision's approvals — no extra staleness check
 * needed at the call site. */
export interface MethodApproval {
  readonly id: string;
  readonly sessionId: string;
  readonly revision: number;
  readonly decision: 'approved' | 'sent_back';
  readonly comment: string | null;
  readonly actorUserId: string;
  readonly createdAt: string;
}

export interface CreateSessionInput {
  readonly organizationId: string;
  readonly projectId: string | null;
  readonly module: MethodSession['module'];
  readonly methodPackId: string;
  readonly methodPackVersion: string;
  readonly ownerUserId: string;
  readonly mode: MethodSession['mode'];
  /** See `MethodSessionRow.demo_bypass_active`. Defaults to false. */
  readonly demoBypassActive?: boolean;
}

/**
 * Not part of the frozen contract (which defines `TransitionRefusal` for
 * `transition()` only) — `createSession` is this service's own entry point
 * for the "pack draft -> canStartSession false -> start refused" rule.
 */
export type CreateSessionRefusal = { readonly kind: 'pack_not_released'; readonly methodPackId: string };
export type CreateSessionResult =
  | { readonly ok: true; readonly session: MethodSession }
  | { readonly ok: false; readonly refusal: CreateSessionRefusal };

/**
 * Narrow hook invoked exactly once, right after a freeze snapshot is
 * durably written — never before. Deliberately has no DRD/SIRI/ADMA-shaped
 * parameter (no `findings`, no `answers`): the kernel hands over only what
 * it itself owns (ids + the pinned pack version), so this file stays
 * method-agnostic. A throwing bridge implementation fails the whole
 * `transition()` call (the freeze is not "half done" — see call site).
 */
export interface MethodOutputBridge {
  onSessionFrozen(input: {
    readonly organizationId: string;
    readonly sessionId: string;
    readonly snapshotId: string;
    readonly module: MethodSession['module'];
    readonly methodPackId: string;
    readonly methodPackVersion: string;
    /** See `MethodSessionRow.demo_bypass_active`. */
    readonly demoBypassActive: boolean;
    /**
     * Set when the session being frozen is a `frozen -> active` reopen
     * revision (`MethodSession.revisionOfSessionId`). Lets the bridge chain
     * the new Output's `revisionOfOutputId` back to the LATEST Output of the
     * session this one reopened — without this, every reopened session's
     * freeze would silently produce an unlinked `outputVersion: 1` row
     * instead of a real correction in the same lineage.
     */
    readonly revisionOfSessionId: string | null;
  }): Promise<void>;
}

function toMethodSession(row: MethodSessionRow): MethodSession {
  return {
    id: row.id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    module: row.module as MethodSession['module'],
    methodPackId: row.method_pack_id,
    methodPackVersion: row.method_pack_version,
    state: row.state as MethodSessionState,
    domainStage: row.domain_stage,
    mode: row.mode as MethodSession['mode'],
    ownerUserId: row.owner_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
    frozenSnapshotId: row.frozen_snapshot_id,
    revisionOfSessionId: row.revision_of_session_id,
  };
}

/**
 * List filter for `listForOrganization` — org-scoped by construction
 * (`organizationId` is required, never optional, so a caller cannot forget
 * to scope a list read). `limit`/`offset` are validated by the HTTP layer
 * (`server/src/routes/method-core.routes.ts`'s `parsePagination`) before
 * reaching here — this service trusts them as already-clamped integers.
 */
export interface ListSessionsFilter {
  readonly organizationId: string;
  readonly methodPackId?: string;
  readonly state?: MethodSessionState;
  readonly projectId?: string;
  readonly ownerUserId?: string;
  readonly limit: number;
  readonly offset: number;
}

export interface ListSessionsResult {
  readonly items: readonly MethodSession[];
  readonly total: number;
}

/** Minimal pack-readiness lookup this service depends on — kept narrow on
 * purpose so a unit test can stub it without wiring the whole registry. */
export interface PackReadinessLookup {
  getReadiness(
    organizationId: string,
    methodPackId: string,
    methodPackVersion: string
  ): Promise<{ canStart: boolean } | null>;
}

export class MethodSessionService {
  constructor(
    private readonly packs: PackReadinessLookup,
    private readonly events: MethodEventStore,
    private readonly outputBridge?: MethodOutputBridge
  ) {}

  async createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
    const readiness = await this.packs.getReadiness(
      input.organizationId,
      input.methodPackId,
      input.methodPackVersion
    );
    if (!readiness || !readiness.canStart) {
      return { ok: false, refusal: { kind: 'pack_not_released', methodPackId: input.methodPackId } };
    }

    const now = nowIso();
    const row: MethodSessionRow = {
      id: genId(),
      organization_id: input.organizationId,
      project_id: input.projectId,
      module: input.module,
      method_pack_id: input.methodPackId,
      method_pack_version: input.methodPackVersion,
      state: 'draft',
      domain_stage: null,
      mode: input.mode,
      owner_user_id: input.ownerUserId,
      version: 1,
      frozen_snapshot_id: null,
      revision_of_session_id: null,
      created_at: now,
      updated_at: now,
      demo_bypass_active: input.demoBypassActive === true,
    };

    await runOrThrow(
      `INSERT INTO method_sessions
         (id, organization_id, project_id, module, method_pack_id, method_pack_version,
          state, domain_stage, mode, owner_user_id, version, frozen_snapshot_id,
          revision_of_session_id, created_at, updated_at, demo_bypass_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.organization_id,
        row.project_id,
        row.module,
        row.method_pack_id,
        row.method_pack_version,
        row.state,
        row.domain_stage,
        row.mode,
        row.owner_user_id,
        row.version,
        row.frozen_snapshot_id,
        row.revision_of_session_id,
        row.created_at,
        row.updated_at,
        row.demo_bypass_active,
      ]
    );

    return { ok: true, session: toMethodSession(row) };
  }

  /** WHERE id = ? — `id` is allow-listed by the test mock's SELECT parser. */
  async getSession(sessionId: string): Promise<MethodSession | null> {
    const row = await this.getSessionRow(sessionId);
    return row ? toMethodSession(row) : null;
  }

  /** Sessions produced by reopening `sessionId` (frozen -> active revisions). */
  async listRevisions(organizationId: string, rootSessionId: string): Promise<MethodSession[]> {
    const rows = await DbPromise.all<MethodSessionRow>(
      `SELECT * FROM method_sessions WHERE organization_id = ?`,
      [organizationId]
    );
    return rows
      .filter((row) => row.revision_of_session_id === rootSessionId)
      .map(toMethodSession);
  }

  /**
   * Every session id under `projectId` in this org — the mechanism a
   * `projectId` filter on the Outputs/Reports/Presentations/Initiative-Draft
   * list endpoints resolves through (none of those tables carry
   * `project_id` themselves; only `method_sessions` does, see
   * server/src/routes/method-core.routes.ts's list handlers).
   */
  async listSessionIdsByProject(organizationId: string, projectId: string): Promise<string[]> {
    const rows = await DbPromise.all<{ id: string; organization_id: string; project_id: string | null }>(
      `SELECT id, organization_id, project_id FROM method_sessions WHERE organization_id = ? AND project_id = ?`,
      [organizationId, projectId]
    );
    return rows
      .filter((row) => row.organization_id === organizationId && row.project_id === projectId)
      .map((row) => row.id);
  }

  /**
   * Grants `role` to `userId` on `sessionId`. `assignedBy` defaults to
   * `userId` when omitted — the ONLY caller that relies on that default is
   * this file's own `createSession` (the session creator becomes 'owner'
   * automatically; that is a system bootstrap step, never the self-elevation
   * the HTTP `POST /sessions/:id/roles` route guards against — that guard
   * lives at the HTTP boundary per this file's header comment on
   * tenancy/auth being an HTTP concern, not a kernel rule).
   *
   * Idempotent: a duplicate (session, user, role) triple is a no-op (`ON
   * CONFLICT ... DO NOTHING`) — `inserted: false` on the row that already
   * existed, and — just as important — NO second `method_session_role_events`
   * row either, so replaying the same assignment never inflates history.
   */
  /**
   * Org-wide, paginated Session listing — powers `GET /api/method/sessions`
   * ("po restarcie użytkownik ma punkt wejścia „pokaż moje sesje", nie tylko
   * wznowienie po znanym id"). Same convention as the sibling downstream-
   * artefact list endpoints (Outputs/Reports/Presentations/Initiative
   * Drafts, see `MethodOutputService.listForOrganization`'s doc comment):
   * loads the full `method_sessions` table for the org with a single
   * `SELECT * WHERE organization_id` (never a narrower WHERE — the kernel
   * filters/sorts in memory rather than trusting SQL ORDER BY, the
   * documented root cause of a prior non-deterministic-hash defect), filters
   * in memory, sorts DETERMINISTICALLY (`created_at DESC, id DESC` — the
   * `id` tie-breaker keeps two calls with identical timestamps in the same
   * order), and only THEN slices `[offset, offset+limit)` — so `total`
   * reflects the full filtered set, not just the returned page.
   *
   * `revisionOfSessionId` and `frozenSnapshotId` are already on the returned
   * `MethodSession` — a `frozen -> active` reopen lands here as a SEPARATE
   * row (see `transition`'s header comment: the original frozen row is never
   * mutated), so both the original and its reopened revision show up as
   * distinct list entries, each individually resumable.
   */
  async listForOrganization(filter: ListSessionsFilter): Promise<ListSessionsResult> {
    const rows = await DbPromise.all<MethodSessionRow>(
      `SELECT * FROM method_sessions WHERE organization_id = ?`,
      [filter.organizationId]
    );
    // organizationId is already the SQL predicate above; this re-check is a
    // defensive backstop against the test-mock's narrow WHERE-column
    // allow-list (see MethodEventStore's header comment on the same pattern,
    // and MethodOutputService.listForOrganization's identical backstop).
    let matching = rows.filter((row) => row.organization_id === filter.organizationId);
    if (filter.methodPackId) matching = matching.filter((row) => row.method_pack_id === filter.methodPackId);
    if (filter.state) matching = matching.filter((row) => row.state === filter.state);
    if (filter.projectId) matching = matching.filter((row) => row.project_id === filter.projectId);
    if (filter.ownerUserId) matching = matching.filter((row) => row.owner_user_id === filter.ownerUserId);

    matching.sort((a, b) => {
      const byTime = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return byTime !== 0 ? byTime : b.id.localeCompare(a.id);
    });

    const total = matching.length;
    const page = matching.slice(filter.offset, filter.offset + filter.limit);
    return { items: page.map(toMethodSession), total };
  }

  async assignRole(
    organizationId: string,
    sessionId: string,
    userId: string,
    role: MethodProcessRole,
    assignedBy: string = userId
  ): Promise<{ inserted: boolean }> {
    const result = await DbPromise.run(
      `INSERT INTO method_session_roles (id, organization_id, session_id, user_id, role, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (session_id, user_id, role) DO NOTHING`,
      [genId(), organizationId, sessionId, userId, role, nowIso()],
      { fallback: false }
    );
    if (!result.success) {
      throw new Error(`method-core: assignRole INSERT failed: ${result.error ?? 'unknown error'}`);
    }
    const inserted = (result.changes ?? 0) > 0;
    if (inserted) {
      await runOrThrow(
        `INSERT INTO method_session_role_events
           (id, organization_id, session_id, user_id, role, action, actor_user_id, occurred_at)
         VALUES (?, ?, ?, ?, ?, 'assigned', ?, ?)`,
        [genId(), organizationId, sessionId, userId, role, assignedBy, nowIso()]
      );
    }
    return { inserted };
  }

  /**
   * Removes `role` from `userId` on `sessionId`. Never touches
   * `method_session_role_events` rows already written — the 'assigned' entry
   * that granted this role stays exactly as it was; this only APPENDS a
   * 'revoked' entry (hard rule: revoke must not rewrite history). Returns
   * `revoked: false` (no-op, nothing thrown) when the role was not currently
   * held — there is nothing to revoke, and no history event is fabricated
   * for an assignment that never happened.
   */
  async revokeRole(
    organizationId: string,
    sessionId: string,
    userId: string,
    role: MethodProcessRole,
    revokedBy: string
  ): Promise<{ revoked: boolean }> {
    const result = await DbPromise.run(
      `DELETE FROM method_session_roles
        WHERE organization_id = ? AND session_id = ? AND user_id = ? AND role = ?`,
      [organizationId, sessionId, userId, role],
      { fallback: false }
    );
    if (!result.success) {
      throw new Error(`method-core: revokeRole DELETE failed: ${result.error ?? 'unknown error'}`);
    }
    const revoked = (result.changes ?? 0) > 0;
    if (revoked) {
      await runOrThrow(
        `INSERT INTO method_session_role_events
           (id, organization_id, session_id, user_id, role, action, actor_user_id, occurred_at)
         VALUES (?, ?, ?, ?, ?, 'revoked', ?, ?)`,
        [genId(), organizationId, sessionId, userId, role, revokedBy, nowIso()]
      );
    }
    return { revoked };
  }

  async getRoles(organizationId: string, sessionId: string, userId: string): Promise<MethodProcessRole[]> {
    const rows = await DbPromise.all<MethodSessionRoleRow>(
      `SELECT * FROM method_session_roles WHERE organization_id = ? AND user_id = ?`,
      [organizationId, userId]
    );
    return rows
      .filter((row) => row.session_id === sessionId)
      .map((row) => row.role as MethodProcessRole);
  }

  /** Every CURRENT role holder on `sessionId` (all users) — the roster
   * behind `GET /sessions/:id/roles`. */
  async listRoles(organizationId: string, sessionId: string): Promise<MethodSessionRoleAssignment[]> {
    const rows = await DbPromise.all<MethodSessionRoleRow>(
      `SELECT * FROM method_session_roles WHERE organization_id = ? AND session_id = ?`,
      [organizationId, sessionId]
    );
    return rows.map((row) => ({
      userId: row.user_id,
      role: row.role as MethodProcessRole,
      createdAt: row.created_at,
    }));
  }

  /** Full assign/revoke log for `sessionId`, oldest first — "kto, kiedy,
   * przez kogo" directly off the columns; pairing an 'assigned' row with the
   * next 'revoked' row for the same (user, role) gives "do kiedy" (still
   * active = no matching 'revoked' row yet). Never filtered or truncated —
   * this is the append-only history rule #5 exists to protect. */
  async getRoleHistory(organizationId: string, sessionId: string): Promise<MethodSessionRoleEvent[]> {
    const rows = await DbPromise.all<MethodSessionRoleEventRow>(
      `SELECT * FROM method_session_role_events WHERE organization_id = ? AND session_id = ?`,
      [organizationId, sessionId]
    );
    return rows
      .map((row) => ({
        id: row.id,
        sessionId: row.session_id,
        userId: row.user_id,
        role: row.role as MethodProcessRole,
        action: row.action,
        actorUserId: row.actor_user_id,
        occurredAt: row.occurred_at,
      }))
      .sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0));
  }

  /**
   * Records one approval-trail entry for `sessionId`, stamped with its
   * CURRENT `version` as the `revision` under review. Does NOT drive the
   * kernel transition itself (`in_review -> frozen` for 'approved',
   * `in_review -> active` for 'sent_back') — the HTTP route calls
   * `transition()` first (so `TRANSITION_AUTHORITY` — 'approver' only for
   * frozen — is enforced exactly once, by the same code path `/transition`
   * uses) and only appends this trail row once that succeeds. Kept as a
   * plain insert (not wrapped with the transition in one method) so a
   * 'sent_back' trail entry with its mandatory comment reads as a first-
   * class decision record, independent of which kernel state names happen
   * to implement it.
   */
  async recordApproval(input: {
    readonly organizationId: string;
    readonly sessionId: string;
    readonly revision: number;
    readonly decision: 'approved' | 'sent_back';
    readonly comment: string | null;
    readonly actorUserId: string;
  }): Promise<MethodApproval> {
    const row: MethodApprovalRow = {
      id: genId(),
      organization_id: input.organizationId,
      session_id: input.sessionId,
      revision: input.revision,
      decision: input.decision,
      comment: input.comment,
      actor_user_id: input.actorUserId,
      created_at: nowIso(),
    };
    await runOrThrow(
      `INSERT INTO method_approvals
         (id, organization_id, session_id, revision, decision, comment, actor_user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.organization_id, row.session_id, row.revision, row.decision, row.comment, row.actor_user_id, row.created_at]
    );
    return {
      id: row.id,
      sessionId: row.session_id,
      revision: row.revision,
      decision: row.decision,
      comment: row.comment,
      actorUserId: row.actor_user_id,
      createdAt: row.created_at,
    };
  }

  /** The approval trail for `sessionId` ONLY — a reopened session freezes
   * under a new `sessionId` (see `transition()` below), so this never needs
   * to filter out a stale revision's approvals: they live under a different
   * id entirely (hard rule #4). Oldest first. */
  async getApprovals(organizationId: string, sessionId: string): Promise<MethodApproval[]> {
    const rows = await DbPromise.all<MethodApprovalRow>(
      `SELECT * FROM method_approvals WHERE organization_id = ? AND session_id = ?`,
      [organizationId, sessionId]
    );
    return rows
      .map((row) => ({
        id: row.id,
        sessionId: row.session_id,
        revision: row.revision,
        decision: row.decision,
        comment: row.comment,
        actorUserId: row.actor_user_id,
        createdAt: row.created_at,
      }))
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  }

  async transition(request: MethodTransitionRequest): Promise<TransitionResult> {
    const session = await this.getSessionRow(request.sessionId);
    if (!session) {
      throw new Error(`method-core: session not found: ${request.sessionId}`);
    }

    const from = session.state as MethodSessionState;
    const to = request.to;

    if (!canTransition(from, to)) {
      return { ok: false, refusal: { kind: 'illegal_transition', from, to } };
    }

    const requiredRoles = TRANSITION_AUTHORITY[to];
    if (requiredRoles && requiredRoles.length > 0) {
      const actorRoles = await this.getRoles(session.organization_id, session.id, request.actorUserId);
      const authorized = requiredRoles.some((role) => actorRoles.includes(role));
      if (!authorized) {
        return { ok: false, refusal: { kind: 'missing_permission', requiredRole: requiredRoles[0] } };
      }
    }

    // frozen -> active: reopen produces a NEW revision. The frozen row (and
    // its snapshot) is never mutated in place.
    if (from === 'frozen' && to === 'active') {
      const now = nowIso();
      const revision: MethodSessionRow = {
        id: genId(),
        organization_id: session.organization_id,
        project_id: session.project_id,
        module: session.module,
        method_pack_id: session.method_pack_id,
        method_pack_version: session.method_pack_version,
        state: 'active',
        domain_stage: null,
        mode: session.mode,
        owner_user_id: session.owner_user_id,
        version: 1,
        frozen_snapshot_id: null,
        revision_of_session_id: session.id,
        created_at: now,
        updated_at: now,
        // Inherited, never re-decided: a reopened revision of a demo session
        // is still a demo session — it cannot "launder" itself into a
        // production-looking Output by being reopened.
        demo_bypass_active: session.demo_bypass_active,
      };
      await runOrThrow(
        `INSERT INTO method_sessions
           (id, organization_id, project_id, module, method_pack_id, method_pack_version,
            state, domain_stage, mode, owner_user_id, version, frozen_snapshot_id,
            revision_of_session_id, created_at, updated_at, demo_bypass_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          revision.id,
          revision.organization_id,
          revision.project_id,
          revision.module,
          revision.method_pack_id,
          revision.method_pack_version,
          revision.state,
          revision.domain_stage,
          revision.mode,
          revision.owner_user_id,
          revision.version,
          revision.frozen_snapshot_id,
          revision.revision_of_session_id,
          revision.created_at,
          revision.updated_at,
          revision.demo_bypass_active,
        ]
      );
      return { ok: true };
    }

    const now = nowIso();
    const result = await DbPromise.run(
      `UPDATE method_sessions SET state = ?, updated_at = ?, version = version + 1
        WHERE id = ? AND version = ?`,
      [to, now, session.id, session.version],
      { fallback: false }
    );
    if (!result.success) {
      throw new Error(`method-core: transition UPDATE failed: ${result.error ?? 'unknown error'}`);
    }
    if (!result.changes) {
      // Lost the optimistic-lock race between our read and our write.
      const fresh = await this.getSessionRow(session.id);
      const freshFrom = (fresh?.state ?? from) as MethodSessionState;
      return { ok: false, refusal: { kind: 'illegal_transition', from: freshFrom, to } };
    }

    if (to === 'frozen') {
      await this.snapshotOnFreeze(session.organization_id, session.id, session.method_pack_version);
    }

    return { ok: true };
  }

  private async snapshotOnFreeze(
    organizationId: string,
    sessionId: string,
    methodPackVersion: string
  ): Promise<void> {
    const events = await this.events.listBySession(organizationId, sessionId);
    const payload = { sessionId, methodPackVersion, events };
    const contentHash = computeContentHash(payload);
    const snapshotId = genId();
    await runOrThrow(
      `INSERT INTO method_snapshots
         (id, organization_id, session_id, method_pack_version, payload_json, content_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [snapshotId, organizationId, sessionId, methodPackVersion, JSON.stringify(payload), contentHash, nowIso()]
    );
    await runOrThrow(`UPDATE method_sessions SET frozen_snapshot_id = ? WHERE id = ?`, [
      snapshotId,
      sessionId,
    ]);

    // ★ A6 bridge: snapshot is durable — now let the Output surface exist.
    // No bridge wired -> unchanged pre-A6 behaviour (snapshot only).
    if (this.outputBridge) {
      const sessionRow = await this.getSessionRow(sessionId);
      if (!sessionRow) {
        throw new Error(`method-core: session vanished mid-freeze: ${sessionId}`);
      }
      await this.outputBridge.onSessionFrozen({
        organizationId,
        sessionId,
        snapshotId,
        module: sessionRow.module as MethodSession['module'],
        methodPackId: sessionRow.method_pack_id,
        methodPackVersion,
        demoBypassActive: sessionRow.demo_bypass_active,
        revisionOfSessionId: sessionRow.revision_of_session_id,
      });
    }
  }

  private async getSessionRow(sessionId: string): Promise<MethodSessionRow | null> {
    const row = await DbPromise.get<MethodSessionRow>(
      `SELECT * FROM method_sessions WHERE id = ?`,
      [sessionId]
    );
    return row ?? null;
  }
}

// Re-exported for callers that only need to type a save-state field.
export type { MethodSaveState };
