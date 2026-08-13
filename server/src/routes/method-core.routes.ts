/**
 * Shared Method Kernel — HTTP surface (P0, 2026-08-13).
 *
 * Replaces the browser-only `localStorage` mirror
 * (`src/method-core/methods/drd/drdSessionRuntime.ts`) with a real HTTP path
 * onto the SAME kernel services the localStorage mirror re-implemented by
 * hand: `MethodSessionService`, `MethodEventStore`, `MethodPackRegistry`,
 * `TeresaProposalService`, `MethodOutputService`, `MethodReportSnapshotService`,
 * `MethodInitiativeDraftService`, `EventDerivedOutputBridge` — all
 * server/src/method-core/*, unmodified by this file.
 *
 * This file's OWN responsibilities (the kernel services deliberately do not
 * do these — they are HTTP/tenancy/auth concerns, not kernel rules):
 *
 *  - auth + tenant isolation: `verifyToken`/`isAuthenticated` gate the whole
 *    router; every handler re-derives `organizationId` from `req.organizationId`
 *    (the verified token), NEVER from the request body, and every read/write
 *    is scoped to it. A session/output that exists but belongs to a
 *    different org is reported as 404 (list/detail reads) or 403 (an
 *    explicit ownership mismatch after a positive existence check) — see
 *    inline comments per handler for which.
 *  - optimistic concurrency at the HTTP boundary: `POST .../transition`
 *    accepts an optional `expectedVersion`; a mismatch is refused with
 *    HTTP 409 and the CURRENT version in the body, BEFORE any write is
 *    attempted (`MethodSessionService.transition` has its own internal
 *    lost-race handling too, but that maps a race to `illegal_transition`,
 *    not a version number a client can read back — this pre-check gives the
 *    client the number).
 *  - idempotency-key plumbing at the boundary the kernel does not itself
 *    cover: `POST /sessions` (no session row exists yet to key off of) and
 *    `POST .../freeze` (freezing an already-frozen session is not a legal
 *    kernel transition, so naive retry would 409 instead of replaying) — see
 *    the handlers for the exact mechanism.
 *  - provenance integrity: `actorUserId` is ALWAYS `req.userId` from the
 *    verified token, never a client-supplied value, on every write. Likewise
 *    `methodPackVersion` on event/transition writes is always the SESSION's
 *    own pinned version, never a client-supplied one — a client cannot spoof
 *    who acted or against which pack version.
 *  - the demo bypass gate (`server/src/method-core/demoBypass.ts`).
 *
 * Mounted in `server/src/Gateway.ts` (the only place this repo mounts
 * routers) at `/api/method`.
 */

import { Router, type Request, type Response } from 'express';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

import {
  isMethodEventType,
  METHOD_EVENT_TYPES,
  METHOD_PROCESS_ROLES,
  TERESA_CAPABILITIES,
  TRANSITION_AUTHORITY,
  type MethodActorKind,
  type MethodEventType,
  type MethodProcessRole,
  type MethodSessionState,
  type TeresaCapabilityId,
  type TeresaCommitRequest,
  type TeresaProposedChange,
  type TeresaQualityVerdict,
  type TeresaStatement,
} from '../method-core/contracts/index.js';
import { methodEventStore } from '../method-core/MethodEventStore.js';
import { methodPackRegistry } from '../method-core/MethodPackRegistry.js';
import { MethodSessionService, type PackReadinessLookup } from '../method-core/MethodSessionService.js';
import { teresaProposalService } from '../method-core/TeresaProposalService.js';
import {
  DEMO_BYPASS_NOTICE,
  isDemoBypassAllowed,
} from '../method-core/demoBypass.js';
import type { MethodArtefactKind } from '../method-core/outputs/MethodReportSnapshotService.js';
import {
  EventDerivedOutputBridge,
  methodInitiativeDraftService,
  methodOutputService,
  methodReportSnapshotService,
} from '../method-core/outputs/index.js';
import { computeContentHash, genId, nowIso } from '../method-core/db.js';
import * as DbPromise from '../utils/DbPromise.js';

// ---------------------------------------------------------------------------
// Wiring — one bridge, one session service instance, matching how the rest
// of the kernel expects to be composed (see MethodSessionService's own
// header comment on the optional outputBridge constructor arg).
// ---------------------------------------------------------------------------

const outputBridge = new EventDerivedOutputBridge(methodEventStore, methodOutputService);
const sessionService = new MethodSessionService(methodPackRegistry, methodEventStore, outputBridge);

/** Used ONLY when a demo-bypass-eligible create request needs a readiness
 * lookup that always says yes — never wired as the default. */
const alwaysStartablePacks: PackReadinessLookup = {
  async getReadiness() {
    return { canStart: true };
  },
};

interface AuthedRequest extends Request {
  organizationId?: string;
  userId?: string;
}

const router = Router();

router.use(verifyToken, isAuthenticated);

// ---------------------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------------------

function requireOrg(req: AuthedRequest, res: Response): string | null {
  const organizationId = req.organizationId;
  if (!organizationId) {
    res.status(401).json({ error: 'No organization context on token' });
    return null;
  }
  return organizationId;
}

function requireActor(req: AuthedRequest, res: Response): string | null {
  const actorUserId = req.userId;
  if (!actorUserId) {
    res.status(401).json({ error: 'No user context on token' });
    return null;
  }
  return actorUserId;
}

