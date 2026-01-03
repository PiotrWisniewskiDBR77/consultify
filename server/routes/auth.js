import express from 'express';
const router = express.Router();
import { getDatabase } from '../database/Database.js';
const db = getDatabase();
const bcrypt = require('bcryptjs');
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
const config = require('../config');
import authMiddleware from '../middleware/authMiddleware.js';
const ActivityService = import('activityService.js');

// Helper to add timeout to promises
const withTimeout = (promise, timeoutMs = 1000) => {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Operation timeout')), timeoutMs))
    ]);
};

// LOGIN
// Enhanced with MFA support and refresh tokens
// Import Controller
const authController = require('../controllers/authController');

// LOGIN
// Enhanced with MFA support and refresh tokens
router.post('/login', authController.login);

// REFRESH TOKEN - Get new access token using refresh token
router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required' });
    }

    const RefreshTokenService = import('refreshTokenService.js');

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
    const RefreshTokenService = import('refreshTokenService.js');

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
    const RefreshTokenService = import('refreshTokenService.js');

    try {
        await RefreshTokenService.revokeSession(req.user.id, id);
        res.json({ success: true, message: 'Session revoked' });
    } catch (error) {
        console.error('[Auth] Revoke session error:', error);
        res.status(500).json({ error: 'Failed to revoke session' });
    }
});


// GET ME - Validate token and return user data (Phase 5: Real-time Profile Sync)
router.get('/me', authMiddleware, async (req, res) => {
    try {
        // Fetch latest user data from DB to ensure avatar and other fields are up-to-date
        // req.user is populated by authMiddleware (from token)
        const user = await new Promise((resolve, reject) => {
            db.get(
                `SELECT u.id, u.email, u.role, u.organization_id, u.first_name, u.last_name, u.avatar_url, u.impersonator_id,
                        o.name as organization_name
                 FROM users u
                 LEFT JOIN organizations o ON u.organization_id = o.id
                 WHERE u.id = ?`,
                [req.user.id],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if role changed in database - if so, generate new token
        let newToken = null;
        if (user.role !== req.user.role) {
            const RefreshTokenService = import('refreshTokenService.js');
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
            newToken = tokenPair.accessToken;
        }

        const response = {
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                organizationId: user.organization_id,
                organizationName: user.organization_name,
                firstName: user.first_name,
                lastName: user.last_name,
                avatarUrl: user.avatar_url,
                impersonatorId: user.impersonator_id
            }
        };

        // Include new token if role changed
        if (newToken) {
            response.token = newToken;
            response.roleChanged = true;
        }

        res.json(response);
    } catch (err) {
        console.error('[Auth] /me DB error:', err);
        // Fallback to token data if DB fails
        return res.json({
            user: {
                id: req.user.id,
                email: req.user.email,
                role: req.user.role,
                organizationId: req.user.organizationId,
                impersonatorId: req.user.impersonator_id
            }
        });
    }
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


// DEMO LOGIN - Auto-login as demo@legolex.com
router.post('/demo-login', async (req, res) => {
    const DEMO_EMAIL = 'demo@legolex.com';
    const DEMO_PASSWORD = 'Demo123!';

    console.log('[Auth] Demo login request');

    try {
        // Get demo user
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE email = ?', [DEMO_EMAIL], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!user) {
            console.error('[Auth] Demo user not found - please run seed script');
            return res.status(404).json({
                error: 'Demo user not found. Please contact support.',
                code: 'DEMO_USER_NOT_FOUND'
            });
        }

        // Get organization
        const org = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM organizations WHERE id = ?', [user.organization_id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        // Generate tokens using RefreshTokenService
        const RefreshTokenService = import('refreshTokenService.js');

        const tokenResult = await RefreshTokenService.generateTokenPair(user, {
            deviceInfo: 'Demo Session',
            ip: req.ip,
            userAgent: req.get('user-agent')
        });

        const accessToken = tokenResult.accessToken;
        const refreshToken = tokenResult.refreshToken;

        // Log demo access
        ActivityService.log({
            userId: user.id,
            action: 'demo_login',
            entityType: 'user',
            entityId: user.id,
            entityName: DEMO_EMAIL,
            metadata: { ip: req.ip }
        });

        // Return demo user
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
            hasWorkspace: true // Demo always has workspace access
        };

        console.log('[Auth] Demo login successful');
        res.json({
            user: safeUser,
            token: accessToken,
            refreshToken,
            isDemo: true
        });

    } catch (error) {
        console.error('[Auth] Demo login error:', error);
        res.status(500).json({ error: 'Demo login failed. Please try again.' });
    }
});

// REGISTER (New Company)
// Step 4: Enhanced with promo code support and attribution tracking
router.post('/register', async (req, res) => {
    const {
        email, password, firstName, lastName, companyName, accessCode, isDemo,
        promoCode, utm_campaign, utm_medium, partner_code
    } = req.body;

    // Import services (lazy load to avoid circular deps)
    const PromoCodeService = (await import('../services/promoCodeService.js')).default;
    const AttributionService = (await import('../services/attributionService.js')).default;

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

// CHANGE PASSWORD (Authenticated User)
router.post('/change-password', authMiddleware, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
    }

    // Password validation
    if (newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters long' });
    }

    if (!/[A-Z]/.test(newPassword)) {
        return res.status(400).json({ error: 'New password must contain at least one uppercase letter' });
    }

    if (!/[a-z]/.test(newPassword)) {
        return res.status(400).json({ error: 'New password must contain at least one lowercase letter' });
    }

    if (!/[0-9]/.test(newPassword)) {
        return res.status(400).json({ error: 'New password must contain at least one number' });
    }

    try {
        // Get user with current password hash
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT id, password FROM users WHERE id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password
        const isCurrentPasswordValid = bcrypt.compareSync(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Ensure new password is different from current
        if (bcrypt.compareSync(newPassword, user.password)) {
            return res.status(400).json({ error: 'New password must be different from current password' });
        }

        // Hash and save new password
        const hashedPassword = bcrypt.hashSync(newPassword, 10);

        await new Promise((resolve, reject) => {
            db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId], function (err) {
                if (err) reject(err);
                else resolve(this);
            });
        });

        // Log password change activity
        ActivityService.log({
            userId,
            action: 'password_changed',
            entityType: 'user',
            entityId: userId,
            entityName: 'Password Change'
        });

        // Optionally: Revoke all other sessions for security
        const RefreshTokenService = import('refreshTokenService.js');
        await RefreshTokenService.revokeAllUserTokens(userId);

        res.json({
            success: true,
            message: 'Password changed successfully. All other sessions have been logged out for security.'
        });

    } catch (error) {
        console.error('[Auth] Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

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
    const EmailService = import('emailService.js');
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
    const MFAService = import('mfaService.js');
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
    const MFAService = import('mfaService.js');
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
    const MFAService = import('mfaService.js');
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

export default router;

