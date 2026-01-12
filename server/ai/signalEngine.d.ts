export default SignalEngine;
declare namespace SignalEngine {
    function detectSignals(context: Object): Array<Object>;
    function _detectUsersAtRisk(context: any): any[];
    function _detectBlockedInitiatives(context: any): any[];
    function _detectLowHelpAdoption(context: any): {
        type: string;
        severity: string;
        entity_type: string;
        entity_id: any;
        title: string;
        description: string;
        evidence: {
            total_started: number;
            total_completed: number;
            global_ratio: number;
            active_help_users: number;
        };
        explanation: string;
    }[];
    function _detectStrongTeamMembers(context: any): any[];
}
//# sourceMappingURL=signalEngine.d.ts.map