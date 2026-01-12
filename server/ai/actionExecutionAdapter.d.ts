export default ActionExecutionAdapter;
declare namespace ActionExecutionAdapter {
    function executeDecision(decisionId: string, executedBy?: string, options?: {
        dry_run?: boolean | undefined;
    }): Promise<Object>;
    function _dryRunExecutor(executor: any, actionType: any, payload: any, metadata: any): Promise<any>;
}
//# sourceMappingURL=actionExecutionAdapter.d.ts.map