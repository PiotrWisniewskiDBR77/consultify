/**
 * Shared Method Kernel — roles, assignment and approval HTTP surface
 * (agent S2, CEL 3, 2026-08-13).
 *
 * OWN router, mounted alongside (not inside) `method-core.routes.ts` (S1) at
 * the SAME `/api/method` prefix (see `server/src/Gateway.ts`) — the path
 * segments below (`.../roles`, `.../roles/history`, `.../approval-trail`,
 * `.../send-back`) are disjoint from every path S1's router owns, so the two
 * routers coexist without collision. This file does not import from or
 * modify `method-core.routes.ts`; it only imports the SAME shared kernel
 * services (`MethodSessionService`, `MethodEventStore`) that file already
 * depends on, exactly the way any two independent consumers of the kernel
 * would.
 *
 * Endpoints:
 *   GET    /api/method/sessions/:id/roles                — current assignments
 *   POST   /api/method/sessions/:id/roles                 — grant (idempotent)
 *   DELETE /api/method/sessions/:id/roles/:userId/:role   — revoke
 *   GET    /api/method/sessions/:id/roles/history          — append-only ledger
 *   GET    /api/method/sessions/:id/approval-trail          — decision events
 *   POST   /api/method/sessions/:id/send-back              — reject, requires a comment
 *
 * Same HTTP/tenancy/auth discipline as `method-core.routes.ts`:
 *  - `verifyToken`/`isAuthenticated` gate the whole router.
 *  - every read/write re-derives `organizationId`/`actorUserId` from the
 *    VERIFIED token, never from the request body.
 *  - a session that exists but belongs to a different org is 404 on GET,
 *    403 on an explicit ownership mismatch — same convention as S1's
 *    `loadOwnedSession` (this file has its own copy; sharing one across two
 *    independently-owned route files would create exactly the coupling the
 *    worktree split up front is designed to avoid).
 *
 * See `server/src/method-core/MethodSessionRoleService.ts` for the actual
 * rules (self-approver refusal, append-only history, approval trail scoped
 * to one exact revision, send-back requiring a comment).
 */

import { Router, type Request, type Response } from 'express';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

import { METHOD_PROCESS_ROLES, type MethodProcessRole } from '../method-core/contracts/index.js';
import { methodEventStore } from '../method-core/MethodEventStore.js';
import { methodPackRegistry } from '../method-core/MethodPackRegistry.js';
import { MethodSessionService } from '../method-core/MethodSessionService.js';
import { MethodSessionRoleService } from '../method-core/MethodSessionRoleService.js';
import { genId } from '../method-core/db.js';

// ---------------------------------------------------------------------------
// Wiring — a SEPARATE MethodSessionService instance from S1's (no outputBridge:
// this router only ever transitions sessions TOWARD 'active', never 'frozen',
// so the freeze->Output bridge is never exercised here and does not need to
// be wired). Same `methodPackRegistry`/`methodEventStore` singletons S1 uses.
// ---------------------------------------------------------------------------

const sessionService = new MethodSessionService(methodPackRegistry, methodEventStore);
const roleService = new MethodSessionRoleService(sessionService, methodEventStore);

interface AuthedRequest extends Request {
  organizationId?: string;
  userId?: string;
}

const router = Router();

router.use(verifyToken, isAuthenticated);

