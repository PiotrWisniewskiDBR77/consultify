interface Database {
    run: (sql: string, params: unknown[], callback: (this: {
        lastID: number;
        changes: number;
    }, err: Error | null) => void) => void;
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
    setDependencies: (newDeps?: Partial<{
        db: Database;
        uuidv4: () => string;
    }>) => void;
    createChangeRequest: (crData: ChangeRequestData) => Promise<ChangeRequestResult>;
    decideChangeRequest: (id: string, status: 'APPROVED' | 'REJECTED', userId: string, reason?: string) => Promise<DecisionResult>;
}
declare const GovernanceService: GovernanceServiceInterface;
export default GovernanceService;
//# sourceMappingURL=governanceService.d.ts.map