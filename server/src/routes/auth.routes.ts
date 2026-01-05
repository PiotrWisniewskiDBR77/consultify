/**
 * Auth Routes
 * Authentication and authorization endpoints
 */

import bcrypt from 'bcryptjs';
import { Response, Router } from 'express';

import { login } from '../controllers/AuthController.js';
import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { validateBody, validateParams } from '../middleware/validation.middleware.js';
// import _emailVerificationService from '../services/EmailVerificationService.js';
const _emailVerificationService = {} as any; // Stubbed missing service
import mfaService from '../services/MFAService.js';
import refreshTokenService from '../services/RefreshTokenService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
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
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Operation timeout')), timeoutMs)),
    ]);
};

// LOGIN
router.post('/login', validateBody(LoginRequestSchema), asyncHandler(login));

// REFRESH TOKEN - Get new access token using refresh token
router.post(
    '/refresh',
    validateBody(RefreshTokenRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { refreshToken } = req.body;

        try {
            const result = await refreshTokenService.refreshAccessToken(refreshToken, {
                ip: req.ip,
                userAgent: req.get('user-agent') || null,
            });

            if (!result) {
                return res.status(401).json({ error: 'Invalid or expired refresh token' });
                return;
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
    }),
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
    }),
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
    }),
);

// GET ME - Validate token and return user data
router.get(
    '/me',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const user = await dbGet<{
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
                [req.user!.id],
            );

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
                    },
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
    }),
);

// LOGOUT - Revokes the current token
router.post(
    '/logout',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                return res.status(401).json({ error: 'No token provided' });
                return;
            }

            const token = authHeader.split(' ')[1];
            const decoded = jwt.decode(token) as { jti?: string; exp?: number; id?: string } | null;

            if (!decoded || !decoded.jti) {
                // Token doesn't have jti (old token format), just acknowledge logout
                return res.json({ message: 'Logged out successfully' });
                return;
            }

            // Calculate expiry from token
            const expiresAt = new Date((decoded.exp || 0) * 1000).toISOString();

            // Add token to revocation list
            await dbRun(`INSERT OR IGNORE INTO revoked_tokens (jti, user_id, expires_at, reason) VALUES (?, ?, ?, ?)`, [
                decoded.jti,
                req.user!.id,
                expiresAt,
                'logout',
            ]);
            return res.json({ message: 'Logged out successfully' });
        } catch (error: unknown) {
            logger.error('Logout error:', error);
            return res.status(500).json({ error: 'Logout failed' });
        }
    }),
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
            { expiresIn: config.JWT_EXPIRES_IN },
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
    }),
);

// DEMO LOGIN - Auto-login as demo@legolex.com
router.post(
    '/demo-login',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const DEMO_EMAIL = 'demo@legolex.com';
        const DEMO_PASSWORD = 'Demo123!';

        logger.info('[Auth] Demo login request');

        try {
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
    }),
);

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
        const { default: AttributionService } = (await import('../services/attributionService.js')) as any;

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

        const existingUser = await dbGet<{ id: string }>('SELECT id FROM users WHERE email = ?', [email]);
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
                    [orgId, companyName || 'My Company', finalPlan, finalStatus],
                );

                if (!orgResult.success) {
                    if (process.env.NODE_ENV !== 'production') logger.error('Register Org Error:', orgResult.error);
                    return res.status(500).json({ error: 'Failed to create organization' });
                    return;
                }

                // Create user
                const userResult = await dbRun(
                    `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [userId, orgId, email, hashedPassword, firstName, lastName, 'ADMIN'],
                );

                if (!userResult.success) {
                    if (process.env.NODE_ENV !== 'production') logger.error('Register User Error:', userResult.error);
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
                        [uuidv4(), email, firstName, lastName, orgId, companyName || 'My Company', 'pending'],
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
                    { expiresIn: config.JWT_EXPIRES_IN },
                );

                ActivityService.log({
                    organizationId: orgId,
                    userId: userId,
                    action: 'registered',
                    entityType: 'organization',
                    entityId: orgId,
                    entityName: companyName,
                });

                return res.json({
                    user: {
                        id: userId,
                        email,
                        firstName,
                        lastName,
                        role: 'ADMIN',
                        companyName: companyName,
                        organizationId: orgId,
                    },
                    token,
                    promoApplied: promoCode
                        ? {
                            code: promoCode,
                            discountType: promoValidation?.discountType,
                            discountValue: promoValidation?.discountValue,
                        }
                        : null,
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
                    await dbRun('UPDATE access_codes SET current_uses = current_uses + 1 WHERE id = ?', [codeRow.id]);
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
    }),
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
                    [marker, userIdToRevoke, expiresAt, 'revoke-all'],
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
    }),
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
                return res.status(400).json({ error: 'New password must be different from current password' });
                return;
            }

            const hashedPassword = bcrypt.hashSync(newPassword, 10);

            const result = await dbRun('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
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
                message: 'Password changed successfully. All other sessions have been logged out for security.',
            });
        } catch (error: unknown) {
            logger.error('[Auth] Change password error:', error);
            return res.status(500).json({ error: 'Failed to change password' });
        }
    }),
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
    }),
);

// EMAIL VERIFICATION
router.post(
    '/verify-email',
    validateBody(VerifyEmailRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { token } = req.body;

        try {
            const user = await dbGet<{
                id: string;
                email_verification_expires_at: string;
            }>('SELECT * FROM users WHERE email_verification_token = ?', [token]);

            if (!user) {
                return res.status(400).json({ error: 'Invalid token' });
                return;
            }

            if (new Date(user.email_verification_expires_at) < new Date()) {
                return res.status(400).json({ error: 'Token expired' });
                return;
            }

            const runResult = await dbRun(
                `UPDATE users SET 
             email_verified = 1, 
             email_verification_token = NULL, 
             email_verification_expires_at = NULL 
             WHERE id = ?`,
                [user.id],
            );

            if (!runResult.success) {
                throw new Error(runResult.error || 'Failed to verify email');
            }

            return res.json({ success: true, message: 'Email verified successfully' });
        } catch (error: unknown) {
            logger.error('Email verify error:', error);
            return res.status(500).json({ error: 'Verification failed' });
        }
    }),
);

router.post(
    '/resend-verification',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const userId = req.user!.id;
        const { default: EmailService } = await import('../services/emailService.js');

        try {
            const token = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

            await dbRun(
                `UPDATE users SET 
                 email_verification_token = ?, 
                 email_verification_expires_at = ?,
                 email_verification_sent_at = datetime('now')
                 WHERE id = ?`,
                [token, expiresAt, userId],
            );

            const verifyLink = `${process.env.APP_URL || 'http://localhost:3000'}/auth/verify-email?token=${token}`;
            await EmailService.sendEmail(
                req.user!.email || '',
                'Verify your Email',
                `<a href="${verifyLink}">Click here to verify your email</a>`,
            );

            return res.json({ success: true, message: 'Verification email sent' });
        } catch (error: unknown) {
            logger.error('Resend verify error:', error);
            return res.status(500).json({ error: 'Failed to send email' });
        }
    }),
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
    }),
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
    }),
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
    }),
);

export default router;
