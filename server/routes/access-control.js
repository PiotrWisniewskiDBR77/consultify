const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const verifyToken = require('../middleware/authMiddleware');

// Middleware to check if user is Admin
const requireAdmin = (req, res, next) => {
    if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN')) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// Middleware to check if user is Super Admin
const requireSuperAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'SUPERADMIN') {
        return res.status(403).json({ error: 'Super Admin access required' });
    }
    next();
};

// Helper function to generate random access code
const generateAccessCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

// ============================================
// ACCESS REQUEST ROUTES
// ============================================

// Submit access request
router.post('/requests', (req, res) => {
    const { email, firstName, lastName, phone, organizationName, requestType } = req.body;

    // Check if request already exists
    db.get('SELECT id FROM access_requests WHERE email = ? AND status = ?',
        [email, 'pending'], (err, existing) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (existing) return res.status(400).json({ error: 'Access request already pending' });

            const requestId = uuidv4();
            const metadata = JSON.stringify({ userAgent: req.headers['user-agent'] });

            db.run(`INSERT INTO access_requests 
                (id, email, first_name, last_name, phone, organization_name, request_type, metadata, requested_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                [requestId, email, firstName, lastName, phone, organizationName, requestType || 'new_user', metadata],
                (err) => {
                    if (err) {
                        console.error('Access request creation error:', err);
                        return res.status(500).json({ error: 'Failed to create access request' });
                    }
                    res.json({
                        success: true,
                        message: 'Access request submitted successfully',
                        requestId
                    });
                }
            );
        }
    );
});

// Get all access requests (Super Admin only)
router.get('/requests', verifyToken, requireSuperAdmin, (req, res) => {
    const status = req.query.status || 'pending';

    const query = status === 'all'
        ? 'SELECT * FROM access_requests ORDER BY requested_at DESC'
        : 'SELECT * FROM access_requests WHERE status = ? ORDER BY requested_at DESC';

    const params = status === 'all' ? [] : [status];

    db.all(query, params, (err, requests) => {
        if (err) {
            console.error('Error fetching access requests:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(requests);
    });
});

// Approve access request (Super Admin only)
router.put('/requests/:id/approve', verifyToken, requireSuperAdmin, (req, res) => {
    const { id } = req.params;
    const { password, role } = req.body;

    db.get('SELECT * FROM access_requests WHERE id = ?', [id], (err, request) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!request) return res.status(404).json({ error: 'Access request not found' });
        if (request.status !== 'pending') {
            return res.status(400).json({ error: 'Request already processed' });
        }

        // Create organization and user
        const orgId = uuidv4();
        const userId = uuidv4();
        const hashedPassword = bcrypt.hashSync(password || 'temporary123', 8);

        db.serialize(() => {
            // Create organization
            db.run(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
                [orgId, request.organization_name || 'New Organization', 'free', 'active'],
                (err) => {
                    if (err) {
                        console.error('Organization creation error:', err);
                        return res.status(500).json({ error: 'Failed to create organization' });
                    }

                    // Create user
                    db.run(`INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [userId, orgId, request.email, hashedPassword, request.first_name, request.last_name,
                            role || request.requested_role || 'ADMIN', 'active'],
                        (err) => {
                            if (err) {
                                console.error('User creation error:', err);
                                return res.status(500).json({ error: 'Failed to create user' });
                            }

                            // Update request status
                            db.run(`UPDATE access_requests 
                                SET status = ?, reviewed_by = ?, reviewed_at = datetime('now'), organization_id = ?
                                WHERE id = ?`,
                                ['approved', req.user.id, orgId, id],
                                (err) => {
                                    if (err) {
                                        console.error('Request update error:', err);
                                        return res.status(500).json({ error: 'Failed to update request' });
                                    }

                                    res.json({
                                        success: true,
                                        message: 'Access request approved',
                                        organizationId: orgId,
                                        userId: userId
                                    });
                                }
                            );
                        }
                    );
                }
            );
        });
    });
});

// Reject access request (Super Admin only)
router.put('/requests/:id/reject', verifyToken, requireSuperAdmin, (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    db.get('SELECT * FROM access_requests WHERE id = ?', [id], (err, request) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!request) return res.status(404).json({ error: 'Access request not found' });
        if (request.status !== 'pending') {
            return res.status(400).json({ error: 'Request already processed' });
        }

        db.run(`UPDATE access_requests 
            SET status = ?, reviewed_by = ?, reviewed_at = datetime('now'), rejection_reason = ?
            WHERE id = ?`,
            ['rejected', req.user.id, reason || 'No reason provided', id],
            (err) => {
                if (err) {
                    console.error('Request rejection error:', err);
                    return res.status(500).json({ error: 'Failed to reject request' });
                }
                res.json({ success: true, message: 'Access request rejected' });
            }
        );
    });
});

// ============================================
// ACCESS CODE ROUTES
// ============================================

