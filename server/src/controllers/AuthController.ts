// @ts-nocheck
/**
 * Auth Controller
 * Handles authentication-related operations
 */

import { Request, Response } from 'express';

import type { IDatabase } from '../database/IDatabase.js';
import { ORG_TYPES } from '../services/access/AccessTypes.js';
import mfaService from '../services/MFAService.js';
import { DEMO_EXPIRED_USER_STATUS } from '../services/demo/demoPrincipalGuard.js';
import refreshTokenService from '../services/RefreshTokenService.js';
import { recordFailedLogin } from '../services/securityAlerts.js';
import { setAuthCookies } from '../utils/cookieAuth.js';
import logger from '../utils/Logger.js';
import type { LoginRequest } from '../validators/auth.validators.js';

const getForcedSuperAdminEmails = (): Set<string> => {
  const raw = String(process.env.FORCE_SUPERADMIN_EMAILS || '');
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
};

// Dependencies interface for dependency injection
interface Dependencies {
  db: IDatabase;
  bcrypt: {
    compareSync: (password: string, hash: string) => boolean;
    compare?: (password: string, hash: string) => Promise<boolean>;
  };
  ActivityService: {
    log: (data: {
      organizationId?: string;
      userId: string;
      action: string;
      entityType: string;
      entityId: string;
      entityName: string;
    }) => void;
  };
  MFAService: typeof mfaService;
  RefreshTokenService: typeof refreshTokenService;
  RedisStore: new (options: { windowMs: number }) => {
    resetKey: (key: string) => Promise<void>;
  };
}

// Default dependencies (lazy loaded to avoid circular deps)
let deps: Dependencies | null = null;
let depsPromise: Promise<Dependencies> | null = null;

const getDeps = async (): Promise<Dependencies> => {
  if (deps) {
    return deps;
  }
  if (!depsPromise) {
    depsPromise = (async () => {
      const [dbModule, bcryptModule, activityModule, redisModule] = await Promise.all([
        import('../database/Database.js'),
        import('bcryptjs'),
        import('../services/ActivityService.js').then((m) => m.default || m),
        import('../utils/RedisRateLimitStore.js'),
      ]);

      deps = {
        db: dbModule.default || dbModule.getDatabase(),
        bcrypt: bcryptModule.default || bcryptModule,
        ActivityService: (activityModule as any).default || activityModule,
        MFAService: mfaService,
        RefreshTokenService: refreshTokenService,
        RedisStore: (redisModule.default || redisModule) as new (options: { windowMs: number }) => {
          resetKey: (key: string) => Promise<void>;
        },
      };
      return deps;
    })();
  }
  return depsPromise;
};

/**
 * Helper: Timeout wrapper for promises
 */
const withTimeout = <T>(promise: Promise<T>, timeoutMs = 1000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timeout')), timeoutMs)
    ),
  ]);
};

const resetAuthRateLimit = async (
  dependencies: Dependencies,
  normalizedEmail: string,
  timeoutMs = 500
): Promise<void> => {
  const authRedisStore = new dependencies.RedisStore({ windowMs: 15 * 60 * 1000 });
  const rateLimitKey = `auth:${normalizedEmail}`;
  await withTimeout(authRedisStore.resetKey(rateLimitKey), timeoutMs);
};

const comparePassword = async (
  bcrypt: Dependencies['bcrypt'],
  password: string,
  hash: string
): Promise<boolean> => {
  if (typeof bcrypt.compare === 'function') {
    return bcrypt.compare(password, hash);
  }
  return bcrypt.compareSync(password, hash);
};

