const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const verifyToken = require('../middleware/authMiddleware');

router.use(verifyToken);

// GET SESSION
router.get('/:userId', (req, res) => {
    // SECURITY: Use ID from token, but allow admin/system override if needed in future.
    // For now, strictly enforce that users can only get THEIR OWN session unless they are admin (logic omitted for brevity, assuming self-access).
    const requestedUserId = req.params.userId;
    const tokenUserId = req.user.id;

    if (requestedUserId !== tokenUserId) {
        console.warn(`[Sessions] Unauthorized access atttempt. TokenUser: ${tokenUserId}, Requested: ${requestedUserId}`);
        return res.status(403).json({ error: 'Unauthorized access to this session.' });
    }

    const { type, projectId } = req.query; // 'FREE' or 'FULL', optional projectId

    console.log(`[Sessions] GET request for user: ${tokenUserId}, type: ${type}, project: ${projectId || 'NULL'}`);

    let sql = 'SELECT data FROM sessions WHERE user_id = ? AND type = ?';
    let params = [tokenUserId, type];

    if (projectId) {
        sql += ' AND project_id = ?';
        params.push(projectId);
    } else {
        sql += ' AND project_id IS NULL';
    }

    db.get(sql, params, (err, row) => {
        if (err) {
            console.error('[Sessions] DB Error during GET:', err.message);
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            console.log('[Sessions] No session found, returning null.');
            return res.json({ data: null });
        }

        try {
            const parsedData = JSON.parse(row.data);
            console.log(`[Sessions] Session found. Keys: ${Object.keys(parsedData).join(', ')}`);
            res.json({ data: parsedData });
        } catch (e) {
            console.error('[Sessions] JSON Parse Error:', e.message);
            res.json({ data: null });
        }
    });
});

// SAVE SESSION
router.post('/', (req, res) => {
    const { userId, type, data, projectId } = req.body;
    const tokenUserId = req.user.id;

    // Consistency Check
    if (userId && userId !== tokenUserId) {
        console.warn(`[Sessions] UserID mismatch on SAVE. Token: ${tokenUserId}, Body: ${userId}`);
        return res.status(403).json({ error: 'User ID mismatch.' });
    }

    const targetUserId = tokenUserId;
    console.log(`[Sessions] SAVE Request for user: ${targetUserId}, type: ${type}, project: ${projectId || 'NULL'}`);

    // Safety check for data
    if (!data) {
        console.error('[Sessions] Attempted to save empty/null data.');
        return res.status(400).json({ error: 'No data provided.' });
    }

    const dataStr = JSON.stringify(data);

    let checkSql = 'SELECT id FROM sessions WHERE user_id = ? AND type = ?';
    let checkParams = [targetUserId, type];

    if (projectId) {
        checkSql += ' AND project_id = ?';
        checkParams.push(projectId);
    } else {
        checkSql += ' AND project_id IS NULL';
    }

    // Check if exists
    db.get(checkSql, checkParams, (err, row) => {
        if (err) {
            console.error('[Sessions] DB Error during Check:', err.message);
            return res.status(500).json({ error: err.message });
        }

        if (row) {
            // Update
            console.log(`[Sessions] Updating existing session ${row.id}`);
            db.run('UPDATE sessions SET data = ?, updated_at = datetime("now") WHERE id = ?', [dataStr, row.id], (err) => {
                if (err) {
                    console.error('[Sessions] DB Update Error:', err.message);
                    return res.status(500).json({ error: err.message });
                }
                res.json({ success: true, mode: 'updated' });
            });
        } else {
            // Insert
            const id = uuidv4();
            console.log(`[Sessions] Creating new session ${id}`);
            db.run('INSERT INTO sessions (id, user_id, project_id, type, data) VALUES (?, ?, ?, ?, ?)', [id, targetUserId, projectId || null, type, dataStr], (err) => {
                if (err) {
                    console.error('[Sessions] DB Insert Error:', err.message);
                    return res.status(500).json({ error: err.message });
                }
                res.json({ success: true, mode: 'created' });
            });
        }
    });
});

module.exports = router;
