/**
 * Report Approval Service
 * 
 * Multi-level approval workflow for Management Reports.
 * Integrates with WorkqueueService for SLA tracking.
 * 
 * PMO Standards:
 * - PRINCE2: Highlight Report approval by Project Board
 * - PMBOK 7: Stakeholder engagement and governance
 * - ISO 21500: Decision management processes
 */

import { getDatabase } from '../src/database/Database.ts';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';

// Default SLA: 48 hours
const DEFAULT_SLA_HOURS = 48;

// Approval statuses
const APPROVAL_STATUSES = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    SKIPPED: 'SKIPPED'
};

// Report approval statuses
const REPORT_APPROVAL_STATUSES = {
    NONE: 'NONE',
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED'
};

// Default approval configuration
const DEFAULT_APPROVAL_CONFIG = {
    levels: [
        { level: 1, role: 'MANAGER', required: true, slaHours: 48 }
    ],
    requireAllLevels: true
};

// Database helpers
function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

const ReportApprovalService = {
    APPROVAL_STATUSES,
    REPORT_APPROVAL_STATUSES,
    DEFAULT_SLA_HOURS,
    DEFAULT_APPROVAL_CONFIG,

    /**
     * Initialize approval workflow for a report
     * Creates approval records for each level in the config
     * 
     * @param {string} reportId - Report ID
     * @param {Object} config - Approval configuration
     * @param {string} userId - User initializing the workflow
     * @returns {Promise<Object>} Initialized approval chain
     */
    initializeApprovalWorkflow: async (reportId, config = DEFAULT_APPROVAL_CONFIG, userId) => {
        const report = await dbGet('SELECT * FROM management_reports WHERE id = ?', [reportId]);
        if (!report) {
            throw new Error('Report not found');
        }

        // Get current version ID if exists
        const currentVersion = await dbGet(
            'SELECT id FROM management_report_versions WHERE report_id = ? ORDER BY version_number DESC LIMIT 1',
            [reportId]
        );

        const approvals = [];
        const levels = config.levels || DEFAULT_APPROVAL_CONFIG.levels;

        for (const levelConfig of levels) {
            const id = uuidv4();
            const slaHours = levelConfig.slaHours || DEFAULT_SLA_HOURS;
            const slaDueAt = new Date(Date.now() + slaHours * 60 * 60 * 1000).toISOString();

            await dbRun(`
                INSERT INTO management_report_approvals 
                (id, report_id, version_id, approval_level, required_role, assigned_to, status, sla_due_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, CURRENT_TIMESTAMP)
            `, [
                id,
                reportId,
                currentVersion?.id || null,
                levelConfig.level,
                levelConfig.role,
                levelConfig.assignedTo || null,
                slaDueAt
            ]);

            approvals.push({
                id,
                reportId,
                versionId: currentVersion?.id,
                approvalLevel: levelConfig.level,
                requiredRole: levelConfig.role,
                assignedTo: levelConfig.assignedTo,
                status: APPROVAL_STATUSES.PENDING,
                slaDueAt
            });
        }

        // Update report status and config
        await dbRun(`
            UPDATE management_reports 
            SET approval_status = 'PENDING', 
                requires_approval = 1, 
                approval_config = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [JSON.stringify(config), reportId]);

        return {
            reportId,
            approvals,
            totalLevels: levels.length,
            currentLevel: 1
        };
    },

    /**
     * Submit report for approval
     * Transitions report from DRAFT to approval workflow
     * 
     * @param {string} reportId - Report ID
     * @param {string} userId - User submitting
     * @param {Object} options - Options (config override, etc.)
     * @returns {Promise<Object>} Submission result
     */
    submitForApproval: async (reportId, userId, options = {}) => {
        const report = await dbGet('SELECT * FROM management_reports WHERE id = ?', [reportId]);
        if (!report) {
            throw new Error('Report not found');
        }

        if (report.status !== 'DRAFT') {
            throw new Error(`Cannot submit report with status ${report.status}. Must be DRAFT.`);
        }

        if (report.locked_at) {
            throw new Error('Report is locked and cannot be submitted');
        }

        // Get or create approval config
        let config = options.config;
        if (!config && report.approval_config) {
            try {
                config = JSON.parse(report.approval_config);
            } catch (e) {
                config = DEFAULT_APPROVAL_CONFIG;
            }
        }
        if (!config) {
            // Try to get organization default preset
            const preset = await dbGet(`
                SELECT * FROM management_report_approval_presets 
                WHERE organization_id = ? AND (report_type = ? OR report_type IS NULL) AND is_default = 1
                ORDER BY report_type DESC LIMIT 1
            `, [report.organization_id, report.report_type]);

            if (preset && preset.levels) {
                try {
                    config = { levels: JSON.parse(preset.levels) };
                } catch (e) {
                    config = DEFAULT_APPROVAL_CONFIG;
                }
            } else {
                config = DEFAULT_APPROVAL_CONFIG;
            }
        }

        // Initialize workflow
        const workflow = await ReportApprovalService.initializeApprovalWorkflow(reportId, config, userId);

        // Log audit
        const ReportAuditService = require('./reportAuditService');
        await ReportAuditService.log(reportId, 'SUBMITTED_FOR_APPROVAL', userId, {
            config,
            totalLevels: workflow.totalLevels
        });

        return {
            success: true,
            reportId,
            approvalStatus: REPORT_APPROVAL_STATUSES.PENDING,
            workflow
        };
    },

    /**
     * Approve report at current level
     * 
     * @param {string} reportId - Report ID
     * @param {string} userId - Approving user
     * @param {string} comment - Optional approval comment
     * @returns {Promise<Object>} Approval result
     */
    approve: async (reportId, userId, comment = null) => {
        const report = await dbGet('SELECT * FROM management_reports WHERE id = ?', [reportId]);
        if (!report) {
            throw new Error('Report not found');
        }

        if (report.approval_status !== REPORT_APPROVAL_STATUSES.PENDING) {
            throw new Error('Report is not pending approval');
        }

        // Get user info
        const user = await dbGet('SELECT id, first_name, last_name, role FROM users WHERE id = ?', [userId]);
        if (!user) {
            throw new Error('User not found');
        }

        // Get current pending approval
        const pendingApproval = await dbGet(`
            SELECT * FROM management_report_approvals 
            WHERE report_id = ? AND status = 'PENDING'
            ORDER BY approval_level ASC LIMIT 1
        `, [reportId]);

        if (!pendingApproval) {
            throw new Error('No pending approval found');
        }

        // Verify user can approve this level
        const canApprove = await ReportApprovalService._canUserApprove(userId, pendingApproval, report.organization_id);
        if (!canApprove) {
            throw new Error(`User does not have permission to approve at level ${pendingApproval.approval_level}`);
        }

        // Update approval record
        await dbRun(`
            UPDATE management_report_approvals 
            SET status = 'APPROVED', 
                decision_comment = ?,
                decided_at = CURRENT_TIMESTAMP,
                decided_by = ?
            WHERE id = ?
        `, [comment, userId, pendingApproval.id]);

        // Check if there are more levels
        const nextPending = await dbGet(`
            SELECT * FROM management_report_approvals 
            WHERE report_id = ? AND status = 'PENDING' AND approval_level > ?
            ORDER BY approval_level ASC LIMIT 1
        `, [reportId, pendingApproval.approval_level]);

        let reportApprovalStatus = REPORT_APPROVAL_STATUSES.PENDING;
        if (!nextPending) {
            // All levels approved - finalize
            reportApprovalStatus = REPORT_APPROVAL_STATUSES.APPROVED;
            await dbRun(`
                UPDATE management_reports 
                SET approval_status = 'APPROVED', updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [reportId]);
        }

        // Log audit
        const ReportAuditService = require('./reportAuditService');
        await ReportAuditService.log(reportId, 'APPROVED', userId, {
            level: pendingApproval.approval_level,
            role: pendingApproval.required_role,
            comment,
            allLevelsComplete: !nextPending
        });

        return {
            success: true,
            reportId,
            approvedLevel: pendingApproval.approval_level,
            approvedByRole: pendingApproval.required_role,
            nextLevel: nextPending?.approval_level || null,
            reportApprovalStatus,
            allLevelsComplete: !nextPending
        };
    },

    /**
     * Reject report
     * 
     * @param {string} reportId - Report ID
     * @param {string} userId - Rejecting user
     * @param {string} comment - Required rejection reason
     * @param {boolean} returnToDraft - Return to DRAFT status
     * @returns {Promise<Object>} Rejection result
     */
    reject: async (reportId, userId, comment, returnToDraft = true) => {
        if (!comment) {
            throw new Error('Rejection comment is required');
        }

        const report = await dbGet('SELECT * FROM management_reports WHERE id = ?', [reportId]);
        if (!report) {
            throw new Error('Report not found');
        }

        if (report.approval_status !== REPORT_APPROVAL_STATUSES.PENDING) {
            throw new Error('Report is not pending approval');
        }

        // Get current pending approval
        const pendingApproval = await dbGet(`
            SELECT * FROM management_report_approvals 
            WHERE report_id = ? AND status = 'PENDING'
            ORDER BY approval_level ASC LIMIT 1
        `, [reportId]);

        if (!pendingApproval) {
            throw new Error('No pending approval found');
        }

        // Verify user can reject
        const canApprove = await ReportApprovalService._canUserApprove(userId, pendingApproval, report.organization_id);
        if (!canApprove) {
            throw new Error(`User does not have permission to reject at level ${pendingApproval.approval_level}`);
        }

        // Update approval record
        await dbRun(`
            UPDATE management_report_approvals 
            SET status = 'REJECTED', 
                decision_comment = ?,
                decided_at = CURRENT_TIMESTAMP,
                decided_by = ?
            WHERE id = ?
        `, [comment, userId, pendingApproval.id]);

        // Update report status
        const newStatus = returnToDraft ? 'DRAFT' : report.status;
        const newApprovalStatus = returnToDraft ? REPORT_APPROVAL_STATUSES.NONE : REPORT_APPROVAL_STATUSES.REJECTED;

        await dbRun(`
            UPDATE management_reports 
            SET approval_status = ?, 
                status = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [newApprovalStatus, newStatus, reportId]);

        // If returning to draft, clear remaining pending approvals
        if (returnToDraft) {
            await dbRun(`
                UPDATE management_report_approvals 
                SET status = 'SKIPPED'
                WHERE report_id = ? AND status = 'PENDING' AND id != ?
            `, [reportId, pendingApproval.id]);
        }

        // Log audit
        const ReportAuditService = require('./reportAuditService');
        await ReportAuditService.log(reportId, 'REJECTED', userId, {
            level: pendingApproval.approval_level,
            role: pendingApproval.required_role,
            comment,
            returnedToDraft: returnToDraft
        });

        return {
            success: true,
            reportId,
            rejectedAtLevel: pendingApproval.approval_level,
            comment,
            returnedToDraft: returnToDraft,
            reportApprovalStatus: newApprovalStatus
        };
    },

    /**
     * Get approval status for a report
     * 
     * @param {string} reportId - Report ID
     * @param {string} userId - Optional user ID to check permissions
     * @returns {Promise<Object>} Approval chain status
     */
    getApprovalStatus: async (reportId, userId = null) => {
        const report = await dbGet('SELECT * FROM management_reports WHERE id = ?', [reportId]);
        if (!report) {
            throw new Error('Report not found');
        }

        const approvals = await dbAll(`
            SELECT mra.*, 
                   u_assigned.first_name || ' ' || u_assigned.last_name as assigned_to_name,
                   u_decided.first_name || ' ' || u_decided.last_name as decided_by_name
            FROM management_report_approvals mra
            LEFT JOIN users u_assigned ON mra.assigned_to = u_assigned.id
            LEFT JOIN users u_decided ON mra.decided_by = u_decided.id
            WHERE mra.report_id = ?
            ORDER BY mra.approval_level ASC
        `, [reportId]);

        const currentPending = approvals.find(a => a.status === APPROVAL_STATUSES.PENDING);
        const currentLevel = currentPending?.approval_level || 
            (approvals.length > 0 ? Math.max(...approvals.map(a => a.approval_level)) + 1 : 0);

        let canApprove = false;
        let canReject = false;
        let currentUserLevel = null;

        if (userId && currentPending) {
            canApprove = await ReportApprovalService._canUserApprove(userId, currentPending, report.organization_id);
            canReject = canApprove;
            if (canApprove) {
                currentUserLevel = currentPending.approval_level;
            }
        }

        return {
            reportId,
            currentLevel,
            totalLevels: approvals.length,
            overallStatus: report.approval_status || REPORT_APPROVAL_STATUSES.NONE,
            levels: approvals.map(a => ({
                id: a.id,
                reportId: a.report_id,
                versionId: a.version_id,
                approvalLevel: a.approval_level,
                requiredRole: a.required_role,
                assignedTo: a.assigned_to,
                assignedToName: a.assigned_to_name,
                status: a.status,
                decisionComment: a.decision_comment,
                decidedAt: a.decided_at,
                decidedBy: a.decided_by,
                decidedByName: a.decided_by_name,
                slaDueAt: a.sla_due_at,
                createdAt: a.created_at
            })),
            canApprove,
            canReject,
            currentUserLevel
        };
    },

    /**
     * Get pending approvals for a user
     * 
     * @param {string} userId - User ID
     * @param {string} orgId - Organization ID
     * @param {Object} options - Pagination options
     * @returns {Promise<Object>} Pending approvals list
     */
    getPendingApprovalsForUser: async (userId, orgId, options = {}) => {
        const { limit = 20, offset = 0 } = options;

        // Get user role
        const user = await dbGet('SELECT role FROM users WHERE id = ?', [userId]);
        if (!user) {
            throw new Error('User not found');
        }

        // Get pending approvals where user can act
        const approvals = await dbAll(`
            SELECT mra.*, 
                   mr.title as report_title, 
                   mr.report_type, 
                   mr.scope,
                   mr.period_start,
                   mr.period_end,
                   p.name as project_name,
                   u_gen.first_name || ' ' || u_gen.last_name as generated_by_name
            FROM management_report_approvals mra
            JOIN management_reports mr ON mra.report_id = mr.id
            LEFT JOIN projects p ON mr.project_id = p.id
            LEFT JOIN users u_gen ON mr.generated_by = u_gen.id
            WHERE mra.status = 'PENDING'
              AND mr.organization_id = ?
              AND (
                  mra.assigned_to = ?
                  OR (mra.assigned_to IS NULL AND mra.required_role = ?)
              )
            ORDER BY mra.sla_due_at ASC
            LIMIT ? OFFSET ?
        `, [orgId, userId, user.role, limit, offset]);

        // Get total count
        const countResult = await dbGet(`
            SELECT COUNT(*) as total
            FROM management_report_approvals mra
            JOIN management_reports mr ON mra.report_id = mr.id
            WHERE mra.status = 'PENDING'
              AND mr.organization_id = ?
              AND (
                  mra.assigned_to = ?
                  OR (mra.assigned_to IS NULL AND mra.required_role = ?)
              )
        `, [orgId, userId, user.role]);

        return {
            approvals: approvals.map(a => ({
                id: a.id,
                reportId: a.report_id,
                reportTitle: a.report_title,
                reportType: a.report_type,
                scope: a.scope,
                projectName: a.project_name,
                periodStart: a.period_start,
                periodEnd: a.period_end,
                generatedByName: a.generated_by_name,
                approvalLevel: a.approval_level,
                requiredRole: a.required_role,
                slaDueAt: a.sla_due_at,
                createdAt: a.created_at,
                isOverdue: a.sla_due_at && new Date(a.sla_due_at) < new Date()
            })),
            total: countResult?.total || 0,
            limit,
            offset
        };
    },

    /**
     * Skip an approval level (admin function)
     * 
     * @param {string} reportId - Report ID
     * @param {number} level - Level to skip
     * @param {string} userId - Admin user ID
     * @param {string} reason - Reason for skipping
     * @returns {Promise<Object>} Skip result
     */
    skipApprovalLevel: async (reportId, level, userId, reason) => {
        if (!reason) {
            throw new Error('Reason is required to skip approval level');
        }

        const approval = await dbGet(`
            SELECT * FROM management_report_approvals 
            WHERE report_id = ? AND approval_level = ? AND status = 'PENDING'
        `, [reportId, level]);

        if (!approval) {
            throw new Error('Approval level not found or not pending');
        }

        await dbRun(`
            UPDATE management_report_approvals 
            SET status = 'SKIPPED', 
                decision_comment = ?,
                decided_at = CURRENT_TIMESTAMP,
                decided_by = ?
            WHERE id = ?
        `, [`SKIPPED: ${reason}`, userId, approval.id]);

        // Check if all levels done
        const remaining = await dbGet(`
            SELECT COUNT(*) as count 
            FROM management_report_approvals 
            WHERE report_id = ? AND status = 'PENDING'
        `, [reportId]);

        if (remaining.count === 0) {
            await dbRun(`
                UPDATE management_reports 
                SET approval_status = 'APPROVED', updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [reportId]);
        }

        // Log audit
        const ReportAuditService = require('./reportAuditService');
        await ReportAuditService.log(reportId, 'APPROVED', userId, {
            level,
            action: 'SKIPPED',
            reason
        });

        return {
            success: true,
            reportId,
            skippedLevel: level,
            reason
        };
    },

    /**
     * Get full approval history for a report
     * 
     * @param {string} reportId - Report ID
     * @returns {Promise<Array>} Approval history
     */
    getApprovalHistory: async (reportId) => {
        const history = await dbAll(`
            SELECT mra.*, 
                   u.first_name || ' ' || u.last_name as decided_by_name,
                   u.email as decided_by_email
            FROM management_report_approvals mra
            LEFT JOIN users u ON mra.decided_by = u.id
            WHERE mra.report_id = ?
            ORDER BY mra.approval_level ASC, mra.created_at ASC
        `, [reportId]);

        return history.map(h => ({
            id: h.id,
            approvalLevel: h.approval_level,
            requiredRole: h.required_role,
            status: h.status,
            decisionComment: h.decision_comment,
            decidedAt: h.decided_at,
            decidedBy: h.decided_by,
            decidedByName: h.decided_by_name,
            decidedByEmail: h.decided_by_email,
            slaDueAt: h.sla_due_at,
            createdAt: h.created_at
        }));
    },

    /**
     * Check if user can approve at given level
     * @private
     */
    _canUserApprove: async (userId, approval, orgId) => {
        // If specifically assigned, only that user can approve
        if (approval.assigned_to) {
            return approval.assigned_to === userId;
        }

        // Otherwise, check user role matches required role
        const user = await dbGet(`
            SELECT u.role, pm.role as project_role
            FROM users u
            LEFT JOIN project_members pm ON pm.user_id = u.id
            WHERE u.id = ?
        `, [userId]);

        if (!user) return false;

        // Map roles
        const roleMapping = {
            'MANAGER': ['ADMIN', 'MANAGER', 'admin'],
            'PMO_LEAD': ['ADMIN', 'PMO_LEAD', 'admin', 'owner'],
            'SPONSOR': ['ADMIN', 'SPONSOR', 'SUPERADMIN', 'admin', 'owner']
        };

        const allowedRoles = roleMapping[approval.required_role] || [];
        return allowedRoles.includes(user.role) || allowedRoles.includes(user.project_role);
    },

    /**
     * Create an approval preset for an organization
     * 
     * @param {string} orgId - Organization ID
     * @param {Object} preset - Preset configuration
     * @param {string} userId - Creating user
     * @returns {Promise<Object>} Created preset
     */
    createApprovalPreset: async (orgId, preset, userId) => {
        const id = uuidv4();

        await dbRun(`
            INSERT INTO management_report_approval_presets 
            (id, organization_id, name, description, report_type, levels, is_default, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
            id,
            orgId,
            preset.name,
            preset.description || null,
            preset.reportType || null,
            JSON.stringify(preset.levels),
            preset.isDefault ? 1 : 0,
            userId
        ]);

        // If default, unset other defaults
        if (preset.isDefault) {
            await dbRun(`
                UPDATE management_report_approval_presets 
                SET is_default = 0 
                WHERE organization_id = ? AND id != ? AND (report_type = ? OR (report_type IS NULL AND ? IS NULL))
            `, [orgId, id, preset.reportType, preset.reportType]);
        }

        return { id, ...preset };
    },

    /**
     * Get approval presets for an organization
     * 
     * @param {string} orgId - Organization ID
     * @returns {Promise<Array>} Presets
     */
    getApprovalPresets: async (orgId) => {
        const presets = await dbAll(`
            SELECT * FROM management_report_approval_presets 
            WHERE organization_id = ?
            ORDER BY is_default DESC, name ASC
        `, [orgId]);

        return presets.map(p => ({
            id: p.id,
            organizationId: p.organization_id,
            name: p.name,
            description: p.description,
            reportType: p.report_type,
            levels: JSON.parse(p.levels || '[]'),
            isDefault: !!p.is_default,
            createdBy: p.created_by,
            createdAt: p.created_at,
            updatedAt: p.updated_at
        }));
    }
};

export default ReportApprovalService;














