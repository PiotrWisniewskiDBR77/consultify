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

// PUT /api/decisions/:id/decide - Alias for PATCH
router.put('/:id/decide', verifyToken, async (req, res) => {
    const { status, outcome } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    db.get(`SELECT * FROM decisions WHERE id = ?`, [req.params.id], (err, decision) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!decision) return res.status(404).json({ error: 'Decision not found' });

        if (decision.decision_owner_id !== req.userId && req.userRole !== 'ADMIN' && req.userRole !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Only decision owner can decide' });
        }

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

// POST /api/decisions/:id/escalate - Escalate a decision to manager
router.post('/:id/escalate', verifyToken, async (req, res) => {
    const decisionId = req.params.id;
    
    // Get decision details
    db.get(`SELECT d.*, p.organization_id FROM decisions d 
            LEFT JOIN projects p ON d.project_id = p.id
            WHERE d.id = ?`, [decisionId], async (err, decision) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!decision) return res.status(404).json({ error: 'Decision not found' });
        
        // Check if user can escalate (must be the requester or have escalation permission)
        if (decision.requested_by_id !== req.userId && !req.can?.('escalate_decisions')) {
            return res.status(403).json({ error: 'Not authorized to escalate this decision' });
        }
        
        // Calculate days overdue
        const createdAt = new Date(decision.created_at);
        const now = new Date();
        const daysWaiting = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        const daysOverdue = Math.max(0, daysWaiting - 7);
        
        // Update audit trail with escalation
        let auditTrail = [];
        try { auditTrail = JSON.parse(decision.audit_trail || '[]'); } catch { }
        auditTrail.push({
            action: 'ESCALATED',
            by: req.userId,
            at: new Date().toISOString(),
            daysOverdue
        });
        
        // Update escalation level
        const newEscalationLevel = (decision.escalation_level || 0) + 1;
        
        const updateSql = `UPDATE decisions 
                          SET escalation_level = ?, audit_trail = ?
                          WHERE id = ?`;
        
        db.run(updateSql, [newEscalationLevel, JSON.stringify(auditTrail), decisionId], async function(updateErr) {
            if (updateErr) return res.status(500).json({ error: updateErr.message });
            
            // Try to create escalation record and notify
            try {
                const EscalationService = require('../services/escalationService');
                const NotificationService = require('../services/notificationService');
                
                // Find manager of decision owner
                const managerSql = `SELECT manager_id FROM users WHERE id = ?`;
                db.get(managerSql, [decision.decision_owner_id], async (mgrErr, owner) => {
                    const toUserId = owner?.manager_id || decision.decision_owner_id;
                    
                    // Create escalation record
                    await EscalationService.createEscalation({
                        projectId: decision.project_id,
                        sourceType: 'DECISION',
                        sourceId: decisionId,
                        fromUserId: req.userId,
                        toUserId: toUserId,
                        toRole: 'MANAGER',
                        reason: `Decision "${decision.title}" is ${daysOverdue} days overdue and requires immediate attention`,
                        triggerType: 'MANUAL',
                        daysOverdue
                    }).catch(console.error);
                    
                    // Notify decision owner
                    await NotificationService.create({
                        userId: decision.decision_owner_id,
                        organizationId: decision.organization_id,
                        projectId: decision.project_id,
                        type: 'DECISION_ESCALATED',
                        severity: 'HIGH',
                        title: 'Decision Escalated',
                        message: `The decision "${decision.title}" has been escalated due to delay`,
                        relatedObjectType: 'DECISION',
                        relatedObjectId: decisionId,
                        isActionable: true
                    }).catch(console.error);
                });
            } catch (escalationErr) {
                console.error('Failed to create escalation:', escalationErr);
                // Continue even if escalation service fails
            }
            
            res.json({ 
                success: true, 
                id: decisionId, 
                escalationLevel: newEscalationLevel,
                message: 'Decision escalated successfully'
            });
        });
    });
});

module.exports = router;