// ---------------------------------------------------------------------------
// Small shared helpers — deliberately NOT imported from method-core.routes.ts
// (S1's file is off-limits to this agent's scope; duplicating ~15 lines here
// keeps the two router files independently mergeable).
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Loads a session and enforces tenant isolation — same convention as S1's
 * `loadOwnedSession`: not-found -> 404, found-but-other-org -> 403 (hard
 * rule #6: cross-org assignment/read is refused, not silently scoped away).
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

function isMethodProcessRole(value: unknown): value is MethodProcessRole {
  return typeof value === 'string' && (METHOD_PROCESS_ROLES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// GET /api/method/sessions/:id/roles — current assignments
// ---------------------------------------------------------------------------

router.get(
  '/sessions/:id/roles',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const organizationId = requireOrg(req, res);
    if (!organizationId) return;
    const session = await loadOwnedSession(req, res, req.params.id);
    if (!session) return;
    const roles = await roleService.listRoles(organizationId, session.id);
    res.status(200).json({ roles });
  })
);

// ---------------------------------------------------------------------------
// POST /api/method/sessions/:id/roles — grant (idempotent)
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
    if (!isMethodProcessRole(role)) {
      res.status(400).json({ error: 'role must be one of the closed METHOD_PROCESS_ROLES set', allowed: METHOD_PROCESS_ROLES });
      return;
    }

    const result = await roleService.assignRole({
      organizationId,
      sessionId: session.id,
      targetUserId,
      role,
      actorUserId,
    });

    if (!result.ok) {
      if (result.refusal.kind === 'cannot_self_assign_approver') {
        res.status(403).json({ error: result.refusal.kind });
        return;
      }
      res.status(400).json({ error: result.refusal.kind });
      return;
    }

    res.status(result.alreadyGranted ? 200 : 201).json({
      assignment: result.assignment,
      alreadyGranted: result.alreadyGranted,
    });
  })
);

// ---------------------------------------------------------------------------
// DELETE /api/method/sessions/:id/roles/:userId/:role — revoke
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

    const targetUserId = req.params.userId;
    const role = req.params.role;
    if (!isMethodProcessRole(role)) {
      res.status(400).json({ error: 'role must be one of the closed METHOD_PROCESS_ROLES set', allowed: METHOD_PROCESS_ROLES });
      return;
    }

    const result = await roleService.revokeRole({
      organizationId,
      sessionId: session.id,
      targetUserId,
      role,
      actorUserId,
    });

    res.status(200).json({ revoked: result.revoked });
  })
);

// ---------------------------------------------------------------------------
// GET /api/method/sessions/:id/roles/history — append-only ledger
// ---------------------------------------------------------------------------

router.get(
  '/sessions/:id/roles/history',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const organizationId = requireOrg(req, res);
    if (!organizationId) return;
    const session = await loadOwnedSession(req, res, req.params.id);
    if (!session) return;
    const history = await roleService.roleHistory(organizationId, session.id);
    res.status(200).json({ history });
  })
);

// ---------------------------------------------------------------------------
// GET /api/method/sessions/:id/approval-trail — decision events
// ---------------------------------------------------------------------------

router.get(
  '/sessions/:id/approval-trail',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const organizationId = requireOrg(req, res);
    if (!organizationId) return;
    const session = await loadOwnedSession(req, res, req.params.id);
    if (!session) return;
    const trail = await roleService.approvalTrail(organizationId, session.id);
    res.status(200).json({ trail });
  })
);

// ---------------------------------------------------------------------------
// POST /api/method/sessions/:id/send-back — reject, requires a comment
// ---------------------------------------------------------------------------

router.post(
  '/sessions/:id/send-back',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const organizationId = requireOrg(req, res);
    if (!organizationId) return;
    const actorUserId = requireActor(req, res);
    if (!actorUserId) return;
    const session = await loadOwnedSession(req, res, req.params.id);
    if (!session) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const comment = body.comment;
    if (!isNonEmptyString(comment)) {
      res.status(400).json({ error: 'comment is required — a send-back without a reason is unrepresentable' });
      return;
    }
    const idempotencyKey = req.get('Idempotency-Key') ?? genId();

    const result = await roleService.sendBack({
      organizationId,
      sessionId: session.id,
      actorUserId,
      comment,
      idempotencyKey,
    });

    if (!result.ok) {
      const refusal = result.refusal;
      if (refusal.kind === 'missing_permission') {
        res.status(403).json({ error: refusal.kind, requiredRole: refusal.requiredRole });
        return;
      }
      res.status(409).json({ error: refusal.kind, from: refusal.from, to: refusal.to });
      return;
    }

    res.status(200).json({ session: result.session, newRevision: result.newRevision });
  })
);

export default router;
