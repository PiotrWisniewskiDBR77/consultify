/**
 * SLAService
 * 
 * Step 16: SLA timer and escalation logic.
 * Checks for expired assignments and handles escalation to org admins.
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const auditLogger = require('../utils/auditLogger');

// Configuration
const SLA_CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_ESCALATION_REASON = 'SLA expired without acknowledgment';

const SLAService = {
    SLA_CHECK_INTERVAL_MS,

    /**
     * Find all expired (overdue) assignments.
     * 
     * @returns {Promise<Array>} List of expired assignments
     */
    findExpiredAssignments: async () => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT aa.*, o.name as org_name
                 FROM approval_assignments aa
                 LEFT JOIN organizations o ON aa.org_id = o.id
                 WHERE aa.status IN ('PENDING', 'ACKED')
                 AND aa.sla_due_at < datetime('now')
                 AND aa.escalated_at IS NULL`,
                [],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    },

    /**
     * Mark an assignment as expired.
     * 
     * @param {string} assignmentId - Assignment ID
     * @returns {Promise<boolean>} Success
     */
    markExpired: async (assignmentId) => {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE approval_assignments SET status = 'EXPIRED' WHERE id = ?`,
                [assignmentId],
                function (err) {
                    if (err) return reject(err);
                    resolve(this.changes > 0);
                }
            );
        });
    },

    /**
     * Find org admin (ADMIN role) to escalate to.
     * 
     * @param {string} orgId - Organization ID
     * @returns {Promise<Object|null>} Admin user or null
     */
    findOrgAdmin: async (orgId) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT id, email, first_name, last_name 
                 FROM users 
                 WHERE organization_id = ? AND role = 'ADMIN'
                 LIMIT 1`,
                [orgId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row || null);
                }
            );
        });
    },

    /**
     * Escalate an assignment to another user.
     * 
     * @param {string} assignmentId - Assignment ID
     * @param {string} toUserId - User to escalate to
     * @param {string} reason - Escalation reason
     * @returns {Promise<Object>} Updated assignment
     */
    escalateAssignment: async (assignmentId, toUserId, reason = DEFAULT_ESCALATION_REASON) => {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE approval_assignments 
                 SET escalated_to_user_id = ?, escalated_at = CURRENT_TIMESTAMP, escalation_reason = ?
                 WHERE id = ?`,
                [toUserId, reason, assignmentId],
                function (err) {
                    if (err) return reject(err);

                    if (this.changes === 0) {
                        const error = new Error('Assignment not found');
                        error.status = 404;
                        return reject(error);
                    }

                    auditLogger.warn('APPROVAL_ESCALATED', {
                        assignment_id: assignmentId,
                        escalated_to: toUserId,
                        reason
                    });

                    resolve({ assignmentId, escalatedTo: toUserId, reason });
                }
            );
        });
    },

    /**
     * Main cron job entry point - runs every 10 minutes.
     * Finds expired assignments, escalates to org admin, creates notifications.
     * 
     * @returns {Promise<Object>} Summary of actions taken
     */
    runSlaCheck: async () => {
        const NotificationOutboxService = require('./notificationOutboxService');

        console.log('[SLAService] Running SLA check...');
        const startTime = Date.now();

        const summary = {
            checked: 0,
            escalated: 0,
            notificationsSent: 0,
            errors: []
        };

        try {
            // 1. Find expired assignments
            const expired = await SLAService.findExpiredAssignments();
            summary.checked = expired.length;

            for (const assignment of expired) {
                try {
                    // 2. Find org admin to escalate to
                    const admin = await SLAService.findOrgAdmin(assignment.org_id);

                    if (admin && admin.id !== assignment.assigned_to_user_id) {
                        // 3. Escalate
                        await SLAService.escalateAssignment(
                            assignment.id,
                            admin.id,
                            DEFAULT_ESCALATION_REASON
                        );
                        summary.escalated++;

                        // 4. Create notification for escalated-to user
                        await NotificationOutboxService.enqueue(
                            admin.id,
                            assignment.org_id,
                            'ESCALATION',
                            {
                                proposalId: assignment.proposal_id,
                                originalAssignee: assignment.assigned_to_user_id,
                                slaDueAt: assignment.sla_due_at,
                                escalationReason: DEFAULT_ESCALATION_REASON
                            }
                        );
                        summary.notificationsSent++;

                        // 5. Also notify original assignee
                        await NotificationOutboxService.enqueue(
                            assignment.assigned_to_user_id,
                            assignment.org_id,
                            'APPROVAL_DUE',
                            {
                                proposalId: assignment.proposal_id,
                                status: 'Escalated to admin',
                                slaDueAt: assignment.sla_due_at
                            }
                        );
                        summary.notificationsSent++;
                    } else {
                        // No admin found or same as assignee, just mark as needing attention
                        await NotificationOutboxService.enqueue(
                            assignment.assigned_to_user_id,
                            assignment.org_id,
                            'APPROVAL_DUE',
                            {
                                proposalId: assignment.proposal_id,
                                status: 'Overdue - requires immediate attention',
                                slaDueAt: assignment.sla_due_at
                            }
                        );
                        summary.notificationsSent++;
                    }
                } catch (err) {
                    console.error(`[SLAService] Error processing assignment ${assignment.id}:`, err);
                    summary.errors.push({ assignmentId: assignment.id, error: err.message });
                }
            }

            const duration = Date.now() - startTime;
            console.log(`[SLAService] SLA check complete in ${duration}ms:`, summary);

            auditLogger.info('SLA_CHECK_COMPLETE', {
                duration_ms: duration,
                ...summary
            });

            return summary;
        } catch (err) {
            console.error('[SLAService] SLA check failed:', err);
            auditLogger.error('SLA_CHECK_FAILED', { error: err.message });
            throw err;
        }
    },

    /**
     * Get SLA health statistics for an organization.
     * 
     * @param {string} orgId - Organization ID
     * @returns {Promise<Object>} SLA health stats
     */
    getSlaHealth: async (orgId) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'ACKED' THEN 1 ELSE 0 END) as acknowledged,
                    SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN status = 'EXPIRED' THEN 1 ELSE 0 END) as expired,
                    SUM(CASE WHEN sla_due_at < datetime('now') AND status IN ('PENDING', 'ACKED') THEN 1 ELSE 0 END) as overdue,
                    SUM(CASE WHEN escalated_at IS NOT NULL THEN 1 ELSE 0 END) as escalated
                 FROM approval_assignments
                 WHERE org_id = ?`,
                [orgId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row || {
                        total: 0,
                        pending: 0,
                        acknowledged: 0,
                        completed: 0,
                        expired: 0,
                        overdue: 0,
                        escalated: 0
                    });
                }
            );
        });
    }
};

module.exports = SLAService;
