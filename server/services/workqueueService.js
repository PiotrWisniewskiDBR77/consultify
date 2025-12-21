/**
 * WorkqueueService
 * 
 * Step 16: Approval assignment management for Human Workflow.
 * Handles assigning, acknowledging, and completing approval tasks.
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const auditLogger = require('../utils/auditLogger');

// Default SLA duration: 48 hours
const DEFAULT_SLA_HOURS = 48;

const ASSIGNMENT_STATUSES = {
    PENDING: 'PENDING',
    ACKED: 'ACKED',
    DONE: 'DONE',
    EXPIRED: 'EXPIRED'
};

const WorkqueueService = {
    ASSIGNMENT_STATUSES,
    DEFAULT_SLA_HOURS,

    /**
     * Assign an approval to a user.
     * 
     * @param {Object} params
     * @param {string} params.proposalId - The proposal ID to assign
     * @param {string} params.assignedToUserId - User to assign to
     * @param {string} params.orgId - Organization ID
     * @param {Date} [params.slaDueAt] - Custom SLA due date (default: 48h from now)
     * @param {string} [params.createdBy] - User creating the assignment
     * @returns {Promise<Object>} Created assignment
     */
    assignApproval: async ({ proposalId, assignedToUserId, orgId, slaDueAt, createdBy }) => {
        return new Promise((resolve, reject) => {
            const id = uuidv4();
            const dueAt = slaDueAt || new Date(Date.now() + DEFAULT_SLA_HOURS * 60 * 60 * 1000);

            // Check for existing active assignment
            db.get(
                `SELECT id FROM approval_assignments 
                 WHERE proposal_id = ? AND org_id = ? AND status IN ('PENDING', 'ACKED')`,
                [proposalId, orgId],
                (err, existing) => {
                    if (err) return reject(err);
                    if (existing) {
                        const error = new Error('Active assignment already exists for this proposal');
                        error.status = 409;
                        return reject(error);
                    }

                    db.run(
                        `INSERT INTO approval_assignments 
                         (id, org_id, proposal_id, assigned_to_user_id, status, sla_due_at, created_at)
                         VALUES (?, ?, ?, ?, 'PENDING', ?, CURRENT_TIMESTAMP)`,
                        [id, orgId, proposalId, assignedToUserId, dueAt.toISOString()],
                        function (err) {
                            if (err) return reject(err);

                            auditLogger.info('APPROVAL_ASSIGNED', {
                                assignment_id: id,
                                proposal_id: proposalId,
                                assigned_to: assignedToUserId,
                                org_id: orgId,
                                sla_due_at: dueAt.toISOString(),
                                created_by: createdBy
                            });

                            resolve({
                                id,
                                proposalId,
                                assignedToUserId,
                                orgId,
                                status: ASSIGNMENT_STATUSES.PENDING,
                                slaDueAt: dueAt.toISOString()
                            });
                        }
                    );
                }
            );
        });
    },

    /**
     * Acknowledge an approval assignment.
     * 
     * @param {string} proposalId - Proposal ID
     * @param {string} userId - User acknowledging
     * @param {string} orgId - Organization ID
     * @returns {Promise<Object>} Updated assignment
     */
    acknowledgeApproval: async (proposalId, userId, orgId) => {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE approval_assignments 
                 SET status = 'ACKED', acked_at = CURRENT_TIMESTAMP
                 WHERE proposal_id = ? AND org_id = ? AND assigned_to_user_id = ? AND status = 'PENDING'`,
                [proposalId, orgId, userId],
                function (err) {
                    if (err) return reject(err);

                    if (this.changes === 0) {
                        const error = new Error('Assignment not found or not in PENDING status');
                        error.status = 404;
                        return reject(error);
                    }

                    auditLogger.info('APPROVAL_ACKNOWLEDGED', {
                        proposal_id: proposalId,
                        user_id: userId,
                        org_id: orgId
                    });

                    resolve({ proposalId, status: ASSIGNMENT_STATUSES.ACKED });
                }
            );
        });
    },

    /**
     * Complete an approval assignment.
     * 
     * @param {string} proposalId - Proposal ID
     * @param {string} userId - User completing
     * @param {string} orgId - Organization ID
     * @returns {Promise<Object>} Updated assignment
     */
    completeApproval: async (proposalId, userId, orgId) => {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE approval_assignments 
                 SET status = 'DONE', completed_at = CURRENT_TIMESTAMP
                 WHERE proposal_id = ? AND org_id = ? AND assigned_to_user_id = ? AND status IN ('PENDING', 'ACKED')`,
                [proposalId, orgId, userId],
                function (err) {
                    if (err) return reject(err);

                    if (this.changes === 0) {
                        const error = new Error('Assignment not found or already completed');
                        error.status = 404;
                        return reject(error);
                    }

                    auditLogger.info('APPROVAL_COMPLETED', {
                        proposal_id: proposalId,
                        user_id: userId,
                        org_id: orgId
                    });

                    resolve({ proposalId, status: ASSIGNMENT_STATUSES.DONE });
                }
            );
        });
    },

    /**
     * Get pending approvals for a user.
     * 
     * @param {string} userId - User ID
     * @param {string} orgId - Organization ID
     * @param {Object} [filters] - Optional filters
     * @param {string} [filters.status] - Filter by status
     * @param {number} [filters.limit] - Limit results
     * @param {number} [filters.offset] - Offset for pagination
     * @returns {Promise<Array>} List of assignments
     */
    getMyApprovals: async (userId, orgId, filters = {}) => {
        return new Promise((resolve, reject) => {
            const { status, limit = 50, offset = 0 } = filters;
            const params = [userId, orgId];

            let sql = `
                SELECT 
                    aa.*,
                    ad.action_type,
                    ad.scope,
                    ad.proposal_snapshot
                FROM approval_assignments aa
                LEFT JOIN action_decisions ad ON aa.proposal_id = ad.proposal_id
                WHERE aa.assigned_to_user_id = ? AND aa.org_id = ?
            `;

            if (status) {
                sql += ` AND aa.status = ?`;
                params.push(status);
            }

            sql += ` ORDER BY aa.sla_due_at ASC LIMIT ? OFFSET ?`;
            params.push(limit, offset);

            db.all(sql, params, (err, rows) => {
                if (err) return reject(err);

                const result = (rows || []).map(row => ({
                    ...row,
                    proposal_snapshot: row.proposal_snapshot ? JSON.parse(row.proposal_snapshot) : null,
                    isOverdue: new Date(row.sla_due_at) < new Date()
                }));

                resolve(result);
            });
        });
    },

    /**
     * Get all approvals for organization (Admin view).
     * 
     * @param {string} orgId - Organization ID
     * @param {Object} [filters] - Optional filters
     * @returns {Promise<Array>} List of assignments
     */
    getOrgApprovals: async (orgId, filters = {}) => {
        return new Promise((resolve, reject) => {
            const { status, includeOverdue = false, limit = 100, offset = 0 } = filters;
            const params = [orgId];

            let sql = `
                SELECT 
                    aa.*,
                    u.first_name, u.last_name, u.email,
                    ad.action_type,
                    ad.scope
                FROM approval_assignments aa
                LEFT JOIN users u ON aa.assigned_to_user_id = u.id
                LEFT JOIN action_decisions ad ON aa.proposal_id = ad.proposal_id
                WHERE aa.org_id = ?
            `;

            if (status) {
                sql += ` AND aa.status = ?`;
                params.push(status);
            }

            if (includeOverdue) {
                sql += ` AND aa.sla_due_at < datetime('now') AND aa.status IN ('PENDING', 'ACKED')`;
            }

            sql += ` ORDER BY aa.sla_due_at ASC LIMIT ? OFFSET ?`;
            params.push(limit, offset);

            db.all(sql, params, (err, rows) => {
                if (err) return reject(err);

                const result = (rows || []).map(row => ({
                    ...row,
                    isOverdue: new Date(row.sla_due_at) < new Date(),
                    assigneeName: `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.email
                }));

                resolve(result);
            });
        });
    },

    /**
     * Get overdue approvals count for an organization.
     * 
     * @param {string} orgId - Organization ID
     * @returns {Promise<number>} Count of overdue approvals
     */
    getOverdueCount: async (orgId) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT COUNT(*) as count FROM approval_assignments 
                 WHERE org_id = ? AND status IN ('PENDING', 'ACKED') 
                 AND sla_due_at < datetime('now')`,
                [orgId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row?.count || 0);
                }
            );
        });
    },

    /**
     * Get assignment by proposal ID.
     * 
     * @param {string} proposalId - Proposal ID
     * @param {string} orgId - Organization ID
     * @returns {Promise<Object|null>} Assignment or null
     */
    getAssignmentByProposal: async (proposalId, orgId) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM approval_assignments 
                 WHERE proposal_id = ? AND org_id = ?
                 ORDER BY created_at DESC LIMIT 1`,
                [proposalId, orgId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row || null);
                }
            );
        });
    }
};

module.exports = WorkqueueService;
