// @ts-nocheck
/**
 * Auth Routes
 * Authentication and authorization endpoints
 */

import bcrypt from 'bcryptjs';
import { Response, Router } from 'express';

import { login } from '../controllers/AuthController.js';
import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { validateBody, validateParams } from '../middleware/validation.middleware.js';
import mfaService from '../services/MFAService.js';
import refreshTokenService from '../services/RefreshTokenService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  ACCESS_TOKEN_COOKIE,
  clearAuthCookies,
  REFRESH_TOKEN_COOKIE,
  setAuthCookies,
} from '../utils/cookieAuth.js';
import { all as _dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import {
  ChangePasswordRequestSchema,
  LoginRequestSchema,
  MFADisableRequestSchema,
  MFAEnableRequestSchema,
  MFASetupRequestSchema,
  RefreshTokenRequestSchema,
  RegisterRequestSchema,
  ResetPasswordRequestSchema,
  RevokeAllTokensRequestSchema,
  SessionIdParamSchema,
  VerifyEmailRequestSchema,
} from '../validators/auth.validators.js';

const router = Router();
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

import config from '../config/Config.js';
import { authRateLimiter } from '../middleware/rateLimiting.middleware.js';
import ActivityService from '../services/ActivityService.js';
import logger from '../utils/Logger.js';

// Apply rate limiting to all auth routes
router.use(authRateLimiter);

// Helper to add timeout to promises
const _withTimeout = <T>(promise: Promise<T>, timeoutMs = 1000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timeout')), timeoutMs)
    ),
  ]);
};

// LOGIN
console.log('[AuthRoutes] login handler is type:', typeof login);
router.post('/login', validateBody(LoginRequestSchema), asyncHandler(login));

// REFRESH TOKEN - Get new access token using refresh token
router.post(
  '/refresh',
  validateBody(RefreshTokenRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const bodyRefreshToken = req.body?.refreshToken;
    const cookieRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    const refreshToken =
      (typeof bodyRefreshToken === 'string' && bodyRefreshToken.trim().length > 0
        ? bodyRefreshToken.trim()
        : null) ||
      (typeof cookieRefreshToken === 'string' && cookieRefreshToken.trim().length > 0
        ? cookieRefreshToken.trim()
        : null);

    try {
      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required' });
      }

      const result = await refreshTokenService.refreshAccessToken(refreshToken, {
        ip: req.ip,
        userAgent: req.get('user-agent') || null,
      });

      if (!result) {
        return res.status(401).json({ error: 'Invalid or expired refresh token' });
        return;
      }

      // Set cookie-based auth for stability across reloads/restarts.
      try {
        setAuthCookies(res, result.accessToken, result.refreshToken);
      } catch {
        // ignore
      }

      return res.json({
        token: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
      });
    } catch (error: unknown) {
      logger.error('[Auth] Refresh error:', error);
      return res.status(500).json({ error: 'Token refresh failed' });
    }
  })
);

// GET ACTIVE SESSIONS
router.get(
  '/sessions',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const sessions = await refreshTokenService.getActiveSessions(req.user!.id);
      return res.json({ sessions });
    } catch (error: unknown) {
      logger.error('[Auth] Get sessions error:', error);
      return res.status(500).json({ error: 'Failed to get sessions' });
    }
  })
);

// REVOKE SESSION
router.delete(
  '/sessions/:id',
  verifyToken,
  validateParams(SessionIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
      await refreshTokenService.revokeSession(req.user!.id, id);
      return res.json({ success: true, message: 'Session revoked' });
    } catch (error: unknown) {
      logger.error('[Auth] Revoke session error:', error);
      return res.status(500).json({ error: 'Failed to revoke session' });
    }
  })
);