function requireIdempotencyKey(req: Request, res: Response): string | null {
  const raw = req.get('Idempotency-Key');
  if (!raw || !raw.trim()) {
    res.status(400).json({ error: 'Idempotency-Key header is required for this write' });
    return null;
  }
  return raw.trim();
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Roles that gate a `TRANSITION_AUTHORITY` entry (i.e. holding one lets you
 * drive the session's state machine — `owner`/`lead_assessor`/`assessor`
 * can advance it, `approver` can freeze it). Derived from the kernel's own
 * table rather than hand-listed, so a future contract change to
 * `TRANSITION_AUTHORITY` is automatically reflected here — no second list
 * to drift out of sync with `src/method-core/contracts/session.ts`.
 *
 * Used ONLY to block self-elevation on `POST /sessions/:id/roles` (hard
 * rule S2#1: nobody grants themselves a power role, 'approver' included).
 * Non-power roles (`respondent`, `evidence_owner`, `observer`, and
 * `reviewer` — NOT wired into `TRANSITION_AUTHORITY` by the contract as of
 * 2026-08-13) are unrestricted for self-assignment; they carry no kernel
 * authority to elevate.
 */
const POWER_ROLES: ReadonlySet<MethodProcessRole> = new Set(
  Object.values(TRANSITION_AUTHORITY).flatMap((roles) => roles ?? [])
);

/**
 * Tenant lookup for the ROLE TARGET (hard rule S2#6: cross-org assignment
 * refused). Deliberately reads the `users` table directly — the kernel
 * itself never builds a people directory (see MethodSessionService's own
 * header comment), and this file already owns every other tenant-isolation
 * check (see the header comment's "auth + tenant isolation" bullet), so
 * this one more belongs here rather than growing a new kernel dependency.
 */
async function getUserOrganizationId(userId: string): Promise<string | null> {
  const row = await DbPromise.get<{ organization_id: string | null }>(
    `SELECT organization_id FROM users WHERE id = ?`,
    [userId]
  );
  return row?.organization_id ?? null;
}

/**
 * Loads a session and enforces tenant isolation. Returns null and has
 * already written the response on: not found (404) or found-but-other-org
 * (403 — chosen over a second 404 so a genuine cross-tenant attempt is
 * distinguishable in logs/tests from a typo'd id; either code refuses the
 * read/write, which is the actual security property under test).
 */
async function loadOwnedSession(
  req: AuthedRequest,
  res: Response,
  sessionId: string
): Promise<Awaited<ReturnType<MethodSessionService['getSession']>> | null> {
  const session = await sessionService.getSession(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return null;
  }
  if (session.organizationId !== req.organizationId) {
    res.status(403).json({ error: 'Session does not belong to this organization' });
    return null;
  }
  return session;
}

/**
 * Walks `output.revisionOfOutputId` back through a reopen/correction chain
 * (bounded — a runaway chain refuses to loop forever rather than hang a
 * request) and returns every distinct `sessionId` in the lineage, INCLUDING
 * the given output's own session. A "corrected revision" freezes under a
 * NEW session id (`frozen -> active` reopen — see MethodSessionService), so
 * a Report/Presentation/Initiative Draft superseded only by
 * `output.sessionId` would never reach the artefacts that were built
 * against the OLDER output in the same lineage — this is what makes "reopen
 * wszystkich rezultatów" (reopen touches every downstream result, not just
 * the ones on the newest session) actually true instead of only true for
 * same-session re-generation.
 */
async function collectLineageSessionIds(
  organizationId: string,
  output: { readonly id: string; readonly sessionId: string; readonly revisionOfOutputId: string | null }
): Promise<string[]> {
  const sessionIds = new Set<string>([output.sessionId]);
  let cursor = output.revisionOfOutputId;
  let hops = 0;
  while (cursor && hops < 25) {
    const ancestor = await methodOutputService.getOutput(organizationId, cursor);
    if (!ancestor) break;
    sessionIds.add(ancestor.sessionId);
    cursor = ancestor.revisionOfOutputId;
    hops += 1;
  }
  return [...sessionIds];
}

/**
 * Marks every `current` Report/Presentation snapshot AND Initiative Draft
 * across the whole lineage of `output` as superseded by `output.id` — called
 * once, right before creating a NEW Report/Presentation/Initiative Draft
 * against a NEW Output. Never touches content columns (see each service's
 * class-level doc comment on column-scoped UPDATEs only).
 */
async function supersedeLineageResultsFor(organizationId: string, output: MethodOutputRecordLike): Promise<void> {
  const lineageSessionIds = await collectLineageSessionIds(organizationId, output);
  for (const sessionId of lineageSessionIds) {
    await methodReportSnapshotService.supersedeCurrentForSession(organizationId, sessionId, output.id, 'superseded');
    await methodInitiativeDraftService.supersedeCurrentForSession(organizationId, sessionId, output.id, 'superseded');
  }
}

type MethodOutputRecordLike = { readonly id: string; readonly sessionId: string; readonly revisionOfOutputId: string | null };

// ---------------------------------------------------------------------------
// GET /api/method/packs — Library
// ---------------------------------------------------------------------------

router.get(
  '/packs',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const organizationId = requireOrg(req, res);
    if (!organizationId) return;
    const packs = await methodPackRegistry.listAll(organizationId);
    res.status(200).json({ packs });
  })
);

