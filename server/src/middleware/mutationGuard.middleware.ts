import type { NextFunction, Request, Response } from 'express';

import logger from '../utils/Logger.js';

/**
 * H5.4 — canary guard for v8 mutation endpoints.
 *
 * Detects (and logs) when a client disconnects mid-mutation so an abandoned
 * POST/PUT/PATCH/DELETE shows up in the logs instead of silently vanishing.
 *
 * IMPORTANT — this middleware NEVER gates the pipeline: it always calls
 * next() synchronously on the same tick and never touches res.status/json/
 * end. It only attaches passive `finish`/`close` listeners. That means it
 * structurally cannot reproduce the req.destroyed hang regression documented
 * in `v8Auth.middleware.ts` (that bug came from returning early WITHOUT
 * calling next(), not from logging).
 *
 * It also deliberately does NOT use `req.destroyed` as a trigger:
 * express.json() marks the request's IncomingMessage stream as destroyed
 * once the body has been consumed — true for essentially every mutation,
 * long before the handler has finished — so it is not a real "client is
 * gone" signal. See the NOTE in `v8Auth.middleware.ts` for the full
 * regression history (re-added in 46a1674000, fixed in 1814b4582e).
 *
 * Instead this mirrors the pattern already used for SSE streams in
 * `ai.routes.ts` (`req.socket.on('close'|'error')` + `res.on('close')` +
 * `res.destroyed`/`writableEnded`): listen for the response's `close` event
 * (fires when the underlying connection is torn down) and cross-check
 * whether the response had actually finished writing. If it hadn't, the
 * client genuinely disconnected mid-mutation.
 */

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const LISTENERS_ATTACHED = Symbol('mutationGuard.listeners.attached');
const RESPONSE_SETTLED = Symbol('mutationGuard.response.settled');

export interface MutationGuardableRequest extends Request {
  mutationAborted?: boolean;
}

const safeRead = <T>(reader: () => T, fallback: T): T => {
  try {
    const value = reader();
    return value === undefined || value === null ? fallback : value;
  } catch {
    return fallback;
  }
};

const isCallable = (value: unknown): value is (...args: unknown[]) => unknown =>
  typeof value === 'function';

/**
 * Ops kill-switch, opt-in by default. This guard is purely observational
 * (see module doc above) so the blast radius of a bug here is "a missing log
 * line", not "a hung mutation" — but per H5.4 scope ("za flagą jeśli
 * ryzykowne wpięcie globalne") it still ships inert until explicitly turned
 * on with ENABLE_MUTATION_ABORT_GUARD=true.
 */
export const isMutationAbortCanaryEnabled = (): boolean =>
  safeRead(() => process.env.ENABLE_MUTATION_ABORT_GUARD === 'true', false);

/** Best-effort flag a handler MAY consult before doing extra side effects
 * (e.g. skip a follow-up notification) once its primary await resolves.
 * Nothing in this change requires callers to check it — it's additive. */
export const isMutationAborted = (req: Request): boolean =>
  Boolean(safeRead(() => (req as MutationGuardableRequest).mutationAborted, false));

const resolveOrgId = (req: Request): string | undefined =>
  safeRead(
    () =>
      (req as any).organizationId ||
      (req as any).v8Context?.organizationId ||
      (req as any).user?.organizationId ||
      undefined,
    undefined
  );

const resolveUserId = (req: Request): string | undefined =>
  safeRead(
    () =>
      (req as any).userId || (req as any).v8Context?.userId || (req as any).user?.id || undefined,
    undefined
  );

const resolvePath = (req: Request): string =>
  safeRead(() => (req as any).originalUrl || (req as any).url || '', 'unknown');

const isResponseSettled = (res: Response): boolean =>
  safeRead(() => (res as any)[RESPONSE_SETTLED], false) ||
  safeRead(() => (res as any).writableEnded, false) ||
  safeRead(() => (res as any).finished, false);

const registerListener = (
  res: Response,
  event: 'finish' | 'close',
  handler: () => void
): boolean => {
  const onceFn = (res as any).once;
  if (isCallable(onceFn)) {
    try {
      onceFn.call(res, event, handler);
      return true;
    } catch {
      // fall through and try `on`
    }
  }
  const onFn = (res as any).on;
  if (isCallable(onFn)) {
    try {
      onFn.call(res, event, handler);
      return true;
    } catch {
      return false;
    }
  }
  return false;
};

export const mutationAbortCanary = (req: Request, res: Response, next: NextFunction): void => {
  const safeNext = (): void => {
    if (isCallable(next)) next();
  };

  if (!isMutationAbortCanaryEnabled()) {
    safeNext();
    return;
  }
  if (!res || typeof res !== 'object') {
    safeNext();
    return;
  }
  const method = String(safeRead(() => (req as any).method, '')).toUpperCase();
  if (!MUTATION_METHODS.has(method)) {
    safeNext();
    return;
  }
  if (safeRead(() => (res as any)[LISTENERS_ATTACHED], false)) {
    safeNext();
    return;
  }

  const startedAt = safeRead(() => Date.now(), 0);

  const markSettled = (): void => {
    try {
      (res as any)[RESPONSE_SETTLED] = true;
    } catch {
      // best effort
    }
  };

  const onAbort = (): void => {
    if (isResponseSettled(res)) return;
    try {
      (req as MutationGuardableRequest).mutationAborted = true;
    } catch {
      // best-effort flag only, never throw from a lifecycle listener
    }
    try {
      logger.warn('[MutationGuard] client disconnected mid-mutation', {
        method,
        path: resolvePath(req),
        durationMs: Math.max(0, safeRead(() => Date.now(), startedAt) - startedAt),
        organizationId: resolveOrgId(req),
        userId: resolveUserId(req),
      });
    } catch {
      // logging must never break the request lifecycle
    }
  };

  const finishRegistered = registerListener(res, 'finish', markSettled);
  const closeRegistered = registerListener(res, 'close', onAbort);
  if (finishRegistered || closeRegistered) {
    try {
      (res as any)[LISTENERS_ATTACHED] = true;
    } catch {
      // non-fatal — worst case we attach twice on a pathological res object
    }
  }

  safeNext();
};

export default mutationAbortCanary;
