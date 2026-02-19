/**
 * oauthRoutes Routes
 *
 * Minimal honest implementation:
 * - Provides `/oauth/status` for the admin UI
 * - Other OAuth flows are not yet implemented and return 503
 */
import { Router } from 'express';

import logger from '../utils/Logger.js';

const router = Router();

type Provider = 'google' | 'microsoft' | 'linkedin';

function configured(provider: Provider): boolean {
  if (provider === 'google') {
    return !!(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_CALLBACK_URL
    );
  }
  if (provider === 'microsoft') {
    return !!(
      process.env.MICROSOFT_CLIENT_ID &&
      process.env.MICROSOFT_CLIENT_SECRET &&
      process.env.MICROSOFT_CALLBACK_URL
    );
  }
  return !!(
    process.env.LINKEDIN_CLIENT_ID &&
    process.env.LINKEDIN_CLIENT_SECRET &&
    process.env.LINKEDIN_CALLBACK_URL
  );
}

router.get('/oauth/status', (_req, res) => {
  return res.json({
    google: { configured: configured('google'), loginUrl: '/api/auth/google' },
    microsoft: { configured: configured('microsoft'), loginUrl: '/api/auth/microsoft' },
    linkedin: { configured: configured('linkedin'), loginUrl: '/api/auth/linkedin' },
  });
});

const unavailable = (provider: Provider) => (req: any, res: any) => {
  logger.warn(`[oauthRoutes] OAuth flow requested but not implemented`, {
    provider,
    path: req.path,
  });
  return res.status(503).json({
    success: false,
    error: `OAuth login for ${provider} is not available (no real implementation)`,
  });
};

router.get('/google', unavailable('google'));
router.get('/microsoft', unavailable('microsoft'));
router.get('/linkedin', unavailable('linkedin'));

export default router;
