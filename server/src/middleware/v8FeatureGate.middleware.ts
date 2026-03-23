import type { NextFunction, Response } from 'express';

import type { AuthRequest } from './auth.middleware.js';
import { isV8Enabled, isV8ShadowMode } from '../services/v8/featureFlagService.js';

/**
 * Pre-auth gate: checks only the global V8 toggle.
 * Runs BEFORE verifyToken so it can short-circuit without auth overhead.
 * Org-level checks happen later via `v8OrgGate` (after auth sets organizationId).
 */
export const v8FeatureGate = (
  _req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const globalEnabled = process.env.ENABLE_V8_GLOBAL === 'true';
  if (!globalEnabled) {
    res.status(404).json({ error: 'V8 features not available', code: 'V8_DISABLED' });
    return;
  }
  next();
};

/**
 * Post-auth gate: checks org-level V8 enablement and sets shadow mode flag.
 * Must run AFTER verifyToken (needs req.organizationId).
 */
export const v8OrgGate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const orgId = req.organizationId;
  if (!orgId) {
    res.status(400).json({ error: 'Organization context required for V8', code: 'V8_MISSING_ORG' });
    return;
  }

  try {
    const enabled = await isV8Enabled(orgId);
    if (!enabled) {
      res.status(404).json({
        error: 'V8 not enabled for this organization',
        code: 'V8_ORG_DISABLED',
      });
      return;
    }

    (req as any).v8ShadowMode = await isV8ShadowMode(orgId);
  } catch {
    (req as any).v8ShadowMode = false;
  }

  next();
};

export default v8FeatureGate;
