/**
 * Framework Entitlement Middleware
 * Enforces framework-level access on API routes.
 */
import { NextFunction, Request, Response } from 'express';

import FrameworkEntitlementService from '../services/frameworkEntitlementService.js';
import logger from '../utils/Logger.js';

interface AuthRequest extends Request {
  user?: { id: string; organizationId: string; role?: string };
  frameworkAccess?: { allowed: boolean; accessLevel: string; requiresLegalNotice: boolean };
}

export function requireFrameworkAccess(frameworkId: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    const result = await FrameworkEntitlementService.checkAccess(orgId, frameworkId);
    if (!result.allowed) {
      logger.info(`[FrameworkGate] Blocked org=${orgId} from ${frameworkId}: ${result.reason}`);
      res.status(403).json({
        error: 'FRAMEWORK_ACCESS_DENIED',
        framework: frameworkId,
        accessLevel: result.accessLevel,
        reason: result.reason,
        upgradeCTA: result.upgradeCTA,
      });
      return;
    }
    req.frameworkAccess = {
      allowed: true,
      accessLevel: result.accessLevel,
      requiresLegalNotice: result.requiresLegalNotice,
    };
    next();
  };
}

export function requireDynamicFrameworkAccess(paramName = 'frameworkId') {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const orgId = req.user?.organizationId;
    const fwId = req.params[paramName] || req.body?.frameworkId;
    if (!orgId) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    if (!fwId) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Framework ID required' });
      return;
    }
    const result = await FrameworkEntitlementService.checkAccess(orgId, fwId.toUpperCase());
    if (!result.allowed) {
      res.status(403).json({
        error: 'FRAMEWORK_ACCESS_DENIED',
        framework: fwId,
        accessLevel: result.accessLevel,
        reason: result.reason,
        upgradeCTA: result.upgradeCTA,
      });
      return;
    }
    req.frameworkAccess = {
      allowed: true,
      accessLevel: result.accessLevel,
      requiresLegalNotice: result.requiresLegalNotice,
    };
    next();
  };
}
