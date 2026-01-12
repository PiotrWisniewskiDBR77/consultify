export default pmoHealthServiceInstance;
declare const pmoHealthServiceInstance: PMOHealthService;
declare class PMOHealthService {
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
     * Get PMOHealthSnapshot for a project
     * Returns a canonical snapshot of project health status
     *
     * @param {string} projectId - The project ID
     * @returns {Promise<PMOHealthSnapshot>}
     */
    getHealthSnapshot(projectId: string): Promise<PMOHealthSnapshot>;
    /**
     * Get task counts efficiently
     */
    _getTaskCounts(projectId: any): Promise<any>;
    /**
     * Get decision counts efficiently
     */
    _getDecisionCounts(projectId: any): Promise<any>;
    /**
     * Get initiative counts efficiently
     */
    _getInitiativeCounts(projectId: any): Promise<any>;
    /**
     * Get blockers across all types
     */
    _getBlockers(projectId: any): Promise<{
        type: string;
        message: string;
        ref: {
            entityType: string;
            entityId: any;
        };
    }[]>;
    /**
     * Get current phase for a project
     */
    _getCurrentPhase(projectId: any): Promise<any>;
}
//# sourceMappingURL=pmoHealthService.d.ts.map