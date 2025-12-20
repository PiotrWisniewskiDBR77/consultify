// Decisions Routes - Governance checkpoints
// Step 3: PMO Objects, Statuses & Stage Gates

const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const verifyToken = require('../middleware/authMiddleware');

// GET /api/decisions?projectId=xxx
router.get('/', verifyToken, (req, res) => {
    const { projectId, status, relatedObjectId } = req.query;

    let sql = `SELECT d.*, u.first_name, u.last_name 
               FROM decisions d
               LEFT JOIN users u ON d.decision_owner_id = u.id
               WHERE 1=1`;
    const params = [];

    if (projectId) {
        sql += ` AND d.project_id = ?`;
        params.push(projectId);
    }
    if (status) {
        sql += ` AND d.status = ?`;
        params.push(status);
    }
    if (relatedObjectId) {
        sql += ` AND d.related_object_id = ?`;
        params.push(relatedObjectId);
    }

    sql += ` ORDER BY d.created_at DESC`;

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

// GET /api/decisions/:id
router.get('/:id', verifyToken, (req, res) => {
    db.get(`SELECT * FROM decisions WHERE id = ?`, [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Decision not found' });

        try {
            row.auditTrail = JSON.parse(row.audit_trail || '[]');
        } catch { row.auditTrail = []; }

        res.json(row);
    });
});

// POST /api/decisions
router.post('/', verifyToken, (req, res) => {
    if (!req.can('approve_changes')) {
        return res.status(403).json({ error: 'Permission denied' });
    }

    const {
        projectId, decisionType, relatedObjectType, relatedObjectId,
        decisionOwnerId, required, title, description
    } = req.body;

    // Validation
    if (!projectId || !decisionType || !relatedObjectType || !relatedObjectId || !title) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const id = uuidv4();
    const auditTrail = JSON.stringify([{
        action: 'CREATED',
        by: req.userId,
        at: new Date().toISOString()
    }]);

    const sql = `INSERT INTO decisions (
        id, project_id, decision_type, related_object_type, related_object_id,
        decision_owner_id, required, title, description, audit_trail
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(sql, [
        id, projectId, decisionType, relatedObjectType, relatedObjectId,
        decisionOwnerId || req.userId, required ? 1 : 0, title, description, auditTrail
    ], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id, projectId, title, status: 'PENDING' });
    });
});

// PATCH /api/decisions/:id/decide
router.patch('/:id/decide', verifyToken, async (req, res) => {
    const { status, outcome } = req.body; // APPROVED | REJECTED

    if (!['APPROVED', 'REJECTED'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    // Get decision first
    db.get(`SELECT * FROM decisions WHERE id = ?`, [req.params.id], (err, decision) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!decision) return res.status(404).json({ error: 'Decision not found' });

        // Check if user is decision owner
        if (decision.decision_owner_id !== req.userId && req.userRole !== 'ADMIN' && req.userRole !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Only decision owner can decide' });
        }

        // Update audit trail
        let auditTrail = [];
        try { auditTrail = JSON.parse(decision.audit_trail || '[]'); } catch { }
        auditTrail.push({
            action: status,
            by: req.userId,
            at: new Date().toISOString(),
            notes: outcome
        });

        const sql = `UPDATE decisions 
                     SET status = ?, outcome = ?, decided_at = CURRENT_TIMESTAMP, audit_trail = ?
                     WHERE id = ?`;

        db.run(sql, [status, outcome, JSON.stringify(auditTrail), req.params.id], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: req.params.id, status, decidedBy: req.userId });
        });
    });
});

module.exports = router;
