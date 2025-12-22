const express = require('express');
const router = express.Router();
const db = require('../database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const authMiddleware = require('../middleware/authMiddleware');
const ActivityService = require('../services/activityService');

// LOGIN
// Enhanced with MFA support and refresh tokens
router.post('/login', async (req, res) => {
    const { email, password, mfaToken, deviceFingerprint, trustDevice } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    // Clear rate limit on successful login attempt (before validation)
    // This prevents legitimate users from being blocked after fixing their password
    // Note: We'll clear it again after successful login, but clearing early helps
    // if user had typos and is now typing correctly
    try {
        const RedisStore = require('../utils/redisRateLimitStore');
        const authRedisStore = new RedisStore({ windowMs: 15 * 60 * 1000 });
        const rateLimitKey = `auth:${email.toLowerCase().trim()}`;
        await authRedisStore.resetKey(rateLimitKey);
    } catch (err) {
        // Ignore errors - rate limit clearing is best effort
    }

    // Import services
    const MFAService = require('../services/mfaService');
    const RefreshTokenService = require('../services/refreshTokenService');

    try {
        // Get user
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!user) {
            // Don't reveal if user exists or not (security best practice)
            // But don't count this toward rate limit since it's not a real attempt
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Verify password
        const passwordIsValid = bcrypt.compareSync(password, user.password);
        if (!passwordIsValid) {
            // Invalid password - this counts toward rate limit
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Successful password verification - clear rate limit for this email
        // This allows users to retry after fixing typos without hitting limit
        try {
            const RedisStore = require('../utils/redisRateLimitStore');
            const authRedisStore = new RedisStore({ windowMs: 15 * 60 * 1000 });
            const rateLimitKey = `auth:${email.toLowerCase().trim()}`;
            await authRedisStore.resetKey(rateLimitKey);
        } catch (err) {
            // Ignore errors - rate limit clearing is best effort
        }

        // Get organization
        const org = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM organizations WHERE id = ?', [user.organization_id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!org) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        // Check organization status
        if (org.status === 'pending' && user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Your organization is waiting for approval.', status: 'pending' });
        }
        if (org.status === 'blocked' && user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Your organization has been blocked. Contact support.' });
        }

        // Check MFA requirement
        const mfaStatus = await MFAService.getMFAStatus(user.id);

        if (mfaStatus.enabled) {
            // MFA is enabled - check if device is trusted
            if (deviceFingerprint) {
                const isTrusted = await MFAService.isDeviceTrusted(user.id, deviceFingerprint);
                if (isTrusted) {
                    // Device is trusted, skip MFA
                } else if (!mfaToken) {
                    // Need MFA verification
                    return res.json({
                        mfaRequired: true,
                        userId: user.id,
                        message: 'Please enter your 2FA code'
                    });
                } else {
                    // Verify MFA token
                    const verification = await MFAService.verifyTOTP(
                        user.id,
                        mfaToken,
                        req.ip,
                        req.get('user-agent')
                    );

                    if (!verification.success) {
                        return res.status(401).json({
                            error: verification.error,
                            mfaRequired: true
                        });
                    }

                    // Trust device if requested
                    if (trustDevice && deviceFingerprint) {
                        const deviceName = (req.get('user-agent') || 'Unknown Device').substring(0, 100);
                        await MFAService.trustDevice(user.id, deviceFingerprint, deviceName);
                    }
                }
            } else if (!mfaToken) {
                // No device fingerprint, need MFA
                return res.json({
                    mfaRequired: true,
                    userId: user.id,
                    message: 'Please enter your 2FA code'
                });
            } else {
                // Verify MFA token
                const verification = await MFAService.verifyTOTP(
                    user.id,
                    mfaToken,
                    req.ip,
                    req.get('user-agent')
                );

                if (!verification.success) {
                    return res.status(401).json({
                        error: verification.error,
                        mfaRequired: true
                    });
                }
            }
        } else if (mfaStatus.enforced) {
            // Organization requires MFA but user hasn't set it up
            return res.status(403).json({
                error: 'Your organization requires two-factor authentication. Please set up MFA first.',
                mfaSetupRequired: true,
                gracePeriodRemaining: mfaStatus.gracePeriodRemaining
            });
        }

        // Update Last Login
        await new Promise((resolve) => {
            db.run('UPDATE users SET last_login = datetime("now") WHERE id = ?', [user.id], resolve);
        });

        // Generate token pair (access + refresh)
        const deviceInfo = (req.get('user-agent') || 'Unknown Device').substring(0, 200);
        const tokenPair = await RefreshTokenService.generateTokenPair(
            {
                id: user.id,
                email: user.email,
                role: user.role,
                organization_id: user.organization_id
            },
            {
                deviceInfo,
                ip: req.ip,
                userAgent: req.get('user-agent')
            }
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
            mfaEnabled: mfaStatus.enabled
        };

        // Log successful login
        ActivityService.log({
            organizationId: user.organization_id,
            userId: user.id,
            action: 'login',
            entityType: 'session',
            entityId: 'session',
            entityName: 'User Login'
        });

        res.json({
            user: safeUser,
            token: tokenPair.accessToken,
            refreshToken: tokenPair.refreshToken,
            expiresIn: tokenPair.expiresIn
        });

    } catch (error) {
        console.error('[Auth] Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// REFRESH TOKEN - Get new access token using refresh token
router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required' });
    }

    const RefreshTokenService = require('../services/refreshTokenService');

    try {
        const result = await RefreshTokenService.refreshAccessToken(refreshToken, {
            ip: req.ip,
            userAgent: req.get('user-agent')
        });

        if (!result) {
            return res.status(401).json({ error: 'Invalid or expired refresh token' });
        }

        res.json({
            token: result.accessToken,
            refreshToken: result.refreshToken,
            expiresIn: result.expiresIn
        });
    } catch (error) {
        console.error('[Auth] Refresh error:', error);
        res.status(500).json({ error: 'Token refresh failed' });
    }
});

// GET ACTIVE SESSIONS
router.get('/sessions', authMiddleware, async (req, res) => {
    const RefreshTokenService = require('../services/refreshTokenService');

    try {
        const sessions = await RefreshTokenService.getActiveSessions(req.user.id);
        res.json({ sessions });
    } catch (error) {
        console.error('[Auth] Get sessions error:', error);
        res.status(500).json({ error: 'Failed to get sessions' });
    }
});

// REVOKE SESSION
router.delete('/sessions/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const RefreshTokenService = require('../services/refreshTokenService');

    try {
        await RefreshTokenService.revokeSession(req.user.id, id);
        res.json({ success: true, message: 'Session revoked' });
    } catch (error) {
        console.error('[Auth] Revoke session error:', error);
        res.status(500).json({ error: 'Failed to revoke session' });
    }
});


// GET ME - Validate token and return user data
router.get('/me', authMiddleware, (req, res) => {
    // req.user is populated by authMiddleware
    res.json({
        user: {
            id: req.user.id,
            email: req.user.email,
            role: req.user.role,
            organizationId: req.user.organizationId,
            impersonatorId: req.user.impersonator_id // Pass claim to frontend
            // Add other fields if needed, but keep it consistent with login response
        }
    });
});

// LOGOUT - Revokes the current token
router.post('/logout', authMiddleware, (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.decode(token);

        if (!decoded || !decoded.jti) {
            // Token doesn't have jti (old token format), just acknowledge logout
            return res.json({ message: 'Logged out successfully' });
        }

        // Calculate expiry from token
        const expiresAt = new Date(decoded.exp * 1000).toISOString();

        // Add token to revocation list
        db.run(
            `INSERT OR IGNORE INTO revoked_tokens (jti, user_id, expires_at, reason) VALUES (?, ?, ?, ?)`,
            [decoded.jti, req.user.id, expiresAt, 'logout'],
            (err) => {
                if (err) {
                    console.error('Error revoking token:', err);
                    // Still return success - user is "logged out" from client perspective
                }
                res.json({ message: 'Logged out successfully' });
            }
        );
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});

// REVERT IMPERSONATION (Back to Admin)
router.post('/revert-impersonation', authMiddleware, (req, res) => {
    const impersonatorId = req.user.impersonator_id;
    if (!impersonatorId) {
        return res.status(400).json({ error: 'Not currently impersonating' });
    }

    db.get('SELECT * FROM users WHERE id = ?', [impersonatorId], (err, adminUser) => {
        if (err || !adminUser) return res.status(404).json({ error: 'Original admin not found' });

        // Verify the original user is indeed an admin/superadmin (security check)
        if (adminUser.role !== 'SUPERADMIN' && adminUser.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Original user is not an admin' });
        }

        // Generate new token for the admin
        const jti = uuidv4();
        const token = jwt.sign({
            id: adminUser.id,
            email: adminUser.email,
            role: adminUser.role,
            organizationId: adminUser.organization_id,
            jti: jti
        }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN });

        // Log the reversion
        ActivityService.log({
            userId: adminUser.id,
            action: 'impersonate_end',
            entityType: 'user',
            entityId: req.user.id, // The user that was being impersonated
            entityName: req.user.email
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
            companyName: 'Admin Console' // Simplified, or fetch org name if needed
        };

        res.json({ user: safeUser, token });
    });
});


// REGISTER (New Company)
// Step 4: Enhanced with promo code support and attribution tracking
router.post('/register', async (req, res) => {
    const {
        email, password, firstName, lastName, companyName, accessCode, isDemo,
        promoCode, utm_campaign, utm_medium, partner_code
    } = req.body;

    // Import services (lazy load to avoid circular deps)
    const PromoCodeService = require('../services/promoCodeService');
    const AttributionService = require('../services/attributionService');

    // Step 4: Validate promo code if provided (before any DB operations)
    let promoValidation = null;
    if (promoCode) {
        try {
            promoValidation = await PromoCodeService.validatePromoCode(promoCode);
            if (!promoValidation.valid) {
                return res.status(400).json({
                    error: promoValidation.reason,
                    errorCode: 'INVALID_PROMO_CODE'
                });
            }
        } catch (err) {
            console.error('[Auth] Promo validation error:', err);
            return res.status(500).json({ error: 'Failed to validate promo code' });
        }
    }

    // Check if user exists
    db.get('SELECT id FROM users WHERE email = ?', [email], async (err, row) => {
        if (row) return res.status(400).json({ error: 'Email already in use' });

        const orgId = uuidv4();
        const userId = uuidv4();
        const hashedPassword = bcrypt.hashSync(password, 8);

        // Helper function to proceed with insertion
        const proceedWithRegistration = async (finalStatus, finalPlan) => {
            // 1. Create Organization
            const insertOrg = db.prepare(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`);
            insertOrg.run(orgId, companyName || 'My Company', finalPlan, finalStatus, async (err) => {
                if (err) {
                    if (process.env.NODE_ENV !== 'production') console.error('Register Org Error:', err);
                    return res.status(500).json({ error: 'Failed to create organization' });
                }
                insertOrg.finalize();

                // 2. Create Admin User for that Org
                const insertUser = db.prepare(`INSERT INTO users (id, organization_id, email, password, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?, ?)`);
                insertUser.run(userId, orgId, email, hashedPassword, firstName, lastName, 'ADMIN', async (err) => {
                    if (err) {
                        if (process.env.NODE_ENV !== 'production') console.error('Register User Error:', err);
                        return res.status(500).json({ error: 'Failed to create user' });
                    }
                    insertUser.finalize();

                    // Step 4: Record attribution event
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
                                entryPoint: 'registration'
                            }
                        });
                    } catch (attrErr) {
                        console.error('[Auth] Attribution recording failed:', attrErr);
                        // Don't block registration on attribution failure
                    }

                    // Step 4: Mark promo code as used (if applicable)
                    if (promoCode && promoValidation?.valid) {
                        try {
                            await PromoCodeService.markPromoCodeUsed(promoCode, orgId, userId);
                        } catch (promoErr) {
                            console.error('[Auth] Promo code usage marking failed:', promoErr);
                            // Don't block registration on promo failure
                        }
                    }

                    // If pending, do not issue token, but return success with "pending" status
                    if (finalStatus === 'pending') {
                        const insertRequest = db.prepare(`INSERT INTO access_requests (id, email, first_name, last_name, organization_id, organization_name, status) VALUES (?, ?, ?, ?, ?, ?, ?)`);
                        insertRequest.run(uuidv4(), email, firstName, lastName, orgId, companyName || 'My Company', 'pending', (err) => {
                            if (err) console.error("Error logging access request:", err);
                            insertRequest.finalize();
                            return res.json({
                                status: 'pending',
                                message: 'Registration successful. Waiting for approval.'
                            });
                        });
                        return;
                    }

                    // Generate unique token ID
                    const jti = uuidv4();
                    const token = jwt.sign({
                        id: userId,
                        email: email,
                        role: 'ADMIN',
                        organizationId: orgId,
                        jti: jti
                    }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN });

                    // Log registration
                    ActivityService.log({
                        organizationId: orgId,
                        userId: userId,
                        action: 'registered',
                        entityType: 'organization',
                        entityId: orgId,
                        entityName: companyName
                    });

                    res.json({
                        user: {
                            id: userId, email, firstName, lastName, role: 'ADMIN',
                            companyName: companyName, organizationId: orgId
                        },
                        token,
                        // Step 4: Include promo code info in response
                        promoApplied: promoCode ? {
                            code: promoCode,
                            discountType: promoValidation?.discountType,
                            discountValue: promoValidation?.discountValue
                        } : null
                    });
                });
            });
        };

        // Determine Status based on Repo / Code
        if (isDemo) {
            proceedWithRegistration('active', 'trial');
            return;
        }

        if (accessCode) {
            db.get('SELECT * FROM access_codes WHERE code = ? AND is_active = 1', [accessCode], (err, codeRow) => {
                if (err || !codeRow) {
                    // Invalid code: Proceed as pending
                    proceedWithRegistration('pending', 'free');
                } else {
                    // Check limits
                    if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
                        proceedWithRegistration('pending', 'free'); // Expired
                    } else if (codeRow.max_uses > 0 && codeRow.current_uses >= codeRow.max_uses) {
                        proceedWithRegistration('pending', 'free'); // Used up
                    } else {
                        // Valid code!
                        db.run('UPDATE access_codes SET current_uses = current_uses + 1 WHERE id = ?', [codeRow.id]);

                        // Log usage
                        db.run(`INSERT INTO access_code_usage (id, code_id, user_id) VALUES (?, ?, ?)`, [uuidv4(), codeRow.id, userId]);

                        proceedWithRegistration('active', 'pro');
                    }
                }
            });
        } else {
            proceedWithRegistration('pending', 'free');
        }
    });
});

// Revoke all tokens for a user (admin action)
router.post('/revoke-all', authMiddleware, (req, res) => {
    // Only allow admins to revoke all tokens
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN') {
        return res.status(403).json({ error: 'Not authorized' });
    }

    const { userId } = req.body;
    const targetUserId = userId || req.user.id;

    // For non-superadmins, only allow revoking own tokens or users in same org
    if (req.user.role !== 'SUPERADMIN' && userId && userId !== req.user.id) {
        // Check if target user is in same organization
        db.get('SELECT organization_id FROM users WHERE id = ?', [userId], (err, targetUser) => {
            if (err || !targetUser) {
                return res.status(404).json({ error: 'User not found' });
            }
            if (targetUser.organization_id !== req.user.organizationId) {
                return res.status(403).json({ error: 'Not authorized to revoke tokens for users outside your organization' });
            }

            // Proceed with revocation
            performRevocation(targetUserId, res);
        });
    } else {
        performRevocation(targetUserId, res);
    }
});

function performRevocation(userId, res) {
    // Insert a special "all" revocation marker (we'll check this in middleware)
    const marker = `revoke-all-${userId}-${Date.now()}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    db.run(
        `INSERT INTO revoked_tokens (jti, user_id, expires_at, reason) VALUES (?, ?, ?, ?)`,
        [marker, userId, expiresAt, 'revoke-all'],
        (err) => {
            if (err) {
                console.error('Error revoking all tokens:', err);
                return res.status(500).json({ error: 'Failed to revoke tokens' });
            }
            res.json({ message: 'All tokens revoked successfully' });
        }
    );
}

// RESET PASSWORD (Public)
router.post('/reset-password', (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required' });

    db.get('SELECT * FROM password_resets WHERE token = ?', [token], (err, resetData) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!resetData) return res.status(400).json({ error: 'Invalid or expired token' });

        if (new Date(resetData.expires_at) < new Date()) {
            return res.status(400).json({ error: 'Token has expired' });
        }

        const hashedPassword = require('bcryptjs').hashSync(newPassword, 8);

        // Update User Password
        db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, resetData.user_id], function (err) {
            if (err) return res.status(500).json({ error: 'Failed to update password' });

            // Delete Protocol Token (Single Use)
            db.run('DELETE FROM password_resets WHERE token = ?', [token]);

            res.json({ message: 'Password updated successfully' });
        });
    });
});

// EMAIL VERIFICATION
router.post('/verify-email', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required' });

    try {
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE email_verification_token = ?', [token], (err, row) => resolve(row));
        });

        if (!user) return res.status(400).json({ error: 'Invalid token' });

        if (new Date(user.email_verification_expires_at) < new Date()) {
            return res.status(400).json({ error: 'Token expired' });
        }

        await new Promise((resolve) => {
            db.run(
                `UPDATE users SET 
                 email_verified = 1, 
                 email_verification_token = NULL, 
                 email_verification_expires_at = NULL 
                 WHERE id = ?`,
                [user.id], resolve
            );
        });

        res.json({ success: true, message: 'Email verified successfully' });
    } catch (error) {
        console.error('Email verify error:', error);
        res.status(500).json({ error: 'Verification failed' });
    }
});

