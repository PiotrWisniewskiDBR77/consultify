import { v4 as uuidv4 } from 'uuid';
import db from '../database.js';
// Dependency injection container (for deterministic unit tests)
const deps = {
    db: db,
    uuidv4,
};
const GovernanceService = {
    // For testing: allow overriding dependencies
    setDependencies: (newDeps = {}) => {
        Object.assign(deps, newDeps);
    },
    /**
     * Create a new Change Request
     */
    createChangeRequest: (crData) => {
        return new Promise((resolve, reject) => {
            const id = deps.uuidv4();
            const { projectId, title, description, type, riskAssessment, rationale, impactAnalysis, createdBy, aiAnalysis, aiRecommendedDecision, } = crData;
            const sql = `INSERT INTO change_requests (
                id, project_id, title, description, type, 
                status, risk_assessment, rationale, impact_analysis,
                created_by, ai_recommended_decision, ai_analysis
            ) VALUES (?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?)`;
            const params = [
                id,
                projectId,
                title,
                description,
                type,
                riskAssessment || 'LOW',
                rationale,
                JSON.stringify(impactAnalysis || []),
                createdBy,
                aiRecommendedDecision,
                aiAnalysis,
            ];
            deps.db.run(sql, params, function (err) {
                if (err)
                    return reject(err);
                resolve({ id, ...crData, status: 'DRAFT' });
            });
        });
    },
    /**
     * Approve or Reject a CR
     */
    decideChangeRequest: (id, status, userId, reason) => {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE change_requests 
                         SET status = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP, rejected_reason = ?
                         WHERE id = ?`;
            // Only set approved_by if approved
            const approver = status === 'APPROVED' ? userId : null;
            deps.db.run(sql, [status, approver, reason, id], function (err) {
                if (err)
                    return reject(err);
                resolve({ id, status, userId });
            });
        });
    },
};
export default GovernanceService;
//# sourceMappingURL=governanceService.js.map