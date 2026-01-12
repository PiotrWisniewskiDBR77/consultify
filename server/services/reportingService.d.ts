export default ReportingService;
declare const ReportingService: typeof BaseService & {
    /**
     * Generate Executive Overview
     * REFACTORED: Uses BaseService query helpers and parallel queries
     */
    generateExecutiveOverview: (organizationId: any, userId: any) => Promise<{
        reportType: string;
        generatedAt: string;
        generatedBy: any;
        portfolioHealth: {
            totalProjects: any;
            activeProjects: any;
            onTrack: any;
            atRisk: any;
            blocked: any;
        };
        phaseDistribution: any;
        topRisks: string[];
        pendingDecisions: any;
        overdueDecisions: any;
        initiativesOnTrack: any;
        initiativesDelayed: any;
        aiNarrative: string;
        changesSinceLastReview: never[];
    }>;
    /**
     * Generate Project Health Report
     * REFACTORED: Uses BaseService query helpers and parallel queries
     */
    generateProjectHealthReport: (projectId: any, userId: any) => Promise<{
        reportType: string;
        projectId: any;
        generatedAt: string;
        generatedBy: any;
        initiativeDistribution: any;
        decisionLatencyDays: number;
        blockedItems: any;
        capacityStressedUsers: any;
        stabilizationSummary: any;
    }>;
    /**
     * Generate Governance Report
     */
    generateGovernanceReport: (projectId: any, userId: any) => Promise<{
        reportType: string;
        projectId: any;
        generatedAt: string;
        generatedBy: any;
        decisionsTaken: any;
        decisionsPending: any;
        recentDecisions: any;
        escalations: any;
        gatesPassed: any;
    }>;
    /**
     * Generate AI narrative for executive summary
     */
    _generateNarrative: (portfolioHealth: any, decisionStats: any, risks: any) => string;
    /**
     * Generate Organization Overview Report
     * For shareable reports - contains summary info without sensitive details
     */
    generateOrganizationOverviewReport: (organizationId: any) => Promise<{
        reportType: string;
        generatedAt: string;
        organization: {
            name: any;
            type: any;
            status: any;
            memberSince: any;
        };
        transformationContext: any;
        overallProgress: number;
        initiativesSummary: any;
        activeBlockers: any;
        upcomingTasks: any;
    }>;
    /**
     * Generate Initiative Execution Report
     * Detailed view of a single initiative for sharing
     */
    generateInitiativeExecutionReport: (initiativeId: any, organizationId: any) => Promise<{
        reportType: string;
        generatedAt: string;
        initiative: {
            id: any;
            title: any;
            description: any;
            status: any;
            priority: any;
            dueDate: any;
            owner: any;
        };
        progress: number;
        taskStats: {
            total: any;
            completed: any;
            inProgress: any;
            blocked: any;
            todo: any;
        };
        tasks: any;
        blockers: any;
        upcomingDeadlines: any;
    }>;
};
import BaseService from './BaseService.js';
//# sourceMappingURL=reportingService.d.ts.map