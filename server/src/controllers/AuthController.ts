/**
 * Auth Controller
 * Handles authentication-related operations
 */

import { Request, Response } from 'express';


import type { IDatabase } from '../database/IDatabase.js';
import mfaService from '../services/MFAService.js';
import refreshTokenService from '../services/RefreshTokenService.js';
import logger from '../utils/Logger.js';
import type { LoginRequest } from '../validators/auth.validators.js';

// Dependencies interface for dependency injection
interface Dependencies {
    db: IDatabase;
    bcrypt: {
        compareSync: (password: string, hash: string) => boolean;
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
                import('../database/index.js'),
                import('bcryptjs'),
                import('../services/ActivityService.js').then((m) => m.default || m),
                import('../utils/RedisRateLimitStore.js'),
            ]);

            deps = {
                db: dbModule.default || dbModule,
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
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Operation timeout')), timeoutMs)),
    ]);
};

/**
 * Handle User Login
 */
export const login = async (req: Request, res: Response): Promise<void> => {
    const dependencies = await getDeps();

    const body = req.body as LoginRequest;
    logger.info('[Auth] Login request received for:', body.email || 'no email');
    const { email, password, mfaToken, deviceFingerprint, trustDevice } = body;

    // Best-effort rate limit clear (pre-validation)
    try {
        const authRedisStore = new dependencies.RedisStore({ windowMs: 15 * 60 * 1000 });
        const rateLimitKey = `auth:${email.toLowerCase().trim()}`;
        await withTimeout(authRedisStore.resetKey(rateLimitKey), 500);
    } catch (err: any) {
        // Ignore rate limit errors
    }

    try {
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
            dependencies.db.get('SELECT * FROM users WHERE email = ?', [email], (err: Error | null, row: unknown) => {
                if (err) reject(err);
                else resolve(row as any);
            });
        });

        if (!user) {
            res.status(401).json({ error: 'Invalid email or password' });
            return;
        }

        // Verify password
        const passwordIsValid = dependencies.bcrypt.compareSync(password, user.password);
        if (!passwordIsValid) {
            res.status(401).json({ error: 'Invalid email or password' });
            return;
        }

        // Clear rate limit (success)
        try {
            const authRedisStore = new dependencies.RedisStore({ windowMs: 15 * 60 * 1000 });
            const rateLimitKey = `auth:${email.toLowerCase().trim()}`;
            await withTimeout(authRedisStore.resetKey(rateLimitKey), 500);
        } catch (err: any) {
            // Ignore
        }

        // Get organization
        const org = await new Promise<{
            id: string;
            name: string;
            status: string;
            plan: string;
        } | null>((resolve, reject) => {
            dependencies.db.get(
                'SELECT * FROM organizations WHERE id = ?',
                [user.organization_id],
                (err: Error | null, row: unknown) => {
                    if (err) reject(err);
                    else resolve(row as any);
                },
            );
        });

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

        // Check MFA
        const mfaStatus = await dependencies.MFAService.getMFAStatus(user.id);

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
                        req.get('user-agent'),
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
                    req.get('user-agent'),
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

        // Update Last Login
        await new Promise<void>((resolve) => {
            dependencies.db.run('UPDATE users SET last_login = datetime("now") WHERE id = ?', [user.id], () =>
                resolve(),
            );
        });

        // Generate tokens
        const deviceInfo = (req.get('user-agent') || 'Unknown Device').substring(0, 200);
        const tokenPair = await dependencies.RefreshTokenService.generateTokenPair(
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
            },
        );

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
            accessLevel: org.status === 'active' && (org.plan === 'enterprise' || org.plan === 'pro') ? 'full' : 'free',
        };

        // Log activity
        dependencies.ActivityService.log({
            organizationId: user.organization_id,
            userId: user.id,
            action: 'login',
            entityType: 'session',
            entityId: 'session',
            entityName: 'User Login',
        });

        res.json({
            user: safeUser,
            token: tokenPair.accessToken,
            refreshToken: tokenPair.refreshToken,
            expiresIn: tokenPair.expiresIn,
        });
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
