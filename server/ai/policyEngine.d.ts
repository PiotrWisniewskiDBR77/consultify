export default PolicyEngine;
declare namespace PolicyEngine {
    let NEVER_AUTO_APPROVE_RISK_LEVELS: string[];
    let ALWAYS_MANUAL_ACTION_TYPES: string[];
    function evaluatePolicy({ proposal, organizationId }: {
        proposal: Object;
        organizationId: string;
    }): Promise<{
        matched: boolean;
        decision: string | null;
        reason: string | null;
        rule_id: string | null;
    }>;
    function isGloballyEnabled(): Promise<boolean>;
    function setGlobalStatus(enabled: boolean, userId: string): Promise<void>;
    function getMatchingRules(organizationId: string, proposal: Object): Promise<any[]>;
    function evaluateConditions(conditions: Object, proposal: Object, organizationId: string): Promise<boolean>;
    namespace CONDITION_HANDLERS {
        function risk_level_lte(value: any, proposal: any): Promise<boolean>;
        function action_type_in(value: any, proposal: any): Promise<boolean>;
        function scope_eq(value: any, proposal: any): Promise<boolean>;
        function signal_in(value: any, proposal: any): Promise<boolean>;
        function max_actions_per_day(value: any, proposal: any, organizationId: any): Promise<boolean>;
        function time_window(value: any): Promise<boolean>;
    }
    function getAutoApprovedCountToday(organizationId: string): Promise<number>;
    function getRules(organizationId: string): Promise<any[]>;
    function getAllRules(): Promise<any[]>;
    function toggleRule(ruleId: string, enabled: boolean): Promise<Object>;
    function createRule(data: Object): Promise<Object>;
    function getGlobalStatus(): Promise<Object>;
}
//# sourceMappingURL=policyEngine.d.ts.map