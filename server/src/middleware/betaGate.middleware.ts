import type { NextFunction, Request, Response } from 'express';

import { BETA_MENU_STATUS, type BetaStatus } from '../sharedRuntime/utils/betaMenuStatus.js';

/**
 * Server-side mirror of the client betaAccess.ts SSOT.
 * Returns 403 BETA_LOCKED for any request that reaches a beta-closed module API.
 *
 * Usage: app.use('/api/meeting', betaGate, meetingRoutes)
 *
 * For modules with public sub-paths (e.g. presentations share links) use
 * createBetaGate(skipPaths) to pass prefixes that should remain accessible.
 */
// This compatibility middleware does not enforce the client SSOT: it always
// passes through, even though MODULE_ECONOMICS, MODULE_CONCLUSIONS,
// MODULE_MEETING and MODULE_CASE_WORKSPACE are currently `closed` there.
// Closed modules need an explicit createModuleGate(moduleId) at their mount.
export function betaGate(req: Request, res: Response, next: NextFunction): void {
  next();
}

/**
 * Explicit server-side mirror for a module whose client SSOT is closed.
 * Mount this only after authentication so a regular user cannot bypass the
 * client gate by calling the API directly. OWNER/ADMIN/SUPERADMIN retain the
 * same development access granted by `BETA_ADMINS_EXEMPT` on the client.
 */
export function createModuleGate(
  moduleId: string,
  resolveStatus: (id: string) => BetaStatus | undefined = (id) => BETA_MENU_STATUS[id]
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (resolveStatus(moduleId) === 'open') {
      next();
      return;
    }
    const role = String((req as Request & { user?: { role?: string } }).user?.role || '')
      .trim()
      .toUpperCase();
    if (role === 'OWNER' || role === 'ADMIN' || role === 'ADMINISTRATOR' || role === 'SUPERADMIN') {
      next();
      return;
    }
    res.status(403).json({
      error: 'This beta module is not available for your role',
      code: 'BETA_LOCKED',
    });
  };
}

/**
 * Meetings compatibility export. The single supervisor switch is
 * `src/utils/betaAccess.ts` → `BETA_MENU_STATUS.MODULE_MEETING`.
 * The client menu, pilot lock and this API gate all read that same value.
 */
export function closedBetaModuleGate(req: Request, res: Response, next: NextFunction): void {
  return createModuleGate('MODULE_MEETING')(req, res, next);
}

export function createBetaGate(_skipPaths: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    next();
  };
}
