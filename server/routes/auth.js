const express = require('express');
const router = express.Router();
const db = require('../database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const authMiddleware = require('../middleware/authMiddleware');

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

            // Check if organization is blocked
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

            res.json({ user: safeUser, token });
        });
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

// REGISTER (New Company)
router.post('/register', (req, res) => {
    const { email, password, firstName, lastName, companyName } = req.body;

    // Check if user exists
    db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
        if (row) return res.status(400).json({ error: 'Email already in use' });

        const orgId = uuidv4();
        const userId = uuidv4();
        const hashedPassword = bcrypt.hashSync(password, 8);

        // 1. Create Organization
        const insertOrg = db.prepare(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`);
        insertOrg.run(orgId, companyName || 'My Company', 'free', 'active', (err) => {
            if (err) {
                // Log error server-side but don't expose details to client
                if (process.env.NODE_ENV !== 'production') {
                    console.error('Register Org Error:', err);
                }
                return res.status(500).json({ error: 'Failed to create organization' });
            }
            insertOrg.finalize();

            // 2. Create Admin User for that Org
            const insertUser = db.prepare(`INSERT INTO users (id, organization_id, email, password, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?, ?)`);
            insertUser.run(userId, orgId, email, hashedPassword, firstName, lastName, 'ADMIN', (err) => {
                if (err) {
                    // Log error server-side but don't expose details to client
                    if (process.env.NODE_ENV !== 'production') {
                        console.error('Register User Error:', err);
                    }
                    return res.status(500).json({ error: 'Failed to create user' });
                }
                insertUser.finalize();

                // Generate unique token ID for revocation support
                const jti = uuidv4();

                const token = jwt.sign({
                    id: userId,
                    email: email,
                    role: 'ADMIN',
                    organizationId: orgId,
                    jti: jti
                }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN });

                res.json({
                    user: {
                        id: userId, email, firstName, lastName, role: 'ADMIN',
                        companyName: companyName, organizationId: orgId
                    },
                    token
                });
            });
        });
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

module.exports = router;

