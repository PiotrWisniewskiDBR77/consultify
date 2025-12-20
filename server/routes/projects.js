const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const verifyToken = require('../middleware/authMiddleware');

router.use(verifyToken);

// GET Projects (Scoped to Organization)
router.get('/', (req, res) => {
    const orgId = req.user.organizationId;

    // Optional: Filter by user assignment? For now, allow all users in org to see projects.
    const sql = `
        SELECT p.*, u.first_name as owner_first_name, u.last_name as owner_last_name 
        FROM projects p
        LEFT JOIN users u ON p.owner_id = u.id
        WHERE p.organization_id = ?
        ORDER BY p.created_at DESC
    `;

    db.all(sql, [orgId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

const { checkPlanLimit } = require('../middleware/planLimits');

// CREATE Project
router.post('/', checkPlanLimit('max_projects'), (req, res) => {
    const orgId = req.user.organizationId;
    const { name, ownerId } = req.body;

    if (!name) return res.status(400).json({ error: 'Project name is required' });

    const id = uuidv4();
    const owner = ownerId || req.user.id; // Default to creator if not specified

    const sql = `INSERT INTO projects (id, organization_id, name, status, owner_id) VALUES (?, ?, ?, ?, ?)`;

    db.run(sql, [id, orgId, name, 'active', owner], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id, name, status: 'active', ownerId: owner });
    });
});

// DELETE Project
router.delete('/:id', (req, res) => {
    const orgId = req.user.organizationId;
    const { id } = req.params;

    // Ensure deleting only own org's project
    const sql = `DELETE FROM projects WHERE id = ? AND organization_id = ?`;

    db.run(sql, [id, orgId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Project not found or access denied' });
        res.json({ message: 'Project deleted' });
    });
});

// ==========================================
// MED-04b: Project Notification Settings API
// ==========================================

// GET Notification Settings for Project
router.get('/:id/notification-settings', (req, res) => {
    const { id } = req.params;

    db.get(`SELECT * FROM project_notification_settings WHERE project_id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        // Return default settings if none exist
        if (!row) {
            return res.json({
                project_id: id,
                task_overdue_enabled: true,
                task_due_today_enabled: true,
                blocker_detected_enabled: true,
                gate_ready_enabled: true,
                decision_required_enabled: true,
                escalation_enabled: true,
                escalation_days: 3,
                email_notifications: false,
                in_app_notifications: true
            });
        }

        res.json(row);
    });
});

// PUT (Upsert) Notification Settings for Project
router.put('/:id/notification-settings', (req, res) => {
    const { id: projectId } = req.params;
    const {
        task_overdue_enabled = 1,
        task_due_today_enabled = 1,
        blocker_detected_enabled = 1,
        gate_ready_enabled = 1,
        decision_required_enabled = 1,
        escalation_enabled = 1,
        escalation_days = 3,
        email_notifications = 0,
        in_app_notifications = 1
    } = req.body;

    const settingsId = uuidv4();

    // Upsert using REPLACE
    const sql = `
        INSERT OR REPLACE INTO project_notification_settings 
        (id, project_id, task_overdue_enabled, task_due_today_enabled, blocker_detected_enabled,
         gate_ready_enabled, decision_required_enabled, escalation_enabled, escalation_days,
         email_notifications, in_app_notifications, updated_at)
        VALUES (
            COALESCE((SELECT id FROM project_notification_settings WHERE project_id = ?), ?),
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
        )
    `;

    db.run(sql, [
        projectId, settingsId, projectId,
        task_overdue_enabled ? 1 : 0,
        task_due_today_enabled ? 1 : 0,
        blocker_detected_enabled ? 1 : 0,
        gate_ready_enabled ? 1 : 0,
        decision_required_enabled ? 1 : 0,
        escalation_enabled ? 1 : 0,
        escalation_days,
        email_notifications ? 1 : 0,
        in_app_notifications ? 1 : 0
    ], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: 'Notification settings saved' });
    });
});

module.exports = router;