// GET ME - Validate token and return user data
router.get(
  '/me',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      // ------------------------------------------------------------
      // E2E_MODE: deterministic "who am I" without DB dependency
      // ------------------------------------------------------------
      // Playwright runtime smoke tests use an unsigned JWT-like token
      // accepted by auth middleware only when E2E_MODE=true. In that mode
      // we return a valid user payload directly from the decoded token.
      if (process.env.E2E_MODE === 'true' && req.user && (req.user as any).id) {
        return res.json({
          user: {
            id: req.user.id,
            email: req.user.email || 'e2e@local.test',
            role: (req.user as any).role || 'ADMIN',
            organizationId: req.organizationId || (req.user as any).organizationId || 'e2e-org-id',
            organizationName: 'E2E Organization',
            firstName: (req.user as any).name?.split?.(' ')?.[0] || 'E2E',
            lastName: (req.user as any).name?.split?.(' ')?.slice?.(1)?.join?.(' ') || 'User',
            avatarUrl: null,
            impersonatorId: null,
            companyName: 'E2E Organization',
            isAuthenticated: true,
            accessLevel: 'full',
          },
        });
      }

      // Try query with impersonator_id first, fallback if column doesn't exist
      let user: {
        id: string;
        email: string;
        role: string;
        organization_id: string;
        first_name: string;
        last_name: string;
        avatar_url: string | null;
        impersonator_id: string | null;
        organization_name: string | null;
        organization_plan: string | null;
        organization_status: string | null;
      } | null = null;

      try {
        // Try with impersonator_id column
        user = await dbGet<{
          id: string;
          email: string;
          role: string;
          organization_id: string;
          first_name: string;
          last_name: string;
          avatar_url: string | null;
          impersonator_id: string | null;
          organization_name: string | null;
          organization_plan: string | null;
          organization_status: string | null;
        }>(
          `SELECT u.id, u.email, u.role, u.organization_id, u.first_name, u.last_name, u.avatar_url, u.impersonator_id,
                          o.name as organization_name, o.plan as organization_plan, o.status as organization_status
                   FROM users u
                   LEFT JOIN organizations o ON u.organization_id = o.id
                   WHERE u.id = ?`,
          [req.user!.id]
        );
      } catch (err: any) {
        // If column doesn't exist, retry without impersonator_id
        if (err.message?.includes('impersonator_id') || err.message?.includes('does not exist')) {
          user = await dbGet<{
            id: string;
            email: string;
            role: string;
            organization_id: string;
            first_name: string;
            last_name: string;
            avatar_url: string | null;
            impersonator_id: string | null;
            organization_name: string | null;
            organization_plan: string | null;
            organization_status: string | null;
          }>(
            `SELECT u.id, u.email, u.role, u.organization_id, u.first_name, u.last_name, u.avatar_url, NULL as impersonator_id,
                            o.name as organization_name, o.plan as organization_plan, o.status as organization_status
                     FROM users u
                     LEFT JOIN organizations o ON u.organization_id = o.id
                     WHERE u.id = ?`,
            [req.user!.id]
          );
        } else {
          throw err;
        }
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if role changed in database - if so, generate new token
      let newToken: string | null = null;
      if (user.role !== req.user!.role) {
        const deviceInfo = (req.get('user-agent') || 'Unknown Device').substring(0, 200);
        const tokenPair = await refreshTokenService.generateTokenPair(
          {
            id: user.id,
            email: user.email,
            role: user.role,
            organization_id: user.organization_id,
          },
          {
            deviceInfo,
            ip: req.ip,
            userAgent: req.get('user-agent'),
          }
        );
        newToken = tokenPair.accessToken;
      }

      const response: {
        user: {
          id: string;
          email: string;
          role: string;
          organizationId: string;
          organizationName: string | null;
          firstName: string;
          lastName: string;
          avatarUrl: string | null;
          impersonatorId: string | null;
          companyName: string | null;
          isAuthenticated: boolean;
          accessLevel: 'free' | 'full';
        };
        token?: string;
        roleChanged?: boolean;
      } = {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          organizationId: user.organization_id,
          organizationName: user.organization_name,
          firstName: user.first_name,
          lastName: user.last_name,
          avatarUrl: user.avatar_url,
          impersonatorId: user.impersonator_id,
          companyName: user.organization_name,
          isAuthenticated: true,
          accessLevel:
            user.organization_status === 'active' &&
            (user.organization_plan === 'enterprise' || user.organization_plan === 'pro')
              ? 'full'
              : 'free',
        },
      };

      // Include new token if role changed
      if (newToken) {
        response.token = newToken;
        response.roleChanged = true;
      }

      return res.json(response);
    } catch (err: any) {
      logger.error('[Auth] /me DB error:', err);
      // Fallback to token data if DB fails
      return res.json({
        user: {
          id: req.user!.id,
          email: req.user!.email || '',
          role: req.user!.role,
          organizationId: req.user!.organizationId || '',
          impersonatorId: req.user!.impersonatorId || null,
          companyName: 'Loading...',
          isAuthenticated: true,
          accessLevel: 'free', // Default fallback
        },
      });
    }
  })
);

