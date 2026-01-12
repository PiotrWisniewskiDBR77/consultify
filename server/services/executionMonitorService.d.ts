export default executionMonitorServiceInstance;
declare const executionMonitorServiceInstance: ExecutionMonitorService;
declare class ExecutionMonitorService {
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
     * Run daily execution monitoring for a project
     */
    runDailyMonitor(projectId: any): Promise<{
        projectId: any;
        monitoredAt: string;
        issueCount: number;
        issues: {
            type: string;
            severity: string;
            count: any;
            items: any;
        }[];
        notificationsGenerated: number;
        notifications: {
            userId: any;
            type: string;
            severity: string;
            title: string;
            message: string;
            relatedObjectType: string;
            relatedObjectId: any;
        }[];
    }>;
    /**
     * Detect stalled tasks (no progress in 7+ days)
     */
    _detectStalledTasks(projectId: any): Promise<any>;
    /**
     * Detect overdue tasks
     */
    _detectOverdueTasks(projectId: any): Promise<any>;
    /**
     * Detect overdue decisions (pending for 7+ days)
     */
    _detectOverdueDecisions(projectId: any): Promise<any>;
    /**
     * Detect stalled initiatives
     */
    _detectStalledInitiatives(projectId: any): Promise<any>;
    /**
     * Detect silent blockers
     */
    _detectSilentBlockers(projectId: any): Promise<any>;
    /**
     * Generate AI execution summary
     */
    generateExecutionSummary(projectId: any): Promise<{
        projectId: any;
        summaryText: string;
        issues: {
            type: string;
            severity: string;
            count: any;
            items: any;
        }[];
        generatedAt: string;
    }>;
}
//# sourceMappingURL=executionMonitorService.d.ts.map