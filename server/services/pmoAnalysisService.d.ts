export default pmoAnalysisServiceInstance;
declare const pmoAnalysisServiceInstance: PMOAnalysisService;
declare class PMOAnalysisService {
    _db: any;
    get db(): any;
    /**
     * Initialize service dependencies
     */
    init(): Promise<this>;
    /**
     * Set dependencies for testing
     */
    setDependencies(mockDeps: any): void;
    /**
     * Run full PMO analysis for a project
     */
    analyzeProject(projectId: any): Promise<{
        projectId: any;
        healthScore: number;
        status: string;
        issues: {
            type: string;
            severity: string;
            message: string;
            items: any;
        }[];
        warnings: {
            type: string;
            severity: string;
            message: string;
            items: any;
        }[];
        recommendations: string[];
        analyzedAt: string;
    }>;
    /**
     * Detect initiatives without owners
     */
    detectOrphanInitiatives(projectId: any): Promise<any>;
    /**
     * Detect initiatives without tasks
     */
    detectInitiativesWithoutTasks(projectId: any): Promise<any>;
    /**
     * Detect overloaded users (>10 active tasks)
     */
    detectOverloadedUsers(projectId: any): Promise<any>;
    /**
     * Detect stalled initiatives (no updates in 7+ days)
     */
    detectStalledInitiatives(projectId: any): Promise<any>;
    /**
     * Explain why something is blocked
     */
    explainBlocker(objectType: any, objectId: any): Promise<{
        objectType: any;
        objectId: any;
        isBlocked: boolean;
        reasons: {
            type: any;
            message: any;
        }[];
    }>;
}
//# sourceMappingURL=pmoAnalysisService.d.ts.map