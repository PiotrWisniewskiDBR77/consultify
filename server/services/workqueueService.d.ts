export default WorkqueueService;
declare namespace WorkqueueService {
    export function setDependencies(newDeps?: {}): void;
    export { ASSIGNMENT_STATUSES };
    export { DEFAULT_SLA_HOURS };
    export function assignApproval({ proposalId, assignedToUserId, orgId, slaDueAt, createdBy }: {
        proposalId: string;
        assignedToUserId: string;
        orgId: string;
        slaDueAt?: Date | undefined;
        createdBy?: string | undefined;
    }): Promise<Object>;
    export function acknowledgeApproval(proposalId: string, userId: string, orgId: string): Promise<Object>;
    export function completeApproval(proposalId: string, userId: string, orgId: string): Promise<Object>;
    export function getMyApprovals(userId: string, orgId: string, filters?: {
        status?: string | undefined;
        limit?: number | undefined;
        offset?: number | undefined;
    }): Promise<any[]>;
    export function getOrgApprovals(orgId: string, filters?: Object): Promise<any[]>;
    export function getOverdueCount(orgId: string): Promise<number>;
    export function getAssignmentByProposal(proposalId: string, orgId: string): Promise<Object | null>;
}
declare namespace ASSIGNMENT_STATUSES {
    let PENDING: string;
    let ACKED: string;
    let DONE: string;
    let EXPIRED: string;
}
declare const DEFAULT_SLA_HOURS: 48;
//# sourceMappingURL=workqueueService.d.ts.map