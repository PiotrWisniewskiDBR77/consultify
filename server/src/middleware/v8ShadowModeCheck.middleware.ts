import type { NextFunction, Response } from 'express';

import type { AuthRequest } from './auth.middleware.js';
import { isV8ShadowMode } from '../services/v8/featureFlagService.js';
import Logger from '../utils/Logger.js';

/**
 * Lightweight middleware that checks if shadow mode is active for the org
 * and sets `req.v8ShadowMode`. Designed to be mounted on legacy route
 * prefixes (e.g. `/api/ai`) BEFORE the shadow interceptor, so the
 * interceptor can decide whether to fire a V8 comparison.
 *
 * Unlike v8FeatureGate, this middleware NEVER blocks the request —
 * it only annotates it. If the check fails, shadow mode is silently off.
 */
export async function v8ShadowModeCheck(
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const orgId = req.organizationId;
  if (!orgId) {
    (req as AuthRequest & { v8ShadowMode?: boolean }).v8ShadowMode = false;
    next();
    return;
  }

  try {
    (req as AuthRequest & { v8ShadowMode?: boolean }).v8ShadowMode =
      await isV8ShadowMode(orgId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    Logger.warn(`[v8:shadow-check] Failed to check shadow mode for ${orgId}: ${msg}`);
    (req as AuthRequest & { v8ShadowMode?: boolean }).v8ShadowMode = false;
  }

  next();
}

export default v8ShadowModeCheck;
