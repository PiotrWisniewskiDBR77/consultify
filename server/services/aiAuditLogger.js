// AI Audit Logger - Full audit trail for AI actions
// AI Core Layer — Enterprise PMO Brain
// Extended for AI Trust & Explainability Layer

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const AIAuditLogger = {
    /**
     * Log an AI interaction with full explainability support
     */
    logInteraction: async (entry) => {
        const {
            userId, organizationId, projectId,
            actionType, actionDescription,
            contextSnapshot, dataSourcesUsed,
            aiRole, policyLevel, confidenceLevel,
            aiSuggestion, userDecision, userFeedback,
            // AI Roles Model fields
            aiProjectRole,  // ADVISOR, MANAGER, OPERATOR
            justification,  // Reason for action
            approvingUser,  // User who approved (for OPERATOR actions)
            // AI Trust & Explainability fields
            regulatoryMode,
            reasoningSummary,
            dataUsed,
            constraintsApplied
        } = entry;

        const id = uuidv4();

        return new Promise((resolve, reject) => {
            db.run(`INSERT INTO ai_audit_logs 
                (id, user_id, organization_id, project_id, action_type, action_description,
                 context_snapshot, data_sources_used, ai_role, policy_level, confidence_level,
                 ai_suggestion, user_decision, user_feedback,
                 ai_project_role, justification, approving_user,
                 regulatory_mode, reasoning_summary, data_used_json, constraints_applied_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id, userId, organizationId, projectId,
                    actionType, actionDescription,
                    typeof contextSnapshot === 'string' ? contextSnapshot : JSON.stringify(contextSnapshot),
                    JSON.stringify(dataSourcesUsed || []),
                    aiRole, policyLevel, confidenceLevel,
                    aiSuggestion, userDecision, userFeedback,
                    // AI Roles Model fields
                    aiProjectRole || 'ADVISOR',
                    justification || null,
                    approvingUser || null,
                    // AI Trust & Explainability fields
                    regulatoryMode ? 1 : 0,
                    reasoningSummary || null,
                    dataUsed ? JSON.stringify(dataUsed) : null,
                    constraintsApplied ? JSON.stringify(constraintsApplied) : null
                ], function (err) {
                    if (err) return reject(err);
                    resolve({ id, actionType, aiProjectRole: aiProjectRole || 'ADVISOR' });
                });
        });
    },

    /**
     * Log AI interaction with full AIExplanation object
     * Primary entry point for AI Trust & Explainability Layer
     * 
     * @param {Object} params - Log parameters
     * @param {string} params.userId - User ID
     * @param {string} params.organizationId - Organization ID
     * @param {string} params.projectId - Project ID
     * @param {Object} params.explanation - AIExplanation object
     * @param {string} params.aiResponse - The AI response text
     * @param {string} params.actionType - Type of action (SUGGESTION, ACTION, etc.)
     * @returns {Promise<Object>} - Result with audit log ID
     */
    logWithExplanation: async ({ userId, organizationId, projectId, explanation, aiResponse, actionType = 'AI_RESPONSE' }) => {
        if (!explanation) {
            console.warn('[AIAuditLogger] logWithExplanation called without explanation object');
        }

        return AIAuditLogger.logInteraction({
            userId,
            organizationId,
            projectId,
            actionType,
            actionDescription: 'AI response with explainability metadata',
            contextSnapshot: null, // Context is represented in explanation
            dataSourcesUsed: explanation?.dataUsed?.externalSources || [],
            aiRole: explanation?.aiRole || 'ADVISOR',
            policyLevel: 'ADVISORY',
            confidenceLevel: explanation?.confidenceLevel || 'MEDIUM',
            aiSuggestion: aiResponse,
            aiProjectRole: explanation?.aiRole || 'ADVISOR',
            regulatoryMode: explanation?.regulatoryMode || false,
            reasoningSummary: explanation?.reasoningSummary || null,
            dataUsed: explanation?.dataUsed || null,
            constraintsApplied: explanation?.constraintsApplied || []
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
     * Get audit logs for organization with explainability data
     */
    getAuditLogs: async (organizationId, options = {}) => {
        const { projectId, userId, actionType, limit, offset, includeExplanation } = options;

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

                        // Parse explainability fields if requested
                        if (includeExplanation !== false) {
                            row.dataUsed = row.data_used_json ? JSON.parse(row.data_used_json) : null;
                            row.constraintsApplied = row.constraints_applied_json ? JSON.parse(row.constraints_applied_json) : [];

                            // Build explanation object for convenience
                            row.explanation = {
                                aiRole: row.ai_project_role || row.ai_role,
                                regulatoryMode: row.regulatory_mode === 1,
                                confidenceLevel: row.confidence_level,
                                reasoningSummary: row.reasoning_summary,
                                dataUsed: row.dataUsed,
                                constraintsApplied: row.constraintsApplied,
                                timestamp: row.created_at
                            };
                        }
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
