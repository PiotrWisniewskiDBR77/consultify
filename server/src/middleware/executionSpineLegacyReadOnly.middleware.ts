import type { NextFunction, Request, Response } from 'express';

export const EXECUTION_SPINE_LEGACY_READ_ONLY_CODE =
  'EXECUTION_RUNTIME_V1_WRITE_REQUIRED' as const;

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
