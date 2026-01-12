export default AIMemoryMetricsService;
declare namespace AIMemoryMetricsService {
    function setDependencies(newDeps?: {}): void;
    function recordOperation(operationType: any, context: any, metrics: any): Promise<any>;
    function getDashboardMetrics(organizationId: any, periodDays?: number): Promise<any>;
    function getCurrentMemoryState(projectId: any, organizationId: any): Promise<{
        projectMemory: {
            tokens: any;
            itemCount: any;
            majorDecisions: any;
            phaseTransitions: any;
            recommendations: any;
        };
        organizationMemory: {
            tokens: any;
            patterns: any;
            style: any;
        };
        totalTokens: any;
        efficiency: {
            utilizationPercent: string;
            recommendedLimit: number;
        };
    } | {
        projectMemory: {
            tokens: number;
            itemCount: number;
            majorDecisions?: undefined;
            phaseTransitions?: undefined;
            recommendations?: undefined;
        };
        organizationMemory: {
            tokens: number;
            patterns: number;
            style?: undefined;
        };
        totalTokens: number;
        efficiency: {
            utilizationPercent: number;
            recommendedLimit: number;
        };
    }>;
    function getLatencyPercentiles(organizationId: any, windowHours?: number): Promise<any>;
    function aggregateDailyMetrics(): Promise<any>;
}
//# sourceMappingURL=aiMemoryMetricsService.d.ts.map