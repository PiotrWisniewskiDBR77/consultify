export default ActionProposalEngine;
declare namespace ActionProposalEngine {
    function generateProposals(context: Object): Array<Object>;
    function getProposalById(orgId: string, proposalId: string): Promise<Object | null>;
}
//# sourceMappingURL=actionProposalEngine.d.ts.map