export default progressServiceInstance;
declare const progressServiceInstance: ProgressService;
declare class ProgressService {
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
     * Calculate initiative progress from its tasks
     * @returns {{ progress: number, totalTasks: number, completedTasks: number, isBlocked: boolean }}
     */
    calculateInitiativeProgress(initiativeId: any): {
        progress: number;
        totalTasks: number;
        completedTasks: number;
        isBlocked: boolean;
    };
    /**
     * Check if initiative has blocking decisions
     */
    hasBlockingDecisions(initiativeId: any): Promise<any>;
    /**
     * Check if initiative has unsatisfied hard dependencies
     */
    hasBlockingDependencies(initiativeId: any): Promise<any>;
    /**
     * Calculate project progress from initiatives
     */
    calculateProjectProgress(projectId: any): Promise<any>;
    /**
     * Calculate portfolio-level metrics
     */
    calculatePortfolioMetrics(organizationId: any): Promise<any>;
    /**
     * Update initiative progress (call after task changes)
     */
    updateInitiativeProgress(initiativeId: any): Promise<any>;
    /**
     * Update project progress (call after initiative changes)
     */
    updateProjectProgress(projectId: any): Promise<any>;
}
//# sourceMappingURL=progressService.d.ts.map