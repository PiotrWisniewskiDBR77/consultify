const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const GovernanceService = {

    /**
     * Create a new Change Request
     * @param {Object} crData - { projectId, title, type, description, createdBy ... }
     * @returns {Promise<Object>} Created CR
     */
    createChangeRequest: (crData) => {
        return new Promise((resolve, reject) => {
            const id = uuidv4();
            const {
                projectId, title, description, type, riskAssessment,
                rationale, impactAnalysis, createdBy, aiAnalysis, aiRecommendedDecision
            } = crData;

            const sql = `INSERT INTO change_requests (
                id, project_id, title, description, type, 
                status, risk_assessment, rationale, impact_analysis,
                created_by, ai_recommended_decision, ai_analysis
            ) VALUES (?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?)`;

            const params = [
                id, projectId, title, description, type,
                riskAssessment || 'LOW', rationale, JSON.stringify(impactAnalysis || []),
                createdBy, aiRecommendedDecision, aiAnalysis
            ];

            db.run(sql, params, function (err) {
                if (err) return reject(err);
                resolve({ id, ...crData, status: 'DRAFT' });
            });
        });
    },

    /**
     * Approve or Reject a CR
     * @param {string} id - CR ID
     * @param {string} status - APPROVED | REJECTED
     * @param {string} userId - Approver ID
     * @param {string} reason - Optional reasoning
     */
    decideChangeRequest: (id, status, userId, reason) => {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE change_requests 
                         SET status = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP, rejected_reason = ?
                         WHERE id = ?`;

            // Only set approved_by if approved
            const approver = status === 'APPROVED' ? userId : null;

            db.run(sql, [status, approver, reason, id], function (err) {
                if (err) return reject(err);
                resolve({ id, status, userId });
            });
        });
    }
};

module.exports = GovernanceService;