// Generate access code (Admin only)
router.post('/codes', verifyToken, requireAdmin, (req, res) => {
    const { organizationId, role, maxUses, expiresInDays } = req.body;

    // Verify user has access to this organization
    if (req.user.role !== 'SUPERADMIN' && req.user.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Access denied' });
    }

    const codeId = uuidv4();
    const code = generateAccessCode();
    const expiresAt = expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

    db.run(`INSERT INTO access_codes 
        (id, organization_id, code, created_by, role, max_uses, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [codeId, organizationId, code, req.user.id, role || 'USER', maxUses || 1, expiresAt],
        (err) => {
            if (err) {
                console.error('Access code creation error:', err);
                return res.status(500).json({ error: 'Failed to create access code' });
            }

            res.json({
                success: true,
                code: {
                    id: codeId,
                    code: code,
                    role: role || 'USER',
                    maxUses: maxUses || 1,
                    expiresAt: expiresAt
                }
            });
        }
    );
});

// Get organization's access codes (Admin only)
router.get('/codes', verifyToken, requireAdmin, (req, res) => {
    const { organizationId } = req.query;

    // Verify user has access to this organization
    if (req.user.role !== 'SUPERADMIN' && req.user.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Access denied' });
    }

    db.all(`SELECT ac.*, u.first_name, u.last_name, u.email as created_by_email
        FROM access_codes ac
        LEFT JOIN users u ON ac.created_by = u.id
        WHERE ac.organization_id = ?
        ORDER BY ac.created_at DESC`,
        [organizationId],
        (err, codes) => {
            if (err) {
                console.error('Error fetching access codes:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(codes);
        }
    );
});

// Get code info (public - for verification)
router.get('/codes/:code/info', (req, res) => {
    const { code } = req.params;

    db.get(`SELECT ac.id, ac.role, ac.max_uses, ac.current_uses, ac.expires_at, ac.is_active, o.name as organization_name
        FROM access_codes ac
        JOIN organizations o ON ac.organization_id = o.id
        WHERE ac.code = ?`,
        [code],
        (err, codeInfo) => {
            if (err) {
                console.error('Error fetching code info:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            if (!codeInfo) {
                return res.status(404).json({ error: 'Invalid code' });
            }

            // Check if code is expired
            const isExpired = codeInfo.expires_at && new Date(codeInfo.expires_at) < new Date();
            const isMaxedOut = codeInfo.max_uses !== -1 && codeInfo.current_uses >= codeInfo.max_uses;

            res.json({
                valid: codeInfo.is_active && !isExpired && !isMaxedOut,
                organizationName: codeInfo.organization_name,
                role: codeInfo.role,
                reason: !codeInfo.is_active ? 'Code deactivated'
                    : isExpired ? 'Code expired'
                        : isMaxedOut ? 'Code usage limit reached'
                            : null
            });
        }
    );
});

// Verify and register with access code
router.post('/codes/register', (req, res) => {
    const { code, email, password, firstName, lastName, phone } = req.body;

    db.get(`SELECT ac.*, o.id as org_id, o.name as org_name
        FROM access_codes ac
        JOIN organizations o ON ac.organization_id = o.id
        WHERE ac.code = ?`,
        [code],
        (err, accessCode) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (!accessCode) return res.status(404).json({ error: 'Invalid access code' });

            // Validate code
            const isExpired = accessCode.expires_at && new Date(accessCode.expires_at) < new Date();
            const isMaxedOut = accessCode.max_uses !== -1 && accessCode.current_uses >= accessCode.max_uses;

            if (!accessCode.is_active) {
                return res.status(400).json({ error: 'This access code has been deactivated' });
            }
            if (isExpired) {
                return res.status(400).json({ error: 'This access code has expired' });
            }
            if (isMaxedOut) {
                return res.status(400).json({ error: 'This access code has reached its usage limit' });
            }

            // Check if user already exists
            db.get('SELECT id FROM users WHERE email = ?', [email], (err, existingUser) => {
                if (err) return res.status(500).json({ error: 'Database error' });
                if (existingUser) return res.status(400).json({ error: 'Email already registered' });

                const userId = uuidv4();
                const hashedPassword = bcrypt.hashSync(password, 8);

                db.serialize(() => {
                    // Create user
                    db.run(`INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [userId, accessCode.org_id, email, hashedPassword, firstName, lastName,
                            accessCode.role, 'active'],
                        (err) => {
                            if (err) {
                                console.error('User creation error:', err);
                                return res.status(500).json({ error: 'Failed to create user' });
                            }

                            // Update code usage
                            db.run(`UPDATE access_codes SET current_uses = current_uses + 1 WHERE id = ?`,
                                [accessCode.id],
                                (err) => {
                                    if (err) console.error('Code usage update error:', err);
                                }
                            );

                            // Track code usage
                            db.run(`INSERT INTO access_code_usage (id, code_id, user_id, used_at)
                                VALUES (?, ?, ?, datetime('now'))`,
                                [uuidv4(), accessCode.id, userId],
                                (err) => {
                                    if (err) console.error('Code usage tracking error:', err);
                                }
                            );

                            res.json({
                                success: true,
                                user: {
                                    id: userId,
                                    email: email,
                                    firstName: firstName,
                                    lastName: lastName,
                                    role: accessCode.role,
                                    organizationId: accessCode.org_id,
                                    companyName: accessCode.org_name
                                },
                                message: 'Registration successful'
                            });
                        }
                    );
                });
            });
        }
    );
});

// Deactivate access code (Admin only)
router.delete('/codes/:id', verifyToken, requireAdmin, (req, res) => {
    const { id } = req.params;

    db.get('SELECT organization_id FROM access_codes WHERE id = ?', [id], (err, code) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!code) return res.status(404).json({ error: 'Access code not found' });

        // Verify user has access to this organization
        if (req.user.role !== 'SUPERADMIN' && req.user.organizationId !== code.organization_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        db.run('UPDATE access_codes SET is_active = 0 WHERE id = ?', [id], (err) => {
            if (err) {
                console.error('Code deactivation error:', err);
                return res.status(500).json({ error: 'Failed to deactivate code' });
            }
            res.json({ success: true, message: 'Access code deactivated' });
        });
    });
});

module.exports = router;
