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
// All beta modules are currently 'open' in the client-side betaAccess.ts SSOT.
// This middleware mirrors that state: pass through all requests.
// Re-enable per-module gating here when any module is set back to 'closed'.
export function betaGate(req: Request, res: Response, next: NextFunction): void {
  next();
}

export function createBetaGate(_skipPaths: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    next();
  };
}
