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
router.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const passwordIsValid = bcrypt.compareSync(password, user.password);
        if (!passwordIsValid) return res.status(401).json({ error: 'Invalid password' });

        // Update Last Login
        db.run('UPDATE users SET last_login = datetime("now") WHERE id = ?', [user.id]);

        db.get('SELECT * FROM organizations WHERE id = ?', [user.organization_id], (err, org) => {
            if (err) return res.status(500).json({ error: 'Server error' });
            if (!org) return res.status(404).json({ error: 'Organization not found' });

            // Check if organization is pending or blocked
            if (org.status === 'pending' && user.role !== 'SUPERADMIN') {
                return res.status(403).json({ error: 'Your organization is waiting for approval.', status: 'pending' });
            }
            if (org.status === 'blocked' && user.role !== 'SUPERADMIN') {
                return res.status(403).json({ error: 'Your organization has been blocked. Contact support.' });
            }

            // Generate unique token ID for revocation support
            const jti = uuidv4();

            const token = jwt.sign({
                id: user.id,
                email: user.email,
                role: user.role,
                organizationId: user.organization_id,
                jti: jti // Unique token identifier for revocation
            }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN });

            const safeUser = {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                status: user.status,
                organizationId: user.organization_id,
                companyName: org.name
            };

            // Log successful login
            ActivityService.log({
                organizationId: user.organization_id,
                userId: user.id,
                action: 'login',
                entityType: 'session',
                entityId: jti,
                entityName: 'User Login'
            });

            res.json({ user: safeUser, token });
        });
    });
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
router.post('/register', (req, res) => {
    const { email, password, firstName, lastName, companyName, accessCode, isDemo } = req.body;

    // Check if user exists
    db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
        if (row) return res.status(400).json({ error: 'Email already in use' });

        const orgId = uuidv4();
        const userId = uuidv4();
        const hashedPassword = bcrypt.hashSync(password, 8);

        // Helper function to proceed with insertion
        const proceedWithRegistration = (finalStatus, finalPlan) => {
            // 1. Create Organization
            const insertOrg = db.prepare(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`);
            insertOrg.run(orgId, companyName || 'My Company', finalPlan, finalStatus, (err) => {
                if (err) {
                    if (process.env.NODE_ENV !== 'production') console.error('Register Org Error:', err);
                    return res.status(500).json({ error: 'Failed to create organization' });
                }
                insertOrg.finalize();

                // 2. Create Admin User for that Org
                const insertUser = db.prepare(`INSERT INTO users (id, organization_id, email, password, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?, ?)`);
                insertUser.run(userId, orgId, email, hashedPassword, firstName, lastName, 'ADMIN', (err) => {
                    if (err) {
                        if (process.env.NODE_ENV !== 'production') console.error('Register User Error:', err);
                        return res.status(500).json({ error: 'Failed to create user' });
                    }
                    insertUser.finalize();

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
                        token
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

module.exports = router;

