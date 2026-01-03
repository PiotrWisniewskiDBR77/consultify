// Decisions Routes - Governance checkpoints
// Step 3: PMO Objects, Statuses & Stage Gates

import express from 'express';
const router = express.Router();
import { getDatabase } from '../src/database/Database.js';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';
import verifyToken from '../middleware/authMiddleware.js';

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

// GET /api/decisions/bottlenecks - Get decision bottleneck analysis
router.get('/bottlenecks', verifyToken, async (req, res) => {
    const { projectId } = req.query;
    
    try {
        // 1. Aging decisions (waiting > 5 days)
        const agingSql = `
            SELECT d.*, 
                CAST(julianday('now') - julianday(d.created_at) AS INTEGER) as days_waiting,
                u.first_name || ' ' || u.last_name as owner_name
            FROM decisions d
            LEFT JOIN users u ON d.decision_owner_id = u.id
            WHERE d.status = 'PENDING'
            ${projectId ? 'AND d.project_id = ?' : ''}
            AND julianday('now') - julianday(d.created_at) > 5
            ORDER BY days_waiting DESC
            LIMIT 20
        `;
        const agingParams = projectId ? [projectId] : [];
        
        const aging = await new Promise((resolve, reject) => {
            db.all(agingSql, agingParams, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        // 2. Blocking decisions (with impacted items)
        const blockingSql = `
            SELECT d.*, 
                u.first_name || ' ' || u.last_name as owner_name,
                COUNT(di.id) as blocked_count
            FROM decisions d
            LEFT JOIN users u ON d.decision_owner_id = u.id
            LEFT JOIN decision_impacts di ON d.id = di.decision_id AND di.is_blocker = 1
            WHERE d.status = 'PENDING'
            ${projectId ? 'AND d.project_id = ?' : ''}
            GROUP BY d.id
            HAVING blocked_count > 0
            ORDER BY blocked_count DESC
            LIMIT 20
        `;
        const blockingParams = projectId ? [projectId] : [];
        
        const blocking = await new Promise((resolve, reject) => {
            db.all(blockingSql, blockingParams, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        // 3. Owner overload (users with > 3 pending decisions)
        const overloadSql = `
            SELECT 
                u.id as user_id,
                u.first_name || ' ' || u.last_name as name,
                u.email,
                COUNT(d.id) as pending_count
            FROM users u
            INNER JOIN decisions d ON d.decision_owner_id = u.id
            WHERE d.status = 'PENDING'
            ${projectId ? 'AND d.project_id = ?' : ''}
            GROUP BY u.id
            HAVING pending_count > 3
            ORDER BY pending_count DESC
            LIMIT 10
        `;
        const overloadParams = projectId ? [projectId] : [];
        
        const ownerOverload = await new Promise((resolve, reject) => {
            db.all(overloadSql, overloadParams, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        res.json({
            aging: aging.map(d => ({
                ...d,
                daysWaiting: d.days_waiting,
                ownerName: d.owner_name
            })),
            blocking: blocking.map(d => ({
                ...d,
                ownerName: d.owner_name,
                blockedCount: d.blocked_count
            })),
            ownerOverload: ownerOverload.map(o => ({
                userId: o.user_id,
                name: o.name,
                email: o.email,
                pendingCount: o.pending_count
            }))
        });
    } catch (error) {
        console.error('Failed to fetch bottlenecks:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/decisions/:id - Enhanced with related object and impacts
router.get('/:id', verifyToken, async (req, res) => {
    try {
        // Get decision with owner info
        const decision = await new Promise((resolve, reject) => {
            db.get(`
                SELECT d.*, 
                    owner.first_name as owner_first, owner.last_name as owner_last,
                    requester.first_name as requester_first, requester.last_name as requester_last
                FROM decisions d
                LEFT JOIN users owner ON d.decision_owner_id = owner.id
                LEFT JOIN users requester ON d.requested_by_id = requester.id
                WHERE d.id = ?
            `, [req.params.id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!decision) {
            return res.status(404).json({ error: 'Decision not found' });
        }

        // Parse audit trail
        try {
            decision.auditTrail = JSON.parse(decision.audit_trail || '[]');
        } catch { 
            decision.auditTrail = []; 
        }

        // Add formatted owner/requester names
        decision.ownerName = decision.owner_first 
            ? `${decision.owner_first} ${decision.owner_last}` 
            : null;
        decision.requestedByName = decision.requester_first 
            ? `${decision.requester_first} ${decision.requester_last}` 
            : null;

        // Get decision impacts
        const impacts = await new Promise((resolve, reject) => {
            db.all(`
                SELECT * FROM decision_impacts 
                WHERE decision_id = ?
            `, [req.params.id], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        decision.impacts = impacts.map(i => ({
            id: i.id,
            impactedType: i.impacted_type,
            impactedId: i.impacted_id,
            impactDescription: i.impact_description,
            isBlocker: Boolean(i.is_blocker)
        }));

        // Get AI brief if exists
        const brief = await new Promise((resolve, reject) => {
            db.get(`
                SELECT * FROM decision_briefs 
                WHERE decision_id = ?
                ORDER BY generated_at DESC
                LIMIT 1
            `, [req.params.id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (brief) {
            try {
                decision.aiBrief = {
                    contextSummary: brief.context_summary,
                    options: JSON.parse(brief.options || '[]'),
                    risks: JSON.parse(brief.risks || '[]'),
                    aiRecommendation: brief.ai_recommendation,
                    recommendationRationale: brief.recommendation_rationale,
                    recommendationConfidence: brief.recommendation_confidence
                };
            } catch {
                decision.aiBrief = null;
            }
        }

        // Get related object name if exists
        if (decision.related_object_type && decision.related_object_id) {
            const type = decision.related_object_type.toUpperCase();
            let relatedName = null;

            if (type === 'INITIATIVE') {
                const initiative = await new Promise((resolve, reject) => {
                    db.get('SELECT name FROM initiatives WHERE id = ?', 
                        [decision.related_object_id], (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
                });
                relatedName = initiative?.name;
            } else if (type === 'TASK') {
                const task = await new Promise((resolve, reject) => {
                    db.get('SELECT title FROM tasks WHERE id = ?', 
                        [decision.related_object_id], (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
                });
                relatedName = task?.title;
            }

            decision.relatedObjectName = relatedName;
        }

        res.json(decision);
    } catch (error) {
        console.error('Failed to fetch decision:', error);
        res.status(500).json({ error: error.message });
    }
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

    // Require outcome/rationale for audit trail
    if (!outcome || outcome.trim() === '') {
        return res.status(400).json({ error: 'Decision rationale is required' });
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

    // Require outcome/rationale for audit trail
    if (!outcome || outcome.trim() === '') {
        return res.status(400).json({ error: 'Decision rationale is required' });
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
                const EscalationService = import('escalationService.js');
                const NotificationService = import('notificationService.js');
                
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

export default router;
