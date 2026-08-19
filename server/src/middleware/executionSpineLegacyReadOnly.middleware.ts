import type { NextFunction, Request, Response } from 'express';

export const EXECUTION_SPINE_LEGACY_READ_ONLY_CODE = 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED' as const;

const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * AMD-EXE-SPINE-AUTHORITY-004 (26A).
 *
 * Mount this only after the surface's normal authentication and tenant
 * membership middleware. Legacy execution readers remain available during
 * the compatibility window, but mutations must enter through Runtime-v1 so
 * there is exactly one execution-work writer and receipt lineage.
 */
export function requireCanonicalExecutionWriter(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const method = String(req.method || '').toUpperCase();
  if (READ_ONLY_METHODS.has(method)) {
    next();
    return;
  }

  res.status(409).json({
    error: 'Legacy execution writes are retired. Use the canonical Runtime-v1 execution API.',
    code: EXECUTION_SPINE_LEGACY_READ_ONLY_CODE,
    canonicalWriter: '/api/initiatives/runtime-v1',
  });
}

/**
 * The Initiative router also owns discovery, authoring and governance APIs
 * which are not execution-work writers. Decision 26A retires only the legacy
 * execution subresources; it must not turn the whole Initiative product into
 * a read-only surface.
 */
const LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS = [
  /^\/[^/]+\/(?:start-execution|block|unblock|complete|move)\/?$/,
  /^\/[^/]+\/(?:milestones|resources|staffing-plans|budget-items|raid|gate-roles)(?:\/.*)?$/,
  /^\/[^/]+\/(?:lifecycle-transition-proposals|lifecycle-transition-executions|lifecycle-gate-decisions)(?:\/.*)?$/,
  /^\/[^/]+\/(?:apply-template|apply-blueprint|changes)\/?$/,
];

export function requireCanonicalInitiativeExecutionWriter(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const method = String(req.method || '').toUpperCase();
  const path = String(req.path || '');
  if (
    READ_ONLY_METHODS.has(method) ||
    !LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS.some((pattern) => pattern.test(path))
  ) {
    next();
    return;
  }

  requireCanonicalExecutionWriter(req, res, next);
}
