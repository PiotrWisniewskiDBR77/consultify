export default ActionDecisionService;
declare namespace ActionDecisionService {
    namespace MODIFIED_ALLOWLIST {
        let TASK_CREATE: string[];
        let PLAYBOOK_ASSIGN: string[];
        let MEETING_SCHEDULE: string[];
        let ROLE_SUGGESTION: string[];
    }
    function setDependencies(newDeps: object): void;
    function recordDecision(data: {
        proposal_id: string;
        organization_id: string;
        decision: string;
        decided_by_user_id: string;
        reason?: string | undefined;
        modified_payload?: Object | undefined;
    }): Promise<Object>;
    function getDecisionsByProposal(proposalId: string): Promise<any[]>;
    function getAuditLog(organizationId: string, filters?: Object): Promise<any[]>;
    function evaluatePolicyForProposal(proposal: Object, organizationId: string): Promise<Object>;
    function autoDecideByPolicy(proposal: Object, organizationId: string): Promise<Object | null>;
}
//# sourceMappingURL=actionDecisionService.d.ts.map