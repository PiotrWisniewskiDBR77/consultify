export default dependencyServiceInstance;
declare const dependencyServiceInstance: DependencyService;
declare class DependencyService {
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
     * Add a dependency between initiatives
     * @param {string} fromInitiativeId - The initiative that must complete first
     * @param {string} toInitiativeId - The dependent initiative
     * @param {string} type - FINISH_TO_START or SOFT
     */
    addDependency(fromInitiativeId: string, toInitiativeId: string, type?: string): Promise<any>;
    /**
     * Remove a dependency
     */
    removeDependency(dependencyId: any): Promise<any>;
    /**
     * Get all dependencies for an initiative
     */
    getDependencies(initiativeId: any): Promise<any>;
    /**
     * Build dependency graph for a project
     */
    buildDependencyGraph(projectId: any): Promise<any>;
    /**
     * Detect circular dependencies (deadlocks)
     */
    detectDeadlocks(projectId: any): Promise<{
        hasDeadlocks: boolean;
        cycles: any[];
    }>;
    /**
     * Check if an initiative can start (all hard dependencies satisfied)
     */
    canStart(initiativeId: any): Promise<any>;
    /**
     * Update dependency satisfaction status
     */
    updateSatisfaction(fromInitiativeId: any): Promise<any>;
}
//# sourceMappingURL=dependencyService.d.ts.map