export default AIContextBuilder;
declare namespace AIContextBuilder {
    function buildContext(orgId: string): Promise<Object>;
    function _getOrganization(orgId: any): Promise<any>;
    function _getUsers(orgId: any): Promise<any>;
    function _getTasks(orgId: any): Promise<any>;
    function _getInitiatives(orgId: any): Promise<any>;
    function _getHelpEvents(orgId: any): Promise<any>;
    function _getMetrics(orgId: any): Promise<any>;
    function _getLifecycleEvents(orgId: any): Promise<any>;
    function _calculateTaskDistribution(tasks: any): {
        total: any;
        by_status: {};
        by_priority: {};
        user_load: {};
    };
    function _calculateInitiativeStatus(initiatives: any): any;
    function _calculateHelpCompletionRatios(events: any): {};
    function _processMetricsFunnel(metrics: any): {};
}
//# sourceMappingURL=aiContextBuilder.d.ts.map