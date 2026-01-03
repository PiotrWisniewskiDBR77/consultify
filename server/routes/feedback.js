import express from 'express';
const router = express.Router();
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/Database.js';
const db = getDatabase();

const whatsappService = import('whatsappService.js');
const notificationService = import('notificationService.js');

// POST /api/feedback - Submit new feedback
router.post('/', (req, res) => {
    const { userId, userEmail, userName, type, message, rating, severity, metadata } = req.body;

    if (!message || !type) {
        return res.status(400).json({ error: 'Message and type are required' });
    }

    const id = uuidv4();
    const sql = `INSERT INTO system_feedback (id, user_id, user_email, user_name, type, message, rating, status, metadata, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'NEW', ?, CURRENT_TIMESTAMP)`;

    db.run(sql, [id, userId, userEmail, userName, type, message, rating, JSON.stringify(metadata || {})], async function (err) {
        if (err) {
            console.error('Error saving feedback:', err);
            return res.status(500).json({ error: 'Failed to save feedback' });
        }

        // Send Notifications (Async)
        whatsappService.sendNewFeedbackAlert({ userId, userEmail, type, message });

        // Create Internal Notification (Triggers Slack via NotificationService)
        try {
            const isCritical = severity === 'CRITICAL';
            const notificationType = isCritical ? 'CLIENT_TICKET' : 'USER_FEEDBACK';
            const notificationSeverity = isCritical ? 'WARNING' : 'INFO';

            await notificationService.create({
                userId: userId,
                organizationId: 'system',
                projectId: null,
                type: notificationType,
                severity: notificationSeverity,
                title: isCritical ? `Critical Feedback: ${type}` : `New Feedback: ${type}`,
                message: message.substring(0, 200) + (message.length > 200 ? '...' : ''),
                relatedObjectType: 'FEEDBACK',
                relatedObjectId: id,
                isActionable: true,
                actionUrl: '/admin?section=feedback'
            });
        } catch (noteErr) {
            console.error('Failed to create notification for feedback:', noteErr);
        }

        res.json({ success: true, id });
    });
});

// GET /api/feedback - List all feedback (Admin only)
// In a real app, adding admin middleware here is recommended
router.get('/', (req, res) => {
    const sql = `SELECT * FROM system_feedback ORDER BY created_at DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Error fetching feedback:', err);
            return res.status(500).json({ error: 'Failed to fetch feedback' });
        }
        res.json(rows);
    });
});

// PATCH /api/feedback/:id/status - Update feedback status
router.patch('/:id/status', (req, res) => {
    const { status } = req.body;
    const { id } = req.params;

    const validStatuses = ['NEW', 'PENDING', 'IN_PROGRESS', 'REVIEWED', 'RESOLVED', 'ARCHIVED'];
    if (!validStatuses.includes(status.toUpperCase())) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    const sql = `UPDATE system_feedback SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    db.run(sql, [status.toUpperCase(), id], function (err) {
        if (err) {
            console.error('Error updating feedback status:', err);
            return res.status(500).json({ error: 'Failed to update feedback status' });
        }
        res.json({ success: true });
    });
});

// POST /api/feedback/:id/respond - Admin response to feedback
router.post('/:id/respond', async (req, res) => {
    const { response } = req.body;
    const { id } = req.params;

    if (!response || !response.trim()) {
        return res.status(400).json({ error: 'Response is required' });
    }

    const sql = `UPDATE system_feedback SET admin_response = ?, responded_at = CURRENT_TIMESTAMP, status = 'REVIEWED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    
    db.run(sql, [response.trim(), id], async function (err) {
        if (err) {
            console.error('Error saving admin response:', err);
            return res.status(500).json({ error: 'Failed to save response' });
        }

        // Get the feedback to notify the user
        db.get('SELECT * FROM system_feedback WHERE id = ?', [id], async (err, feedback) => {
            if (!err && feedback && feedback.user_id) {
                try {
                    await notificationService.create({
                        userId: feedback.user_id,
                        organizationId: 'system',
                        projectId: null,
                        type: 'FEEDBACK_RESPONSE',
                        severity: 'INFO',
                        title: 'Odpowiedź na Twój feedback',
                        message: response.substring(0, 200) + (response.length > 200 ? '...' : ''),
                        relatedObjectType: 'FEEDBACK',
                        relatedObjectId: id,
                        isActionable: false
                    });
                } catch (noteErr) {
                    console.error('Failed to create response notification:', noteErr);
                }
            }
        });

        res.json({ success: true });
    });
});

// GET /api/feedback/:id - Get single feedback item
router.get('/:id', (req, res) => {
    const { id } = req.params;
    
    db.get('SELECT * FROM system_feedback WHERE id = ?', [id], (err, row) => {
        if (err) {
            console.error('Error fetching feedback:', err);
            return res.status(500).json({ error: 'Failed to fetch feedback' });
        }
        if (!row) {
            return res.status(404).json({ error: 'Feedback not found' });
        }
        res.json(row);
    });
});

// GET /api/feedback/stats - Get feedback statistics
router.get('/stats/summary', (req, res) => {
    const queries = {
        total: 'SELECT COUNT(*) as count FROM system_feedback',
        new: "SELECT COUNT(*) as count FROM system_feedback WHERE status = 'NEW'",
        pending: "SELECT COUNT(*) as count FROM system_feedback WHERE status IN ('PENDING', 'IN_PROGRESS')",
        bugs: "SELECT COUNT(*) as count FROM system_feedback WHERE type = 'bug' AND status != 'RESOLVED'",
        avgRating: 'SELECT AVG(rating) as avg FROM system_feedback WHERE rating IS NOT NULL'
    };

    const results = {};
    let completed = 0;
    const total = Object.keys(queries).length;

    Object.entries(queries).forEach(([key, sql]) => {
        db.get(sql, [], (err, row) => {
            if (!err && row) {
                results[key] = key === 'avgRating' ? (row.avg || 0) : (row.count || 0);
            }
            completed++;
            if (completed === total) {
                res.json(results);
            }
        });
    });
});

export default router;