// ---------------------------------------------------------------------------
// POST /api/method/sessions — create (Idempotency-Key)
// ---------------------------------------------------------------------------

router.post(
  '/sessions',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const organizationId = requireOrg(req, res);
    if (!organizationId) return;
    const actorUserId = requireActor(req, res);
    if (!actorUserId) return;
    const idempotencyKey = requireIdempotencyKey(req, res);
    if (!idempotencyKey) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const module = body.module;
    const methodPackId = body.methodPackId;
    const methodPackVersion = body.methodPackVersion;
    const mode = body.mode;
    const projectId = isNonEmptyString(body.projectId) ? body.projectId : null;
    const requestedBypass = body.demoBypass === true;

    if (module !== 'assessment' && module !== 'tools' && module !== 'audits') {
      res.status(400).json({ error: 'module must be one of assessment|tools|audits' });
      return;
    }
    if (!isNonEmptyString(methodPackId) || !isNonEmptyString(methodPackVersion)) {
      res.status(400).json({ error: 'methodPackId and methodPackVersion are required' });
      return;
    }
    if (mode !== 'guided_manual' && mode !== 'teresa_led') {
      res.status(400).json({ error: 'mode must be guided_manual|teresa_led' });
      return;
    }

    // --- idempotency: same (org, key) replays the same session -------------
    const existingIdemRow = await DbPromise.get<{ session_id: string }>(
      `SELECT session_id FROM method_session_create_idempotency WHERE organization_id = ? AND idempotency_key = ?`,
      [organizationId, idempotencyKey]
    );
    if (existingIdemRow) {
      const existingSession = await sessionService.getSession(existingIdemRow.session_id);
      if (existingSession) {
        res.status(200).json({ session: existingSession, idempotentReplay: true });
        return;
      }
      // Anchor row survived but the session vanished (should be unreachable —
      // ON DELETE CASCADE removes both together). Fall through to create.
    }

    const bypassActive = isDemoBypassAllowed(process.env, requestedBypass);
    const service = bypassActive
      ? new MethodSessionService(alwaysStartablePacks, methodEventStore, outputBridge)
      : sessionService;

    const result = await service.createSession({
      organizationId,
      projectId,
      module,
      methodPackId,
      methodPackVersion,
      ownerUserId: actorUserId,
      mode,
      demoBypassActive: bypassActive,
    });

    if (!result.ok) {
      res.status(422).json({ error: 'pack_not_released', refusal: result.refusal });
      return;
    }

    // Session creator is the process owner — the FIRST transition
    // (draft -> prepared) requires the 'owner' role and nothing upstream
    // assigns it automatically otherwise.
    await sessionService.assignRole(organizationId, result.session.id, actorUserId, 'owner', actorUserId);

    const idemInsert = await DbPromise.run(
      `INSERT INTO method_session_create_idempotency (organization_id, idempotency_key, session_id, created_at)
       VALUES (?, ?, ?, ?) ON CONFLICT (organization_id, idempotency_key) DO NOTHING`,
      [organizationId, idempotencyKey, result.session.id, nowIso()],
      { fallback: false }
    );
    if (!idemInsert.success) {
      throw new Error(`method-core-http: idempotency anchor insert failed: ${idemInsert.error ?? 'unknown'}`);
    }

    res.status(201).json({
      session: result.session,
      idempotentReplay: false,
      ...(bypassActive ? { demoBypassActive: true, demoBypassNotice: DEMO_BYPASS_NOTICE } : {}),
    });
  })
);

// ---------------------------------------------------------------------------
// GET /api/method/sessions/:id — resume
// ---------------------------------------------------------------------------

router.get(
  '/sessions/:id',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const organizationId = requireOrg(req, res);
    if (!organizationId) return;
    const actorUserId = requireActor(req, res);
    if (!actorUserId) return;
    const session = await loadOwnedSession(req, res, req.params.id);
    if (!session) return;
    const roles = await sessionService.getRoles(organizationId, session.id, actorUserId);
    res.status(200).json({ session, roles });
  })
);

// ---------------------------------------------------------------------------
// GET /api/method/sessions/:id/roles — current role holders (S2)
// ---------------------------------------------------------------------------

router.get(
  '/sessions/:id/roles',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const organizationId = requireOrg(req, res);
    if (!organizationId) return;
    const session = await loadOwnedSession(req, res, req.params.id);
    if (!session) return;
    const roles = await sessionService.listRoles(organizationId, session.id);
    res.status(200).json({ roles });
  })
);

// ---------------------------------------------------------------------------
// GET /api/method/sessions/:id/roles/history — assign/revoke audit log (S2)
// ---------------------------------------------------------------------------

router.get(
  '/sessions/:id/roles/history',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const organizationId = requireOrg(req, res);
    if (!organizationId) return;
    const session = await loadOwnedSession(req, res, req.params.id);
    if (!session) return;
    const events = await sessionService.getRoleHistory(organizationId, session.id);
    res.status(200).json({ events });
  })
);

// ---------------------------------------------------------------------------
// POST /api/method/sessions/:id/roles — assign a process role (S2)
//
// Replaces the "nadaj role ręcznym SQL-em" gap this endpoint family exists
// to close (see http.integration.test.ts's `driveToInReview` helper, which
// pre-dates this route and INSERTs into method_session_roles directly — a
// real deployment has no such backdoor).
// ---------------------------------------------------------------------------

