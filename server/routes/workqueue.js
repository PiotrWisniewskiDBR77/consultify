/**
 * Workqueue Routes
 * 
 * Step 16: API endpoints for Human Workflow, Approvals, and Operations Dashboard.
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const db = require('../database');
const WorkqueueService = require('../services/workqueueService');
const SLAService = require('../services/slaService');
const NotificationOutboxService = require('../services/notificationOutboxService');
const AsyncJobService = require('../ai/asyncJobService');

/**
 * @route GET /api/workqueue/approvals
 * @desc Get pending approvals for current user (My Approvals)
 * @access Private
 */
router.get('/approvals', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const orgId = req.user.organizationId;
        const { status, limit, offset } = req.query;

        const approvals = await WorkqueueService.getMyApprovals(userId, orgId, {
            status,
            limit: limit ? parseInt(limit) : undefined,
            offset: offset ? parseInt(offset) : undefined
        });

        res.json({
            approvals,
            count: approvals.length
        });
    } catch (err) {
        console.error('[WorkqueueRoute] Error getting approvals:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route GET /api/workqueue/approvals/all
 * @desc Get all approvals for organization (Admin only)
 * @access Private (Admin/SuperAdmin)
 */
router.get('/approvals/all', auth, async (req, res) => {
    try {
        if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN')) {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        const orgId = req.user.role === 'SUPERADMIN' && req.query.organizationId
            ? req.query.organizationId
            : req.user.organizationId;

        const { status, includeOverdue, limit, offset } = req.query;

        const approvals = await WorkqueueService.getOrgApprovals(orgId, {
            status,
            includeOverdue: includeOverdue === 'true',
            limit: limit ? parseInt(limit) : undefined,
            offset: offset ? parseInt(offset) : undefined
        });

        res.json({
            approvals,
            count: approvals.length
        });
    } catch (err) {
        console.error('[WorkqueueRoute] Error getting org approvals:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/workqueue/approvals/:proposalId/assign
 * @desc Assign an approval to a user
 * @access Private (Admin/SuperAdmin)
 */
router.post('/approvals/:proposalId/assign', auth, async (req, res) => {
    try {
        if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN')) {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        const { proposalId } = req.params;
        const { assignedToUserId, slaDueAt } = req.body;
        const orgId = req.user.organizationId;

        if (!assignedToUserId) {
            return res.status(400).json({ error: 'assignedToUserId is required' });
        }

        const assignment = await WorkqueueService.assignApproval({
            proposalId,
            assignedToUserId,
            orgId,
            slaDueAt: slaDueAt ? new Date(slaDueAt) : undefined,
            createdBy: req.user.id
        });

        res.status(201).json({
            message: 'Approval assigned successfully',
            assignment
        });
    } catch (err) {
        console.error('[WorkqueueRoute] Error assigning approval:', err);
        const status = err.status || 500;
        res.status(status).json({ error: err.message });
    }
});

/**
 * @route PATCH /api/workqueue/approvals/:proposalId/ack
 * @desc Acknowledge an approval assignment
 * @access Private
 */
router.patch('/approvals/:proposalId/ack', auth, async (req, res) => {
    try {
        const { proposalId } = req.params;
        const userId = req.user.id;
        const orgId = req.user.organizationId;

        const result = await WorkqueueService.acknowledgeApproval(proposalId, userId, orgId);

        res.json({
            message: 'Approval acknowledged',
            ...result
        });
    } catch (err) {
        console.error('[WorkqueueRoute] Error acknowledging approval:', err);
        const status = err.status || 500;
        res.status(status).json({ error: err.message });
    }
});

/**
 * @route PATCH /api/workqueue/approvals/:proposalId/complete
 * @desc Mark an approval as completed
 * @access Private
 */
router.patch('/approvals/:proposalId/complete', auth, async (req, res) => {
    try {
        const { proposalId } = req.params;
        const userId = req.user.id;
        const orgId = req.user.organizationId;

        const result = await WorkqueueService.completeApproval(proposalId, userId, orgId);

        res.json({
            message: 'Approval completed',
            ...result
        });
    } catch (err) {
        console.error('[WorkqueueRoute] Error completing approval:', err);
        const status = err.status || 500;
        res.status(status).json({ error: err.message });
    }
});

/**
 * @route GET /api/workqueue/alerts
 * @desc Get operations alerts (stuck playbooks, dead letters, overdue approvals)
 * @access Private (Admin/SuperAdmin)
 */
router.get('/alerts', auth, async (req, res) => {
    try {
        if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN')) {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        const orgId = req.user.role === 'SUPERADMIN' && req.query.organizationId
            ? req.query.organizationId
            : req.user.organizationId;

        // 1. Get overdue approvals count
        const overdueApprovals = await WorkqueueService.getOverdueCount(orgId);

        // 2. Get dead-letter jobs
        const deadLetterStats = await AsyncJobService.getDeadLetterStats(orgId);

        // 3. Get stuck playbooks (running for > 48h)
        const stuckPlaybooks = await new Promise((resolve, reject) => {
            db.all(
                `SELECT pr.*, pt.title as template_title
                 FROM ai_playbook_runs pr
                 LEFT JOIN ai_playbook_templates pt ON pr.template_id = pt.id
                 WHERE pr.organization_id = ?
                 AND pr.status = 'RUNNING'
                 AND pr.created_at < datetime('now', '-48 hours')
                 ORDER BY pr.created_at ASC
                 LIMIT 20`,
                [orgId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });

        // 4. Get SLA health
        const slaHealth = await SLAService.getSlaHealth(orgId);

        // 5. Get notification outbox stats
        const outboxStats = await NotificationOutboxService.getOutboxStats(orgId);

        res.json({
            alerts: {
                overdueApprovals,
                deadLetterJobs: deadLetterStats.count || 0,
                stuckPlaybooks: stuckPlaybooks.length
            },
            details: {
                slaHealth,
                deadLetterStats,
                stuckPlaybooks: stuckPlaybooks.map(p => ({
                    id: p.id,
                    templateTitle: p.template_title,
                    status: p.status,
                    stuckSince: p.created_at
                })),
                outboxStats
            }
        });
    } catch (err) {
        console.error('[WorkqueueRoute] Error getting alerts:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route GET /api/workqueue/dashboard
 * @desc Get operations dashboard data
 * @access Private (Admin/SuperAdmin)
 */
router.get('/dashboard', auth, async (req, res) => {
    try {
        if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN')) {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        const orgId = req.user.role === 'SUPERADMIN' && req.query.organizationId
            ? req.query.organizationId
            : req.user.organizationId;

        // Get all dashboard data in parallel
        const [slaHealth, overdueApprovals, deadLetterStats, outboxStats] = await Promise.all([
            SLAService.getSlaHealth(orgId),
            WorkqueueService.getOrgApprovals(orgId, { includeOverdue: true, limit: 10 }),
            AsyncJobService.getDeadLetterStats(orgId),
            NotificationOutboxService.getOutboxStats(orgId)
        ]);

        res.json({
            sla: slaHealth,
            overdueApprovals: {
                count: overdueApprovals.length,
                items: overdueApprovals
            },
            deadLetterJobs: deadLetterStats,
            notifications: outboxStats
        });
    } catch (err) {
        console.error('[WorkqueueRoute] Error getting dashboard:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/workqueue/sla/check
 * @desc Manually trigger SLA check (Admin only, for testing)
 * @access Private (SuperAdmin)
 */
router.post('/sla/check', auth, async (req, res) => {
    try {
        if (req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Forbidden: SuperAdmin access required' });
        }

        const result = await SLAService.runSlaCheck();
        res.json({
            message: 'SLA check completed',
            result
        });
    } catch (err) {
        console.error('[WorkqueueRoute] Error running SLA check:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