// LOGOUT - Revokes the current token
router.post(
  '/logout',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      // Always clear cookie-based auth (even if revocation fails).
      try {
        clearAuthCookies(res);
      } catch {
        // ignore
      }

      // Token can come from Authorization header OR cookie-based auth.
      const authHeader = req.headers.authorization;
      const headerToken =
        authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
      const cookieToken = req.cookies?.[ACCESS_TOKEN_COOKIE];
      const rawToken = headerToken || cookieToken;

      if (!rawToken) {
        // If we got here, verifyToken probably used a different extraction; still return OK.
        return res.json({ message: 'Logged out successfully' });
      }

      const decoded = jwt.decode(rawToken) as { jti?: string; exp?: number; id?: string } | null;

      if (!decoded || !decoded.jti) {
        // Token doesn't have jti (old token format), just acknowledge logout
        return res.json({ message: 'Logged out successfully' });
        return;
      }

      // Calculate expiry from token
      const expiresAt = new Date((decoded.exp || 0) * 1000).toISOString();

      // Add token to revocation list
      await dbRun(
        `INSERT OR IGNORE INTO revoked_tokens (jti, user_id, expires_at, reason) VALUES (?, ?, ?, ?)`,
        [decoded.jti, (req.user as any)?.id || decoded.id || 'unknown', expiresAt, 'logout']
      );
      return res.json({ message: 'Logged out successfully' });
    } catch (error: unknown) {
      logger.error('Logout error:', error);
      return res.status(500).json({ error: 'Logout failed' });
    }
  })
);

// REVERT IMPERSONATION (Back to Admin)
router.post(
  '/revert-impersonation',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const impersonatorId = req.user!.impersonatorId;
    if (!impersonatorId) {
      return res.status(400).json({ error: 'Not currently impersonating' });
      return;
    }

    const adminUser = await dbGet<{
      id: string;
      email: string;
      role: string;
      organization_id: string;
      first_name: string;
      last_name: string;
      status: string;
    }>('SELECT * FROM users WHERE id = ?', [impersonatorId]);

    if (!adminUser) {
      return res.status(404).json({ error: 'Original admin not found' });
      return;
    }

    // Verify the original user is indeed an admin/superadmin (security check)
    if (adminUser.role !== 'SUPERADMIN' && adminUser.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Original user is not an admin' });
      return;
    }

    // Generate new token for the admin
    const jti = uuidv4();
    const token = jwt.sign(
      {
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
        organizationId: adminUser.organization_id,
        jti: jti,
      },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );

    // Log the reversion
    ActivityService.log({
      organizationId: adminUser.organization_id,
      userId: adminUser.id,
      action: 'impersonate_end',
      entityType: 'user',
      entityId: req.user!.id,
      entityName: req.user!.email || '',
    });

    // Return admin user and token
    const safeUser = {
      id: adminUser.id,
      email: adminUser.email,
      firstName: adminUser.first_name,
      lastName: adminUser.last_name,
      role: adminUser.role,
      status: adminUser.status,
      organizationId: adminUser.organization_id,
      companyName: 'Admin Console',
      isAuthenticated: true,
      accessLevel: 'full' as const, // Admin should have full access
    };

    return res.json({ user: safeUser, token });
  })
);

