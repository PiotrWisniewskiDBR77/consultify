import type { NextFunction, Request, Response } from 'express';

/**
 * Server-side mirror of the client betaAccess.ts SSOT.
 * Returns 403 BETA_LOCKED for any request that reaches a beta-closed module API.
 *
 * Usage: app.use('/api/meeting', betaGate, meetingRoutes)
 *
 * For modules with public sub-paths (e.g. presentations share links) use
 * createBetaGate(skipPaths) to pass prefixes that should remain accessible.
 */
export function betaGate(req: Request, res: Response, next: NextFunction): void {
  res.status(403).json({
    error: 'BETA_LOCKED',
    message: 'This module is currently in closed beta and is not yet accessible.',
  });
}

export function createBetaGate(skipPaths: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (skipPaths.some((p) => req.path.startsWith(p))) {
      next();
      return;
    }
    res.status(403).json({
      error: 'BETA_LOCKED',
      message: 'This module is currently in closed beta and is not yet accessible.',
    });
  };
}
