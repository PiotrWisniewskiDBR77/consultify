import type { NextFunction, Response } from 'express';

import type { AuthRequest } from './auth.middleware.js';
import { isV8Enabled, isV8ShadowMode } from '../services/v8/featureFlagService.js';

export const v8FeatureGate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const globalEnabled = process.env.ENABLE_V8_GLOBAL === 'true';
  if (!globalEnabled) {
    res.status(404).json({ error: 'V8 features not available', code: 'V8_DISABLED' });
    return;
  }

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
