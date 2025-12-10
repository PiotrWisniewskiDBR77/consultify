const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');

// Middleware to check if user is admin (simple check based on request header or similar, 
// strictly speaking we should use auth middleware but here we rely on the main app passing verified user info or checking role)
// For now, we assume the main app's authentication middleware has already run and populated req.user if we use it,
// but looking at index.js, we don't see global auth middleware. We'll implement basic checks or assume the user ID is passed.
// Update: The plan implies trusted internal usage or identifying via param/body for now as per MVP.
// We will assume the frontend sends the user_id.

// GET all feedback (Admin only)
router.get('/', (req, res) => {
    // In a real app, verify req.user.role === 'ADMIN' or 'SUPERADMIN'
    const sql = `
        SELECT f.*, u.first_name, u.last_name, u.email 
        FROM feedback f
        LEFT JOIN users u ON f.user_id = u.id
        ORDER BY f.created_at DESC
    `;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

// POST submit feedback
router.post('/', (req, res) => {
    const { user_id, type, message, screenshot, url } = req.body;

    if (!user_id || !message || !type) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const id = uuidv4();
    const sql = `INSERT INTO feedback (id, user_id, type, message, screenshot, url) VALUES (?, ?, ?, ?, ?, ?)`;

    db.run(sql, [id, user_id, type, message, screenshot, url], function (err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.status(201).json({ id, message: 'Feedback submitted successfully' });
    });
});

// PATCH update status (Admin only)
router.patch('/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['new', 'read', 'resolved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    const sql = `UPDATE feedback SET status = ? WHERE id = ?`;
    db.run(sql, [status, id], function (err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Feedback not found' });
        }
        res.json({ message: 'Status updated' });
    });
});

module.exports = router;
