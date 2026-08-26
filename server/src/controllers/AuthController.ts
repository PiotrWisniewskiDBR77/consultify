// @ts-nocheck
/**
 * Auth Controller
 * Handles authentication-related operations
 */

import { Request, Response } from 'express';

import type { IDatabase } from '../database/IDatabase.js';
import { ORG_TYPES } from '../services/access/AccessTypes.js';
import mfaService from '../services/MFAService.js';
import {
  assertDemoPrincipalMayReceiveCredentials,
  DEMO_EXPIRED_USER_STATUS,
} from '../services/demo/demoPrincipalGuard.js';
import { buildOrgSuspendedResponseBody } from '../services/organizationSuspensionGuard.js';
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
  const { email, password, mfaToken, mfaChallenge, deviceFingerprint, trustDevice } = body;
  const normalizedEmail = String(email || '')
    .trim()
    .toLowerCase();

  try {
    const verifiedChallenge = mfaChallenge
      ? await dependencies.MFAService.verifyLoginChallenge(
          mfaChallenge,
          mfaToken || '',
          deviceFingerprint,
          Boolean(trustDevice),
          req.ip,
          req.get('user-agent')
        )
      : null;
    if (verifiedChallenge && !verifiedChallenge.success) {
      res.status(verifiedChallenge.status || 401).json({
        error: 'The authentication challenge is invalid, expired, or locked',
        code: verifiedChallenge.code,
        mfaRequired: true,
      });
      return;
    }

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
          verifiedChallenge?.success
            ? 'SELECT * FROM users WHERE id = ? AND organization_id = ?'
            : 'SELECT * FROM users WHERE email = ?',
          verifiedChallenge?.success
            ? [verifiedChallenge.userId, verifiedChallenge.organizationId]
            : [normalizedEmail],
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
    const passwordIsValid = verifiedChallenge?.success
      ? true
      : await comparePassword(dependencies.bcrypt, password, user.password);
    logger.info(`[Auth] Password valid: ${passwordIsValid}`);
    if (!passwordIsValid) {
      void recordFailedLogin(normalizedEmail, req.ip);
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // OPS-DEMO-002: a public demo principal may only be issued credentials while
    // its demo session is live.
    //
    // This asks the session table DIRECTLY rather than trusting
    // `users.status === demo_expired`. Retirement is lazy — it happens on the
    // first authenticated request after the TTL — so a prospect who simply closes
    // the tab and logs in again tomorrow reaches this line with a session that
    // expired hours ago and a status that still reads `active`. Gating on the
    // status flag would mint them a fresh token in exactly that window.
    // `assertDemoPrincipalMayReceiveCredentials` also performs the retirement it
    // finds outstanding, so the account and its token family are closed here.
    const demoCredentialCheck = await assertDemoPrincipalMayReceiveCredentials(user.id);
    if (!demoCredentialCheck.allowed) {
      res.status(403).json({
        error: 'This demo session has ended. Start a new demo to continue.',
        code: 'DEMO_SESSION_EXPIRED',
      });
      return;
    }

    // Belt and braces for an account already retired by an earlier request.
    if (
      String(user.status || '')
        .trim()
        .toLowerCase() === DEMO_EXPIRED_USER_STATUS
    ) {
      res.status(403).json({
        error: 'This demo session has ended. Start a new demo to continue.',
        code: 'DEMO_SESSION_EXPIRED',
      });
      return;
    }

    const [org, mfaStatus, activeMembership] = await Promise.all([
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
      new Promise<{ role: string } | null>((resolve, reject) => {
        dependencies.db.get(
          `SELECT role
             FROM organization_members
            WHERE organization_id = ? AND user_id = ?
              AND UPPER(COALESCE(status, '')) = 'ACTIVE'
            LIMIT 1`,
          [user.organization_id, user.id],
          (err: Error | null, row: unknown) => {
            if (err) reject(err);
            else resolve(row as { role: string } | null);
          }
        );
      }),
    ]);

    if (!org) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    // Organization membership is the authorization source of truth. A fresh
    // login must neither preserve a stale role from users.role nor mint a new
    // session after membership revocation. This also makes role changes visible
    // immediately in the next session without waiting for an old JWT to expire.
    // DEC-91 FIX-2: capture the PLATFORM role from `users.role` before the line
    // below overwrites `user.role` with the membership role. The suspension
    // branch further down must not be satisfiable by an
    // `organization_members.role` row that merely says 'SUPERADMIN' — that
    // column's vocabulary is a data-hygiene invariant, not a security boundary.
    const isPlatformSuperAdmin =
      String(user.role || '')
        .trim()
        .toUpperCase() === 'SUPERADMIN';

    if (user.role !== 'SUPERADMIN') {
      if (!activeMembership?.role) {
        res.status(403).json({
          error: 'You no longer have access to this organization',
          code: 'ORG_MEMBERSHIP_REVOKED',
        });
        return;
      }
      user.role = activeMembership.role;
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
    // DEC-91 / TRI-MUST-12 — a suspended tenant must not mint new sessions.
    // Until now `suspended` fell through this block entirely: the suspension was
    // written and audited, but login carried on as if nothing had happened.
    // SUPERADMIN is exempted for the same reason the two branches above exempt
    // it — the operator has to be able to get in and reactivate the tenant.
    if (
      String(org.status || '')
        .trim()
        .toLowerCase() === 'suspended' &&
      !isPlatformSuperAdmin
    ) {
      res.status(403).json(buildOrgSuspendedResponseBody());
      return;
    }

    if (mfaStatus.enabled && !verifiedChallenge?.success) {
      const isTrusted = deviceFingerprint
        ? await dependencies.MFAService.isDeviceTrusted(
            user.organization_id,
            user.id,
            deviceFingerprint
          )
        : false;
      if (!isTrusted) {
        const challenge = await dependencies.MFAService.createLoginChallenge(
          user.organization_id,
          user.id,
          req.ip,
          req.get('user-agent')
        );
        res.json({
          mfaRequired: true,
          mfaChallenge: challenge,
          message: 'Please enter your 2FA code',
        });
        return;
      }
    } else if (!mfaStatus.enabled && mfaStatus.enforced) {
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

    // Public demo accounts belong to the stable base organization, while their
    // data lives in a short-lived, per-user session tenant. A fresh login must
    // return that active tenant again. Otherwise the client can only see the
    // base `demo-org`, then tries to provision another demo through the guarded
    // `/api/demo/toggle` write and is correctly denied as a public principal.
    const activeDemoSession =
      orgType === ORG_TYPES.DEMO
        ? await new Promise<{
            id: string;
            session_org_id: string;
            locale: 'en' | 'pl';
            expires_at: string;
            anchor_date: string;
          } | null>((resolve, reject) => {
            dependencies.db.get(
              `SELECT id, session_org_id, COALESCE(locale, 'en') AS locale,
                      expires_at, anchor_date
                 FROM demo_sessions
                WHERE user_id = ? AND base_org_id = ? AND status = 'active'
                  AND expires_at > ?
                ORDER BY created_at DESC
                LIMIT 1`,
              [user.id, user.organization_id, new Date().toISOString()],
              (err: Error | null, row: unknown) => {
                if (err) reject(err);
                else resolve(row as any);
              }
            );
          })
        : null;

    // Trust is the final pre-issuance side effect, after every current tenant,
    // organization and demo-session guard has passed.
    if (
      verifiedChallenge?.success &&
      verifiedChallenge.trustRequested &&
      verifiedChallenge.deviceCredential
    ) {
      const deviceName = (req.get('user-agent') || 'Unknown Device').substring(0, 100);
      await dependencies.MFAService.trustDevice(
        user.organization_id,
        user.id,
        verifiedChallenge.deviceCredential,
        deviceName
      );
    }

    // Only a completed authentication (including MFA) may reset the password
    // limiter. A first-factor success is not yet a login.
    void resetAuthRateLimit(dependencies, normalizedEmail || user.email).catch(() => {
      // Ignore rate-limit cleanup failures after complete authentication.
    });

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
      demoSession: activeDemoSession
        ? {
            id: activeDemoSession.id,
            organizationId: activeDemoSession.session_org_id,
            locale: activeDemoSession.locale,
            expiresAt: activeDemoSession.expires_at,
            anchorDate: activeDemoSession.anchor_date,
          }
        : null,
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