// DEMO LOGIN - Auto-login as demo account
router.post(
  '/demo-login',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Single demo account (do not use DBR77 domain)
    const DEMO_EMAILS = ['piotr.wisniewski@demo.com'];

    logger.info('[Auth] Demo login request');

    try {
      let user = null as any;
      let matchedEmail = DEMO_EMAILS[0];
      for (const email of DEMO_EMAILS) {
        const found = await dbGet<{
          id: string;
          email: string;
          role: string;
          organization_id: string;
          first_name: string;
          last_name: string;
          status: string;
        }>('SELECT * FROM users WHERE email = ?', [email]);
        if (found) {
          user = found;
          matchedEmail = email;
          break;
        }
      }

      if (!user) {
        // Deterministic E2E/CI support: auto-provision a demo user when running in test gateway mode.
        // This avoids flaky smoke tests that depend on external seed scripts.
        const isTestGateway =
          process.env.NODE_ENV === 'test' ||
          process.env.E2E_MODE === 'true' ||
          process.env.ENABLE_TEST_GATEWAY === 'true';

        if (!isTestGateway) {
          logger.error('[Auth] Demo user not found - please run seed script');
          return res.status(404).json({
            error: 'Demo user not found. Please contact support.',
            code: 'DEMO_USER_NOT_FOUND',
          });
        }

        const demoOrgId = 'demo-org';
        const demoUserId = 'demo-user-id';
        const demoEmail = DEMO_EMAILS[0];

        await dbRun(
          `
            INSERT INTO organizations (id, name, plan, status)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO NOTHING
          `,
          [demoOrgId, 'Demo Organization', 'enterprise', 'active']
        );

        await dbRun(
          `
            INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO NOTHING
          `,
          [demoUserId, demoOrgId, demoEmail, 'demo-not-used', 'ADMIN', 'active', 'Demo', 'User']
        );

        user = await dbGet<{
          id: string;
          email: string;
          role: string;
          organization_id: string;
          first_name: string;
          last_name: string;
          status: string;
        }>('SELECT * FROM users WHERE id = ?', [demoUserId]);
        matchedEmail = demoEmail;

        if (!user) {
          logger.error('[Auth] Demo user auto-provision failed');
          return res.status(500).json({ error: 'Demo login failed. Please try again.' });
        }
      }

      const org = await dbGet<{
        id: string;
        name: string;
      }>('SELECT * FROM organizations WHERE id = ?', [user.organization_id]);

      const tokenResult = await refreshTokenService.generateTokenPair(user, {
        deviceInfo: 'Demo Session',
        ip: req.ip,
        userAgent: req.get('user-agent') || null,
      });

      ActivityService.log({
        organizationId: user.organization_id,
        userId: user.id,
        action: 'demo_login',
        entityType: 'user',
        entityId: user.id,
        entityName: matchedEmail,
        metadata: { ip: req.ip },
      });

      const safeUser = {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        status: user.status,
        organizationId: user.organization_id,
        companyName: org?.name || 'Demo Company',
        isDemo: true,
        hasWorkspace: true,
        isAuthenticated: true,
        accessLevel: 'full' as const, // Demo user should have full access
      };

      logger.info('[Auth] Demo login successful');
      try {
        setAuthCookies(res, tokenResult.accessToken, tokenResult.refreshToken);
      } catch {
        // ignore
      }
      return res.json({
        user: safeUser,
        token: tokenResult.accessToken,
        refreshToken: tokenResult.refreshToken,
        isDemo: true,
      });
    } catch (error: unknown) {
      logger.error('[Auth] Demo login error:', error);
      return res.status(500).json({ error: 'Demo login failed. Please try again.' });
    }
  })
);

/*
 * Legacy implementation (kept in git history) used a fixed DEMO_EMAIL and DEMO_PASSWORD.
 * Demo login now selects the first available account from DEMO_EMAILS.
 */
/*
    const user = await dbGet<{
        id: string;
        email: string;
        role: string;
        organization_id: string;
        first_name: string;
        last_name: string;
        status: string;
      }>('SELECT * FROM users WHERE email = ?', [DEMO_EMAIL]);

      if (!user) {
        logger.error('[Auth] Demo user not found - please run seed script');
        return res.status(404).json({
          error: 'Demo user not found. Please contact support.',
          code: 'DEMO_USER_NOT_FOUND',
        });
        return;
      }

      const org = await dbGet<{
        id: string;
        name: string;
      }>('SELECT * FROM organizations WHERE id = ?', [user.organization_id]);

      const tokenResult = await refreshTokenService.generateTokenPair(user, {
        deviceInfo: 'Demo Session',
        ip: req.ip,
        userAgent: req.get('user-agent') || null,
      });

      ActivityService.log({
        organizationId: user.organization_id,
        userId: user.id,
        action: 'demo_login',
        entityType: 'user',
        entityId: user.id,
        entityName: DEMO_EMAIL,
        metadata: { ip: req.ip },
      });

      const safeUser = {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        status: user.status,
        organizationId: user.organization_id,
        companyName: org?.name || 'Demo Company',
        isDemo: true,
        hasWorkspace: true,
        isAuthenticated: true,
        accessLevel: 'full' as const, // Demo user should have full access
      };

      logger.info('[Auth] Demo login successful');
      return res.json({
        user: safeUser,
        token: tokenResult.accessToken,
        refreshToken: tokenResult.refreshToken,
        isDemo: true,
      });
    } catch (error: unknown) {
      logger.error('[Auth] Demo login error:', error);
      return res.status(500).json({ error: 'Demo login failed. Please try again.' });
    }
  })
);
*/

