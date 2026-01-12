export default AIExecutiveReporting;
declare namespace AIExecutiveReporting {
    export { REPORT_TYPES };
    export { STATUS_INDICATORS };
    export function setDependencies(newDeps?: {}): void;
    export function generateReport(reportType: any, scope: any, options?: {}): Promise<{
        reportType: string;
        generatedAt: string;
        project: {
            id: any;
            name: any;
            owner: string;
            status: any;
        };
        overallStatus: {
            color: string;
            label: string;
            icon: string;
        };
        summary: {
            initiatives: {
                total: any;
                inExecution: any;
                completed: any;
            };
            tasks: {
                total: any;
                completed: any;
                completionRate: number;
                blocked: any;
                overdue: any;
            };
            decisions: {
                pending: any;
            };
            risks: any;
        };
        deviations: Promise<{
            type: string;
            severity: string;
            description: string;
            impact: string;
        }[]>;
        narrative: string;
        warnings: {
            severity: string;
            message: string;
        }[];
    } | {
        reportType: string;
        generatedAt: string;
        organizationId: any;
        summary: {
            totalProjects: any;
            onTrack: any;
            atRisk: any;
            offTrack: any;
            totalInitiatives: any;
            totalActiveTasks: any;
            totalBlockedTasks: any;
            totalPendingDecisions: any;
            totalCriticalRisks: any;
        };
        healthScore: number;
        healthStatus: string;
        projects: any;
        topConcerns: {
            type: string;
            count: any;
            projects: any;
        }[];
        narrative: string;
    } | {
        reportType: string;
        generatedAt: string;
        scope: any;
        risks: {
            total: any;
            critical: any;
            high: any;
            items: any;
        };
        decisions: {
            total: any;
            urgent: any;
            overdue: any;
            items: any;
        };
        actionRequired: {
            criticalRisks: any;
            overdueDecisions: any;
        };
        narrative: string;
    } | {
        reportType: string;
        generatedAt: string;
        scope: any;
        format: string;
        statusLine: {
            indicator: any;
            summary: string;
        };
        keyMetrics: {
            label: string;
            value: any;
            status: string;
        }[];
        topIssues: any[];
        recommendation: string;
        badNews: string[];
    }>;
    export function _generateProjectStatusReport(projectId: any, options: any): Promise<{
        reportType: string;
        generatedAt: string;
        project: {
            id: any;
            name: any;
            owner: string;
            status: any;
        };
        overallStatus: {
            color: string;
            label: string;
            icon: string;
        };
        summary: {
            initiatives: {
                total: any;
                inExecution: any;
                completed: any;
            };
            tasks: {
                total: any;
                completed: any;
                completionRate: number;
                blocked: any;
                overdue: any;
            };
            decisions: {
                pending: any;
            };
            risks: any;
        };
        deviations: Promise<{
            type: string;
            severity: string;
            description: string;
            impact: string;
        }[]>;
        narrative: string;
        warnings: {
            severity: string;
            message: string;
        }[];
    }>;
    export function _generatePortfolioOverview(organizationId: any, options: any): Promise<{
        reportType: string;
        generatedAt: string;
        organizationId: any;
        summary: {
            totalProjects: any;
            onTrack: any;
            atRisk: any;
            offTrack: any;
            totalInitiatives: any;
            totalActiveTasks: any;
            totalBlockedTasks: any;
            totalPendingDecisions: any;
            totalCriticalRisks: any;
        };
        healthScore: number;
        healthStatus: string;
        projects: any;
        topConcerns: {
            type: string;
            count: any;
            projects: any;
        }[];
        narrative: string;
    }>;
    export function _generateRiskDecisionReport(scopeId: any, options: any): Promise<{
        reportType: string;
        generatedAt: string;
        scope: any;
        risks: {
            total: any;
            critical: any;
            high: any;
            items: any;
        };
        decisions: {
            total: any;
            urgent: any;
            overdue: any;
            items: any;
        };
        actionRequired: {
            criticalRisks: any;
            overdueDecisions: any;
        };
        narrative: string;
    }>;
    export function _generateExecutiveBrief(scopeId: any, options: any): Promise<{
        reportType: string;
        generatedAt: string;
        scope: any;
        format: string;
        statusLine: {
            indicator: any;
            summary: string;
        };
        keyMetrics: {
            label: string;
            value: any;
            status: string;
        }[];
        topIssues: any[];
        recommendation: string;
        badNews: string[];
    }>;
    export function translateToNarrative(data: any, audience?: string): string;
    export function extractDeviations(projectId: any, taskMetrics: any, openRisks: any): Promise<{
        type: string;
        severity: string;
        description: string;
        impact: string;
    }[]>;
    export function _ensureTransparency({ taskMetrics, pendingDecisions, openRisks }: {
        taskMetrics: any;
        pendingDecisions: any;
        openRisks: any;
    }): {
        severity: string;
        message: string;
    }[];
    export function _extractBadNews(status: any, riskDecision: any): string[];
    export function _calculateProjectStatus(taskMetrics: any, pendingDecisions: any, openRisks: any): {
        color: string;
        label: string;
        icon: string;
    };
    export function _quickProjectStatus(project: any): {
        color: string;
        label: string;
        icon: string;
    };
    export function _identifyTopConcerns(projectStatuses: any): {
        type: string;
        count: any;
        projects: any;
    }[];
    export function _calculateDecisionUrgency(decision: any): "urgent" | "normal" | "overdue";
    export function _generateExecRecommendation(status: any, riskDecision: any): "Immediate attention required on critical risks. Recommend risk review meeting within 48 hours." | "Decision backlog needs clearing. Recommend decision-making session to unblock progress." | "Some projects need attention. Continue monitoring and address blockers proactively." | "Operations normal. Maintain current trajectory and focus on execution.";
    export function formatForExecutive(report: any): any;
}
declare namespace REPORT_TYPES {
    let PROJECT_STATUS: string;
    let PORTFOLIO_OVERVIEW: string;
    let RISK_DECISION: string;
    let EXECUTIVE_BRIEF: string;
}
declare namespace STATUS_INDICATORS {
    namespace GREEN {
        let color: string;
        let label: string;
        let icon: string;
    }
    namespace YELLOW {
        let color_1: string;
        export { color_1 as color };
        let label_1: string;
        export { label_1 as label };
        let icon_1: string;
        export { icon_1 as icon };
    }
    namespace RED {
        let color_2: string;
        export { color_2 as color };
        let label_2: string;
        export { label_2 as label };
        let icon_2: string;
        export { icon_2 as icon };
    }
    namespace GREY {
        let color_3: string;
        export { color_3 as color };
        let label_3: string;
        export { label_3 as label };
        let icon_3: string;
        export { icon_3 as icon };
    }
}
//# sourceMappingURL=aiExecutiveReporting.d.ts.map