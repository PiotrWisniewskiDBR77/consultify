export default StatusReportService;
declare namespace StatusReportService {
    export function generateReport(orgId: any, initiativeId: any, periodType: any, userId: any, options?: {}): Promise<{
        id: string;
        initiativeId: any;
        initiativeName: any;
        periodType: any;
        periodLabel: string;
        overallStatus: string;
        sections: {};
        narrative: {
            executiveSummary: string;
            accomplishments: string[];
            nextSteps: string[];
            escalations: {
                type: string;
                message: string;
                requiredAction: string;
            }[];
            risksAndIssues: string;
            recommendations: string;
        };
        status: string;
    }>;
    export function calculatePeriod(periodType: any, referenceDate?: Date): {
        periodStart: string;
        periodEnd: string;
        periodLabel: string;
    };
    export function gatherReportData(initiativeId: any, orgId: any, periodStart: any, periodEnd: any): Promise<{
        progress: any;
        status: any;
        blockedReason: any;
        tasksTotal: any;
        tasksCompleted: any;
        tasksInProgress: any;
        tasksBlocked: any;
        tasksCompletedThisPeriod: any;
        budgetConsumedPercent: number;
        isOverBudget: boolean;
        openRisks: any;
        openIssues: any;
        highPriorityItems: any;
        pendingDecisions: any;
        trend: string;
    }>;
    export function calculateSectionStatuses(data: any): {};
    export function calculateOverallStatus(sections: any): "GREEN" | "AMBER" | "RED";
    export function generateNarrative(initiative: any, data: any, sections: any): Promise<{
        executiveSummary: string;
        accomplishments: string[];
        nextSteps: string[];
        escalations: {
            type: string;
            message: string;
            requiredAction: string;
        }[];
        risksAndIssues: string;
        recommendations: string;
    }>;
    export function getReport(reportId: any, orgId: any): Promise<{
        id: any;
        initiativeId: any;
        initiativeName: any;
        projectId: any;
        periodType: any;
        periodStart: any;
        periodEnd: any;
        periodLabel: any;
        overallStatus: any;
        overallTrend: any;
        sections: any;
        executiveSummary: any;
        accomplishments: any;
        nextSteps: any;
        escalations: any;
        risksAndIssues: any;
        recommendations: any;
        metrics: {
            progressPercent: any;
            budgetConsumedPercent: any;
            tasksCompleted: any;
            tasksTotal: any;
            openRisks: any;
            openIssues: any;
            pendingDecisions: any;
        };
        status: any;
        generationMethod: any;
        createdBy: string | null;
        createdAt: any;
        updatedAt: any;
    } | null>;
    export function listReports(initiativeId: any, orgId: any, options?: {}): Promise<{
        id: any;
        periodType: any;
        periodLabel: any;
        overallStatus: any;
        status: any;
        progressPercent: any;
        createdBy: string | null;
        createdAt: any;
    }[]>;
    export function updateReport(reportId: any, updates: any, userId: any): Promise<boolean>;
    export function approveReport(reportId: any, userId: any): Promise<void>;
    export function publishReport(reportId: any): Promise<void>;
    export function createDistribution(reportId: any, recipientData: any): Promise<{
        id: string;
    }>;
    export function markDistributionSent(distributionId: any): Promise<void>;
    export { RAG_STATUS };
    export { SECTION_NAMES };
    export { PERIOD_TYPES };
}
declare namespace RAG_STATUS {
    let GREEN: string;
    let AMBER: string;
    let RED: string;
}
declare namespace SECTION_NAMES {
    let SCHEDULE: string;
    let BUDGET: string;
    let SCOPE: string;
    let QUALITY: string;
    let RISKS: string;
    let RESOURCES: string;
}
declare namespace PERIOD_TYPES {
    let WEEKLY: string;
    let MONTHLY: string;
    let QUARTERLY: string;
}
//# sourceMappingURL=statusReportService.d.ts.map