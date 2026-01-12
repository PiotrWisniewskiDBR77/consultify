declare const _default: ManagementReportRepository;
export default _default;
declare class ManagementReportRepository {
    db: any;
    saveReport(report: any): Promise<any>;
    getReportById(reportId: any): Promise<any>;
    updateStatus(reportId: any, status: any): Promise<any>;
    createShareLink(reportId: any, shareToken: any, expiresAt: any): Promise<any>;
    getByShareToken(shareToken: any): Promise<any>;
    getReports(filters: any): Promise<any>;
    getProjectById(projectId: any): Promise<any>;
    getActiveProjects(organizationId: any): Promise<any>;
    finalizeReport(reportId: any, integrityHash: any, userId: any): Promise<any>;
    unlockReport(reportId: any): Promise<any>;
    addComment(comment: any): Promise<any>;
    getComments(reportId: any): Promise<any>;
    getCommentById(commentId: any): Promise<any>;
    resolveComment(commentId: any, userId: any): Promise<any>;
    deleteComment(commentId: any): Promise<any>;
    getUser(userId: any): Promise<any>;
    getTaskStatistics(projectId: any): Promise<any>;
    getInitiativeStatistics(projectId: any): Promise<any>;
    getDecisionStatistics(projectId: any): Promise<any>;
    getCompletedTasks(projectId: any, periodStart: any, periodEnd: any): Promise<any>;
    getInProgressTasks(projectId: any): Promise<any>;
    getBlockedTasks(projectId: any): Promise<any>;
    getPendingProjectDecisions(projectId: any): Promise<any>;
    getUpcomingTasks(projectId: any, dueDateLimit: any): Promise<any>;
    getRiskStatistics(projectId: any): Promise<any>;
    getBudgetMetrics(projectId: any): Promise<any>;
    getCustomKPIs(projectId: any): Promise<any>;
    getBasicTaskMetrics(projectId: any): Promise<any>;
    getActiveRisksAndIssues(projectId: any): Promise<any>;
    getBoardDecisions(projectId: any): Promise<any>;
    getMilestones(projectId: any): Promise<any>;
    getStageGates(projectId: any): Promise<any>;
}
//# sourceMappingURL=ManagementReportRepository.d.ts.map