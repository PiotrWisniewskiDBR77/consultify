// AI Audit Logger - Full audit trail for AI actions
// AI Core Layer — Enterprise PMO Brain

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const AIAuditLogger = {
    /**
     * Log an AI interaction
     */
    logInteraction: async (entry) => {
        const {
            userId, organizationId, projectId,
            actionType, actionDescription,
            contextSnapshot, dataSourcesUsed,
            aiRole, policyLevel, confidenceLevel,
            aiSuggestion, userDecision, userFeedback
        } = entry;

        const id = uuidv4();

        return new Promise((resolve, reject) => {
            db.run(`INSERT INTO ai_audit_logs 
                (id, user_id, organization_id, project_id, action_type, action_description,
                 context_snapshot, data_sources_used, ai_role, policy_level, confidence_level,
                 ai_suggestion, user_decision, user_feedback)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id, userId, organizationId, projectId,
                    actionType, actionDescription,
                    typeof contextSnapshot === 'string' ? contextSnapshot : JSON.stringify(contextSnapshot),
                    JSON.stringify(dataSourcesUsed || []),
                    aiRole, policyLevel, confidenceLevel,
                    aiSuggestion, userDecision, userFeedback
                ], function (err) {
                    if (err) return reject(err);
                    resolve({ id, actionType });
                });
        });
    },

    /**
     * Log AI suggestion
     */
    logSuggestion: async (userId, organizationId, projectId, aiRole, suggestion, context) => {
        return AIAuditLogger.logInteraction({
            userId, organizationId, projectId,
            actionType: 'SUGGESTION',
            actionDescription: 'AI provided suggestion',
            contextSnapshot: context,
            aiRole,
            policyLevel: 'ADVISORY',
            aiSuggestion: suggestion,
            userDecision: null
        });
    },

    /**
     * Update user decision on a logged suggestion
     */
    recordUserDecision: async (auditId, decision, feedback = null) => {
        return new Promise((resolve, reject) => {
            db.run(`UPDATE ai_audit_logs 
                    SET user_decision = ?, user_feedback = ?
                    WHERE id = ?`,
                [decision, feedback, auditId], function (err) {
                    if (err) return reject(err);
                    resolve({ updated: this.changes > 0 });
                });
        });
    },

    /**
     * Get audit logs for organization
     */
    getAuditLogs: async (organizationId, options = {}) => {
        const { projectId, userId, actionType, limit, offset } = options;

        return new Promise((resolve, reject) => {
            let sql = `SELECT al.*, u.first_name, u.last_name 
                       FROM ai_audit_logs al
                       LEFT JOIN users u ON al.user_id = u.id
                       WHERE al.organization_id = ?`;
            const params = [organizationId];

            if (projectId) {
                sql += ` AND al.project_id = ?`;
                params.push(projectId);
            }
            if (userId) {
                sql += ` AND al.user_id = ?`;
                params.push(userId);
            }
            if (actionType) {
                sql += ` AND al.action_type = ?`;
                params.push(actionType);
            }

            sql += ` ORDER BY al.created_at DESC LIMIT ? OFFSET ?`;
            params.push(limit || 50, offset || 0);

            db.all(sql, params, (err, rows) => {
                if (err) return reject(err);

                const result = (rows || []).map(row => {
                    try {
                        row.contextSnapshot = JSON.parse(row.context_snapshot || '{}');
                        row.dataSourcesUsed = JSON.parse(row.data_sources_used || '[]');
                    } catch { }
                    return row;
                });

                resolve(result);
            });
        });
    },

    /**
     * Get audit statistics
     */
    getAuditStats: async (organizationId, projectId = null) => {
        return new Promise((resolve, reject) => {
            let sql = `SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN user_decision = 'ACCEPTED' THEN 1 ELSE 0 END) as accepted,
                        SUM(CASE WHEN user_decision = 'REJECTED' THEN 1 ELSE 0 END) as rejected,
                        SUM(CASE WHEN user_decision = 'MODIFIED' THEN 1 ELSE 0 END) as modified,
                        SUM(CASE WHEN user_decision = 'IGNORED' THEN 1 ELSE 0 END) as ignored,
                        SUM(CASE WHEN user_decision IS NULL THEN 1 ELSE 0 END) as pending
                       FROM ai_audit_logs WHERE organization_id = ?`;
            const params = [organizationId];

            if (projectId) {
                sql += ` AND project_id = ?`;
                params.push(projectId);
            }

            db.get(sql, params, (err, row) => {
                if (err) return reject(err);

                const total = row?.total || 0;
                const accepted = row?.accepted || 0;

                resolve({
                    total,
                    accepted,
                    rejected: row?.rejected || 0,
                    modified: row?.modified || 0,
                    ignored: row?.ignored || 0,
                    pending: row?.pending || 0,
                    acceptanceRate: total > 0 ? Math.round((accepted / total) * 100) : 0
                });
            });
        });
    },

    /**
     * Get role distribution
     */
    getRoleDistribution: async (organizationId) => {
        return new Promise((resolve, reject) => {
            db.all(`SELECT ai_role, COUNT(*) as count 
                    FROM ai_audit_logs WHERE organization_id = ?
                    GROUP BY ai_role`,
                [organizationId], (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                });
        });
    },

    /**
     * Clear old audit logs (retention policy)
     */
    clearOldLogs: async (organizationId, daysToKeep = 90) => {
        return new Promise((resolve, reject) => {
            db.run(`DELETE FROM ai_audit_logs 
                    WHERE organization_id = ? 
                    AND created_at < datetime('now', '-${daysToKeep} days')`,
                [organizationId], function (err) {
                    if (err) return reject(err);
                    resolve({ deleted: this.changes });
                });
        });
    }
};

module.exports = AIAuditLogger;