router.post(
  '/sessions/:id/roles',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const organizationId = requireOrg(req, res);
    if (!organizationId) return;
    const actorUserId = requireActor(req, res);
    if (!actorUserId) return;
    const session = await loadOwnedSession(req, res, req.params.id);
    if (!session) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const targetUserId = body.userId;
    const role = body.role;

    if (!isNonEmptyString(targetUserId)) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }
    if (typeof role !== 'string' || !(METHOD_PROCESS_ROLES as readonly string[]).includes(role)) {
      res.status(400).json({ error: 'role must be one of the closed METHOD_PROCESS_ROLES set', allowed: METHOD_PROCESS_ROLES });
      return;
    }
    const typedRole = role as MethodProcessRole;

    // --- S2 hard rule #1: no self-elevation, including "on behalf of" ------
    // `actorUserId` is ALWAYS `req.userId` from the verified token (see
    // `requireActor` above) — nothing in `body` can ever override who the
    // actor is, so a client cannot disguise a self-assignment as coming
    // from someone else by sending e.g. `assignedBy`/`onBehalfOf` fields;
    // those are simply never read.
    if (targetUserId === actorUserId && POWER_ROLES.has(typedRole)) {
      res.status(403).json({
        error: 'self_elevation_forbidden',
        message: 'A user cannot grant themselves a role that carries transition authority.',
        role: typedRole,
      });
      return;
    }

    // --- S2 hard rule #6: cross-org assignment refused ----------------------
    const targetOrgId = await getUserOrganizationId(targetUserId);
    if (targetOrgId === null || targetOrgId !== organizationId) {
      res.status(403).json({ error: 'cross_org_assignment_forbidden' });
      return;
    }

    // --- S2 hard rule #7: duplicate assignment is idempotent ---------------
    // `assignRole` itself is `ON CONFLICT ... DO NOTHING` — `inserted: false`
    // on a replay, and no second row anywhere (roster or history).
    const { inserted } = await sessionService.assignRole(organizationId, session.id, targetUserId, typedRole, actorUserId);

    res.status(inserted ? 201 : 200).json({
      role: { userId: targetUserId, role: typedRole },
      inserted,
    });
  })
);

// ---------------------------------------------------------------------------
// DELETE /api/method/sessions/:id/roles/:userId/:role — revoke (S2)
// ---------------------------------------------------------------------------

router.delete(
  '/sessions/:id/roles/:userId/:role',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const organizationId = requireOrg(req, res);
    if (!organizationId) return;
    const actorUserId = requireActor(req, res);
    if (!actorUserId) return;
    const session = await loadOwnedSession(req, res, req.params.id);
    if (!session) return;

    const { userId: targetUserId, role } = req.params;
    if (!(METHOD_PROCESS_ROLES as readonly string[]).includes(role)) {
      res.status(400).json({ error: 'role must be one of the closed METHOD_PROCESS_ROLES set', allowed: METHOD_PROCESS_ROLES });
      return;
    }

    // S2 hard rule #5: revoke never rewrites history — `revokeRole` only
    // mutates the current-roster table and APPENDS a 'revoked' event; every
    // prior 'assigned'/'revoked' row for this (session, user, role) stays.
    const { revoked } = await sessionService.revokeRole(
      organizationId,
      session.id,
      targetUserId,
      role as MethodProcessRole,
      actorUserId
    );

    if (!revoked) {
      res.status(404).json({ error: 'role_not_assigned' });
      return;
    }
    res.status(200).json({ revoked: true });
  })
);

// ---------------------------------------------------------------------------
// GET /api/method/sessions/:id/events — read history
// ---------------------------------------------------------------------------

router.get(
  '/sessions/:id/events',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const organizationId = requireOrg(req, res);
    if (!organizationId) return;
    const session = await loadOwnedSession(req, res, req.params.id);
    if (!session) return;
    const events = await methodEventStore.listBySession(organizationId, session.id);
    res.status(200).json({ events });
  })
);

// ---------------------------------------------------------------------------
// POST /api/method/sessions/:id/events — append (Idempotency-Key)
// ---------------------------------------------------------------------------

router.post(
  '/sessions/:id/events',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const organizationId = requireOrg(req, res);
    if (!organizationId) return;
    const actorUserId = requireActor(req, res);
    if (!actorUserId) return;
    const session = await loadOwnedSession(req, res, req.params.id);
    if (!session) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const type = body.type;
    if (!isMethodEventType(type)) {
      res.status(400).json({
        error: 'type must be one of the closed METHOD_EVENT_TYPES set',
        allowed: METHOD_EVENT_TYPES,
      });
      return;
    }
    const requestedActorKind = body.actorKind;
    // A caller-authenticated HTTP request can never honestly claim to BE the
    // system — 'system' events are reserved for kernel-internal writes
    // (e.g. EventDerivedOutputBridge's own OUTPUT_CREATED append).
    if (requestedActorKind !== undefined && requestedActorKind !== 'human' && requestedActorKind !== 'teresa') {
      res.status(400).json({ error: "actorKind must be 'human' or 'teresa' over this endpoint" });
      return;
    }
    const actorKind: MethodActorKind = requestedActorKind === 'teresa' ? 'teresa' : 'human';
    const unitId = isNonEmptyString(body.unitId) ? body.unitId : undefined;
    const level = typeof body.level === 'number' ? body.level : undefined;
    const supersedes = isNonEmptyString(body.supersedes) ? body.supersedes : undefined;
    const idempotencyKey = req.get('Idempotency-Key') ?? undefined;
    const payload = body.payload ?? {};

    const event = await methodEventStore.append({
      organizationId,
      sessionId: session.id,
      type: type as MethodEventType,
      unitId,
      level,
      actorKind,
      actorUserId, // provenance: always the verified caller, never client-supplied
      methodPackVersion: session.methodPackVersion, // pinned by the session, never client-supplied
      supersedes,
      idempotencyKey,
      payload,
    });

    res.status(201).json({ event });
  })
);