// REGISTER (New Company)
router.post(
  '/register',
  validateBody(RegisterRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const {
      email,
      password,
      firstName,
      lastName,
      companyName,
      accessCode,
      isDemo,
      promoCode,
      utm_campaign,
      utm_medium,
      partner_code,
    } = req.body;

    const { default: PromoCodeService } = (await import('../services/promoCodeService.js')) as any;
    const { default: AttributionService } =
      (await import('../services/attributionService.js')) as any;

    let promoValidation: any = null;
    if (promoCode) {
      try {
        promoValidation = await PromoCodeService.validatePromoCode(promoCode);
        if (!promoValidation.valid) {
          return res.status(400).json({
            error: promoValidation.reason,
            errorCode: 'INVALID_PROMO_CODE',
          });
          return;
        }
      } catch (err: any) {
        logger.error('[Auth] Promo validation error:', err);
        return res.status(500).json({ error: 'Failed to validate promo code' });
        return;
      }
    }

    const existingUser = await dbGet<{ id: string }>('SELECT id FROM users WHERE email = ?', [
      email,
    ]);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use' });
      return;
    }

    const orgId = uuidv4();
    const userId = uuidv4();
    const hashedPassword = bcrypt.hashSync(password, 8);

    const proceedWithRegistration = async (finalStatus: string, finalPlan: string) => {
      try {
        // Create organization
        const orgResult = await dbRun(
          `INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
          [orgId, companyName || 'My Company', finalPlan, finalStatus]
        );

        if (!orgResult.success) {
          if (process.env.NODE_ENV !== 'production')
            logger.error('Register Org Error:', orgResult.error);
          return res.status(500).json({ error: 'Failed to create organization' });
          return;
        }

        // Create user
        const userResult = await dbRun(
          `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [userId, orgId, email, hashedPassword, firstName, lastName, 'ADMIN']
        );

        if (!userResult.success) {
          if (process.env.NODE_ENV !== 'production')
            logger.error('Register User Error:', userResult.error);
          return res.status(500).json({ error: 'Failed to create user' });
          return;
        }

        try {
          await AttributionService.recordAttribution({
            organizationId: orgId,
            userId: userId,
            sourceType: promoCode
              ? AttributionService.SOURCE_TYPES.PROMO_CODE
              : AttributionService.SOURCE_TYPES.SELF_SERVE,
            sourceId: promoValidation?.codeId || null,
            campaign: utm_campaign,
            partnerCode: promoValidation?.partnerCode || partner_code,
            medium: utm_medium,
            metadata: {
              promoCode: promoCode || null,
              accessCode: accessCode || null,
              isDemo,
              entryPoint: 'registration',
            },
          });
        } catch (attrErr) {
          logger.error('[Auth] Attribution recording failed:', attrErr);
        }

        // GAP-PARTNER-007: Create partner attribution if partner_code is provided
        const effectivePartnerCode = promoValidation?.partnerCode || partner_code;
        if (effectivePartnerCode) {
          try {
            const { default: PartnerReferralService } =
              (await import('../services/partnerReferralService.js')) as any;

            // Validate the partner code
            const validation =
              await PartnerReferralService.validateReferralCode(effectivePartnerCode);

            if (validation.valid && validation.partnerOrgId) {
              // Create partner attribution
              await PartnerReferralService.createAttribution({
                partnerOrgId: validation.partnerOrgId,
                organizationId: orgId,
                attributionType: 'PROMO_CODE',
                referralCodeUsed: effectivePartnerCode,
                commissionRatePercent: validation.commissionRate || 15,
              });

              // Create discount if applicable
              const { getDatabase } = await import('../database/Database.js');
              const db = getDatabase();

              // Get discount config
              const discountConfig = await db.get(
                `SELECT discount_type, discount_value, duration_months
                                 FROM partner_discount_config
                                 WHERE is_active = 1
                                 ORDER BY created_at DESC
                                 LIMIT 1`
              );

              if (discountConfig) {
                const endDate = new Date();
                endDate.setMonth(
                  endDate.getMonth() + ((discountConfig as any).duration_months || 12)
                );

                await db.run(
                  `INSERT INTO organization_discounts 
                                     (id, organization_id, partner_org_id, discount_type, discount_value, start_date, end_date, status, created_at)
                                     VALUES (?, ?, ?, ?, ?, datetime('now'), ?, 'ACTIVE', datetime('now'))`,
                  [
                    uuidv4(),
                    orgId,
                    validation.partnerOrgId,
                    (discountConfig as any).discount_type,
                    (discountConfig as any).discount_value,
                    endDate.toISOString(),
                  ]
                );
              }

              logger.info(
                `[Auth] Partner attribution created for org ${orgId} with code ${effectivePartnerCode}`
              );

              // GAP-PARTNER-008: Send email notification to partner
              try {
                const PartnerEmailService = await import('../services/partnerEmailService.js');
                const partnerInfo = await db.get(
                  `SELECT partner_name, contact_email FROM partner_organizations WHERE id = ?`,
                  [validation.partnerOrgId]
                );

                if ((partnerInfo as any)?.contact_email) {
                  await PartnerEmailService.sendNewReferralNotification({
                    partnerEmail: (partnerInfo as any).contact_email,
                    partnerName: (partnerInfo as any).partner_name || 'Partner',
                    organizationName: companyName || 'New Organization',
                    referralCode: effectivePartnerCode,
                    attributionDate: new Date().toISOString(),
                  });
                }
              } catch (emailErr) {
                // Don't fail registration on email error
                logger.warn('[Auth] Failed to send partner notification email:', emailErr);
              }
            } else {
              logger.warn(
                `[Auth] Invalid partner code provided at registration: ${effectivePartnerCode}`
              );
            }
          } catch (partnerErr) {
            // Don't fail registration if partner attribution fails
            logger.error('[Auth] Partner attribution creation failed:', partnerErr);
          }
        }

        if (promoCode && promoValidation?.valid) {
          try {
            await PromoCodeService.markPromoCodeUsed(promoCode, orgId, userId);
          } catch (promoErr) {
            logger.error('[Auth] Promo code usage marking failed:', promoErr);
          }
        }

        if (finalStatus === 'pending') {
          const requestResult = await dbRun(
            `INSERT INTO access_requests (id, email, first_name, last_name, organization_id, organization_name, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [uuidv4(), email, firstName, lastName, orgId, companyName || 'My Company', 'pending']
          );

          if (!requestResult.success) {
            logger.error('Error logging access request:', requestResult.error);
          }

          return res.json({
            status: 'pending',
            message: 'Registration successful. Waiting for approval.',
          });
          return;
        }

        const jti = uuidv4();
        const token = jwt.sign(
          {
            id: userId,
            email: email,
            role: 'ADMIN',
            organizationId: orgId,
            jti: jti,
          },
          config.JWT_SECRET,
          { expiresIn: config.JWT_EXPIRES_IN }
        );

        ActivityService.log({
          organizationId: orgId,
          userId: userId,
          action: 'registered',
          entityType: 'organization',
          entityId: orgId,
          entityName: companyName,
        });

        // GAP-AUTH-001: Send email verification
        let emailVerificationSent = false;
        try {
          const emailVerificationService = (await import('../services/emailVerificationService.js'))
            .default;
          const token = await emailVerificationService.createVerificationToken(userId, email);
          await emailVerificationService.sendVerificationEmail(email, firstName, token);
          emailVerificationSent = true;
          logger.info(`[Auth] Email verification sent to ${email}`);
        } catch (verifyErr) {
          logger.warn('[Auth] Failed to send verification email:', verifyErr);
          // Don't fail registration if email verification fails
        }

        // GAP-AUTH-003: Send welcome email
        try {
          const welcomeEmailService = (await import('../services/welcomeEmailService.js')).default;
          await welcomeEmailService.sendWelcomeEmail({
            email,
            firstName,
            companyName: companyName || 'Your Organization',
            isDemo,
          });
          logger.info(`[Auth] Welcome email sent to ${email}`);
        } catch (welcomeErr) {
          logger.warn('[Auth] Failed to send welcome email:', welcomeErr);
        }

        return res.json({
          user: {
            id: userId,
            email,
            firstName,
            lastName,
            role: 'ADMIN',
            companyName: companyName,
            organizationId: orgId,
            emailVerified: false,
          },
          token,
          promoApplied: promoCode
            ? {
                code: promoCode,
                discountType: promoValidation?.discountType,
                discountValue: promoValidation?.discountValue,
              }
            : null,
          emailVerificationSent,
        });
      } catch (regErr) {
        logger.error('[Auth] Registration error:', regErr);
        return res.status(500).json({ error: 'Registration failed' });
      }
    };

    if (isDemo) {
      return await proceedWithRegistration('active', 'trial');
    }

    if (accessCode) {
      const codeRow = await dbGet<{
        id: string;
        expires_at: string | null;
        max_uses: number;
        current_uses: number;
      }>('SELECT * FROM access_codes WHERE code = ? AND is_active = 1', [accessCode]);

      if (!codeRow) {
        return await proceedWithRegistration('pending', 'free');
      } else {
        if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
          return await proceedWithRegistration('pending', 'free');
        } else if (codeRow.max_uses > 0 && codeRow.current_uses >= codeRow.max_uses) {
          return await proceedWithRegistration('pending', 'free');
        } else {
          await dbRun('UPDATE access_codes SET current_uses = current_uses + 1 WHERE id = ?', [
            codeRow.id,
          ]);
          await dbRun(`INSERT INTO access_code_usage (id, code_id, user_id) VALUES (?, ?, ?)`, [
            uuidv4(),
            codeRow.id,
            userId,
          ]);
          return await proceedWithRegistration('active', 'pro');
        }
      }
    } else {
      return await proceedWithRegistration('pending', 'free');
    }
  })
);

// Revoke all tokens for a user (admin action)
router.post(
  '/revoke-all',
  verifyToken,
  validateBody(RevokeAllTokensRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (req.user!.role !== 'ADMIN' && req.user!.role !== 'SUPERADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const { userId } = req.body;
    const targetUserId = userId || req.user!.id;

    const performRevocation = async (userIdToRevoke: string) => {
      const marker = `revoke-all-${userIdToRevoke}-${Date.now()}`;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      try {
        const result = await dbRun(
          `INSERT INTO revoked_tokens (jti, user_id, expires_at, reason) VALUES (?, ?, ?, ?)`,
          [marker, userIdToRevoke, expiresAt, 'revoke-all']
        );

        if (!result.success) {
          return res.status(500).json({ error: 'Failed to revoke tokens' });
        }
        return res.json({ message: 'All tokens revoked successfully' });
      } catch (err) {
        logger.error('Error revoking all tokens:', err);
        return res.status(500).json({ error: 'Failed to revoke tokens' });
      }
    };

    if (req.user!.role !== 'SUPERADMIN' && userId && userId !== req.user!.id) {
      const targetUser = await dbGet<{
        organization_id: string;
      }>('SELECT organization_id FROM users WHERE id = ?', [userId]);

      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      if (targetUser.organization_id !== req.user!.organizationId) {
        return res
          .status(403)
          .json({ error: 'Not authorized to revoke tokens for users outside your organization' });
      }
      return await performRevocation(targetUserId);
    } else {
      return await performRevocation(targetUserId);
    }
  })
);

// CHANGE PASSWORD (Authenticated User)
router.post(
  '/change-password',
  verifyToken,
  validateBody(ChangePasswordRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.id;

    try {
      const user = await dbGet<{
        id: string;
        password: string;
      }>('SELECT id, password FROM users WHERE id = ?', [userId]);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
        return;
      }

      const passwordIsValid = bcrypt.compareSync(currentPassword, user.password);
      if (!passwordIsValid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
        return;
      }

      if (bcrypt.compareSync(newPassword, user.password)) {
        return res
          .status(400)
          .json({ error: 'New password must be different from current password' });
        return;
      }

      const hashedPassword = bcrypt.hashSync(newPassword, 10);

      const result = await dbRun('UPDATE users SET password = ? WHERE id = ?', [
        hashedPassword,
        userId,
      ]);
      if (!result.success) {
        throw new Error(result.error || 'Failed to update password');
      }

      ActivityService.log({
        organizationId: req.user!.organizationId || '',
        userId,
        action: 'password_changed',
        entityType: 'user',
        entityId: userId,
        entityName: 'Password Change',
      });

      await refreshTokenService.revokeAllUserTokens(userId);

      return res.json({
        success: true,
        message:
          'Password changed successfully. All other sessions have been logged out for security.',
      });
    } catch (error: unknown) {
      logger.error('[Auth] Change password error:', error);
      return res.status(500).json({ error: 'Failed to change password' });
    }
  })
);

// RESET PASSWORD (Public)
router.post(
  '/reset-password',
  validateBody(ResetPasswordRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { token, newPassword } = req.body;

    const resetData = await dbGet<{
      user_id: string;
      expires_at: string;
    }>('SELECT * FROM password_resets WHERE token = ?', [token]);

    if (!resetData) {
      return res.status(400).json({ error: 'Invalid or expired token' });
      return;
    }

    if (new Date(resetData.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Token has expired' });
      return;
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 8);

    const updateResult = await dbRun('UPDATE users SET password = ? WHERE id = ?', [
      hashedPassword,
      resetData.user_id,
    ]);
    if (!updateResult.success) {
      return res.status(500).json({ error: 'Failed to update password' });
      return;
    }

    await dbRun('DELETE FROM password_resets WHERE token = ?', [token]);
    return res.json({ message: 'Password updated successfully' });
  })
);

// EMAIL VERIFICATION
router.post(
  '/verify-email',
  validateBody(VerifyEmailRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { token } = req.body;

    try {
      const emailVerificationService = (await import('../services/emailVerificationService.js'))
        .default;
      const result = await emailVerificationService.verifyEmail(String(token || ''));

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      return res.json({ success: true, message: 'Email verified successfully' });
    } catch (error: unknown) {
      logger.error('Email verify error:', error);
      return res.status(500).json({ error: 'Verification failed' });
    }
  })
);

// MFA SETUP
router.post(
  '/mfa/setup',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const result = await mfaService.setupMFA(req.user!.id, req.user!.email || '');
      return res.json(result);
    } catch (error: unknown) {
      logger.error('MFA Setup error:', error);
      return res.status(500).json({ error: 'MFA setup failed' });
    }
  })
);

router.post(
  '/mfa/enable',
  verifyToken,
  validateBody(MFAEnableRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { token } = req.body;
    try {
      const result = await mfaService.verifyAndEnableMFA(req.user!.id, token);
      if (!result.success) {
        return res.status(400).json(result);
        return;
      }
      return res.json(result);
    } catch (error: unknown) {
      logger.error('MFA Enable error:', error);
      return res.status(500).json({ error: 'MFA activation failed' });
    }
  })
);

router.post(
  '/mfa/disable',
  verifyToken,
  validateBody(MFADisableRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { token } = req.body;
    try {
      const result = await mfaService.disableMFA(req.user!.id, token);
      if (!result.success) {
        return res.status(400).json(result);
        return;
      }
      return res.json(result);
    } catch (error: unknown) {
      logger.error('MFA Disable error:', error);
      return res.status(500).json({ error: 'MFA disable failed' });
    }
  })
);

// ==========================================
// GAP-AUTH-001: EMAIL VERIFICATION
// ==========================================

/**
 * GET /auth/verify-email
 * Verify email with token
 */
router.get(
  '/verify-email',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'Verification token is required' });
      }

      const emailVerificationService = (await import('../services/emailVerificationService.js'))
        .default;
      const result = await emailVerificationService.verifyEmail(token);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      // Redirect to frontend with success
      const redirectUrl = `${process.env.FRONTEND_URL || 'https://app.consultinity.com'}/email-verified?success=true`;
      return res.redirect(redirectUrl);
    } catch (error: unknown) {
      logger.error('Email verification error:', error);
      return res.status(500).json({ error: 'Email verification failed' });
    }
  })
);

/**
 * POST /auth/resend-verification
 * Resend verification email
 */
router.post(
  '/resend-verification',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;

      const emailVerificationService = (await import('../services/emailVerificationService.js'))
        .default;
      const result = await emailVerificationService.resendVerificationEmail(userId);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      return res.json({ success: true, message: 'Verification email sent' });
    } catch (error: unknown) {
      logger.error('Resend verification error:', error);
      return res.status(500).json({ error: 'Failed to resend verification email' });
    }
  })
);

/**
 * GET /auth/verification-status
 * Check if user's email is verified
 */
router.get(
  '/verification-status',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;

      const emailVerificationService = (await import('../services/emailVerificationService.js'))
        .default;
      const isVerified = await emailVerificationService.isEmailVerified(userId);

      return res.json({ emailVerified: isVerified });
    } catch (error: unknown) {
      logger.error('Verification status error:', error);
      return res.status(500).json({ error: 'Failed to check verification status' });
    }
  })
);

export default router;