router.post('/resend-verification', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const EmailService = require('../services/emailService');
    const crypto = require('crypto');

    try {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h

        await new Promise((resolve) => {
            db.run(
                `UPDATE users SET 
                 email_verification_token = ?, 
                 email_verification_expires_at = ?,
                 email_verification_sent_at = datetime('now')
                 WHERE id = ?`,
                [token, expiresAt, userId], resolve
            );
        });

        const verifyLink = `${process.env.APP_URL || 'http://localhost:3000'}/auth/verify-email?token=${token}`;
        await EmailService.sendEmail(
            req.user.email,
            'Verify your Email',
            `<a href="${verifyLink}">Click here to verify your email</a>`
        );

        res.json({ success: true, message: 'Verification email sent' });
    } catch (error) {
        console.error('Resend verify error:', error);
        res.status(500).json({ error: 'Failed to send email' });
    }
});

// MFA SETUP
router.post('/mfa/setup', authMiddleware, async (req, res) => {
    const MFAService = require('../services/mfaService');
    try {
        const result = await MFAService.setupMFA(req.user.id, req.user.email);
        res.json(result);
    } catch (error) {
        console.error('MFA Setup error:', error);
        res.status(500).json({ error: 'MFA setup failed' });
    }
});

router.post('/mfa/enable', authMiddleware, async (req, res) => {
    const { token } = req.body;
    const MFAService = require('../services/mfaService');
    try {
        const result = await MFAService.verifyAndEnableMFA(req.user.id, token);
        if (!result.success) {
            return res.status(400).json(result);
        }
        res.json(result);
    } catch (error) {
        console.error('MFA Enable error:', error);
        res.status(500).json({ error: 'MFA activation failed' });
    }
});

router.post('/mfa/disable', authMiddleware, async (req, res) => {
    const { token } = req.body;
    const MFAService = require('../services/mfaService');
    try {
        const result = await MFAService.disableMFA(req.user.id, token);
        if (!result.success) {
            return res.status(400).json(result);
        }
        res.json(result);
    } catch (error) {
        console.error('MFA Disable error:', error);
        res.status(500).json({ error: 'MFA disable failed' });
    }
});

module.exports = router;