// ---------------------------------------------------------------------------
// POST /api/method/sessions/:id/transition — state machine
// ---------------------------------------------------------------------------

router.post(
  '/sessions/:id/transition',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const organizationId = requireOrg(req, res);
    if (!organizationId) return;
    const actorUserId = requireActor(req, res);
    if (!actorUserId) return;
    const session = await loadOwnedSession(req, res, req.params.id);
    if (!session) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const to = body.to as MethodSessionState | undefined;
    if (!to) {
      res.status(400).json({ error: 'to (target MethodSessionState) is required' });
      return;
    }
    const rationale = isNonEmptyString(body.rationale) ? body.rationale : undefined;
    const idempotencyKey = req.get('Idempotency-Key') ?? genId();

    // --- optimistic concurrency: pre-check BEFORE any write -----------------
    if (typeof body.expectedVersion === 'number' && body.expectedVersion !== session.version) {
      res.status(409).json({
        error: 'version_conflict',
        currentVersion: session.version,
        session,
      });
      return;
    }

    const result = await sessionService.transition({
      sessionId: session.id,
      to,
      actorKind: 'human',
      actorUserId,
      rationale,
      idempotencyKey,
    });

    if (!result.ok) {
      const refusal = result.refusal;
      if (refusal.kind === 'missing_permission') {
        res.status(403).json({ error: refusal.kind, requiredRole: refusal.requiredRole });
        return;
      }
      if (refusal.kind === 'illegal_transition') {
        const fresh = await sessionService.getSession(session.id);
        res.status(409).json({
          error: refusal.kind,
          from: refusal.from,
          to: refusal.to,
          currentVersion: fresh?.version ?? session.version,
          session: fresh,
        });
        return;
      }
      res.status(422).json({ error: refusal.kind, refusal });
      return;
    }

    const updated = await sessionService.getSession(session.id);
    res.status(200).json({ session: updated });
  })
);

// ---------------------------------------------------------------------------
// POST /api/method/sessions/:id/approvals — review decision (S2)
//
// Wraps `sessionService.transition()` — the SAME call `/transition` makes —
// so `TRANSITION_AUTHORITY` is enforced exactly once, by one code path:
//   'approved'   -> transition to 'frozen' (S2 hard rule #2: only 'approver'
//                   authority for the 'frozen' target lets this succeed;
//                   the kernel refuses with `missing_permission` otherwise,
//                   mapped to 403 below exactly like `/transition` does).
//   'sent_back'  -> transition to 'active' (kernel: `TRANSITION_AUTHORITY.active`
//                   = owner|lead_assessor — the contract's authority table
//                   for this target, used as-is, not a second list).
// The approval-trail row is written ONLY after the transition succeeds —
// never on a refused decision — so `GET .../approvals` never shows a
// decision that didn't actually happen.
// ---------------------------------------------------------------------------

router.post(
  '/sessions/:id/approvals',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const organizationId = requireOrg(req, res);
    if (!organizationId) return;
    const actorUserId = requireActor(req, res);
    if (!actorUserId) return;
    const idempotencyKey = requireIdempotencyKey(req, res);
    if (!idempotencyKey) return;
    const session = await loadOwnedSession(req, res, req.params.id);
    if (!session) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const decision = body.decision;
    if (decision !== 'approved' && decision !== 'sent_back') {
      res.status(400).json({ error: 'decision must be approved|sent_back' });
      return;
    }
    const comment = isNonEmptyString(body.comment) ? body.comment : null;

    // --- S2 hard rule #3: send back requires a comment ----------------------
    if (decision === 'sent_back' && !comment) {
      res.status(400).json({ error: 'comment_required_for_send_back' });
      return;
    }

    const revisionUnderReview = session.version; // stamped BEFORE the write
    const to: MethodSessionState = decision === 'approved' ? 'frozen' : 'active';

    const result = await sessionService.transition({
      sessionId: session.id,
      to,
      actorKind: 'human',
      actorUserId,
      rationale: comment ?? undefined,
      idempotencyKey,
    });

    if (!result.ok) {
      const refusal = result.refusal;
      if (refusal.kind === 'missing_permission') {
        res.status(403).json({ error: refusal.kind, requiredRole: refusal.requiredRole });
        return;
      }
      if (refusal.kind === 'illegal_transition') {
        res.status(409).json({ error: refusal.kind, from: refusal.from, to: refusal.to });
        return;
      }
      res.status(422).json({ error: refusal.kind, refusal });
      return;
    }

    // S2 hard rule #4: tied to the EXACT revision under review — `sessionId`
    // (a reopen always produces a NEW sessionId, see MethodSessionService's
    // `frozen -> active` branch) plus `revisionUnderReview` (the session's
    // `version` at the moment this decision was made, captured before the
    // transition's own version bump).
    const approval = await sessionService.recordApproval({
      organizationId,
      sessionId: session.id,
      revision: revisionUnderReview,
      decision,
      comment,
      actorUserId,
    });

    const updated = await sessionService.getSession(session.id);
    res.status(201).json({ approval, session: updated });
  })
);

