export default AIAuditLogger;
declare namespace AIAuditLogger {
    function _setDependencies(newDeps?: {}): void;
    function logInteraction(entry: any): Promise<any>;
    function logWithExplanation({ userId, organizationId, projectId, explanation, aiResponse, actionType, correlationId }: {
        userId: string;
        organizationId: string;
        projectId: string;
        explanation: Object;
        aiResponse: string;
        actionType: string;
        correlationId?: string | undefined;
    }): Promise<Object>;
    function logSuggestion(userId: any, organizationId: any, projectId: any, aiRole: any, suggestion: any, context: any): Promise<any>;
    function recordUserDecision(auditId: any, decision: any, feedback?: null): Promise<any>;
    function getAuditLogs(organizationId: any, options?: {}): Promise<any>;
    function getAuditStats(organizationId: any, projectId?: null): Promise<any>;
    function getRoleDistribution(organizationId: any): Promise<any>;
    function clearOldLogs(organizationId: any, daysToKeep?: number): Promise<any>;
    function _setDb(mockDb: any): void;
}
//# sourceMappingURL=aiAuditLogger.d.ts.map