const express = require('express');
const router = express.Router();
const db = require('../database');
const verifyToken = require('../middleware/authMiddleware');

router.use(verifyToken);

// ==========================================
// GET /my-work/dashboard
// Aggregated view for "Today" screen
// ==========================================
router.get('/dashboard', (req, res) => {
    const userId = req.user.id;
    const orgId = req.user.organizationId;
    const today = new Date().toISOString().split('T')[0];

    // Parallel queries for speed
    const queries = {
        todayFocus: `
            SELECT t.*, p.name as project_name
            FROM tasks t
            LEFT JOIN projects p ON t.project_id = p.id
            WHERE t.organization_id = ? 
            AND t.assignee_id = ? 
            AND t.status != 'done'
            ORDER BY 
                CASE t.priority 
                    WHEN 'urgent' THEN 1 
                    WHEN 'high' THEN 2 
                    ELSE 3 
                END,
                t.due_date ASC
            LIMIT 3
        `,
        overdue: `
            SELECT COUNT(*) as count 
            FROM tasks 
            WHERE organization_id = ? 
            AND assignee_id = ? 
            AND status != 'done' 
            AND due_date < ?
        `,
        dueThisWeek: `
            SELECT COUNT(*) as count 
            FROM tasks 
            WHERE organization_id = ? 
            AND assignee_id = ? 
            AND status != 'done' 
            AND due_date >= ?
            AND due_date <= date(?, '+7 days')
        `,
        blocked: `
             SELECT COUNT(*) as count 
            FROM tasks 
            WHERE organization_id = ? 
            AND assignee_id = ? 
            AND status = 'blocked'
        `,
        completed: `
            SELECT COUNT(*) as count 
            FROM tasks 
            WHERE organization_id = ? 
            AND assignee_id = ? 
            AND status = 'done'
        `,
        total: `
            SELECT COUNT(*) as count 
            FROM tasks 
            WHERE organization_id = ? 
            AND assignee_id = ?
        `
    };

    db.serialize(() => {
        const result = {};

        db.all(queries.todayFocus, [orgId, userId], (err, rows) => {
            if (err) {
                console.error("Error fetching today focus:", err);
                return res.status(500).json({ error: err.message });
            }
            // Parse JSON fields safely
            result.todayFocus = rows.map(t => ({
                ...t,
                projectId: t.project_id,
                projectName: t.project_name,
                checklist: t.checklist ? JSON.parse(t.checklist) : [],
                tags: t.tags ? JSON.parse(t.tags) : []
            }));

            db.get(queries.overdue, [orgId, userId, today], (err, row) => {
                if (err) return res.status(500).json({ error: err.message });
                result.overdueCount = row.count;

                db.get(queries.dueThisWeek, [orgId, userId, today, today], (err, row) => {
                    if (err) return res.status(500).json({ error: err.message });
                    result.dueThisWeekCount = row.count;

                    db.get(queries.blocked, [orgId, userId], (err, row) => {
                        if (err) return res.status(500).json({ error: err.message });
                        result.blockedCount = row.count;

                        db.get(queries.completed, [orgId, userId], (err, row) => {
                            if (err) return res.status(500).json({ error: err.message });
                            result.completedCount = row.count;

                            db.get(queries.total, [orgId, userId], (err, row) => {
                                if (err) return res.status(500).json({ error: err.message });
                                result.totalCount = row.count;
                                res.json(result);
                            });
                        });
                    });
                });
            });
        });
    });
});

// ==========================================
// GET /my-work/workload
// Team workload view (Admin only or Team Lead)
// ==========================================
router.get('/workload', (req, res) => {
    const orgId = req.user.organizationId;
    const today = new Date().toISOString().split('T')[0];

    // Simple heatmap: User -> [Overdue, DueThisWeek, TotalActive]
    const sql = `
        SELECT 
            u.id, u.first_name, u.last_name, u.avatar_url,
            COUNT(CASE WHEN t.due_date < ? THEN 1 END) as overdue_count,
            COUNT(CASE WHEN t.due_date >= ? AND t.due_date <= date(?, '+7 days') THEN 1 END) as due_week_count,
            COUNT(t.id) as total_active_count
        FROM users u
        LEFT JOIN tasks t ON u.id = t.assignee_id AND t.status != 'done'
        WHERE u.organization_id = ? AND u.status = 'active'
        GROUP BY u.id
    `;

    db.all(sql, [today, today, today, orgId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const workload = rows.map(row => ({
            user: {
                id: row.id,
                firstName: row.first_name,
                lastName: row.last_name,
                avatarUrl: row.avatar_url
            },
            stats: {
                overdue: row.overdue_count,
                dueThisWeek: row.due_week_count,
                totalActive: row.total_active_count
            }
        }));

        res.json(workload);
    });
});

// ==========================================
// GET /my-work/preferences
// Notification preferences
// ==========================================
router.get('/preferences', (req, res) => {
    const userId = req.user.id;

    db.get('SELECT * FROM notification_preferences WHERE user_id = ?', [userId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        if (!row) {
            // Return defaults
            return res.json({
                channels: { inApp: true, email: true },
                digest: 'daily',
                triggers: { overdue: true, assigned: true, blocked: true, mentioned: true },
                quietHours: { enabled: false, start: '22:00', end: '08:00' }
            });
        }

        res.json({
            channels: JSON.parse(row.channels),
            digest: row.digest,
            triggers: JSON.parse(row.triggers),
            quietHours: JSON.parse(row.quiet_hours)
        });
    });
});

// ==========================================
// PUT /my-work/preferences
// Update preferences
// ==========================================
router.put('/preferences', (req, res) => {
    const userId = req.user.id;
    const { channels, digest, triggers, quietHours } = req.body;

    const sql = `
        INSERT INTO notification_preferences (user_id, channels, digest, triggers, quiet_hours, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
            channels = excluded.channels,
            digest = excluded.digest,
            triggers = excluded.triggers,
            quiet_hours = excluded.quiet_hours,
            updated_at = CURRENT_TIMESTAMP
    `;

    const params = [
        userId,
        JSON.stringify(channels),
        digest,
        JSON.stringify(triggers),
        JSON.stringify(quietHours)
    ];

    db.run(sql, params, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Preferences updated' });
    });
});

module.exports = router;
