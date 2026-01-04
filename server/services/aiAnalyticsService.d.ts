export default AIAnalyticsService;
declare namespace AIAnalyticsService {
    function setDependencies(newDeps: object): void;
    function getUsageTrends(organizationId: string, range?: string): Promise<any>;
    function getModelUsage(organizationId: string, range?: string): Promise<any>;
    function getCapabilityUsage(organizationId: string, range?: string): Promise<any>;
    function getHourlyDistribution(organizationId: string, range?: string): Promise<any>;
    function getSLAMetrics(range?: string): Promise<any>;
    function getPeriodComparison(organizationId: string, range?: string): Promise<{
        current: any;
        previous: any;
        change: number;
        changePercent: number;
        metric: string;
    }[]>;
    function getFullAnalytics(organizationId: string, range?: string): Promise<{
        trends: any;
        modelUsage: any;
        capabilityUsage: any;
        hourlyDistribution: any;
        comparison: {
            current: any;
            previous: any;
            change: number;
            changePercent: number;
            metric: string;
        }[];
        summary: {
            totalRequests: any;
            totalTokens: any;
            totalCost: number;
            uniqueUsers: number;
            avgRequestsPerDay: number;
            avgCostPerRequest: number;
            topModel: any;
            topCapability: any;
        };
    }>;
    function getActionStats(organizationId: any): Promise<any>;
    function getApprovalStats(organizationId: any): Promise<any>;
    function getPlaybookStats(organizationId: any): Promise<any>;
    function getDeadLetterStats(organizationId: any): Promise<any>;
    function getROISummary(organizationId: any): Promise<{
        hours_saved: number;
        cost_saved: number;
        actions_executed: any;
        playbooks_completed: any;
    }>;
    function exportData(organizationId: any, format?: string): Promise<{
        content_type: string;
        content: string;
        filename: string;
        exported_at?: undefined;
        organization_id?: undefined;
        summary?: undefined;
        actions?: undefined;
        approvals?: undefined;
    } | {
        exported_at: string;
        organization_id: any;
        summary: {
            totalRequests: any;
            totalTokens: any;
            totalCost: number;
            uniqueUsers: number;
            avgRequestsPerDay: number;
            avgCostPerRequest: number;
            topModel: any;
            topCapability: any;
        };
        actions: any;
        approvals: any;
        content_type?: undefined;
        content?: undefined;
        filename?: undefined;
    }>;
}
//# sourceMappingURL=aiAnalyticsService.d.ts.map