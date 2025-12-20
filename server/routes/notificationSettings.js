const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const db = require('../database');
const { v4: uuidv4 } = require('uuid');

/**
 * MED-04: Project Notification Settings API
 * GET/PUT endpoints for per-project notification configuration
 */

// GET /api/notification-settings/project/:projectId
router.get('/project/:projectId', auth, async (req, res) => {
    try {
        const { projectId } = req.params;

        const settings = await new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM project_notification_settings WHERE project_id = ?`,
                [projectId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        // Return default settings if none exist
        if (!settings) {
            return res.json({
                project_id: projectId,
                task_overdue_enabled: true,
                task_due_soon_enabled: true,
                task_blocked_enabled: true,
                decision_pending_enabled: true,
                decision_escalation_enabled: true,
                phase_transition_enabled: true,
                gate_blocked_enabled: true,
                initiative_at_risk_enabled: true,
                escalation_days: 3,
                escalation_email_enabled: false,
                email_daily_digest: false,
                email_weekly_summary: false,
                isDefault: true
            });
        }

        res.json({
            ...settings,
            // Convert SQLite integers to booleans
            task_overdue_enabled: !!settings.task_overdue_enabled,
            task_due_soon_enabled: !!settings.task_due_soon_enabled,
            task_blocked_enabled: !!settings.task_blocked_enabled,
            decision_pending_enabled: !!settings.decision_pending_enabled,
            decision_escalation_enabled: !!settings.decision_escalation_enabled,
            phase_transition_enabled: !!settings.phase_transition_enabled,
            gate_blocked_enabled: !!settings.gate_blocked_enabled,
            initiative_at_risk_enabled: !!settings.initiative_at_risk_enabled,
            escalation_email_enabled: !!settings.escalation_email_enabled,
            email_daily_digest: !!settings.email_daily_digest,
            email_weekly_summary: !!settings.email_weekly_summary
        });
    } catch (error) {
        console.error('Error fetching notification settings:', error);
        res.status(500).json({ error: 'Failed to fetch notification settings' });
    }
});

// PUT /api/notification-settings/project/:projectId
router.put('/project/:projectId', auth, async (req, res) => {
    try {
        const { projectId } = req.params;
        const settings = req.body;

        // Check if settings exist
        const existing = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id FROM project_notification_settings WHERE project_id = ?`,
                [projectId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (existing) {
            // Update existing
            await new Promise((resolve, reject) => {
                db.run(
                    `UPDATE project_notification_settings SET
                        task_overdue_enabled = ?,
                        task_due_soon_enabled = ?,
                        task_blocked_enabled = ?,
                        decision_pending_enabled = ?,
                        decision_escalation_enabled = ?,
                        phase_transition_enabled = ?,
                        gate_blocked_enabled = ?,
                        initiative_at_risk_enabled = ?,
                        escalation_days = ?,
                        escalation_email_enabled = ?,
                        email_daily_digest = ?,
                        email_weekly_summary = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE project_id = ?`,
                    [
                        settings.task_overdue_enabled ? 1 : 0,
                        settings.task_due_soon_enabled ? 1 : 0,
                        settings.task_blocked_enabled ? 1 : 0,
                        settings.decision_pending_enabled ? 1 : 0,
                        settings.decision_escalation_enabled ? 1 : 0,
                        settings.phase_transition_enabled ? 1 : 0,
                        settings.gate_blocked_enabled ? 1 : 0,
                        settings.initiative_at_risk_enabled ? 1 : 0,
                        settings.escalation_days || 3,
                        settings.escalation_email_enabled ? 1 : 0,
                        settings.email_daily_digest ? 1 : 0,
                        settings.email_weekly_summary ? 1 : 0,
                        projectId
                    ],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        } else {
            // Insert new
            const id = uuidv4();
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO project_notification_settings (
                        id, project_id,
                        task_overdue_enabled, task_due_soon_enabled, task_blocked_enabled,
                        decision_pending_enabled, decision_escalation_enabled,
                        phase_transition_enabled, gate_blocked_enabled,
                        initiative_at_risk_enabled,
                        escalation_days, escalation_email_enabled,
                        email_daily_digest, email_weekly_summary
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        id, projectId,
                        settings.task_overdue_enabled ? 1 : 0,
                        settings.task_due_soon_enabled ? 1 : 0,
                        settings.task_blocked_enabled ? 1 : 0,
                        settings.decision_pending_enabled ? 1 : 0,
                        settings.decision_escalation_enabled ? 1 : 0,
                        settings.phase_transition_enabled ? 1 : 0,
                        settings.gate_blocked_enabled ? 1 : 0,
                        settings.initiative_at_risk_enabled ? 1 : 0,
                        settings.escalation_days || 3,
                        settings.escalation_email_enabled ? 1 : 0,
                        settings.email_daily_digest ? 1 : 0,
                        settings.email_weekly_summary ? 1 : 0
                    ],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }

        res.json({ success: true, message: 'Notification settings saved' });
    } catch (error) {
        console.error('Error saving notification settings:', error);
        res.status(500).json({ error: 'Failed to save notification settings' });
    }
});

module.exports = router;
