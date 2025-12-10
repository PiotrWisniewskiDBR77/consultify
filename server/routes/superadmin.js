const express = require('express');
const router = express.Router();
const db = require('../database');
const verifySuperAdmin = require('../middleware/superAdminMiddleware');
const ActivityService = require('../services/activityService');

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
            ActivityService.getStats(),
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
            counts
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
        db.run('DELETE FROM users WHERE organization_id = ?', [id]);
        db.run('DELETE FROM organizations WHERE id = ?', [id], function (err) {
            if (err) return res.status(500).json({ error: err.message });

            // Log activity
            ActivityService.log({
                userId: req.user?.id,
                action: 'deleted',
                entityType: 'organization',
                entityId: id
            });

            res.json({ message: 'Organization and its users deleted' });
        });
    });
});

module.exports = router;
