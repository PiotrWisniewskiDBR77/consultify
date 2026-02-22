/**
 * OAuth Routes — Google & LinkedIn login + connect flows
 * Bundle 30.5 (T110, T111, T112)
 */

import { Response, Router } from 'express';

import config from '../config/Config.js';
import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { oauthService } from '../services/oauthService.js';
import refreshTokenService from '../services/RefreshTokenService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

const router = Router();

const FRONTEND_URL = config.FRONTEND_URL || 'http://localhost:3000';

async function logSecurityEvent(event: {
  organizationId?: string;
  userId?: string;
  eventType: string;
  severity?: 'info' | 'warning' | 'critical';
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    const securityService = (await import('../services/securityService.js')).default as any;
    await securityService.logSecurityEvent(event);
  } catch (err) {
    logger.warn(`[OAuth] Failed to log security event: ${err}`);
  }
}

// ==========================================
// OAUTH STATUS
// ==========================================

/**
 * GET /api/auth/oauth/status
 */
router.get('/oauth/status', (_req, res: Response) => {
  const status = oauthService.getProviderStatus();
  res.json(status);
});

// ==========================================
// GOOGLE LOGIN
// ==========================================

/**
 * GET /api/auth/google — Start Google OAuth flow
 */
router.get(
  '/google',
  asyncHandler(async (_req, res: Response) => {
    const result = oauthService.generateAuthUrl('google', 'login');
    if (!result) {
      return res.redirect(`${FRONTEND_URL}/oauth/callback?auth_error=google_not_configured`);
    }

    res.cookie('oauth_state', result.state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/',
    });

    return res.redirect(result.url);
  })
);

/**
 * GET /api/auth/google/callback — Google OAuth callback
 */
router.get(
  '/google/callback',
  asyncHandler(async (req, res: Response) => {
    const { code, state, error: oauthError } = req.query as Record<string, string>;

    if (oauthError) {
      logger.warn(`[OAuth] Google auth error: ${oauthError}`);
      return res.redirect(`${FRONTEND_URL}/oauth/callback?auth_error=google_failed`);
    }

    if (!state || !code) {
      return res.redirect(`${FRONTEND_URL}/oauth/callback?auth_error=google_failed`);
    }

    // Validate state
    const stateData = oauthService.validateState(state);
    if (!stateData) {
      logger.warn('[OAuth] Invalid or expired Google state');
      return res.redirect(
        `${FRONTEND_URL}/oauth/callback?auth_error=google_failed&reason=invalid_state`
      );
    }

    // Exchange code for tokens
    const tokens = await oauthService.exchangeCode('google', code);
    if (!tokens) {
      return res.redirect(
        `${FRONTEND_URL}/oauth/callback?auth_error=google_failed&reason=token_exchange`
      );
    }

    // Get user info
    const userInfo = await oauthService.getUserInfo('google', tokens.accessToken);
    if (!userInfo) {
      return res.redirect(
        `${FRONTEND_URL}/oauth/callback?auth_error=google_failed&reason=userinfo`
      );
    }

    // Find or create user
    const result = await oauthService.findOrCreateUser('google', userInfo);
    if ('error' in result) {
      await logSecurityEvent({
        eventType: 'login_failed',
        severity: 'warning',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        details: { provider: 'google', reason: result.error },
      });
      return res.redirect(
        `${FRONTEND_URL}/oauth/callback?auth_error=google_failed&reason=${result.error}`
      );
    }

    // Generate session token
    const tokenPair = await refreshTokenService.generateTokenPair(
      {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
        organization_id: result.user.organization_id,
      },
      {
        deviceInfo: req.get('user-agent') || 'OAuth Login',
        ip: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    await logSecurityEvent({
      organizationId: result.user.organization_id,
      userId: result.user.id,
      eventType: 'login_success',
      severity: 'info',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        auth_method: 'oauth',
        provider: 'google',
        isNew: result.isNew,
        linked: result.linked,
      },
    });

    const safeUser = {
      id: result.user.id,
      email: result.user.email,
      firstName: result.user.first_name,
      lastName: result.user.last_name,
      role: result.user.role,
      organizationId: result.user.organization_id,
      isAuthenticated: true,
    };

    // Clear state cookie
    res.clearCookie('oauth_state', { path: '/' });

    const userEncoded = encodeURIComponent(JSON.stringify(safeUser));
    return res.redirect(
      `${FRONTEND_URL}/oauth/callback?token=${tokenPair.accessToken}&user=${userEncoded}`
    );
  })
);

// ==========================================
// LINKEDIN LOGIN
// ==========================================

/**
 * GET /api/auth/linkedin — Start LinkedIn OAuth flow
 */
router.get(
  '/linkedin',
  asyncHandler(async (_req, res: Response) => {
    const result = oauthService.generateAuthUrl('linkedin', 'login');
    if (!result) {
      return res.redirect(`${FRONTEND_URL}/oauth/callback?auth_error=linkedin_not_configured`);
    }

    res.cookie('oauth_state', result.state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/',
    });

    return res.redirect(result.url);
  })
);

/**
 * GET /api/auth/linkedin/callback — LinkedIn OAuth callback
 */