/**
 * Handle User Login
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  const dependencies = await getDeps();

  logger.info('[AuthController] Login request received for email:', req.body?.email);

  const body = req.body as LoginRequest;
  logger.info(`[Auth] Login request received for email: ${body.email}`);
  const { email, password, mfaToken, deviceFingerprint, trustDevice } = body;
  const normalizedEmail = String(email || '')
    .trim()
    .toLowerCase();

  void resetAuthRateLimit(dependencies, normalizedEmail).catch((err: any) => {
    logger.info(`[Auth] Rate limit reset failed (ignoring): ${err.message}`);
  });

  try {
    logger.info(`[Auth] Querying user from DB: ${email}`);
    // Get user
    const user = await new Promise<{
      id: string;
      email: string;
      role: string;
      organization_id: string;
      first_name: string;
      last_name: string;
      status: string;
      password: string;
    } | null>((resolve, reject) => {
      dependencies.db.get(
        'SELECT * FROM users WHERE email = ?',
        [normalizedEmail],
        (err: Error | null, row: unknown) => {
          if (err) {
            logger.error(`[Auth] DB Query Error: ${err.message}`);
            reject(err);
          } else {
            logger.info(`[Auth] DB Query Success. Found user: ${row ? 'YES' : 'NO'}`);
            resolve(row as any);
          }
        }
      );
    });

    if (!user) {
      logger.info('[Auth] User not found.');
      void recordFailedLogin(normalizedEmail, req.ip);
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Permanent role fix: selected internal accounts must always be SUPERADMIN.
    // This also updates DB so refresh tokens and /auth/me stay consistent.
    if (
      getForcedSuperAdminEmails().has(
        String(user.email || '')
          .trim()
          .toLowerCase()
      )
    ) {
      if (user.role !== 'SUPERADMIN') {
        try {
          await new Promise<void>((resolve) => {
            dependencies.db.run(
              `UPDATE users SET role = ? WHERE id = ?`,
              ['SUPERADMIN', user.id],
              () => resolve()
            );
          });
          user.role = 'SUPERADMIN';
        } catch (e: any) {
          // Don't block login on a best-effort role sync; still override in-memory.
          user.role = 'SUPERADMIN';
          logger.warn('[Auth] Failed to persist forced SUPERADMIN role (continuing)', {
            email: user.email,
            error: e?.message || e,
          });
        }
      }
    }

    logger.info('[Auth] Verifying password...');
    // Verify password
    const passwordIsValid = await comparePassword(dependencies.bcrypt, password, user.password);
    logger.info(`[Auth] Password valid: ${passwordIsValid}`);
    if (!passwordIsValid) {
      void recordFailedLogin(normalizedEmail, req.ip);
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // OPS-DEMO-002: a public demo principal whose session lapsed is retired by
    // `retireExpiredDemoPrincipal` (users.status -> demo_expired) and must not be
    // able to mint a fresh access token by logging in again. Scoped to that one
    // status so no other account's login behaviour changes.
    if (String(user.status || '').trim().toLowerCase() === DEMO_EXPIRED_USER_STATUS) {
      res.status(403).json({
        error: 'This demo session has ended. Start a new demo to continue.',
        code: 'DEMO_SESSION_EXPIRED',
      });
      return;
    }

    // Clear rate limit (success)
    void resetAuthRateLimit(dependencies, normalizedEmail).catch(() => {
      // Ignore rate-limit cleanup failures on success.
    });

    const [org, mfaStatus] = await Promise.all([
      new Promise<{
        id: string;
        name: string;
        status: string;
        plan: string;
        organization_type?: string;
      } | null>((resolve, reject) => {
        dependencies.db.get(
          'SELECT * FROM organizations WHERE id = ?',
          [user.organization_id],
          (err: Error | null, row: unknown) => {
            if (err) reject(err);
            else resolve(row as any);
          }
        );
      }),
      dependencies.MFAService.getMFAStatus(user.id),
    ]);

    if (!org) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    // Check organization status
    if (org.status === 'pending' && user.role !== 'SUPERADMIN') {
      res.status(403).json({
        error: 'Your organization is waiting for approval.',
        status: 'pending',
      });
      return;
    }
    if (org.status === 'blocked' && user.role !== 'SUPERADMIN') {
      res.status(403).json({
        error: 'Your organization has been blocked. Contact support.',
      });
      return;
    }

    if (mfaStatus.enabled) {
      if (deviceFingerprint) {
        const isTrusted = await dependencies.MFAService.isDeviceTrusted(user.id, deviceFingerprint);
        if (!isTrusted && !mfaToken) {
          res.json({
            mfaRequired: true,
            userId: user.id,
            message: 'Please enter your 2FA code',
          });
          return;
        } else if (!isTrusted) {
          // Verify Token
          const verification = await dependencies.MFAService.verifyTOTP(
            user.id,
            mfaToken!,
            req.ip,
            req.get('user-agent')
          );
          if (!verification.success) {
            res.status(401).json({
              error: verification.error,
              mfaRequired: true,
            });
            return;
          }
          if (trustDevice) {
            const deviceName = (req.get('user-agent') || 'Unknown Device').substring(0, 100);
            await dependencies.MFAService.trustDevice(user.id, deviceFingerprint, deviceName);
          }
        }
      } else if (!mfaToken) {
        res.json({
          mfaRequired: true,
          userId: user.id,
          message: 'Please enter your 2FA code',
        });
        return;
      } else {
        const verification = await dependencies.MFAService.verifyTOTP(
          user.id,
          mfaToken,
          req.ip,
          req.get('user-agent')
        );
        if (!verification.success) {
          res.status(401).json({
            error: verification.error,
            mfaRequired: true,
          });
          return;
        }
      }
    } else if (mfaStatus.enforced) {
      res.status(403).json({
        error: 'Your organization requires two-factor authentication. Please set up MFA first.',
        mfaSetupRequired: true,
        gracePeriodRemaining: mfaStatus.gracePeriodRemaining,
      });
      return;
    }

    const orgType = String((org as { organization_type?: string }).organization_type || '')
      .trim()
      .toUpperCase();

    // Generate tokens
    const deviceInfo = (req.get('user-agent') || 'Unknown Device').substring(0, 200);
    const tokenPair = await dependencies.RefreshTokenService.generateTokenPair(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        organization_id: user.organization_id,
        isDemo: orgType === ORG_TYPES.DEMO,
      },
      {
        deviceInfo,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    // Prefer cookie-based auth in addition to JSON tokens.
    // This prevents "No token provided" when localStorage is missing/cleared.
    try {
      setAuthCookies(res, tokenPair.accessToken, tokenPair.refreshToken);
    } catch (err: any) {
      // Non-fatal in dev; still return JSON tokens.
      logger.warn('[Auth] Failed to set auth cookies (continuing)', { error: err?.message || err });
    }

    const safeUser = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      status: user.status,
      organizationId: user.organization_id,
      companyName: org.name,
      mfaEnabled: mfaStatus.enabled,
      isAuthenticated: true,
      isDemo: orgType === ORG_TYPES.DEMO,
      accessLevel:
        org.status === 'active' && (org.plan === 'enterprise' || org.plan === 'pro')
          ? 'full'
          : 'free',
    };

    logger.info(
      '[AuthController] Sending response:',
      JSON.stringify({
        user: safeUser,
        token: tokenPair.accessToken,
      })
    );

    logger.info('[AuthController] Sending response with res.send');

    res.status(200).send({
      user: safeUser,
      token: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      expiresIn: tokenPair.expiresIn,
    });

    void new Promise<void>((resolve) => {
      dependencies.db.run(
        'UPDATE users SET last_login = datetime("now") WHERE id = ?',
        [user.id],
        () => resolve()
      );
    }).catch(() => {
      // Ignore best-effort last_login update.
    });

    void Promise.resolve().then(() =>
      dependencies.ActivityService.log({
        organizationId: user.organization_id,
        userId: user.id,
        action: 'login',
        entityType: 'session',
        entityId: 'session',
        entityName: 'User Login',
      })
    );
  } catch (error: unknown) {
    logger.error('[Auth] Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Set dependencies (for testing)
 */
export const setDependencies = async (newDeps: Partial<Dependencies>): Promise<void> => {
  const currentDeps = await getDeps();
  deps = { ...currentDeps, ...newDeps };
};
