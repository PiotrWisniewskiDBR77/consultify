/**
 * Case Workspace routes — shared actor/org extraction + async-handler wrapper.
 *
 * Every case-workspace route handler goes through `caseWorkspaceHandler()`
 * instead of the generic `asyncHandler` used elsewhere in this codebase, so
 * that ANY error thrown inside — a domain service's `Error('some_code')`, a
 * `CaseWorkspaceAuthError`, a zod validation failure, or a genuine bug — is
 * funneled through the same `toCaseWorkspaceAppError()` mapping
 * (./errors.ts) before reaching Express's error middleware. This is what
 * item (4) of the task brief ("map domain errors to stable HTTP status
 * codes without leaking internals") actually means in code: one funnel, not
 * 90 ad-hoc try/catch blocks with different shapes.
 *
 * `resolveActor()` is the ONLY way route handlers in this directory read
 * organizationId/actorUserId. It reads from the already-authenticated
 * `v8Context` (attached upstream by `attachV8Context` — see
 * server/src/middleware/v8Auth.middleware.ts) and NEVER from
 * `req.body`/`req.query`. A route handler that instead destructures
 * `organizationId` out of `req.body` and forwards it to a service call is a
 * bug — see the CLAUDE-facing task brief's explicit warning about this.
 */

import type { NextFunction, Response } from 'express';

import type { AuthRequest } from '../../../middleware/auth.middleware.js';
import { getV8Context } from '../../../middleware/v8Auth.middleware.js';
import { resolveCorrelationId, toCaseWorkspaceAppError } from './errors.js';

export interface CaseWorkspaceActor {
  actorUserId: string;
  organizationId: string;
  userRole: string;
  isSuperAdmin: boolean;
  correlationId: string;
}

/**
 * Reads the authenticated actor + org context and this request's
 * correlation id. Throws (via getV8Context) if `attachV8Context` was not
 * applied upstream of this router — that is a mounting bug, not a client
 * error, and is correctly funneled to a 500 by caseWorkspaceHandler.
 */
export function resolveActor(req: AuthRequest): CaseWorkspaceActor {
  const ctx = getV8Context(req);
  const correlationId = resolveCorrelationId(req);
  return {
    actorUserId: ctx.userId,
    organizationId: ctx.organizationId,
    userRole: ctx.userRole,
    isSuperAdmin: ctx.isSuperAdmin,
    correlationId,
  };
}

/** Reads the `Idempotency-Key` request header, trimmed, or undefined. */
export function readIdempotencyKeyHeader(req: AuthRequest): string | undefined {
  const raw = typeof req.get === 'function' ? req.get('Idempotency-Key') : undefined;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
}

type CaseWorkspaceRouteFn = (req: AuthRequest, res: Response, actor: CaseWorkspaceActor) => Promise<void>;

/**
 * Wraps a case-workspace route handler: resolves the actor once, invokes
 * `fn`, and funnels any thrown error through `toCaseWorkspaceAppError` +
 * `next(...)`. Handlers should throw (not res.json an error shape
 * themselves) for every failure path — including validation failures raised
 * via `validateBody`/`validateQuery` in ./validate.ts.
 */
export function caseWorkspaceHandler(fn: CaseWorkspaceRouteFn) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    let actor: CaseWorkspaceActor;
    try {
      actor = resolveActor(req);
    } catch (err) {
      next(toCaseWorkspaceAppError(err, resolveCorrelationIdSafe(req)));
      return;
    }
    Promise.resolve(fn(req, res, actor)).catch((err) => {
      next(toCaseWorkspaceAppError(err, actor.correlationId));
    });
  };
}

function resolveCorrelationIdSafe(req: AuthRequest): string {
  try {
    return resolveCorrelationId(req);
  } catch {
    return 'unknown';
  }
}
