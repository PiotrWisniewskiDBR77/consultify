export default ManagementReportsService;
declare namespace ManagementReportsService {
    export { REPORT_TYPES };
    export { REPORT_SCOPES };
    export function generateTeamMeetingReport(projectId: string, options?: Object): Promise<Object>;
    export function generatePortfolioTeamReport(organizationId: string, options?: Object): Promise<Object>;
    export function generateSteeringCommitteeReport(projectId: string, options?: Object): Promise<Object>;
    export function generatePortfolioSteeringReport(organizationId: string, options?: Object): Promise<Object>;
    export function getReport(reportId: any): Promise<any>;
    export function getReportHistory(filters?: {}): Promise<any>;
    export function updateReportStatus(reportId: any, status: any): Promise<any>;
    export function createShareLink(reportId: any, expiresInDays?: number): Promise<{
        shareToken: string;
        expiresAt: string;
    }>;
    export function getReportByShareToken(shareToken: any): Promise<any>;
    export function _getProject(projectId: any): Promise<any>;
    export function _getActiveProjects(organizationId: any): Promise<any>;
    export function _getStatusSummary(projectId: any, periodStart: any, periodEnd: any): Promise<{
        progressPercent: number;
        healthStatus: string;
        tasksTotal: any;
        tasksCompleted: any;
        tasksInProgress: any;
        tasksBlocked: any;
        tasksOverdue: any;
        initiativesTotal: any;
        initiativesOnTrack: any;
        initiativesAtRisk: any;
        decisionsApproved: any;
        decisionsPending: any;
    }>;
    export function _getCompletedWork(projectId: any, periodStart: any, periodEnd: any): Promise<any>;
    export function _getWorkInProgress(projectId: any): Promise<any>;
    export function _getBlockers(projectId: any): Promise<any>;
    export function _getPendingDecisions(projectId: any): Promise<any>;
    export function _getNextPeriodPlan(projectId: any, periodDays: any): Promise<any>;
    export function _getOverallRAGStatus(projectId: any, healthSnapshot: any): Promise<{
        schedule: {
            category: string;
            status: string;
            trend: string;
            summary: string;
        };
        budget: {
            category: string;
            status: string;
            trend: string;
            summary: string;
            plannedBudget: null;
            actualSpend: null;
            spendPercent: null;
            forecastAtCompletion?: undefined;
            variancePercent?: undefined;
        } | {
            category: string;
            status: string;
            trend: string;
            summary: string;
            plannedBudget: any;
            actualSpend: any;
            spendPercent: number;
            forecastAtCompletion: any;
            variancePercent: number;
        } | {
            category: string;
            status: string;
            trend: string;
            summary: string;
            plannedBudget?: undefined;
            actualSpend?: undefined;
            spendPercent?: undefined;
            forecastAtCompletion?: undefined;
            variancePercent?: undefined;
        };
        scope: {
            category: string;
            status: string;
            trend: string;
            summary: string;
        };
        risk: {
            category: string;
            status: string;
            trend: string;
            summary: string;
        };
        overallHealth: string;
        lastUpdated: string;
    }>;
    export function _getKPIs(projectId: any): Promise<any>;
    export function _getRisksAndIssues(projectId: any): Promise<any>;
    export function _getDecisionsForBoard(projectId: any): Promise<any>;
    export function _getForecast(projectId: any): Promise<{
        nextMilestones: any;
        nextGates: any;
        forecastNarrative: string;
    }>;
    export function _saveReport(report: any): Promise<any>;
    export function _calculateRAGStatus(summary: any): "GREEN" | "AMBER" | "RED";
    export function _calculateOverallHealth(projectBreakdown: any): "GREEN" | "AMBER" | "RED";
    export function _worstStatus(statuses: any): "GREEN" | "AMBER" | "RED";
    export function _aggregatePortfolioStatus(projectStatuses: any): {
        schedule: {
            category: string;
            status: string;
            trend: string;
            summary: string;
        };
        budget: {
            category: string;
            status: string;
            trend: string;
            summary: string;
        };
        scope: {
            category: string;
            status: string;
            trend: string;
            summary: string;
        };
        risk: {
            category: string;
            status: string;
            trend: string;
            summary: string;
        };
        overallHealth: string;
        lastUpdated: string;
    };
    export function _getBudgetStatus(projectId: any): Promise<{
        category: string;
        status: string;
        trend: string;
        summary: string;
        plannedBudget: null;
        actualSpend: null;
        spendPercent: null;
        forecastAtCompletion?: undefined;
        variancePercent?: undefined;
    } | {
        category: string;
        status: string;
        trend: string;
        summary: string;
        plannedBudget: any;
        actualSpend: any;
        spendPercent: number;
        forecastAtCompletion: any;
        variancePercent: number;
    } | {
        category: string;
        status: string;
        trend: string;
        summary: string;
        plannedBudget?: undefined;
        actualSpend?: undefined;
        spendPercent?: undefined;
        forecastAtCompletion?: undefined;
        variancePercent?: undefined;
    }>;
    export function _calculateConfidence(milestones: any, gates: any, healthSnapshot: any, blockers: any): {
        level: string;
        reasons: string[];
        score: number;
    };
    export function _generateHighlights(completedWork: any, statusSummary: any): string[];
    export function _generateConcerns(blockers: any, statusSummary: any): string[];
    export function _calculateIntegrityHash(report: any): string;
    export function finalizeReport(reportId: string, userId: string): Promise<Object>;
    export function unlockReport(reportId: string, userId: string, reason: string): Promise<Object>;
    export function verifyIntegrity(reportId: string): Promise<Object>;
    export function isLocked(reportId: string): Promise<Object>;
    export function addComment(reportId: string, sectionId: string, content: string, userId: string, options?: Object): Promise<Object>;
    export function getComments(reportId: string, sectionId?: string): Promise<any[]>;
    export function resolveComment(commentId: string, userId: string): Promise<Object>;
    export function deleteComment(commentId: string, userId: string): Promise<Object>;
}
declare namespace REPORT_TYPES {
    let TEAM_MEETING: string;
    let STEERING_COMMITTEE: string;
}
declare namespace REPORT_SCOPES {
    let PROJECT: string;
    let PORTFOLIO: string;
}
//# sourceMappingURL=managementReportsService.d.ts.map