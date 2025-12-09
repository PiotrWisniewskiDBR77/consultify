const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');

// GET SESSION
router.get('/:userId', (req, res) => {
    const { userId } = req.params;
    const { type, projectId } = req.query; // 'FREE' or 'FULL', optional projectId

    let sql = 'SELECT data FROM sessions WHERE user_id = ? AND type = ?';
    let params = [userId, type];

    if (projectId) {
        sql += ' AND project_id = ?';
        params.push(projectId);
    } else {
        // If no project specified, maybe find one with NULL project_id or ANY?
        // For backward compatibility, we might want to just get the most recent one or strictly NULL.
        // Let's assume strict NULL if not provided for now, or ignore if FREE mode (which might not have project).
        sql += ' AND project_id IS NULL';
    }

    db.get(sql, params, (err, row) => {
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
    const { userId, type, data, projectId } = req.body;
    const dataStr = JSON.stringify(data);

    let checkSql = 'SELECT id FROM sessions WHERE user_id = ? AND type = ?';
    let checkParams = [userId, type];

    if (projectId) {
        checkSql += ' AND project_id = ?';
        checkParams.push(projectId);
    } else {
        checkSql += ' AND project_id IS NULL';
    }

    // Check if exists
    db.get(checkSql, checkParams, (err, row) => {
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
            db.run('INSERT INTO sessions (id, user_id, project_id, type, data) VALUES (?, ?, ?, ?, ?)', [id, userId, projectId || null, type, dataStr], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true });
            });
        }
    });
});

module.exports = router;
