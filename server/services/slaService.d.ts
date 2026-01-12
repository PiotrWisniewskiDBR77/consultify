export default SLAService;
declare namespace SLAService {
    export { SLA_CHECK_INTERVAL_MS };
    export function findExpiredAssignments(): Promise<any[]>;
    export function markExpired(assignmentId: string): Promise<boolean>;
    export function findOrgAdmin(orgId: string): Promise<Object | null>;
    export function escalateAssignment(assignmentId: string, toUserId: string, reason?: string): Promise<Object>;
    export function runSlaCheck(): Promise<Object>;
    export function getSlaHealth(orgId: string): Promise<Object>;
}
declare const SLA_CHECK_INTERVAL_MS: number;
//# sourceMappingURL=slaService.d.ts.map