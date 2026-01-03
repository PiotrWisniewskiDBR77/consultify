import db from '../database';
import { v4 as uuidv4 } from 'uuid';

interface Database {
    run: (sql: string, params: unknown[], callback: (this: { lastID: number; changes: number }, err: Error | null) => void) => void;
}

export interface ChangeRequestData {
    projectId: string;
    title: string;
    description?: string;
    type: string;
    riskAssessment?: string;
    rationale?: string;
    impactAnalysis?: unknown[];
    createdBy: string;
    aiAnalysis?: string;
    aiRecommendedDecision?: string;
}

export interface ChangeRequestResult {
    id: string;
    projectId: string;
    title: string;
    description?: string;
    type: string;
    status: string;
    riskAssessment?: string;
    rationale?: string;
    impactAnalysis?: unknown[];
    createdBy: string;
    aiAnalysis?: string;
    aiRecommendedDecision?: string;
}

export interface DecisionResult {
    id: string;
    status: string;
    userId: string;
}

export interface GovernanceServiceInterface {
    setDependencies: (newDeps?: Partial<{ db: Database; uuidv4: () => string }>) => void;
    createChangeRequest: (crData: ChangeRequestData) => Promise<ChangeRequestResult>;
    decideChangeRequest: (id: string, status: 'APPROVED' | 'REJECTED', userId: string, reason?: string) => Promise<DecisionResult>;
}

// Dependency injection container (for deterministic unit tests)
const deps = {
    db: db as Database,
    uuidv4
};

const GovernanceService: GovernanceServiceInterface = {
    // For testing: allow overriding dependencies
    setDependencies: (newDeps: Partial<{ db: Database; uuidv4: () => string }> = {}) => {
        Object.assign(deps, newDeps);
    },

    /**
     * Create a new Change Request
     */
    createChangeRequest: (crData: ChangeRequestData): Promise<ChangeRequestResult> => {
        return new Promise((resolve, reject) => {
            const id = deps.uuidv4();
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

            deps.db.run(sql, params, function (err) {
                if (err) return reject(err);
                resolve({ id, ...crData, status: 'DRAFT' });
            });
        });
    },

    /**
     * Approve or Reject a CR
     */
    decideChangeRequest: (id: string, status: 'APPROVED' | 'REJECTED', userId: string, reason?: string): Promise<DecisionResult> => {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE change_requests 
                         SET status = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP, rejected_reason = ?
                         WHERE id = ?`;

            // Only set approved_by if approved
            const approver = status === 'APPROVED' ? userId : null;

            deps.db.run(sql, [status, approver, reason, id], function (err) {
                if (err) return reject(err);
                resolve({ id, status, userId });
            });
        });
    }
};

export default GovernanceService;
