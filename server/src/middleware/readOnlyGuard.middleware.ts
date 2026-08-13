/**
 * KPI-E007 — generic read-only method gate.
 *
 * Design: docs/product/results-vnext/KPI_E007_DESIGN.md §5 (Decision D5).
 *
 * New, distinct file — NOT added to `demoGuard.middleware.ts`. That file's
 * `demoWriteProtection` is about demo-mode write suppression (conditional:
 * writes are allowed outside demo mode). `denyMutations` here is a different,
 * simpler concept: any request whose method is not GET/HEAD/OPTIONS is
 * rejected before it reaches auth or a route handler, unconditionally, for
 * every route registered behind it. Keeping this in its own generically-named
 * file avoids a future maintainer reading `demoGuard.middleware.ts` and
 * wrongly concluding this gate only applies in demo mode.
 */
import type { NextFunction, Request, Response } from 'express';

/**
 * Generic method gate: any request whose method is not GET/HEAD/OPTIONS is
 * rejected before it reaches auth or a route handler. Intended for routers
 * that must be structurally incapable of mutation (e.g. read-only legacy
 * archives), independent of what handlers happen to be registered on the
 * router.
 */
export const denyMutations = (req: Request, res: Response, next: NextFunction): void => {
  const method = String(req.method || '').toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    next();
    return;
  }
  res.status(405).json({
    error: 'Legacy archive is read-only',
    code: 'LEGACY_ARCHIVE_READ_ONLY',
  });
};
