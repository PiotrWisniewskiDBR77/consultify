const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const verifyToken = require('../middleware/authMiddleware');

router.use(verifyToken);

// ==========================================
// GET NOTIFICATIONS (For current user)
// ==========================================
router.get('/', (req, res) => {
    const userId = req.user.id;
    const { unreadOnly, limit = 50 } = req.query;

    let sql = `
        SELECT * FROM notifications
        WHERE user_id = ?
    `;

    if (unreadOnly === 'true') {
        sql += ` AND read = 0`;
    }

    sql += ` ORDER BY created_at DESC LIMIT ?`;

    db.all(sql, [userId, parseInt(limit)], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const notifications = rows.map(n => ({
            id: n.id,
            userId: n.user_id,
            type: n.type,
            title: n.title,
            message: n.message,
            data: n.data ? JSON.parse(n.data) : null,
            read: n.read === 1,
            createdAt: n.created_at
        }));

        res.json(notifications);
    });
});

// ==========================================
// GET UNREAD COUNT
// ==========================================
router.get('/unread-count', (req, res) => {
    const userId = req.user.id;

    db.get('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0', [userId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ count: row.count });
    });
});

// ==========================================
// MARK NOTIFICATION AS READ
// ==========================================
router.put('/:id/read', (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    db.run('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?', [id, userId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Notification not found' });
        res.json({ message: 'Marked as read' });
    });
});

// ==========================================
// MARK ALL AS READ
// ==========================================
router.put('/read-all', (req, res) => {
    const userId = req.user.id;

    db.run('UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0', [userId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'All notifications marked as read', count: this.changes });
    });
});

// ==========================================
// DELETE NOTIFICATION
// ==========================================
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    db.run('DELETE FROM notifications WHERE id = ? AND user_id = ?', [id, userId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Notification not found' });
        res.json({ message: 'Notification deleted' });
    });
});

// ==========================================
// DELETE ALL READ NOTIFICATIONS
// ==========================================
router.delete('/', (req, res) => {
    const userId = req.user.id;

    db.run('DELETE FROM notifications WHERE user_id = ? AND read = 1', [userId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Read notifications deleted', count: this.changes });
    });
});

// ==========================================
// CREATE NOTIFICATION (Internal helper - not exposed as API)
// This would be called from other routes like tasks.js
// ==========================================
const createNotification = (userId, type, title, message, data) => {
    const id = uuidv4();
    const now = new Date().toISOString();

    db.run(
        `INSERT INTO notifications (id, user_id, type, title, message, data, read, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
        [id, userId, type, title, message, data ? JSON.stringify(data) : null, now],
        (err) => {
            if (err) console.error('Failed to create notification:', err);
        }
    );

    return id;
};

// Export both router and helper function
router.createNotification = createNotification;

module.exports = router;
