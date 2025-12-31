const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

const whatsappService = require('../services/whatsappService');
const slackService = require('../services/slackService');

// POST /api/feedback - Submit new feedback
router.post('/', (req, res) => {
    const { userId, userEmail, type, message } = req.body;

    if (!message || !type) {
        return res.status(400).json({ error: 'Message and type are required' });
    }

    const id = uuidv4();
    const sql = `INSERT INTO system_feedback (id, user_id, user_email, type, message, status, created_at) VALUES (?, ?, ?, ?, ?, 'NEW', CURRENT_TIMESTAMP)`;

    db.run(sql, [id, userId, userEmail, type, message], function (err) {
        if (err) {
            console.error('Error saving feedback:', err);
            return res.status(500).json({ error: 'Failed to save feedback' });
        }

        // Send Notifications (Async - fire and forget)
        whatsappService.sendNewFeedbackAlert({ userId, userEmail, type, message });
        slackService.sendNewFeedbackAlert({ userId, userEmail, type, message });

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

    if (!['NEW', 'READ', 'RESOLVED'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    const sql = `UPDATE system_feedback SET status = ? WHERE id = ?`;
    db.run(sql, [status, id], function (err) {
        if (err) {
            console.error('Error updating feedback status:', err);
            return res.status(500).json({ error: 'Failed to update feedback status' });
        }
        res.json({ success: true });
    });
});

module.exports = router;
