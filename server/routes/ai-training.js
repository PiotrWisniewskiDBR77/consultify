const express = require('express');
const router = express.Router();
const db = require('../database');
const verifyToken = require('../middleware/authMiddleware');
const { v4: uuidv4 } = require('uuid');

// GET AI feedback for organization
router.get('/', verifyToken, (req, res) => {
    const { organizationId } = req.user;
    const { helpful, context } = req.query;

    let sql = 'SELECT * FROM ai_feedback WHERE organization_id = ?';
    const params = [organizationId];

    if (helpful !== undefined) {
        sql += ' AND helpful = ?';
        params.push(helpful === 'true' ? 1 : 0);
    }

    if (context) {
        sql += ' AND context = ?';
        params.push(context);
    }

    sql += ' ORDER BY created_at DESC LIMIT 100';

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

// SUBMIT AI feedback
router.post('/', verifyToken, (req, res) => {
    const { organizationId, userId } = req.user;
    const { context, prompt, response, helpful, comment } = req.body;

    if (!context || !response || helpful === undefined) {
        return res.status(400).json({ error: 'context, response, and helpful are required' });
    }

    const id = uuidv4();

    db.run(
        `INSERT INTO ai_feedback (id, organization_id, user_id, context, prompt, response, helpful, comment) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, organizationId, userId, context, prompt || '', response, helpful ? 1 : 0, comment || ''],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({
                success: true,
                id,
                message: 'Feedback submitted successfully'
            });
        }
    );
});

// GET custom prompts for organization
router.get('/prompts', verifyToken, (req, res) => {
    const { organizationId } = req.user;

    db.all(
        'SELECT * FROM custom_prompts WHERE organization_id = ? ORDER BY created_at DESC',
        [organizationId],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows || []);
        }
    );
});

// CREATE custom prompt template
router.post('/prompts', verifyToken, (req, res) => {
    const { organizationId, userId } = req.user;
    const { name, context, template, variables, isActive = true } = req.body;

    if (!name || !context || !template) {
        return res.status(400).json({ error: 'name, context, and template are required' });
    }

    const id = uuidv4();

    db.run(
        `INSERT INTO custom_prompts (id, organization_id, name, context, template, variables, is_active, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, organizationId, name, context, template, JSON.stringify(variables || []), isActive ? 1 : 0, userId],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({
                success: true,
                id,
                message: 'Custom prompt created successfully'
            });
        }
    );
});

// UPDATE custom prompt
router.put('/prompts/:id', verifyToken, (req, res) => {
    const { id } = req.params;
    const { organizationId } = req.user;
    const { name, template, variables, isActive } = req.body;

    db.run(
        `UPDATE custom_prompts 
         SET name = COALESCE(?, name),
             template = COALESCE(?, template),
             variables = COALESCE(?, variables),
             is_active = COALESCE(?, is_active),
             updated_at = datetime('now')
         WHERE id = ? AND organization_id = ?`,
        [name, template, variables ? JSON.stringify(variables) : null, isActive !== undefined ? (isActive ? 1 : 0) : null, id, organizationId],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Prompt not found' });
            res.json({ success: true, message: 'Prompt updated' });
        }
    );
});

// GET feedback analytics
router.get('/analytics', verifyToken, (req, res) => {
    const { organizationId } = req.user;

    db.all(
        `SELECT 
            context,
            COUNT(*) as total,
            SUM(CASE WHEN helpful = 1 THEN 1 ELSE 0 END) as helpful_count,
            SUM(CASE WHEN helpful = 0 THEN 1 ELSE 0 END) as not_helpful_count,
            ROUND(AVG(CASE WHEN helpful = 1 THEN 100.0 ELSE 0.0 END), 2) as satisfaction_rate
         FROM ai_feedback 
         WHERE organization_id = ?
         GROUP BY context`,
        [organizationId],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows || []);
        }
    );
});

module.exports = router;