// ---------------------------------------------------------------------------
// GET /api/method/sessions/:id/approvals — approval trail for THIS revision
// (S2 hard rule #4 — see recordApproval/getApprovals doc comments: scoping
// by sessionId already excludes every other revision's approvals).
// ---------------------------------------------------------------------------

router.get(
  '/sessions/:id/approvals',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const organizationId = requireOrg(req, res);
    if (!organizationId) return;
    const session = await loadOwnedSession(req, res, req.params.id);
    if (!session) return;
    const approvals = await sessionService.getApprovals(organizationId, session.id);
    res.status(200).json({ approvals });
  })
);

// ---------------------------------------------------------------------------
// POST /api/method/sessions/:id/teresa/preview — Intent -> Preview
// ---------------------------------------------------------------------------

router.post(
  '/sessions/:id/teresa/preview',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const organizationId = requireOrg(req, res);
    if (!organizationId) return;
    const actorUserId = requireActor(req, res);
    if (!actorUserId) return;
    const session = await loadOwnedSession(req, res, req.params.id);
    if (!session) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const capabilityId = body.capabilityId as TeresaCapabilityId | undefined;
    if (!capabilityId || !(TERESA_CAPABILITIES as readonly string[]).includes(capabilityId)) {
      res.status(400).json({ error: 'capabilityId must be one of the closed TERESA_CAPABILITIES set' });
      return;
    }
    const quality = body.quality as TeresaQualityVerdict | undefined;
    if (!quality || (quality.verdict !== 'valid' && quality.verdict !== 'needs_human_review' && quality.verdict !== 'invalid')) {
      res.status(400).json({ error: 'quality.verdict is required and must be a valid TeresaQualityVerdict' });
      return;
    }
    const statements = Array.isArray(body.statements) ? (body.statements as TeresaStatement[]) : [];
    const proposedChanges = Array.isArray(body.proposedChanges)
      ? (body.proposedChanges as TeresaProposedChange[])
      : [];

    const preview = await teresaProposalService.createPreview({
      organizationId,
      intent: {
        capabilityId,
        sessionId: session.id,
        unitId: isNonEmptyString(body.unitId) ? body.unitId : undefined,
        level: typeof body.level === 'number' ? body.level : undefined,
        questionId: isNonEmptyString(body.questionId) ? body.questionId : undefined,
        utterance: isNonEmptyString(body.utterance) ? body.utterance : undefined,
        invokedBy: body.invokedBy === 'conversation' ? 'conversation' : 'local_action',
        actorUserId, // provenance: never client-supplied
      },
      statements,
      proposedChanges,
      quality,
      ttlMs: typeof body.ttlMs === 'number' ? body.ttlMs : undefined,
    });

    // Mechanical provenance trail — mirrors the browser mirror's behaviour of
    // recording TERESA_PROPOSAL_CREATED at preview time.
    await methodEventStore.append({
      organizationId,
      sessionId: session.id,
      type: 'TERESA_PROPOSAL_CREATED',
      unitId: preview.intent.unitId,
      level: preview.intent.level,
      actorKind: 'teresa',
      actorUserId,
      methodPackVersion: session.methodPackVersion,
      idempotencyKey: `teresa-preview:${preview.previewId}`,
      payload: {
        proposalId: preview.previewId,
        capabilityId,
        previewRef: preview.previewId,
        qualityVerdict: preview.quality.verdict,
      },
    });

    res.status(201).json({ preview });
  })
);

// ---------------------------------------------------------------------------
// POST /api/method/sessions/:id/teresa/commit — commit (previewId required)
// ---------------------------------------------------------------------------

