const express = require('express');
const router = express.Router();
const db = require('../database');
const verifySuperAdmin = require('../middleware/superAdminMiddleware');
const ActivityService = require('../services/activityService');
const BillingService = require('../services/billingService');
const UsageService = require('../services/usageService');
const RealtimeService = require('../services/realtimeService');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { v4: uuidv4 } = require('uuid');

router.use(verifySuperAdmin);

// GET All Organizations with Stats
router.get('/organizations', (req, res) => {
    const sql = `
        SELECT 
            o.id, o.name, o.plan, o.status, o.created_at, o.discount_percent,
            COUNT(u.id) as user_count
        FROM organizations o
        LEFT JOIN users u ON o.id = u.organization_id
        GROUP BY o.id
        ORDER BY o.created_at DESC
    `;

    console.log('[SuperAdmin] Fetching all organizations');

    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// GET Recent Activities
router.get('/activities', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const activities = await ActivityService.getRecent(limit);
        res.json(activities);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET Activity Stats
router.get('/activities/stats', async (req, res) => {
    try {
        const stats = await ActivityService.getStats();
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET Dashboard Stats (combined)
router.get('/dashboard', async (req, res) => {
    try {
        const [activityStats, aiStats] = await Promise.all([
            ActivityService.getStats().catch(err => {
                console.error('[SuperAdmin] Activity Stats Error:', err);
                return { total: 0, last_hour: 0, last_24h: 0, last_7d: 0 };
            }),
            new Promise((resolve) => {
                db.get(`
                    SELECT 
                        COUNT(*) as total_ai_calls,
                        SUM(input_tokens + output_tokens) as total_tokens,
                        COUNT(DISTINCT user_id) as active_users
                    FROM ai_logs 
                    WHERE created_at > datetime('now', '-7 days')
                `, [], (err, row) => resolve(row || {}));
            })
        ]);

        // Get user/org counts
        const counts = await new Promise((resolve) => {
            db.get(`
                SELECT 
                    (SELECT COUNT(*) FROM users) as total_users,
                    (SELECT COUNT(*) FROM organizations) as total_orgs,
                    (SELECT COUNT(*) FROM users WHERE last_login > datetime('now', '-7 days')) as active_users_7d
            `, [], (err, row) => resolve(row || {}));
        });

        res.json({
            activity: activityStats,
            ai: aiStats,
            counts,
            live: RealtimeService.getGlobalStats()
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE Organization (Plan / Status / Discount)
router.put('/organizations/:id', (req, res) => {
    const { id } = req.params;
    const { plan, status, discount_percent } = req.body;

    // Validate inputs
    const validPlans = ['free', 'pro', 'enterprise'];
    const validStatuses = ['active', 'blocked', 'trial'];

    if (plan && !validPlans.includes(plan)) return res.status(400).json({ error: 'Invalid plan' });
    if (status && !validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    if (discount_percent !== undefined && (discount_percent < 0 || discount_percent > 100)) return res.status(400).json({ error: 'Invalid discount percent' });

    const sql = `UPDATE organizations SET plan = COALESCE(?, plan), status = COALESCE(?, status), discount_percent = COALESCE(?, discount_percent) WHERE id = ?`;

    db.run(sql, [plan, status, discount_percent, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Organization not found' });

        // Log activity
        ActivityService.log({
            organizationId: id,
            userId: req.user?.id,
            action: 'updated',
            entityType: 'organization',
            entityId: id,
            newValue: { plan, status, discount_percent }
        });

        res.json({ message: 'Organization updated' });
    });
});

// DELETE Organization
router.delete('/organizations/:id', (req, res) => {
    const { id } = req.params;

    // Prevent deleting System Org
    if (id === 'org-dbr77-system') return res.status(403).json({ error: 'Cannot delete System Organization' });

    db.serialize(() => {
        // 1. Delete Sessions (linked to users or projects of this org)
        db.run(`DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE organization_id = ?)`, [id]);

        // 2. Delete Project Users (linked to projects of this org)
        db.run(`DELETE FROM project_users WHERE project_id IN (SELECT id FROM projects WHERE organization_id = ?)`, [id]);

        // 3. Delete Projects (linked to org) - This should cascade to tasks if configured, but safe to delete parent
        db.run('DELETE FROM projects WHERE organization_id = ?', [id]);

        // 4. Delete Users (linked to org)
        db.run('DELETE FROM users WHERE organization_id = ?', [id]);

        // 5. Delete Organization
        db.run('DELETE FROM organizations WHERE id = ?', [id], function (err) {
            if (err) return res.status(500).json({ error: err.message });

            // Log activity
            ActivityService.log({
                userId: req.user?.id,
                action: 'deleted',
                entityType: 'organization',
                entityId: id
            });

            res.json({ message: 'Organization and its users, projects, and data deleted' });
        });
    });
});

// GET Organization Billing Details
router.get('/organizations/:id/billing', async (req, res) => {
    try {
        const { id } = req.params;
        const [billing, usage, invoices] = await Promise.all([
            BillingService.getOrganizationBilling(id),
            UsageService.getCurrentUsage(id),
            BillingService.getInvoices(id)
        ]);

        res.json({
            billing: billing || { status: 'no_subscription' },
            usage,
            invoices
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET All Users (Super Admin)
router.get('/users', (req, res) => {
    console.log('[SuperAdmin] Fetching all users');
    const sql = `
        SELECT
    u.id, u.organization_id, u.email, u.first_name, u.last_name,
        u.role, u.status, u.last_login, u.created_at,
        o.name as organization_name
        FROM users u
        LEFT JOIN organizations o ON u.organization_id = o.id
        ORDER BY u.created_at DESC
    `;

    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const users = rows.map(u => ({
            id: u.id,
            organizationId: u.organization_id,
            organizationName: u.organization_name,
            firstName: u.first_name,
            lastName: u.last_name,
            email: u.email,
            role: u.role,
            status: u.status,
            lastLogin: u.last_login,
            createdAt: u.created_at
        }));
        res.json(users);
    });
});

// UPDATE User (Super Admin - e.g. move org, change role)
router.put('/users/:id', (req, res) => {
    const { id } = req.params;
    const { organizationId, role, status } = req.body; // Add other fields as needed

    const sql = `UPDATE users SET organization_id = COALESCE(?, organization_id), role = COALESCE(?, role), status = COALESCE(?, status) WHERE id = ? `;

    db.run(sql, [organizationId, role, status, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'User not found' });

        // Log activity
        ActivityService.log({
            userId: req.user?.id,
            action: 'updated',
            entityType: 'user',
            entityId: id,
            newValue: { organizationId, role, status }
        });

        res.json({ message: 'User updated successfully' });
    });
});

// CREATE Super Admin User
router.post('/users', (req, res) => {
    const { firstName, lastName, email, password } = req.body;

    // Basic validation
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const hashedPassword = require('bcryptjs').hashSync(password, 8);
    const id = require('uuid').v4();
    const systemOrgId = 'org-dbr77-system'; // Or standard system org

    const sql = `INSERT INTO users(id, organization_id, email, password, first_name, last_name, role, status, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`;

    db.run(sql, [id, systemOrgId, email, hashedPassword, firstName, lastName, 'SUPERADMIN', 'active'], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'Email already exists' });
            }
            return res.status(500).json({ error: err.message });
        }

        // Log activity
        ActivityService.log({
            userId: req.user?.id,
            action: 'created',
            entityType: 'user',
            entityId: id,
            newValue: { email, role: 'SUPERADMIN' }
        });

        res.json({ id, email, firstName, lastName, role: 'SUPERADMIN', status: 'active' });
    });
});

// ACCESS REQUESTS
router.get('/access-requests', (req, res) => {
    db.all(`SELECT * FROM access_requests ORDER BY requested_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

router.post('/access-requests/:id/approve', (req, res) => {
    const { id } = req.params;

    // 1. Get request to find org id
    db.get(`SELECT * FROM access_requests WHERE id = ? `, [id], (err, request) => {
        if (err || !request) return res.status(404).json({ error: 'Request not found' });

        // 2. Update Org Status
        db.run(`UPDATE organizations SET status = 'active' WHERE id = ? `, [request.organization_id], (err) => {
            if (err) return res.status(500).json({ error: 'Failed to activate organization' });

            // 3. Update Request Status
            db.run(`UPDATE access_requests SET status = 'approved', reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ? `,
                [req.user.id, id],
                (err) => {
                    if (err) console.error("Error updating request status", err);
                    res.json({ message: 'Access approved successfully' });
                });
        });
    });
});

router.post('/access-requests/:id/reject', (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    db.get(`SELECT * FROM access_requests WHERE id = ? `, [id], (err, request) => {
        if (err || !request) return res.status(404).json({ error: 'Request not found' });

        // Update Org Status to blocked/rejected so they can't login
        db.run(`UPDATE organizations SET status = 'blocked' WHERE id = ? `, [request.organization_id], (err) => {
            // Update Request Status
            db.run(`UPDATE access_requests SET status = 'rejected', rejection_reason = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ? `,
                [reason, req.user.id, id],
                (err) => {
                    res.json({ message: 'Access rejected' });
                });
        });
    });
});

// ACCESS CODES
router.get('/access-codes', (req, res) => {
    db.all(`SELECT * FROM access_codes ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

router.post('/access-codes', (req, res) => {
    const { code, role, maxUses, expiresAt } = req.body;
    const newCode = code || uuidv4().substring(0, 8).toUpperCase();

    // Use system org id or admin's org based on context, here we assume super admin generates for generic access so maybe linked to system org?
    // Or simpler: just require a value. Let's use the SuperAdmin's org ID.
    const orgId = req.user.organizationId;

    db.run(`INSERT INTO access_codes(id, organization_id, code, created_by, role, max_uses, expires_at) VALUES(?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), orgId, newCode, req.user.id, role || 'USER', maxUses || 100, expiresAt],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Access code created', code: newCode });
        }
    );
});



// IMPERSONATE USER
router.post('/impersonate', (req, res) => {
    const { userId } = req.body;

    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Get Org for extra data
        db.get('SELECT * FROM organizations WHERE id = ?', [user.organization_id], (err, org) => {
            if (err) return res.status(500).json({ error: 'Server error' });

            // Generate unique token ID for revocation support
            const jti = uuidv4();

            // Sign token with impersonator_id claim
            const token = jwt.sign({
                id: user.id,
                email: user.email,
                role: user.role,
                organizationId: user.organization_id,
                impersonator_id: req.user.id, // The Super Admin's ID
                jti: jti
            }, config.JWT_SECRET, { expiresIn: '1h' }); // Short expiry for impersonation

            const safeUser = {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                status: user.status,
                organizationId: user.organization_id,
                companyName: org ? org.name : 'Unknown',
                impersonatorId: req.user.id // Pass to frontend explicitly too
            };

            // Log activity
            ActivityService.log({
                userId: req.user.id, // Log as the Super Admin doing the action
                action: 'impersonate_start',
                entityType: 'user',
                entityId: user.id,
                entityName: user.email,
                details: { target_organization: user.organization_id }
            });

            res.json({ user: safeUser, token });
        });
    });
});

module.exports = router;
