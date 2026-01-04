export default ExecutionService;
declare namespace ExecutionService {
    function getExecutionSummary(projectId: any): Promise<any>;
    function getBlockedTasks(projectId: any): Promise<any>;
    function checkDecisionGate(projectId: any, targetPhase: any): Promise<any>;
}
//# sourceMappingURL=executionService.d.ts.map