router.post(
  '/sessions/:id/teresa/commit',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const organizationId = requireOrg(req, res);
    if (!organizationId) return;
    const actorUserId = requireActor(req, res);
    if (!actorUserId) return;
    const session = await loadOwnedSession(req, res, req.params.id);
    if (!session) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const previewId = body.previewId;
    if (!isNonEmptyString(previewId)) {
      res.status(400).json({ error: 'previewId is required — a commit without a preview is unrepresentable' });
      return;
    }
    const decision = body.decision;
    if (
      decision !== 'accept' &&
      decision !== 'accept_with_edits' &&
      decision !== 'reject' &&
      decision !== 'rethink'
    ) {
      res.status(400).json({ error: 'decision must be accept|accept_with_edits|reject|rethink' });
      return;
    }
    const idempotencyKey = requireIdempotencyKey(req, res);
    if (!idempotencyKey) return;

    const commitRequest: TeresaCommitRequest = {
      previewId,
      decision,
      editedChanges: Array.isArray(body.editedChanges) ? (body.editedChanges as TeresaProposedChange[]) : undefined,
      actorUserId, // provenance: never client-supplied
      idempotencyKey,
    };

    const preview = await teresaProposalService.getPreview(organizationId, previewId);
    const result = await teresaProposalService.commit(organizationId, commitRequest);

    if (!result.ok) {
      const refusal = result.refusal;
      const status =
        refusal.kind === 'preview_not_found'
          ? 404
          : refusal.kind === 'quality_invalid'
            ? 422
            : 409; // preview_already_consumed | preview_expired | session_frozen | forbidden_effect | missing_permission
      res.status(status).json({ error: refusal.kind, refusal });
      return;
    }

    // TeresaProposalService.commit only marks the preview consumed; recording
    // the domain event (TERESA_PROPOSAL_ACCEPTED/REJECTED) is this route's
    // job, mirroring the browser mirror. idempotencyKey-keyed so a retry of
    // this exact request never appends a second event.
    const eventType = decision === 'reject' ? 'TERESA_PROPOSAL_REJECTED' : 'TERESA_PROPOSAL_ACCEPTED';
    const event = await methodEventStore.append({
      organizationId,
      sessionId: session.id,
      type: eventType,
      unitId: preview?.intent.unitId,
      level: preview?.intent.level,
      actorKind: 'human',
      actorUserId,
      methodPackVersion: session.methodPackVersion,
      idempotencyKey: `teresa-commit:${idempotencyKey}`,
      payload: {
        proposalId: previewId,
        previewRef: previewId,
        decision,
        qualityVerdict: preview?.quality.verdict ?? 'invalid',
      },
    });

    res.status(200).json({ ok: true, eventIds: [event.id] });
  })
);

// ---------------------------------------------------------------------------
// POST /api/method/sessions/:id/freeze — freeze -> Output (Idempotency-Key)
// ---------------------------------------------------------------------------

router.post(
  '/sessions/:id/freeze',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const organizationId = requireOrg(req, res);
    if (!organizationId) return;
    const actorUserId = requireActor(req, res);
    if (!actorUserId) return;
    const idempotencyKey = requireIdempotencyKey(req, res);
    if (!idempotencyKey) return;
    let session = await loadOwnedSession(req, res, req.params.id);
    if (!session) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    if (typeof body.expectedVersion === 'number' && body.expectedVersion !== session.version && session.state !== 'frozen') {
      res.status(409).json({ error: 'version_conflict', currentVersion: session.version, session });
      return;
    }

    if (session.state !== 'frozen') {
      const result = await sessionService.transition({
        sessionId: session.id,
        to: 'frozen',
        actorKind: 'human',
        actorUserId,
        idempotencyKey,
      });
      if (!result.ok) {
        const refusal = result.refusal;
        if (refusal.kind === 'missing_permission') {
          res.status(403).json({ error: refusal.kind, requiredRole: refusal.requiredRole });
          return;
        }
        if (refusal.kind === 'illegal_transition') {
          res.status(409).json({ error: refusal.kind, from: refusal.from, to: refusal.to });
          return;
        }
        res.status(422).json({ error: refusal.kind, refusal });
        return;
      }
      const reloaded = await sessionService.getSession(session.id);
      if (!reloaded) {
        throw new Error(`method-core-http: session vanished right after freeze: ${session.id}`);
      }
      session = reloaded;
    }

    // Idempotent replay AND self-heal for "interrupted between freeze and
    // Output" (see EventDerivedOutputBridge's header comment on the exact
    // window this covers: state already 'frozen', frozen_snapshot_id already
    // durable, but the Output insert never landed).
    let outputs = await methodOutputService.listOutputsBySession(organizationId, session.id);
    let output = outputs[0] ?? null;
    let selfHealed = false;
    if (!output) {
      if (!session.frozenSnapshotId) {
        throw new Error(
          `method-core-http: session ${session.id} is frozen with no frozen_snapshot_id — cannot self-heal Output`
        );
      }
      await outputBridge.onSessionFrozen({
        organizationId,
        sessionId: session.id,
        snapshotId: session.frozenSnapshotId,
        module: session.module,
        methodPackId: session.methodPackId,
        methodPackVersion: session.methodPackVersion,
      });
      outputs = await methodOutputService.listOutputsBySession(organizationId, session.id);
      output = outputs[0] ?? null;
      selfHealed = true;
      if (!output) {
        throw new Error(`method-core-http: self-heal did not produce an Output for session ${session.id}`);
      }
    }

    res.status(200).json({ session, output, selfHealed });
  })
);

// ---------------------------------------------------------------------------
// GET /api/method/outputs/:id — immutable Output
// ---------------------------------------------------------------------------

router.get(
  '/outputs/:id',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const organizationId = requireOrg(req, res);
    if (!organizationId) return;
    const output = await methodOutputService.getOutput(organizationId, req.params.id);
    if (!output) {
      res.status(404).json({ error: 'Output not found' });
      return;
    }
    const supersession = await methodOutputService.isSuperseded(organizationId, output.id);
    res.status(200).json({ output, ...supersession });
  })
);

/**
 * Shared body for POST .../report and POST .../presentation — both render a
 * structured snapshot from the SAME immutable Output, differing only in
 * `kind` (10_ASSESSMENT_REVIEW.md §15 / METHOD_MODULE_FIVE_SURFACES_
 * STANDARD.md §4: a Presentation is another view of the same frozen
 * Artifact, not a second source of truth, and never a screenshot).
 */