router.get(
  '/linkedin/callback',
  asyncHandler(async (req, res: Response) => {
    const { code, state, error: oauthError } = req.query as Record<string, string>;

    if (oauthError) {
      logger.warn(`[OAuth] LinkedIn auth error: ${oauthError}`);
      return res.redirect(`${FRONTEND_URL}/oauth/callback?auth_error=linkedin_failed`);
    }

    if (!state || !code) {
      return res.redirect(`${FRONTEND_URL}/oauth/callback?auth_error=linkedin_failed`);
    }

    const stateData = oauthService.validateState(state);
    if (!stateData) {
      logger.warn('[OAuth] Invalid or expired LinkedIn state');
      return res.redirect(
        `${FRONTEND_URL}/oauth/callback?auth_error=linkedin_failed&reason=invalid_state`
      );
    }

    const tokens = await oauthService.exchangeCode('linkedin', code);
    if (!tokens) {
      return res.redirect(
        `${FRONTEND_URL}/oauth/callback?auth_error=linkedin_failed&reason=token_exchange`
      );
    }

    const userInfo = await oauthService.getUserInfo('linkedin', tokens.accessToken);
    if (!userInfo) {
      return res.redirect(
        `${FRONTEND_URL}/oauth/callback?auth_error=linkedin_failed&reason=userinfo`
      );
    }

    // LinkedIn email fallback: if no email, redirect with error
    if (!userInfo.email) {
      await logSecurityEvent({
        eventType: 'login_failed',
        severity: 'warning',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        details: { provider: 'linkedin', reason: 'no_email' },
      });
      return res.redirect(
        `${FRONTEND_URL}/oauth/callback?auth_error=linkedin_failed&reason=no_email`
      );
    }

    const result = await oauthService.findOrCreateUser('linkedin', userInfo);
    if ('error' in result) {
      await logSecurityEvent({
        eventType: 'login_failed',
        severity: 'warning',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        details: { provider: 'linkedin', reason: result.error },
      });
      return res.redirect(
        `${FRONTEND_URL}/oauth/callback?auth_error=linkedin_failed&reason=${result.error}`
      );
    }

    const tokenPair = await refreshTokenService.generateTokenPair(
      {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
        organization_id: result.user.organization_id,
      },
      {
        deviceInfo: req.get('user-agent') || 'OAuth Login',
        ip: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    await logSecurityEvent({
      organizationId: result.user.organization_id,
      userId: result.user.id,
      eventType: 'login_success',
      severity: 'info',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        auth_method: 'oauth',
        provider: 'linkedin',
        isNew: result.isNew,
        linked: result.linked,
      },
    });

    const safeUser = {
      id: result.user.id,
      email: result.user.email,
      firstName: result.user.first_name,
      lastName: result.user.last_name,
      role: result.user.role,
      organizationId: result.user.organization_id,
      isAuthenticated: true,
    };

    res.clearCookie('oauth_state', { path: '/' });

    const userEncoded = encodeURIComponent(JSON.stringify(safeUser));
    return res.redirect(
      `${FRONTEND_URL}/oauth/callback?token=${tokenPair.accessToken}&user=${userEncoded}`
    );
  })
);

// ==========================================
// LINKEDIN CONNECT (T112 — for logged-in users)
// ==========================================

/**
 * GET /api/auth/linkedin/connect — Start LinkedIn connect flow (requires auth)
 */
router.get(
  '/linkedin/connect',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.redirect(`${FRONTEND_URL}/settings/security?connect_error=not_authenticated`);
    }

    const result = oauthService.generateAuthUrl('linkedin', 'connect', userId);
    if (!result) {
      return res.redirect(
        `${FRONTEND_URL}/settings/security?connect_error=linkedin_not_configured`
      );
    }

    res.cookie('oauth_state', result.state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/',
    });

    return res.redirect(result.url);
  })
);

/**
 * GET /api/auth/linkedin/connect/callback — LinkedIn connect callback
 */
router.get(
  '/linkedin/connect/callback',
  asyncHandler(async (req, res: Response) => {
    const { code, state, error: oauthError } = req.query as Record<string, string>;

    if (oauthError || !state || !code) {
      return res.redirect(`${FRONTEND_URL}/settings/security?connect_error=linkedin_failed`);
    }

    const stateData = oauthService.validateState(state);
    if (!stateData || stateData.mode !== 'connect' || !stateData.userId) {
      return res.redirect(`${FRONTEND_URL}/settings/security?connect_error=invalid_state`);
    }

    const tokens = await oauthService.exchangeCode('linkedin', code, 'connect');
    if (!tokens) {
      return res.redirect(`${FRONTEND_URL}/settings/security?connect_error=token_exchange_failed`);
    }

    const userInfo = await oauthService.getUserInfo('linkedin', tokens.accessToken);
    if (!userInfo) {
      return res.redirect(`${FRONTEND_URL}/settings/security?connect_error=userinfo_failed`);
    }

    const result = await oauthService.connectAccount('linkedin', userInfo, stateData.userId);
    if ('error' in result) {
      await logSecurityEvent({
        userId: stateData.userId,
        eventType: 'oauth_link_failed',
        severity: 'warning',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        details: { provider: 'linkedin', reason: result.error },
      });
      return res.redirect(`${FRONTEND_URL}/settings/security?connect_error=${result.error}`);
    }

    await logSecurityEvent({
      userId: stateData.userId,
      eventType: 'oauth_linked',
      severity: 'info',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: { provider: 'linkedin' },
    });

    res.clearCookie('oauth_state', { path: '/' });
    return res.redirect(`${FRONTEND_URL}/settings/security?connected=linkedin`);
  })
);

export default router;
