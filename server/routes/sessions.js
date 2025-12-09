const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');

// GET SESSION
router.get('/:userId', (req, res) => {
    const { userId } = req.params;
    const { type } = req.query; // 'FREE' or 'FULL'

    db.get('SELECT data FROM sessions WHERE user_id = ? AND type = ?', [userId, type], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.json({ data: null });

        try {
            res.json({ data: JSON.parse(row.data) });
        } catch (e) {
            res.json({ data: null });
        }
    });
});

// SAVE SESSION
router.post('/', (req, res) => {
    const { userId, type, data } = req.body;
    const dataStr = JSON.stringify(data);

    // Check if exists
    db.get('SELECT id FROM sessions WHERE user_id = ? AND type = ?', [userId, type], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        if (row) {
            // Update
            db.run('UPDATE sessions SET data = ?, updated_at = datetime("now") WHERE id = ?', [dataStr, row.id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true });
            });
        } else {
            // Insert
            const id = uuidv4();
            db.run('INSERT INTO sessions (id, user_id, type, data) VALUES (?, ?, ?, ?)', [id, userId, type, dataStr], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true });
            });
        }
    });
});

module.exports = router;