async function createArtefactSnapshot(
  req: AuthedRequest,
  res: Response,
  kind: MethodArtefactKind
): Promise<void> {
  const organizationId = requireOrg(req, res);
  if (!organizationId) return;
  const output = await methodOutputService.getOutput(organizationId, req.params.id);
  if (!output) {
    res.status(404).json({ error: 'Output not found' });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (!isNonEmptyString(body.title)) {
    res.status(400).json({ error: 'title is required' });
    return;
  }
  if (body.content == null) {
    res.status(400).json({ error: 'content (structured — never an image) is required' });
    return;
  }
  // Integrity: the hash is computed server-side from the content actually
  // stored, never trusted from the client.
  const contentHash = computeContentHash(body.content);

  // Supersede every current Report/Presentation/Initiative Draft across the
  // WHOLE reopen lineage this Output belongs to, not just this Output's own
  // session — see collectLineageSessionIds's doc comment.
  await supersedeLineageResultsFor(organizationId, output);

  const snapshot = await methodReportSnapshotService.create({
    organizationId,
    outputId: output.id,
    sessionId: output.sessionId,
    title: body.title,
    content: body.content,
    contentHash,
    kind,
    // ★ Explicit demonstration marker, inherited from the Output (which
    // inherited it from the session) — never re-derived from the request,
    // never silently dropped. See MethodOutputService.demoBypassActive.
    demoBypassActive: output.demoBypassActive,
  });

  res.status(201).json({
    report: snapshot,
    ...(output.demoBypassActive ? { demoBypassActive: true, demoBypassNotice: DEMO_BYPASS_NOTICE } : {}),
  });
}

// ---------------------------------------------------------------------------
// POST /api/method/outputs/:id/report — Report Snapshot
// ---------------------------------------------------------------------------

router.post(
  '/outputs/:id/report',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    await createArtefactSnapshot(req, res, 'report');
  })
);

// ---------------------------------------------------------------------------
// POST /api/method/outputs/:id/presentation — Presentation, SAME Output,
// SAME snapshot discipline as Report (never a screenshot — see
// createArtefactSnapshot's doc comment).
// ---------------------------------------------------------------------------

router.post(
  '/outputs/:id/presentation',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    await createArtefactSnapshot(req, res, 'presentation');
  })
);

// ---------------------------------------------------------------------------
// POST /api/method/outputs/:id/initiative-drafts — Initiative Proposal
// ---------------------------------------------------------------------------

router.post(
  '/outputs/:id/initiative-drafts',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const organizationId = requireOrg(req, res);
    if (!organizationId) return;
    const output = await methodOutputService.getOutput(organizationId, req.params.id);
    if (!output) {
      res.status(404).json({ error: 'Output not found' });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const findingIds = Array.isArray(body.findingIds) ? (body.findingIds as string[]) : [];
    if (findingIds.length === 0) {
      res.status(400).json({ error: 'findingIds must be a non-empty array' });
      return;
    }
    const realFindingIds = new Set(output.findings.map((f) => f.id));
    const unknownIds = findingIds.filter((id) => !realFindingIds.has(id));
    if (unknownIds.length > 0) {
      res.status(400).json({ error: 'findingIds contains ids not present on this Output', unknownIds });
      return;
    }
    if (!isNonEmptyString(body.title)) {
      res.status(400).json({ error: 'title is required' });
      return;
    }
    if (!isNonEmptyString(body.rationale) || !isNonEmptyString(body.expectedOutcome)) {
      res.status(400).json({ error: 'rationale and expectedOutcome are required' });
      return;
    }
    const confidence = body.confidence;
    if (confidence !== 'low' && confidence !== 'medium' && confidence !== 'high') {
      res.status(400).json({ error: 'confidence must be low|medium|high' });
      return;
    }

    // Same lineage-wide supersession as Report/Presentation — a fresh
    // Initiative Draft against a NEW (corrected-revision) Output must mark
    // the OLD session's current draft(s) as superseded, not just this
    // Output's own (new) session, which has none yet on a first draft.
    await supersedeLineageResultsFor(organizationId, output);

    // ★ No `register`/`registerInitiative` call exists anywhere in this file
    // or in MethodInitiativeDraftService — "Register as Initiative" has no
    // HTTP path here by construction, not by omission. See
    // MethodInitiativeDraftService's header comment and this route's
    // integration test ("Initiative Draft has no path to Registered").
    const draft = await methodInitiativeDraftService.create({
      organizationId,
      outputId: output.id,
      sessionId: output.sessionId,
      title: body.title,
      summary: isNonEmptyString(body.summary) ? body.summary : null,
      findingIds,
      rationale: body.rationale,
      expectedOutcome: body.expectedOutcome,
      kpiProposal: body.kpiProposal ?? null,
      dependencies: Array.isArray(body.dependencies) ? body.dependencies : [],
      risks: Array.isArray(body.risks) ? body.risks : [],
      evidenceLinks: Array.isArray(body.evidenceLinks) ? (body.evidenceLinks as string[]) : [],
      confidence,
    });

    res.status(201).json({ draft });
  })
);

export default router;

// Re-exported so tests/other server code can type-check against the same
// role/actor vocabulary this router enforces without reaching into contracts
// directly.
export type { MethodProcessRole };
export { METHOD_PROCESS_ROLES };
